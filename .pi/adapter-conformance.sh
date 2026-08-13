#!/usr/bin/env bash
# Pi's thin binding to the shared harness guards (S3, AT-10/AT-11).
#
# Discovered by scripts/harness-conformance.sh alongside the Claude Code and
# Codex shims. An installed extension is not evidence that a seat is bounded —
# this file turns the Pi seat into the same kind of deterministic check the
# other two already carry.
set -euo pipefail

REPO="$(git rev-parse --show-toplevel)"
CANON="$REPO/.pi/command-guard/index.ts"
INSTALLED="$HOME/.pi/agent/extensions/command-guard/index.ts"

python3 - "$CANON" <<'PY'
import pathlib, re, sys

canon = pathlib.Path(sys.argv[1])
if not canon.is_file():
    raise SystemExit("Pi adapter missing: .pi/command-guard/index.ts")
text = canon.read_text()
# Quote style is the formatter's business, so the bash binding is matched as a
# pattern; the two file paths are matched literally because they are contracts
# shared with the Claude and Codex doors, not formatting.
for required, why in (
    (r"\.agents/hooks/dangerous-patterns\.txt", "shared denylist"),
    (r"\.claude/hooks/protect\.py", "protected-path door"),
    (r"""toolName\s*===\s*['"]bash['"]""", "bash tool binding"),
    # S12: the seat writes, so the write tools must reach the same door and the
    # worktree bound must exist. An adapter that guards only bash while pi holds
    # edit/write is an open seat wearing a closed seat's name.
    (r"""toolName\s*===\s*['"]edit['"]""", "edit tool binding"),
    (r"""toolName\s*===\s*['"]write['"]""", "write tool binding"),
    (r"PI_WRITE_ROOT", "worktree write bound"),
):
    if not re.search(required, text):
        raise SystemExit(f"Pi command-guard does not consume the {why}: {required}")
print("PASS adapter: pi (canonical extension)")
PY

# The extension pi actually loads lives outside version control. Comparing it to
# the reviewed copy is the only thing that makes the global file trustworthy;
# drift is a failure, not a note.
if [ -f "$INSTALLED" ]; then
  if ! cmp -s "$CANON" "$INSTALLED"; then
    echo "FATAL: installed pi extension has drifted from $CANON" >&2
    echo "  reinstall with: cp '$CANON' '$INSTALLED'" >&2
    exit 1
  fi
  echo "PASS adapter: pi (installed extension matches canonical)"
else
  # CI has no pi install. Say so out loud rather than letting a silent skip read
  # as a pass — the canonical checks above still ran.
  echo "SKIP adapter: pi extension not installed here ($INSTALLED)"
fi

# S12: the plugins the worker loop depends on must be PINNED, not "latest". An
# unpinned plugin is an unreviewed code path that changes under the seat between
# one campaign and the next. Absent = SKIP (CI has no pi install); present but
# floating = FAIL, because that is a claim of review that is not true.
SETTINGS="$HOME/.pi/agent/settings.json"
if [ -f "$SETTINGS" ]; then
  python3 - "$SETTINGS" <<'PY'
import json, sys

packages = json.load(open(sys.argv[1])).get("packages", [])
floating = [p for p in packages if p.startswith("npm:") and "@" not in p.removeprefix("npm:")]
if floating:
    raise SystemExit(
        "Pi packages are installed unpinned (reviewed once, silently updated after): "
        + ", ".join(floating)
    )
if not any(p.startswith("npm:pi-lens@") for p in packages):
    raise SystemExit("pi-lens is not installed at a pinned version (S12 quality gate)")
print("PASS adapter: pi (plugins pinned)")
PY
else
  echo "SKIP adapter: pi settings not present here ($SETTINGS)"
fi

# The sub-agent surface is only safe because a child inherits this adapter's
# bounds. Its absence is not a silent pass.
SUBAGENTS="$HOME/.pi/agent/extensions/subagents/index.ts"
if [ -f "$SUBAGENTS" ]; then
  echo "PASS adapter: pi (subagents extension present; bounds proven by tests/system/pi-command-guard.test.ts)"
else
  echo "SKIP adapter: pi subagents extension not installed here ($SUBAGENTS)"
fi

LAUNCH="$REPO/scripts/pi-dispatch.sh"
[ -x "$LAUNCH" ] || { echo "FATAL: $LAUNCH is missing or not executable" >&2; exit 1; }
bash "$REPO/scripts/pi-cases.sh"
echo "PASS adapter: pi (worker seat)"
