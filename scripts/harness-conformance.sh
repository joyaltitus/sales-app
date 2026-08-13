#!/usr/bin/env bash
# AT-04: sales-app-scoped conformance check. Asserts only what is actually true here
# today — hook binding, proof suites present and green — and SKIPS LOUDLY (never
# silently, never asserting a pass) on pieces that don't exist yet in this repo:
# lefthook, CI wiring, gate:quick/lint/typecheck. Modelled on hub-service's
# scripts/harness-conformance.sh, scoped down to sales-app's actual state.
set -uo pipefail

REPO="$(git rev-parse --show-toplevel)"
cd "$REPO"
fail=0

echo "--- hook binding ---"
# The command string is JSON-escaped on disk (\"$CLAUDE_PROJECT_DIR/...\"), so match the
# unescaped substring only — a literal-quote pattern silently never matches the real file.
if grep -qF 'CLAUDE_PROJECT_DIR/.claude/hooks/protect.py' .claude/settings.json 2>/dev/null &&
   grep -qF 'CLAUDE_PROJECT_DIR/.claude/hooks/lock_guard.py' .claude/settings.json 2>/dev/null; then
  echo "PASS: protect.py + lock_guard.py wired in .claude/settings.json"
else
  echo "FAIL: hook binding missing from .claude/settings.json"
  fail=1
fi

echo "--- adapters ---"
# S12: the pi worker seat is ported here. Its shim carries its own conformance,
# discovered the same way hub-service discovers adapters.
if [ -f .pi/adapter-conformance.sh ]; then
  if bash .pi/adapter-conformance.sh; then
    echo "PASS: .pi/adapter-conformance.sh"
  else
    echo "FAIL: .pi/adapter-conformance.sh"
    fail=1
  fi
else
  echo "FAIL: .pi/adapter-conformance.sh missing"
  fail=1
fi

echo "--- proof suites ---"
# pi-cases.sh is run by the pi adapter shim above, so it is deliberately not
# repeated here — one run, one result, no suite that passes twice and fails once.
for suite in protect-cases.sh lock-cases.sh campaign-isolation-cases.sh; do
  if [ -f "scripts/$suite" ]; then
    if bash "scripts/$suite"; then
      echo "PASS: $suite"
    else
      echo "FAIL: $suite"
      fail=1
    fi
  else
    echo "FAIL: scripts/$suite missing"
    fail=1
  fi
done

echo "--- not-yet-real pieces (sales-app has no lefthook, no CI wiring, no gate:quick) ---"
[ -f lefthook.yml ] && echo "note: lefthook.yml now exists — this check needs updating, it is stale" ||
  echo "SKIP: lefthook.yml does not exist yet"
[ -f .github/workflows/ci.yml ] && echo "note: ci.yml now exists — this check needs updating, it is stale" ||
  echo "SKIP: .github/workflows/ci.yml does not exist yet"
if grep -q '"gate:quick"' package.json 2>/dev/null; then
  echo "note: gate:quick now exists in package.json — this check needs updating, it is stale"
else
  echo "SKIP: npm script gate:quick does not exist yet (only test, build)"
fi

if [ "$fail" -eq 0 ]; then
  echo "harness-conformance: PASS"
else
  echo "harness-conformance: FAIL"
  exit 1
fi
