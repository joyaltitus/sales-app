#!/usr/bin/env bash
# Pi worker-seat conformance cases (S3 AT-10/AT-11, WIDENED by S12).
#
# Pi is the DEFAULT worker seat: it may launch and watch approved non-protected
# work, read, run shell, and WRITE inside its own linked worktree. It may not
# plan the big things, merge, deploy, touch money paths, or route protected
# paths. Every one of those refusals is a machine case here rather than a
# sentence in a document — an instruction is probabilistic, a gate is
# deterministic.
#
# Every case supplies its OWN denylist and extension fixtures. The real files
# live outside the repo (~/.agents, ~/.pi) and a CI runner has neither, so a
# suite that read them would pass on a laptop and refuse on every case in CI —
# which is how a guard suite quietly becomes a laptop suite.
set -uo pipefail

REPO="$(git rev-parse --show-toplevel)"
LAUNCH="${PI_DISPATCH:-$REPO/scripts/pi-dispatch.sh}"
SBX="$(mktemp -d)"
trap 'rm -rf "$SBX"' EXIT

# The main checkout, derived from git rather than assumed: this suite usually runs
# FROM a worktree, so $REPO is not it.
MAIN_CHECKOUT="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"

printf 'rm[[:space:]]+-rf[[:space:]]+/\n' > "$SBX/patterns.txt"
printf '// stand-in for the pi command-guard extension\n' > "$SBX/ext.ts"

# A stub pi proves the real exec shape rather than a printed intention: a green
# string in a dry run is not evidence that the child process was actually
# stripped of its credentials — or that it kept the ones it is meant to have.
# It is also the suite's safety net: it is in FIXTURES so that a case whose gate
# REGRESSES fails on a wrong exit code instead of silently launching a real
# model and hanging the suite.
cat > "$SBX/pi-stub.sh" <<'STUB'
#!/usr/bin/env bash
echo "ARGV: $*"
echo "CWD: $(pwd -P)"
echo "PI_WRITE_ROOT=${PI_WRITE_ROOT:-<unset>}"
echo "GH_TOKEN=${GH_TOKEN:-<unset>}"
echo "ZEABUR_TOKEN=${ZEABUR_TOKEN:-<unset>}"
echo "SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN:-<unset>}"
echo "NPM_TOKEN=${NPM_TOKEN:-<unset>}"
echo "SUPABASE_URL=${SUPABASE_URL:-<unset>}"
echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-<unset>}"
STUB
chmod +x "$SBX/pi-stub.sh"

FIXTURES=(--patterns-file "$SBX/patterns.txt" --extension "$SBX/ext.ts"
          --pi-bin "$SBX/pi-stub.sh")

pass=0
fail=0

# Fixtures are prepended so a case can override any of them by passing the same
# flag again — the launcher's parser is last-wins.
run() { # description, expected-code, expected-needle, args...
  local desc="$1" want="$2" needle="$3"; shift 3
  local out code
  out="$(mktemp)"
  PI_DISPATCH_TEST=1 bash "$LAUNCH" "${FIXTURES[@]}" "$@" >"$out" 2>&1
  code=$?
  if [ "$code" = "$want" ] && { [ -z "$needle" ] || grep -q -- "$needle" "$out"; }; then
    echo "PASS ($code) $desc"; pass=$((pass + 1))
  else
    echo "FAIL (got $code want $want) $desc"; sed 's/^/    /' "$out"; fail=$((fail + 1))
  fi
  rm -f "$out"
}

# ---------------------------------------------------------------- fail closed
# A dispatch launch must refuse when any part of the machine guard chain is
# missing, EVEN THOUGH pi's interactive extension deliberately fails open. The
# seatbelt may be optional for a human at the wheel; an orchestration launch is
# not a human at the wheel.
run "missing denylist refuses" 2 "missing-patterns" \
  --task "watch the worker" --patterns-file "$SBX/absent.txt"
printf '# only a comment\n\n' > "$SBX/empty-patterns.txt"
run "denylist with no live patterns refuses" 2 "missing-patterns" \
  --task "watch the worker" --patterns-file "$SBX/empty-patterns.txt"
run "missing command-guard extension refuses" 2 "missing-extension" \
  --task "watch the worker" --extension "$SBX/absent.ts"
run "missing protected-paths config refuses" 2 "missing-guard-config" \
  --task "watch the worker" --paths-config "$SBX/absent.json"
printf 'not json\n' > "$SBX/broken.json"
run "unparseable protected-paths config refuses" 2 "missing-guard-config" \
  --task "watch the worker" --paths-config "$SBX/broken.json"
run "missing protect.py door refuses" 2 "missing-protect-hook" \
  --task "watch the worker" --protect-hook "$SBX/absent.py"
run "missing pi binary refuses" 2 "missing-pi" \
  --task "watch the worker" --pi-bin "$SBX/absent-pi" -- --model deepseek-v4-flash

# ------------------------------------------------------------------ no target
run "empty task refuses" 2 "no-task" --task ""
run "absent task refuses" 2 "no-task"

# ------------------------------------------------------ writes live in a worktree
# The write seat is bound to a LINKED worktree, checked as a git property rather
# than a path spelling — a directory called wt/ is not a worktree, and a worktree
# is one whether or not it is named that way.
mkdir -p "$SBX/not-a-worktree"
run "a non-existent worktree refuses" 2 "worktree-missing" \
  --task "apply the typo fix" --worktree "$SBX/absent-dir" -- --model deepseek-v4-flash
run "a plain directory is not a worktree" 2 "worktree-missing" \
  --task "apply the typo fix" --worktree "$SBX/not-a-worktree" -- --model deepseek-v4-flash
run "the main checkout is refused as a write root" 2 "worktree-is-main" \
  --task "apply the typo fix" --worktree "$MAIN_CHECKOUT" -- --model deepseek-v4-flash

# --------------------------------------------------------------- cannot plan
run "planning verb refuses" 2 "planning-prompt" \
  --task "plan the rollout of the media budget"
run "design verb refuses" 2 "planning-prompt" \
  --task "Design the retry strategy for outbound"
run "decision verb refuses" 2 "planning-prompt" \
  --task "decide which queue library we should use"
run "architecture verb refuses" 2 "planning-prompt" \
  --task "review the ARCHITECTURE of the turn runner"

# TWO-TIER (S12): a DECLARED self-contained single-module scope may be designed
# by pi; the same sentence without the declaration may not, and no declaration
# buys architecture-scale work.
run "declared self-contained design is allowed" 0 "ARGV:" \
  --task "SCOPE: self-contained (src/notify) — design the retry backoff for the notifier" \
  --pi-bin "$SBX/pi-stub.sh" -- --model deepseek-v4-flash
run "the same design without a declared scope refuses" 2 "planning-prompt" \
  --task "design the retry backoff for the notifier"
run "a declared scope does not buy architecture design" 2 "planning-prompt" \
  --task "SCOPE: self-contained (src/notify) — design the ARCHITECTURE of the queue layer"

# ---------------------------------------------------------------- cannot bill
run "money path in the task refuses" 2 "money-path" \
  --task "add the credits counter to the billing summary"
run "money path via --paths refuses" 2 "money-path" \
  --task "apply the typo fix" --paths "src/payments/checkout.ts"

# ---------------------------------------------------------- cannot self-widen
run "caller-supplied --tools refuses" 2 "write-tool" \
  --task "watch the worker" -- --tools read,write
run "caller-supplied -t refuses" 2 "write-tool" \
  --task "watch the worker" -- -t edit
run "caller-supplied --exclude-tools refuses" 2 "write-tool" \
  --task "watch the worker" -- --exclude-tools bash
run "caller-supplied --no-extensions refuses" 2 "write-tool" \
  --task "watch the worker" -- --no-extensions

# -------------------------------------------- cannot hold merge/deploy rights
run "credential named in the task refuses" 2 "credential-routing" \
  --task "use GITHUB_TOKEN to land the branch"
run "credential named in extra args refuses" 2 "credential-routing" \
  --task "watch the worker" -- --append-system-prompt "ZEABUR_TOKEN is in the env"
run "merge action refuses" 2 "merge-deploy-action" \
  --task "gh pr merge 142 once the checks are green"
run "deploy action refuses" 2 "merge-deploy-action" \
  --task "run scripts/deploy-zeabur.sh after the build"
run "push action refuses" 2 "merge-deploy-action" \
  --task "git push the fix to main"

# ------------------------------------------------- cannot route protected work
# Driven from THIS repo's own protected-paths.json rather than hand-picked
# literals, so the suite ports between repos unchanged and cannot drift into
# asserting paths a repo does not actually protect. Every declared prefix is
# exercised — both named in the task and passed via --paths.
while IFS= read -r prefix; do
  [ -n "$prefix" ] || continue
  run "protected prefix '$prefix' in the task refuses" 2 "protected-path" \
    --task "apply the approved change to ${prefix}fixture"
  run "protected prefix '$prefix' via --paths refuses" 2 "protected-path" \
    --task "apply the typo fix" --paths "${prefix}fixture"
done < <(python3 - "$REPO/.claude/protected-paths.json" <<'PY'
import json, sys
cfg = json.load(open(sys.argv[1]))
out = []
for key in ("system", "product", "edit_existing_only", "no_delete"):
    out.extend(cfg.get(key, []))
print("\n".join(p for p in out if p))
PY
)

# ------------------------------------------------------------- allowed launch
MODEL_ARGS=(-- --model deepseek-v4-flash)

stub() { # description, expected-needle
  local desc="$1" needle="$2"
  local out code
  out="$(mktemp)"
  PI_DISPATCH_TEST=1 GH_TOKEN=planted ZEABUR_TOKEN=planted \
    SUPABASE_ACCESS_TOKEN=planted NPM_TOKEN=planted \
    SUPABASE_URL=https://planted.example SUPABASE_SERVICE_ROLE_KEY=planted-service-role \
    bash "$LAUNCH" "${FIXTURES[@]}" --task "read worker 3 and report its PR number" \
    --pi-bin "$SBX/pi-stub.sh" "${MODEL_ARGS[@]}" >"$out" 2>&1
  code=$?
  if [ "$code" = 0 ] && grep -q -- "$needle" "$out"; then
    echo "PASS ($code) $desc"; pass=$((pass + 1))
  else
    echo "FAIL (got $code want 0) $desc"; sed 's/^/    /' "$out"; fail=$((fail + 1))
  fi
  rm -f "$out"
}

stub "an approved worker task launches" "ARGV:"
stub "the launch pins the read+write tool allowlist" "--tools read,grep,find,ls,bash,edit,write"
stub "the child cannot merge: GH_TOKEN is stripped" "GH_TOKEN=<unset>"
stub "the child cannot deploy: ZEABUR_TOKEN is stripped" "ZEABUR_TOKEN=<unset>"
stub "the child holds no Supabase management token" "SUPABASE_ACCESS_TOKEN=<unset>"
stub "the child holds no npm publish token" "NPM_TOKEN=<unset>"
# S12 law-8 amendment: data-plane Supabase access is DELIVERED, not stripped. The
# assertions above and below are the credential matrix, stated as outcomes.
stub "the child DOES receive the Supabase URL" "SUPABASE_URL=https://planted.example"
stub "the child DOES receive the service-role key" "SUPABASE_SERVICE_ROLE_KEY=planted-service-role"

# ------------------------------------------------ the write seat runs in the worktree
# A real linked worktree, so the git property under test is the real one.
git -C "$REPO" worktree add -q --detach "$SBX/wt-case" HEAD 2>/dev/null
if [ -d "$SBX/wt-case" ]; then
  out="$(mktemp)"
  PI_DISPATCH_TEST=1 bash "$LAUNCH" "${FIXTURES[@]}" --task "apply the approved typo fix" \
    --worktree "$SBX/wt-case" --pi-bin "$SBX/pi-stub.sh" "${MODEL_ARGS[@]}" >"$out" 2>&1
  code=$?
  root="$(cd "$SBX/wt-case" && pwd -P)"
  if [ "$code" = 0 ] && grep -q "PI_WRITE_ROOT=$root" "$out" && grep -q "CWD: $root" "$out"; then
    echo "PASS (0) a linked worktree launches with the write bound armed and cwd inside it"
    pass=$((pass + 1))
  else
    echo "FAIL a linked worktree launches with the write bound armed and cwd inside it"
    sed 's/^/    /' "$out"; fail=$((fail + 1))
  fi
  rm -f "$out"
  git -C "$REPO" worktree remove --force "$SBX/wt-case" 2>/dev/null
else
  echo "FAIL could not create the fixture worktree"; fail=$((fail + 1))
fi

# The allowlist must carry edit/write and nothing wider — apply_patch is a
# different tool surface with different bounds and was never granted.
out="$(mktemp)"
PI_DISPATCH_TEST=1 bash "$LAUNCH" "${FIXTURES[@]}" --task "read worker 3" \
  --pi-bin "$SBX/pi-stub.sh" "${MODEL_ARGS[@]}" >"$out" 2>&1
if grep -q 'ARGV:' "$out" && ! grep -qE -- '--tools [^ ]*apply_patch' "$out"; then
  echo "PASS (0) no unlisted write surface reaches the allowlist"; pass=$((pass + 1))
else
  echo "FAIL no unlisted write surface reaches the allowlist"; sed 's/^/    /' "$out"; fail=$((fail + 1))
fi
rm -f "$out"

# ------------------------------------------------- exact model, no default
run "missing --model refuses" 2 "no-model" --task "read worker 3"
out="$(mktemp)"
PI_DISPATCH_TEST=1 bash "$LAUNCH" "${FIXTURES[@]}" --task "read worker 3" \
  --pi-bin "$SBX/pi-stub.sh" -- -m deepseek-v4-flash >"$out" 2>&1
if [ $? = 0 ] && grep -q 'ARGV:' "$out"; then
  echo "PASS (0) short -m flag also satisfies the requirement"; pass=$((pass + 1))
else
  echo "FAIL short -m flag also satisfies the requirement"; sed 's/^/    /' "$out"; fail=$((fail + 1))
fi
rm -f "$out"

# --------------------------------------------- observed session/model identity
# The stub plays pi far enough to prove the launcher reads IDENTITY back from
# what the child actually recorded, not from what was requested — same
# discipline as verifying Codex/Claude's returned session id and served model.
cat > "$SBX/pi-stub-identity.sh" <<'STUB'
#!/usr/bin/env bash
sid=""
while [ $# -gt 0 ]; do
  case "$1" in --session-id) sid="$2"; shift 2 ;; *) shift ;; esac
done
mkdir -p "$PI_SESSION_DIR"
printf '{"type":"session","id":"%s"}\n{"type":"model_change","provider":"deepseek","modelId":"deepseek-v4-flash"}\n' \
  "$sid" > "$PI_SESSION_DIR/${sid}.jsonl"
echo "stub ran with session $sid"
STUB
chmod +x "$SBX/pi-stub-identity.sh"

out="$(mktemp)"
PI_DISPATCH_TEST=1 PI_DISPATCH_TEST_SESSION_ID="test-sess-1" \
  PI_SESSION_DIR="$SBX/sessions" \
  bash "$LAUNCH" "${FIXTURES[@]}" --task "read worker 3" \
  --pi-bin "$SBX/pi-stub-identity.sh" -- --model deepseek-v4-flash >"$out" 2>&1
if [ $? = 0 ] && grep -q 'PI-DISPATCH IDENTITY session_id=test-sess-1 model=deepseek/deepseek-v4-flash' "$out"; then
  echo "PASS (0) identity is read back from the child's own session record"; pass=$((pass + 1))
else
  echo "FAIL identity is read back from the child's own session record"; sed 's/^/    /' "$out"; fail=$((fail + 1))
fi
rm -f "$out"

out="$(mktemp)"
PI_DISPATCH_TEST=1 PI_DISPATCH_TEST_SESSION_ID="test-sess-2" \
  PI_SESSION_DIR="$SBX/no-such-dir" \
  bash "$LAUNCH" "${FIXTURES[@]}" --task "read worker 3" \
  --pi-bin "$SBX/pi-stub.sh" -- --model deepseek-v4-flash >"$out" 2>&1
if [ $? = 0 ] && grep -q 'PI-DISPATCH IDENTITY session_id=test-sess-2 model=UNVERIFIED' "$out"; then
  echo "PASS (0) a missing session record reports UNVERIFIED rather than inventing a model"; pass=$((pass + 1))
else
  echo "FAIL a missing session record reports UNVERIFIED rather than inventing a model"
  sed 's/^/    /' "$out"; fail=$((fail + 1))
fi
rm -f "$out"

# ------------------------------------------------------ the knobs are inert live
# Proved as a PAIR, because either half alone is weak: the first shows a config
# override genuinely can take effect, so the second's refusal is attributable to
# PI_DISPATCH_TEST being absent rather than to the flag never having worked.
printf '{"system":[],"product":[],"edit_existing_only":[],"no_delete":["tests/"]}\n' \
  > "$SBX/toothless.json"
out="$(mktemp)"
PI_DISPATCH_TEST=1 bash "$LAUNCH" "${FIXTURES[@]}" --task "touch src/router/gate.js" \
  --paths-config "$SBX/toothless.json" --pi-bin "$SBX/pi-stub.sh" \
  -- --model deepseek-v4-flash >"$out" 2>&1
code=$?
if [ "$code" = 0 ] && grep -q 'ARGV:' "$out"; then
  echo "PASS ($code) a config override takes effect under the test harness"; pass=$((pass + 1))
else
  echo "FAIL (got $code want 0) a config override takes effect under the test harness"
  sed 's/^/    /' "$out"; fail=$((fail + 1))
fi
rm -f "$out"

out="$(mktemp)"
bash "$LAUNCH" "${FIXTURES[@]}" --task "touch src/router/gate.js" \
  --paths-config "$SBX/toothless.json" --pi-bin "$SBX/pi-stub.sh" >"$out" 2>&1
code=$?
if [ "$code" = 2 ] && ! grep -q 'ARGV:' "$out"; then
  echo "PASS ($code) the same override is inert outside the test harness"; pass=$((pass + 1))
else
  echo "FAIL (got $code want 2) the same override is inert outside the test harness"
  sed 's/^/    /' "$out"; fail=$((fail + 1))
fi
rm -f "$out"

# ------------------------------------------------- the pi bash tool's own door
# The extension shells out to protect.py with this exact payload shape. Driving
# the same call here proves the door itself answers correctly; that the
# extension makes the call is asserted by .pi/adapter-conformance.sh, which also
# pins the installed copy byte-for-byte to the reviewed one, and by
# tests/system/pi-command-guard.test.ts, which drives the adapter directly.
door() { # description, command, expected code
  local desc="$1" cmd="$2" want="$3" out code
  out="$(mktemp)"
  python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]},"cwd":sys.argv[2]}))' \
    "$cmd" "$REPO" | python3 "$REPO/.claude/hooks/protect.py" >"$out" 2>&1
  code=$?
  if [ "$code" = "$want" ]; then
    echo "PASS ($code) $desc"; pass=$((pass + 1))
  else
    echo "FAIL (got $code want $want) $desc"; sed 's/^/    /' "$out"; fail=$((fail + 1))
  fi
  rm -f "$out"
}

# Same repo-agnostic derivation: the first declared product and system prefix,
# turned into a concrete file under it.
concrete() { # prefix -> a file path under it
  case "$1" in */) printf '%sfixture.txt' "$1" ;; *) printf '%s' "$1" ;; esac
}
PRODUCT_FILE="$(concrete "$(python3 -c 'import json,sys; print((json.load(open(sys.argv[1])).get("product") or [""])[0])' "$REPO/.claude/protected-paths.json")")"
SYSTEM_FILE="$(concrete "$(python3 -c 'import json,sys; print((json.load(open(sys.argv[1])).get("system") or [""])[0])' "$REPO/.claude/protected-paths.json")")"

door "pi bash cannot write a protected product path" "echo x >> $PRODUCT_FILE" 2
door "pi bash cannot write a protected system path" "echo x >> $SYSTEM_FILE" 2
door "pi bash cannot arm its own approval flag" "touch .claude/tmp/allow-protected" 2
door "pi bash still runs ordinary work" "npm run lint" 0

echo "pi-cases: $pass passed, $fail failed"
[ "$fail" = 0 ]
