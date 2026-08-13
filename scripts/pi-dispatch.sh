#!/usr/bin/env bash
# The Pi worker seat (S3 AT-10, WIDENED by S12 — Joyal, 2026-08-14).
#
# Pi is now the DEFAULT worker, not a dispatch-only fallback. It may launch and
# watch approved non-protected work, read and run shell, AND write — but only
# inside its own linked worktree, and only outside the protected-path list. It
# still may NOT plan the big things, merge, deploy, or route protected paths.
#
# What widened, and what did not:
#   - TOOL: edit + write joined the allowlist. The bound is the SAME
#     .claude/protected-paths.json every other door reads, plus a worktree root
#     (PI_WRITE_ROOT) the command-guard adapter enforces per file write.
#   - CREDENTIALS: the worker now RECEIVES Supabase data-plane access
#     (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; CLAUDE.md law 8 amended). Only
#     DEPLOY/MANAGEMENT authority is stripped. A seat that cannot hold the key
#     cannot use it, which is a stronger claim than a seat told not to.
#   - DESIGN: two-tier. Pi may design a self-contained single-module feature when
#     the prompt DECLARES `SCOPE: self-contained (<module>)`. Undeclared scope,
#     protected paths, money and live work stay frontier-only.
#
# Pi's interactive command-guard extension fails OPEN by design — a broken
# seatbelt must not brick every bash call for a human at the wheel. An
# orchestration launch is not a human at the wheel, so this launcher fails
# CLOSED: if any link of the guard chain is missing, nothing starts.
#
# Every refusal below is exercised by scripts/pi-cases.sh. Adding a rule here
# without a case there means the rule is a document, not a gate.
#
# Usage:
#   scripts/pi-dispatch.sh --task "<text>" [--paths a,b] [--worktree <dir>] [-- <extra pi args>]
#
# Exit 0 = launched. Exit 2 = refused, reason on stderr as
#   PI-DISPATCH REFUSED [<rule>]: <why>
set -uo pipefail

REPO="$(git rev-parse --show-toplevel)"

PATTERNS_FILE="$HOME/.agents/hooks/dangerous-patterns.txt"
EXTENSION="$HOME/.pi/agent/extensions/command-guard/index.ts"
PATHS_CONFIG="$REPO/.claude/protected-paths.json"
PROTECT_HOOK="$REPO/.claude/hooks/protect.py"
PI_BIN="$(command -v pi || true)"

# The worker seat reads, searches, runs shell AND writes. `edit`/`write` are
# bounded per call by the command-guard adapter, never by this list alone.
TOOL_ALLOWLIST="read,grep,find,ls,bash,edit,write"

# Credentials that confer MERGE or DEPLOY authority. Stripped from the child
# environment unconditionally. Supabase's service-role key is deliberately NOT
# here: it is data-plane access the worker is meant to have (S12 ruling), and
# pretending otherwise would have workers ask a human to run their queries.
CREDENTIALS=(
  GITHUB_TOKEN GH_TOKEN GH_ENTERPRISE_TOKEN GITHUB_PAT GH_CONFIG_DIR
  ZEABUR_TOKEN ZEABUR_API_TOKEN ZEABUR_API_KEY
  SUPABASE_ACCESS_TOKEN
  NPM_TOKEN DEPLOY_KEY GIT_ASKPASS
)

TASK=""
PATHS=""
WORKTREE=""
EXTRA=()

refuse() { # rule, why
  echo "PI-DISPATCH REFUSED [$1]: $2" >&2
  exit 2
}

# Config knobs exist for scripts/pi-cases.sh only. Honouring them on a live
# launch would let a caller point the guard at a hand-made denylist or an empty
# protected-path list, which is the whole wall.
testing() { [ "${PI_DISPATCH_TEST:-}" = "1" ]; }

while [ $# -gt 0 ]; do
  case "$1" in
    --task)          TASK="${2:-}"; shift 2 ;;
    --paths)         PATHS="${2:-}"; shift 2 ;;
    --worktree)      WORKTREE="${2:-}"; shift 2 ;;
    --patterns-file) testing && PATTERNS_FILE="${2:-}"; shift 2 ;;
    --extension)     testing && EXTENSION="${2:-}"; shift 2 ;;
    --paths-config)  testing && PATHS_CONFIG="${2:-}"; shift 2 ;;
    --protect-hook)  testing && PROTECT_HOOK="${2:-}"; shift 2 ;;
    --pi-bin)        testing && PI_BIN="${2:-}"; shift 2 ;;
    --)              shift; EXTRA=("$@"); break ;;
    *)               refuse "unknown-flag" "$1 is not a dispatch flag; pi args go after --" ;;
  esac
done

ARGS_TEXT="${EXTRA[*]:-}"

# ---------------------------------------------------------------- fail closed
[ -n "$TASK" ] || refuse "no-task" "a dispatch launch must name the work it is dispatching"

[ -f "$PATTERNS_FILE" ] || refuse "missing-patterns" "no shared denylist at $PATTERNS_FILE"
grep -qvE '^[[:space:]]*(#|$)' "$PATTERNS_FILE" \
  || refuse "missing-patterns" "$PATTERNS_FILE carries no live pattern"
[ -f "$EXTENSION" ] || refuse "missing-extension" "pi command-guard adapter absent at $EXTENSION"
[ -f "$PROTECT_HOOK" ] || refuse "missing-protect-hook" "protected-path door absent at $PROTECT_HOOK"

PREFIXES="$(python3 - "$PATHS_CONFIG" <<'PY' 2>/dev/null
import json, sys
cfg = json.load(open(sys.argv[1]))
out = []
for key in ("system", "product", "edit_existing_only", "no_delete"):
    out.extend(cfg.get(key, []))
print("\n".join(p for p in out if p))
PY
)" || true
[ -n "$PREFIXES" ] || refuse "missing-guard-config" "cannot read protected paths from $PATHS_CONFIG"

# ------------------------------------------------------- writes live in a worktree
# The write seat exists only inside a LINKED worktree. This is checked as a git
# property, not a path spelling: a directory named wt/anything is not a worktree,
# and a worktree is one whether or not it is named that way. The main checkout is
# excluded because that is where merges and deploys happen.
if [ -n "$WORKTREE" ]; then
  [ -d "$WORKTREE" ] || refuse "worktree-missing" "no such worktree directory: $WORKTREE"
  git -C "$WORKTREE" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || refuse "worktree-missing" "$WORKTREE is not a git work tree"
  wt_git="$(git -C "$WORKTREE" rev-parse --absolute-git-dir 2>/dev/null || true)"
  wt_common="$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  [ -n "$wt_git" ] && [ "$wt_git" != "$wt_common" ] \
    || refuse "worktree-is-main" "the write seat runs in a linked worktree, never the main checkout"
  WRITE_ROOT="$(cd "$WORKTREE" && pwd -P)"
else
  WRITE_ROOT=""
fi

# --------------------------------------------------------------- cannot plan
# Planning is where authority actually lives: whoever chooses the approach has
# already made the decisions the writing seat merely types out. TWO-TIER (S12):
# a SELF-CONTAINED single-module design is small enough that choosing it is not
# choosing the architecture — but the scope has to be DECLARED by the author, in
# the prompt, not inferred from how modest the request sounds.
PLANNING='\b(plan|plans|planned|planning|design|designs|designing|architect|architecture|decide|decides|decision|propose|proposal|brainstorm|spec|specification|roadmap|strateg(y|ise|ize)|evaluate|trade-?offs?|options)\b'
SELF_CONTAINED='SCOPE:[[:space:]]*self-contained[[:space:]]*\([^)]+\)'
# Big-planning words no declared scope can wave through: these are architecture,
# not a module.
ARCHITECTURE='\b(architect|architecture|roadmap|strateg(y|ise|ize)|multi-module|cross-cutting|migration plan)\b'
if printf '%s\n' "$TASK" | grep -qiE "$PLANNING"; then
  if printf '%s\n' "$TASK" | grep -qE "$SELF_CONTAINED"; then
    printf '%s\n' "$TASK" | grep -qiE "$ARCHITECTURE" \
      && refuse "planning-prompt" "architecture-scale design is frontier-only, declared scope or not"
  else
    refuse "planning-prompt" \
      "designing needs a declared 'SCOPE: self-contained (<module>)'; otherwise it is frontier work"
  fi
fi

# ---------------------------------------------------------------- cannot bill
# Money paths stay frontier-only whether or not they are protected on disk: a
# billing module that does not exist yet still must not be pi's first draft.
MONEY='\b(billing|payment|payments|payout|invoice|refund|credits?|pricing)\b'
printf '%s\n' "$TASK $PATHS" | grep -qiE "$MONEY" \
  && refuse "money-path" "money code paths are frontier-only"

# ---------------------------------------------------------- cannot self-widen
printf '%s\n' "$ARGS_TEXT" \
  | grep -qE -- '(^|[[:space:]])(--tools|-t|--exclude-tools|-xt|--no-extensions|-ne|--no-builtin-tools|-nbt|--no-tools|-nt)([[:space:]]|=|$)' \
  && refuse "write-tool" "the tool surface is pinned by this launcher and is not caller-settable"

# -------------------------------------------- cannot hold merge/deploy rights
for cred in "${CREDENTIALS[@]}"; do
  case "$TASK $ARGS_TEXT" in
    *"$cred"*) refuse "credential-routing" "$cred must never be handed to the worker seat" ;;
  esac
done

MERGE_DEPLOY='(gh[[:space:]]+pr[[:space:]]+merge|git[[:space:]]+push|git[[:space:]]+merge|deploy-zeabur|promote|restartService|npm[[:space:]]+run[[:space:]]+deploy)'
printf '%s\n' "$TASK $ARGS_TEXT" | grep -qiE "$MERGE_DEPLOY" \
  && refuse "merge-deploy-action" "merging and deploying belong to the runner alone"

# ------------------------------------------------ cannot route protected work
# Same declared list the Claude and Codex doors read, so the three seats can
# never drift apart on what "protected" means.
while IFS= read -r prefix; do
  [ -n "$prefix" ] || continue
  case "$TASK $PATHS" in
    *"$prefix"*) refuse "protected-path" "'$prefix' is protected; that work needs a frontier seat" ;;
  esac
done <<< "$PREFIXES"

# --------------------------------------------------- exact model, no default
# S6/AT-19: every launch records the exact model, no implicit default and no
# silent fallback — same rule already applied to the Codex/Claude lanes. Pi's
# own CLI default ("google" per --help) is exactly the kind of silent choice
# that rule forbids, so require the caller to name one.
printf '%s\n' "$ARGS_TEXT" | grep -qE -- '(^|[[:space:]])(--model|-m)([[:space:]]|=)' \
  || refuse "no-model" "the worker seat requires an explicit --model; no implicit default"

# ------------------------------------------------------------------- dispatch
# Checked last on purpose: whether pi is installed is a property of the machine,
# not of the request, so a forbidden request must be refused for what it asks
# rather than for where it happens to be running.
[ -x "$PI_BIN" ] || refuse "missing-pi" "no runnable pi binary (looked at '${PI_BIN:-none}')"

UNSET=()
for cred in "${CREDENTIALS[@]}"; do UNSET+=(-u "$cred"); done

# ---------------------------------------------------- observed session/model
# campaign.py verifies a RETURNED identity for the Codex/Claude lanes (resumed
# thread id / session id, served model) rather than trusting what was asked
# for; Pi gets the same treatment. A session id is mintable in advance (pi
# accepts a caller-chosen `--session-id` and creates the session under it, so
# it is knowable before launch, not just parsed after) but the SERVED model
# can only be read back from what pi actually recorded in that session's own
# file — never trust the request over the response.
SESSION_ID=""
testing && SESSION_ID="${PI_DISPATCH_TEST_SESSION_ID:-}"
[ -n "$SESSION_ID" ] || SESSION_ID="$(python3 -c 'import uuid; print(uuid.uuid4())')"
SESSION_DIR="${PI_SESSION_DIR:-$HOME/.pi/agent/sessions}"

# PI_WRITE_ROOT is the per-file write bound the command-guard adapter enforces.
# Exported (not just passed) because the adapter runs inside pi's own process.
set +e
if [ -n "$WRITE_ROOT" ]; then
  (cd "$WRITE_ROOT" && env "${UNSET[@]}" PI_WRITE_ROOT="$WRITE_ROOT" \
    "$PI_BIN" --tools "$TOOL_ALLOWLIST" --session-id "$SESSION_ID" \
    -p "$TASK" ${EXTRA[@]+"${EXTRA[@]}"})
else
  env "${UNSET[@]}" "$PI_BIN" --tools "$TOOL_ALLOWLIST" --session-id "$SESSION_ID" \
    -p "$TASK" ${EXTRA[@]+"${EXTRA[@]}"}
fi
PI_RC=$?
set -u

served="$(find "$SESSION_DIR" -name "*${SESSION_ID}.jsonl" 2>/dev/null | head -1 | xargs -I{} \
  grep -m1 '"type":"model_change"' {} 2>/dev/null | \
  python3 -c 'import json,sys
line = sys.stdin.readline()
if not line:
    sys.exit(0)
e = json.loads(line)
print("%s/%s" % (e.get("provider", "?"), e.get("modelId", "?")))' 2>/dev/null)"
if [ -n "$served" ]; then
  echo "PI-DISPATCH IDENTITY session_id=$SESSION_ID model=$served" >&2
else
  echo "PI-DISPATCH IDENTITY session_id=$SESSION_ID model=UNVERIFIED (no session file/model_change event found)" >&2
fi

exit "$PI_RC"
