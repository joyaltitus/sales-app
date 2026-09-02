## C3 — sales-app: manage view, attribution, manager Approvals, rep scoping

**Wave 3 continuation.** Picks up what C1 (#54) and C2-small (#55) left. Requires **A**, **B**, **D** merged and hub deployed — all three already are.

**Goal.** A client_admin can run the whole configuration surface (products, FAQs, profile, objection replies, campaigns) with every edit revisioned and revertible; a manager can clear approvals and read attribution; a rep sees only their own queue. Nothing enforced by UI alone.

**Closes:** AT-29, AT-30, AT-33 (+ the manager Approvals screen that makes AT-32 usable end-to-end)
**Already closed, do NOT rebuild:** AT-26, AT-27, AT-28 (#54) · AT-34, AT-35 (#55 + pre-existing)
**Claude pool:** Opus · high **OpenAI/Codex pool:** gpt-5.6-terra · medium
**Harness constraint:** sales-app repo (`~/Documents/sales-app`, own hooks and seat). Demo credentials stdin-only; no live login left running unwatched.
**Lane:** planned change, build directly. LARGE — if one window is not enough, stop at a green PR for the manage view (C3a) and open a second for attribution + Approvals + rep scoping (C3b). Both under this comment.

---

### Launch

```bash
cd ~/Documents/sales-app && git fetch -q && git switch -q main && git pull -q --ff-only
claude --worktree access-c3 --dangerously-skip-permissions
```

Inside, first message:

```
Read docs/sessions/C3-access.md and run it as this session's spec. Run the
preconditions first. npm ci --ignore-scripts before anything else.
```

`--dangerously-skip-permissions` runs every tool call without asking. It is deliberate here — this session is a long unattended build — but it means destructive commands do not stop for confirmation either. The worktree is the blast radius: work stays in `.claude/worktrees/access-c3` on its own branch, and `main` is only reached through a reviewed PR.

**Housekeeping first (30 seconds, needs your hand — a guard blocks me):**
```bash
git push origin --delete worktree-access-c   # merged in #54
git push origin --delete access-c2-targets   # merged in #55
```

---

### State of the world — verified 2026-09-03, do not re-derive

| Thing | Value |
|---|---|
| sales-app `main` | `7a1bbac` — feat(access): manager Targets screen (AT-34) (#55) |
| hub-service `main` | `cbc7246` |
| hub `/version` (deployed) | `cbc7246` — https://hub-service-sb.zeabur.app/version |
| A — migrations 069 + 070 | merged, hub #277 (`397b904`) |
| B — entitlement + admin API | merged, hub #278 (`cbc7246`) |
| D — manager powers, agent-approve | merged, hub #275 (`1dc775a`) |

Every RPC this session needs was confirmed to exist. **Nothing needs stubbing.**

---

### ⚠ Corrections to the original C spec — its paths were stale, these are real

| Original said | Actually |
|---|---|
| `src/RoleRouter.tsx` | `src/shell/RoleRouter.tsx` |
| `npm run typecheck` | **no such script** — use `npx tsc -b` |
| `src/pages/manage/` | this repo has no `src/pages/` — screens live in `src/views/<name>/` |
| `src/preview/*` | `src/views/preview/` |
| `LOG.md` · `STATE.md` | do not exist in sales-app (hub-service only) — do not create them |
| `src/shells/*` | `src/shell/*` (singular) |

---

### Spec

#### AT-29 — manage view (`src/views/manage/`), AdminShell only

Nothing of this exists yet; it is the bulk of the session. Tabs:

- **Products** — name, price, description, `ai_instruction`, deactivate. Honesty-lint warning client-side (guarantee / discount / confirmation phrases). `slug` shown read-only (069's `tg_items_lock_slug` locks the column on browser writes).
- **FAQs** — answer, follow_up, new, deactivate. Keywords through the expander widget → show the `pm_lint_keywords` result. **Hard collisions block save.**
- **Profile** — draft → apply, using the existing singleton pattern in `business_profile`. `escalation_keywords` read-only.
- **Objection replies** — list rules on the 400-band + TELL rules. Edit `response_text` + bundle picker (existing bundles only) → `pm_edit_rule_response`. Trigger words rendered read-only in plain language.
- **Campaigns** — create (name, channel incl. `google_ads`, context_text, dates, active). Code words → `pm_set_campaign_trigger`, rendering collisions. Spend → `pm_set_campaign_spend`. 069's `tg_campaigns_lock_cols` locks `trigger`, `spend_minor` and `created_by` against browser writes — that is why both go through RPCs.
- **History drawer on every row** — `record_revisions` for `(table_name, record_pk)`. One-tap revert = **write `before` as a new edit through the same path**, never a raw rewind.
- **Staleness badge** — latest `test_runs.config_hash` vs current. Hash comes from `GET /api/onboarding/status` **if session E landed; if it did not, hide the badge** (check before building it).

`campaigns_write` is client_admin (069), so this whole view is AdminShell only.

#### AT-30 — attribution, AdminShell + ManagerShell

- ROI table from `campaign_roi_v` (070): spend, leads, won, revenue, cost per lead, cost per won.
- Sightings inbox from `campaign_source_sightings` with **resolve to campaign** → `pm_set_conversation_campaign`, and **dismiss** (069 gives it insert + update policies, manager|client_admin).

#### Manager Approvals screen (makes AT-32 usable)

- Pending `agent_events` where `result_summary.kind = 'approval_pending'` for the tenant.
- Tap → `POST /api/agent-approve` **as the manager**; D's gate does the rest.
- The proposer's own row shows **"awaiting manager"**, not an approve button.

Contract, already read from hub `src/api/agent-approve.ts`:
```
POST /api/agent-approve
body: { session_id, approvals, client_id?, proposer_id }
APPROVER_FLOOR = 'manager'
KIND_APPROVAL_PENDING = 'approval_pending'   // carried in result_summary.kind
```
The write runs in the **proposer's** scope, never the approver's — the manager supplies authority, not reach. A manager may not clear a proposal from someone at or above their own role.

Client already exists: `src/lib/agent-chat.ts` exports `AGENT_APPROVE_PATH`. Reuse it; do not write a second client.

#### AT-33 — rep scoping (partly done)

RepShell Today / Inbox / Leads filter `rep_queue_v` to `owner.user_id = uid` **or** assigned conversations. Floor (manager) stays tenant-wide.

**Already done:** `src/views/rep/Today.tsx` scopes stats, target and todos to `userId`. **Check and finish:** rep Inbox and Leads. `rep_queue_v` is currently unreferenced anywhere in `src/` — the extension uses it, the web app does not, so confirm what the rep views actually read before changing anything.

Reads are tenant-wide by RLS **on purpose** (MASTER-PLAN §B). This scoping is product behaviour, and the test must prove **the filter**, not RLS.

---

### House rules this repo actually enforces

**Law-8 marker scan** — `npm run check:no-service-role` greps all of `src/` and `extension/` for `service_role`, `service-role`, `serviceRole`, `SUPABASE_SERVICE`, `SERVICE_ROLE_KEY`. It is a blunt substring match with **no comment awareness and no allowlist**. This bit C1: the words in a *code comment* failed CI. Write "privileged server connection" instead. **Do not soften the guard** — it is right to be blunt.

**Tokens checksum** — `npm run check:tokens`. Touching `src/ui/tokens.css` means regenerating the recorded hash.

**Every read tenant-scoped and bounded.** `.eq('client_id', clientId)` and `.limit(N)` on every PostgREST read. `src/shell/AdminShell.wall.test.tsx` asserts this empirically — an unbounded list fails CI.

**Adding a route to a shell** takes four edits, all in `src/shell/<X>Shell.tsx`:
1. `const X = lazy(() => import('../views/…').then((m) => ({ default: m.X })))`
2. `<Route path="thing" element={<X />} />` — relative path, no leading slash
3. a `RAIL` entry `{ to: '/thing', label: 'Thing', icon: Icon }`
4. **bump `grid-cols-N` on the mobile nav** to match the new RAIL length (AdminShell is at `grid-cols-9`, ManagerShell at `grid-cols-8`)

Each shell has `const BASE` + `const href = (to) => ...` — rail links and in-shell `<Navigate>` go through `href()`. Never hardcode `/admin/...` in a shell.

**Preview gallery** — `src/views/preview/PreviewGallery.tsx`, mocks in `preview-mocks.ts`. Sections 18 and 19 are taken; **start at 20**. Screens take an optional `preview` prop: call the hook with `null` and render the passed rows, so the gallery needs no session and no network. Copy the shape from `src/views/team/TeamPage.tsx`.

**Test idiom** — the recorder-builder Proxy supabase mock. Copy from `src/lib/team-data.test.ts` or `src/lib/calls-data.test.ts`. Assert on recorded `eq` / `limit` / `update` args.

**Relative-time tests must pin the clock.** `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)`, and only `Date` — faking `setTimeout` stalls `userEvent`/`waitFor`. `extension/ui/CallHud.test.tsx` shows the pattern; it was a real CI time bomb that took main red on a date rollover. Do not reintroduce one.

**The suite is flaky under parallel load.** A full `npx vitest run` locally reports a different 2–17 phantom failures each run — all `waitFor`/optimistic-UI tests that pass in isolation. **Re-run a failing file alone before believing a regression**, and never start a run while editing the files it covers. CI on a clean runner is the real gate.

---

### Existing code to reuse — do not rewrite these

| Need | Already exists |
|---|---|
| Hub HTTP client | `src/lib/api.ts` — `hubFetch`. `HubResult` carries `code?: string` on `forbidden` / `bad_request` / `conflict`, so a refusal code like `role_above_caller` survives to the UI |
| Tenant roster | `src/lib/team-data.ts` — `useTeam`, `TeamMember`, `mintableBy` |
| Entitlements | `src/lib/featureOn.ts` — `useFeatureGrants`, `featureOn(grants, key, role)`, `featureEffect` |
| Targets | `src/lib/targets-data.ts` — `useTeamTargets`, `upsertTarget`, `firstOfMonth` |
| Scripts / win rates / gaps | `src/lib/scripts-data.ts` — `useWinRates` (`script_win_rates_v`), `closeGap` |
| Approve endpoint | `src/lib/agent-chat.ts` — `AGENT_APPROVE_PATH` |
| UI primitives | `src/ui/` — `Button` `Input` `Chip` `EmptyState` `ErrorState` (takes `title`, not `message`) `Skeleton` `Sheet` `Toast` |

---

### Harness gotchas that cost time in C1/C2

- The worktree-isolation guard **refuses compound shell commands containing variables or heredocs** ("too complex to verify"). Split into plain separate commands; **use the Write tool to author files** rather than `cat > f <<'EOF'`.
- `gh api -X DELETE` is blocked by the global dangerous-command guard. Do not try to route around it — hand the command to Joyal.
- `gh pr merge --delete-branch` **fails its local cleanup** in a worktree (`'main' is already used by worktree at ...`). The merge still lands on GitHub. Merge without `--delete-branch` and delete the remote branch separately.
- Fetching a hub migration, as separate plain commands:
  ```bash
  gh api repos/joyaltitus/hub-service/contents/db/migrations/069_access_wall.sql --jq .content > c.b64
  base64 -d < c.b64 > 069.sql
  ```

---

### Evidence

One Playwright screenshot per role per new screen against `/preview` mocks, plus one live authenticated pass per role on the demo tenant with Joyal watching (demo creds stdin-only).

⚠ **sales-app has no Playwright dependency** — the spec routes this through hub devDeps, which C1 did not attempt. Either wire it or say plainly that screenshots were not produced. Do not claim evidence that does not exist.

---

### Delegation map

| Work | Where | Tier | Why |
|---|---|---|---|
| Locate `business_profile` singleton pattern, objection-rule call sites, existing campaign reads, what rep Inbox/Leads actually query | reader | cheapest | location |
| Per-tab components (Products, FAQs, Profile, Objection replies, Campaigns), ROI table, Approvals | Sonnet helpers, one per screen, in parallel | normal | disjoint files, mock contract given |
| History drawer + revert-through-the-same-path, integration, routing, tests | main context | session tier | judgment against this spec |

**Parallel batches.** Batch 1: reader ∥ re-reading 069/070 for the campaign and item column locks. Batch 2: up to four Sonnet helpers on disjoint tabs. Batch 3: integration + history drawer + tests.

---

### Preconditions — all TRUE or park

```bash
# P1 — hub has B's admin API and D's approve gate
gh api repos/joyaltitus/hub-service/contents/src/api/admin --silent \
  && gh api repos/joyaltitus/hub-service/contents/src/api/agent-approve.ts --silent \
  && echo "P1 TRUE" || { echo "P1 FALSE — B or D missing"; exit 1; }

# P2 — the deployed hub is at or past D's merge
test "$(curl -s https://hub-service-sb.zeabur.app/version | grep -o '[0-9a-f]\{7\}')" = "cbc7246" \
  && echo "P2 TRUE" || echo "P2 CHECK — /version moved; confirm it is NEWER than 1dc775a, not older"

# P3 — the manage view has not already been built
test ! -d src/views/manage && echo "P3 TRUE" || { echo "P3 FALSE — someone built it"; exit 1; }

# P4 — the repo is green before you touch it
npx tsc -b && npm run -s check:no-service-role && npm run -s check:tokens \
  && echo "P4 TRUE" || { echo "P4 FALSE"; exit 1; }
```

If a precondition fails on a **path or script name** rather than on substance, say so and ask — do not park on a typo, and do not silently override a gate either. (C1 lost time to exactly this.)

### Park rule

Precondition FALSE on substance · hub `/version` sha **older** than `1dc775a` · any screen needs an RPC that A/B/D did not ship (do not stub it — park with the name) · two failed attempts at green.

---

### Files changed (expected)

`src/views/manage/*` · `src/views/attribution/*` · `src/views/approvals/*` · `src/lib/manage-data.ts` · `src/lib/attribution-data.ts` · `src/lib/approvals-data.ts` · `src/shell/AdminShell.tsx` · `src/shell/ManagerShell.tsx` · `src/shell/RepShell.tsx` · `src/views/preview/PreviewGallery.tsx` · `src/views/preview/preview-mocks.ts` · `src/**/*.test.tsx`

### Output

```
=== C3 ===
DONE: {plain English}
CLOSES: AT-29, AT-30, AT-33 + Approvals — {green | which failed}
EVIDENCE: {screenshot paths per role, or "none — Playwright not wired"}
VERIFIED: {gate tail}
DRIVE-BY: {none | file:line}
PARKED: {none | what and why}
```
