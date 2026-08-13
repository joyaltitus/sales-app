#!/usr/bin/env bash
# DEVSYS-07: pipes hook payloads into lock_guard.py, asserts exit codes.
# Proves the four behaviours the serialization laws rest on: acquire, block a
# DIFFERENT session, stay re-entrant for the SAME session, and release.
# Modelled on scripts/protect-cases.sh (DEVSYS-04) incl. its PROTECT_HOOK-style
# env override, so a scratch copy can be proven before Joyal hand-applies.
set -uo pipefail

REPO="$(git rev-parse --show-toplevel)"
export REPO
HOOK="${LOCK_HOOK:-$REPO/.claude/hooks/lock_guard.py}"
export LOCK_HOME="$(mktemp -d)"   # never touch the real lock home from a test
# DEVSYS-11: payloads carry a SANDBOX cwd, never $REPO. The reap writes an audit line to
# <root>/.claude/tmp/guard-log, so using $REPO meant these cases wrote to — and an earlier
# draft DELETED — the real ledger, destroying a genuine `system-path-approved` record.
# A test may never write to, or clear, the live audit trail.
export SANDBOX="$(mktemp -d)"
export SANDBOX2="$(mktemp -d)"
for root in "$SANDBOX" "$SANDBOX2"; do
  mkdir -p "$root/.claude/tmp"
  cp "$REPO/.claude/protected-paths.json" "$root/.claude/protected-paths.json"
done
# RBLD-02: a holder root that EXISTS but cannot be stat'd. Its parent is chmod 000
# for the duration, so the cleanup must restore the bits BEFORE rm -rf can descend.
export EACCES_HOME="$(mktemp -d)"
trap 'chmod -R u+rwx "$EACCES_HOME" 2>/dev/null; rm -rf "$LOCK_HOME" "$SANDBOX" "$SANDBOX2" "$EACCES_HOME"' EXIT

# A missing hook must fail LOUDLY, not partially-green: `python3 <missing>` exits 2,
# which is the same code a real block uses, so the fail-closed case would pass
# vacuously. Observed while wiring DEVSYS-07 — check before running anything.
if [ ! -f "$HOOK" ]; then
  echo "lock-cases: FATAL — guard not found at $HOOK"
  echo "  (hand-apply pending? cp .claude/tmp/lock_guard-devsys07.py .claude/hooks/lock_guard.py)"
  exit 1
fi
pass=0
fail=0

# run_case_at <desc> <root> <tool> <command> <session> <want-exit> [stderr-substring]
run_case_at() {
  local desc="$1" root="$2" tool="$3" cmd="$4" session="$5" want="$6" needle="${7:-}" out code
  out="$(mktemp)"
  python3 -c 'import json,sys; print(json.dumps({"tool_name":sys.argv[1],"tool_input":{"command":sys.argv[2]},"cwd":sys.argv[3],"session_id":sys.argv[4]}))' \
    "$tool" "$cmd" "$root" "$session" | python3 "$HOOK" >"$out" 2>&1
  code=$?
  if [ "$code" = "$want" ] && { [ -z "$needle" ] || grep -q -- "$needle" "$out"; }; then
    echo "PASS ($code) $desc"
    pass=$((pass + 1))
  else
    echo "FAIL (got $code want $want${needle:+, wanted /$needle/}) $desc"
    sed 's/^/    /' "$out"
    fail=$((fail + 1))
  fi
  rm -f "$out"
}

run_case() {
  run_case_at "$1" "$SANDBOX" "$2" "$3" "$4" "$5" "${6:-}"
}

assert() {  # assert <desc> <command...>  — asserts a filesystem/state fact, not an exit code
  local desc="$1"; shift
  if "$@"; then echo "PASS (state) $desc"; pass=$((pass + 1));
  else echo "FAIL (state) $desc"; fail=$((fail + 1)); fi
}
empty_home() { [ -z "$(ls -A "$LOCK_HOME")" ]; }

# --- MUST ALLOW: read-only calls take no lock -----------------------------
run_case "read-only git status is not a locked resource" Bash "git status --short" s1 0
run_case "read-only file listing is not a locked resource" Bash "ls src" s1 0
run_case "protected command as commit-message TEXT (DEVSYS-04 lesson)" \
  Bash 'printf "%s" "git push origin HEAD:main"' s1 0
assert "no locks acquired by the allow cases" empty_home

# --- ACQUIRE --------------------------------------------------------------
run_case "first deploy-main push acquires" Bash "git push origin HEAD:main" s1 0
run_case "npm run test:integration acquires battery" Bash "npm run test:integration" s1 0
run_case "npm run shadow matches the same battery lock" Bash "npm run shadow" s1 0
run_case "apply_migration acquires migration" mcp__supabase__apply_migration "" s1 0
assert "specialized locks and one worktree-session lock exist on disk" bash -c \
  'compgen -G "$LOCK_HOME/session-*.lock" >/dev/null && test -d "$LOCK_HOME/migration.lock" -a -d "$LOCK_HOME/battery.lock" -a -d "$LOCK_HOME/deploy-main.lock"'

# --- RE-ENTRANT (same session) vs BLOCK (different session) ---------------
run_case "same session is re-entrant on deploy-main" Bash "git push origin main" s1 0
run_case "SECOND HARNESS is blocked in the same worktree" Bash "touch same-root.txt" s2 2 "LOCK session-"
run_case_at "independent worktree may build concurrently" "$SANDBOX2" \
  Bash "touch independent.txt" s2 0
assert "independent worktrees own two session locks" bash -c \
  'test "$(find "$LOCK_HOME" -maxdepth 1 -name "session-*.lock" | wc -l | tr -d " ")" = 2'
run_case_at "independent worktree still blocks on global deploy-main" "$SANDBOX2" \
  Bash "git push origin HEAD:main" s2 2 "LOCK deploy-main held by s1"
run_case_at "independent worktree still blocks on global battery" "$SANDBOX2" \
  Bash "npm run test:integration" s2 2 "LOCK battery held by s1"
run_case_at "independent worktree still blocks on global migration" "$SANDBOX2" \
  mcp__supabase__apply_migration "" s2 2 "LOCK migration held by s1"

# Cross-harness regression: a Claude-shaped file write and a Codex apply_patch
# must contend in the identical LOCK_HOME namespace.
rm -rf "$LOCK_HOME"/*
python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":"README.md"},"cwd":sys.argv[1],"session_id":"claude-side"}))' \
  "$SANDBOX" | python3 "$HOOK" >/dev/null 2>&1
assert "Claude-side invocation acquired the worktree-session lock" bash -c \
  'compgen -G "$LOCK_HOME/session-*.lock" >/dev/null'
out="$(mktemp)"
python3 -c 'import json,sys; print(json.dumps({"tool_name":"apply_patch","tool_input":{"command":"\n".join(["*** Begin Patch","*** Add File: probe.txt","+x","*** End Patch"])},"cwd":sys.argv[1],"session_id":"codex-side"}))' \
  "$SANDBOX" | python3 "$HOOK" >"$out" 2>&1
cross_code=$?
if [ "$cross_code" = 2 ] && grep -q "LOCK session-.* held by claude-side" "$out"; then
  echo "PASS (2) Claude-side holder blocks Codex-side acquire"; pass=$((pass + 1))
else
  echo "FAIL (got $cross_code) Claude-side holder did not block Codex"; sed 's/^/    /' "$out"; fail=$((fail + 1))
fi
rm -f "$out"
rm -rf "$LOCK_HOME"/*
run_case "restore deploy lock for stale cases" Bash "git push origin HEAD:main" s1 0
run_case "restore battery lock for stale cases" Bash "npm run test:integration" s1 0
run_case "restore migration lock for stale cases" mcp__supabase__apply_migration "" s1 0

# --- STALE: still blocks, message carries the removal command -------------
python3 - <<'PY'
import json, os, datetime
d = os.path.join(os.environ["LOCK_HOME"], "deploy-main.lock", "holder.json")
h = json.load(open(d))
h["session"] = "stale-specialized"
h["acquired_at"] = (datetime.datetime.now(datetime.timezone.utc)
                    - datetime.timedelta(hours=3)).isoformat(timespec="seconds")
json.dump(h, open(d, "w"))
PY
run_case "stale specialized lock still BLOCKS behind the re-entrant session lock" \
  Bash "git push origin HEAD:main" s1 2 "STALE LOCK deploy-main"

# --- MALFORMED PAYLOAD fails CLOSED --------------------------------------
echo 'not json' | python3 "$HOOK" >/dev/null 2>&1
malformed_code=$?
assert "malformed payload fails closed (exit 2, got $malformed_code)" test "$malformed_code" = 2

# --- DEVSYS-11: dead-holder reap -----------------------------------------
# A lock whose holder ROOT no longer exists on disk cannot be held by anyone: no
# session can be running inside a directory that isn't there. That is a liveness
# FACT, not a timeout guess, so reaping it does not weaken "never auto-break" —
# which still governs every lock whose holder directory DOES exist.
rm -rf "$LOCK_HOME"/*
mkdir -p "$LOCK_HOME/deploy-main.lock"
cat > "$LOCK_HOME/deploy-main.lock/holder.json" <<JSON
{"session":"dead-session","root":"$LOCK_HOME/no-such-worktree","acquired_at":"2026-07-30T22:15:42+00:00"}
JSON
run_case "lock held by a DEAD holder (root gone) is reaped, acquire proceeds" \
  Bash "git push origin HEAD:main" s9 0
assert "reaped lock is now held by the new session" bash -c \
  'grep -q dead-session "$LOCK_HOME/deploy-main.lock/holder.json" && exit 1 || exit 0'
assert "reap wrote an audit line naming the dead holder" bash -c \
  'grep -q "lock-reaped-dead-holder" "$SANDBOX/.claude/tmp/guard-log" 2>/dev/null'

# The mirror case: a holder whose root DOES exist is never reaped, however old.
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"
mkdir -p "$LOCK_HOME/battery.lock"
cat > "$LOCK_HOME/battery.lock/holder.json" <<JSON
{"session":"live-session","root":"$SANDBOX","acquired_at":"2020-01-01T00:00:00+00:00"}
JSON
run_case "LIVE holder is never reaped, even years stale" \
  Bash "npm run test:integration" s9 2 "STALE LOCK battery held by live-session"
assert "live holder still owns the lock after the blocked attempt" bash -c \
  'grep -q live-session "$LOCK_HOME/battery.lock/holder.json"'

# --- RBLD-02 (a): an UNREADABLE holder root is NOT a dead holder ----------
# os.path.isdir() swallows EACCES/ENOTCONN and returns the same False as a deleted
# directory, so a root that EXISTS but cannot be stat'd — permissions stripped, a
# volume unmounted, a Full-Disk-Access/iCloud refusal on this very repo — read as
# "gone" and a LIVE session's lock got reaped. scripts/queue.py definitely_gone()
# already draws the line correctly: ENOENT means dead, every other OSError means
# "cannot tell", and cannot-tell must resolve to ALIVE. The two errors are not
# symmetric — missing a crash costs a stale lock a human can see and remove;
# reaping a live holder silently hands its lock to a second writer.
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"
mkdir -p "$EACCES_HOME/parent/live-worktree"
chmod 000 "$EACCES_HOME/parent"
# The case is only meaningful if the root is genuinely unreadable. As root, or on a
# filesystem that ignores mode bits, os.stat would succeed, the holder would look
# alive for the WRONG reason, and the case would pass vacuously — so prove EACCES
# first and fail the harness loudly if it is not reproducible here.
if python3 -c 'import os, sys
try:
    os.stat(sys.argv[1])
except PermissionError:
    sys.exit(0)
except OSError:
    sys.exit(2)
sys.exit(1)' "$EACCES_HOME/parent/live-worktree"; then
  mkdir -p "$LOCK_HOME/battery.lock"
  cat > "$LOCK_HOME/battery.lock/holder.json" <<JSON
{"session":"live-but-unreadable","root":"$EACCES_HOME/parent/live-worktree","acquired_at":"$(date -u +%Y-%m-%dT%H:%M:%S+00:00)"}
JSON
  run_case "UNREADABLE holder root is NOT reaped — EACCES is not ENOENT" \
    Bash "npm run test:integration" s9 2 "LOCK battery held by live-but-unreadable"
  assert "unreadable-root holder still owns its lock after the blocked attempt" bash -c \
    'grep -q live-but-unreadable "$LOCK_HOME/battery.lock/holder.json"'
  assert "no reap was logged against the unreadable root" bash -c \
    '! grep -q "lock-reaped-dead-holder" "$SANDBOX/.claude/tmp/guard-log" 2>/dev/null'
else
  echo "FAIL (harness) EACCES precondition not reproducible — $EACCES_HOME/parent stayed readable (running as root?)"
  fail=$((fail + 3))
fi
chmod 755 "$EACCES_HOME/parent"

# --- RBLD-02 (b): an unparseable holder.json still BLOCKS -----------------
# holder_of() returns {} for a truncated or corrupt file, and {} carries no root.
# "I cannot read who holds this" is the strongest possible reason to leave a lock
# alone, so an unknown holder must block, never be reaped.
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"
mkdir -p "$LOCK_HOME/migration.lock"
printf '{"session":"half-writ' > "$LOCK_HOME/migration.lock/holder.json"
run_case "truncated holder.json still BLOCKS — never reaped" \
  mcp__supabase__apply_migration "" s9 2 "LOCK migration held by"
assert "the corrupt lock survived the blocked attempt" test -d "$LOCK_HOME/migration.lock"
assert "no reap was logged against the corrupt holder" bash -c \
  '! grep -q "lock-reaped-dead-holder" "$SANDBOX/.claude/tmp/guard-log" 2>/dev/null'

# RBLD-02 (c) — a genuinely absent root (ENOENT) IS reaped: that is the
# "lock held by a DEAD holder (root gone)" case above, unchanged by this session.

# --list must never reap — reaping happens only when a session is actually blocked.
rm -rf "$LOCK_HOME"/*
mkdir -p "$LOCK_HOME/migration.lock"
cat > "$LOCK_HOME/migration.lock/holder.json" <<JSON
{"session":"dead-2","root":"$LOCK_HOME/gone","acquired_at":"2026-07-30T22:15:42+00:00"}
JSON
python3 "$HOOK" --list >/dev/null 2>&1
assert "--list is read-only: a dead lock survives an inspection" bash -c \
  '[ -d "$LOCK_HOME/migration.lock" ]'
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"

# --- RBLD-02 (3): a committed lock ALWAYS carries a parseable holder ------
# Acquire stages holder.json inside a temp directory and commits the whole thing with
# one atomic rename, so the old mkdir-then-write window — lock present on disk, holder
# not yet written, concurrent reader unable to say who holds it — cannot occur.
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"
run_case "acquire, for the atomicity assertions below" Bash "git push origin HEAD:main" s7 0
assert "every lock dir on disk carries a parseable holder.json" python3 -c '
import glob, json, os, sys
for d in glob.glob(os.path.join(os.environ["LOCK_HOME"], "*.lock")):
    p = os.path.join(d, "holder.json")
    if not os.path.exists(p):
        print("no holder.json in " + d)
        sys.exit(1)
    json.load(open(p))
'
assert "a successful acquire leaves no staging directory behind" bash -c \
  '[ -z "$(ls -A "$LOCK_HOME" | grep -v "\.lock$")" ]'
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"

# CURSOR-ADAPTER-01 — Claude-shaped holder blocks a Cursor-shaped acquire.
python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":"README.md"},"cwd":sys.argv[1],"session_id":"claude-side"}))' \
  "$SANDBOX" | python3 "$HOOK" >/dev/null 2>&1
assert "Claude-side Write acquired session lock before Cursor probe" bash -c \
  'compgen -G "$LOCK_HOME/session-*.lock" >/dev/null'
out="$(mktemp)"
python3 -c 'import json,sys; print(json.dumps({"tool_name":"Shell","tool_input":{"command":"touch cursor-probe.txt"},"cwd":sys.argv[1],"conversation_id":"cursor-side","generation_id":"gen-1"}))' \
  "$SANDBOX" | python3 "$HOOK" >"$out" 2>&1
cursor_cross=$?
if [ "$cursor_cross" = 2 ] && grep -q "LOCK session-.* held by claude-side" "$out"; then
  echo "PASS (2) Claude-side holder blocks Cursor-side acquire"; pass=$((pass + 1))
else
  echo "FAIL (got $cursor_cross) Claude-side holder did not block Cursor"; sed 's/^/    /' "$out"; fail=$((fail + 1))
fi
rm -f "$out"
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"

# --- DEVSYS-12 (#143): the printed recovery command must actually RUN ------
# The exact shape from #143: a stale lock whose holder root is the blocked session's OWN
# repo root — not a worktree — so the dead-holder reap can never fire (that root always
# exists) and the block message is the only exit. That message used to print
# `rm -rf '<lock>'`, which guard_core.starts_build() matches as a shell write, so the
# removal needed the very session lock it was releasing: BLOCKED by this same guard, no
# in-harness recovery at all. Assert the printed command is not itself a locked call,
# and that running it clears the lock.
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"
mkdir -p "$LOCK_HOME/migration.lock"
cat > "$LOCK_HOME/migration.lock/holder.json" <<JSON
{"session":"orphan-in-main-repo","root":"$SANDBOX","acquired_at":"$(python3 -c 'import datetime;print((datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(hours=3)).isoformat(timespec="seconds"))')"}
JSON
out="$(mktemp)"
python3 -c 'import json,sys; print(json.dumps({"tool_name":"mcp__supabase__apply_migration","tool_input":{},"cwd":sys.argv[1],"session_id":"s143"}))' \
  "$SANDBOX" | python3 "$HOOK" >"$out" 2>&1
d12_code=$?
assert "repo-rooted stale lock still BLOCKS (exit 2, got $d12_code)" test "$d12_code" = 2
assert "repo-rooted stale lock is never auto-broken" test -d "$LOCK_HOME/migration.lock"
recover="$(grep -o "python3 .*--release-stale .*" "$out" | tail -1)"
assert "the stale block message prints a --release-stale command" test -n "$recover"
# The whole of #143: is the printed command itself a locked call?
python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]},"cwd":sys.argv[2],"session_id":"s143b"}))' \
  "$recover" "$SANDBOX" | python3 "$HOOK" >"$out" 2>&1
recover_guard=$?
assert "printed recovery command is NOT blocked by the guard (exit 0, got $recover_guard)" \
  test "$recover_guard" = 0
# In the SANDBOX, never $REPO: --release-stale writes its audit line to the ledger of
# the root it is run from, and a test may never write to the live audit trail.
(cd "$SANDBOX" && eval "$recover") >"$out" 2>&1
recover_code=$?
assert "running the printed command exits 0 (got $recover_code)" test "$recover_code" = 0
assert "the stale lock is gone after the printed recovery" bash -c \
  '[ ! -d "$LOCK_HOME/migration.lock" ]'
assert "the stale release wrote an audit line" bash -c \
  'grep -q "lock-released-stale" "$SANDBOX/.claude/tmp/guard-log" 2>/dev/null'
rm -f "$out"

# ...and the mirror: --release-stale is NOT an auto-break in disguise. A lock inside the
# stale window is refused, so it can never shove a live session off a lock it just took.
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"
run_case "acquire a FRESH lock for the refusal case" mcp__supabase__apply_migration "" s1 0
python3 "$HOOK" --release-stale migration >/dev/null 2>&1
fresh_code=$?
assert "--release-stale REFUSES a fresh lock (exit 2, got $fresh_code)" test "$fresh_code" = 2
assert "the fresh lock survived the refused release" test -d "$LOCK_HOME/migration.lock"
python3 "$HOOK" --release-stale no-such-lock >/dev/null 2>&1
unknown_code=$?
assert "--release-stale on an unknown name fails loudly (exit 2, got $unknown_code)" \
  test "$unknown_code" = 2
rm -rf "$LOCK_HOME"/* "$SANDBOX/.claude/tmp/guard-log"

# --- RELEASE --------------------------------------------------------------
python3 "$HOOK" --release >/dev/null 2>&1
assert "release dropped every lock held by this root" empty_home
run_case "lock is re-acquirable after release" Bash "git push origin HEAD:main" s2 0

echo "lock-cases: $pass passed, $fail failed"
[ "$fail" = 0 ]
