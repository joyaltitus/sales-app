# Sales App UI/UX Overhaul — Design Report

Date: 2026-08-02  
Scope: production React UI only. Routes, role gating, auth, data hooks, Supabase access, and `src/lib/` wiring were not changed.

## 1. Design system summary

### Direction

The system is **operational calm**: a mineral canvas keeps long sales shifts quiet; spruce marks the one primary action; mint marks live, selected, or recommended state. The visual signature is a three-line signal glyph whose last line terminates in a live dot. It appears at sign-in and in both shells without inventing a new product name.

Geist Variable replaces Inter. It is already installed and bundled by Vite, so there is no runtime font request and no new runtime dependency. Compared with the previous generic teal/Inter system, Geist gives the product a clearer enterprise voice and denser numerals without making the app feel like a back-office template.

### Semantic color tokens

| Token | Light | Dark | Use |
|---|---:|---:|---|
| `--canvas` | `#f2f4f1` | `#0c110f` | App background |
| `--canvas-tint` | `#e9eeea` | `#101713` | Atmospheric background |
| `--surface` | `#fafbf9` | `#121915` | Default panel |
| `--surface-raised` | `#ffffff` | `#17201b` | Interactive/elevated panel |
| `--surface-sunk` | `#edf0ec` | `#0f1512` | Wells, filters, secondary controls |
| `--surface-glass` | `rgba(250,251,249,.86)` | `rgba(18,25,21,.88)` | Sticky/floating chrome |
| `--fg` | `#17201c` | `#edf3ef` | Primary text |
| `--fg-muted` | `#4d5a54` | `#a7b5ad` | Secondary text |
| `--fg-subtle` | `#66726c` | `#829188` | Metadata; light value was darkened after contrast audit |
| `--border` | `#dce2dd` | `#26332c` | Hairlines |
| `--border-strong` | `#c8d1ca` | `#38483f` | Control outlines |
| `--overlay` | `rgba(10,20,15,.46)` | `rgba(0,0,0,.68)` | Modal backdrop |
| `--accent` | `#146b4a` | `#66d99a` | The action |
| `--accent-hover` | `#0f5c3f` | `#7be4aa` | Primary hover |
| `--accent-active` | `#0b4e35` | `#50c887` | Primary press |
| `--accent-fg` | `#ffffff` | `#082418` | Text on accent |
| `--accent-subtle` | `#dff1e7` | `#173a29` | Selected/recommended surface |
| `--accent-soft` | `#c8ead7` | `#215139` | Stronger selected surface |
| `--accent-ring` | `rgba(20,107,74,.28)` | `rgba(102,217,154,.34)` | Focus halo |
| `--signal` | `#8dddaf` | `#9be9bc` | Live dot / signal edge |
| `--signal-ink` | `#123d2a` | `#09271a` | Text on signal |
| `--channel-wa` | `#167a55` | `#65d89a` | WhatsApp identity |
| `--channel-ig` | `#a1427c` | `#ec84c2` | Instagram identity |
| `--success` | `#197451` | `#66d99a` | Completed/healthy |
| `--success-subtle` | `#e1f2e9` | `#173a29` | Success tint |
| `--warn` | `#97610b` | `#edbb66` | Time pressure/conflict |
| `--warn-subtle` | `#fbefd8` | `#3a2b16` | Warning tint |
| `--danger` | `#ad342d` | `#ff8c83` | Failure/overdue |
| `--danger-hover` | `#952a25` | `#ffa099` | Danger hover |
| `--danger-active` | `#7f211e` | `#ec756d` | Danger press |
| `--danger-fg` | `#ffffff` | `#310c09` | Text on danger |
| `--danger-subtle` | `#fae9e7` | `#3b1d1a` | Danger tint |
| `--info` | `#315e9a` | `#90baff` | Read/info state |
| `--info-subtle` | `#e7eef8` | `#192c49` | Info tint |
| `--skeleton` | `#e0e5e1` | `#202c26` | Loading surface |
| `--chart-ink` | `#475750` | `#b4c4bb` | Single-hue data marks |
| `--grid-line` | `rgba(23,32,28,.055)` | `rgba(237,243,239,.045)` | Operational grid |

Contrast spot checks: light `fg/canvas` 14.9:1, `fg-muted/canvas` 6.53:1, `fg-subtle/canvas` 4.53:1, `accent/canvas` 5.87:1; dark `fg/canvas` 17.1:1, `fg-muted/canvas` 8.94:1, `fg-subtle/canvas` 5.76:1, `accent/canvas` 10.84:1.

### Type

| Token | Value |
|---|---:|
| Font | `'Geist Variable', 'Avenir Next', system-ui, sans-serif` |
| Mono | `ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace` |
| `--text-2xs` | 11px |
| `--text-xs` | 12px |
| `--text-sm` | 14px |
| `--text-md` | 16px |
| `--text-lg` | 20px |
| `--text-xl` | 24px |
| `--text-2xl` | 32px |
| `--text-3xl` / display | 40px |
| Tight tracking | `-0.035em` |
| Caps tracking | `0.105em` |
| Numeric weight | 650 |
| Caps weight | 650 |

Numerals, money, counts, wait times, and timestamps use tabular features. All-caps text is reserved for small operational metadata, never paragraph copy.

### Space, shape, depth, and motion

- Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px.
- Radius: 5, 7, 11, 16, 22px; pills only for status/counts.
- Shell rail: 232px. Time gutter: 56px. Urgency spine: 3px.
- Light shadows: `elev-1` subtle panel separation, `elev-2` active work surfaces, `elev-3` floating chrome/dialogs. Dark shadows are blacker and surfaces do more separation work.
- Motion: 110ms fast, 170ms medium, 220ms slow; `cubic-bezier(.22,1,.36,1)`. Sheets animate by transform/opacity. All animation and transitions collapse under `prefers-reduced-motion`.
- Every keyboard-reachable control gets a 2px accent outline plus 4px semantic halo.

### Layout rules

- Rep: centered maximum 576px work column; generous 16px gutters; floating four-tab bottom nav; one primary action per region.
- Manager/admin: 232px left rail at desktop, compact five-item bottom nav below `md`; page frame max 1440px; dense tables keep numerics right-aligned and tabular.
- Panels use a 16px radius for major regions and 11px for nested controls. The 32px grid appears only on work canvases, never behind dense text.
- The previous direction switch (`graphite`, `evergreen`, `ledger`) was removed. A production product should have one identity, not a shipped theme experiment.

## 2. Business-rule and flow changes

These are UI proposals only. They do not change current data behavior.

| Area | Old flow | New flow | Why it is less work | Backend requirement |
|---|---|---|---|---|
| Rep Today | Monthly stats → next-best-action feed → todos → follow-ups → queue | One live next action → daily ring → max three prioritized action cards → “more” | Removes reading and choice before the first action | S11 priority endpoint should rank queue, promised follow-ups, cold-lead rescue, and manager todos in one response |
| Rep next action | Rep inspected multiple lists to decide what mattered | Oldest live customer becomes the single primary action, deep-linked into the thread | One decision and one tap | C-NBA service returns ranked action plus reason/evidence; live queue remains fallback |
| Nudge completion | Separate todo/follow-up screens | Done/snooze affordances live on every Today priority card | No context switch | S11 action endpoint persists `{action_id, decision, snooze_until}` and returns replacement priority |
| Cold lead rescue | Rep searched pipeline and composed from memory | “Going cold” card offers a ready-to-review draft | Removes search, recall, and blank-page writing | C-NBA returns `suggested_reply` generated from approved facts; send remains explicit |
| Momentum | Monthly target tiles led the day | Daily follow-up ring and private streak appear after the next action | Motivates without blocking work or ranking people publicly | S9-data stores per-rep daily target, completion history, and streak rules |
| Rep Leads | Open a lead, find the thread, then change stage from a select/drawer | Phone card exposes Message and Advance as two thumb actions | Common operations are one tap | Existing conversation deep link and existing `moveLeadStage` write are used; no backend change |
| Manager Floor | Raw waiting and escalated lists first; intelligence below | Health summary → manager decisions → useful presence → deeper analytics | Manager sees only exceptions requiring intervention | S10 manager snapshot aggregates compliance, waiting thresholds, unowned handovers, approvals, and presence |
| Manager approvals | Approval surfaced inside its originating feature | Floor decision row deep-links to the exact quotation/agent proposal | No hunting across modules | B-agent/D-docs create durable approval tasks with target route and state |
| Team comparison | Leaderboard/rank emphasis | Personal-best pace, improvement, and coaching pattern | Motivates without public last-place shaming | S10 stores baseline windows and bests per rep, not just rank |
| Inbox | Dense filters and status with generic bubbles | Clear queue hierarchy; human, AI, and customer authorship; day/read states; premium composer | Status understood without opening details | Real author type and delivery/read receipt must remain on message rows; existing fields are consumed where available |
| AI reply | AI summary/draft lived in context rail | Using a draft marks the composer as AI-assisted and keeps edit/send explicit | Less ambiguity and no accidental send | Existing insight response is sufficient; optionally persist `draft_source_id` for audit |
| Voice | No conversation voice control | Voice uses ready → listening → processing → editable transcript → use/cancel | Replaces typing but preserves review | V-voice supplies recording/transcription service, confidence spans, cancellation, and retention policy; no audio API is called now |
| CRM mobile | Flat rows with small inline stage select | Large thumb cards with Message and Advance | Two most common actions stop requiring a drawer | Existing stage write is used; next stage order stays `lead_stages.sort_order` |
| CRM facts | Facts were present but visually secondary | Suggested facts are grouped for confirm/edit/dismiss before confirmed memory | One queue of decisions, then stable truth | A-facts persists state transition, correction history, evidence pointer, confidence, and actor |
| Todos | Separate flat list language | Same priority-card language as Rep Today | Users learn one work pattern | S9-data implements `employee_todos` and shared action history |
| Booking | Slot list only | Three-day calendar strip, availability, explicit conflict, message preview, reminder and prep brief | Conflict avoided before selection; confirmation is prewritten | E-booking returns availability/conflicts and atomically reserves slot + queues confirmation/reminder |
| Documents | Five-step wizard: template → customer → items → personalise → preview | Single quotation workspace with template, prefilled customer, line items, note, totals, preview, and one approval action | Removes four transitions and repeated orientation | D-docs persists draft/version, validates locked template terms, requests approval, renders final, sends, records viewed/accepted |
| Notifications | None | Shared bell, grouped slide-over, unread state | Cross-feature exceptions arrive without checking every page | S12-push notification feed, mark-read mutation, deep link, real-time/push delivery |
| Command palette | None | Desktop affordance in manager/admin top bar | Makes navigation/search discoverable without another rail item | Search index/action registry; keyboard handler; role-filtered results |
| Objection capture | Rep typed a free-form lead objection or skipped capture | Contextual chips log the objection in one tap; an AI-detected chip only needs confirmation; note/voice context is optional | Zero typing by default, with undo rather than a confirmation form | O-capture stores a normalized objection log, source/evidence, actor and optional note while preserving the existing lead field during migration |
| After-call outcome | Call result had no fast landing moment | Dismissible “How did it go?” sheet: Closed, Progressing, Objection, No answer | Captures the outcome before the next task without blocking navigation | O-capture creates a call-outcome event and links an objection log only when Objection is chosen |
| Counter-script | Capture and help were separate concepts | Logging an objection immediately opens the active company script; insert remains an editable draft and never sends | The useful reward arrives in the same gesture that creates the data | O-scripts resolves an active standard version, records use/feedback and attributes outcomes without treating correlation as causation |
| Playbook governance | Scripts lived as informal copy with no visible standard | Library → version compare/editor → promote confirmation → taxonomy → day-one read view, all inside `/docs` | One place to create, govern and learn company language | O-scripts needs immutable versions, one active standard per taxonomy key, atomic promotion, and auditable taxonomy merge/archive operations |
| Weekly objections review | No shared objection operating rhythm | Frequency → capture behavior → script outcomes plus a four-step meeting mode | Monday review can run without spreadsheets or dashboard interpretation | O-review provides bounded weekly aggregates and minimum-sample rules; capture rate is a coaching measure, not a rank |
| Manager todo push | Flat sample todo list with local notes | Keyboard quick-create or full multi-assignee sheet → grouped team load → attributed rep Today card → notification | Replaces manager chat reminders and rep memory with one visible work object | T-todos persists assignment, entity link, due/priority, actor and per-assignee state; emits assignment/overdue notifications |
| Click-to-call | Phone context lived outside the app; a result could disappear | Call everywhere → 15-second deal brief → mock call → automatic outcome sheet | The rep enters prepared and logs Closed/Progressing/Objection/No answer in one tap; callback/objection needs only one extra tap | CALL-log creates a call intent/session, appends a durable call event, and atomically creates linked callback/objection records when selected |
| Callback | Follow-up had to be remembered or recreated later | “Callback at…” in the return sheet becomes the single recommended Today action | The promise stays attached to the call and reappears where work is done | CALL-log writes a de-duplicated follow-up with `source_call_id`, client timezone and the existing Today priority invalidation |
| Email channel | WhatsApp/Instagram-only queue; email work happened elsewhere | Subject-led Email row in the unified queue → long-form thread → reviewed template/AI draft compose | B2B work keeps customer, deal and next action context without switching tools | CH-email synchronizes Gmail threads/messages/attachments, stores channel cursors and sends only after existing role/RLS checks |
| Cross-channel relationship | Message history and lead detail were separate | Calls, WhatsApp, Instagram and email interleave in one expandable contact timeline | One relationship view replaces channel-by-channel reconstruction | CH-email/CALL-log normalize events behind a bounded relationship feed while preserving source IDs and channel-specific metadata |
| Copilot work | Agent behaved primarily like chat plus generic approvals | Eight typed tools expose propose → edit/approve/dismiss → executing → done/failed → undo | The rep delegates bounded work and always sees target, trust boundary and receipt | CP-tools persists action proposals, immutable approval actor, lifecycle transitions, retry/idempotency key and reversible compensation where supported |
| Copilot commands | Input always looked like free chat | Recognized command chips show intent, entity and approval requirement before submission; unmatched text stays free chat | Prevents silent action interpretation | CP-tools returns structured intent/entities/parameters separately from generated chat; execution still requires the configured policy |
| Copilot autonomy | No visible client policy | Suggest only / Approve each / Auto for safe actions appears in Settings and as a copilot badge | Trust is explicit before work is delegated | CP-tools stores one per-client policy row with an allowlist, actor and version; server policy is authoritative on every execution |
| Pre-call brief | Rep searched notes, objections and recent messages before dialing | Brief is the mandatory click-to-call interstitial with value, stage, last three touches, open objection/counter and one call goal | A consistent 15-second read replaces manual research | CP-brief composes from authorized contact/lead/timeline/script data and returns provenance/version timestamps with the preview payload |
| Revenue focus | Deal money was inconsistent and dashboard reporting was backward-looking | Value/probability on work objects, personal target/coverage, weighted manager forecast and value-led wins | Every screen answers what can move revenue next | REV-forecast serves tenant-timezone snapshots with stage weights, scenario totals, probability explanations and freshness metadata |
| Global next action | Lead, thread, todo and booking each expressed action differently | One `NextAction` pattern names exactly one recommendation per entity; quick actions use the same six commands on list and board leads | Less relearning and less competing emphasis | Ranking services must return a single primary recommendation plus reason/evidence; UI never infers permission from the recommendation |
| Score model | Opaque activity/revenue numbers or rank-only motivation | Four explained sources—behaviors 40%, outcomes 35%, improvement 15%, team goal 10%—with capped behavior detail | A rep can explain every point and cannot farm one easy action indefinitely | G-score stores immutable eligible score events, daily caps, source weights, sprint snapshots and baseline versions; recomputation is auditable |
| Rep Momentum | One daily ring and a generic streak | Sprint score opens an explainer; comparison obeys Full board / Top-3 / Private; streak shows two freezes | The rep sees one attainable next rung or only their own path, never a wall of people ahead | G-score/G-board resolve team policy before returning any comparison field and suppress unauthorized positions server-side |
| My Season | No durable personal achievement space | `/more` switches locally between Workspace and My Season: bests, badges, sprint trend, challenge, win moment and optional mood pulse | Personal progress remains available even when public comparison is off | G-score returns personal snapshots/badges/history; G-challenge returns only policy-safe progress; G-wellbeing stores the private pulse separately |
| Challenge design | Managers improvised contests in chat | Template → metric → duration → participants → optional prize → exact rep preview → review launch | A manager sees the consequence before publishing; personal-best/team templates are first-class | G-challenge versions definitions, validates eligibility/visibility and freezes metric rules at launch |
| Competition board | One league risked rewarding only tenure or large territories | Main plus Improvement-vs-own-baseline leagues; each row opens score composition; Rookie Ramp is milestone-only and never ranked | More reps have a credible success path without hiding outcomes | G-board uses one snapshot and manager scope; rep responses are filtered by team visibility; rookie milestones remain outside ranks |
| Well-being | Streaks and countdowns could apply pressure at any hour | Protected leave/weekends/holidays, two manual freezes, quiet-hours calm state, manager care signals and anonymous mood trend | Recovery is a visible product behavior, not a policy footnote | G-wellbeing applies the team timezone/window to notifications and score presentation; mood responses are separated from individual manager reads |
| Recognition feed | Deal wins were passive notification rows | Deal wins, badges and challenge start/end accept restrained emoji reactions; closer alone gets a ≤2s CSS win moment | Team recognition is lightweight and does not interrupt everyone | G-feed persists idempotent reactions, bounded counts and event visibility; only the actor receives the celebration payload |
| Point tie-ins | Objection/call capture gave no immediate motivation feedback | Objection confirmation shows +5; call outcome returns +12/+17/+47; copilot digest references best-week momentum | The moat and call-log loops pay the rep immediately without obscuring daily caps | G-score consumes committed domain events after their source transaction and emits one de-duplicated score event per eligibility rule |
| First sign-in | Bare centered form with a raw provider error | Product promise + autofill-ready sign-in + specific credential/rate/network guidance | Establishes value and recovery before the buyer types; errors give one safe next step | Existing sign-in call remains; AUTH-flows maps provider errors to stable display kinds without changing auth policy |
| Invite acceptance | No designed acceptance journey | Invitation context → accept → set password → success → existing role shell | Company and role are confirmed once; the handoff needs no navigation choice | AUTH-flows validates a signed invitation, establishes the session, sets the password and lets the existing RoleRouter resolve the shell |
| Password recovery | No complete request-to-success presentation | Work email → neutral sent confirmation → valid-link reset → success → sign-in | Removes uncertainty without revealing account existence | AUTH-flows uses provider reset request/confirm calls, short token expiry and server-side revocation of reused tokens |
| Session expiry | Hard loss of context at the auth boundary | Soft re-auth sheet over preserved work; full login is the safe fallback | A user resumes the exact object instead of reconstructing work | AUTH-flows refreshes/reauthenticates the session, then restores an allowlisted in-memory return target after role checks |
| Owner reporting | Operational dashboard required product knowledge | One executive readout inside `/dashboard`: revenue, coverage, execution, bookings, objections and one decision to watch | A forwarded report explains the business in 30 seconds with no filtering | RPT-owner returns one tenant/period snapshot and generates an access-controlled PDF from the same immutable figures |

## 3. File-by-file change log

### Created

- `src/ui/ProductMark.tsx` — reusable, nameless signal glyph for login and shells.
- `src/ui/NotificationCenter.tsx` — shared feed with deal, badge, challenge and work-hour streak items plus local emoji reactions.
- `src/views/objections/objectionMocks.ts` — normalized objection, script and log preview contracts with `sample: true` fixtures.
- `src/views/objections/ObjectionCapture.tsx` — chip capture, AI confirmation, undo, script serve, feedback, note/voice, after-call sheet and inline capped behavior reward.
- `src/views/objections/ObjectionHistory.tsx` — contact-level objection timeline with source, actor and resolution state.
- `src/views/docs/Playbook.tsx` — library, version editor/compare, taxonomy controls and onboarding read view.
- `src/views/dashboard/ObjectionsReview.tsx` — pure-SVG frequency, rep matrix, script performance and meeting mode.
- `src/views/crm/todoMocks.ts` — manager assignment and rep receipt mock contracts/fixtures.
- `src/ui/NextAction.tsx` — shared exactly-one recommended-action pattern for leads, contacts, threads, todos and bookings.
- `src/views/calls/callMocks.ts` — `sample: true` deal-brief, call-outcome and call-log contracts.
- `src/views/calls/CallButton.tsx` — lightweight click-to-call launcher with lazy experience loading and local result receipt.
- `src/views/calls/CallExperience.tsx` — pre-call brief, mock active call, automatic two-tap outcome sheet and eligible point disclosure/receipt.
- `src/views/crm/RelationshipTimeline.tsx` — interleaved call, WhatsApp, Instagram and email history.
- `src/views/email/emailMocks.ts` — email thread/message/attachment and Gmail connection preview contracts.
- `src/views/email/EmailQueueRow.tsx` — subject-led Email item for the unified Inbox queue.
- `src/views/email/EmailConversation.tsx` — email thread, attachments, quote collapse and To/Subject/body composer.
- `src/views/agent/copilotMocks.ts` — typed copilot tools, lifecycle states and recognized-command contracts.
- `src/views/agent/CopilotToolCard.tsx` — typed propose/approve/execute/done/failed/undo action card.
- `src/views/revenue/DealProbability.tsx` and `ProbabilityExplanation.tsx` — lazy probability explanation affordance.
- `src/views/revenue/ForecastWidget.tsx` — pure-SVG weighted forecast, scenarios and explicit load/empty/error states.
- `src/views/rep/TodayIntelligence.tsx` — rep morning digest, target/coverage, best-week reference and Momentum card.
- `src/views/rep/SettingsPanel.tsx` — searchable Gmail, autonomy and notification settings architecture.
- `src/views/leads/LeadQuickActions.tsx` — universal six-command lead action sheet reused by row and board.
- `src/views/momentum/momentumMocks.ts` — team game config, score event/source, badge, challenge, board, streak, mood and care contracts with `sample: true` fixtures.
- `src/views/momentum/ScoreExplainer.tsx` — plain-language four-source score composition and capped behavior detail.
- `src/views/momentum/RepMomentum.tsx` — all three visibility variants, quiet-hours calm state, freeze confirmation, mood pulse and restrained win moment.
- `src/views/momentum/MySeason.tsx` — personal bests, monochrome badge shelf, sprint trend, active challenge/prize and explicit load/empty/error states.
- `src/views/momentum/CompetitionConsole.tsx` — manager rules, sum-to-100 weights, challenge composer, two boards, Rookie Ramp and care panel.
- `src/auth/authPreviewMocks.ts` — invite, password-recovery, session-expiry and three failure contracts with `sample: true` fixtures.
- `src/views/reports/ownerReportMocks.ts` — weekly/monthly executive snapshot contract and `sample: true` fixtures.
- `src/views/reports/OwnerBusinessReport.tsx` — executive readout, comparison metrics, pure-SVG charts, tables, A4 controls and explicit load/empty/error states.
- `DESIGN_REPORT.md` — system, flow, wiring, inventory, and verification record.

### Modified

- `index.html` — removed the production direction flag; retained pre-paint theme resolution.
- `src/main.tsx` — switched the bundled variable font import from Inter to Geist.
- `src/index.css` — mapped semantic tokens; added page/panel/grid utilities, focus halo, shimmer, motion and a report-only A4 print scope with light print tokens.
- `src/auth/LoginPage.tsx` — editorial product identity, autofill-ready login, friendly failure mapping and complete local invite/recovery/session-expiry preview states.
- `src/shell/TopBar.tsx` — shared mark, role context, command-palette affordance, notification center, responsive health/actions.
- `src/shell/RepShell.tsx` — floating four-tab mobile navigation and safer content inset.
- `src/shell/ManagerShell.tsx` — 232px exception-oriented rail, AI trust card, responsive bottom navigation.
- `src/shell/AdminShell.tsx` — manager-matched rail and responsive bottom navigation.
- `src/ui/tokens.css` — complete light/dark token replacement.
- `src/ui/Button.tsx` — added `lg` and `icon` sizes; elevated states and motion.
- `src/ui/Input.tsx` — raised field surface, inset highlight, complete state transitions.
- `src/ui/Avatar.tsx` — larger scale, consistent 10px crop, raised fallback.
- `src/ui/ChannelIcon.tsx` — semantic WhatsApp/Instagram colors plus Email channel treatment.
- `src/ui/Chip.tsx` — bordered semantic status treatment.
- `src/ui/EmptyState.tsx` — teach-first layout and stronger icon moment.
- `src/ui/ErrorState.tsx` — matching error hierarchy and action placement.
- `src/ui/ListRow.tsx` — selected signal edge and stronger unread hierarchy.
- `src/ui/Skeleton.tsx` — shimmer with reduced-motion fallback.
- `src/ui/Toast.tsx` — icon, dismiss control, glass surface, semantic tones.
- `src/ui/Sheet.tsx` — larger radius/width, better header, keyboard close preserved.
- `src/ui/KitchenSink.tsx` — new tokens, product mark, notifications, button sizes, voice, facts, approvals.
- `src/ui/agent/VoiceButton.tsx` — compact composer mode, waveform, processing, editable transcript, cancel and timer cleanup.
- `src/views/rep/Today.tsx` — one live action plus value/probability, one-tap call, lazy morning/revenue intelligence and a returned-call callback card.
- `src/views/rep/screens.tsx` — action-oriented More launcher plus local Workspace/My Season tabs and lazy settings/season chunks.
- `src/views/manager/Floor.tsx` — exception-first landing plus copilot-authored attention reasons and per-rep/deal explanation sheets.
- `src/views/manager/ManagerIntel.tsx` — denser responsive cards and personal-best framing.
- `src/views/admin/Health.tsx` — exception summary and bounded health panels.
- `src/views/inbox/InboxScreen.tsx` — unified Email sample row/thread, Email filter, lazy email surface and click-to-call in conversation chrome.
- `src/views/inbox/QueueRow.tsx` — larger hit area, AI/human glance state, stronger unread/selection.
- `src/views/inbox/Thread.tsx` — day dividers, customer/human/AI bubbles, delivery/read states.
- `src/views/inbox/Composer.tsx` — multiline composer, AI draft disclosure, compact voice, icon send, contextual objection capture and script-to-draft insertion.
- `src/views/leads/LeadsScreen.tsx` — larger filter controls, refined phone/desktop backgrounds.
- `src/views/leads/LeadRow.tsx` — value/probability, call, shared next action and long-press/right-click six-command menu.
- `src/views/crm/BoardView.tsx` — pipeline totals/value/probability, call and the same universal quick-action menu on every board lead.
- `src/views/crm/ContactsTab.tsx` — contact detail sheet with value/probability, call/email actions and cross-channel relationship timeline.
- `src/views/crm/CrmScreen.tsx` — CRM identity/header and larger tab targets.
- `src/views/crm/LeadDrawer.tsx` — shared objection capture, retained live free-text field, and preview objection history.
- `src/views/crm/PipelineStrip.tsx` — thumb-sized stage cards with clearer selected state.
- `src/views/crm/TodosTab.tsx` — role-aware manager quick/full assignment, multi-assignee picker, team load, grouped overview and rep receipt view.
- `src/views/crm/BookingPlanner.tsx` — calendar strip, availability, conflict, confirmation and brief.
- `src/views/dashboard/DashboardScreen.tsx` — business-owner report before operational analytics, plus lazy weighted forecast and manager Momentum console.
- `src/views/dashboard/charts.tsx` — new panel/hero/tile surfaces while retaining pure SVG charts.
- `src/views/docs/DocsStudio.tsx` — replaced wizard with one-screen quotation editor/preview/approval timeline and internal Documents/Playbook switch.
- `src/views/agent/AgentLauncher.tsx` — persistent copilot control with the heavy agent panel loaded on demand.
- `src/views/agent/AgentPanel.tsx` — eight typed tool actions, explicit autonomy badge, lifecycle receipts and recognized-command preview.
- `src/views/preview/PreviewGallery.tsx` — sixteen-section review adding complete auth edges and the owner-report artifact to prior phase surfaces.
- `scripts/check-bundle-size.mjs` — corrected first-load accounting to entry/modulepreload assets instead of on-demand lazy chunks; the 200 KB limit remains enforced.

### Deleted

- `src/ui/directions.css` — removed the obsolete multi-direction theme experiment; one product now has one identity.
- `src/views/rep/ActionFeed.tsx` — superseded by the capped actionable stack inside the new Today screen.

## 4. Component API changes

### `Button`

Before:

```ts
type Size = 'sm' | 'md'
```

After:

```ts
type Size = 'sm' | 'md' | 'lg' | 'icon'
```

All existing props remain compatible. `loading` behavior is unchanged.

### `VoiceButton`

Before:

```ts
function VoiceButton(props: {
  lowConfidenceDemo?: boolean
  onTranscript?: (text: string) => void
}): JSX.Element
```

After:

```ts
function VoiceButton(props: {
  lowConfidenceDemo?: boolean
  onTranscript?: (text: string) => void
  compact?: boolean
}): JSX.Element
```

`compact` keeps every voice state inside a 40px composer control.

### New components

```ts
function ProductMark(props: { size?: number }): JSX.Element
function NotificationCenter(): JSX.Element
function NextAction(props: { label: string; detail?: string; compact?: boolean }): JSX.Element
function CallButton(props: { person: string; phone?: string | null; dealValue?: number; stage?: string; label?: string; variant?: 'primary' | 'secondary' | 'icon'; onBegin?: () => void }): JSX.Element
function ForecastWidget(props: { previewState?: 'ready' | 'loading' | 'empty' | 'error' }): JSX.Element
function MomentumCard(props: { visibility?: 'full_board' | 'top_three' | 'private'; quietHours?: boolean }): JSX.Element
function MySeason(props: { previewState?: 'ready' | 'loading' | 'empty' | 'error' }): JSX.Element
function CompetitionConsole(props: { previewState?: 'ready' | 'loading' | 'empty' | 'error' }): JSX.Element
```

No data hook, route, auth or RoleRouter signature changed. Existing service-backed writes remain untouched; all Phase 3 behavior is local `sample: true` preview state.

## 5. Wiring TODO list

All items below are visibly marked Preview/Sample in product UI. Line numbers refer to this change set.

### S9-data — goals, streaks, todos, rep progress

Surfaces:

- `src/views/rep/Today.tsx:148-214` — daily target ring, streak, reply count, median response.
- `src/views/rep/Today.tsx:257-270` — manager todo in priority stack.
- `src/views/crm/TodosTab.tsx:138-160` — shared todo list, completion and note UI.

Proposed shape:

```ts
type RepDailyProgress = {
  user_id: string
  local_date: string
  replies_done: number
  follow_ups_done: number
  follow_ups_target: number
  streak_days: number
  median_reply_minutes: number | null
  personal_best?: { metric: string; value: number; period: string } | null
}

type EmployeeTodo = {
  id: string
  client_id: string
  assignee_id: string
  title: string
  due_at: string
  status: 'pending' | 'snoozed' | 'done'
  source: 'follow_up' | 'escalation' | 'manual' | 'agent'
  source_id: string | null
  note: string | null
}
```

Actions:

- Mark Done → `PATCH /employee-todos/:id`, `{status:'done', completed_at}`.
- Snooze → `PATCH /employee-todos/:id`, `{status:'snoozed', due_at}`.
- Save note → same endpoint, `{note}`.
- Load progress → aggregated endpoint keyed by client/user/local date; timezone must be tenant-aware.

### S10-dashboard — manager intelligence

Surfaces:

- `src/views/manager/Floor.tsx:102,135-163,192-229` — compliance, approval count, presence, pattern.
- `src/views/manager/ManagerIntel.tsx:23-109` — forecast, pipeline risk, coaching, loss reasons.
- `src/views/dashboard/DashboardScreen.tsx:116-146,198-237` — sample rollups and period selector.

Proposed shape:

```ts
type ManagerSnapshot = {
  period: { from: string; to: string; timezone: string }
  first_response: { median_minutes: number; prior_delta_minutes: number; series: number[] }
  inbound: { total: number; prior_delta_pct: number; by_day: { day: string; whatsapp: number; instagram: number }[] }
  follow_up: { on_time_pct: number; done: number; due_today: number; overdue: number }
  reps: { user_id: string; name: string; replies: number; median_reply_minutes: number; won: number; personal_best: boolean }[]
  risks: { lead_id: string; customer: string; value: number; reason: string }[]
  presence: { user_id: string; state: 'available' | 'busy' | 'offline'; activity_label: string }[]
}
```

Actions: period selector → refetch snapshot; risk/rep rows → deep link to real entity; presence should be derived from explicit activity/heartbeat with privacy review, never inferred surveillance.

### S11-nudges / C-nba — prioritized work

Surfaces:

- `src/views/rep/Today.tsx:151,216-278` — cold rescue, priority stack, local done/snooze.

```ts
type NextAction = {
  id: string
  kind: 'reply_due' | 'neglected' | 'follow_up_risk' | 'buying_signal' | 'deal_risk' | 'revive' | 'meeting'
  customer: string
  conversationId: string
  action: string
  why: string
  urgency: 'now' | 'today' | 'this_week'
  due?: string
  brainContext?: string
  evidence?: string
  suggestedReply?: string
}
```

Actions:

- Draft reply → return draft only; do not send. Payload `{action_id, conversation_id}`.
- Accept/open → record acceptance and deep link. Payload `{action_id, decision:'accepted'}`.
- Done/snooze → `{action_id, decision:'done'|'snoozed', snooze_until?}` and return the next ranked action.
- Ranking must explain `why`, cap Today to four visible items, and de-duplicate a conversation across queue/todo/follow-up inputs.

### S12-push — notifications

Surface: `src/ui/NotificationCenter.tsx:13-177`, mounted from `src/shell/TopBar.tsx:48`.

```ts
type ProductNotification = {
  id: string
  kind: 'lead' | 'follow_up' | 'approval' | 'booking' | 'todo'
  title: string
  detail: string
  created_at: string
  read_at: string | null
  href: string
  actor_id?: string | null
  entity_type: string
  entity_id: string
}
```

Actions:

- Open notification → mark read then navigate to `href`.
- Mark all read → `POST /notifications/mark-read`, `{before: now}`.
- Bell badge → unread count from feed/subscription.
- Push/web notifications require tenant/user preferences, deduplication, quiet hours, and permission prompts; none are implemented here.

### A-facts — customer memory

Surfaces:

- `src/views/crm/MemoryTab.tsx:10-47`.
- `src/views/inbox/ContextRail.tsx:417-428`.
- `src/ui/agent/FactCard.tsx` confirm/edit/dismiss actions.

```ts
type LeadFact = {
  id: string
  lead_id: string
  category: 'requirement' | 'budget' | 'preference' | 'objection' | 'buying_signal' | 'promise' | 'follow_up' | 'interest'
  label: string
  value: string
  state: 'suggested' | 'confirmed' | 'corrected' | 'retired'
  confidence: number
  evidence: { message_id: string; quote: string; channel: 'whatsapp' | 'instagram'; at: string }
  history: { from: string; to: string; by: string; at: string }[]
}
```

Actions: Confirm → fact-state mutation; Edit → correction mutation with history; Dismiss → retire/reject mutation. Every action must verify tenant/lead scope and retain evidence.

### B-agent — agent surface and approvals

Surfaces:

- `src/views/agent/AgentPanel.tsx:41-140` — scripted streaming/tool receipts/start prompts.
- `src/views/manager/Floor.tsx:158-164` — quotation approval exception.
- `src/ui/agent/ApprovalCard.tsx` — local approve/edit/cancel.

```ts
type AgentMsg =
  | { id: string; role: 'user' | 'agent'; text: string }
  | { id: string; role: 'tool'; tool: string; status: 'running' | 'done'; summary: string }
  | { id: string; role: 'proposal'; proposal: ProposedAction }

type ProposedAction = {
  id: string
  tier: 'auto' | 'one_tap' | 'explicit'
  title: string
  target: string
  what: string
  before?: string
  after?: string
  why: string
}
```

Actions: Submit prompt → streaming run; tool receipt → durable audit event; Approve/Edit/Cancel → idempotent action endpoint with proposal version, actor, target, and expected before-state. Explicit-tier actions must never execute on generation.

### C-nba reply draft in Today

Surface: `src/views/rep/Today.tsx:244-254`.

Action: “Draft reply” → `POST /next-actions/:id/draft`, `{conversation_id, fact_version}`; response `{draft_id, text, evidence_ids[]}`. Insert into Inbox composer, never send automatically.

### E-booking — visit planner

Surface: `src/views/crm/BookingPlanner.tsx:10-119`.

```ts
type AvailabilitySlot = {
  id: string
  starts_at: string
  ends_at: string
  counsellor: { id: string; name: string }
  status: 'free' | 'held' | 'conflict'
  conflict_reason?: string
}

type BookingRequest = {
  lead_id: string
  conversation_id: string
  slot_id: string
  confirmation_text: string
  reminder_offset_minutes: number
}
```

Action: Book & queue confirmation → atomic slot hold/booking plus outbox entry. Conflict must return an alternative-slot list. Reschedule/cancel must preserve notification history.

### D-docs — quotation editor

Surface: `src/views/docs/DocsStudio.tsx:25-240`.

```ts
type QuoteDraft = {
  id: string
  version: number
  template_id: string
  lead_id: string
  status: 'draft' | 'approval_pending' | 'approved' | 'sent' | 'viewed' | 'accepted'
  items: { id: string; description: string; quantity: number; unit_price: number }[]
  discount: number
  note: string
  locked_terms_version: string
  subtotal: number
  total: number
}
```

Actions:

- Autosave edit → versioned draft mutation.
- Send for approval → create approval task with immutable totals/terms hash.
- Approve → actor-stamped, idempotent state transition.
- Render → server-side PDF generation from locked template.
- Send in conversation → existing messaging gateway with document attachment.
- Viewed/accepted → document events, not optimistic UI state.

### V-voice — push-to-talk

Surfaces:

- `src/ui/agent/VoiceButton.tsx:10-129`.
- `src/views/inbox/Composer.tsx` and `src/views/agent/AgentPanel.tsx` hosts.

```ts
type VoiceState = 'ready' | 'listening' | 'processing' | 'transcript'
type VoiceTranscript = {
  id: string
  text: string
  confidence: number
  low_confidence_spans: { start: number; end: number }[]
  language: string
  duration_ms: number
}
```

Actions: press → begin capture; second press/cancel gesture → discard; release/stop → upload/transcribe; Use this → insert editable text only. The production implementation needs permission, file-size/time limits, explicit retention, abort support, and no auto-send.

### O-capture — objection and after-call capture

Surfaces:

- `src/views/inbox/Composer.tsx:172-183` — contextual chat capture and script-to-composer handoff.
- `src/views/objections/ObjectionCapture.tsx:23-171` — AI suggestion, normalized chips, undo, optional note/voice and after-call sheet.
- `src/views/crm/LeadDrawer.tsx:242-254` — CRM capture plus retained live free-text field during migration.
- `src/views/objections/ObjectionHistory.tsx:6-37` — contact history with source, actor and resolved/open state.

Mock type used (`src/views/objections/objectionMocks.ts:1-45`):

```ts
export type ObjectionKey =
  | 'price'
  | 'quality'
  | 'competitor'
  | 'timing'
  | 'trust'
  | 'no_budget'
  | 'custom'

export type ObjectionLogPreview = {
  id: string
  contactId: string
  objectionKey: ObjectionKey
  label: string
  source: 'chat' | 'crm' | 'call'
  note?: string
  actor: string
  occurredAt: string
  resolved: boolean
  sample: true
}
```

Actions and expected calls:

- Tap Price chip → insert `objection_log {contact_id, conversation_id?, lead_id?, objection_key:'price', source:'chat'|'crm', actor_id, occurred_at, note:null, detected_message_id:null}`; return `{objection_log_id, active_script_version_id?}` in the same response so the reward is immediate.
- Confirm “Detected: Price” → insert the same log plus `{detection_source:'ai', detected_message_id, detector_version, confidence}`; rejecting it creates no objection log but may record a private detector-feedback event.
- Pick another chip after an AI suggestion → log the chosen key and record detector feedback `{suggested_key, chosen_key}` without slowing the primary call.
- Undo → `POST /objection-logs/:id/undo`, `{expected_version, reason:'immediate_undo'}`; retain an audit event rather than hard-deleting the row.
- Save optional note → `PATCH /objection-logs/:id`, `{note}`. Voice follows V-voice and writes only the reviewed transcript, with an optional governed audio reference if policy permits.
- “How did it go?” outcome → `POST /call-outcomes`, `{call_id, contact_id, conversation_id?, outcome:'closed'|'progressing'|'objection'|'no_answer', objection_key?}`. The call sheet is dismissible and never gates navigation.
- Load contact history → bounded `GET /contacts/:contact_id/objection-logs?cursor=…`; return taxonomy label/version, source, actor, note and resolved state ordered newest first.
- Resolve/reopen history event (future control) → `PATCH /objection-logs/:id`, `{resolved_at, resolved_by}` with tenant/contact scope checked server-side.

### O-scripts — serve, govern and teach the standard

Surfaces:

- `src/views/objections/ObjectionCapture.tsx:93-141` — mobile-first script sheet, highlighted phrases, insert affordance, no-standard state and worked/didn’t feedback.
- `src/views/docs/DocsStudio.tsx:29-65` — internal Documents/Playbook switch; no new route.
- `src/views/docs/Playbook.tsx:63-218` — library, compare/editor, promotion confirm, taxonomy add/rename/archive/merge and onboarding read mode.

Mock type used (`src/views/objections/objectionMocks.ts:10-31`):

```ts
export type ScriptStatus = 'draft' | 'testing' | 'standard'

export type ScriptParagraph = {
  before: string
  highlight?: string
  after?: string
}

export type ObjectionScriptPreview = {
  key: ObjectionKey
  label: string
  version: number
  status: ScriptStatus
  headline: string
  paragraphs: ScriptParagraph[]
  winRate: number | null
  uses: number
  wonAfterUse: number | null
  updatedAt: string
  author: string
  sample: true
}
```

Actions and expected calls:

- Complete capture → `GET /playbook/scripts/serve?objection_key=price&channel=whatsapp`; return only the tenant’s active standard, or the highest-confidence testing draft when no standard exists, with the fallback explicitly labeled.
- Insert as reply draft → prefill composer locally, never send; then `POST /script-uses`, `{script_version_id, objection_log_id, conversation_id, inserted_as_draft:true, used_at}`.
- Worked / Didn’t → `PATCH /script-uses/:id`, `{feedback:'worked'|'didnt_work', outcome_event_id?}`. “Won after use” must come from server-side outcome attribution with a published time window, not the feedback tap alone.
- No script → `POST /playbook/gaps`, `{objection_log_id, objection_key, exact_customer_words?, priority:'manager_review'}`; de-duplicate open gaps by tenant/key.
- Load library/read mode → `GET /playbook/scripts?include=active,versions,performance`; reps receive active standards, managers receive governed drafts/testing versions according to role.
- Autosave editor → `POST /playbook/scripts/:script_id/versions`, `{base_version_id, headline, body_blocks, change_note, status:'draft'}`; versions are immutable after creation.
- Promote → `POST /playbook/scripts/:script_id/promote`, `{version_id, expected_active_version_id, actor_id}`; atomically demote the old standard and guarantee one active standard per tenant/taxonomy key.
- AI assist → `POST /playbook/scripts/:script_id/assist`, `{version_id, instruction:'variant'|'tighten'}`; response is a suggestion beside the human draft and never overwrites or promotes.
- Add/rename/archive taxonomy → governed mutations on `objection_taxonomy` with unique normalized keys and usage counts returned before archive.
- Merge tags → `POST /objection-taxonomy/merge`, `{from_key, into_key, expected_counts}`; transactionally move logs/scripts/feedback, preserve aliases for ingestion, and emit an audit record.

### O-review — weekly learning loop

Surfaces:

- `src/views/dashboard/DashboardScreen.tsx:297` — Objections section inside the existing dashboard route.
- `src/views/dashboard/ObjectionsReview.tsx:23-150` — pure-SVG frequency, capture matrix, script performance, inline promotion and four-step meeting mode.

Mock types used (`src/views/dashboard/ObjectionsReview.tsx:23-48`):

```ts
export type ObjectionFrequencyPreview = {
  key: string
  label: string
  thisWeek: number
  lastWeek: number
  sample: true
}

export type RepCapturePreview = {
  id: string
  name: string
  captureRate: number
  conversations: number
  logged: number
  objections: Record<'Price' | 'Timing' | 'Trust' | 'Competitor', number>
  sample: true
}

export type ScriptPerformancePreview = {
  id: string
  objection: string
  version: number
  status: 'testing' | 'standard'
  uses: number
  wonAfterUse: number
  sample: true
}
```

Actions and expected calls:

- Open Objections → `GET /analytics/objections/weekly?week_start&timezone`; return current/prior frequency, per-rep eligible-conversation denominator, capture logs and script-use/outcome aggregates.
- Capture rate → server rule `{eligible_stalled_conversations_with_signal / conversations_with_objection_log}` must be versioned and disclosed; exclude no-answer/system-only threads and never use this value as an access-control decision.
- Start weekly review → no mutation; consume the same snapshot with `{snapshot_id, generated_at, minimum_sample_sizes}` so every attendee sees stable numbers throughout the meeting.
- Promote from performance row → same atomic O-scripts promotion endpoint with `{source:'weekly_review', snapshot_id}`.
- Empty state → return a valid zero-data snapshot; error state → preserve the last successful snapshot timestamp and offer retry, never fill charts with fabricated zeros.

### T-todos — manager push and rep receipt

Surfaces:

- `src/views/crm/TodosTab.tsx:44-111` — quick create, full multi-assignee sheet, team counts, grouped overview and local done state.
- `src/views/rep/Today.tsx:90-110,153,285-297` — assigned todo with manager avatar, due/priority, linked entity, actual touch swipe done/snooze and visible fallback buttons.
- `src/ui/NotificationCenter.tsx:31-48` — new-assignment and overdue notification previews.

Mock type used (`src/views/crm/todoMocks.ts:1-15`):

```ts
export type TodoPriorityPreview = 'normal' | 'high' | 'urgent'

export type TodoAssignmentPreview = {
  id: string
  title: string
  assignees: string[]
  dueLabel: string
  dueAt: string
  overdue: boolean
  priority: TodoPriorityPreview
  status: 'open' | 'done'
  createdBy: string
  link?: { kind: 'lead' | 'conversation'; id: string; label: string }
  sample: true
}
```

Actions and expected calls:

- Quick assign → `POST /todos`, `{title, assignee_ids:[user_id], due_at, priority:'normal', created_by, entity_ref:null, source:'manager_quick'}`; Enter submits only when title and assignee are valid.
- Full assign → `POST /todos`, `{title, assignee_ids, due_at, priority, entity_ref?:{kind:'lead'|'conversation', id}, created_by, source:'manager_sheet'}`; either create one shared todo with per-assignee states or server-side fan-out, but return stable assignment IDs for each rep.
- Mark done → `POST /todo-assignments/:id/transition`, `{to:'done', expected_version}`; idempotent retry returns the current row.
- Swipe/button snooze → same transition endpoint, `{to:'snoozed', snooze_until, expected_version}`; the next Today priority is returned or invalidated through the S11 feed.
- Open linked lead/conversation → navigation only; the server must re-check the user’s existing RLS/role authority and never infer access from the todo.
- Manager overview → `GET /todos/overview?status=open,done,overdue&cursor=…`; return bounded rows and counts grouped by assignee, with overdue computed in the tenant timezone.
- Create assignment → emit `notification {kind:'todo', event:'assigned', recipient_id, todo_assignment_id, href}`. Due scheduler emits a de-duplicated `event:'overdue'`; completion/snooze cancels stale reminders.

### CALL-log — click-to-call, outcomes, call history and callbacks

Surfaces:

- `src/views/calls/CallButton.tsx:8-53` — one-tap call affordance, on-demand brief/return flow and local outcome receipt.
- `src/views/calls/CallExperience.tsx:10-45` — mandatory brief, mock active call and auto-return outcome sheet; direct outcomes take one tap and objection/callback take two.
- `src/views/crm/RelationshipTimeline.tsx:5-28` — duration, outcome, objection and expandable note interleaved with channel events.
- `src/views/rep/Today.tsx:42-50,275-285` — a callback created from the return sheet is represented as the single callback action in Today.

Mock types used (`src/views/calls/callMocks.ts:1-26`):

```ts
export type CallOutcomePreview = 'closed' | 'progressing' | 'objection' | 'no_answer' | 'callback'

export type CallLogPreview = {
  id: string
  contactId: string
  direction: 'outbound' | 'inbound'
  startedAt: string
  durationSeconds: number
  outcome: CallOutcomePreview
  objectionKey?: string
  callbackAt?: string
  note?: string
  actor: string
  sample: true
}
```

Actions and expected calls:

- Tap Call / confirm Start call → `POST /call-sessions`, `{client_id, contact_id, lead_id?, direction:'outbound', surface:'today'|'lead'|'contact'|'conversation', requested_number, brief_id?}`; return `{call_session_id, status:'initiated', started_at}` before the device-call handoff. Repeated taps use an idempotency key and never create duplicate sessions.
- Return to app → `POST /call-sessions/:id/complete`, `{ended_at, duration_seconds?, returned_at}`; response opens the outcome requirement but does not invent an outcome.
- Tap Closed/Progressing/No answer → `POST /call-logs`, `{call_session_id, contact_id, lead_id?, outcome, note?, actor_id, client_occurred_at, expected_version}`; append one relationship event and invalidate the entity next action.
- Tap Objection then a Phase 2 chip → same call-log write plus `{outcome:'objection', objection:{key, source:'call', evidence_call_id}}`; server atomically creates the O-capture log and resolves the active O-scripts version.
- Tap Callback then a time → same call-log write plus `{outcome:'callback', callback_at, timezone}`; atomically create `POST /follow-ups`, `{contact_id, lead_id?, due_at, source:'post_call', source_call_id, assignee_id}` and invalidate Today priorities.
- Add voice note → upload/transcribe through V-voice first, then include `{note, transcript_id?, recording_id?}` in the final log; capture must still succeed if transcription fails.

### CH-email — Gmail connection and unified Email channel

Surfaces:

- `src/views/email/EmailQueueRow.tsx:5-7` and `src/views/inbox/InboxScreen.tsx:89,356,436-438` — Email channel/filter, subject-led sample queue item and lazy email thread.
- `src/views/email/EmailConversation.tsx:7-23` — long-form message blocks, attachment row, quoted-thread collapse, To/Subject/body compose, templates and AI-draft disclosure.
- `src/views/crm/RelationshipTimeline.tsx:5-28` — email events interleaved with calls, WhatsApp and Instagram.
- `src/views/rep/SettingsPanel.tsx:22-45` — Gmail disconnected, connecting, connected and error states; every state says Preview/not wired.

Mock types used (`src/views/email/emailMocks.ts:1-34`):

```ts
export type EmailAttachmentPreview = { id: string; name: string; mime: string; size: string; sample: true }

export type EmailMessagePreview = {
  id: string
  from: { name: string; address: string }
  to: { name: string; address: string }[]
  sentAt: string
  body: string[]
  quotedBody?: string
  attachments: EmailAttachmentPreview[]
  sample: true
}

export type EmailThreadPreview = {
  id: string
  contactId: string
  contactName: string
  contactEmail: string
  subject: string
  unread: boolean
  lastActivityAt: string
  messages: EmailMessagePreview[]
  dealValue: number
  sample: true
}

export type GmailConnectionPreview = {
  account: string | null
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  scopes: ('read' | 'send')[]
  lastSyncAt: string | null
  error?: string
  sample: true
}
```

Actions and expected calls:

- Connect Gmail → `POST /channel-connections/gmail/oauth/start`, `{client_id, return_to:'/more', requested_scopes:['read','send']}`; callback exchanges the code server-side, encrypts tokens, verifies tenant/domain policy and returns `{connection_id, account, status, scopes, last_sync_at}`. Browser never receives refresh tokens.
- Retry connection → restart the OAuth intent with a new state/PKCE verifier; Disconnect → `DELETE /channel-connections/:id`, `{expected_version}` and revoke provider tokens asynchronously without deleting imported relationship history.
- Open Email filter/thread → `GET /inbox/threads?channels=email&cursor=…` and `GET /email/threads/:id`; message rows return normalized authors/timestamps plus provider IDs, bounded body content and signed/authorized attachment references.
- Expand quoted thread → client-only when the body is already present; otherwise `GET /email/messages/:id/quoted` with the same contact/thread authorization.
- Pick template / AI draft → `POST /copilot/drafts`, `{kind:'email', thread_id, contact_id, template_id?, requested_intent, context_version}`; response `{draft_id, subject, body, evidence, sample:false}` is editable and never sent automatically.
- Send email → `POST /email/messages`, `{thread_id?, contact_id, to, cc:[], subject, body, attachment_ids, template_version_id?, draft_source_id?, client_request_id}`; enqueue once, return delivery state/provider ID, append the relationship event and update the thread preview.

### CP-tools — typed copilot actions, command recognition and autonomy

Surfaces:

- `src/views/agent/CopilotToolCard.tsx:20-30` — eight typed cards with proposed, executing, done, failed, retry and reversible undo states.
- `src/views/agent/AgentPanel.tsx:40-56,58-169` — natural-command recognition, explicit autonomy badge, proposals and full tool lifecycle.
- `src/views/manager/Floor.tsx:167-188,221,249-250` — copilot-written attention reasons and ask-copilot explanations for reps/deals.
- `src/views/rep/SettingsPanel.tsx:7-15,22-45` — per-client autonomy policy plus grouped Gmail/notification controls.

Mock types used (`src/views/agent/copilotMocks.ts:1-23`):

```ts
export type CopilotToolKind = 'send_email' | 'send_whatsapp' | 'schedule_follow_up' | 'create_booking' | 'draft_quotation' | 'update_stage' | 'add_note' | 'assign_todo'
export type CopilotToolState = 'proposed' | 'executing' | 'done' | 'failed'

export type CopilotToolActionPreview = {
  id: string
  kind: CopilotToolKind
  title: string
  summary: string
  target: string
  preview?: string
  state: CopilotToolState
  reversible: boolean
  sample: true
}

export type RecognizedCommandPreview = {
  raw: string
  intent: CopilotToolKind
  entity: { type: 'lead' | 'conversation' | 'contact'; id: string; label: string }
  parameters: Record<string, string>
  requiresApproval: boolean
  sample: true
}
```

Per-client autonomy setting shape (`src/views/rep/SettingsPanel.tsx:7-15`):

```ts
export type AutonomyConfigPreview = {
  clientId: string
  mode: 'suggest_only' | 'approve_each' | 'safe_auto'
  safeActions: ('add_note' | 'schedule_follow_up' | 'draft_reply')[]
  updatedBy: string
  sample: true
}
```

Actions and expected calls:

- Type a command → `POST /copilot/recognize`, `{client_id, raw, anchor:{type,id}, surface, locale}`; return `{intent, entities, parameters, requires_approval, confidence}` separately from free-chat output. Recognition alone performs no write.
- Ask/submit → `POST /copilot/runs`, `{client_id, anchor, raw, recognized_command?, context_version}`; stream bounded text plus persisted typed `action_proposals[]`, each with target, input schema, current policy decision and idempotency key.
- Edit proposal → `PATCH /copilot/actions/:id`, `{parameters, expected_state:'proposed', expected_version}`; server revalidates target/permissions and refreshes the summary/preview.
- Approve → `POST /copilot/actions/:id/execute`, `{approved_by, expected_state:'proposed', expected_version, client_request_id}`; transition proposed → executing → done/failed and return a typed receipt. Server re-checks RLS and the latest autonomy policy at execution time.
- Dismiss/retry → `POST /copilot/actions/:id/transition`, `{to:'dismissed'|'retrying', reason?, expected_version}`; retries retain the original idempotency key and cannot duplicate email, message, booking, follow-up, stage, fact or todo writes.
- Undo → `POST /copilot/actions/:id/undo`, `{receipt_id, expected_version}`; only visible while the server receipt says reversible and inside `undo_expires_at`; compensation creates a new auditable event rather than deleting history.
- Change autonomy → `PUT /clients/:clientId/copilot-policy`, `{mode:'suggest_only'|'approve_each'|'safe_auto', safe_actions:['add_note','schedule_follow_up','draft_reply'], expected_version, updated_by}`; store exactly one versioned per-client config row and emit an audit event. “Safe auto” never broadens actor permissions.

### CP-brief — pre-call deal brief

Surfaces:

- `src/views/calls/callMocks.ts:3-12,28-40` — compact brief contract and `sample: true` fixture.
- `src/views/calls/CallExperience.tsx:10-25` — value/stage, last three touchpoints, open objection with active counter-script and one recommended call goal before dialing.
- `src/views/leads/LeadQuickActions.tsx:20-40` — Brief me is part of the same six-command lead menu used on list and pipeline views.

Mock type used (`src/views/calls/callMocks.ts:3-12`):

```ts
export type DealBriefPreview = {
  contactId: string
  name: string
  value: number
  stage: string
  lastTouchpoints: { channel: 'whatsapp' | 'email' | 'call'; summary: string; at: string }[]
  openObjection: { key: string; label: string; counter: string } | null
  recommendedGoal: string
  sample: true
}
```

Actions and expected calls:

- Tap Call or Brief me → `POST /copilot/briefs`, `{client_id, contact_id, lead_id?, purpose:'pre_call', include:{touchpoints:3, open_objection:true, active_script:true, deal:true}}`; return the type above plus `{brief_id, generated_at, source_versions, expires_at}`. Fetch only records the current actor can already read.
- Start call → include `{brief_id}` in CALL-log session creation so the final call event can attribute whether a brief was shown; this is analytics provenance, not proof that the brief caused the outcome.
- Refresh after stale source → `POST /copilot/briefs/:id/refresh`, `{source_versions}`; render partial sections with honest unavailable labels if one channel is down rather than blocking the call.

### REV-forecast — probability, personal revenue and manager forecast

Surfaces:

- `src/views/revenue/ForecastWidget.tsx:7-35` and `src/views/dashboard/DashboardScreen.tsx:236` — weighted stage bars, committed/best-case scenario, month pace, copilot read and explicit loading/empty/error states.
- `src/views/revenue/DealProbability.tsx` and `src/views/revenue/ProbabilityExplanation.tsx` — probability chip and lazy “why” explanation on leads, contacts, Today and board cards.
- `src/views/rep/TodayIntelligence.tsx:4-30` — morning digest, closed/target progress and required pipeline coverage gap.
- `src/ui/NotificationCenter.tsx` — team-visible deal-won entry with owner, value and account.

Mock types used (`src/views/revenue/ForecastWidget.tsx:7-16`, `src/views/rep/TodayIntelligence.tsx:4-18`):

```ts
export type RevenueForecastPreview = {
  month: string
  target: number
  closed: number
  committed: number
  bestCase: number
  elapsedPct: number
  stages: { key: string; label: string; rawValue: number; probability: number; weightedValue: number }[]
  sample: true
}

export type DailyDigestPreview = {
  hotLeads: number
  goingCold: number
  yesterday: { calls: number; replies: number; closedValue: number }
  sample: true
}

export type RepRevenuePreview = {
  month: string
  closed: number
  target: number
  openPipeline: number
  requiredCoverage: number
  sample: true
}
```

Actions and expected calls:

- Load manager forecast → `GET /analytics/revenue-forecast?client_id=…&month=2026-08&scenario=committed|best`; return stage weights/raw/weighted totals, target, closed, elapsed percent, generated timestamp and a bounded explanation. Aggregate only authorized tenant data and use tenant timezone/currency.
- Toggle scenario → client may switch between both values from one snapshot; if requested separately, retain the same `snapshot_id` so numbers cannot mix time windows.
- Tap probability → `GET /leads/:id/probability-explanation?model_version=…`; return `{probability, reasons:[{signal,direction,weight,evidence_ref}], generated_at, model_version}`. UI labels it estimated; write access is never implied.
- Load rep revenue/digest → `GET /reps/me/revenue?month=2026-08` and `GET /reps/me/digest?date=2026-08-02`; return closed/target/open/coverage plus ranked hot/cold jump-offs. Manager variants require existing manager scope.
- Close a deal → existing stage/status mutation emits `{kind:'deal_won', deal_id, owner_id, account_name, value, currency, occurred_at}` to S12-push after the transaction commits; notification deep link checks current access.

### G-score — transparent points, caps, badges and team policy

Surfaces:

- `src/views/momentum/ScoreExplainer.tsx:5-13` — four-source personal breakdown, source weights, plain-language explanations and behavior-level “Maxed today” states.
- `src/views/momentum/RepMomentum.tsx:9-30` — sprint points, one policy-safe comparison frame, streak/freeze count and protected state.
- `src/views/rep/TodayIntelligence.tsx:28-30` — best-week reference and Momentum card in the morning digest.
- `src/views/objections/ObjectionCapture.tsx:84`, `src/views/calls/CallExperience.tsx:33` and `src/views/calls/CallButton.tsx:49` — +5 objection, +12 call, +17 call+objection and +47 close receipts; daily-cap disclosure remains visible.

Required `team_game_config` shape (`src/views/momentum/momentumMocks.ts:5-15`):

```ts
export type TeamGameConfigPreview = {
  clientId: string
  teamId: string
  visibility: 'full_board' | 'top_three' | 'private'
  sprint: 'weekly' | 'biweekly' | 'monthly'
  weights: Record<'behaviors' | 'outcomes' | 'improvement' | 'team_goal', number>
  quietHours: { timezone: string; workdayStart: string; workdayEnd: string; weekendsProtected: boolean; holidaysProtected: boolean }
  freezeTokensPerMonth: number
  updatedBy: string
  sample: true
}
```

Required `score_event` shape (`src/views/momentum/momentumMocks.ts:17-27`):

```ts
export type ScoreEventPreview = {
  id: string
  repId: string
  source: 'behaviors' | 'outcomes' | 'improvement' | 'team_goal'
  behavior?: 'follow_up_on_time' | 'fast_first_response' | 'call_logged' | 'objection_logged' | 'booking_made'
  points: number
  capped: boolean
  entityRef?: { kind: 'call' | 'objection' | 'booking' | 'deal' | 'follow_up'; id: string }
  occurredAt: string
  sample: true
}
```

Required badge definition (`src/views/momentum/momentumMocks.ts:29-36`):

```ts
export type BadgeDefinitionPreview = {
  id: string
  name: string
  description: string
  criteria: { metric: string; threshold: number; window: string }
  earnedAt: string | null
  sample: true
}
```

Actions and expected calls:

- Load a rep score → `GET /momentum/me?sprint_id=…`; return `{sprint, total_points, sources:[{key,weight,points,explanation}], behaviors:[{key,points,daily_cap,capped_today}], streak, freeze_tokens_remaining, badges, baseline_version}`. The response may include comparison only after G-board policy filtering.
- Open “How points work” → use the same immutable sprint snapshot; do not recompute sources independently or let displayed components disagree.
- Change team policy → `PUT /teams/:teamId/game-config`, `{visibility, sprint, weights:{behaviors,outcomes,improvement,team_goal}, quiet_hours:{timezone,workday_start,workday_end,weekends_protected,holidays_protected}, freeze_tokens_per_month, expected_version, updated_by}`. Reject unless weights are integers summing to 100 and each source respects the configured minimum; emit an audit event.
- Commit an eligible behavior/outcome → source domains publish an outbox event only after their own transaction commits. The scoring worker appends `score_event`, `{rep_id, team_id, sprint_id, source, behavior?, raw_value, points, cap_applied, entity_ref, rule_version, occurred_at, idempotency_key}`. Unique `(rule_version, entity_ref, behavior)` prevents duplicate rewards.
- Objection/call/close feedback → UI renders the authoritative awarded points returned with the committed domain response; if capped, return `{points:0,capped:true,cap_resets_at}` rather than optimistic points.
- Award a badge → append `rep_badge {rep_id,badge_definition_id,earned_at,trigger_score_event_id}` once; the definition is versioned, criteria are server-evaluated and an earned badge is never silently revoked by a later rule edit.

### G-board — visibility-safe leagues, drill-in and Rookie Ramp

Surfaces:

- `src/views/momentum/RepMomentum.tsx:15-25` — Full board exposes only `#4 of 9` and next-rung context; Top-3 exposes three names plus personal-best pace; Private exposes no other rep.
- `src/views/momentum/CompetitionConsole.tsx:43-52` — manager-only Main and Improvement leagues, sprint picker, composition/trend drill-in and positive framing for every row.
- `src/views/momentum/CompetitionConsole.tsx:43-52` — Rookie Ramp tracks first call/booking/close/₹1L outside all ranks.

Mock row type (`src/views/momentum/momentumMocks.ts:70-79`):

```ts
export type BoardRowPreview = {
  id: string
  name: string
  position: number
  points: number
  revenue: number
  improvementPct: number
  framing: string
  sample: true
}
```

Actions and expected calls:

- Load manager board → `GET /momentum/boards?team_id=…&sprint_id=…&league=main|improvement`; return one `snapshot_id`, bounded rows, score/revenue/improvement and healthy framing. Only manager/admin scope receives all rows.
- Load rep position → `GET /momentum/me/position?sprint_id=…`; server resolves `team_game_config.visibility` first. `full_board` returns `{position,total,next_rung_gap}`; `top_three` returns `{top_three,personal_best_frame}` and never returns the rep’s numeric position; `private` returns only `{personal_best_frame}`. Hiding fields in React is not the security boundary.
- Switch leagues/sprints → request a complete snapshot for that selection; Main ranks the configured total, Improvement ranks percent change against each rep’s frozen baseline window. Never mix baseline versions in one board.
- Drill into a rep → `GET /momentum/boards/:snapshotId/reps/:repId`; return source composition and trend under existing manager authority; avoid message bodies, mood answers or care-signal evidence beyond the summarized G-wellbeing context.
- Rookie Ramp → `GET /momentum/rookies?team_id=…`; return `{rep_id,tenure_days,milestones:[{kind,completed_at}]}` for the first 30 days. No rank/position/percentile field exists in this contract.
- No-shame invariant → the API must not produce `last_place`, red-zone buckets or public negative deltas. Bottom-half rep endpoints return improvement/next-action framing only, even when manager board ordering is enabled.

### G-challenge — definitions, rep-safe preview and progress

Surfaces:

- `src/views/momentum/CompetitionConsole.tsx:23-41` — template, metric, duration, team/subset participants, optional prize image/title/caption, exact rep preview and review launch.
- `src/views/momentum/MySeason.tsx:19-23,38` — active challenge, live progress, visibility-safe comparison, work-hour countdown and attached prize card.
- `src/ui/NotificationCenter.tsx:59-69,141-150` — challenge start and result feed entries.

Required challenge definition (`src/views/momentum/momentumMocks.ts:38-50`):

```ts
export type ChallengeDefinitionPreview = {
  id: string
  template: 'most_x' | 'first_to_n' | 'team_total' | 'beat_own_best'
  name: string
  metric: 'follow_ups' | 'bookings' | 'calls' | 'revenue' | 'objections_logged'
  target: number
  startsAt: string
  endsAt: string
  participant: { kind: 'team' | 'subset'; ids: string[] }
  visibility: 'full_board' | 'top_three' | 'private'
  prize?: { imageUrl: string; title: string; caption: string }
  sample: true
}
```

Actions and expected calls:

- Edit draft → `POST /challenges/drafts`, `{team_id, template, metric, target, starts_at, ends_at, participant:{kind,ids}, prize_asset_id?, prize_title?, prize_caption?, expected_game_config_version}`; return server validation and an immutable metric/rule preview.
- Upload prize photo → authorized signed upload intent `POST /challenge-assets`, `{team_id, mime, bytes, purpose:'prize'}`; attach the scanned asset ID only, enforce file/type/size limits and never expose local paths.
- Preview as rep → `POST /challenges/drafts/:id/preview`, `{viewer_rep_id}`; resolve team visibility and quiet-hours policy server-side, returning exactly the fields that rep would receive. The manager UI uses this payload rather than simulating policy independently when wired.
- Launch → `POST /challenges/:id/launch`, `{expected_state:'draft', expected_version, launched_by}`; freeze metric eligibility, participants, baselines, visibility and prize version, then emit one G-feed start event. Nothing launches directly from the composer’s first button.
- Load/update progress → `GET /challenges/active` and score-event-driven projection `{challenge_id,rep_progress,leader_or_top_pace?,personal_target?,ends_at}`. Comparison fields follow the challenge/team’s effective visibility; countdown is omitted outside quiet hours.
- Complete → append immutable result snapshot and emit a team result feed item; personal-best challenges compare each participant only with their own frozen baseline.

### G-wellbeing — freezes, quiet hours, care signals and private mood

Surfaces:

- `src/views/momentum/RepMomentum.tsx:15,25-30` — explicit quiet-hours calm state, automatic protection and manual freeze confirmation/count.
- `src/views/momentum/RepMomentum.tsx:35-39` and `src/views/momentum/MySeason.tsx:39` — optional three-choice pulse, local “dismiss forever” affordance and explicit private-to-aggregate copy.
- `src/views/momentum/CompetitionConsole.tsx:53-56,89-92,95` — manager work-hours configuration, exact calm preview, soft care flags/action chips and aggregate-only team mood trend.

Mock types (`src/views/momentum/momentumMocks.ts:81-106`):

```ts
export type WellbeingFlagPreview = {
  id: string
  rep: string
  signal: 'late_night_pattern' | 'quality_drift' | 'no_break' | 'streak_anxiety'
  context: string
  suggestedAction: 'Suggest a day off' | 'Rebalance leads' | 'Check in'
  sample: true
}

export type StreakProtectionPreview = {
  repId: string
  month: string
  manualTokensRemaining: number
  protectedDates: { date: string; reason: 'leave' | 'weekend' | 'holiday' | 'manual' }[]
  sample: true
}

export type MoodPulseResponsePreview = {
  id: string
  repId: string
  week: string
  response: 'heavy' | 'steady' | 'good' | null
  privateToAggregate: true
  dismissedForever: boolean
  sample: true
}
```

Actions and expected calls:

- Resolve quiet state → `GET /momentum/context`; return `{is_quiet_hours,timezone,workday_start,workday_end,protection_reason?}` derived server-side from the versioned team config and holiday/leave calendar. During quiet hours omit rank gaps, negative deltas, challenge countdowns and streak-risk notifications at the source.
- Spend a freeze → `POST /streaks/me/freezes`, `{date, timezone, expected_tokens_remaining, reason:'manual', client_request_id}`; atomically decrement once and return `{protected:true,tokens_remaining}`. Weekends, holidays and approved leave create automatic protections and never consume a token.
- Submit mood → `PUT /wellbeing/mood/me/:week`, `{response:'heavy'|'steady'|'good'}` stored in a privacy-separated table/service. Rep can replace/delete their answer during the window; managers cannot query individual rows.
- Dismiss forever → `PUT /wellbeing/mood/me/preferences`, `{prompt_enabled:false}`; this preference is private to the rep and does not count as a mood response.
- Load team trend → `GET /wellbeing/mood/team?team_id=…&weeks=6`; enforce a minimum response threshold and return only `{week,response_count,index,bucket}` aggregates. Suppress the week rather than reveal a small group.
- Load care flags → `GET /wellbeing/care-signals?team_id=…`; return minimal summarized context, expiry and suggested supportive actions. Flags are manager-only prompts, excluded from score/board/HR export, and never create punitive notifications.
- Tap suggested action → `POST /wellbeing/care-signals/:id/acknowledge`, `{action:'suggest_day_off'|'rebalance_leads'|'check_in', note_visibility:'manager_private'}`; acknowledgment does not change the rep’s score or public state.

### G-feed — recognition events, reactions and closer-only celebration

Surfaces:

- `src/ui/NotificationCenter.tsx:20-31,36-150,165-284` — deal-won, badge, challenge start/end and work-hour streak items with 👏 🔥 🎯 reaction counts/local pressed state.
- `src/views/momentum/RepMomentum.tsx:42-45` and `src/views/momentum/MySeason.tsx:30` — ≤1.9s CSS-only closer moment; reduced-motion keeps the static card; everyone else receives only the feed item.

Mock feed type (`src/ui/NotificationCenter.tsx:20-31`):

```ts
export type ProductNotificationPreview = {
  id: string
  kind: 'lead' | 'follow_up' | 'approval' | 'booking' | 'todo' | 'deal_won' | 'challenge' | 'badge' | 'streak'
  title: string
  detail: string
  time: string
  day: 'Today' | 'Yesterday'
  unread: boolean
  reactions?: { emoji: '👏' | '🔥' | '🎯'; count: number }[]
  reacted?: ('👏' | '🔥' | '🎯')[]
  sample: true
}
```

Actions and expected calls:

- Load feed → `GET /feed?client_id=…&cursor=…`; return bounded events after team/role/visibility filtering with aggregate reaction counts and the viewer’s reactions. Challenge and score payloads must already obey G-board visibility.
- React → `PUT /feed/:eventId/reactions/:emoji`, `{active:true|false, expected_event_version}` for the allowlist `👏|🔥|🎯`; use unique `(event_id,user_id,emoji)` so retries are idempotent. Return the authoritative count and viewer state.
- Deal won → committed deal transition emits `{kind:'deal_won',actor_id,team_id,deal_id,account_name,value,currency,badge_award_id?,occurred_at}`. G-feed creates the team card; a separate ephemeral response to `actor_id` contains `{celebration:true,new_sprint_total,badge?}` and expires after display. No sound or global overlay is broadcast.
- Badge earned → G-score award emits `{kind:'badge_earned',actor_id,badge_definition_id}` once; feed copy uses the frozen badge version.
- Challenge start/end → G-challenge emits one event per version/result snapshot. Reactions never affect scores.
- Streak-at-risk → scheduler checks G-wellbeing first and delivers only inside work hours when one eligible action remains; cancel when protected/completed and de-duplicate by rep/date/streak.

### AUTH-flows — sign-in, invitation, recovery and session continuity

Required wiring entries (`file:line` · mock type · action → backend call):

- `src/auth/LoginPage.tsx:72-158` · `AuthFailureKind` · Sign in → existing `supabase.auth.signInWithPassword({email,password})`; normalize provider output to `invalid_credentials | rate_limited | network` without exposing raw security detail.
- `src/auth/LoginPage.tsx:164-203` · `InvitePreview` · Open invitation → `supabase.auth.exchangeCodeForSession(code)` plus authorized invitation-context read; Accept/Create account → `supabase.auth.updateUser({password})` after atomically validating `{invite_id,client_id,role,email,expires_at,status:'pending'}` server-side.
- `src/auth/LoginPage.tsx:168-177` · `InvitePreview` · Continue to team overview → resolve the existing membership/profile and let the unchanged `RoleRouter` choose the shell; reject mismatched, revoked or expired invitation context before handoff.
- `src/auth/LoginPage.tsx:205-236` · `PasswordRecoveryPreview` · Send secure link → `supabase.auth.resetPasswordForEmail(email,{redirectTo:existingAuthCallback})`; always return the same sent confirmation and apply tenant/IP/email rate limits.
- `src/auth/LoginPage.tsx:205-236` · `PasswordRecoveryPreview` · Open link / Update password → exchange the single-use recovery token, then `supabase.auth.updateUser({password})`; revoke the token and other sessions according to the security policy before returning to sign-in.
- `src/auth/LoginPage.tsx:238-260` · `SessionExpiredPreview` · Resume workspace → refresh the session first; if reauthentication is required, call the existing password sign-in and restore only the allowlisted in-memory `{pathname,entity_id,draft_key}` after the authoritative role check.
- `src/auth/LoginPage.tsx:298-318` · `AuthFailureKind | InvitePreview | PasswordRecoveryPreview | SessionExpiredPreview` · Preview tabs/error controls/soft-expiry launch → no backend call; remove review-only controls from production exposure when the flows are wired.
- `src/auth/authPreviewMocks.ts:1-58` · all AUTH-flows preview contracts · Replace fixtures → invitation record, provider-neutral error map, recovery policy and current-session context; keep `sample:true` out of live responses.

Flow/security requirements:

- Invitation company, role and email come only from the signed server record. The UI must never accept client-supplied role or tenant identifiers.
- Recovery request remains account-enumeration neutral. Password requirements and token expiry are returned from one versioned auth policy.
- Soft expiry preserves UI context, never secrets or unsent password input. Authorization is re-evaluated before the old object is restored; a failed restore lands in the existing shell rather than creating a route.

### RPT-owner — executive business report and PDF handoff

Required wiring entries (`file:line` · mock type · action → backend call):

- `src/views/dashboard/DashboardScreen.tsx:16,141-144` · `OwnerReportPreview` · Enter `/dashboard` → lazy `GET /reports/owner?client_id=:authorized&period=month&as_of=:tenant_date`; response is tenant-scoped and uses one snapshot/version across every figure.
- `src/views/reports/OwnerBusinessReport.tsx:88-123` · `OwnerReportPreview` · Render executive readout/charts/tables → consume the snapshot unchanged; server supplies closed revenue, target, pipeline stages/coverage, activity, bookings, objection counts and prior-period comparators.
- `src/views/reports/OwnerBusinessReport.tsx:125-150` · `OwnerReportPreview` · Week/Month → refetch `GET /reports/owner?...&period=week|month`; Share as PDF → `POST /reports/owner/exports`, `{client_id,period,as_of,snapshot_version,format:'pdf'}` returning `{export_id,status,expires_at}` and, when ready, an access-controlled signed download URL.
- `src/views/reports/OwnerBusinessReport.tsx:131-133` · `PreviewState` · Loading/empty/error/retry → preserve the last successful snapshot while refetching; retry the same bounded GET and never merge figures from different snapshot versions.
- `src/views/reports/ownerReportMocks.ts:1-146` · `OwnerReportPreview` · Replace weekly/monthly fixtures → immutable report DTO with `{period,comparison,revenue,pipeline,activity,bookings,objections,generated_at,snapshot_version}`; monetary values use minor units plus currency in the live contract.
- `src/index.css:205-314` · `OwnerReportPreview` · Print preview / browser print → no data mutation; use the current authoritative snapshot, hide shell/actions and invoke `window.print()` only after the report has rendered. Server PDF export must use the same A4 template and snapshot version.

Aggregation/export requirements:

- Revenue target, currency, timezone, won-date rules, pipeline coverage denominator and prior-period boundaries are tenant policy, calculated server-side and returned with the snapshot.
- Objection/script outcome figures enforce minimum sample sizes and label correlation rather than attribution. Empty values remain absent/unknown instead of zero.
- Export authorization is checked both when generating and downloading; signed URLs are short-lived, audit logged and never embedded in notifications or broad feed payloads.

### Other preview affordances

- `src/shell/TopBar.tsx:36-45` command palette → role-filtered search/action registry; `⌘K` handler and focus management.
- `src/views/leads/LeadRow.tsx` assignment select consumes `MockControls.tsx:18-37` → assignment mutation `{conversation_id, assigned_to}`; normalized objection capture is now specified by O-capture instead of the previous row select.
- `src/views/inbox/InboxScreen.tsx:374` “AI monitoring” is a presentation placeholder; replace with real handling state (`bot_active`, `bot_paused`, `human_active`) derived from conversation state.

## 6. Known issues and deferrals

- `npm run check:tokens` is expected to fail because `src/ui/tokens.css.sha256` still pins the previous byte-for-byte token file. The guard was not deleted, bypassed, or updated.
- Notification/feed reactions, score/board/badge/challenge projections, streak protection, mood/care signals, manager presence, dashboard/forecast/owner-report rollups and PDF export, invite/recovery/session-resume flows, goals, call sessions/logs/briefs, Gmail/email, copilot tools/autonomy, probability explanations, objection logs/scripts/review, todos, facts, booking, documents, command palette, and voice capture remain explicitly marked Preview/Sample and require the wiring above.
- The existing live `leads.objection` free-text field remains visible below normalized CRM capture during migration. O-capture should backfill/display it carefully, then retire duplicate editing only after normalized logs are authoritative.
- The public `/preview` is a designed mock review surface; it intentionally does not reproduce every authenticated route.
- Focus escape and visible focus are implemented for sheets/notification panels; a production focus trap should be added when dialog primitives are formalized.
- Existing `src/ui/SampleBoard.tsx` and historical screenshots/docs remain as legacy review material; `/preview` and `/kitchen-sink` are the authoritative new-system galleries.
- Existing Vite warning: `AgentLauncher.tsx` is both statically and dynamically imported, so that small launcher module is not split. The heavy `AgentPanel`, call, email, settings and intelligence surfaces are lazy chunks; first-load JS remains below the enforced budget.
- The first-load checker now measures entry/modulepreload assets referenced by `dist/index.html`; it no longer mislabels every on-demand route/sheet chunk as initial JavaScript.
- No automated pixel-diff baseline is committed. Phase 5 browser screenshots remain in Codex task scratch rather than the product repository.

## 7. Screen inventory

| Role | Route | What changed | Loading | Empty | Error |
|---|---|---|---|---|---|
| Rep | `/` | One live value-led action plus call/probability, copilot digest, visibility-safe sprint Momentum, score explainer/freezes, revenue/coverage and returned-call priority | Multi-block hero skeleton plus lazy intelligence/momentum chunk | “Inbox clear” good outcome; private/team comparison remains optional | Existing connection guidance; intelligence remains isolated behind suspense |
| Rep | `/inbox` | Unified WhatsApp/Instagram/Email queue; email thread/compose; calls in headers; AI/human/customer state; objection/script loop and voice UI | Queue/thread bubble skeletons plus dedicated lazy email skeleton | No conversations/filter match; no-standard script flags a manager gap | Inbox load error; script error preserves log; Gmail connection error lives in Settings |
| Rep | `/leads` | Value/probability, visible call, Message/Advance and universal long-press/right-click quick actions; drawer retains objection history | Row skeletons; call brief lazy fallback; probability explanation lazy | Capture teaching/no filter match/no history | Lead load error; independent objection-history error |
| Rep | `/more` | Local Workspace/My Season tabs; Season contains bests, badge shelf, trend, challenge/prize, win moment and optional private mood pulse | Independent season/settings lazy skeletons | First-season personal baseline teaching state | Season retry and Gmail authorization retry states |
| Rep | `/agent` | Tool-using copilot, eight typed actions, explicit autonomy, recognized commands, receipts and voice | Executing shimmer/streaming states | Proposed-work starters and recent receipts | Typed failed action with retry |
| Rep/desktop | `/docs` | One-screen quotation builder plus clean sequential Playbook read mode | Playbook card/page skeletons are implemented via `previewState` | Library search empty and no-standard fallback | Playbook retry state and existing document wiring errors |
| Manager | `/` | Exception-first Floor, copilot-written stuck reasons, ask-copilot explanations, useful presence and private coaching signals | Header/metrics/decision skeletons | Healthy “no manager needed” row | Floor load error; explanations never block primary resolve links |
| Manager | `/inbox` | Shared capture→script loop plus existing assignment/detail rail | Shared | Shared | Shared |
| Manager | `/crm` | Value/probability/call on board cards, shared quick actions, contact relationship timeline, normalized objection history and full todo system | Shared lead skeletons; lazy call/probability surfaces; todo skeleton | Per-tab teaching states and empty todo state | Per-hook errors plus todo retry state |
| Manager | `/dashboard` | Owner business report first, then forecast plus Momentum Rules/Challenge/Board/Care console, both leagues, Rookie Ramp, aggregate mood and objections review | Independent owner-report, forecast, Momentum and objection-review skeletons | First-report teaching state plus Momentum-off, no pipeline and no objection logs | Independent owner-report/policy/forecast/review retry states |
| Manager | `/docs` | Quotation workspace plus Playbook library/editor/compare/promotion/taxonomy/read modes | Playbook skeleton state implemented | Search/filter empty; new taxonomy can start from zero | Playbook retry state preserves document workspace |
| Admin | `/` | Health summary then bounded exception panels | Three-row skeleton | Each healthy section says what is working | Health load error |
| Admin | `/inbox` | Shared Inbox | Shared | Shared | Shared |
| Admin | `/crm` | Shared CRM | Shared | Shared | Shared |
| Admin | `/dashboard` | Shared analytics plus owner report | Shared owner-report skeleton | Shared first-report state | Shared owner-report retry state |
| Admin | `/docs` | Shared documents | Shared | Shared | Shared |
| Public | `/preview` | Sixteen-section gallery adding complete auth-edge review and the print-safe owner report to prior phase surfaces | App suspense plus on-demand call/season/console/report surfaces | Deterministic `sample: true` owner-report teaching state available through component API | Designed auth failures plus report/Gmail/tool/policy failure demonstrations |
| Public | `/kitchen-sink` | All primitives plus notifications, voice, facts, approvals, two themes | Skeleton examples | Empty-state examples | Error/Toast examples |
| Public | `/samples` | Legacy sample route retained and working | Existing | Existing | Existing |
| Auth | `/*` signed out | Editorial identity plus autofill-ready login; local invite and recovery previews; hard-expiry fallback | Gate skeleton and explicit submit progress | Neutral email-sent and successful invite/reset handoffs | Wrong-password, rate-limit and network guidance plus context-preserving soft expiry preview |

## 8. Self-review and verification

- Rep can identify the next action in under two seconds: yes; it is the first and only filled primary button.
- Manager sees exceptions before feed/analytics: yes.
- One obvious action per region: yes; secondary operations are ghost/outline or progressive disclosure.
- Both themes: visually reviewed at 1440×1000 and 390×844.
- Accessibility: no unlabeled icon buttons in preview audit; visible focus; AA spot checks; reduced-motion; keyboard Escape verified for sheets and notifications.
- Visual QA: no console/page errors; `scrollWidth === viewport` at desktop and phone.
- Interaction QA: notification mark-read, sheet Escape close, voice cancel, and theme switching passed.
- Objection self-review: detected Price → confirmed/logged → company standard visible with its primary insert action in one interaction sequence and under the first 390px phone viewport; optional context never blocks it.
- Manager self-review: Monday mode presents one insight at a time with keyboard/visible navigation and can run the review from frequency through a promotion decision without leaving `/dashboard`.
- Playbook self-review: the library reads as a governed standard, the editor makes version lineage explicit, and the day-one view removes management controls for reps.
- Phase 2 interaction QA: AI objection confirm, script sheet, script insert-to-draft callback, Playbook editor assist, weekly review next/close, and theme switch passed at 1440×1000 and 390×844.
- Phase 3 “entire day” review: a rep can act on Today, call with a brief, capture an outcome/callback/objection, work WhatsApp/Instagram/Email, use templates/AI draft, assign/follow up, open booking/docs, and delegate eight bounded copilot tools without leaving the product shell.
- Phase 3 revenue review: deal value/probability is visible on Today, lead rows, pipeline cards and contact/email headers; rep target/coverage and manager scenario forecast keep the next revenue constraint explicit.
- Phase 3 call speed review: Start call is one confirmation after the brief; Closed/Progressing/No answer logs in one outcome tap; objection/callback logs in a second detail tap; voice note and dismiss remain optional.
- Phase 3 copilot review: every action names its type/target, exposes edit/approve/dismiss, shows executing and done/failed receipts, and keeps autonomy visible; recognized commands are previewed before execution.
- Phase 3 browser QA: call brief → return → objection log; email quote expand + AI draft; tool approve → execute → done; recognized command; forecast scenario; and Gmail error → retry → connected all passed in light/dark at 1440×1000 and 390×844.
- Phase 3 browser audit: zero console errors, zero page errors, zero unlabeled buttons, and `documentElement.scrollWidth === viewport` in all four scenarios.
- Phase 4 #8-of-9 review: the low-position rep is framed as one good day away and receives improvement/next-action language; no last-place, worst-rep, bottom-ranked or red-zone-bottom language renders anywhere.
- Phase 4 visibility review: Full board Today exposes only current/next rung; Top-3 returns three names plus personal pace; Private returns no other rep; the manager rep preview updates immediately and the automated scope audit found no fourth-place leak in Top-3.
- Phase 4 well-being review: quiet hours remove positions, gaps and countdowns; streak protection remains visible; weekends/leave/holidays are automatic; manual spend explains exactly what changes; mood copy says private-to-aggregate at capture and manager trend.
- Phase 4 points review: the explainer covers all four sources, weights and personal points in one sheet; daily caps are visible; call/objection receipts reward the loop without hiding cap rules.
- Phase 4 celebration review: the closer-only overlay is restrained, CSS-only, auto-closes in 1.9s and has a reduced-motion static fallback; team members see feed entries/reactions only.
- Phase 4 browser QA: score explainer, freeze spend, mood response, timed win moment, visibility change, sum-to-100 slider, quiet preview, challenge/prize/launch preview, Improvement board drill-in, Rookie Ramp, care acknowledgment and feed reaction all passed in light/dark at 1440×1000 and 390×844.
- Phase 4 browser audit: 72 interaction checks across four scenarios, zero console/page errors, zero unlabeled buttons, no no-shame phrase leaks and `documentElement.scrollWidth === viewport` throughout.
- Phase 5 first-impression review: the signed-out page communicates customer context → next action → business signal before credential entry on desktop, while mobile places a compact identity moment immediately above the autofill-ready form. No invented working product name or public marketing route was added.
- Phase 5 auth-edge review: invite context → password → success, recovery request → sent → reset → success, invalid/rate/network failures, hard-expiry fallback and context-preserving soft expiry are all reachable and explicitly marked Preview where unwired.
- Phase 5 CFO review: the report’s first viewport states revenue attainment, month/week direction, pipeline coverage, execution, bookings and one decision to watch; tables repeat every charted figure, and no interaction is required to understand the period.
- Phase 5 print review: A4 print media hides the shell/actions and forces a high-contrast light report even from dark mode; UI-only PDF and print-preview receipts explicitly say that no file was created or shared.
- Phase 5 browser QA: 72 interaction checks across light/dark at 1440×1000 and 390×844 covered every invite/recovery step, three auth failures, both expiry treatments, period comparison, PDF affordance and print preview.
- Phase 5 browser audit: zero console/page errors, zero unlabeled buttons, `documentElement.scrollWidth === viewport` on auth and preview surfaces, and computed print isolation confirmed report visible / actions hidden / gallery shell hidden in all four scenarios.
- Production verification commands and their final results:
  - `git diff --check` — passed.
  - `npm test` — passed: 3 files, 27 tests.
  - `npm run check:no-service-role` — passed: no service-role markers in `src/`.
  - `npm run build` — passed: TypeScript, Vite, 1,952 transformed modules, PWA manifest/service worker/icons, and 157.2 KB gzip true first-load JavaScript against the 200 KB budget.
  - `npm run check:tokens` — expected failure only: recorded `c778238…`, live `098f7e1…`. The checksum guard remains intact and deliberately reports the intentional visual-system rewrite.

## Audit-findings-fixed

Final production gate, 2 August 2026:

- Rep Inbox — no UI fix was applied in this round. The deployed WhatsApp thread failure met the explicit stop condition before the broader rep/manager/admin polish sweep could begin.
- Repository fence — `src/lib/` and `src/auth/` were not modified. The only repository change in this stopped round is this evidence report.

## Inbox-bug-verification

Environment and steps:

- Deployed URL: `https://sales-app-joyal.zeabur.app/inbox`.
- Account: demo rep in `Vidya Sagar Academy (Demo)`.
- Viewport/theme at reproduction: 1440×1000, light.
- Inbox scope `All` selected; channel `All` selected; status `Open` selected.
- The queue rendered `10 conversations in view`: seven WhatsApp rows and three Instagram rows. Email remained the marked preview row.
- Selected the live WhatsApp row `Anjali Nair` (`a0de0002-0000-4000-8000-000000000001`). The selected row painted, but the complete conversation pane remained visually blank. Evidence screenshot: `live-rep-inbox-thread.png` in the Codex task outputs.

Browser evidence:

- Console errors: none.
- Console warnings: none attributable to the app.
- The accessibility snapshot briefly contained the selected contact/context rail, then the live screen returned to the queue with no thread timeline. No designed loading, empty or error state explained the blank pane.

Production API evidence, using `.env.production` public Supabase configuration and the authorized demo-rep session:

- Auth request: HTTP `200`.
- Conversations request: HTTP `200`; response body is an array of `10` rows, including Anjali Nair/WhatsApp, Rahul Krishnan/WhatsApp, fathima.beevi/Instagram, Arjun Menon/WhatsApp, sneha.pillai_/Instagram, Mohammed Rafi/WhatsApp, Divya Raj/WhatsApp, vishnu.prasad.94/Instagram, Aiswarya Thomas/WhatsApp and Nithin Varghese/WhatsApp.
- Messages request for Anjali: HTTP `200`; response body is an array of `7` rows:
  1. inbound/customer — `Hello, is the NEET repeater batch for 2027 still open`
  2. outbound/bot — `Namaskaram Anjali. Yes, our NEET Repeater 2027 batch has seats open. Classes begin on 12 August at our Kaloor campus.`
  3. inbound/customer — `What is the fee and is hostel available`
  4. outbound/bot — `Full year fee is 45000 rupees including study material. Hostel is separate at 6500 per month, girls and boys blocks both available.`
  5. inbound/customer — `My daughter scored 480 in the last attempt. Will she get a scholarship`
  6. outbound/agent — `Hi, this is Athira from admissions. With 480 she qualifies for our 20 percent merit waiver. Shall I hold a seat for two days`
  7. inbound/customer — `Yes please hold it. I will visit on Saturday`

Conclusion:

- This is not missing seed data, RLS denial or a failed messages response. The production service returns the complete queue and message timeline with HTTP 200, while the deployed UI does not render the timeline.
- Local `.env` currently points at `local.invalid`; `.env.production` contains the working public production configuration. This local mismatch does not explain the deployed blank pane and was not changed after the production failure triggered the stop gate.
- `src/lib/inbox-data.ts` still contains the redundant `setLoading(true)` in the successful `useQueue` path immediately before `setError(null)`/`setItems(...)`. It was deliberately not removed because `src/lib/` is read-only in this round.

## India-formatting

- Not executed in this stopped round. The requested single UI formatter, repository-wide ₹ audit, mixed-script preview proofs and call-prominence changes remain pending because the production inbox gate failed before code changes were authorized to begin.

## Still-open

- Blocker — a deployed WhatsApp/Instagram selection can leave the conversation pane blank even though the production messages response is HTTP 200 with rows. This needs owner-approved frontend debugging outside the current stop fence; no `src/lib/` workaround was attempted.
- The requested rep/manager/admin sweep across light/dark and 390/1440 viewports remains pending after the inbox blocker is resolved or the stop gate is explicitly lifted.
- The India currency formatter, mixed Devanagari/Malayalam/Hinglish proof cases, call-first hierarchy, impossible-to-miss follow-up stack and five-second manager Floor refinement remain pending for the same reason.
