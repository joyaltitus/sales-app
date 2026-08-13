#!/usr/bin/env python3
"""PreToolUse guard for Edit|Write|MultiEdit and Bash.

Blocks agent writes to protected paths (config-driven via
.claude/protected-paths.json) and dangerous git bypasses. Exit 2 blocks the
tool call and feeds stderr back to the model; exit 0 allows.

Override (human-only): Joyal runs  `touch .claude/tmp/allow-protected`  in his
own terminal; the next protected PRODUCT-path edit consumes the file and is
allowed. The file may instead contain an integer N (`echo 3 > ...`) to
pre-approve N protected writes in one go (DEV-SYSTEM-V2 — kills the
one-touch-per-write thrash from P4-S2). SYSTEM paths (hooks, this file's
config, lefthook, tripwires) are never overridable in-session — edit them in a
normal editor, not via the agent. The Bash guard blocks the agent from creating
the override file itself; this is a deterrent against accidents, not a
cryptographic wall — lefthook + review catch the rest.

Worktree-aware (DEV-SYSTEM-V2; scope rule pinned down by RBLD-02): the repo root
is resolved by walking up to the nearest .claude/protected-paths.json — from the
SESSION cwd for Bash, and from the FILE BEING WRITTEN for Edit/Write/MultiEdit/
NotebookEdit. So a session running in .claude/worktrees/<wt> gets ITS OWN config
and override flag, AND a write that reaches into a different root is judged by
that root rather than sailing through unrecognised. CLAUDE_PROJECT_DIR is the
fallback only. One-line rule in RUNBOOK "Hook activation".

DEVSYS-04 (devsys-01-findings.md §G/§11.4): the Bash write-verb branch used to
match a protected path if its text appeared ANYWHERE in the command string —
`node scripts/check-zle-manifest.js --gate > /tmp/o` blocked because the
system path's text sits in argv, though the actual write target is /tmp/o.
Fixed by resolving actual write TARGETS (redirect operands; non-flag args of
rm/mv/cp/tee/truncate/unlink/shred; last-arg heuristic for `sed -i`) and
matching protected paths against THOSE only. Same call, malformed stdin JSON
now fails CLOSED (was `sys.exit(0)`, justified by a lefthook backstop that
checks no protected paths at all) and every denial appends one line to
.claude/tmp/guard-log (timestamp, tool, rule, command/path) — a counter, not a
gate, so /close-lite can answer "did this guard fire only false positives?"
from data.

DEVSYS-09: SYSTEM paths gained an approval door. They used to be absolutely
unwritable by the agent — the system branch denied and exited BEFORE
consume_override() was ever reached, so `allow-protected` could not unlock them
and every hook/settings/lefthook change cost Joyal a manual hand-apply (see
STATE_HISTORY §DEVSYS-07, which is the session that paid that toll and measured
it). Now `.claude/tmp/allow-system` — a SEPARATE file from the product door,
with the same touch=1 / `echo N`=N counter — approves system writes, and each
approved write is recorded in the guard ledger as `system-path-approved`.
What did NOT change, and must not: arming a flag is human-only (the self-grant
check now covers ALL THREE files — the system flag was agent-creatable until
DEVSYS-09, and RBLD-02 added the prod-creds door to the same check), the doors
never open each other, and Bash writes to protected paths stay blocked outright
so a system change lands as a reviewable Edit/Write diff rather than a shell
redirect. Also fixed here: `cp SRC DEST` treated SRC as a write target, so
taking a BACKUP of a guarded file was blocked; only DEST is a write now. `mv`
keeps the old behaviour deliberately — it removes its source.

DEVSYS-04b: the override-self-grant check (below) had the SAME full-text-scan
bug DEVSYS-04 fixed for protected-path writes — `re.search(r"allow-protected",
cmd)` blocked any command whose TEXT named the override file (a commit
message, a doc append), not just an actual write to it. Fixed the same way:
resolve write TARGETS (now hoisted before both checks so they share one pass)
and match the override path against those only. `touch` was also missing from
WRITE_VERBS — needed since `touch .claude/tmp/allow-protected` is a real write
with no redirect operand for the old regex to (accidentally) catch.
"""
import datetime
import json
import os
import re
import subprocess
import sys

import guard_core

REPO = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
CONFIG = os.path.join(REPO, ".claude", "protected-paths.json")
OVERRIDE = os.path.join(REPO, ".claude", "tmp", "allow-protected")
SYSTEM_OVERRIDE = os.path.join(REPO, ".claude", "tmp", "allow-system")
PROD_CREDS_OVERRIDE = os.path.join(REPO, ".claude", "tmp", "allow-prod-creds")
GUARD_LOG = os.path.join(REPO, ".claude", "tmp", "guard-log")


def point_at(root: str) -> None:
    """Aim every root-relative path — config, both write doors, the prod-creds door and the
    ledger — at one repo root. RBLD-02 made this a function because it is now called twice:
    once for the session, then again for the root that owns the file being written."""
    global REPO, CONFIG, OVERRIDE, SYSTEM_OVERRIDE, PROD_CREDS_OVERRIDE, GUARD_LOG
    REPO = root
    CONFIG = os.path.join(root, ".claude", "protected-paths.json")
    OVERRIDE = os.path.join(root, ".claude", "tmp", "allow-protected")
    SYSTEM_OVERRIDE = os.path.join(root, ".claude", "tmp", "allow-system")
    PROD_CREDS_OVERRIDE = os.path.join(root, ".claude", "tmp", "allow-prod-creds")
    GUARD_LOG = os.path.join(root, ".claude", "tmp", "guard-log")


def log_denial(tool: str, rule: str, detail: str) -> None:
    try:
        os.makedirs(os.path.dirname(GUARD_LOG), exist_ok=True)
        ts = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
        with open(GUARD_LOG, "a") as f:
            f.write(f"{ts}\t{tool}\t{rule}\t{detail}\n")
    except OSError:
        pass  # the ledger is a counter, never a second gate


def deny(msg: str, *, tool: str = "", rule: str = "", detail: str = "") -> None:
    log_denial(tool, rule, detail)
    print(msg, file=sys.stderr)
    sys.exit(2)


def rel(path: str) -> str:
    path = os.path.normpath(os.path.join(REPO, path) if not os.path.isabs(path) else path)
    try:
        return os.path.relpath(path, REPO)
    except ValueError:
        return path


def is_protected(fp: str, prefixes) -> bool:
    for p in prefixes:
        if fp.startswith(p) or fp == p.rstrip("/"):
            return True
    return False


def consume_override(path: str = "") -> bool:
    """Consume one approval from `path` (default: the PRODUCT door). DEVSYS-09 made
    the path a parameter so the SYSTEM door is a genuinely separate file — arming one
    must never open the other, and there are isolation cases both ways."""
    path = path or OVERRIDE
    if os.path.exists(path):
        try:
            with open(path) as f:
                n = int(f.read().strip() or "1")
        except (ValueError, OSError):
            n = 1
        if n > 1:
            with open(path, "w") as f:
                f.write(str(n - 1))
        else:
            os.remove(path)
        return True
    return False


def changed_paths(args: list[str]) -> list[tuple[str, list[str]]]:
    """Name-status entries for the staged tree or a CI base."""
    proc = subprocess.run(
        ["git", "diff", "--name-status", *args], cwd=REPO,
        capture_output=True, text=True, check=True,
    )
    entries = []
    for line in proc.stdout.splitlines():
        fields = line.split("\t")
        if len(fields) >= 2:
            entries.append((fields[0], fields[1:]))
    return entries


def check_repo_outcomes(entries: list[tuple[str, list[str]]]) -> None:
    """Decidable outer wall: no deletion and applied migrations immutable."""
    try:
        with open(CONFIG) as f:
            cfg = json.load(f)
    except Exception:
        deny(f"protect.py: cannot read {CONFIG} — refusing.", rule="config-unreadable")
    no_delete = cfg.get("no_delete", [])
    immutable = cfg.get("edit_existing_only", [])
    for status, paths in entries:
        old = paths[0]
        if status[0] in {"D", "R"} and is_protected(old, no_delete):
            deny(f"BLOCKED: staged deletion/rename under no_delete: {old}",
                 tool="git", rule="no-delete", detail=old)
        if status[0] != "A" and is_protected(old, immutable):
            deny(f"BLOCKED: applied migration is immutable: {old}",
                 tool="git", rule="edit-existing-only", detail=old)


def guard_file(raw_fp: str, cwd_root: str, tool: str) -> None:
    """Apply the same path rules to Claude file tools and Codex apply_patch."""
    abs_fp = os.path.realpath(os.path.normpath(
        raw_fp if os.path.isabs(raw_fp) else os.path.join(cwd_root, raw_fp))
    )
    point_at(guard_core.resolve_root(os.path.dirname(abs_fp), cwd_root))
    try:
        with open(CONFIG) as f:
            cfg = json.load(f)
    except Exception:
        deny(
            f"protect.py: cannot read {CONFIG} — refusing all guarded writes until fixed.",
            tool=tool,
            rule="config-unreadable",
            detail=CONFIG,
        )
    fp = rel(abs_fp)
    approval_files = {rel(OVERRIDE), rel(SYSTEM_OVERRIDE), rel(PROD_CREDS_OVERRIDE)}
    if fp in approval_files:
        deny("BLOCKED: an approval flag is created by Joyal in his own terminal, never by the agent.",
             tool=tool, rule="override-self-grant", detail=fp)
    if is_protected(fp, cfg.get("system", [])):
        if consume_override(SYSTEM_OVERRIDE):
            log_denial(tool, "system-path-approved", fp)
            return
        deny(f"BLOCKED: '{fp}' is SYSTEM-protected. Joyal must arm "
             ".claude/tmp/allow-system in the worktree that owns the file.",
             tool=tool, rule="system-path", detail=fp)
    for prefix in cfg.get("edit_existing_only", []):
        if fp.startswith(prefix) and os.path.exists(os.path.join(REPO, fp)):
            deny(f"BLOCKED: '{fp}' is an applied migration; author a new migration.",
                 tool=tool, rule="edit-existing-only", detail=fp)
    if is_protected(fp, cfg.get("product", [])):
        if consume_override():
            return
        deny(f"BLOCKED: '{fp}' is a protected product path. Joyal must arm "
             ".claude/tmp/allow-protected in the worktree that owns the file.",
             tool=tool, rule="product-path", detail=fp)


def main() -> None:
    if "--staged" in sys.argv:
        point_at(guard_core.resolve_root(os.getcwd(), REPO))
        check_repo_outcomes(changed_paths(["--cached"]))
        return
    if "--diff-base" in sys.argv:
        idx = sys.argv.index("--diff-base")
        if idx + 1 >= len(sys.argv):
            deny("protect.py: --diff-base requires a revision", rule="bad-args")
        point_at(guard_core.resolve_root(os.getcwd(), REPO))
        check_repo_outcomes(changed_paths([sys.argv[idx + 1], "HEAD"]))
        return

    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except Exception:
        deny(
            "protect.py: malformed hook payload — refusing all guarded actions until fixed.",
            tool="unknown",
            rule="malformed-payload",
            detail=raw[:200],
        )

    # Worktree-aware repo root: walk up from the session cwd to the nearest dir
    # that carries the protected-paths config; env REPO stays the fallback.
    tool, tin, cwd = guard_core.normalize_payload(payload)
    cwd_root = guard_core.resolve_root(cwd, REPO)
    point_at(cwd_root)

    try:
        with open(CONFIG) as f:
            cfg = json.load(f)
    except Exception:
        deny(
            f"protect.py: cannot read {CONFIG} — refusing all guarded writes until fixed.",
            tool=tool,
            rule="config-unreadable",
            detail=CONFIG,
        )

    system_paths = cfg.get("system", [])
    product_paths = cfg.get("product", [])
    edit_existing_only = cfg.get("edit_existing_only", [])
    no_delete = cfg.get("no_delete", [])

    paths = guard_core.file_paths(tool, tin)
    if paths:
        for raw_fp in paths:
            guard_file(raw_fp, cwd_root, tool)
        return

    if tool == "Bash":
        cmd = tin.get("command", "") or ""

        if re.search(r"--no-verify\b", cmd):
            deny(
                "BLOCKED: --no-verify bypasses lefthook (lint/gitleaks/tests). Never allowed.",
                tool=tool, rule="no-verify", detail=cmd,
            )
        if re.search(r"git\s+push\b.*(\s-f\b|--force\b)", cmd):
            deny(
                "BLOCKED: force push. Never allowed (use --force-with-lease only with Joyal's "
                "explicit in-chat approval, via his terminal).",
                tool=tool, rule="force-push", detail=cmd,
            )

        # Dangerous-VERB net (DEV-SYSTEM-V2.1, P3): destructive commands the
        # path-list can't anticipate. High-precision patterns only — the P1a
        # false-positive lesson. Agent-side only; Joyal's own terminal is the
        # escape hatch. Deliberately NOT blocked: git checkout --/git restore
        # (legit rollback flows, too false-positive-prone).
        DANGEROUS = [
            (r"git\s+reset\s+--hard\b", "git reset --hard discards uncommitted work"),
            (r"git\s+clean\s+(-[a-zA-Z]*f)", "git clean -f deletes untracked files"),
            (r"git\s+branch\s+(-D|--delete\s+--force)\b", "force-deleting a branch can drop unmerged work"),
            (r"curl[^|;&\n]*\|[^|;&\n]*\b(ba|z)?sh\b", "piping curl to a shell executes remote code"),
            (r"(\bcat\b|\bgrep\b|\bless\b|\bmore\b|\bhead\b|\btail\b|\bawk\b|\bcut\b)[^;&|\n]*\s\.env(?!\.example)\b", ".env holds secret VALUES — check names via src/config/env.ts or .env.example instead"),
        ]
        for pat, why in DANGEROUS:
            if re.search(pat, cmd):
                deny(
                    f"BLOCKED: {why}. If genuinely needed, Joyal runs it in his own terminal.",
                    tool=tool, rule="dangerous-verb", detail=cmd,
                )

        targets = guard_core.shell_write_targets(cmd)

        for raw_t in targets:
            # DEVSYS-09: BOTH doors, not just the product one. The system flag was
            # agent-creatable until this line — the case that caught it went from
            # exit 0 to exit 2. This is the whole security model: an agent that can
            # arm its own approval makes every guard above it decorative. RBLD-02
            # added the third door (allow-prod-creds) to the same check.
            if rel(raw_t) in (rel(OVERRIDE), rel(SYSTEM_OVERRIDE), rel(PROD_CREDS_OVERRIDE)):
                deny(
                    "BLOCKED: an approval flag is created by Joyal in his own terminal, "
                    "never by the agent.",
                    tool=tool, rule="override-self-grant", detail=raw_t,
                )

        for raw_t in targets:
            t = rel(raw_t)
            if is_protected(t, system_paths + product_paths):
                deny(
                    f"BLOCKED: shell write touching protected path '{t}'. Use Edit/Write "
                    "tools (guarded + reviewable), or Joyal approves via the override flow.",
                    tool=tool, rule="shell-write-target", detail=f"{t} <- {cmd}",
                )
            for p in no_delete:
                needle = p.rstrip("/")
                if needle and (t.startswith(needle) or t == needle):
                    deny(
                        f"BLOCKED: deleting/moving under '{needle}' is not allowed from the "
                        "agent. Tests and applied migrations are load-bearing; removing one "
                        "requires Joyal.",
                        tool=tool, rule="no-delete", detail=f"{t} <- {cmd}",
                    )
        sys.exit(0)

    sys.exit(0)


if __name__ == "__main__":
    main()
