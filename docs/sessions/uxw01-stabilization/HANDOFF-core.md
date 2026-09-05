# Lane A — core correctness: handoff

Branch `uxw01/core`, based on `13a1d23`. Four commits, one per tier group, so a
revert can target one group. Nothing merged; no PR opened.

Every fix in this lane was **mutation-checked**: before committing, the fix was
reverted in place and the new assertions were confirmed to fail, then restored.
Where that check showed an assertion passing against the old code too, it is
called out below rather than counted as coverage.

## Gates (final state)

```
npx tsc -b                    silent
npm test                      113 files / 811 tests pass, 0 unhandled errors
npm run build                 ✓ first-load JS: 173.4 KB gz (budget 200 KB)
npm run check:no-service-role ✓
npm run check:tokens          ✓
npm run ext:build             665.15 kB
```

The suite passed as a whole on every run; no file needed isolated re-running.

### Hold-the-line numbers — three small overruns, flagged not traded

The master doc's performance policy is "hold the achieved number". Measured
against a clean `13a1d23` build (I built the base commit to get the exact
delta rather than trusting the recorded figure):

| Metric | Base | Now | Delta | Policy |
|---|---|---|---|---|
| first-load JS | 171.8 KB gz | 173.4 KB gz | +1.6 | 200 KB budget passes; hold-line is 171.8 |
| PWA precache | 1104.27 KiB | 1109.98 KiB | +5.71 | 45 entries, unchanged |
| ext:build | 665.00 kB | 665.15 kB | +0.15 | ceiling 665 kB |

The added bytes are input validation, error handling, the role-prefix hook and
the update prompt. I did not shrink any of them to get under the line — that
would mean removing the fixes. **Lane D's call**, and worth Joyal seeing: 1.6 KB
of gzip for the four P0s and the routing fix looks like the right trade, but it
is a policy breach and I am not going to describe it as anything else.

## Per item

**1 · REG-035 outbox deadlock.** `update_follow_up` treats `reason === 'denied'`
as done; `save_lead`/`log_outcome` still throw. `extension/lib/outbox.ts`
untouched. Tests: registry-level denied-resolves, registry-level real-error-still-
throws (guards the fix against being too wide), store-level drain reaching
`remaining: []`.
*Noted:* a true RLS denial is indistinguishable from "already moved" here and is
now swallowed too. A lost status flip beats a permanently deadlocked queue, but
it is a real trade and it is in the code comment.

**2 · REG-049.1 toMinor.** Empty parses as `null`. `toMinor` is exported for the
unit test, matching the file's existing habit of exporting helpers for tests.

**3 · REG-043(1)/050.3 parseMoney.** Hoisted to `src/lib/targets-data.ts` beside
the upsert it guards; used by TargetsPage and the Todos SetTargetForm.
`SetTargetForm` is exported so the test can render it without standing up all of
TodosTab.
*Honest note:* the spec asked for a test typing `abc`. The field is
`type="number"`, so neither jsdom nor a browser ever holds `"abc"` — it
sanitises to `""` and the old code was already blocked by its blank check. That
test passes before AND after; it is labelled as such in the file. The reachable
junk is a **negative** value (`min="0"` is not enforced outside form
validation), and that test does fail against the old code.

**4 · REG-042(b,c) + REG-044 AddLeadModal.** Value strips before parsing; phone
requires ten digits for dialable channels only (mirroring the RPC's own branch,
so an Instagram handle is untouched). Six of the seven labels wrap their
control; Estimated Value uses `htmlFor`/`id` because the preset buttons share
its row and a wrapping label would enclose them — a deliberate deviation from
"wrap each control", for a smaller diff than restructuring that row.

**5 · REG-048.1 fresh UUID.** Both sites. CallExperience mints at mount (the
sheet mounts per open); ObjectionCapture mints on open (its sheet reopens within
one mount). Neither entry point has a busy guard, so the double-tap is real.

**6 · REG-036 todo toggle.** Guard added to `toggleTodo` with an
`expectedStatus` parameter; Today rolls back its optimistic paint on refusal;
TodosTab surfaces the denial and reloads. The audit's symptom (a double-tap
flipping back) does not exist and no test asserts it.

**7 · REG-043(2,3) actor guards.** RulesTab returns early instead of sending
`''`; GoLive returns early **and disables** the control, since the spec's
complaint was that it surfaced a failure instead of disabling.

**8 · REG-041 note operations.** ContextRail's delete reads its result; LeadDrawer
gained the error slot ContextRail's own `submitNote` already had.

**9 · REG-033 revert half-commit.** `revertTo` returns `partial:<code>` plus the
leg that failed; HistoryDrawer stops saying "nothing changed" over a row that
changed. Legs are **not** reordered — `pm_set_campaign_trigger` commits too, so
gate-first only moves the partial window.
*Spec conflict:* the lane spec says "Neither existing test flips" here and that
item 16 would be the only place a passing test must change. That is not
achievable: `manage-data.test.ts`'s collision case asserts the exact shape with
`toEqual`, so any change to the returned code breaks it. It is updated, and now
also asserts the campaigns update **did** happen — the fact the old shape hid.

**10 · REG-040 composer codes.** The refusal code is shown verbatim beside the
existing plain-language gloss. No refusal reason was reworded.
*Also fixed here:* my own new test initially mocked `supabase.from` as a bare
`vi.fn()`, so the snippet effect rejected and vitest reported 7 unhandled errors
while every assertion passed — the exact failure mode `src/test/setup.ts`
documents. Caught before commit; the suite is error-free.

**11 · REG-039 rename.** Button and prop both (`onRetryFailed` →
`onCopyToComposer`) — a misleading identifier is how the promise got made.
Thread.test.tsx's name matcher flips, as the spec intended.

**12 · REG-007 failure_reason.** Out of the bubble, into a data attribute so
support keeps it. This path had zero coverage (every fixture used `null`).

**13 · REG-001 routing.** One `useRolePath` hook beside `ROLE_HOME`; all call
sites wrapped; the three shells untouched. The rep `/crm` → `/leads` alias lives
in the hook, not at one call site, because ContextRail links `/crm` from the
Inbox, which reps also use.
*Found while testing:* four Dashboard KPI tiles build their destinations in an
object literal (`to: '/crm?tab=followups'`), which the audit's grep for `to="/`
never saw. Now prefixed.
Coverage is the hook's unit tests plus rendered-`href` assertions on Today (rep)
and Dashboard (manager) — not all three shells, because rendering them drags in
every lazy route and data hook; the hook tests cover the logic and the two
render tests cover the wiring.

**14 · REG-031 expired session.** Provider catches, classifies expired / failed /
genuinely-teamless; RoleRouter says which.
*DEVIATION:* the spec wants the guidance on the sign-in screen.
`src/auth/LoginPage.tsx` is on this lane's forbidden list, so the guidance is
rendered from RoleRouter and its button signs out, which lands on LoginPage.
Nothing forbidden was edited. If lane B wants the copy on LoginPage itself, the
provider already exposes `failure`.

**15 · batch.** Funnel guarded (`:242` was already correct — the audit's claim
about it is false and it is untouched). Playbook's retry copies its working
sibling; the owner report and dashboard remount their reads, because
`useMetrics` exposes no reload and `src/lib/metrics-data.ts` is not this lane's
file; ForecastWidget takes metrics as a prop and can refetch nothing itself, so
it renders a Retry only when given a real one. Bookings dates formatted, chips
labelled, **no SEED filter**. Today's ring hidden when there is nothing to
measure, aside labelled. Inbox pluralised, chip strip wrapped. Playbook tabs
wrapped. Objection header gated in compact mode. Dashboard h1 added.

**16 · REG-015 + REG-018.** Objection reason starts empty, re-seed effect
deleted, duplicate standalone `Log` button retired. `onObjection` stays on the
props type so `extension/app/App.tsx` (not this lane's file) needs no change —
which means the standalone CRM-source objection log is no longer reachable from
this panel. That is the retirement the spec asked for; flagging it because
decision 5 says never delete a feature, and this is the one place I removed a
reachable capability, on an explicit instruction.
Two assertions flip, as the spec predicted.

**17 · REG-037 + REG-026 + REG-017(CallHud).** Token id derived from the
payment's own identity (SHA-256 of client|lead|token|amount, shaped as a uuid)
so it survives a remount — a ref would not, and the remount is the whole defect.
Two devices confirming the same token now collide on the same id, which is the
behaviour you want. Seat-link reason is one legible line, `title` removed. Tap
targets at 44px.
The CallHud seat-link assertion did **not** need to flip: the new copy keeps the
phrase it matches.

**18 · REG-057 service worker. VERIFIED, not assumed.**
`registerType: 'prompt'`, a SKIP_WAITING handler in `src/sw.ts`, and a plain-DOM
prompt in `src/main.tsx` (plain DOM so the notice still appears if the app tree
is what failed to boot).
Verified end to end in a real browser with two real builds, served over
localhost — `docs/sessions/uxw01-stabilization/sw-update-verify.mjs`, which is
committed as evidence and is **not** part of `npm test` (it imports Playwright
by absolute path from a sibling repo, exactly the fragility trap 8 warns about).

```
with the fix     7/7 checks pass — v1 controls the tab; deploying v2 does NOT
                 swap it under the user; the notice appears; accepting it
                 delivers v2; no worker left in `waiting`
against 13a1d23  "the update notice appears" times out — the new worker parks in
                 `waiting`, onNeedRefresh is never called, the tab stays on v1
                 with no symptom
```

That second run is the part that matters: it is direct evidence the old
`autoUpdate` setting was inert, rather than a claim inherited from the spec.

## Not done / for someone else

- **`active` stays in `REVERTABLE.campaigns`.** A revert can still switch a
  campaign live. The spec's fix was to stop lying about it, which is done; the
  behaviour itself needs a `pm_revert_campaign` RPC (Phase 3).
- **A real `useMetrics` reload.** Two of the three dead retries are remounts
  because `src/lib/metrics-data.ts` belongs to no lane. A `reload` there would
  let both drop the remount wrapper.
- **`recordUsage`'s ids still die with the component.** Same remount weakness as
  the token had, much smaller consequence (a duplicate script-usage row, not a
  duplicate money fact). Left alone: out of scope, and worth a decision rather
  than a drive-by.
- **Manager and client-admin routing is unverified against a live account.** The
  role-prefix work is covered by deterministic tests only; the master doc records
  that no manager account exists.
