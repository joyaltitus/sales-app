# sales-app

Manager + rep views for the sales ecosystem (MASTER-PLAN §A — the plan lives at
`hub-service/docs/product/MASTER-PLAN.md`; there is no copy in this repo). Phone-first PWA for
reps (bottom tabs), desktop-first for managers (left rail). Owns the shared design
system source (`src/ui/tokens.css`), byte-copied into Workbench.

Neutral placeholder name — no brand decided.

## Stack
Vite 6 · React 18 · TS · Tailwind 4 · react-router 6 · supabase-js 2 · vite-plugin-pwa.

## Laws that touch this repo
- **Anon key only** — service-role material must never enter the bundle (law 8).
  CI grep tripwire enforces (`npm run check:no-service-role`).
- **Design tokens are the contract** — `src/ui/tokens.css` is checksum-guarded
  against the Workbench copy.
- Writes go through the back/front contract classes (§E): RLS-safe direct,
  validated RPCs, or hub-service HTTP (W3, `src/lib/api.ts`).

## Dev
```
cp .env.example .env   # fill SUPABASE_URL + anon key
npm install
npm run dev
```
Design routes (no auth): `/kitchen-sink` (primitives × 6 states), `/samples`
(hue + font decision board).

Extension end-to-end (real Chrome, real backend, headed — MV3 service workers
do not register headless). Credentials come from the environment only; this is
deliberately **not** in CI, which has none:
```
npm run ext:build
EXT_E2E_EMAIL=… EXT_E2E_PASSWORD=… npm run ext:e2e
```

## Build / deploy
`npm run build` → gates: first-load JS < 200KB gz + PWA assets present.
Zeabur static site; `/version.json` stamped with the git SHA — read back after deploy.

## Structure
`src/{auth,shell,lib,ui,views/{rep,manager},pwa}` — see MASTER-PLAN §A.
