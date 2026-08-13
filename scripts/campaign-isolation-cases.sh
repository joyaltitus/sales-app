#!/usr/bin/env bash
# AT-03 proof: campaign.py's CAMPAIGN_QUEUE_HOME/CAMPAIGN_LEASE_HOME/CAMPAIGN_REPO resolve
# independently per repo when the caller (scripts/orchestrator.sh) sets them at invocation —
# a sales-app campaign run never touches hub-service's queue/lock directory or vice versa,
# and neither run misreports its own repo identity. Runs both repos' actual campaign.py in
# the same pass, against temp queue/lease dirs (never the real
# ~/.claude/projects/*/queue.jsonl), so this is safe to run repeatedly and never talks to
# GitHub — acquire_lease/release_lease/append_record are pure filesystem, no network needed.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
HUB="${HUB_SERVICE_ROOT:-/Users/joyaltitus/Documents/hub-service}"
if [ ! -f "$HUB/scripts/campaign.py" ]; then
  echo "SKIP: hub-service checkout not found at $HUB (set HUB_SERVICE_ROOT) — cannot prove cross-repo isolation without it"
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

run_repo() {
  local root="$1" label="$2" issue="$3"
  local qh="$tmp/$label/queue.jsonl" lh="$tmp/$label/locks"
  CAMPAIGN_QUEUE_HOME="$qh" CAMPAIGN_LEASE_HOME="$lh" CAMPAIGN_REPO="joyaltitus/$label" \
    python3 -c "
import sys
sys.path.insert(0, '$root/scripts')
import campaign
assert str(campaign.QUEUE_HOME) == '$qh', f'QUEUE_HOME leaked: {campaign.QUEUE_HOME}'
assert str(campaign.LEASE_HOME) == '$lh', f'LEASE_HOME leaked: {campaign.LEASE_HOME}'
assert campaign.REPO == 'joyaltitus/$label', f'REPO leaked: {campaign.REPO}'
campaign.acquire_lease($issue, 'tok-$label', commander='isolation-test')
campaign.append_record({'task_id': 'isolation-$label', 'terminal_state': 'completed'})
campaign.release_lease($issue, 'tok-$label')
print('OK $label')
"
}

run_repo "$HERE" "sales-app" 90001
run_repo "$HUB" "hub-service" 90002

# Each repo's run must have written into ITS OWN temp tree...
[ -f "$tmp/sales-app/queue.jsonl" ] || { echo "FAIL: sales-app run wrote no queue"; exit 1; }
[ -f "$tmp/hub-service/queue.jsonl" ] || { echo "FAIL: hub-service run wrote no queue"; exit 1; }
[ -d "$tmp/sales-app/locks" ] || { echo "FAIL: sales-app run wrote no lock dir"; exit 1; }
[ -d "$tmp/hub-service/locks" ] || { echo "FAIL: hub-service run wrote no lock dir"; exit 1; }
# ...and never crossed into the other's tree (the actual collision this exists to catch).
if find "$tmp/sales-app" -mindepth 1 2>/dev/null | grep -q "hub-service"; then
  echo "FAIL: sales-app run touched a hub-service-named path"; exit 1
fi
if find "$tmp/hub-service" -mindepth 1 2>/dev/null | grep -q "sales-app"; then
  echo "FAIL: hub-service run touched a sales-app-named path"; exit 1
fi

echo "campaign-isolation-cases: PASS (2/2 — sales-app and hub-service isolated)"
