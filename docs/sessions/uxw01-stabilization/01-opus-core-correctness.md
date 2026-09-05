# Lane A — core correctness (Claude Opus 5, effort high)

Worktree: `/Users/joyaltitus/Documents/wt/uxw01-core`
Branch: `uxw01/core`, based on `13a1d23`. Dependencies already installed.
Runs in **parallel** with lanes B and C. You will never see their files.

Read `docs/sessions/uxw01-stabilization/00-master-and-decisions.md` first.

## Objective

Fix every defect where a wrong fix corrupts data, duplicates a write, escapes a
role wall, or lies to the operator. Test-first or regression-test-with-fix.
No visual redesign.

## Hard rule before you start

The audit at `docs/ui-review/worldclass-01/phase2-discovery/findings.md` has
been **independently re-verified and is wrong in twelve places**. The master doc
lists them. Trust the master doc, not the audit. Locate every construct by
**content**, not by the line number quoted — numbers may have moved.

Decision 5 from Joyal: **unwired or planned features are not defects.** If
something looks like a stub, leave it and report it. Never delete a feature.

## Files you own (allowlist)

Only these. Plus their co-located `*.test.ts(x)`.

```
src/shell/RoleRouter.tsx  src/shell/TopBar.tsx  src/shell/ClientProvider.tsx
src/lib/manage-data.ts  src/lib/todos-data.ts  src/lib/targets-data.ts
src/views/targets/TargetsPage.tsx
src/views/rep/Today.tsx  src/views/rep/screens.tsx
src/views/crm/TodosTab.tsx  src/views/crm/LeadDrawer.tsx
src/views/crm/FollowUpsTab.tsx  src/views/crm/AddLeadModal.tsx
src/views/crm/BookingsTab.tsx
src/views/leads/LeadRow.tsx  src/views/leads/LeadQuickActions.tsx
src/views/inbox/ContextRail.tsx  src/views/inbox/Composer.tsx
src/views/inbox/Thread.tsx  src/views/inbox/InboxScreen.tsx
src/views/manager/Floor.tsx
src/views/dashboard/DashboardScreen.tsx  src/views/dashboard/charts.tsx
src/views/reports/OwnerBusinessReport.tsx  src/views/revenue/ForecastWidget.tsx
src/views/docs/Playbook.tsx
src/ui/NotificationCenter.tsx  src/views/agent/AgentLauncher.tsx
src/views/landing/LandingSection.tsx  src/views/landing/ThreadHero.tsx
src/views/manage/CampaignsTab.tsx  src/views/manage/RulesTab.tsx
src/views/manage/GoLive.tsx  src/views/manage/HistoryDrawer.tsx
src/views/calls/CallExperience.tsx  src/views/objections/ObjectionCapture.tsx
extension/lib/outbox-store.ts
extension/ui/OutcomeBar.tsx  extension/ui/CallHud.tsx
vite.config.ts  src/sw.ts  src/main.tsx        (item 18 only)
```

## Files you must NOT touch

Another agent owns these **right now, in parallel**. Editing them causes a merge
conflict that destroys their work:

```
src/ui/Button.tsx  src/ui/Sheet.tsx  src/ui/EmptyState.tsx
src/shell/RepShell.tsx  src/shell/ManagerShell.tsx  src/shell/AdminShell.tsx
src/views/crm/PipelineStrip.tsx  src/views/crm/BoardView.tsx
src/views/crm/CrmScreen.tsx
src/views/docs/playbook/*        (ReadView, EditorView, DialectEditor, SettingsView)
src/auth/LoginPage.tsx  src/views/agent/AgentScreen.tsx
src/views/preview/PreviewGallery.tsx
extension/lib/outbox.ts          (see trap 2)
every extension/ui/* except OutcomeBar.tsx and CallHud.tsx
src/ui/tokens.css  src/lib/supabase.ts  src/lib/gateway-key.ts
.env*  .github/workflows/  .claude/
```

If you believe you need a forbidden file: **stop and report it.** Do not edit it.

## Work, in dependency order

### Tier 0 — smallest diffs, highest damage. Do these first.

**1. REG-035 — outbox deadlock.** `extension/lib/outbox-store.ts`, the
`update_follow_up` entry in `WRITE_REGISTRY`.
Current: `assertOk(result)`. Siblings `add_note` and `add_follow_up` pass
`assertOk(result, true)`. `updateFollowUp` returns `{ok:false, reason:'denied'}`
when the conditional `.eq('status', expectedStatus)` matches 0 rows. The entry's
`expected_status` is frozen at enqueue, so once the row moves past it **every
future replay is denied forever**, and `drain` returns at index 0 — every later
queued write is never attempted, on every reconnect, unboundedly.
Fix: treat `reason === 'denied'` as done **for `update_follow_up` only**. For a
conditional status transition, "no row matched" means someone already moved it.
`save_lead` / `log_outcome` must keep throwing.
**Do not modify `extension/lib/outbox.ts`** — `outbox.test.ts:60-69` asserts the
drain stops at the first failure and that is correct.
Test: in `extension/lib/outbox-store.test.ts`, mirror the existing `23505` test
(~`:41-47`): mock `updateFollowUp` returning `{ok:false, reason:'denied'}` and
assert `WRITE_REGISTRY.update_follow_up(entry)` **resolves**. Add a store-level
test that a denied entry followed by a note drains to `remaining: []`.
Keep `outbox-store.test.ts:60-65` ("does not swallow an ordinary first failure")
green.

**2. REG-049.1 — zero written over recorded spend.** `src/views/manage/CampaignsTab.tsx`,
function `toMinor`.
Current: `toMinor("")` computes `Number("")` = `0`, `isFinite(0)` true, `0 >= 0`
true, so it returns **`0`, never `null`**. `spendDirty` is then
`0 !== campaign.spend_minor`, which is **true whenever a real spend exists** —
clearing the input enables Save and writes zero over the recorded spend.
`aria-invalid={spendMinor === null}` never fires.
Fix: return `null` for an empty/whitespace input, matching `parseMoney` in
`src/views/targets/TargetsPage.tsx`.
Test: `toMinor('')` returns `null`; with a campaign whose `spend_minor` is
non-zero, clearing the field leaves Save disabled and fires no RPC.

**3. REG-043(1) + REG-050.3 — one money parser.** Hoist `parseMoney` out of
`src/views/targets/TargetsPage.tsx` into `src/lib/targets-data.ts` beside
`firstOfMonth`, export it, and use it in **both** `TargetsPage.tsx` and the
`SetTargetForm` save path in `src/views/crm/TodosTab.tsx`.
Current in TodosTab: `Number(targetValue) || 0` — `"abc"` passes `.trim()`,
becomes `NaN`, then `0`, and is upserted over a real target row via
`onConflict:'client_id,user_id,month'`. A typo silently zeroes a rep's target.
Do this **after** item 2 so both money paths converge on one helper.
Test: type `abc`, assert the upsert is not called and Save is disabled.

**4. REG-042(b,c) — junk leads.** `src/views/crm/AddLeadModal.tsx`.
(b) `estValue`: `"abc"` strips to `""`, `Number("")` is `0`, `isFinite(0)` is
true, so `estValue: 0` is persisted as a real valuation feeding forecast and
attribution. Send `null` when the stripped string is empty.
(c) phone gate is `.trim()` only. Verified against the one migration in this
repo (`supabase/migrations/20260818000000_create_manual_lead_rpc.sql`):
`"abc"` strips to `""` and the RPC **raises**; `"+91"` strips to `"91"`, passes
the empty check, and **mints a permanent junk contact** that every future
`+91…` identity collides with via the unique `(client_id, channel, external_id)`
index. Require at least 10 digits after stripping for `phone`/`whatsapp`.
Both changes live in one function, before `setBusy`.
Also do **REG-044** here since you own the file: each of the 7 controls has a
`<label>` that is a *sibling* with no `htmlFor`/`id`/wrap/aria. Wrap each control
inside its `<label>` — smallest diff, no ids needed.
Test: `+91` blocks submit with an error and calls no RPC; `abc` in value sends
`estValue: null`; each of the 7 controls is reachable by `getByLabelText`.

### Tier 1

**5. REG-048.1 — fresh UUID defeats the upsert.** Two sites, same defect:
`src/views/calls/CallExperience.tsx` and **`src/views/objections/ObjectionCapture.tsx`**
(the second was never filed by the audit). Both mint `crypto.randomUUID()` inside
the handler, so every invocation defeats `startCallSession`'s
`onConflict:'client_id,client_request_id'` upsert and forks `call_sessions`.
The correct pattern is in `extension/app/App.tsx` — `clientRequestId:
callRequestId.current`, a `useRef` minted once per open panel and reset on close.
Fix both together.
Test: call the begin path twice, assert the same `clientRequestId` both times.

**6. REG-036 — todo toggle.** The audit's symptom is wrong: a rapid double-tap
reads the same stale status and writes the same value twice, so it does **not**
flip back. The real defects:
(a) `src/views/rep/Today.tsx` fires `void toggleTodo(...)` after an optimistic
`setLocal` and **never reads the result** — a denied write leaves the rep looking
at "done" forever. Roll back `setLocal` when `!res.ok`.
(b) `src/views/crm/TodosTab.tsx` does `if (res.ok) void reload()` with no else —
surface the failure.
(c) `src/lib/todos-data.ts` `toggleTodo` has no conditional guard, unlike
`updateFollowUp` in `src/lib/crm-actions.ts` 15 lines away. Add an
`expectedStatus` parameter and `.eq('status', expectedStatus)`. Both callers
already know the expected value. One guard, two callers, one commit.
Test: new `src/lib/todos-data.test.ts` asserting the chain includes
`.eq('status','pending')` and that `{data: [], error: null}` yields
`{ok:false, reason:'denied'}`; plus a Today test that a denied response does not
leave the row rendered as done.

**7. REG-043(2,3) — missing user guards.** `src/views/manage/RulesTab.tsx` sends
`p_auth_user_id: ''` when logged out; `src/views/manage/GoLive.tsx` sends `null`
and surfaces a generic failure instead of disabling the control. Add
`if (!userId) return`, copied verbatim from the guard already in
`CampaignsTab.tsx`.

**8. REG-041 — denied note operations.** `src/views/inbox/ContextRail.tsx`
discards the `WriteResult` from `deleteNote` and reloads immediately, so the row
flickers out and back with no explanation. `src/views/crm/LeadDrawer.tsx`
`submitNote` has no `else` and no error state. The correct pattern is
**ContextRail's own** `submitNote`, which already has `noteErr`. Copy it into
LeadDrawer and read the result in the delete path.

### Tier 2 — copy and contract. After Tier 1 settles error shapes.

**9. REG-033 — campaign revert half-commit.** `src/lib/manage-data.ts` `revertTo`.
The table `update(patch)` **commits**, then `setCampaignTrigger` may refuse, then
`setCampaignSpend`. Three commits, no transaction.
**Do not reorder the legs.** `pm_set_campaign_trigger` also commits, so gate-first
only moves the partial window; it cannot remove it, and the RPC's SQL is not in
this repo. Worse: `active` is in `REVERTABLE.campaigns`, so a revert can switch a
campaign **live** carrying the current trigger.
Fix: stop lying. Return a distinguishable code (e.g. `partial:<code>`) when the
table leg committed and a later leg refused, and add a branch in
`src/views/manage/HistoryDrawer.tsx` — it currently renders the words
"the restore was refused, nothing changed" while the row is already half-restored.
Say the row was restored but the code word was refused, and that the campaign is
half-restored.
Test: reuse the existing collision fixture in `src/lib/manage-data.test.ts`
(~`:354`), assert the `campaigns` update **did** happen and the code is the
partial one; add a HistoryDrawer test asserting the alert does not say
"nothing changed" for a partial code. Neither existing test flips.
Full atomicity needs a `pm_revert_campaign` RPC — Phase 3, out of scope.

**10. REG-040 — Composer swallows error codes.** `src/views/inbox/Composer.tsx`
`explain(kind, ...)` switches on `kind` only and discards `res.code`, so
`window_closed`, `params_mismatch` and `opted_out` all render one generic line.
`src/lib/api.ts` states hub-service is the authority on why a write was refused.
Reuse the `Failure` shape from `src/views/team/TeamPage.tsx` — verbatim code plus
a gloss. Do not invent new wording for a refusal reason.
Test: `it.each` over the code list asserting the alert contains the code.

**11. REG-039 — "Tap to retry" never retries.** `src/views/inbox/Thread.tsx`
promises retry; `src/views/inbox/InboxScreen.tsx` deletes the failed bubble and
seeds a draft, never calling `sendAgentMessage`.
**Decision (Joyal, 2026-09-05): rename, do not implement resend.** A real resend
re-enters the send path from a screen owning no `sending` state — a new race on a
P1. Rename the button to `Copy to composer`.
This **flips** `src/views/inbox/Thread.test.tsx` around `:150` — its
`getByRole` name matcher. Update it; that flip is intended.

**12. REG-007 — raw backend error in the thread.** `src/views/inbox/Thread.tsx`
renders `message.failure_reason` verbatim in two places, which is how a Graph API
string reached a customer-facing bubble. Sanitize: show human recovery copy, keep
the raw reason out of the bubble. Every existing `Thread.test.tsx` fixture uses
`failure_reason: null`, so this path is untested — add the test.

### Tier 3 — data honesty and navigation

**13. REG-001 — the big one. 28 root-absolute links escape the role shells.**
`RoleRouter` mounts shells at `admin/*`, `manage/*`, `rep/*`; only the shells
prefix, via three duplicate private `href()` helpers. Every shared CTA builds a
root-absolute URL, falls through to `<Route path="*">` and lands on role home.
Fix: add one hook beside the existing `ROLE_HOME` export in
`src/shell/RoleRouter.tsx`, reading `activeClient.role` via `useClient()` and
returning a prefixer. Then wrap the call sites.
Relative links are **not** an option: each shell owns a nested bare `<Routes>`,
so from `/rep/leads` a relative `to="inbox"` resolves to `/rep/leads/inbox`.
Two things a prefix alone does not fix — handle both:
- `src/views/rep/Today.tsx` links to `/crm?tab=todos`; **RepShell mounts CRM at
  `leads`**, so the rep needs `/leads?tab=todos`.
- `src/shell/TopBar.tsx` has one destination list shared by manager and admin
  (REG-014): admin sees "Floor" which lands on Health. Give admin its own labels
  matching its shell. Do this in the same pass — same array.
You may **not** edit the three shells. Leave their private `href()` helpers
alone; the hook is additive.
Test: render each shell at its base and assert every rendered `<a href>` starts
with that shell's base. One assertion covers all 28 sites. Nothing existing flips
(`RoleRouter.test.tsx`'s `*`-to-home assertion stays correct).

**14. REG-031 — expired session.** `src/shell/ClientProvider.tsx` membership
fetch has **no `.catch()`** and no 401 branch.
Two distinct defects, both real:
(a) a rejected promise leaves `loading` true forever — the blank page.
(b) a clean 401 resolves `{data:null, error}`, sets `clients: []`, and
`RoleRouter` renders **"No workspace yet — your login isn't attached to a team"**,
which misdiagnoses an expired session as a permissions problem.
Fix: catch, detect 401, clear the session, and land on the sign-in screen with
"session expired" guidance. Do not widen any permission.
Test: expired-token harness asserts LoginPage plus the guidance, not the
"no workspace" empty state.

**15. REG-011 / REG-012 / REG-010 / REG-003 / REG-005 / REG-006 / REG-002.**
- `src/views/dashboard/charts.tsx`: step conversion divides by the previous
  stage with no zero-guard and no cap, so skipped stages render 333%. Fix that
  one expression. **`:242` already has `Math.max(...,1)`** — the audit's claim
  about `:243` is false; leave it.
- Three dead retries, same shape: `src/views/reports/OwnerBusinessReport.tsx`
  (`setPeriod(v => v)` — React bails on identical state), and
  `onRetry={() => undefined}` in `src/views/revenue/ForecastWidget.tsx` and
  `src/views/docs/Playbook.tsx`. Playbook has a working sibling a few lines below
  (`onRetry={library.reload}`) — copy it.
- `src/views/crm/BookingsTab.tsx`: raw ISO timestamps rendered verbatim and
  contradictory `confirmed` + `pending` chips on the same row. Format dates like
  `FollowUpsTab` does, and make the status coherent. **Do not filter `SEED-*`
  rows** — they are demo data, and a filter would hide real rows in production.
- `src/views/rep/Today.tsx`: the ring is bound to follow-ups, not the monthly
  target, so a zero denominator renders "0% today" beside "No target set".
  Render no ring when there is nothing to measure. Also label its `<aside>`
  (REG-051) — it is the second unlabeled complementary on `/rep`.
- `src/views/inbox/InboxScreen.tsx`: "1 conversations in view" needs
  pluralization (`Today.tsx` already does this correctly — copy it); the status
  chip strip clips the 5th chip to "A" at 1440 with `no-scrollbar` removing the
  affordance — give it an affordance (fade, wrap, or overflow control).
- `src/views/objections/ObjectionCapture.tsx`: the compact "Objection" caps
  header renders unconditionally above the composer even with no objection.
  Render it only when there is something to show.
- `src/views/docs/Playbook.tsx`: the tab strip cuts "Settin…" mid-word at 390
  with no fade. Same affordance fix.
- `src/views/dashboard/DashboardScreen.tsx`: no `<h1>` at all. Add one.

**16. REG-015 + REG-018 (objection half) — extension.**
`extension/ui/OutcomeBar.tsx` seeds `useState(taxonomy[0]?.key ?? '')` **and**
has a `useEffect` that re-seeds it whenever it becomes empty — including right
after the log path clears it. So the `Objection type…` placeholder is
unreachable and a rep who taps `Objection` logs "Too expensive" with no action,
corrupting win-rate attribution.
Fix: start empty **and delete the re-seed effect**. The `Log` button guard
already exists; it is currently neutered.
Retire the duplicate objection path in the same pass — the grid `Objection`
button and the select+`Log` pair both log.
**This flips two existing assertions** in `extension/ui/OutcomeBar.test.tsx`:
the "defaults to the first objection taxonomy" test and its `toBeEnabled()`
expectation, plus a taxonomy array assertion. Rewrite both to pin the new
correct behaviour. This is the only place in your lane where a passing test must
change.

**17. REG-037 + REG-026 + REG-017(CallHud) — `extension/ui/CallHud.tsx`.**
- The token double-tap is **already guarded** (state set before await, button
  conditionally unmounted). The real vector is a **remount**: `tokenDone` is
  component-local, so reopening the panel for the same lead restores the button
  and a second confirm mints a fresh UUID and a second money fact. Derive the
  token id from stable data, exactly as `recordUsage` in the same file already
  does with its `usageIds` ref.
- Seat-link: disabled button plus an 11px caption, with the explanation only in
  a `title` that never fires on touch. Make the reason visible inline.
- Tap targets in this file are 28-36px; bring the interactive rows to at least
  44px. You own this file, so its tap targets are yours.
Test: render, confirm token, **unmount, remount**, confirm again — assert both
calls carried the same id.

### Tier 4 — do last, and only if the rest is green

**18. REG-057 — the service worker does not actually auto-update.**
`vite.config.ts` sets `registerType: 'autoUpdate'`, but with
`strategies: 'injectManifest'` and a hand-written `src/sw.ts` that calls neither
`self.skipWaiting()` nor `clientsClaim()`, a new worker parks in `waiting` and
the register module's `activated` listener never fires. `onNeedRefresh` is never
called in autoUpdate mode at all. So today's build only swaps when every tab of
the origin closes — the comment in `src/main.tsx` is optimistic.
This matters: Joyal ships to real clients next month and a stale tab after a
deploy is a live hazard.
Fix requires all three, together: `registerType` to `'prompt'`; a `message`
listener in `src/sw.ts` calling `self.skipWaiting()` on `{type:'SKIP_WAITING'}`;
and `onNeedRefresh` wired to a toast whose action calls the returned
`updateSW()`. `virtual:pwa-register` is already imported in `src/main.tsx` and
`workbox-window` already ships — **no new dependency**.
If you cannot verify this end to end, **revert it entirely and report Blocked.**
A half-done SW change strands every user on a stale build with no symptom.

## Gates — all must pass before you commit

```
npx tsc -b
npm test
npm run build
npm run check:no-service-role
npm run check:tokens
npm run ext:build
```

Expected: tsc silent; vitest all files pass (the suite is flaky under load — if a
handful time out, re-run those files alone before calling it a regression);
build prints `first-load JS: <=171.8 KB gz (budget 200 KB)` and the PWA line;
the two checks print a checkmark; `ext:build` completes near 665 kB.

## Commit and PR

Commit in the tier groups above so a revert can target one group. Stage explicit
paths — **never stage the whole tree** (untracked PII screenshots live in
`docs/ui-review/worldclass-01/phase2-discovery/`).

Push `uxw01/core`. **Do not open a PR and do not merge** — lane D integrates all
three branches into `uxw01/stabilization` and opens a single PR for Joyal.

## Handoff

Append to `docs/sessions/uxw01-stabilization/HANDOFF-core.md`: per item, what you
changed, which tests you added, which existing assertions you flipped and why,
anything you deferred, and anything you found that the master doc does not list.

## Checklist — survives compaction

- [ ] 1 REG-035 outbox denied-is-done (outbox.ts untouched)
- [ ] 2 REG-049.1 toMinor returns null for empty
- [ ] 3 REG-043(1) parseMoney hoisted, used in both places
- [ ] 4 REG-042(b,c) + REG-044 AddLeadModal
- [ ] 5 REG-048.1 both UUID sites
- [ ] 6 REG-036 todo guard + both callers surface result
- [ ] 7 REG-043(2,3) userId guards
- [ ] 8 REG-041 note errors surfaced
- [ ] 9 REG-033 partial code + HistoryDrawer copy
- [ ] 10 REG-040 error codes surfaced
- [ ] 11 REG-039 rename + flip Thread test
- [ ] 12 REG-007 sanitize failure_reason
- [ ] 13 REG-001 hook + 28 sites + /leads fix + REG-014 labels
- [ ] 14 REG-031 catch + 401 + session-expired copy
- [ ] 15 REG-011/012/010/003/005/006/002/054 batch
- [ ] 16 REG-015 + objection path (2 tests flipped)
- [ ] 17 REG-037 remount id + REG-026 + CallHud tap targets
- [ ] 18 REG-057 SW update (or reverted + Blocked)
- [ ] all six gates green
- [ ] committed in tier groups, branch pushed, HANDOFF written

**Do not stop at the first green test.** Complete the whole checklist.
