# UI audit — UI-DESIGN-01 (2026-07-31, overnight)

Input to the redesign: every concrete problem found in the current app. The redesign
must close every item or state why it stays (table at the end). Screenshots referenced
live in `docs/ui-review/audit-before/`.

**Audit scope honesty:** the session ran unwatched; demo passwords are stdin-only by
design and exist in no file, so the authenticated screens could not be walked live.
Public routes (`/login`, `/kitchen-sink`, `/samples`) were walked in a real browser at
390px and 1440px, both themes. Authenticated screens were audited from source
(all view/shell/ui files read in full) and re-verified visually through the `/preview`
gallery replicas built this session — same components, mock data.

## Findings

### Identity & first impression
- **A1 — Login has no identity.** No mark, no wordmark treatment, `Sign in` at 20px
  looks like a settings dialog. On 1440px the card is a small island in a void; the
  page has no composition. First impression for a buyer is "internal tool".
  (`login-desktop-light.png`)
- **A2 — Theme flash on first paint.** `index.html` hardcodes `data-theme="light"`;
  the stored/OS theme applies only after React mounts (`theme.ts` effect). A
  dark-theme user gets a white flash on every cold load. `<meta name="theme-color">`
  is hardcoded to the dark canvas — wrong status-bar colour in light mode (A18 folded in).
- **A7 — TopBar shows a hardcoded "AI on" success chip** (comment admits placeholder
  wiring). A fake health signal is an enterprise-credibility risk worse than no signal.

### Depth & hierarchy
- **A3 — No elevation system.** Depth is border-only everywhere; every surface is the
  same white/near-black. Light theme reads flat; dark theme surfaces (#0f1211 vs
  #171b1a) are so close that cards barely separate from canvas.
- **A5 — Dashboard has no lead number.** Four equal stat tiles; panel titles are the
  same 12px caps as tile labels — everything whispers, nothing sells. The handoff
  acceptance ("one number the eye lands on first") fails today. Chart bars use
  `--fg-subtle` ink, which is also the disabled colour — charts read as placeholders.
  Leaderboard rows are cramped (py-2 with 12px caps headers).
- **A4 — No spacing tokens.** Rhythm is ad-hoc Tailwind (`p-4`, `gap-3`, `mb-5`,
  `py-2.5`) — mostly on the 4px grid but unencoded, and density is uneven (48px
  TopBar vs airy content vs cramped tables).

### States
- **A8 — The signature transition does not exist.** `Sheet` mounts with
  `transition-transform` already in final position (`if (!open) return null`), so the
  slide never animates, and there is no exit. Same for the overlay fade.
- **A10 — Skeletons are nearly invisible** in light theme (`surface-sunk` #f4f4f2 on
  canvas #fbfbfa ≈ imperceptible). Loading reads as a blank page.
- **A9 — EmptyState's dashed ghost box reads as an unfinished component**, not a
  designed moment (`kitchensink-desktop-light.png`, EMPTYSTATE section).
- **A13 — No ErrorState component.** Errors are ad-hoc (`<p class="text-danger">` on
  Login) or absent (screens render nothing designed on fetch failure).

### Consistency & polish
- **A6 — `capsStyle` inline-style duplication** in 6+ files (QueueRow, Thread, charts,
  Today, Dashboard…) re-implements what `.label-caps` already is — one drifted copy
  away from inconsistency.
- **A12 — Danger button is the only opacity-hover** (`hover:opacity-90`); every other
  variant hovers through token ramps.
- **A11 — Focus ring radius mismatch**: global outline uses `--radius-sm` on
  `--radius-md` controls; 2px offset clips inside dense list rows.
- **A14 — `TrendLine` uses `preserveAspectRatio="none"`** — stroke geometry distorts
  as the panel resizes.
- **A15 — Login: no autofocus on email**; keyboard-open on phone shifts the centered
  card (no scroll-padding strategy).
- **A16 — Queue-row right-edge stacking**: assignee + "Needs human" + unread pill can
  collide with the preview truncation at 390px.
- **A17 — Bottom-tab active state is colour-only** (accent text) — weak for CVD; no
  weight/indicator change.

## Closed / kept table

| item | status | how |
|---|---|---|
| A1 | CLOSED | Login rebuilt: seam-motif composition, neutral mark (no invented name), display-type treatment, `/preview` replica |
| A2 | CLOSED | Inline pre-paint theme script in `index.html` + dynamic `theme-color` sync in `theme.ts` |
| A3 | CLOSED | Elevation tokens `--elev-1/2` + `--surface-raised` (dark lightens surfaces instead of shadows); borders stay the primary cue (§1.10 #3 respected) |
| A4 | CLOSED | Spacing tokens `--space-1..10` (4px base) in tokens.css; edited components consume them |
| A5 | CLOSED | Dashboard hero band (one display numeral), panel title/caption hierarchy, chart ink `--chart-ink`, leaderboard rhythm |
| A6 | CLOSED | `.label-caps` consolidated (colour via utility); inline copies removed in edited files |
| A7 | CLOSED | Fake chip removed; only the real signal (offline) renders. PROPOSED-SUPERSESSION #3 covers the future real AI-health wire |
| A8 | CLOSED | Sheet/overlay animate in (200ms ease-out slide + fade) and honour reduced-motion; exit stays instant-unmount (cheap, honest) — the signature motion now exists |
| A9 | CLOSED | EmptyState redesigned (icon tile on `--surface-raised`, title/body rhythm, action) |
| A10 | CLOSED | `--skeleton` token with real contrast both themes |
| A11 | CLOSED | Focus outline radius follows the control (`outline-offset` 1px on list rows); ring token per direction |
| A12 | CLOSED | Danger hover/active ramps (`--danger-hover/-active`) added to tokens |
| A13 | CLOSED | `ErrorState` component (honest words + retry) shipped in `src/ui/`; wired on edited screens |
| A14 | CLOSED | TrendLine redrawn with computed viewBox, `vector-effect="non-scaling-stroke"` |
| A15 | CLOSED | `autoFocus` + `scroll-py` on the auth page |
| A16 | CLOSED | Right-edge chips capped to 2 with min-preview width; verified at 390px in gallery |
| A17 | CLOSED | Active tab gains weight-600 + 2px top indicator bar |
| A18 | CLOSED | folded into A2 |

## PROPOSED-SUPERSESSION list (Joyal approves/rejects each; nothing silently violated)

1. **Display type stop `--text-2xl` (32px)** — MASTER-PLAN §C froze the 12–24 scale;
   §1.6 "the type scale is not extended" was ruled for queue-row context. The
   dashboard hero numeral and the login mark want one display stop. It is a token:
   reverting = one line (`--text-display: var(--text-xl)`), all usage sites follow.
2. **tokens.css byte-sync with Workbench** — tokens.css changed (checksum updated
   same-commit as its guard requires). Workbench's copy must be re-synced at merge
   or its CI fails. Mechanical copy, listed as a morning step.
3. **TopBar "AI on" chip removed** — §C "visible health" intended a real signal;
   the placeholder was fake. Restore only when a real per-client bot-state read
   exists (flag/`runtime_flags` wire — separate session).
4. **Elevation shadows (whisper-quiet, paired with borders)** — §1.10 #3 bans
   drop-shadow as the *primary* depth cue. Here borders remain primary; `--elev-*`
   adds ≤ 6% alpha ambient lift on light theme only. If rejected: set both `--elev-*`
   tokens to `none`, system still works.

## Direction swap (the one-line contract)

`index.html` `<html …>` carries `data-direction`. The three directions:

```
<html data-direction="graphite">   ← D1 restrained-neutral
<html data-direction="evergreen">  ← D2 warm-professional (default today: absent attribute = frozen SA-00 tokens)
<html data-direction="ledger">     ← D3 bold-minimal
```

Morning apply = edit that one attribute in `index.html` (plus PROPOSED #2 sync if
tokens changed). All direction CSS lives in `src/ui/directions.css` behind the same
semantic roles; no component knows which direction is active.
