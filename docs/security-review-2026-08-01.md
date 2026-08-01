# sales-app — Security & Correctness Review

- **Date:** 2026-08-01
- **Reviewer:** Codex (principal-engineer pass), session `019fbe36-aced-76b0-ad0a-24d1ceb3577b`
- **Commit reviewed:** `ee641ab` (main, clean tree)
- **Scope:** `src/` only. Excluded: `node_modules/`, `dist/`, styling/formatting.
- **Out of reach:** RLS policies, `pm_*` RPC bodies, migrations, `hub-service` source. Every claim about them is marked "no evidence found".

---

## 0. Fix checklist (use this as the work queue)

| # | Fix | Sev | Where | Effort | Status |
|---|-----|-----|-------|--------|--------|
| 1 | Rep lead visibility enforced by RLS, not `Array.filter()` | Critical | `LeadsScreen.tsx:60` | M | [ ] |
| 2 | Hub sends fail closed + validate response body | Critical | `api.ts:20`, `api.ts:62`, `Composer.tsx:144` | S–M | [ ] |
| 3 | Assignment / bot state / lead transitions → `pm_*` RPCs | High | `crm-actions.ts:25,50,64` | M–L | [ ] |
| 4 | `/preview`, `/samples`, `/kitchen-sink` unauthenticated in prod | High | `App.tsx:25`, `App.tsx:31` | S | [ ] |
| 5 | Mock UI shipped on live operational screens | High | `Today.tsx:34`, `Floor.tsx:77`, `BookingPlanner.tsx:65` | M | [ ] |
| 6 | `moveLeadStage` has no compare-and-swap guard | High | `leads-data.ts:168` | S | [ ] |
| 7 | Membership never revalidated after login | Med | `ClientProvider.tsx:41` | M | [ ] |
| 8 | `signOut()` / `getSession()` errors swallowed | Med | `AuthProvider.tsx:23,34` | S | [ ] |
| 9 | No idempotency key on sends, follow-ups, notes | Med | `api.ts:137`, `crm-actions.ts:104,151` | M | [ ] |
| 10 | Note delete ignores result, hides row anyway | Med | `ContextRail.tsx:488` | S | [ ] |
| 11 | Lead-drawer note failure is silent | Low | `LeadDrawer.tsx:123` | S | [ ] |
| 12 | `check-no-service-role.mjs` is substring-only, `src/` only | Low | `scripts/check-no-service-role.mjs:6,24` | S | [ ] |

---

## 1. Trust boundary

### 1.1 Session lifecycle

| Behaviour | Evidence |
|---|---|
| Password auth direct against Supabase; errors shown verbatim | `src/auth/LoginPage.tsx:102` |
| Startup restores persisted session via `getSession()`; `onAuthStateChange` null event unmounts app via `Gate` | `src/auth/AuthProvider.tsx:23`, `src/App.tsx:53` |
| Initial `getSession()` error ignored — rejected promise leaves `loading=true`; resolved error with no session silently shows login | `src/auth/AuthProvider.tsx:23` |
| `signOut()` discards its error and returns nothing — UI accepts the click without proving revocation | `src/auth/AuthProvider.tsx:34`, `src/shell/TopBar.tsx:44` |
| Refresh/persistence left to supabase-js defaults; only explicit option is realtime throttling | `src/lib/supabase.ts:6` |
| Server-side revalidation via `getUser()` | **no evidence found** |
| Revoked-user / revoked-membership polling | **no evidence found** — memberships reload only when the `session` object identity changes (`src/shell/ClientProvider.tsx:41`, `:73`) |
| Expired hub request tells the user to sign in again, but app does not invalidate the session itself | `src/lib/api.ts:43`, `src/views/inbox/Composer.tsx:58` |
| Overnight tab relies on Supabase auth events + inbox focus/30s polling — that polling refreshes CRM data, not membership or user validity | `src/auth/AuthProvider.tsx:28`, `src/lib/inbox-data.ts:269` |

**Net:** a user revoked at 10am keeps a working UI until their JWT refresh fails or the tab is reloaded. Membership changes (role downgrade, tenant removal) do not propagate at all within a session.

### 1.2 Key material in the bundle

**Supabase anon key.** URL + anon key compiled from `VITE_*` into the bundle (`src/lib/supabase.ts:3`, `:6`). This grants direct PostgREST and realtime access subject only to RLS. That is the intended model — the key is not a secret. The consequence is that every table listed in §1.4 is reachable from a browser console with an arbitrary `client_id`, and only RLS decides the answer.

**Gateway key.** `src/lib/gateway-key.ts` contains no key value. An operator pastes it through the composer (`src/views/inbox/Composer.tsx:107`), it is stored unencrypted in `localStorage` (`gateway-key.ts:10`, `:21`), and attached to every hub request alongside the JWT (`src/lib/api.ts:49`). Anyone with XSS, a browser extension, shared-device access, or five seconds of devtools can lift and replay that header. The file's own comment says the key is anti-noise only and that real enforcement is JWT + server-side membership (`gateway-key.ts:5`). Whether hub-service actually enforces JWT, membership, replay protection, or rate limits: **no evidence found** — that repo is not visible. **Action:** confirm hub-service treats the gateway key as non-authenticating. If any hub route trusts the key alone, that route is publicly callable.

**CI tripwire is weaker than advertised.** `scripts/check-no-service-role.mjs:6`, `:24` greps five literal substrings across `src/` only. It does not inspect `.env`, `public/`, build output, config files, or raw JWT-shaped strings. CI does invoke it (`.github/workflows/ci.yml:17`), but "enforces absence of privileged material" is overstated. Actual privileged material in this checkout: **no evidence found**.

### 1.3 Role separation

`RoleRouter` picks a shell from the client-held membership role and performs no authorization check (`src/shell/RoleRouter.tsx:21`, `:51`).

Forcing the role client-side gives a rep the manager/admin UI: Health/Floor, CRM, Dashboard, Documents, Agent (`src/shell/AdminShell.tsx:86`, `src/shell/ManagerShell.tsx:76`). Whether those surfaces disclose extra *data* is decided entirely by RLS. Role separation in this repo is a UI concern; it is not load-bearing for authorization — **except** for one case below.

**Confirmed broken authorization assumption.** Reps are presented as seeing their own + unassigned leads. The code states `leads` SELECT is tenant-wide and strips other reps' rows with `Array.filter()` (`src/views/leads/LeadsScreen.tsx:60`, `:64`). A rep can bypass that filter and read every lead in the tenant. If "own plus unassigned" is a rule, it is currently unenforced.

The inbox "My" scope is also a JS filter, but the UI offers "All" to every role (`src/views/inbox/InboxScreen.tsx:100`, `:154`, `:217`), so the repo does not claim it as authorization. Not a finding.

### 1.4 Tenant-data access inventory

| Data / access | Boundary | Evidence |
|---|---|---|
| `user_client_memberships` ⋈ `clients` | RLS only — **no user or tenant filter** | `src/shell/ClientProvider.tsx:48` |
| `clients.feature_flags` | RLS + client-controlled `.eq('id', clientId)` | `src/lib/flags.ts:19` |
| `conversations` ⋈ `contacts` | RLS + client-controlled `client_id` | `src/lib/inbox-data.ts:83` |
| `messages` previews + thread bodies, transcriptions, media, delivery failures | RLS + client-controlled `client_id` | `src/lib/inbox-data.ts:137`, `:187` |
| `turn_traces` (routes, matched rule keys) | RLS + client-controlled `client_id` | `src/lib/inbox-data.ts:197`, `src/lib/landing-data.ts:114` |
| `lead_stages` | RLS + client-controlled `client_id` | `src/lib/leads-data.ts:69` |
| `leads` ⋈ `contacts` ⋈ `conversations` (value, objections, lost reason, assignment) | RLS + client-controlled `client_id` | `src/lib/leads-data.ts:96` |
| `follow_ups` (notes, schedules) | RLS + client-controlled `client_id` | `src/lib/leads-data.ts:139` |
| `contacts` (external IDs, profiles, notes, opt-out) | RLS + client-controlled `client_id` | `src/lib/crm-data.ts:63` |
| `bookings` (customer, dates, payment status, total price) | RLS + client-controlled `client_id` | `src/lib/crm-data.ts:92` |
| Tenant roster (user IDs, roles) | RLS + client-controlled `client_id` | `src/lib/crm-data.ts:128` |
| `conversation_notes` (author, body) | RLS + client-controlled `client_id` | `src/lib/crm-data.ts:221` |
| Realtime `conversations` / `messages` | Realtime authorization + client-controlled filter | `src/lib/inbox-data.ts:255` |
| `POST /api/insights` | hub-service HTTP (gateway key + JWT) | `src/lib/api.ts:105` |
| `POST /api/agent-send` | hub-service HTTP (gateway key + JWT) | `src/lib/api.ts:133` |

Validated `pm_*` RPC calls anywhere in the frontend: **no evidence found**.

### 1.5 Blast radius if a policy is wrong

Every table above is reachable through the anon client by editing or dropping the `client_id` filter. Ranked by damage:

1. **`user_client_memberships`** — highest blast radius. The query has **no filter at all** (`src/shell/ClientProvider.tsx:48`). A missing policy returns the global membership/client list, which then supplies valid tenant IDs for every other query below. Audit this policy first.
2. **`messages`** — customer conversation bodies, transcriptions, media (`src/lib/inbox-data.ts:188`).
3. **`contacts`** — phone/IG identifiers, profiles, opt-out state (`src/lib/crm-data.ts:63`).
4. **`leads`** — commercial value, objections, lost reasons (`src/lib/leads-data.ts:97`).
5. **`bookings`** — payment status and total price (`src/lib/crm-data.ts:93`).
6. **`conversation_notes`** — internal staff commentary (`src/lib/crm-data.ts:222`).

---

## 2. Write-class classification

Contract classes: **(a)** RLS-safe direct table write · **(b)** validated `pm_*` RPC · **(c)** hub-service HTTP.

| Write | Current class | Verdict | Evidence |
|---|---|---|---|
| Pause/resume bot on `conversations` | (a) direct | **Wrong** — mutates four coupled state fields; belongs in an RPC transition | `src/lib/crm-actions.ts:25`, `:32` |
| Assign / unassign conversation | (a) direct | **Wrong** — never validates the assignee is a member of the same tenant; DB constraint: no evidence found | `src/lib/crm-actions.ts:50` |
| Save lead stage / status / value | (a) direct | **Wrong** — combines stage transition, status, money, and lost-state invariants | `src/lib/crm-actions.ts:76` |
| Move lead stage | (a) direct | **Wrong** — no expected-current-stage predicate; overwrites concurrent transitions | `src/lib/leads-data.ts:163`, `:168` |
| Add follow-up | (a) direct | Acceptable *only* if DB constraints verify tenant-consistent contact/lead/conversation refs — **no evidence found** | `src/lib/crm-actions.ts:92` |
| Done / snooze / cancel follow-up | (a) direct, with expected-status guard | Better concurrency, still a state transition. RPC if allowed transitions or timestamp invariants matter | `src/lib/crm-actions.ts:111` |
| Add / delete note | (a) direct | Correct class *if* RLS + tenant-consistent FKs exist — **no evidence found** | `src/lib/crm-actions.ts:142`, `:158` |
| Send customer message | (c) hub HTTP | **Correct** — outbound delivery, not CRUD | `src/lib/api.ts:133` |
| Generate insight | (c) hub HTTP | **Correct** — LLM work | `src/lib/api.ts:100` |

**Hub calls that should have been direct writes:** none. Only two hub calls exist and both are correctly classed (`src/lib/api.ts:90`).

### 2.1 Broken invariants

- `saveLead` is an exported helper accepting arbitrary status, value, temperature, and lost reason. The "lost requires a reason" rule and the won/lost derivation live only in the React component and are trivially bypassed. `src/lib/crm-actions.ts:64`, `src/views/crm/LeadDrawer.tsx:79`, `:97`
- `saveLead` guards only the expected stage — not expected status or value, and it encodes no allowed-transition table. `src/lib/crm-actions.ts:82`
- `moveLeadStage` has no compare-and-swap guard at all. Two users dragging the same lead → last-write-wins, silently. `src/lib/leads-data.ts:168`

### 2.2 Failure, retry, offline

| Behaviour | Evidence |
|---|---|
| PWA precaches static assets and shows an online/offline chip. **No write queue, no background sync.** Writes attempted offline simply fail. | `vite.config.ts:34`, `src/pwa/useOnline.ts:3` |
| Hub requests have no timeout, no retry, no idempotency key. `bundle_key` is explicitly `null`. | `src/lib/api.ts:47`, `:137` |
| Follow-up and note inserts carry no client-generated idempotency token. A retry after an ambiguous network failure can duplicate a committed row; DB uniqueness: **no evidence found**. | `src/lib/crm-actions.ts:104`, `:151` |
| `VITE_HUB_API_BASE=""` stays empty — `??` does not replace an empty string, despite the comment describing this exact breakage. Requests silently go same-origin. | `src/lib/api.ts:14`, `:20` |
| **Any** 2xx is accepted as `ok`, including empty and non-JSON bodies. `sendAgentMessage` never validates `{ok:true}`. | `src/lib/api.ts:62`, `:137` |
| **False success, confirmed:** composer clears the draft, paints "Sent," and refetches on that unvalidated `ok`. A static-host or proxy 2xx HTML response produces a "sent" message that was never sent. | `src/views/inbox/Composer.tsx:142`, `:144` |
| Lead-stage optimism *is* correctly reverted on failure. | `src/views/leads/LeadsScreen.tsx:146`, `:167` |
| Note deletion ignores its result and always reloads. `useNotes` turns read errors into an empty array, so an offline delete makes the note vanish locally with nothing deleted. | `src/views/inbox/ContextRail.tsx:488`, `src/lib/crm-data.ts:228` |
| Lead-drawer note failures produce no error state and no user feedback. | `src/views/crm/LeadDrawer.tsx:123` |

---

## 3. Mock scaffolding on live paths

**Mock data is reachable in production with no flag flipped.**

| Surface | Evidence |
|---|---|
| `AgentLauncher` mounted in `TopBar` for every authenticated shell; opens a scripted mock engine | `src/shell/TopBar.tsx:27`, `src/views/agent/AgentPanel.tsx:38`, `:44` |
| Rep Today unconditionally renders mock next-best actions, progress, todos | `src/views/rep/Today.tsx:34`, `:166` |
| Manager Floor unconditionally renders mock manager intelligence | `src/views/manager/Floor.tsx:77`, `src/views/manager/ManagerIntel.tsx:22` |
| CRM exposes mock todos, booking planner, assignment controls, objection controls, lead memory | `src/views/crm/CrmScreen.tsx:72`, `src/views/crm/BookingsTab.tsx:39`, `src/views/leads/LeadRow.tsx:189`, `src/views/crm/LeadDrawer.tsx:191` |
| Documents is a mock-only workflow mounted for rep, manager, **and** admin | `src/views/docs/DocsStudio.tsx:13`, `src/shell/RepShell.tsx:57`, `src/shell/ManagerShell.tsx:82`, `src/shell/AdminShell.tsx:92` |

Most mocks carry "Preview"/"Sample" labels, but the controls still look operational:

- Booking planner paints **"Booked"** and claims a reminder was set after changing local state only. `src/views/crm/BookingPlanner.tsx:11`, `:65`, `:76`
- Action feed paints **"On it — opened the conversation"** without opening or persisting anything. `src/views/rep/ActionFeed.tsx:64`, `:70`

**Flags do not gate any of this.** The only feature flag controls a "Product AI" placeholder route (`src/shell/RepShell.tsx:35`, `:58`). A user can flip client state to reach it; it contains a coming-soon screen only (`src/views/rep/screens.tsx:60`). Low value as an attack path.

**Unauthenticated design routes ship to production.** `/preview`, `/samples`, `/kitchen-sink` bypass auth unconditionally with no production-mode guard (`src/App.tsx:25`, `:31`). `/preview` uses fictional data, not live queries — but it publishes production data shapes and internal trace/rule vocabulary: `bot_paused`, `matched_rule_key`, `llm`, `escalate`, `pricing` (`src/views/preview/preview-mocks.ts:18`, `:99`). The thread renders matched rule keys visibly (`src/views/inbox/Thread.tsx:21`).

**`seam.ts` is not scaffolding.** It is a deliberate pure presentation adapter from `turn_traces.route` to timeline markers, consumed by `Thread` (`src/lib/seam.ts:1`, `:25`, `:69`, `src/views/inbox/Thread.tsx:104`). Keep it.

---

## 4. Test gap

### 4.1 Five highest-value tests, ranked

1. **`tests/rls-contract.test.ts`** — real disposable Supabase schema, two tenants, all four roles. Assert each anon JWT reads/writes only its allowed tenant and role scope across `user_client_memberships`, `clients`, `conversations`, `contacts`, `messages`, `turn_traces`, `leads`, `lead_stages`, `follow_ups`, `bookings`, `conversation_notes`.
   *Would have caught:* the rep "own plus unassigned" rule being a JS filter (`src/views/leads/LeadsScreen.tsx:60`).

2. **`src/lib/api.test.ts`** — hub base + response contract. Assert an empty base fails closed, non-JSON/empty 2xx is a failure, `{ok:false}` is a failure, retries carry an idempotency key.
   *Would have caught:* the composer painting "Sent" on an arbitrary 2xx (`src/lib/api.ts:20`, `:62`, `src/views/inbox/Composer.tsx:144`).

3. **`src/lib/crm-actions.contract.test.ts`** — transition/invariant matrix. Assert assignment rejects non-members, stage moves compare expected state, won/lost/status/stage stay consistent, lost requires a reason, value validation is server-side.
   *Would have caught:* every bypassable direct transition (`src/lib/crm-actions.ts:50`, `:64`, `src/lib/leads-data.ts:168`).

4. **`src/App.production-routes.test.tsx`** — production route manifest. Assert public design routes are absent and authenticated operational routes mount no mock modules and never locally confirm a write.
   *Would have caught:* public `/preview`, `/samples`, `/kitchen-sink` and the fake-booking flow (`src/App.tsx:31`, `src/views/crm/BookingPlanner.tsx:65`).

5. **`src/auth/AuthProvider.test.tsx`** — expiry, revocation, sign-out failure. Assert initial session errors end `loading`, `SIGNED_OUT` tears down tenant UI, membership revocation is revalidated, sign-out failure is visible.
   *Would have caught:* swallowed startup/sign-out failures and stale membership state (`src/auth/AuthProvider.tsx:23`, `:34`, `src/shell/ClientProvider.tsx:41`).

### 4.2 Existing shell tests

Neither is load-bearing for security.

- **`RoleRouter.test.tsx`** — stubs every shell, verifies role→component branching only; its own comment scopes it that way (`src/shell/RoleRouter.test.tsx:5`). Honest name, tests routing not authorization.
- **`AdminShell.wall.test.tsx`** — security-themed, does **not** test the wall. It mocks Supabase, uses a local table allowlist, never executes RLS, and renders only the current `/` Health route (`:34`, `:61`, `:134`). It can catch an omitted explicit filter on that one landing. An explicit filter is not an authorization boundary. **The name overpromises.**

### 4.3 What is untestable without a refactor

Real RLS and `pm_*` validation cannot be tested from this checkout — policies, migrations, and RPC definitions are **no evidence found** here. That needs either the schema vendored into this repo or a shared contract-test package.

Frontend workflows resist isolation because components import the singleton Supabase client, data hooks, and action functions directly. `InboxScreen` coordinates URL state, five data subscriptions, polling, filtering, and three-pane rendering (`src/views/inbox/InboxScreen.tsx:1`, `:134`). `ContextRail` owns six mutation/data workflows plus their UI state (`src/views/inbox/ContextRail.tsx:5`, `:61`).

**Named refactor:** introduce an injected `CrmRepository` / `HubClient`, and an `InboxController` (or `useInboxModel`); leave `InboxScreen` and the rail sections as presentational consumers. That makes expiry, tenant switches, races, network failures, and mutation reconciliation deterministically testable.

---

## 5. Component structure

**`ContextRail.tsx` (516 lines) — tangled, not complex.** Fetching, mutation orchestration, business rules, error state, and rendering are interleaved. It independently owns pause, assignment, stage, follow-up, insight, and notes flows: `src/views/inbox/ContextRail.tsx:61`, `:98`, `:113`, `:150`, `:194`.

**`InboxScreen.tsx` (447 lines) — genuinely complex, and also tangled.** The responsive three-pane domain is real, but the file additionally combines deep-link consumption, filter state, data loading, realtime refresh, selection, composition, and three layouts: `:77`, `:134`, `:151`, `:304`, `:408`.

**Data layer exists but is hook-shaped, not a repository boundary.** `src/lib` supplies hooks; components still decide reload ordering, optimistic state, error wording, and reconciliation (`src/lib/inbox-data.ts:72`, `src/views/inbox/InboxScreen.tsx:143`, `src/views/inbox/ContextRail.tsx:64`).

**What a second developer breaks first:**

- Tenant/role scope — client-side filtering already masquerades as access control (`src/views/inbox/InboxScreen.tsx:100`).
- Refresh consistency — one callback manually sequences queue, preview, and thread requests (`:143`).
- Realtime behaviour — subscription identity, debounce, focus refresh, and polling are coupled in one hook (`src/lib/inbox-data.ts:235`).
- Mutation feedback — each rail operation invents its own busy/error/reload convention, and delete already ignores its result (`src/views/inbox/ContextRail.tsx:61`, `:488`).

---

## 6. Top three fixes

### Fix 1 — Enforce rep lead visibility in RLS, not `Array.filter()`

- **Evidence:** `src/views/leads/LeadsScreen.tsx:60` — code acknowledges tenant-wide `leads` SELECT and filters other reps' rows in JS.
- **Breaks if unfixed:** any rep reads every lead in the tenant via direct PostgREST or patched client code — value, objections, lost reasons, assignment.
- **Who notices:** nobody, until an employee abuses it or an audit exercises the anon API.
- **Cost:** medium. Policy change, role matrix definition, cross-tenant and intra-tenant integration tests, coordination with `hub-service` and `Workbench`.

### Fix 2 — Make hub sends fail closed and validate the response

- **Evidence:** `src/lib/api.ts:20` (empty base falls through to same-origin), `src/lib/api.ts:62` (any 2xx → `ok`), `src/views/inbox/Composer.tsx:144` (draft cleared, "Sent" painted).
- **Breaks if unfixed:** a customer reply is reported as sent with no validated hub acknowledgement. Ambiguous retries can also double-send — no idempotency value is supplied (`src/lib/api.ts:137`).
- **Who notices:** the end user, when the customer never receives the message. Worst kind of bug: the operator believes they replied.
- **Cost:** small on the frontend (base validation + `{ok:true}` assertion). Medium if hub-side idempotency must be added.

### Fix 3 — Move assignment, bot state, and lead transitions into validated `pm_*` RPCs

- **Evidence:** `src/lib/crm-actions.ts:25` (bot pause mutates four coupled fields), `:50` (assignment writes `assigned_to` with no membership check), `:64` (lead status/value/temperature/lost-reason accepted raw), `src/views/crm/LeadDrawer.tsx:79` (lost-reason enforcement lives in React only).
- **Breaks if unfixed:** invalid assignees, impossible lead states, bypassed lost-reason rules, inconsistent won/lost stages, silently lost concurrent transitions.
- **Who notices:** operators, through corrupted pipeline and assignment data. Auditors, when invariants cannot be demonstrated.
- **Cost:** medium-to-large. Define `pm_*` contracts, implement transactions and role checks in Postgres, update this client, regression-test all three repos against the database contract.

---

## 7. Explicit non-findings

Recorded so they are not re-investigated:

- Privileged/service-role key material in this checkout — **no evidence found**.
- Unnecessary hub-service calls that should be direct writes — **no evidence found**. Only two hub calls exist; both correctly classed (`src/lib/api.ts:90`).
- `pm_*` RPC calls in the frontend — **no evidence found**. Zero exist today.
- RLS policies, cross-table tenant constraints, `pm_*` bodies, hub-service authorization — **no evidence found** (out of repo).
- `seam.ts` as migration leftover — false. Deliberate presentation adapter, keep it.
- Inbox "My" scope as an authorization claim — false. UI offers "All" to every role.
