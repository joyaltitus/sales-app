# UX World-Class 01 — findings

Severity: **P0** blocks a core workflow or materially misrepresents production state; **P1** seriously harms comprehension, trust, or mobile use; **P2** is meaningful polish or resilience work.

## Slop copy

- **P1** — Rep Today opens with multiple slogans and narrative labels before actionable work, obscuring the day's priority (`src/views/rep/Today.tsx:330`).
- **P1** — Manager Floor announces “Preview intelligence” and an unsupported AI narrative even when there is no operational data (`src/views/manager/Floor.tsx:117`).
- **P1** — Dashboard, Docs, Health, and Teardown repeat marketing-style page slogans inside an authenticated work tool (`src/views/dashboard/DashboardScreen.tsx:175`, `src/views/docs/DocsStudio.tsx:23`, `src/views/admin/Health.tsx:64`, `src/views/manager/Teardown.tsx:269`).
- **P2** — Attribution, Broadcasts, and Templates devote excessive vertical space to policy/explanatory prose before the primary task (`src/views/attribution/AttributionView.tsx:161`, `src/views/outbound/Broadcasts.tsx:87`, `src/views/outbound/Templates.tsx:71`).
- **P2** — Login uses a decorative grid and aspirational headline that visually compete with the sign-in action (`src/auth/LoginPage.tsx:319`, `src/index.css:144`).

## Fake data

- **P0** — Empty Today fabricates callback work, counts, target progress, pipeline value, and hot/cooling signals instead of showing a truthful empty state (`src/views/rep/Today.tsx:40`, `src/views/rep/TodayIntelligence.tsx:6`; `empty/agent-today-light-base-390x844-part-01.png`).
- **P0** — Empty Follow-ups silently falls back to named sample contacts and monetary values, making seeded records look live (`src/views/crm/FollowUpsTab.tsx:160`, `src/views/crm/followUpMocks.ts:17`; `empty/agent-crm-followups-light-base-390x844.png`).
- **P0** — Notification Center appends 11 fake people, reactions, and revenue events to live results and displays a false unread indicator (`src/ui/NotificationCenter.tsx:52`, `src/ui/NotificationCenter.tsx:200`, `src/ui/NotificationCenter.tsx:285`).
- **P0** — Relationship Timeline merges fixed email events into real history (`src/views/crm/RelationshipTimeline.tsx:13`, `src/views/crm/RelationshipTimeline.tsx:96`).
- **P1** — My Season and Rep Momentum present invented points, badges, rankings, prizes, challenges, mood, and wins as production performance (`src/views/momentum/MySeason.tsx:11`, `src/views/momentum/RepMomentum.tsx:9`, `src/views/momentum/momentumMocks.ts:108`; `empty/agent-more-light-base-390x844-part-01.png`).
- **P1** — Agent Panel claims it “found work worth moving” when there is no work (`src/views/agent/AgentPanel.tsx:208`).
- **P1** — Manager rail says “AI is standing by” without a supporting state or action (`src/shell/ManagerShell.tsx:117`).
- **P2** — Preview/login mock controls and invite/session-expiry fixtures are interleaved with production screen code and should be isolated in Preview Gallery (`src/auth/LoginPage.tsx:56`, `src/views/crm/MockControls.tsx:1`).

## Layout and clipping

- **P0** — Notification and command-palette overlays are rendered inside TopBar's backdrop-filter containing block, so their fixed backdrops/panels are trapped at header height and underlying controls remain visible (`src/shell/TopBar.tsx:60`, `src/shell/TopBar.tsx:126`, `src/ui/NotificationCenter.tsx:296`; `live-before/rep-flow-notifications-1280x900.png`, `live-before/rep-flow-command-palette-1280x900.png`).
- **P0** — Manager mobile navigation compresses 12 destinations into a ten-column, 56 px-high strip; labels clip and targets fall well below 44×44 px (`src/shell/ManagerShell.tsx:155`; `empty/manager-dashboard-operate-light-base-390x844-part-01.png`).
- **P0** — Client-admin mobile navigation compresses 15 destinations into equal columns, producing one-letter labels and unusable touch targets (`src/shell/AdminShell.tsx:168`; `empty/client-admin-health-light-base-390x844-part-01.png`).
- **P1** — CRM's five-tab strip clips later destinations on 390 px screens without an edge affordance (`src/views/crm/CrmScreen.tsx:56`; `empty/agent-crm-contacts-light-base-390x844.png`).
- **P1** — Playbook's five-tab strip truncates “Settings” mid-word on 390 px screens (`src/views/docs/Playbook.tsx:106`; `empty/agent-docs-playbook-light-base-390x844-part-01.png`).
- **P1** — Extension Call HUD can truncate seat-link and currency controls at narrow widths (`extension/ui/CallHud.tsx:454`; `ext-before/09-following-chat-light.png`).
- **P2** — The global grid texture remains visible behind dense authenticated content in both themes, adding noise throughout manager/admin screens (`src/index.css:144`, `src/shell/ManagerShell.tsx:128`, `src/shell/AdminShell.tsx:141`).

## Hierarchy and typography

- **P1** — Dashboard gives four zero KPI cards tall, equal prominence, repeats three more zero summaries, then renders an oversized ₹0 hero (`src/views/dashboard/DashboardScreen.tsx:194`, `src/views/dashboard/DashboardScreen.tsx:210`, `src/views/dashboard/charts.tsx:56`).
- **P1** — Empty Health renders three full diagnostic sections and KPI cards with no data, so the page feels longer without adding decisions (`src/views/admin/Health.tsx:64`, `src/views/admin/Health.tsx:86`).
- **P1** — Empty Floor and Teardown retain large explanatory sections after their decision content disappears (`src/views/manager/Floor.tsx:139`, `src/views/manager/Teardown.tsx:343`).
- **P2** — Broadcasts duplicates its primary “New broadcast” action and Templates repeats explanatory footer content, weakening the main action hierarchy (`src/views/outbound/Broadcasts.tsx:87`, `src/views/outbound/Templates.tsx:71`).

## States

- **P0** — Several production surfaces replace absent data with samples instead of explicit loading, empty, error, and unavailable states (`src/views/rep/Today.tsx:280`, `src/views/crm/FollowUpsTab.tsx:160`, `src/ui/NotificationCenter.tsx:200`).
- **P1** — Go Live can expose the raw fallback “unknown” for a malformed/empty readiness response instead of a recovery-oriented state (`src/views/manage/GoLive.tsx:96`, `src/views/manage/GoLive.tsx:148`).
- **P1** — Forecast retry is a no-op and the widget exposes internal roadmap copy (“deferred”) to users (`src/views/revenue/ForecastWidget.tsx:24`, `src/views/revenue/ForecastWidget.tsx:92`).
- **P1** — Team falls back to “Unnamed” when profile data is absent rather than a stable identifier or an explicit incomplete-profile state (`src/views/team/TeamPage.tsx:183`).
- **P2** — Avatar fallback can render a centered dot for missing identity, which is visually ambiguous (`src/ui/Avatar.tsx:20`).

## Flow friction

- **P0** — Command-palette destinations are absolute unprefixed paths; role routing catches them and redirects users to role home instead of the requested screen (`src/shell/TopBar.tsx:26`, `src/shell/TopBar.tsx:53`, `src/shell/RoleRouter.tsx:76`).
- **P0** — Core CTAs across Today, Dashboard, Floor, Notification Center, Follow-ups, and Lead Quick Actions use the same broken unprefixed navigation pattern (`src/views/rep/Today.tsx:369`, `src/views/dashboard/DashboardScreen.tsx:198`, `src/views/manager/Floor.tsx:127`, `src/ui/NotificationCenter.tsx:266`, `src/views/crm/FollowUpsTab.tsx:142`, `src/views/leads/LeadQuickActions.tsx:32`).
- **P1** — Lead Quick Actions exposes six equal-weight buttons, including dead Email/Assign actions and “Preview not wired” copy (`src/views/leads/LeadQuickActions.tsx:28`).
- **P1** — Extension outcome and note are saved through separate actions, increasing the chance that call context is lost (`extension/ui/OutcomeBar.tsx:161`, `extension/ui/OutcomeBar.tsx:205`).
- **P1** — Extension following status collapses to generic “open a chat” copy and does not distinguish the required linked, stale, and missing-context states (`extension/ui/FollowingChip.tsx:16`, `extension/app/App.tsx:301`).
- **P2** — Owner Report offers a “PDF handoff preview” action that does not create or share a report (`src/views/reports/OwnerBusinessReport.tsx:165`).

## Accessibility

- **P0** — Manager and client-admin bottom-navigation targets are substantially smaller than the 44×44 px phone minimum (`src/shell/ManagerShell.tsx:155`, `src/shell/AdminShell.tsx:168`).
- **P1** — Several phone actions use 32–36 px minimum heights, including Dashboard export and compact Today actions (`src/views/dashboard/DashboardScreen.tsx:217`, `src/views/rep/Today.tsx:369`).
- **P1** — CRM and Playbook tabsets visually clip options and provide no obvious scroll affordance or alternate “More” access on mobile (`src/views/crm/CrmScreen.tsx:56`, `src/views/docs/Playbook.tsx:106`).
- **P2** — Extension Call HUD uses emoji glyphs for outcome-quality buttons, yielding inconsistent platform rendering and weaker accessible naming than product icons (`extension/ui/CallHud.tsx:548`).

## Performance

- **P1** — First-load JavaScript is 179.7 KB gzip, only 20.3 KB below the 200 KB budget; changes need bundle-delta checks (`perf.md`).
- **P2** — `PreviewGallery` is the largest route chunk at 21,388 B gzip; keeping production mocks isolated there prevents fixture UI from inflating critical paths (`perf.md`, `src/views/preview/PreviewGallery.tsx:1`).
- **P2** — The full test suite took 144.19 s and had one load-sensitive timeout before passing in isolation, so phase checks should preserve isolated reruns and report both results (`perf.md`).

## Bugs

- **P0** — Supabase realtime WebSocket handshakes return HTTP 502 in the live demo tenant, leaving Inbox on fallback polling (`live-before/README.md`; `live-before/rep-flow-thread-draft-1280x900.png`).
- **P0** — Role-prefixed routing and absolute unprefixed internal links combine to make important CTAs silently land on role home (`src/shell/TopBar.tsx:26`, `src/shell/RoleRouter.tsx:76`).
- **P1** — An expired Instagram avatar URL returns HTTP 403 on every live Contacts visit; fallback UI prevents a broken image but the request still emits a console error (`live-before/README.md`; `live-before/rep-crm-contacts-light-base-1280x900.png`).
- **P1** — Funnel percentage calculation can divide by zero and render `NaN%` when the previous stage is empty (`src/views/dashboard/charts.tsx:129`).
- **P1** — The committed extension screenshot harness expects a `Snippets` control that is absent when the library is empty, so the documented evidence run stops after eight screenshots (`scripts/ext-shots.mjs:202`).
- **P2** — Lead rows invent “Call and confirm…” when `next_action` is absent, presenting a default instruction as customer-specific work (`src/views/leads/LeadRow.tsx:149`).

## Remaining in Phase 0

- Obtain working manager credentials and client-admin credentials, then run both roles through every route at both viewports and themes.
- Capture manager/admin mid-flow evidence, Approvals, and the live extension WhatsApp loop without leaking credentials or personal data.
- Recheck realtime after the demo Supabase proxy's WebSocket 502 is resolved.
- Re-rank any finding contradicted or amplified by real account data, then open the Phase 0 evidence PR.
