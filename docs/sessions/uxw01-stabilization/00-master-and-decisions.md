# UXW01 — pre-Phase-2 stabilization: master plan and decisions

Written 2026-09-05 by the Opus planning session. Base commit `13a1d23`
(= `origin/main` = `origin/production`). Production: https://sales-app-joyal.zeabur.app

## Objective

Ship a stable production release before the broader Phase 2 design pass.
Fix confirmed, bounded defects and safety problems only. No redesign.

Context from Joyal (2026-09-05): the app goes live with **real clients next
month**. Everything in the tenant today is demo/test data.

## Decisions (frozen 2026-09-05)

1. Rep and manager experiences must be mobile-friendly.
2. Client-admin is a laptop/desktop workflow. No 390px redesign for admin.
3. REG-009 (admin 15-item mobile nav) is an **accepted non-goal**.
4. A shared component used by rep or manager must still be mobile-correct.
5. **Unwired/planned features are NOT defects.** If a screen, door, chip or
   label represents a feature Joyal planned but has not built yet, leave it
   exactly as it is. Only fix actual bugs and UI inconsistencies. When in
   doubt, leave it and report it — do not delete.
6. Live writes in the Vidya Sagar demo tenant are **permitted** (demo data).
7. No external customer communication without an explicit named recipient.
8. Agents open PRs. Joyal reviews and merges.
9. Muse Spark 1.3 (free) does everything reducible to a precise frozen spec.
   Opus owns architecture, data integrity, authorization, session handling,
   idempotency, external-send safety, and ambiguous multi-step writes.

### Consequences of decision 5

- **REG-030** (`product_ai` "Coming soon" door): **NOT A DEFECT.** It is a
  planned feature behind a `feature_grants` flag. Do not remove it, do not
  revoke the grant, do not change the copy.
- **REG-020** (extension `untested` script chips): **NOT A DEFECT.** Documented,
  unit-tested intentional copy.
- **REG-010** `SEED-*` booking rows: the rows are demo data, not a code bug.
  Fix only the raw-ISO date rendering and the contradictory status chips.
  Do **not** add a seed filter — it would hide real rows in production.

## Verification changed the backlog

The audit was re-verified against current source by three read-only agents.
**Three of the seven P0s do not exist.** Fixing them would have been wasted
work plus regression tests that pass today.

| ID | Audit claim | Verified reality |
|---|---|---|
| REG-034 | Broadcast double-tap duplicates | **REFUTED.** `src/ui/Button.tsx:44` is `disabled={disabled \|\| loading}` + `disabled:pointer-events-none`. `loading={busy}` already disables. |
| REG-038 | Double-Enter double-sends | **REFUTED.** React 18 flushes discrete keydown synchronously *and* `setText('')` empties the second handler's body. Two independent guards. |
| REG-037 | Token double-tap mints duplicates | **REFUTED at the tap.** Button is conditionally unmounted. Real vector is a component **remount**. |
| REG-036 | Double-toggle flips back to pending | **SYMPTOM WRONG.** Stale read makes rapid double-tap idempotent. Real defects: fire-and-forget write in `Today.tsx` + swallowed denial in `TodosTab.tsx`. |
| REG-011 | `charts.tsx:243` NaN% | **HALF FALSE.** `:242` already has `Math.max(...,1)`. Only `:115` is real. |
| REG-042(a) | `Number("e")` to PostgREST 400 | **DOWNGRADE.** Input is `type="number"` so `"e"` arrives `''`; and `JSON.stringify(NaN)` is `"null"`. Silent NULL, not a 400. |
| REG-049.3 | ProfileTab dirty-forever | **REFUTED.** `ProfileTab.tsx:87` normalises both sides with `?? ''`. |
| REG-050.1 | Invite accepts `not-an-email` | **REFUTED in a browser.** `type="email"` + `type="submit"` + no `noValidate`. **jsdom does not implement constraint validation — a unit test would "prove" the audit and be wrong.** |
| REG-050.2 | Denied assign keeps rejected value | **REFUTED.** Controlled select bound to the server prop. |
| REG-048.4/.5/.6 | Missing busy guards | **REFUTED.** All three already carry `disabled={busy}`. Test gaps only. |
| REG-047 | 6x banner dilution | **DOES NOT REPRODUCE.** Those `<header>`s are inside `<section>` so they map to `generic`, not `banner`. |
| REG-047 | `/preview` 10 h1s | **NOT A DEFECT.** PreviewGallery has one `h1`; the rest come from mounting real screens as specimens. Do not touch it. |

### Found by verification, missed by the audit

| New | Where | Severity |
|---|---|---|
| **`toMinor("")` returns `0`, never `null`** | `src/views/manage/CampaignsTab.tsx:43` | **P0 — destructive.** Clearing the spend field makes `spendDirty` true and **writes 0 over a recorded campaign spend**. Filed by the audit as a harmless "dead button". |
| **`active` is in `REVERTABLE.campaigns`** | `src/lib/manage-data.ts:687` | Raises REG-033: a revert can switch a campaign **live** before the collision gate runs, while the UI says "nothing changed". |
| **Same fresh-UUID upsert defect** | `src/views/objections/ObjectionCapture.tsx:199` | Twin of `CallExperience.tsx:86`. Never filed. |
| **Rep link points at a route that does not exist** | `src/views/rep/Today.tsx:378` to `/crm?tab=todos` | RepShell mounts CRM at `leads`. Prefixing alone still lands on home. |
| **`registerType:'autoUpdate'` is inert** | `vite.config.ts:23` + `src/sw.ts` | SW calls neither `skipWaiting()` nor `clientsClaim()`; a new worker parks in `waiting`. Auto-update only happens when every tab closes. |
| **`ManagerShell` nav wraps** | `src/shell/ManagerShell.tsx:144` | `grid-cols-10` holding 12 rail items. **In scope** — manager must be mobile-correct (decision 1). |

### Revised P0 set: 4

`REG-001` routing · `REG-033` revert half-commit (incl. `active`) ·
`REG-035` outbox deadlock · `REG-049.1` zero-over-recorded-spend.

## Lanes

Three parallel git worktrees, disjoint by **whole file**. No file appears in
two lanes. A fourth lane integrates, sequentially, after the first three.

| Lane | Model | Worktree | Branch |
|---|---|---|---|
| A core | Claude Opus 5, effort high | `/Users/joyaltitus/Documents/wt/uxw01-core` | `uxw01/core` |
| B ui | Muse Spark 1.3, xhigh | `/Users/joyaltitus/Documents/wt/uxw01-ui` | `uxw01/ui` |
| C ext | Muse Spark 1.3, xhigh | `/Users/joyaltitus/Documents/wt/uxw01-ext` | `uxw01/ext` |
| D final | Muse Spark 1.3, xhigh | main checkout | `uxw01/stabilization` |

Ownership rule: **where a file carries items from two lanes, the lane owning
the riskier item takes the whole file.** This pushes some mechanical UI work
into lane A. That is deliberate — it buys guaranteed non-collision.

## Disposition table

`FIX-A` = Opus core · `FIX-B` = Muse UI · `FIX-C` = Muse ext ·
`FIX-D` = Muse final · `DEFER-2` = Phase 2 · `NOT-DEFECT` = closed.

| REG | Title | Sev | Disposition |
|---|---|---|---|
| 001 | Unprefixed links escape role shells (28 sites) | P0 | FIX-A |
| 002 | Tab strips clip with no affordance | P2 | FIX-A (Inbox, Playbook), FIX-B (CRM) |
| 003 | 0% ring with no target | P3 | FIX-A |
| 004 | Login divider strikes text | P2 | FIX-B |
| 005 | "1 conversations" plural | P3 | FIX-A |
| 006 | Empty OBJECTION header | P2 | FIX-A |
| 007 | Raw backend error in thread | P1 | FIX-A |
| 008 | Palette unreachable on phone | P2 | FIX-B |
| 009 | Admin mobile nav 15 items | — | **ACCEPTED NON-GOAL** |
| 010 | Bookings raw ISO + contradictory chips | P2 | FIX-A (format only; SEED rows are data) |
| 011 | Funnel 333% | P1 | FIX-A (`:115` only) |
| 012 | Dead retry x3 | P1 | FIX-A |
| 013 | Health all-clear density | P3 | DEFER-2 (subjective) |
| 014 | Palette labels ignore role | P3 | FIX-A |
| 015 | Extension pre-selects first objection | P1 | FIX-A (flips 2 tests) |
| 016 | Numeric chat name seeds Name field | P1 | FIX-C |
| 017 | Extension tap targets under 44px | P2 | FIX-C (FIX-A for CallHud) |
| 018 | Dual callback/objection paths | P2 | FIX-A (objection half with 015); callback half DEFER-2 |
| 019 | Note buried below Follow-up | P3 | DEFER-2 (subjective ordering) |
| 020 | Extension `untested` chips | — | **NOT-DEFECT** (planned/intentional) |
| 021 | CRM search unfiltered | P3 | NOT-DEFECT (deliberate server-search branch) |
| 022 | Nested scroll traps Save | P2 | FIX-C |
| 023 | Rebuttal preview cuts close | P3 | FIX-C |
| 024 | Time/money formats disagree | P3 | FIX-C |
| 025 | Following switch mislabeled | P3 | FIX-C |
| 026 | Seat-link dead with faint caption | P2 | FIX-A (CallHud) |
| 027 | Library shows raw `{{name}}` | P3 | FIX-C |
| 028 | Terminology drift | P3 | DEFER-2 |
| 029 | ~99 buttons without `type` | P2 | FIX-B (one line in `Button.tsx`) |
| 030 | `product_ai` Coming soon | — | **NOT-DEFECT** (planned feature) |
| 031 | Rejected session blank / wrong copy | P1 | FIX-A |
| 032 | lead-card dash | — | **NOT A DEFECT** (documented intent) |
| 033 | Campaign revert half-commits | P0 | FIX-A |
| 034 | Broadcast double-tap | — | **NOT-DEFECT** (refuted) |
| 035 | Outbox replay deadlock | P0 | FIX-A |
| 036 | Todo toggle unguarded | P1 | FIX-A (reframed) |
| 037 | Extension token duplicate | P2 | FIX-A (remount vector only) |
| 038 | Composer double-send | — | NOT-DEFECT as a race; contract item DEFER-2 |
| 039 | "Tap to retry" never retries | P1 | FIX-A (rename) |
| 040 | Composer swallows error codes | P1 | FIX-A |
| 041 | Denied note ops fail silently | P1 | FIX-A |
| 042 | Lead value/phone coercion | P1 | FIX-A (b,c); (a) DEFER-2 |
| 043 | Null/empty to 0 or empty string | P1 | FIX-A |
| 044 | Add-lead labels unassociated | P1 | FIX-A (owns the file) |
| 045 | Sheets no scroll lock | P1 | FIX-B |
| 046 | Board cards nested-interactive | P2 | DEFER-2 (architectural) |
| 047 | No skip link, no contentinfo | P2 | FIX-B (skip link); banner claim dropped |
| 048 | Busy/dedupe batch | P2 | FIX-A (.1 only; .4/.5/.6 refuted) |
| 049 | Denied-write/contract batch | P2 | FIX-A (.1, .2); .3 refuted; .5-.7 unverifiable |
| 050 | Validation niceties | P3 | FIX-A (.3 with 043); .1/.2 refuted |
| 051 | Duplicate unlabeled asides | P2 | FIX-A + FIX-B (each in own files) |
| 052 | Small muted text fails AA | P2 | FIX-B (7 exact lines) |
| 053 | Sheet focus containment | P2 | **DEFER-2** (needs design; 13+ consumers) |
| 054 | Heading-order skips | P3 | FIX-A + FIX-B (own files) |
| 055 | Nested `<main>` on Editor | P2 | FIX-B |
| 056 | Dialect tablist + window.prompt | P2 | FIX-B (move button out); prompt-to-form DEFER-2 |
| 057 | No SW update affordance | P2 | FIX-A (last item; revert if unverifiable) |

## Traps — copy into every lane spec

1. **Never stage the whole tree.** `docs/ui-review/worldclass-01/phase2-discovery/`
   is untracked, **not gitignored**, and holds 94 screenshots including one with
   a full `+91` number. Staging everything puts PII in git history irreversibly.
   Always `git add` explicit paths.
2. **Do not touch `extension/lib/outbox.ts`.** `outbox.test.ts:60-69` asserts
   the drain stops at the first failure. That behaviour is correct.
3. **Do not "fix" the Team invite email guard.** jsdom lacks constraint
   validation; a test would confirm a bug that production does not have.
4. **Do not sweep `text-fg-subtle`.** `BoardView.tsx:205,209` use the same
   classes on `bg-surface` and already pass at 4.83:1.
5. **Never edit `src/ui/tokens.css`** — checksum-guarded by CI.
6. **Do not edit `src/ui/EmptyState.tsx`** — shared; a heading-level change
   breaks order elsewhere.
7. **Do not touch `src/views/preview/PreviewGallery.tsx`.**
8. `scripts/ext-shots.mjs:17` imports Playwright by **absolute path** from
   `~/Documents/hub-service/node_modules`. Never claim harness results from a
   machine where that import fails.

## Non-negotiable constraints

Never edit: `src/ui/tokens.css`, `src/lib/supabase.ts`, `src/lib/gateway-key.ts`,
`.env*`, `.github/workflows/`, `.claude/`, `scripts/campaign*`,
`scripts/orchestrator.sh`, `scripts/harness-conformance.sh`.

No service-role credentials. No widening of role permissions. No new write path
or table. Writes stay on existing RLS-safe / RPC / hub-service contracts.
No new web runtime dependencies. Never force-push. Never bypass git hooks.
No destructive reset or clean. No broad refactor or formatting sweep. Every bug
fix gets a focused regression test. Preserve Phase 1 honest empty states and the
existing design identity.

## Performance policy

Hold-the-line only. There is **no evidence of an application-side regression** —
every bad number in `performance.md` is single-sample and backend-bound, and one
run shows cold faster than warm (a broken measurement). Requirement:
`npm run build` passes, first-load JS **at or below 171.8 KB gz** (hold the
achieved number, do not spend Phase 1's 28 KB of headroom), PWA at or below
45 entries / 1104.27 KiB, `ext:build` at or below 665 kB.
**No wall-clock, LCP or CLS targets.** Do not attempt to fix first-visit data
latency — it is unattributed and likely backend-bound.

## Definition of done

`npx tsc -b` · `npm test` · `npm run build` · `npm run check:no-service-role` ·
`npm run check:tokens` · `npm run ext:build` all green in each lane, and again
on the integration branch. Role walls intact. No fabricated data. Raw PII
screenshots uncommitted. One PR for Joyal to review and merge.

## Deferred to Phase 2

REG-013, 019, 028, 038 (contract), 042(a), 046, 053, 056 (inline form),
018 (callback half), plus the audit's unconfirmed source-risk candidates
R01-R24. Also deferred: manager live coverage (no manager account exists),
live extension WhatsApp loop (no safe chat), REG-049.5-.7 (no SQL in this repo).

## Known blockers

- No manager-role account exists. Manager work is verified by deterministic
  tests and Playwright fixtures, never by a live manager session.
- The live extension WhatsApp send loop cannot be verified. The 26/26
  deterministic harness covers layout only; the WhatsApp DOM contract and the
  send path are stubbed.
- `pm_*` RPC signatures, `uq_playbook_gaps_one_open`, and campaign column types
  are not in this repo. Claims about them stay hypotheses.
