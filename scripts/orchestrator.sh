#!/usr/bin/env bash
# Multi-model orchestrator — routes a queued issue to the cheapest lane that can
# actually do it, runs the worker in an isolated worktree, and lets the repo's
# own gates referee the result.
#
# The point: Claude quota is the scarce resource. Every deterministic decision
# here (which lane, is there budget, did a worker touch a protected path) is a
# gate in this file, not an instruction in a prompt — CLAUDE.md's founding idea.
#
#   ./scripts/orchestrator.sh route  <issue>          -> prints a lane name
#   ./scripts/orchestrator.sh budget                  -> credits left today
#   ./scripts/orchestrator.sh run    <issue> [lane]   -> do the work
#   ./scripts/orchestrator.sh drain  <issue> [lane]   -> run, escalating on failure
#   ./scripts/orchestrator.sh lanes                   -> which lanes are usable
#   ./scripts/orchestrator.sh campaign <command> ...  -> approved campaign core
#
# `run <issue> draft` (or `draft:<lane>`) produces the change and stops before
# pushing — for standing-context cards Claude must decide on.
#
# Exit codes (the orchestrator reads these, never the diff):
#   0  green, PR open              10 gates failed
#   11 new code with no test       12 cross-model review says BLOCK (PR is open)
#   20 lane quota exhausted        30 protected-path breach
#   31 starts a queue/cron/worker  40 out of budget
#   50 worker error                60 claude-lane card
#   61 draft ready for review       62 gates ran, no diff — card may be done
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
STATE_DIR="$REPO_ROOT/.orchestrator"
mkdir -p "$STATE_DIR"

# Repo identity, resolved once. Never hardcode a literal owner/name here — this same
# script is copied verbatim into every dispatched repo (hub-service, sales-app, ...), and a
# hardcoded value silently mis-scopes a copy the moment it's pasted somewhere new. `gh repo
# view` is the same blessed derivation campaign-launch.sh's PR lookup uses.
REPO_NAME="$(cd "$REPO_ROOT" && gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || true)"
[ -n "$REPO_NAME" ] || REPO_NAME="$(basename "$REPO_ROOT")"

# Load DEEPSEEK_API_KEY from the gitignored .env.local unless already exported.
# Without this, `lanes` and `route` silently report the paid lanes DOWN in any
# shell that forgot to source it — and a lane that reads DOWN for the wrong
# reason routes work to Claude, which is the one outcome this script exists to
# prevent. Already-set env always wins, so CI and one-off overrides still work.
if [ -z "${DEEPSEEK_API_KEY:-}" ] && [ -f "$REPO_ROOT/.env.local" ]; then
  set -a; . "$REPO_ROOT/.env.local"; set +a
fi

# --- the protected wall ------------------------------------------------------
# PATH-SHAPED ONLY. These are matched against real changed filenames after a
# worker runs, and that is what makes them a gate. An earlier version also
# matched bare words like `rls`, `policy` and `migration` — in a repo whose
# entire history IS a migration, that fired on prose and routed 8 of 10 cards to
# Claude, which is the exact cost this whole scheme exists to avoid.
#
# Sources: CLAUDE.md hard laws 1/4/8/9/10/13/15, the tripwire in
# scripts/deepseek.sh, and the system-gate files protect.py already guards —
# a foreign model must never author or weaken its own exit.
# CLAUDE.md / STATE.md / LOG.md are in here on a different ground than the code
# paths: "agents never author process" (CLAUDE.md anti-regrowth). A foreign
# worker editing the standing context is that law's worst case, and the worker
# preamble already forbids it — this keeps the router from handing it a card it
# would have to refuse.
PROTECTED_RE='src/router/|src/outbound/meta-client|src/config/env\.ts|src/engine/turn\.ts|src/data/|db/migrations/|turn-lock|turn_lock|turn-runner|debounce|sent_idempotency|\.claude/hooks/|protect\.py|gate_loop|lefthook|\.github/workflows/|scripts/[a-z-]*-cases\.sh|CLAUDE\.md|STATE\.md|LOG\.md'

# Capabilities a sandboxed CLI genuinely does not have: MCP, live infra, DDL.
# Strong forms only — `supabase`, `deploy` and `migration` as bare words appear
# in ordinary prose on almost every card in this repo.
CLAUDE_ONLY_RE='supabase mcp|apply_migration|generate_typescript_types|CREATE (TABLE|POLICY|INDEX|FUNCTION)|ALTER (TABLE|ROLE)|DROP (TABLE|POLICY)|\bpm_[a-z_]+\b|RLS polic|service.role|ROTATE-AFTER-DEPLOY|rotate the'

# Cheap mechanical work — no design judgement, machine-checkable, small blast radius.
MECHANICAL_RE='stale|typo|rename|pointer|comment|docs?/|README|string|grep coverage|lint|dead code|unused'

# --- budget ------------------------------------------------------------------
# Credits, not dollars. A dollar meter needs token counts the CLIs do not always
# report, and a meter that can silently read zero is not a gate. One credit is
# ~$0.10 of a typical LIGHT session; DAILY_CREDITS 20 == the ~$2/day ceiling.
DAILY_CREDITS=${ORCHESTRATOR_DAILY_CREDITS:-20}
lane_cost() {
  case "$1" in
    gpt|claude) echo 0 ;;   # subscription lanes — no marginal dollars
    flash|muse) echo 1 ;;   # ~$0.06-0.08 per session
    pro)        echo 3 ;;   # ~$0.24 per session
    *)          echo 1 ;;
  esac
}

ledger_file() { echo "$STATE_DIR/spend-$(date +%F).jsonl"; }

credits_used() {
  local f; f="$(ledger_file)"
  [ -f "$f" ] || { echo 0; return; }
  awk -F'"credits":' '{split($2,a,"[,}]"); s+=a[1]} END {print s+0}' "$f"
}

credits_left() { echo $(( DAILY_CREDITS - $(credits_used) )); }

charge() {
  local lane="$1" issue="$2" cost; cost="$(lane_cost "$lane")"
  printf '{"ts":"%s","issue":"%s","lane":"%s","credits":%s}\n' \
    "$(date -u +%FT%TZ)" "$issue" "$lane" "$cost" >> "$(ledger_file)"
}

# --- codex binary resolution -------------------------------------------------
# cmux shims `codex` on PATH for every pane it manages and injects its own
# `-c hooks.PreToolUse=...` on every session-starting invocation (including
# `codex exec`). Codex's TOML config treats `-c` overrides as replacement, not
# merge, so this silently drops `.codex/hooks.json` — protect.py/lock_guard.py
# never run (#148). Walk PATH ourselves, skipping any cmux shim/bundle
# directory, so every dispatch here runs the real binary regardless of which
# shell launched this script. Fails closed: a dispatch must not silently run
# through a binary known to skip hooks.
codex_bin() {
  local dir
  local IFS=:
  for dir in $PATH; do
    case "$dir" in
      */cmux-cli-shims/*|/Applications/cmux.app/*) continue ;;
    esac
    [ -x "$dir/codex" ] && { printf '%s' "$dir/codex"; return 0; }
  done
  return 1
}

# --- lane availability -------------------------------------------------------
lane_available() {
  # Test seam. CI has no codex, no muse and no keys, so every lane reads DOWN
  # and cmd_route falls through to `claude` for everything — which made the
  # routing suite pass locally and fail on the runner while proving nothing
  # either time. The table is what CI must gate on, not what is installed.
  if [ -n "${ORCHESTRATOR_FAKE_LANES:-}" ]; then
    case " $ORCHESTRATOR_FAKE_LANES " in *" $1 "*) return 0 ;; *) return 1 ;; esac
  fi
  case "$1" in
    gpt)    codex_bin >/dev/null && [ -f "${CODEX_HOME:-$HOME/.codex}/auth.json" ] ;;
    flash)  codex_bin >/dev/null && [ -n "${DEEPSEEK_API_KEY:-}" ] ;;
    # 2026-08-06: DeepSeek rejects deepseek-v4-pro from codex with
    # "Codex integration with deepseek-v4-pro will be available starting early
    # August 2026. Please use deepseek-v4-flash instead" — so the lane answered
    # "up" and then burned a whole escalation rung on a guaranteed HTTP 400.
    # Opt back in with ORCHESTRATOR_PRO=1 once that message stops coming back.
    pro)    [ -n "${ORCHESTRATOR_PRO:-}" ] &&
            codex_bin >/dev/null && [ -n "${DEEPSEEK_API_KEY:-}" ] ;;
    # The Meta key lives in muse's own credential store (`muse auth set
    # --api-key-stdin`), not in .env.local — one copy, and it never passes
    # through argv or shell history. META_API_KEY overrides it if exported.
    muse)   command -v muse >/dev/null &&
            { [ -s "${MUSE_HOME:-$HOME/.config/muse}/auth.json" ] || [ -n "${META_API_KEY:-}" ]; } ;;
    claude) true ;;
    *) false ;;
  esac
}

cmd_lanes() {
  for l in gpt flash pro muse claude; do
    if lane_available "$l"; then echo "$l up"; else echo "$l DOWN"; fi
  done
  echo "credits: $(credits_left)/$DAILY_CREDITS"
}

# A lane is a routing decision; it is never an implicit model default. Keep the
# exact launch identifiers here so the recorded identity and child argv cannot
# drift independently.
lane_model() {
  case "$1" in
    gpt)   echo "gpt-5.6-luna" ;;
    flash) echo "deepseek-v4-flash" ;;
    pro)   echo "deepseek-v4-pro" ;;
    muse)  echo "muse-spark-1.2-contributor" ;;
    *)     echo "orchestrator: no exact model for lane '$1'" >&2; return 1 ;;
  esac
}

# --- routing -----------------------------------------------------------------
# Order matters: safety first, then cost.
#
# The router is a COST heuristic reading a card's text, and text lies. The hard
# safety gate is the post-run diff check in cmd_run, which reads the filenames a
# worker actually changed. So a mis-route costs one wasted cheap run (the worker
# fails, the orchestrator re-routes) — it cannot cost a protected-path edit.
# Keep the router permissive on that understanding; do not re-broaden it into a
# prose matcher to feel safer.
cmd_route() {
  local issue="$1"
  local card labels
  # The two _CARD/_LABELS overrides exist so orchestrator-cases.sh can prove the
  # routing table without a network round-trip to GitHub. Same seam shape as
  # PROTECT_HOOK in scripts/protect-cases.sh, and for the same reason.
  if [ -n "${ORCHESTRATOR_CARD:-}" ]; then
    card="$ORCHESTRATOR_CARD"; labels="${ORCHESTRATOR_LABELS:-}"
  else
    card="$(gh issue view "$issue" --json title,body,labels \
            --jq '.title + "\n" + .body' 2>/dev/null || echo "")"
    labels="$(gh issue view "$issue" --json labels --jq '[.labels[].name] | join(",")' 2>/dev/null || echo "")"
  fi
  [ -n "$card" ] || { echo "claude"; return; }   # cannot read it => do not gamble

  # 1. Safety. A foreign model never touches a protected path or a live system.
  if printf '%s' "$card" | grep -qiE "$PROTECTED_RE"; then echo "claude"; return; fi
  if printf '%s' "$card" | grep -qiE "$CLAUDE_ONLY_RE"; then echo "claude"; return; fi
  case ",$labels," in *,tier:heavy,*) echo "claude"; return ;; esac

  # 2. Cost. Cheap mechanical work goes to the cheap lane so the ChatGPT
  #    subscription is spent on work that actually needs the better model.
  local want="gpt"
  case ",$labels," in *,tier:quick,*) want="flash" ;; esac
  if printf '%s' "$card" | grep -qiE "$MECHANICAL_RE"; then want="flash"; fi

  # 3. Reality. Prefer the wanted lane, else the first usable fallback.
  local order
  case "$want" in
    flash) order="flash muse gpt pro claude" ;;
    *)     order="gpt flash muse pro claude" ;;
  esac
  for l in $order; do
    lane_available "$l" || continue
    [ "$(lane_cost "$l")" -le "$(credits_left)" ] || continue
    echo "$l"; return
  done
  echo "claude"
}

# --- worker prompt -----------------------------------------------------------
# The card's frozen session prompt lives in its issue comments. It is already a
# model-agnostic spec, so it goes in verbatim; this only adds the house rules a
# non-Claude worker has no way to know.
build_prompt() {
  local issue="$1" branch="$2"
  cat <<PREAMBLE
You are working in a git worktree of the $REPO_NAME repo, on branch $branch.
Complete GitHub issue #$issue exactly as specified below. Nothing beyond it.

HOUSE RULES (non-negotiable):
- NEVER edit: src/router/*, src/outbound/meta-client.ts, src/config/env.ts,
  src/data/*, db/migrations/*, or any turn-lock / debounce / idempotency code.
  If the task appears to need one of these, STOP and say
  "ESCALATE: needs protected path <path>" instead of editing it.
- Do not add dependencies. Do not create files that were not asked for.
- Do not touch CLAUDE.md, STATE.md, or LOG.md.
- Secrets come from env only. Never write a literal key. Never print one.
- Before you finish you MUST run, and they MUST pass:
      npm run gate:quick
      npm test
  Fix your own failures. If still red after 2 attempts, STOP and report
  "GATES RED" with the failing output. Do not weaken or skip a test to go green.
- If you add a new module, or a branch with real logic, you MUST add a test that
  FAILS without your change. A green suite you did not extend is evidence about
  the code that already existed, not about the code you just wrote.
- If your change adds a new producer, worker, cron or queue, say so explicitly in
  your final message under the heading "ACTIVATION:", naming the flag or gate
  that decides whether it runs in production. Do not assume inheriting an
  already-active flag is acceptable — that decision is Joyal's, not yours.
- Do NOT commit. Leave your work in the working tree — the orchestrator commits
  it for you, after re-running the gates itself. Your sandbox cannot write the
  worktree's git index anyway.

--- ISSUE #$issue -------------------------------------------------------------
PREAMBLE
  # `gh issue view --comments` prints ONLY the comments, NOT the body. The first
  # real run of this hit exactly that: #104's worker got a lone housekeeping
  # comment ("renamed WIRE-B3 -> WIRE-B4"), implemented precisely that one-line
  # label change, and reported success. The model was correct; the brief was not.
  # Title + body + every comment, or the worker is solving the wrong problem.
  gh issue view "$issue" --json title,body,comments --jq '
      "TITLE: " + .title + "\n\n" + .body +
      (if (.comments | length) > 0
       then "\n\n--- COMMENTS (the frozen session prompt usually lives here) ---\n"
            + ([.comments[] | "\n[" + .author.login + "]\n" + .body] | join("\n"))
       else "" end)' 2>/dev/null || echo "(could not read issue #$issue)"
}

# --- gates on the produced diff ----------------------------------------------
# Both of these started life as sentences in the worker preamble after #93
# shipped 194 untested lines and a live 5-minute cron. A sentence is obeyed at
# some rate below 1.0. These are obeyed at exactly 1.0 or they are broken.

# New or changed production code with no test change. A green suite the worker
# did not extend is evidence about the code that already existed.
# Pure over (file list, diff text) so orchestrator-cases.sh can prove them
# without building a git fixture. Everything git-shaped stays in cmd_run.
gate_tests_accompany_code() {
  local touched="$1" diff="$2"
  # .tsx/.jsx included (sales-app#24) — the original hub-service pattern only matched bare
  # .ts/.js, so a diff touching only .tsx production files (most of this React repo) never
  # tripped this check at all, test or no test.
  printf '%s' "$touched" | grep -qE '(^|\n)src/.*\.(ts|tsx|js|jsx)$' || return 0
  # Recognizes BOTH hub-service's top-level tests?/ convention AND sales-app's co-located
  # *.test.tsx/*.spec.ts files (sales-app#24) — the original only matched the former, so a
  # correctly-tested sales-app PR (tests sitting next to the source file) still read as
  # "NO TEST FOR NEW CODE".
  printf '%s' "$touched" | grep -qE '(^|\n)tests?/|\.(test|spec)\.[jt]sx?$' && return 0
  # Judge by the diff, not the filename: a comment-only edit inside src/ is not
  # new logic, and #50 was exactly that — one comment line, correctly no test.
  local added comments
  added="$(printf '%s\n' "$diff" | grep -cE '^\+[^+]' || true)"
  comments="$(printf '%s\n' "$diff" | grep -cE '^\+[[:space:]]*(//|\*|/\*)' || true)"
  [ "$((added - comments))" -le 0 ]
}

# A new producer, worker, cron or queue reaching production is a decision, not a
# side effect. #93 would have started a 5-minute cron against real data by
# inheriting an already-active flag, and no gate would have seen it.
gate_no_silent_producer() {
  printf '%s\n' "$1" |
    grep -qE '^\+.*(QUEUE_DEFS|cron:|boss\.schedule|boss\.work|setInterval|mode: .live.)' && return 1
  return 0
}

# sales-app#24: `npm run gate:quick` doesn't exist here (only dev/build/preview/test/
# test:watch/check:no-service-role/check:tokens do, per package.json — this repo has no
# lint/typecheck story yet, Phase 1 finding). Asserting a script that isn't there hard-fails
# every run before a worker's actual diff is even judged. Read package.json's real scripts:
# use gate:quick if some future session adds it, else run every check:*/lint/typecheck
# script that actually exists (mirrors what .github/workflows/ci.yml itself runs), then
# always npm test — never assert a name, only what's really defined.
run_gates() {
  local wt="$1"
  local scripts
  scripts="$(python3 -c "
import json
print('\n'.join(json.load(open('$wt/package.json')).get('scripts', {}).keys()))
" 2>/dev/null)"
  if printf '%s\n' "$scripts" | grep -qx 'gate:quick'; then
    ( cd "$wt" && npm run gate:quick && npm test )
    return
  fi
  (
    cd "$wt"
    while IFS= read -r s; do
      [ -n "$s" ] || continue
      npm run "$s" || exit 1
    done < <(printf '%s\n' "$scripts" | grep -E '^(check:|lint$|typecheck)')
    npm test
  )
}

# --- real cost, alongside the credit gate ------------------------------------
# Credits are the hard stop because they cannot silently read zero. This is the
# observable truth next to them: the first flash card cost $0.003 against a
# 1-credit ($0.10) charge, so credits alone badly overstate what you are using.
# Blended from an ~85/15 input/output split; labelled an estimate because it is.
lane_usd_per_mtok() {
  case "$1" in
    flash) echo 0.161 ;; pro) echo 0.500 ;; muse) echo 0.115 ;; *) echo 0 ;;
  esac
}

meter() {
  local lane="$1" issue="$2" log="$3" tok usd
  tok="$(grep -A1 '^tokens used' "$log" 2>/dev/null | tail -1 | tr -dc '0-9')"
  [ -n "$tok" ] || tok=0
  usd="$(awk -v t="$tok" -v r="$(lane_usd_per_mtok "$lane")" 'BEGIN{printf "%.5f", t/1000000*r}')"
  printf '{"ts":"%s","issue":"%s","lane":"%s","credits":0,"tokens":%s,"usd_est":%s}\n' \
    "$(date -u +%FT%TZ)" "$issue" "$lane" "$tok" "$usd" >> "$(ledger_file)"
  echo "$tok tokens, ~\$$usd"
}

# --- git mutex ---------------------------------------------------------------
# Worktree setup writes shared repo state (.git/config, refs). Two workers
# starting together raced on it and one died with "could not lock config file
# .git/config" before it ran a single token. Parallel workers are the whole
# point of this script, so the setup phase is serialized — the LONG part, the
# model actually working, still runs fully concurrent.
#
# mkdir is the atomic primitive here because macOS ships no flock(1).
git_lock() {
  local d="$STATE_DIR/.gitlock" n=0
  until mkdir "$d" 2>/dev/null; do
    sleep 1; n=$((n + 1))
    [ "$n" -lt 180 ] || { echo "git lock held >3min — stale? remove $d"; return 1; }
  done
}
git_unlock() { rmdir "$STATE_DIR/.gitlock" 2>/dev/null || true; }

# --- worker execution --------------------------------------------------------
run_lane() {
  local lane="$1" wt="$2" prompt_file="$3" log="$4"
  # A real session runs for many minutes — the first #104 run spent ten of them
  # just reading schema files. Without a cap a wedged worker sits forever and
  # looks identical to a working one. `timeout` returns 124, which surfaces as
  # a worker error rather than a silent hang.
  local tmo=(timeout "${ORCHESTRATOR_TIMEOUT:-2700}")
  local ds_cfg=(
    -c model_providers.deepseek.name=DeepSeek
    -c model_providers.deepseek.base_url=https://api.deepseek.com/v1
    -c model_providers.deepseek.env_key=DEEPSEEK_API_KEY
    # codex >=0.146 dropped wire_api="chat"; DeepSeek V4 serves the Responses API
    # natively (2026-07-31) so this is the only shape that works. Smoke-proven.
    -c model_providers.deepseek.wire_api=responses
    -c model_provider=deepseek
  )
  # workspace-write denies network by default, so every test that binds a port
  # dies with `listen EPERM` — 47 of them on the first real run, which reads as
  # "the worker broke the suite" when the worker never touched them.
  local net=(-c sandbox_workspace_write.network_access=true)
  if [ "$lane" = "claude" ]; then
    echo "lane=claude — this card is Claude-only; the orchestrator runs it in-session." | tee "$log"
    return 60
  fi
  local model
  model="$(lane_model "$lane")" || return 50
  printf 'launch: lane=%s model=%s output=%s\n' "$lane" "$model" "$log" > "$log"
  local cx
  case "$lane" in
    gpt|flash|pro)
      cx="$(codex_bin)" || { echo "codex: no real binary on PATH (only a cmux shim?)" | tee -a "$log"; return 50; } ;;
  esac
  case "$lane" in
    gpt)
      "${tmo[@]}" "$cx" exec "${net[@]}" --sandbox workspace-write -C "$wt" --skip-git-repo-check \
        -m "$model" - < "$prompt_file" >>"$log" 2>&1 ;;
    flash)
      "${tmo[@]}" "$cx" exec "${ds_cfg[@]}" "${net[@]}" -m "$model" \
        --sandbox workspace-write -C "$wt" --skip-git-repo-check \
        - < "$prompt_file" >>"$log" 2>&1 ;;
    pro)
      "${tmo[@]}" "$cx" exec "${ds_cfg[@]}" "${net[@]}" -m "$model" \
        --sandbox workspace-write -C "$wt" --skip-git-repo-check \
        - < "$prompt_file" >>"$log" 2>&1 ;;
    muse)
      ( cd "$wt" && "${tmo[@]}" muse exec --prompt-file "$prompt_file" --workspace "$wt" \
          --model "$model" --reasoning-effort high \
          --user-input-auto-resolve ) >>"$log" 2>&1 ;;
  esac
}

# --- cross-model review ------------------------------------------------------
# The point of the whole scheme is that Claude does not read diffs. But #93 went
# green while shipping untested code and a live cron, and only a hand review
# caught it — so "green means done" was false. A DIFFERENT cheap model reviews
# every diff here. Different on purpose: a model reviewing its own work grades
# itself, and the two failure modes we have seen (missing tests, silent
# activation) are exactly what an author is blind to.
#
# Never `claude` — this lane exists to keep review off the Claude quota.
reviewer_for() {
  case "$1" in
    flash|pro) echo "gpt" ;;
    *)         echo "flash" ;;
  esac
}

review_diff() {
  local lane="$1" issue="$2" wt="$3" rlane rlog
  rlane="$(reviewer_for "$lane")"
  lane_available "$rlane" || { echo "REVIEW SKIPPED: no reviewer lane available"; return 0; }
  [ "$(lane_cost "$rlane")" -le "$(credits_left)" ] || { echo "REVIEW SKIPPED: out of budget"; return 0; }

  rlog="$STATE_DIR/review-$issue-$rlane.log"
  local rprompt="$STATE_DIR/review-prompt-$issue.txt"
  {
    cat <<'RHEAD'
You are reviewing another model's patch. Be adversarial: your job is to find
what is wrong, not to approve. Do not restate the diff back.

Judge ONLY these, in order:
1. Does it do what the issue asked — no more, no less? Scope creep is a defect.
2. Does new logic come with a test that would FAIL without the change?
3. Does it start anything in production — a cron, queue, worker, producer,
   interval — or change how one is gated?
4. Does it edit any of: src/router/, src/outbound/meta-client.ts,
   src/config/env.ts, src/data/, db/migrations/, CLAUDE.md, STATE.md, LOG.md?
5. Is any SQL column or table it references actually plausible, or invented?

Answer in at most 12 lines. First line MUST be exactly one of:
VERDICT: OK
VERDICT: BLOCK <short reason>

RHEAD
    echo "--- THE ISSUE ---"; cat "$STATE_DIR/prompt-$issue.txt"
    echo; echo "--- THE PATCH ---"
    git -C "$wt" diff origin/main..HEAD
  } > "$rprompt"

  charge "$rlane" "review-$issue"
  # read-only: a reviewer that can edit is no longer a reviewer.
  run_lane_readonly "$rlane" "$wt" "$rprompt" "$rlog" || true
  grep -m1 '^VERDICT:' "$rlog" 2>/dev/null || echo "VERDICT: OK (reviewer returned no verdict line)"
}

run_lane_readonly() {
  local lane="$1" wt="$2" prompt_file="$3" log="$4"
  local tmo=(timeout "${ORCHESTRATOR_REVIEW_TIMEOUT:-900}")
  local ds_cfg=(
    -c model_providers.deepseek.name=DeepSeek
    -c model_providers.deepseek.base_url=https://api.deepseek.com/v1
    -c model_providers.deepseek.env_key=DEEPSEEK_API_KEY
    -c model_providers.deepseek.wire_api=responses
    -c model_provider=deepseek
  )
  local model
  model="$(lane_model "$lane")" || return 50
  printf 'launch: role=review lane=%s model=%s output=%s\n' "$lane" "$model" "$log" > "$log"
  local cx
  case "$lane" in
    gpt|flash|pro)
      cx="$(codex_bin)" || { echo "codex: no real binary on PATH (only a cmux shim?)" | tee -a "$log"; return 50; } ;;
  esac
  case "$lane" in
    gpt)   "${tmo[@]}" "$cx" exec --sandbox read-only -C "$wt" --skip-git-repo-check \
             -m "$model" - < "$prompt_file" >>"$log" 2>&1 ;;
    flash) "${tmo[@]}" "$cx" exec "${ds_cfg[@]}" -m "$model" \
             --sandbox read-only -C "$wt" --skip-git-repo-check \
             - < "$prompt_file" >>"$log" 2>&1 ;;
    pro)   "${tmo[@]}" "$cx" exec "${ds_cfg[@]}" -m "$model" \
             --sandbox read-only -C "$wt" --skip-git-repo-check \
             - < "$prompt_file" >>"$log" 2>&1 ;;
    muse)  ( cd "$wt" && "${tmo[@]}" muse exec --prompt-file "$prompt_file" \
             --model "$model" --disable-web-tools ) >>"$log" 2>&1 ;;
  esac
}

cmd_run() {
  local issue="$1" lane="${2:-}" draft=0
  # `draft:<lane>` — produce the change but never land it. For the standing-
  # context cards (STATE.md, CLAUDE.md, LOG.md) that otherwise route to claude
  # outright: a foreign model may write the words, Claude decides whether they
  # become process. Keeps "agents never author process" intact while moving the
  # typing off the Claude quota.
  case "$lane" in
    draft)   draft=1; lane="flash" ;;
    draft:*) draft=1; lane="${lane#draft:}" ;;
  esac
  [ -n "$lane" ] || lane="$(cmd_route "$issue")"
  [ "$lane" = "claude" ] && { echo "lane=claude"; return 60; }

  # Someone may already have done this card. #50 was worked twice — PR #52 had
  # been open against the same file for weeks, and nothing looked. Matches the
  # issue number AND the card's leading ID token (SMOKE-01, WIRE-B4, RBLD-09…),
  # because #52's title carried the ID but never the number.
  local idtok dup
  idtok="$(gh issue view "$issue" --json title --jq .title 2>/dev/null |
           grep -oE '^[A-Z]+-[A-Z0-9.]+' || true)"
  dup="$(gh pr list --state open --json number,title,body,headRefName --jq \
        ".[] | select(.headRefName != \"orc/$issue\") |
         select(((.title // \"\") + \" \" + (.body // \"\")) |
                test(\"#$issue([^0-9]|\$)${idtok:+|$idtok}\")) | .number" 2>/dev/null | head -3)"
  if [ -n "$dup" ]; then
    echo "ALREADY IN FLIGHT for #$issue — open PR(s): $(printf '#%s ' $dup)"
    echo "Close or merge those first, or force with: run $issue $lane --force"
    [ "${3:-}" = "--force" ] || return 50
  fi

  lane_available "$lane" || { echo "lane $lane unavailable"; return 20; }
  [ "$(lane_cost "$lane")" -le "$(credits_left)" ] || {
    echo "out of budget: $(credits_left)/$DAILY_CREDITS credits left, $lane costs $(lane_cost "$lane")"
    return 40
  }

  local branch="orc/$issue" wt="$STATE_DIR/wt/$issue"
  local log="$STATE_DIR/run-$issue-$lane.log"
  local prompt_file="$STATE_DIR/prompt-$issue.txt"

  git_lock || return 50
  git -C "$REPO_ROOT" fetch -q origin

  # Leftover branch from a previous run on this card. Two very different cases,
  # and an earlier version of this refused both — which meant any interrupted
  # run (killed worker, closed laptop) left a branch that permanently blocked
  # its own retry until someone did git surgery by hand.
  #
  # Never `git branch -D`: protect.py blocks it for the good reason that it
  # silently drops unmerged work, and a script is not a licence to do what the
  # guard forbids by hand. `-d` is the honest tool — it deletes a branch that
  # holds nothing and REFUSES one that does, which is exactly the distinction
  # that matters here.
  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch"; then
    local ahead
    ahead="$(git -C "$REPO_ROOT" rev-list --count "origin/main..$branch" 2>/dev/null || echo 0)"
    if [ "$ahead" -gt 0 ]; then
      echo "branch $branch holds $ahead unmerged commit(s) — a previous run on #$issue"
      echo "produced work that has not landed. That is Joyal's call, not this script's."
      echo "  inspect:  git -C $wt log origin/main..HEAD"
      git_unlock; return 50
    fi
    # Empty branch => a dead run. Reclaim it rather than demand hand-cleanup.
    git -C "$REPO_ROOT" worktree remove --force "$wt" 2>/dev/null || true
    git -C "$REPO_ROOT" branch -q -d "$branch"
  fi
  git -C "$REPO_ROOT" worktree remove --force "$wt" 2>/dev/null || true
  git -C "$REPO_ROOT" worktree add -q -b "$branch" "$wt" origin/main

  # A fresh worktree has no node_modules, so `gate:quick`, `npm test` AND the
  # lefthook pre-commit (npx biome) all fail on a missing binary — which reads
  # as "the worker wrote bad code" when it wrote none yet. Symlink rather than
  # `npm ci` per worktree: ~60s and a full dep tree each, for a tree that must
  # be identical anyway (workers are forbidden from adding dependencies).
  ln -sfn "$REPO_ROOT/node_modules" "$wt/node_modules"
  git_unlock

  build_prompt "$issue" "$branch" > "$prompt_file"

  # Validate the brief BEFORE spending a worker. #104's first run burned 78k
  # tokens implementing the wrong thing because `gh issue view --comments`
  # returns only comments and nothing checked that the body arrived. Costs
  # milliseconds; would have caught it.
  local title
  title="$(gh issue view "$issue" --json title --jq .title 2>/dev/null || echo "")"
  if [ "$(wc -c < "$prompt_file")" -lt 1200 ] ||
     { [ -n "$title" ] && ! grep -qF "$title" "$prompt_file"; }; then
    echo "BRIEF TOO THIN for #$issue ($(wc -c < "$prompt_file") bytes) — refusing to spend a worker."
    echo "The card's title must appear in the prompt and the whole brief must exceed 1200 bytes."
    echo "  inspect: $prompt_file"
    return 50
  fi

  charge "$lane" "$issue"

  echo "issue=$issue lane=$lane worktree=$wt"
  local rc=0
  run_lane "$lane" "$wt" "$prompt_file" "$log" || rc=$?

  # Quota detection reads only the CLI's OWN error lines. Grepping the whole log
  # for `429|quota|rate.?limit` false-positived twice: the worker ran `npm test`,
  # and this repo's suite has tests NAMED "a 429 with Retry-After: 2 normalizes
  # retryAfter" (fixed by provider-specific phrasing below) — then on #131 the
  # worker `cat`'d this very script during investigation, and the phrasing it
  # just read matched itself. A real quota abort is always the CLI's last act
  # before exit, so scope the check to the tail instead of the whole log.
  if tail -n 50 "$log" 2>/dev/null | grep -qiE 'usage limit reached|rate limit reached|429 Too Many Requests|quota exceeded|insufficient balance|exceeded your current quota'; then
    echo "QUOTA: $lane exhausted (see $log)"; return 20
  fi
  [ "$rc" -eq 0 ] || { echo "WORKER ERROR rc=$rc (see $log)"; return 50; }

  # --- the gates. These decide, not the model's self-report. ---
  # The worker leaves its work uncommitted and we commit it here, for two
  # reasons. A sandboxed CLI rooted at the worktree cannot write
  # .git/worktrees/<n>/index.lock, which lives outside that root — the first
  # real run died on exactly that. And committing here means the message is
  # ours, the gates below run against a tree we staged, and the model never
  # needs write access to git at all.
  local touched
  git -C "$wt" add -A -- ':!node_modules'
  if ! git -C "$wt" diff --cached --quiet; then
    git -C "$wt" -c "user.name=orchestrator[$lane]" -c user.email=noreply@localhost \
      commit -q -m "$(printf 'feat(#%s): %s\n\nWorker lane: %s. Committed by scripts/orchestrator.sh;\ngates re-run independently below.\n' \
        "$issue" "$(gh issue view "$issue" --json title --jq .title 2>/dev/null || echo "issue #$issue")" "$lane")"
  fi
  # Against the MERGE-BASE, never the moving origin/main tip. #70 ran for ~25
  # minutes while this session merged #111; the worker committed nothing, but
  # `diff origin/main` then attributed #111's own files to it and returned 30
  # (PROTECTED-PATH BREACH by lane=flash) — a phantom breach against a lane that
  # did nothing. Main moves under every long worker; the base does not.
  local base; base="$(git -C "$wt" merge-base HEAD origin/main)"
  touched="$(git -C "$wt" diff --name-only "$base" || true)"
  # A worker that runs the gates green and produces no diff is not an error —
  # twice on 2026-08-06 (#92, #51) it was the correct answer: the card was
  # already delivered by an earlier session, or obsoleted by a deletion. That
  # returned 50 ("worker errored"), and drain then escalated a finished card up
  # the ladder. 62 = nothing to do, read the log's verdict and close the card.
  if [ -z "$touched" ]; then echo "NO CHANGES — card may already be satisfied (see $log)"; return 62; fi

  echo "cost: $(meter "$lane" "$issue" "$log")"

  # The draft lane deliberately stops here. Its whole purpose is standing-context
  # cards (STATE.md, CLAUDE.md, LOG.md) that route to `claude` outright because
  # "agents never author process" — so a foreign model may DRAFT the edit but
  # never land it. Claude reads the patch and decides. No push, no PR.
  if [ "$draft" = 1 ]; then
    local patch="$STATE_DIR/draft-$issue.patch"
    git -C "$wt" diff "$base"..HEAD > "$patch"
    echo "DRAFT ready — $(wc -l < "$patch") lines: $patch"
    printf '%s\n' "$touched" | sed 's/^/  /'
    return 61
  fi

  if printf '%s' "$touched" | grep -qE "$PROTECTED_RE"; then
    echo "PROTECTED-PATH BREACH by lane=$lane:"; printf '%s\n' "$touched" | grep -E "$PROTECTED_RE"
    return 30
  fi
  local srcdiff; srcdiff="$(git -C "$wt" diff "$base"..HEAD -- src/ || true)"
  if ! gate_tests_accompany_code "$touched" "$srcdiff"; then
    echo "NO TEST FOR NEW CODE — src/ changed with real logic, tests/ did not."
    printf '%s\n' "$touched" | sed 's/^/  /'
    return 11
  fi
  if ! gate_no_silent_producer "$srcdiff"; then
    echo "STARTS SOMETHING IN PRODUCTION — new queue/cron/worker or a changed gate."
    printf '%s\n' "$srcdiff" |
      grep -E '^\+.*(QUEUE_DEFS|cron:|boss\.schedule|boss\.work|setInterval|mode: .live.)' | sed 's/^/  /'
    echo "Not a lane decision. Re-run on the claude lane, or merge deliberately."
    return 31
  fi

  run_gates "$wt" >>"$log" 2>&1 || {
    echo "GATES RED (tail of $log):"; tail -30 "$log"; return 10
  }

  local verdict; verdict="$(review_diff "$lane" "$issue" "$wt")"
  echo "review: $verdict"

  git -C "$wt" push -q origin "$branch"
  gh pr create --head "$branch" --base main --fill \
     --body "Closes #$issue

Worker lane: \`$lane\`. Gates run in-worktree by scripts/orchestrator.sh, not self-reported:
this repo's own check scripts (see \`run_gates\`) + \`npm test\` green · protected paths clean ·
tests accompany new code · no queue/cron/producer started.

Cross-model review (\`$(reviewer_for "$lane")\` lane, adversarial, read-only):
\`\`\`
$verdict
\`\`\`
Log: \`${log#"$REPO_ROOT"/}\`" >/dev/null
  local pr; pr="$(gh pr list --head "$branch" --json url --jq '.[0].url')"

  case "$verdict" in
    *BLOCK*) echo "REVIEW BLOCK $pr"; return 12 ;;
    *)       echo "GREEN $pr" ;;
  esac
}

# --- drain: run a card, escalating a tier on a retryable failure -------------
# The exit-code ladder was documented from the start but driven by hand, which
# put Joyal (or Claude) back in the loop for the most mechanical decision here.
cmd_drain() {
  local issue="$1" lane; lane="${2:-$(cmd_route "$issue")}"
  local tried=""
  while :; do
    [ "$lane" = "claude" ] && { echo "#$issue -> claude lane (tried:${tried:-none})"; return 60; }
    tried="$tried $lane"
    local rc=0; cmd_run "$issue" "$lane" || rc=$?
    case "$rc" in
      0|12|61|62) return "$rc" ;;                    # done, or wants a human
      30|31|40) return "$rc" ;;                      # escalating cannot help
      10|11|20|50)
        # A stronger model may succeed where a weaker one failed; the same model
        # twice usually will not. Never escalate past pro — beyond that the card
        # is telling you it is not a foreign-model card.
        case "$lane" in
          flash) lane="gpt" ;;
          muse)  lane="gpt" ;;
          gpt)   lane="pro" ;;
          *)     echo "#$issue exhausted the ladder (tried:$tried) rc=$rc"; return "$rc" ;;
        esac
        # A rung that is DOWN is not an escalation, it is a second failure with
        # extra latency — #92 spent one on deepseek-v4-pro answering HTTP 400.
        lane_available "$lane" || {
          echo "#$issue exhausted the ladder ($lane is DOWN) (tried:$tried) rc=$rc"; return "$rc"; }
        echo "#$issue rc=$rc — escalating to $lane"
        ;;
      *) return "$rc" ;;
    esac
  done
}

# Sourcing this file must not run a command — orchestrator-cases.sh loads it as a
# library to call the gate functions directly.
[ "${BASH_SOURCE[0]:-$0}" = "$0" ] || return 0

case "${1:-}" in
  campaign)
    shift
    # AT-03: campaign.py has NO hardcoded repo-identity default (it requires these three env
    # vars and fails loudly if unset) — this is the one place that must set them, per repo,
    # every time. sales-app's literal path mirrors the settings.json LOCK_HOME pattern from
    # Phase 1, not a computed slug transform.
    export CAMPAIGN_QUEUE_HOME="${CAMPAIGN_QUEUE_HOME:-$HOME/.claude/projects/-Users-joyaltitus-Documents-sales-app/queue.jsonl}"
    export CAMPAIGN_LEASE_HOME="${CAMPAIGN_LEASE_HOME:-$HOME/.claude/projects/-Users-joyaltitus-Documents-sales-app/locks}"
    export CAMPAIGN_REPO="${CAMPAIGN_REPO:-$REPO_NAME}"
    exec python3 "$REPO_ROOT/scripts/campaign.py" "$@"
    ;;
  route)  cmd_route "${2:?issue number}" ;;
  # "${4:-}" carries --force through. Dispatch used to drop it, so the escape
  # hatch the in-flight message advertises (`run <issue> <lane> --force`) could
  # never fire — #67 was unrunnable behind a false in-flight match on #68.
  run)    cmd_run "${2:?issue number}" "${3:-}" "${4:-}" ;;
  drain)  cmd_drain "${2:?issue number}" "${3:-}" ;;
  lanes)  cmd_lanes ;;
  budget)
    echo "$(credits_left)/$DAILY_CREDITS credits left today"
    awk -F'"usd_est":' 'NF>1{split($2,a,"}"); s+=a[1]} END {printf "actual spend today: ~$%.4f\n", s+0}' \
      "$(ledger_file)" 2>/dev/null || true
    echo "ledger: $(ledger_file)"
    ;;
  *) sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 1 ;;
esac
