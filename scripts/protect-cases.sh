#!/usr/bin/env bash
# Ported from hub-service (DEVSYS-04/09/RBLD-02) — protect.py itself is generic and
# copied verbatim; this suite is scoped to sales-app's OWN protected-paths.json,
# not a copy of hub-service's cases. Trimmed: no lefthook.yml here (no gitleaks
# case), no scripts/no-prod-profile.sh here (no prod-creds-door case), no Cursor
# config yet (no Cursor cases) — added back if/when those land in this repo.
set -uo pipefail

REPO="$(git rev-parse --show-toplevel)"
HOOK="${PROTECT_HOOK:-$REPO/.claude/hooks/protect.py}"
PATHS_CONFIG="${PROTECT_CONFIG:-$REPO/.claude/protected-paths.json}"
pass=0
fail=0

run_case() {
  local desc="$1" cmd="$2" want="$3" out
  out="$(mktemp)"
  local payload
  payload="$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]},"cwd":sys.argv[2]}))' "$cmd" "$SANDBOX")"
  echo "$payload" | python3 "$HOOK" >"$out" 2>&1
  local code=$?
  if [ "$code" = "$want" ]; then
    echo "PASS ($code) $desc"
    pass=$((pass + 1))
  else
    echo "FAIL (got $code want $want) $desc"
    sed 's/^/    /' "$out"
    fail=$((fail + 1))
  fi
  rm -f "$out"
}

# DEVSYS-11: every case runs against a SANDBOX repo, not $REPO, so test denials
# never pollute the real .claude/tmp/guard-log.
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
mkdir -p "$SANDBOX/.claude/tmp"
cp "$PATHS_CONFIG" "$SANDBOX/.claude/protected-paths.json"

# MUST BLOCK — real write target IS a protected path.
run_case "rm on protected supabase client" "rm src/lib/supabase.ts" 2
run_case "redirect into protected gateway-key.ts" "echo x > src/lib/gateway-key.ts" 2
run_case "sed -i on protected .env.production" "sed -i '' 's/a/b/' .env.production" 2

# MUST ALLOW — protected path text appears in the command, but NOT as the write target.
run_case "read-only wc on protected file" "wc -c .claude/hooks/protect.py" 0
run_case "commit message mentions supabase.ts" 'git commit -m "fix: a -> b in supabase.ts"' 0
run_case "redirect to /tmp; protected path only in argv" "grep gateway-key.ts src/lib -r > /tmp/o" 0

# override-self-grant: MUST BLOCK when the write TARGET is the override file.
run_case "touch on the override file" "touch .claude/tmp/allow-protected" 2
run_case "redirect into the override file" "echo 3 > .claude/tmp/allow-protected" 2

file_case() {
  local desc="$1" fp="$2" want="$3" out code payload
  out="$(mktemp)"
  payload="$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":sys.argv[1]},"cwd":sys.argv[2]}))' "$fp" "$SANDBOX")"
  echo "$payload" | python3 "$HOOK" >"$out" 2>&1
  code=$?
  if [ "$code" = "$want" ]; then
    echo "PASS ($code) $desc"; pass=$((pass + 1))
  else
    echo "FAIL (got $code want $want) $desc"; sed 's/^/    /' "$out"; fail=$((fail + 1))
  fi
  rm -f "$out"
}
patch_case() {
  local desc="$1" patch="$2" want="$3" out code payload
  out="$(mktemp)"
  payload="$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"apply_patch","tool_input":{"command":sys.argv[1]},"cwd":sys.argv[2],"session_id":"codex-probe"}))' "$patch" "$SANDBOX")"
  echo "$payload" | python3 "$HOOK" >"$out" 2>&1
  code=$?
  if [ "$code" = "$want" ]; then
    echo "PASS ($code) $desc"; pass=$((pass + 1))
  else
    echo "FAIL (got $code want $want) $desc"; sed 's/^/    /' "$out"; fail=$((fail + 1))
  fi
  rm -f "$out"
}
file_case_at() {
  local desc="$1" cwd="$2" fp="$3" want="$4" out code payload
  out="$(mktemp)"
  payload="$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":sys.argv[1]},"cwd":sys.argv[2]}))' "$fp" "$cwd")"
  echo "$payload" | python3 "$HOOK" >"$out" 2>&1
  code=$?
  if [ "$code" = "$want" ]; then
    echo "PASS ($code) $desc"; pass=$((pass + 1))
  else
    echo "FAIL (got $code want $want) $desc"; sed 's/^/    /' "$out"; fail=$((fail + 1))
  fi
  rm -f "$out"
}
sandbox_case() { run_case "$@"; }
arm() { printf '%s' "$1" > "$SANDBOX/.claude/tmp/$2"; }
disarm() { rm -f "$SANDBOX/.claude/tmp/allow-system" "$SANDBOX/.claude/tmp/allow-protected"; }
assert_state() {
  local desc="$1"; shift
  if "$@"; then echo "PASS (state) $desc"; pass=$((pass + 1))
  else echo "FAIL (state) $desc"; fail=$((fail + 1)); fi
}

# Baseline: no flag -> a system path is denied.
disarm
file_case "system path denied with no flag armed" ".claude/hooks/lock_guard.py" 2

# The door itself, and counter semantics.
arm 1 allow-system
file_case "system path ALLOWED once allow-system is armed" ".claude/hooks/lock_guard.py" 0
file_case "the flag was consumed — next system write denied again" ".claude/hooks/lock_guard.py" 2
arm 2 allow-system
file_case "counter: 1st of 2 approved system writes" ".claude/settings.json" 0
file_case "counter: 2nd of 2 approved system writes" ".claude/settings.json" 0
file_case "counter: 3rd write denied — budget spent" ".claude/settings.json" 2

# ISOLATION — the two doors must never open each other.
disarm; arm 1 allow-protected
file_case "allow-protected does NOT unlock a SYSTEM path" ".claude/hooks/protect.py" 2
disarm; arm 1 allow-system
file_case "allow-system does NOT unlock a PRODUCT path" "src/lib/supabase.ts" 2

# Bash stays walled even with the system door armed.
disarm; arm 1 allow-system
sandbox_case "Bash write to a system path still blocked while armed" "echo x > .claude/hooks/protect.py" 2

# Arming is human-only, forever.
disarm
sandbox_case "agent cannot create the system flag" "touch .claude/tmp/allow-system" 2
sandbox_case "agent cannot redirect into the system flag" "echo 5 > .claude/tmp/allow-system" 2

# cp/mv semantics.
run_case "cp FROM a protected path is a read, not a write" \
  "cp .claude/hooks/protect.py .claude/tmp/backup.py" 0
run_case "cp TO a protected path is still blocked" \
  "cp /tmp/x.py .claude/hooks/protect.py" 2
run_case "mv keeps blocking its SOURCE (mv removes it)" \
  "mv src/lib/supabase.ts /tmp/supabase.ts" 2

# ---------------------------------------------------------------------------
# Worktree-root resolution — the flag resolves from the repo root of the FILE
# BEING WRITTEN, not the session cwd. Same three-case shape as hub-service.
# ---------------------------------------------------------------------------
WT="$SANDBOX/.claude/worktrees/wt-a"
mkdir -p "$WT/.claude/tmp"
cp "$PATHS_CONFIG" "$WT/.claude/protected-paths.json"
both_disarmed() { rm -f "$SANDBOX/.claude/tmp/allow-system" "$WT/.claude/tmp/allow-system"; }

both_disarmed
file_case_at "no flag anywhere: system write in the worktree is BLOCKED" \
  "$WT" "$WT/.claude/hooks/lock_guard.py" 2

both_disarmed; printf '1' > "$WT/.claude/tmp/allow-system"
file_case_at "worktree flag PERMITS a system write in that same worktree" \
  "$WT" "$WT/.claude/hooks/lock_guard.py" 0
assert_state "the worktree's own flag was the one consumed" \
  test ! -e "$WT/.claude/tmp/allow-system"

both_disarmed; printf '1' > "$SANDBOX/.claude/tmp/allow-system"
file_case_at "main-checkout flag does NOT permit a system write in a worktree" \
  "$WT" "$WT/.claude/hooks/lock_guard.py" 2
assert_state "the main-checkout flag survived unconsumed" \
  test -e "$SANDBOX/.claude/tmp/allow-system"
both_disarmed

# Codex adapter: apply_patch shares the same core.
patch_case "Codex apply_patch to a system path is blocked" \
  $'*** Begin Patch\n*** Update File: .claude/hooks/protect.py\n@@\n-old\n+new\n*** End Patch' 2
patch_case "Codex cannot self-arm allow-system through apply_patch" \
  $'*** Begin Patch\n*** Add File: .claude/tmp/allow-system\n+1\n*** End Patch' 2
printf '1' > "$SANDBOX/.claude/tmp/allow-system"
patch_case "Codex apply_patch consumes the same human system door" \
  $'*** Begin Patch\n*** Update File: .claude/hooks/protect.py\n@@\n-old\n+new\n*** End Patch' 0
assert_state "Codex consumed the one-count system door" \
  test ! -e "$SANDBOX/.claude/tmp/allow-system"

echo "protect-cases: $pass passed, $fail failed"
[ "$fail" = 0 ]
