#!/usr/bin/env bash
# Exact-model campaign worker launcher. It dispatches and reports; it never merges.
set -euo pipefail

campaign="" task="" wt="" branch="" pane="" harness="" model="" effort="" sid="" prompt="" resume=0 review=0
while [ $# -gt 0 ]; do
  case "$1" in
    --campaign) campaign="${2:-}"; shift 2 ;;
    --task) task="${2:-}"; shift 2 ;;
    --worktree) wt="${2:-}"; shift 2 ;;
    --branch) branch="${2:-}"; shift 2 ;;
    --pane) pane="${2:-}"; shift 2 ;;
    --harness) harness="${2:-}"; shift 2 ;;
    --model) model="${2:-}"; shift 2 ;;
    --effort) effort="${2:-}"; shift 2 ;;
    --session-id) sid="${2:-}"; shift 2 ;;
    --prompt) prompt="${2:-}"; shift 2 ;;
    --resume) resume=1; shift ;;
    --review) review=1; shift ;;
    *) echo "campaign-launch: unknown argument $1" >&2; exit 2 ;;
  esac
done

for value in "$campaign" "$task" "$wt" "$branch" "$pane" "$harness" "$model" "$effort" "$sid" "$prompt"; do
  [ -n "$value" ] || { echo "campaign-launch: missing launch identity" >&2; exit 2; }
done
[ -f "$prompt" ] || { echo "campaign-launch: prompt unreadable" >&2; exit 2; }

repo="$(cd "$(dirname "$0")/.." && pwd)"
repo_name="$(cd "$repo" && gh repo view --json nameWithOwner --jq .nameWithOwner)"
mkdir -p "$(dirname "$wt")"
if [ ! -d "$wt/.git" ] && [ ! -f "$wt/.git" ]; then
  git -C "$repo" fetch -q origin main
  git -C "$repo" worktree add -q -b "$branch" "$wt" origin/main
fi
[ "$(git -C "$wt" branch --show-current)" = "$branch" ] \
  || { echo "campaign-launch: worktree branch does not match $branch" >&2; exit 2; }
[ -d "$repo/node_modules" ] \
  || { echo "campaign-launch: commander checkout has no node_modules; run npm ci --ignore-scripts" >&2; exit 2; }
[ -e "$wt/node_modules" ] || ln -s "$repo/node_modules" "$wt/node_modules"

out="${CAMPAIGN_OUTPUT:-$(dirname "$prompt")/$campaign-$task-$harness.out}"
# The model the harness actually served, read out of the harness's own record — never the
# value this script was handed. `served` = the provider's own usage record; `client` = the
# CLI's resolved turn context; `unobserved` = no record exists, which campaign.py parks on.
# A harness with no attestation is not a harness that used the right model.
served_model="" attestation="unobserved"
case "$harness" in
  codex)
    events="$out.events.jsonl"
    if [ "$resume" = 1 ]; then
      resume_sid="$(python3 - "$events" <<'PY'
import json, sys
for line in open(sys.argv[1], errors="replace"):
    try: row = json.loads(line)
    except ValueError: continue
    if row.get("type") == "thread.started" and row.get("thread_id"):
        print(row["thread_id"]); break
PY
)"
      [ -n "$resume_sid" ] || { echo "campaign-launch: no Codex session to resume" >&2; exit 2; }
      (cd "$wt" && codex exec resume --json -m "$model" -o "$out" "$resume_sid" - \
        <"$prompt" >"$events.next")
      mv "$events.next" "$events"
      actual_sid="$resume_sid"
    else
      codex exec --json --sandbox workspace-write -C "$wt" -m "$model" -o "$out" - \
        <"$prompt" >"$events"
      actual_sid="$(python3 - "$events" <<'PY'
import json, sys
for line in open(sys.argv[1], errors="replace"):
    try: row = json.loads(line)
    except ValueError: continue
    if row.get("type") == "thread.started" and row.get("thread_id"):
        print(row["thread_id"]); break
PY
)"
    fi
    # Codex chooses the thread id. Preserve the campaign id in the journal and fail if the
    # launcher could not observe the real resumable identity in its named output.
    [ -n "$actual_sid" ] || { echo "campaign-launch: codex emitted no persistent thread id" >&2; exit 2; }
    # Codex reports no model on its event stream; its rollout file records the turn context
    # the CLI resolved. That is a client-side observation, not a provider receipt.
    # `|| true`: a missing sessions dir means unobserved, which campaign.py parks on — it
    # must not crash the launcher into a less specific "worker crashed" park.
    rollout="$(find "${CODEX_HOME:-$HOME/.codex}/sessions" -name "*$actual_sid.jsonl" 2>/dev/null | head -1 || true)"
    if [ -n "$rollout" ]; then
      served_model="$(python3 - "$rollout" <<'PY'
import json, sys
model = ""
for line in open(sys.argv[1], errors="replace"):
    try: row = json.loads(line)
    except ValueError: continue
    if row.get("type") == "turn_context":
        model = row.get("payload", {}).get("model") or model
print(model)
PY
)"
      [ -n "$served_model" ] && attestation="client"
    fi
    ;;
  claude)
    # The prompt goes on stdin, never positionally: --allowedTools is variadic, so a
    # trailing prompt argument is parsed as one more tool name and --print gets no input.
    raw="$out.json"
    if [ "$review" = 1 ]; then
      (cd "$wt" && claude -p --output-format json --model "$model" --effort "$effort" \
        --session-id "$sid" --permission-mode plan \
        --allowedTools 'Read,Grep,Glob,Bash(git diff *),Bash(git show *),Bash(git status *)' \
        <"$prompt") >"$raw"
    elif [ "$resume" = 1 ]; then
      (cd "$wt" && claude -p --output-format json --resume "$sid" --model "$model" \
        --effort "$effort" --permission-mode acceptEdits <"$prompt") >"$raw"
    else
      (cd "$wt" && claude -p --output-format json --model "$model" --effort "$effort" \
        --session-id "$sid" --permission-mode acceptEdits <"$prompt") >"$raw"
    fi
    # modelUsage is keyed by the model the provider actually billed the turn to, and
    # session_id is the session the CLI actually recorded — both read back, neither assumed.
    observation="$(python3 - "$raw" "$out" <<'PY'
import json, sys
try:
    row = json.load(open(sys.argv[1], errors="replace"))
except (ValueError, OSError):
    sys.exit(0)
open(sys.argv[2], "w").write(str(row.get("result") or ""))
usage = row.get("modelUsage")
print(next(iter(usage)) if isinstance(usage, dict) and usage else "")
print(row.get("session_id") or "")
PY
)"
    served_model="$(printf '%s' "$observation" | sed -n 1p)"
    actual_sid="$(printf '%s' "$observation" | sed -n 2p)"
    [ -n "$served_model" ] && attestation="served"
    ;;
  pi)
    # pi-dispatch.sh mints and reports its own authoritative session id (S6/AT-19); it is not
    # caller-settable, so nothing here forwards $sid to it. Its stderr carries a
    # "PI-DISPATCH IDENTITY session_id=... model=..." line read back the same way the
    # Codex/Claude lanes read back their own harness-recorded identity — never assumed.
    identity_log="$out.identity"
    "$repo/scripts/pi-dispatch.sh" --task "Read and dispatch approved campaign $campaign task $task from $prompt" \
      -- --model "$model" --thinking "$effort" >"$out" 2>"$identity_log"
    identity_line="$(grep -m1 '^PI-DISPATCH IDENTITY ' "$identity_log" || true)"
    actual_sid="$(printf '%s\n' "$identity_line" | sed -n 's/.*session_id=\([^ ]*\).*/\1/p')"
    served_model="$(printf '%s\n' "$identity_line" | sed -n 's/.*model=\([^ ]*\).*/\1/p')"
    [ "$served_model" = "UNVERIFIED" ] && served_model=""
    [ -n "$served_model" ] && attestation="served"
    ;;
  *) echo "campaign-launch: unsupported harness $harness" >&2; exit 2 ;;
esac

pr="$(gh pr list --repo "$repo_name" --head "$branch" --state open --json number --jq '.[0].number // empty')"
[ -n "$pr" ] || { echo "campaign-launch: worker produced no open PR for $branch" >&2; exit 2; }
# actual_sid is the session the harness itself reported. A harness that reports none leaves
# it empty on purpose: campaign.py parks rather than accept the id this script asked for.
printf '{"requested_model":"%s","actual_model":"%s","model_attestation":"%s","pr":%s,"terminal_state":"pr","observed_session_id":"%s","persistent_session_id":"%s","requested_session_id":"%s"}\n' \
  "$model" "${served_model:-$model}" "$attestation" "$pr" "$actual_sid" "$actual_sid" "$sid"
