import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

/**
 * Global agent command guard — Pi adapter.
 *
 * CANONICAL SOURCE: hub-service `.pi/command-guard/index.ts`. The installed
 * copy at ~/.pi/agent/extensions/command-guard/index.ts must match this file
 * byte for byte; `.pi/adapter-conformance.sh` compares the two, so the global
 * file is reviewable and its drift is detectable instead of invisible.
 *
 * Three doors, the first two shared with every other harness on this machine:
 *
 *   1. The denylist (~/.agents/hooks/dangerous-patterns.txt, one POSIX-ERE
 *      regex per line) — the same file Claude Code, Codex and Cursor read.
 *   2. The protected-path door (<repo>/.claude/hooks/protect.py) — the same
 *      script Claude Code and Codex run as a PreToolUse hook. Without this,
 *      a bash-capable pi could write to src/router/ or .claude/hooks/ through
 *      a shell redirect while the denylist waved it past, because the denylist
 *      only knows catastrophic verbs and knows nothing about this repo.
 *   3. The worktree bound (S12) — pi's seat gained `edit`/`write`, so those two
 *      tools now go through the same protected-path door as bash, plus a root
 *      check against $PI_WRITE_ROOT. protect.py speaks Claude's tool vocabulary,
 *      so a pi `write` is translated into the `Write`/`file_path` shape it
 *      already understands rather than teaching the shared door a third dialect.
 *
 * Fails OPEN by design for the denylist and protect.py: if a file is missing or
 * the adapter throws, the tool call proceeds. A broken guard must never brick
 * every tool call — these are seatbelts against accidents, not a sandbox against
 * a malicious agent (regex can always be obfuscated around). The worktree bound
 * is the one exception and fails CLOSED: it only exists when PI_WRITE_ROOT is
 * set, which only an orchestration launch does, and an orchestration launch is
 * not a human at the wheel. scripts/pi-dispatch.sh likewise refuses to start pi
 * at all when any link of this chain is missing.
 *
 * Pattern syntax: the file uses POSIX `[[:space:]]`; JS RegExp needs `\s`.
 * Converted per-pattern at load time.
 */

type JsonObject = Record<string, unknown>;

const PATTERNS_FILE = `${process.env.HOME ?? ''}/.agents/hooks/dangerous-patterns.txt`;
const BLOCKED_REASON =
  'Blocked by the global dangerous-command guard (~/.agents/hooks/dangerous-patterns.txt). Do not retry it or try to work around the guard; explain the block to the user instead.';

let cached: { patterns: RegExp[]; mtimeMs: number } | null = null;

function loadPatterns(): RegExp[] {
  try {
    const stat = fs.statSync(PATTERNS_FILE);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached.patterns;

    const text = fs.readFileSync(PATTERNS_FILE, 'utf-8');
    const patterns: RegExp[] = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      try {
        // Convert POSIX character classes for JS regex engines.
        patterns.push(new RegExp(line.replaceAll('[:space:]', '\\s')));
      } catch {
        // Skip a single unparseable pattern; never fail the guard.
      }
    }
    cached = { patterns, mtimeMs: stat.mtimeMs };
    return patterns;
  } catch {
    return []; // fail open: unreadable file -> no patterns -> no block
  }
}

function commandFromInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as JsonObject;
  const cmd = obj.command;
  return typeof cmd === 'string' ? cmd : '';
}

/** Pi's `edit` and `write` tools both carry the target as `input.path`. */
function pathFromInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const target = (input as JsonObject).path;
  return typeof target === 'string' ? target : '';
}

/** Nearest ancestor of cwd that carries the repo guard — protect.py's own walk. */
function findProtectHook(cwd: string): string | null {
  let dir = path.resolve(cwd);
  for (;;) {
    const hook = path.join(dir, '.claude', 'hooks', 'protect.py');
    if (fs.existsSync(hook)) return hook;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Run the repo's protected-path door over this call. Returns a block reason
 * when protect.py exits 2 (its block contract), null otherwise — including
 * when there is no guarded repo here, which is not a guarded context at all.
 */
function protectBlock(payload: JsonObject, cwd: string): string | null {
  const hook = findProtectHook(cwd);
  if (!hook) return null;
  const result = spawnSync('python3', [hook], {
    input: JSON.stringify({ ...payload, cwd }),
    encoding: 'utf-8',
    timeout: 10_000,
  });
  if (result.error || result.status !== 2) return null; // fail open on anything but a clean block
  return (result.stderr || '').trim() || 'Blocked by the repository protected-path guard.';
}

/**
 * The S12 write bound. Only armed when PI_WRITE_ROOT is set (an orchestration
 * launch), and then it fails CLOSED: a worker writes inside its own worktree or
 * it does not write. An unresolvable path is refused rather than waved through.
 */
function outsideWriteRoot(target: string, cwd: string): string | null {
  const root = process.env.PI_WRITE_ROOT;
  if (!root) return null;
  const rootReal = fs.realpathSync(root);
  const absolute = path.resolve(cwd, target);
  // realpath the nearest EXISTING ancestor: the file itself usually does not
  // exist yet, and a symlinked parent would otherwise smuggle a write out.
  let probe = absolute;
  for (;;) {
    if (fs.existsSync(probe)) break;
    const parent = path.dirname(probe);
    if (parent === probe) break;
    probe = parent;
  }
  const resolved = path.join(fs.realpathSync(probe), path.relative(probe, absolute));
  if (resolved === rootReal || resolved.startsWith(`${rootReal}${path.sep}`)) return null;
  return `Blocked: this worker writes only inside its worktree (${rootReal}); '${target}' resolves outside it.`;
}

/**
 * The directory this tool call resolves relative paths against. It MUST come from
 * the call's own context, not process.cwd(): a subagent runs in-process but with
 * its own `working_dir`, so a parent-cwd assumption would let a spawned child
 * write `notes.ts` into some other directory while the guard cheerfully resolved
 * it inside the worktree. A sub-agent is not a wider seat.
 */
function cwdOf(ctx: unknown): string {
  const value = (ctx as JsonObject | null)?.cwd;
  return typeof value === 'string' && value ? value : process.cwd();
}

export default function commandGuard(pi: ExtensionAPI): void {
  pi.on('tool_call', (event, ctx) => {
    try {
      const cwd = cwdOf(ctx);

      if (event.toolName === 'bash') {
        const command = commandFromInput(event.input);
        if (!command.trim()) return;

        const patterns = loadPatterns();
        for (const pattern of patterns) {
          if (pattern.test(command)) {
            return { block: true, reason: BLOCKED_REASON };
          }
        }

        const reason = protectBlock({ tool_name: 'Bash', tool_input: { command } }, cwd);
        if (reason) return { block: true, reason };
        return;
      }

      // Delegation must not become escalation. A pi sub-agent runs in-process,
      // inheriting this adapter, PI_WRITE_ROOT and the stripped credentials — so
      // it is genuinely the same seat. A `claude` or `codex` backend is a
      // different process with different doors and its own billing, which is a
      // wider seat wearing a sub-agent's name. Only armed under PI_WRITE_ROOT:
      // an interactive human choosing a backend is not an orchestration launch.
      if (event.toolName === 'subagent_spawn' && process.env.PI_WRITE_ROOT) {
        const harness = (event.input as JsonObject | null)?.harness;
        if (typeof harness === 'string' && harness !== 'pi') {
          return {
            block: true,
            reason: `Blocked: a dispatched worker may only spawn 'pi' sub-agents, not '${harness}'. A sub-agent inherits this seat's bounds; another harness would not.`,
          };
        }
        const dir = (event.input as JsonObject | null)?.working_dir;
        if (typeof dir === 'string' && dir) {
          const escaped = outsideWriteRoot(dir, cwd);
          if (escaped) return { block: true, reason: escaped };
        }
        return;
      }

      if (event.toolName === 'edit' || event.toolName === 'write') {
        const target = pathFromInput(event.input);
        if (!target.trim()) return;

        // Ordering matters: the worktree bound is the one check that fails
        // closed, so it runs before anything that can throw its way past.
        let bound: string | null;
        try {
          bound = outsideWriteRoot(target, cwd);
        } catch {
          bound = process.env.PI_WRITE_ROOT
            ? `Blocked: '${target}' could not be resolved against the worktree write bound.`
            : null;
        }
        if (bound) return { block: true, reason: bound };

        const reason = protectBlock(
          { tool_name: 'Write', tool_input: { file_path: path.resolve(cwd, target) } },
          cwd,
        );
        if (reason) return { block: true, reason };
      }
    } catch {
      // Fail open: an adapter error must never block tool use.
      return;
    }
  });
}
