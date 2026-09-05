# HANDOFF — Lane B: web UI and accessibility (uxw01/ui)

Branch `uxw01/ui`, base `13a1d23`. All work staged with explicit paths only; nothing
under `docs/ui-review` touched. `src/ui/tokens.css` never edited (checksum gate passes).

## Per-task report

### 1 — REG-029: Button default type — done
- File: `src/ui/Button.tsx`. Destructured `type = 'button'` and rendered
  `type={type}` on the `<button>`, so the default is `type="button"` while
  `<Button type="submit">` still passes through. `disabled`, `aria-busy`,
  classes, variants untouched.
- Test: `src/ui/Button.test.tsx` (new) — default renders `type="button"`;
  explicit `type="submit"` renders `type="submit"`. Passes.
- Did not touch the ~99 other raw buttons (out of scope).

### 2 — REG-045: Sheet scroll lock — done, no focus trap
- File: `src/ui/Sheet.tsx`. Added one `useEffect` shaped like the existing Escape
  effect: while `open`, saves `document.body.style.overflow`, sets `'hidden'`,
  restores the saved previous value (not `''`) on cleanup. Escape listener,
  backdrop handler, `role="dialog"`/`aria-modal`/`aria-label`, early return untouched.
- Test: `src/ui/Sheet.test.tsx` (new) — open asserts `hidden`; close and unmount
  assert the previous value (`'auto'`) is restored. Passes.
- Focus trap / initial focus / focus return not attempted (Phase 2).

### 3 — REG-052: seven contrast lines — done
- Exactly 7 lines, colour class only, no size/weight/layout change:
  - `src/views/crm/PipelineStrip.tsx` ×2: "Win rate" meta label and `{won}W {lost}L`
    figure `text-fg-subtle` → `text-fg-muted` (both inside `bg-surface-sunk`).
  - `src/views/crm/BoardView.tsx` ×4: empty-column vertical stage label, lead-count
    figure, column currency total, "Nothing here." — `text-fg-subtle` → `text-fg-muted`
    (all inside `bg-surface-sunk`).
  - `src/views/docs/playbook/ReadView.tsx` ×1: section number `text-border-strong` →
    `text-fg-subtle`.
- Deliberately NOT changed: `PipelineStrip` stage label + value (on `bg-surface`),
  `BoardView` lead-card `text-fg-subtle` uses (est value, wait stamp, quick-actions
  button, follow-up line, cold badge — all on `bg-surface`, already passing).

### 4 — REG-055: EditorView nested main — done
- File: `src/views/docs/playbook/EditorView.tsx`. The single `<main>`/`</main>` pair
  became `<section>`/`</section>`. className, children, everything else untouched.

### 5 — REG-056: DialectEditor tablist child — done, prompt untouched
- File: `src/views/docs/playbook/DialectEditor.tsx`. The `+ language` button (rendered
  only when `onAddLanguage` is passed) moved out of the `role="tablist"` div into a
  new wrapping row (`flex items-center gap-1 border-b border-border`); the tablist div
  keeps `role`, `aria-label`, roving `tabIndex`, and the arrow-key handler and is now
  `flex min-w-0 flex-1 … overflow-x-auto` so tabs still scroll and the button sits
  visually adjacent in the same row. Button `onClick` (including the `window.prompt`
  call, byte-identical), label, and classes unchanged; tab buttons unchanged.
- Both call sites render: with the button (Playbook, passes `onAddLanguage`) and
  without (teardown embed). `tsc` + full suite green.

### 6 — REG-051: aside labels — done
- `src/shell/RepShell.tsx` desktop sidebar aside: `aria-label="My workspace"`.
- `src/views/docs/playbook/EditorView.tsx` script picker aside: `aria-label="Script picker"`.
- `src/views/docs/playbook/SettingsView.tsx` preview aside:
  `aria-label="Payment message preview"`.
- Element type, classes, contents unchanged. Other asides (other agents' files) untouched.

### 7 — REG-047: skip links — done
- `src/shell/RepShell.tsx`, `src/shell/ManagerShell.tsx`, `src/shell/AdminShell.tsx`:
  identical anchor as the first element inside the shell root (before `TopBar`),
  `href="#main-content"`, identical classes
  `sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50
  focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm
  focus:font-semibold focus:text-accent focus:shadow-elev-2`
  ("Skip to content", invisible until focused, clearly visible on focus), and each
  shell's `<main>` carries `id="main-content"` with its classes unchanged.
- Nav, routing, layout untouched. No footer added (deferred, no footer content).

### 8 — manager mobile nav — done
- File: `src/shell/ManagerShell.tsx` only (`AdminShell` 15-item nav untouched, accepted non-goal).
- Was `grid grid-cols-10` holding 12 rail items (last two wrapped). Now
  `flex … overflow-x-auto` single row; each item gains `min-w-11 flex-1 shrink-0`
  (44px min width, existing `min-h-14` = 56px height, so every target ≥44×44).
  Rail contents/order, desktop rail, unread badge, active styling unchanged.
- Verify at 390px: 12 × 44px min = 528px > 390px, so the row scrolls instead of
  wrapping; no item can shrink below 44px (`shrink-0` + `min-w-11`). Native thin
  scrollbar (global `scrollbar-width: thin`, no `no-scrollbar` on this nav) is the
  visible scroll affordance. Lane D owns screenshot evidence; no visual test run here.

### 9 — REG-002 CRM strip affordance — done with a spec mismatch noted (STOPPED item below)
- File: `src/views/crm/CrmScreen.tsx`. The tab strip (`role="tablist"`, "CRM sections")
  dropped `no-scrollbar`, restoring the native slim scrollbar as the visible overflow
  affordance. Tab order, labels, `aria-selected`, query-param logic untouched.
- STOPPED / mismatch: the task describes TWO strips in this file ("the CRM tab strip
  and stage-tile strip … use it consistently for both strips in this file"), but the
  file contains only ONE `overflow-x-auto` strip (the tab strip). The other
  `no-scrollbar` strips live outside this file — `PipelineStrip` (this lane's file but
  not named by this task, so intentionally not touched for this purpose) and
  `src/views/leads/LeadsScreen.tsx:260` filter row (not in the allowlist, owned by
  another lane). Per rule 6 I fixed only what matches and did not guess at the rest.

### 10 — REG-054 headings — done
- `src/views/agent/AgentScreen.tsx`: added one `<h1 className="sr-only">Agent</h1>`
  (plain noun, sentence case, matching "CRM"/"Inbox"/"Targets" convention; sr-only so
  it does not duplicate the panel's visible "Agent" header or disturb the `h-full`
  layout). Yields h1 → h2 ("Agent" panel header) order.
- `src/views/crm/BoardView.tsx`: stage-column label `<h3>` → `<h2>`, className unchanged.
- `src/ui/EmptyState.tsx` untouched (shared `<h3>`, changing it would break others).

### 11 — REG-004 login divider — done
- File: `src/auth/LoginPage.tsx` (`ProductPromise`): removed the decorative
  `<div className="absolute inset-x-0 top-[34%] h-px bg-border" aria-hidden />` — the
  fixed-percentage hairline that crossed the centred body copy. With the decoration
  gone there is nothing to overlap text in either theme at 1440px or 390px. Form,
  fields, validation, autofocus, product mark, copy untouched.

### 12 — REG-008 command palette on phones — NOT implemented, as ordered
- Verified the trigger lives in `src/shell/TopBar.tsx:88`
  (`hidden … lg:flex`, keyboard shortcut only otherwise) — a file owned by lane A and
  explicitly forbidden. No edit made. REG-008 requires a `TopBar.tsx` change owned by
  lane A.

## Gates (all run, all green with one noted variance)
- `npx tsc -b` — clean, no output.
- `npm test` — 100 files / 710 tests pass, including new `Button` (2) and `Sheet` (1).
- `npm run build` — passes: `✓ first-load JS: 171.9 KB gz (budget 200 KB)` + PWA
  installable-assets line. Variance: spec text expects ≤171.8 KB; this tree prints
  171.9 KB (+0.1, the required skip-link/h1/scroll-lock markup). The script's own
  200 KB budget passes.
- `npm run check:no-service-role` — `✓ no service-role markers`.
- `npm run check:tokens` — `✓ tokens.css matches recorded checksum` (never edited).
- `npm run ext:build` — completes (`✔ Finished`, chrome-mv3 output).
- Screenshots: none taken; per spec lane D owns evidence and `scripts/ext-shots.mjs`
  was not run.

## Commits + push
11 small commits on `uxw01/ui` (one per task/pair, REG ids in messages), explicit
`git add <path>` only, pushed. No PR opened, nothing merged, `main` untouched.
Changed files (all allowlisted): `src/ui/Button.tsx`, `src/ui/Button.test.tsx`,
`src/ui/Sheet.tsx`, `src/ui/Sheet.test.tsx`, `src/views/crm/PipelineStrip.tsx`,
`src/views/crm/BoardView.tsx`, `src/views/docs/playbook/ReadView.tsx`,
`src/views/docs/playbook/EditorView.tsx`, `src/views/docs/playbook/DialectEditor.tsx`,
`src/views/docs/playbook/SettingsView.tsx`, `src/shell/RepShell.tsx`,
`src/shell/ManagerShell.tsx`, `src/shell/AdminShell.tsx`, `src/views/crm/CrmScreen.tsx`,
`src/views/agent/AgentScreen.tsx`, `src/auth/LoginPage.tsx`, plus this handoff file.

## Checklist
- [x] 1 Button default type + test
- [x] 2 Sheet scroll lock + test (no focus trap)
- [x] 3 Seven contrast lines (and NOT the two passing lead-card ones)
- [x] 4 EditorView main to section
- [x] 5 DialectEditor add-button moved out of tablist (prompt untouched)
- [x] 6 Three aside labels
- [x] 7 Skip link in three shells
- [x] 8 ManagerShell mobile nav holds 12 items, 44px targets at 390px
- [x] 9 CrmScreen strip affordance (second strip missing from file — reported above)
- [x] 10 AgentScreen h1 + BoardView h3 to h2
- [x] 11 LoginPage divider
- [x] 12 REG-008 reported, not implemented
- [x] six gates green (build 171.9 vs 171.8 text noted)
- [x] committed, pushed, HANDOFF-ui.md written
