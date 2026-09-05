# UXW01 stabilization — Herdr runbook

Every command here was checked against the **installed** CLI on 2026-09-05.
Where the CLI does not support something, this file says so instead of guessing.

## Precondition

```
test "${HERDR_ENV:-}" = 1
```
If that fails you are not in a Herdr-managed pane. Do not run any `herdr`
control command; reopen the work inside Herdr.

Verified at planning time: **passes**.

## What the installed CLI actually supports

```
herdr agent start <NAME> --kind <KIND> --pane <ID> [--timeout MS] [-- <AGENT_ARGS>...]
herdr agent prompt <target> <text> [--wait] [--until STATUS]... [--timeout MS]
herdr agent read <target> [--source visible|recent|recent-unwrapped] [--lines N]
herdr agent wait <target> [--until STATUS]... [--timeout MS]
herdr agent list | get <target> | rename <target> <name> | focus <target>
herdr pane list | get | split | run | send-text | send-keys | wait-output | read
herdr tab create [--workspace ID] [--cwd PATH] [--label TEXT] [--focus|--no-focus]
herdr worktree create|open|list|remove
```

Agent kinds (exact list from `--kind` help):
`pi, claude, codex, gemini, cursor, devin, agy, cline, omp, mastracode, opencode,
copilot, kimi, kiro, droid, amp, grok, hermes, kilo, qodercli, qwen, maki`

**There is no `muse` agent kind.** Muse Spark 1.3 runs through **`opencode`**,
which is a supported kind. Confirmed from a live pane reporting
`OpenCode/muse-spark-1.3-contributor-free`. Model id:

```
opencode/muse-spark-1.3-contributor-free
```

### Model and effort flags — verified

- Claude: `claude --model opus --effort high`.
  `--effort` accepts `low|medium|high|xhigh|max`.
- opencode TUI: `opencode -m opencode/muse-spark-1.3-contributor-free`.
  **`--variant` (reasoning effort) exists only on `opencode run` (headless), not
  on the interactive TUI.** There is no effort flag for the TUI, and
  `~/.config/opencode/opencode.jsonc` is empty. Effort is therefore selected
  **in-session** (ctrl+p command palette) or via a config that sets
  `default_agent` plus `agent.<name>.variant`.
  **Always confirm the footer** with `herdr pane read <id> --source visible`
  before prompting — it prints the model and effort, e.g.
  `Build · Muse Spark 1.3 Free OpenCode Zen · xhigh`.

## Layout

Workspace `wN`. Planning/review stays in tab `wN:t2`. Agents live in tab
`wN:t3` ("uxw01-agents"), four equal panes:

| Pane | Lane | Worktree |
|---|---|---|
| `wN:pA` | A core (Opus) | `/Users/joyaltitus/Documents/wt/uxw01-core` |
| `wN:pB` | B ui (Muse) | `/Users/joyaltitus/Documents/wt/uxw01-ui` |
| `wN:pC` | C ext (Muse) | `/Users/joyaltitus/Documents/wt/uxw01-ext` |
| `wN:pD` | D final (Muse) | `/Users/joyaltitus/Documents/sales-app` |

Pane ids change if panes are closed and recreated. **Always re-read them** —
never copy ids from this document:

```
herdr pane list | python3 -c "import json,sys;[print(p['pane_id'],p['tab_id'],p['cwd']) for p in json.load(sys.stdin)['result']['panes']]"
```

## Worktrees

Created from `13a1d23`, dependencies installed:

```
git worktree list | grep uxw01
```
Expect `uxw01-core [uxw01/core]`, `uxw01-ui [uxw01/ui]`, `uxw01-ext [uxw01/ext]`.

Lanes A, B and C run **in parallel** — their file allowlists are disjoint by
whole file, so no two agents can touch the same file. Lane D runs **only after**
all three have pushed and exited.

## Starting a lane

Point the pane's shell at the worktree, then start the agent:

```
herdr pane run <PANE> 'cd /Users/joyaltitus/Documents/wt/uxw01-core'
herdr agent start opus-core --kind claude --pane <PANE> -- --model opus --effort high
```

For a Muse lane:

```
herdr pane run <PANE> 'cd /Users/joyaltitus/Documents/wt/uxw01-ui'
herdr agent start muse-ui --kind opencode --pane <PANE> -- -m opencode/muse-spark-1.3-contributor-free
```

`agent start` returns only once the agent is detected and ready for input.

Then confirm what actually loaded before trusting it:

```
herdr pane read <PANE> --source visible --lines 12
```

## Delivering a prompt

Two ways, deliberately different:

- **Type it without submitting** (Joyal presses Enter himself):
  ```
  herdr pane send-text <PANE> '<prompt text>'
  ```
  `send-text` writes the text into the pane and does **not** submit it.

- **Submit and wait** (unattended):
  ```
  herdr agent prompt <NAME> '<prompt text>' --wait --timeout 600000
  ```

Read a result:
```
herdr agent read <NAME> --source recent-unwrapped --lines 200
```

If an alternate-screen TUI makes the response unrecoverable, ask that agent to
write a Markdown handoff and return only the path:
> "Write your full report to docs/sessions/uxw01-stabilization/HANDOFF-<lane>.md
> and reply with only that path."

## Status and blocking

```
herdr agent list
herdr agent get <NAME>
herdr agent wait <NAME> --until idle --timeout 900000
```
If an agent goes `blocked`, inspect it and **ask Joyal**. Never answer a material
product decision on his behalf.

## Hygiene

- Preserve the caller's working directory; address panes by id, never by
  position.
- Parse ids from JSON output. Never copy an id from an example.
- Use `--no-focus` for background panes.
- **Never close a pane, tab, workspace or session you did not create.**
- Lanes A/B/C may run together. Lane D must not start until they have exited.
- Never run two agents in the same worktree.

## Verification commands

```
# per lane, inside its worktree
git status --short
git log --oneline 13a1d23..HEAD
npx tsc -b && npm test && npm run build
npm run check:no-service-role && npm run check:tokens && npm run ext:build

# integration
git log --oneline --graph main..uxw01/stabilization
gh pr list --head uxw01/stabilization
gh pr checks <N>
git log --oneline -1 origin/production
curl -s https://sales-app-joyal.zeabur.app/version.json
```

## Manual fallback — if Herdr cannot route Muse Spark

If `herdr agent start --kind opencode` fails to detect the agent, drive the pane
directly. This loses agent-status detection and `agent prompt --wait`, but works:

```
herdr pane run <PANE> 'cd /Users/joyaltitus/Documents/wt/uxw01-ui && opencode -m opencode/muse-spark-1.3-contributor-free'
herdr pane wait-output <PANE> --match 'OpenCode' --timeout 60000
herdr pane read <PANE> --source visible --lines 15      # confirm model + effort
herdr pane send-text <PANE> '<prompt>'                  # Joyal presses Enter
herdr pane read <PANE> --source recent-unwrapped --lines 200
```

A second fallback exists: a standalone `muse` binary at `~/.local/bin/muse`,
which **does** take effort as a flag:
```
muse --model muse-spark-1.3 --reasoning-effort xhigh
```
It is not a Herdr agent kind, so it must be driven entirely through
`pane send-text` / `pane read`. Use it only if opencode cannot be made to work.

## Known environment issues

- A stale session lock can block every Bash call with
  `BLOCKED: STALE LOCK session-<id>`. The printed recovery command **omits
  `LOCK_HOME` and fails silently** outside hub-service. The working form is:
  ```
  LOCK_HOME="$HOME/.claude/projects/-Users-joyaltitus-Documents-sales-app/locks" \
    python3 /Users/joyaltitus/Documents/sales-app/.claude/hooks/lock_guard.py \
    --release-stale session-<id>
  ```
  Confirm the holder process is genuinely dead first (`ps aux | grep claude`,
  and check the holder's transcript mtime).
- `scripts/ext-shots.mjs` imports Playwright by **absolute path** from
  `~/Documents/hub-service/node_modules` and needs a display. It only runs on
  this machine. Never report harness results from anywhere it cannot import.
- The repo's protect hook blocks any shell command whose text contains a
  forbidden flag string — including inside a heredoc. Write documentation
  mentioning such flags with a file-writing tool, not a shell heredoc.
