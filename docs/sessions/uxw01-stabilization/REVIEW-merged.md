# UXW01 pre-Phase-2 stabilization — independent confirmation review of merged main

Reviewer: independent confirmation pass. Base `13a1d23`, merged `1408a8b` (`main`).
Scope: `git diff 13a1d23..1408a8b`. Read order followed: `00-master-and-decisions.md`,
`HANDOFF-core.md`, `HANDOFF-ui.md`, `HANDOFF-ext.md`. Claims checked against code,
not taken on trust.

Rules observed: no source/test/config/workflow edit except temporary in-place
mutation reverts required by check B, each immediately restored with
`git checkout -- <file>`. No `git add/commit/push/merge/branch`. Nothing under
`docs/ui-review/` staged or touched (`git status` shows it still only as `??`).
Defects described with file and line, not fixed.

Diff scale: 113 files, ~4867 insertions, ~296 deletions (docs + src + extension).

---

## Confirmed (claims that held, with evidence)

### F — Gates (all run on merged `1408a8b`, exact output)

- `npx tsc -b` — silent, `EXIT:0`.
- `npm test` — `Test Files 117 passed (117)`, `Tests 823 passed (823)`,
  `Duration 97.29s`. Matches expected `117 files / 823 tests` exactly.
- `npm run build` — `✓ first-load JS: 173.6 KB gz (budget 200 KB)`,
  `precache 45 entries (1112.21 KiB)`, `✓ PWA installable assets present`.
  First-load matches expected `173.6 KB gz` exactly.
- `npm run check:no-service-role` — `✓ no service-role markers in src/ or extension/`, `EXIT:0`.
- `npm run check:tokens` — `✓ tokens.css matches recorded checksum`, `EXIT:0`.
- `npm run ext:build` — `✔ Built extension in 9.892 s`, `Σ Total size: 667.50 kB`,
  `✔ Finished in 10.4 s`. Matches expected `about 667.5 kB` exactly.

Hold-the-line note (difference, not failure): master policy is hold `171.8 KB gz` /
`1104.27 KiB` / `665 kB`. Merged prints `173.6 KB` (+1.8), `1112.21 KiB` (+7.94,
+2.23 vs lane-A `1109.98`), `667.50 kB` (+2.5 over the 665 ceiling). The 200 KB
script budget passes. Lane A already flagged its own +1.6 honestly
(`HANDOFF-core.md:26-40`); the merged tree adds ~0.2 more (skip links, h1,
scroll-lock). I did not trade fixes for bytes; reporting the breach as found.

### A — Feature preservation (only the one known removal)

Searched the full `src + extension` diff for every `-` line that deletes a
control, route, prop, button, label or capability. Classification:

- KNOWN FEATURE REMOVAL (disclosed, on explicit instruction):
  `extension/ui/OutcomeBar.tsx` — standalone `Log` button (`variant="secondary"`,
  `onClick={() => onObjection(objectionKey)}`, ~old lines 147-158) deleted, plus
  `onObjection` removed from destructuring (kept on the props type with a
  `REG-018` retirement comment). `HANDOFF-core.md:144-150` flags exactly this
  under decision 5 and says it retires the standalone CRM-source objection log
  from this panel. The replacement test asserts
  `queryByRole('button', { name: 'Log' })` is gone
  (`extension/ui/OutcomeBar.test.tsx`). This is the one place a reachable
  capability was removed, on an explicit spec instruction. Verdict: feature
  removal as claimed, honestly disclosed — Joyal's call whether the instruction
  should have overridden decision 5.
- DEFECT REMOVALS (allowed — bugs, problems, UI inconsistencies):
  - `src/views/inbox/Thread.tsx:186-197` (old) — raw `failure_reason` string out
    of the bubble into `data-failure-reason` (REG-007). Support keeps it, rep no
    longer reads Graph API text beside customer words.
  - `src/views/inbox/Thread.tsx` + `src/views/inbox/InboxScreen.tsx` —
    `onRetryFailed` → `onCopyToComposer`, `Tap to retry` → `Copy to composer`
    (REG-039). Rename only; handler still drops the bubble and seeds the
    composer. Joyal decision 2026-09-05 recorded in the code comment.
  - `extension/ui/CallHud.tsx:391,476` (old) — hover-only `title` + 11px subtle
    caption → one legible `text-xs text-fg-muted` line (REG-026). `title` never
    fires on touch.
  - `src/auth/LoginPage.tsx` — decorative `absolute inset-x-0 top-[34%]` hairline
    that struck through copy (REG-004).
  - `src/views/revenue/ForecastWidget.tsx`, `src/views/reports/OwnerBusinessReport.tsx`,
    `src/views/docs/Playbook.tsx` — dead `onRetry={() => undefined}` /
    `setPeriod(v => v)` no-op → real `onRetry` prop / remount / `library.reload`
    (REG-012). Conditional Retry (no button when no real retry) is the fix, not
    a removal.
  - `extension/ui/OutcomeBar.tsx` — `taxonomy[0]` pre-seed + re-seed `useEffect`
    → empty start (REG-015). Old code silently logged `price` for a rep who chose
    nothing; win-rate attribution is built on these keys.
  - `extension/ui/ConversationReview.tsx:89` (old) — `max-h-72 overflow-y-auto`
    on the message `<ul>` → single panel scroll (REG-022).
  - `extension/ui/FollowingChip.tsx` — `Following — open a chat` → state labels
    `Not following chats` / `Following <name>` / `Following — no chat open` /
    `Following — group not followed` behind optional `isGroup` (REG-025).
  - `extension/ui/TargetBar.tsx`, `extension/ui/SaveLeadCard.tsx` —
    `toLocaleString` outlier + `formatINRCompact` → one `formatMoney`; placeholder
    `₹60,000` → `₹60K` (REG-024).
  - `src/views/rep/Today.tsx` — `ProgressRing` hidden when `followUpsPlanned==0`,
    `aside` labelled (REG-003/051); `src/views/objections/ObjectionCapture.tsx` —
    empty `OBJECTION` header gated in compact mode (REG-006);
    `src/views/crm/BookingsTab.tsx` — raw ISO → formatted + `Booking …` /
    `Payment …` chips, `dateless` → `No date set` (REG-010);
    `src/views/inbox/InboxScreen.tsx` status chips + `src/views/docs/Playbook.tsx`
    tabs `no-scrollbar overflow-x-auto` → wrap (REG-002); `src/views/crm/CrmScreen.tsx`
    tab strip drops `no-scrollbar` (REG-002).
- PRESERVATION HOLDS:
  - `product_ai` Coming-soon door still present
    (`src/views/rep/screens.tsx:49-55` flag-gated `Door … to={rolePath('/more/product-ai')}`,
    `ProductAiDoor` `Coming soon` untouched). Grep for `product_ai|Coming soon`
    in the diff shows only the `rolePath` wrap, no copy/grant change.
  - `untested` chips untouched (`extension` diff touches no `WinRateChip` logic).
  - No SEED filter added (`src/views/crm/BookingsTab.tsx` has no filter;
    `BookingsTab.test.tsx:55-58` pins `SEED-001` visible with the comment that a
    filter would hide real rows).

No other control/route/prop/button/label/capability deletion found in the
`-/^[^-]/` sweep beyond the items above.

### B — Claim accuracy (5 mutation spot-checks, all held)

HANDOFF-core claims every fix was reverted in place and the new assertions
confirmed to fail. Spot-checked five, one file at a time, restored with
`git checkout -- <file>` (status clean after each; `?? docs/ui-review/…` only):

1. `src/views/manage/CampaignsTab.tsx:50` `if (major.trim() === '') return null`
   removed → `npx vitest run src/views/manage/CampaignsTab.spend.test.tsx`:
   `1 failed file, 3 failed | 3 passed (6)`. Empty-field Save disabled and
   `aria-invalid` assertions fail without the guard. Restored; re-run green.
2. `src/ui/Button.tsx:37,43` `type = 'button'` / `type={type}` removed →
   `src/ui/Button.test.tsx`: `1 failed | 1 passed (2)`,
   `expected type="button", received null`. Restored; green.
3. `src/ui/Sheet.tsx:21-28` scroll-lock `useEffect` removed →
   `src/ui/Sheet.test.tsx`: `1 failed (1)`,
   `expected "hidden", received "auto"`. Restored; green.
4. `src/views/dashboard/charts.tsx:115-119` funnel guard reverted to
   `Math.round((s.count / stages[i-1].count) * 100)` →
   `src/views/dashboard/charts.funnel.test.tsx`: `3 failed | 2 passed (5)`,
   `333%` reappears. Restored; green.
5. `src/views/crm/BookingsTab.tsx:21-27` `day()` reduced to identity →
   `src/views/crm/BookingsTab.test.tsx`: `1 failed | 4 passed (5)`,
   raw `/T00:00:00/` present. Restored; green.

Honest-note verification: `src/views/crm/SetTargetForm.test.tsx:41-43` carries
the exact honest note HANDOFF-core describes (number input sanitises `abc` to
`""`, that UI test passed before too; the reachable junk is the negative).
`src/lib/targets-data.test.ts:99-107` pins `parseMoney('abc')`/`'-1'` at unit
level. The disclosure is in the file, not just the handoff. No mutation claim
checked was refuted.

### C — Test honesty (no dishonest tests found)

- `rg '\.skip\(|\.todo\(|xit\(|xdescribe\(|describe\.skip|it\.skip|test\.skip' src extension --glob '*.test.*'`:
  no matches. No skipped or commented-out tests in the diff (remaining `skip`
  hits are `skipWaiting` in `src/sw.ts`/`vite.config.ts` comments and
  `skipped stage` prose in the funnel test, not test skips).
- No assertion weakened to force green. Two shape-assertions are disclosed with
  reasons: `BookingsTab.test.tsx:41-42` asserts `/^14 \w+ 2026 → 16 \w+ 2026$/`
  because the month abbreviation is ICU-dependent (`Sep` vs `Sept`); `Thread.test.tsx`
  matches the RAW reason by sliced regex to assert absence. Both honest.
- Flipped tests all carry `FLIPPED` comments naming the defect:
  `OutcomeBar.test.tsx` (2 flips, REG-015/018), `Thread.test.tsx` (REG-039 rename),
  `src/lib/manage-data.test.ts:354-389` (`collision` → `partial:collision` plus
  new `update happened` assertion — the fact the old shape hid, as HANDOFF-core
  discloses). These assert new correct behaviour, not weaker behaviour.
- The one dual-passing test (SetTargetForm `abc` UI case) is labelled as passing
  before and after in the file itself. Counted as disclosure, not coverage.

### E — Route prefixes (no bypass found)

- `rg 'to="/|navigate\(./|href="/' src/views src/ui src/shell src/auth` returns no
  output on merged main. All in-app links go through `useRolePath`:
  `Today.tsx:339,352,384,424`, `FollowUpsTab.tsx:134`, `LeadDrawer.tsx:182`,
  `LeadRow.tsx:207`, `LeadQuickActions.tsx:33`, `ContextRail.tsx:360`,
  `DashboardScreen.tsx:197,205` (including the four KPI object-literal `to:`
  values HANDOFF-core says the audit's grep missed), `Floor.tsx:122,149,159`,
  `rep/screens.tsx:36,46-48,50`, `NotificationCenter.tsx:100`,
  `AgentLauncher.tsx:19`, `LandingSection.tsx:80,85`, `ThreadHero.tsx:31`,
  `TopBar.tsx:72` (+ palette `go()`). `Floor.tsx:65` `to={to}` takes an already
  prefixed prop from `:149`/`:159` — safe.
- `href=` in `src/views|src/ui` is only external/descoped: `getWhatsAppUrl(…)`,
  thread attachment `url`, or `'#'`. No `href="/` in-app link remains.

### G — Secrets and PII (clean)

- `git diff` grep for `sk-|sbp_|eyJ|BEGIN.*PRIVATE|Bearer |service-role|api.key|secret|password`
  shows only policy prose (`Never edit …`, `No service-role credentials`,
  `check:no-service-role`) and no credential value. `check:no-service-role` green.
- Phone/PII grep shows only the task-blessed synthetic
  `+91 90000 11122` / `+919000011122` in `SaveLeadCard.test.tsx` + handoff prose,
  plus test fixtures (`Anjali Rao`, `Asha`, `919876543210`, `Call the Sharma
  family back`, `SEED-001`, placeholder `Rahul Sharma` which predates this diff).
  No real customer name, real phone, token, key, or message body added.
- `docs/ui-review/worldclass-01/phase2-discovery/` remains untracked (`??`), never
  staged — trap 1 observed.

### Other handoff claims verified while reading

- HANDOFF-core item 18 (SW `prompt` + `SKIP_WAITING` + plain-DOM notice) present in
  `vite.config.ts:23-31`, `src/sw.ts:17-27`, `src/main.tsx:9-62`. Runtime behaviour
  itself is in Unverifiable below.
- HANDOFF-core `active`-stays-revertable, `recordUsage` remount weakness, and
  `useMetrics`-has-no-reload remounts are all disclosed as Not-done and match the
  code (`REVERTABLE.campaigns` still contains `active`; `OwnerBusinessReport`
  remounts via `attempt`; `ForecastWidget` takes optional `onRetry`).
- HANDOFF-ui items 1-11 match the files listed (Button, Sheet, 7 contrast lines
  only, EditorView `main`→`section`, DialectEditor button moved with prompt
  byte-identical, 3 aside labels, 3 skip links + `id="main-content"`, ManagerShell
  flex row, CrmScreen strip, AgentScreen h1 + BoardView h3→h2, login divider).
  Item 12 (REG-008 NOT implemented) is accurate — see New findings.
- HANDOFF-ext per-task claims match owned files; the two skips (`Input.tsx`
  nonexistent, ScriptSheet Close in `src/ui/Sheet.tsx`) and two STOPPED wirings
  (Following `isGroup` caller, ConversationReview verbatim stamps) are as
  described. `CallHud.tsx:494` `toLocaleString` money noted as left-alone is
  still `amount.toLocaleString('en-IN')` in merged main (other-lane file at the
  time) — disclosure accurate.

---

## Refuted (claims that did not hold)

None for the claims spot-checked. All five mutation reverts failed as claimed;
all gate outputs matched the expected numbers; no test-honesty, locale, routing,
or secrets claim checked was refuted.

The expected numbers in the task (`117 / 823`, `173.6 KB gz`, `~667.5 kB`) were
observed exactly — see Confirmed/F. Lane-level numbers in the three handoffs
(`113/811`, `100/710`, `100/716`, `173.4`, `171.9`, `171.8`, `665.15`, `666.31`)
differ from merged main as an integration sum should; that evolution is not
counted as a refutation.

---

## New findings (defects/gaps still present in merged `1408a8b`, not introduced here)

1. [P2 — REG-008 still open] `src/shell/TopBar.tsx:104-113` — palette trigger
   still `hidden … lg:flex` (`Search or jump to…`, `⌘ K`); keyboard-only
   otherwise. HANDOFF-ui item 12 honestly reports NOT implemented (TopBar owned
   by lane A); lane A fixed palette routing/labels but not the trigger. Phones
   still have no palette affordance. Disposition said FIX-B; merged main does not
   contain it.
2. [P2 — REG-002 remnants] Three `no-scrollbar overflow-x-auto` strips remain
   with the exact pattern just fixed elsewhere:
   `src/views/crm/PipelineStrip.tsx:48` (pipeline by stage),
   `src/views/leads/LeadsScreen.tsx:260` (filter row),
   `src/views/inbox/InboxScreen.tsx:327` (scope + channel controls).
   HANDOFF-ui item 9 discloses stopping per the allowlist (rule 6) — known gap,
   not introduced. Inbox `:327` is in a FIX-A file and still clips.
3. [P2 — REG-017 remnant] `src/ui/Sheet.tsx:49-55` Close button
   (`px-2.5 py-1.5`, no `min-h-11`) is under 44px. HANDOFF-ext discloses leaving
   it (lane-A file). All other named targets were raised; this one was not.
4. [P3 — REG-025 caller wiring] `FollowingChip` accepts `isGroup` (default
   `false`) but no caller threads the chat kind (`extension/app/App.tsx`,
   `follow-chat.ts`, `wa-chat.ts` untouched per allowlist), so groups still read
   as `Following — no chat open`. Disclosed STOPPED in HANDOFF-ext; component
   correct, wiring pending.
5. [Policy — hold-the-line] `npm run build` prints `173.6 KB gz` vs `171.8`
   policy (+1.8), `45 entries / 1112.21 KiB` vs `1104.27` (+7.94),
   `ext:build 667.50 kB` vs `665` ceiling (+2.5). Script budgets (200 KB) pass;
   the hold-line does not. Lane A already called its +1.6 a breach; merged adds
   ~0.2 (skip links/h1/scroll-lock) and ~2.2 KiB precache.
6. [P0 behaviour still present, disclosed] `src/lib/manage-data.ts:687`
   `REVERTABLE.campaigns` still contains `active` — a revert can commit a live
   switch before the collision gate, now reported as `partial:<code>` instead of
   `nothing changed`. HANDOFF-core lists the real fix (`pm_revert_campaign` RPC)
   as Phase 3. Behaviour noted, not re-introduced.
7. [Low — TIME exception standing] `extension/ui/ConversationReview.tsx` stamps
   stay verbatim WhatsApp locale strings by design (`wa-chat.ts` forbids
   re-parsing; `formatClock` misparses DD/MM per HANDOFF-ext). Correct call, but
   extension time formats remain two-system (ISO → `formatClock`/`formatDay`,
   chat stamps verbatim). Not a defect to fix here; noted for Phase 2.

No new feature removal, no widened permission, no new write path/table, no new
runtime dependency, no `tokens.css`/`supabase.ts`/`gateway-key.ts`/workflow edit
found in the diff.

---

## Unverifiable (could not verify, with reason)

- Live manager / client-admin routing: no manager-role account exists (master
  Known blockers). `rolePath` logic + Today(rep)/Dashboard(manager) `href`
  assertions verified; all three shells rendering live not verified. Deterministic
  tests only.
- Live extension WhatsApp send loop: no safe chat exists. The 26/26 harness is
  layout-only; the WhatsApp DOM contract and send path are stubbed (master
  Known blockers). `ext:build` + unit tests verified; live loop not.
- SW update end-to-end: `docs/sessions/uxw01-stabilization/sw-update-verify.mjs`
  imports Playwright by absolute path from `~/Documents/hub-service` (trap 8).
  Not run here — a harness claim from this machine would be invalid per the
  master. Code shape (`prompt` + handler + notice) verified by reading; the
  `7/7 vs waiting-park` behaviour rests on the committed script's evidence.
- `pm_*` RPC signatures, `uq_playbook_gaps_one_open`, campaign column types:
  not in this repo (master Known blockers). Claims about them stay hypotheses.
- REG-049.5-.7: no SQL in this repo (deferred). Not verifiable here.
- Exhaustive mutation coverage: 5 of ~40 fixes spot-checked (all held). The
  remainder is taken on trust plus the honest `FLIPPED`/honest-note labelling,
  which read correctly where sampled. A truthful sample, not a census.
- Visual 390px proof (manager nav 12×44 scroll, palette, sheets, extension
  400px): no screenshots taken in this pass (lane D owns evidence;
  `ext-shots.mjs` never run per handoffs; `docs/ui-review` left untouched).
  Tailwind sizes read correctly; rendering not observed.
- Wall-clock/LCP/CLS and first-visit data latency: explicitly no-target per the
  performance policy; not measured.

---

## Files referenced (spot-check)

Master/handoffs: `docs/sessions/uxw01-stabilization/00-master-and-decisions.md`,
`HANDOFF-core.md`, `HANDOFF-ui.md`, `HANDOFF-ext.md`. Diff: `13a1d23..1408a8b`.
Tests reverted/restored for B: `CampaignsTab.tsx` / `CampaignsTab.spend.test.tsx`,
`Button.tsx` / `Button.test.tsx`, `Sheet.tsx` / `Sheet.test.tsx`, `charts.tsx` /
`charts.funnel.test.tsx`, `BookingsTab.tsx` / `BookingsTab.test.tsx`.
Grep surfaces for D/E/G as listed above; `git status` clean except pre-existing
`?? docs/sessions/UX-WORLDCLASS-01.md` and `?? docs/ui-review/…` (never staged).
