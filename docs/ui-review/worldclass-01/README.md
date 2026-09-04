# UX World-Class 01 — review evidence

Phase 0 baseline captured on 2026-09-04 from branch `ux/worldclass-01`.

## Evidence sets

- [`empty/`](./empty/) — 398 route/state screenshots across agent, manager, and client-admin roles at 1280×900 and 390×844, in light and dark themes. Long pages are split into numbered scroll segments.
- [`ext-before/`](./ext-before/) — 26 extension screenshots: 13 scenes in light and dark themes.
- [`live-before/`](./live-before/) — 80 authenticated rep route screenshots plus 8 mid-flow screenshots from the real demo tenant.
- [`findings.md`](./findings.md) — prioritized review findings tied to source lines or evidence.
- [`perf.md`](./perf.md) — build, test, and browser performance baseline.

## Capture method

The empty-state sweep used an isolated browser context, a seeded non-production session, deterministic Supabase response interception, and a mocked realtime socket. It visited every routed screen and discoverable semantic tab for each role and theme. The run captured zero page, console, or request failures and zero document-level horizontal-overflow assertions.

All 398 web screenshots and all 26 extension screenshots were visually reviewed through contact sheets. The extension harness's committed `Snippets` selector no longer matches the empty library UI; the evidence run used the visible `Too expensive` objection instead, and the harness was restored unchanged. This mismatch is recorded as a product-test finding.

## Outstanding Phase 0 evidence

The supplied rep account was validated and swept. The supplied manager credentials were rejected by the authentication service, and no client-admin credentials were supplied, so those two role sweeps remain pending. Credentials remained in memory/stdin and were not written to this repository, logs, screenshots, commits, or PR text.
