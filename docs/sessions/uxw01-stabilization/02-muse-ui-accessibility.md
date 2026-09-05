# Lane B — web UI and accessibility (Muse Spark 1.3, effort xhigh)

Worktree: `/Users/joyaltitus/Documents/wt/uxw01-ui`
Branch: `uxw01/ui`, based on `13a1d23`. `npm ci` already done.

You are running **at the same time as two other agents** on the same repository,
in different worktrees. They own files you must never open. If you edit a file
outside your allowlist you will destroy their work in the merge.

## Rules — read these before any edit

1. **Only edit files in the allowlist below.** If a change seems to need any
   other file: **stop, do not edit it, and write the reason in your final
   report.** Do not "just fix it while I'm here."
2. **No opportunistic refactoring.** No renaming, no reordering imports, no
   reformatting, no tidying, no extracting helpers. Change only the lines each
   task names.
3. **Never edit `src/ui/tokens.css`.** CI checksums it; any edit fails the build.
4. **Never delete a feature.** Some screens show placeholders for features Joyal
   planned but has not built. Those are not bugs. Leave them.
5. **Never stage the whole tree** (no `git add -A`, no `git add .`). The repo
   contains untracked screenshots with real phone numbers. Always
   `git add <explicit path>`.
6. Every task below states exactly what to change and what must not change. If a
   task's described current code does not match what you find, **stop and report
   it** rather than guessing.

## Files you may edit — nothing else

```
src/ui/Button.tsx
src/ui/Sheet.tsx
src/shell/RepShell.tsx
src/shell/ManagerShell.tsx
src/shell/AdminShell.tsx
src/views/crm/PipelineStrip.tsx
src/views/crm/BoardView.tsx
src/views/crm/CrmScreen.tsx
src/views/docs/playbook/ReadView.tsx
src/views/docs/playbook/EditorView.tsx
src/views/docs/playbook/DialectEditor.tsx
src/views/docs/playbook/SettingsView.tsx
src/auth/LoginPage.tsx
src/views/agent/AgentScreen.tsx
```
Plus a co-located `*.test.tsx` for any of the above.

## Files that will destroy another agent's work — do not open to edit

Everything else. Especially: `src/ui/tokens.css`, `src/ui/EmptyState.tsx`,
`src/shell/TopBar.tsx`, `src/shell/RoleRouter.tsx`, `src/shell/ClientProvider.tsx`,
`src/views/rep/*`, `src/views/inbox/*`, `src/views/crm/TodosTab.tsx`,
`src/views/crm/LeadDrawer.tsx`, `src/views/crm/FollowUpsTab.tsx`,
`src/views/crm/AddLeadModal.tsx`, `src/views/crm/BookingsTab.tsx`,
`src/views/docs/Playbook.tsx` (note: the file directly in `docs/`, **not** the
`docs/playbook/` folder, which is yours), `src/views/preview/PreviewGallery.tsx`,
all of `extension/`, `.env*`, `.github/`, `.claude/`.

---

## Task 1 — REG-029: give `Button` a default type

**File:** `src/ui/Button.tsx`
**Current:** the component renders a bare `<button>` spreading `{...rest}` with
**no `type`**. HTML defaults an untyped button inside a form to `submit`. There
are ~99 untyped raw buttons in the app; this one line removes the whole class of
risk without touching any of them.
**Change:** make the rendered button default to `type="button"` while still
allowing a caller to pass `type="submit"` explicitly.
**Must not change:** the existing `disabled={disabled || loading}` behaviour, the
`aria-busy` attribute, any class string, any variant.
**Test to add** (`src/ui/Button.test.tsx`, create if absent):
- renders with `type="button"` by default;
- `<Button type="submit">` still renders `type="submit"`.
**Do not** edit the ~99 other buttons. That is explicitly out of scope.

## Task 2 — REG-045: lock background scroll while a Sheet is open

**File:** `src/ui/Sheet.tsx`
**Current:** the only effect in the file is an Escape-key listener. Nothing ever
writes `document.body.style.overflow`, so the page scrolls behind every open
sheet. This file is the root cause for 13+ consumers at once.
**Change:** add one `useEffect`, shaped like the existing Escape effect, that
sets `document.body.style.overflow = 'hidden'` while `open` is true and restores
the **previous** value (not a hardcoded `''`) on cleanup.
**Must not change:** the Escape listener, the backdrop click handler, the
`role="dialog"` / `aria-modal` / `aria-label` attributes, the `if (!open) return
null` early return.
**Explicitly NOT in scope:** focus trap, initial focus, focus return. Those are
deferred to Phase 2 by decision. Do not attempt them.
**Test to add** (`src/ui/Sheet.test.tsx`): open, assert
`document.body.style.overflow === 'hidden'`; unmount/close, assert restored.

## Task 3 — REG-052: seven contrast fixes, exactly seven lines

Measured: `--fg-subtle` `#66726c` on `--surface-sunk` `#edf0ec` is **4.36:1**,
below the 4.5 AA threshold. `--fg-muted` `#4d5a54` on the same background is
**6.29:1** and passes. Contrast does not change with font size, so bumping px
would not help.

Change `text-fg-subtle` to `text-fg-muted` at these six places:
- `src/views/crm/PipelineStrip.tsx` — the "Win rate" meta label
- `src/views/crm/PipelineStrip.tsx` — the `{won}W {lost}L` figure
- `src/views/crm/BoardView.tsx` — the empty-column vertical stage label
- `src/views/crm/BoardView.tsx` — the lead-count figure
- `src/views/crm/BoardView.tsx` — the column currency total
- `src/views/crm/BoardView.tsx` — the "Nothing here." empty text

And one more, in `src/views/docs/playbook/ReadView.tsx`: the large zero-padded
section number is `text-border-strong`, which is **1.51:1** — it fails even the
3:1 large-text rule. Change it to `text-fg-subtle` (4.83:1 on `--surface`).
This is the only `text-border-strong` used as text anywhere in the repo.

**CRITICAL — do not sweep.** `BoardView.tsx` has two *more* elements using the
identical `text-fg-subtle` classes on the **lead cards**. Those cards sit on
`bg-surface`, not `bg-surface-sunk`, so they measure 4.83:1 and **already pass**.
Changing them is wrong. Only change the six listed above, all of which are inside
a `bg-surface-sunk` container.

**Must not change:** any font size, weight, spacing, or layout. Colour class
only. Never edit `tokens.css`.

## Task 4 — REG-055: the Editor tab has a `<main>` inside the shell's `<main>`

**File:** `src/views/docs/playbook/EditorView.tsx`
**Current:** it renders a `<main>` element, and `AdminShell` already renders a
`<main>` around it. Duplicate, non-top-level, non-unique — three axe landmark
violations from one tag.
**Change:** that one element from `<main>` to `<section>` (and its closing tag).
**Must not change:** its className, its children, anything else in the file.

## Task 5 — REG-056: a plain button inside a tablist

**File:** `src/views/docs/playbook/DialectEditor.tsx`
**Current:** the container div has `role="tablist"`. Inside it, rendered only
when `onAddLanguage` is passed, sits a plain `<button>` with a `+ language`
label. A non-tab child of a tablist is an axe **critical**
(`aria-required-children`).
**Change:** move that button so it is a **sibling of** the tablist container, not
a child. Keep it visually adjacent — same row, same styling.
**Must not change:** its `onClick` handler, its label, its classes, the tab
buttons, the roving `tabIndex`, the arrow-key handler.
**Explicitly NOT in scope:** replacing the `window.prompt` call with an inline
form, and making arrow keys move DOM focus. Both are deferred to Phase 2. Leave
the `window.prompt` exactly as it is.
**Note:** this component has two call sites; only one passes `onAddLanguage`, so
only one renders the button. Both must still render correctly.

## Task 6 — REG-051: label the complementary landmarks in your files

Unlabeled `<aside>` elements produce axe `landmark-unique` violations when two
are visible at once. Add a short, specific `aria-label` to the `<aside>` in each
of these — and only these:
- `src/shell/RepShell.tsx` (the desktop sidebar)
- `src/views/docs/playbook/EditorView.tsx` (the script picker)
- `src/views/docs/playbook/SettingsView.tsx` (the "what the rep sends" preview)

Choose a label that names what the panel contains. **Must not change:** the
element type, classes, or contents. Other unlabeled asides exist in files owned
by another agent — leave them.

## Task 7 — REG-047: add a skip link to each shell

**Files:** `src/shell/RepShell.tsx`, `src/shell/ManagerShell.tsx`,
`src/shell/AdminShell.tsx`.
**Current:** no skip-to-content link exists anywhere in the app.
**Change:** in each shell, add a visually-hidden-until-focused anchor as the
first focusable element, pointing at that shell's `<main>`, and give that
`<main>` a matching `id`. Use the same id and the same class pattern in all
three. The link must be invisible until keyboard-focused, then clearly visible.
**Must not change:** the nav, the `<main>` classes, routing, or layout.
**Explicitly NOT in scope:** adding a `contentinfo`/footer landmark. There is no
footer content; deferred.

## Task 8 — manager mobile nav wraps to two rows

**File:** `src/shell/ManagerShell.tsx`
**Current:** the mobile nav is a grid with **ten** columns, but the rail array
holds **twelve** items. The last two silently wrap onto a second row on a phone.
Joyal's frozen decision: the manager experience must be mobile-correct.
**Change:** make the mobile nav hold all twelve items without wrapping and
without any item falling below a 44px touch target. A horizontally scrollable
single row with a visible scroll affordance is acceptable; so is a correct
twelve-column grid if every target stays at least 44px wide at 390px.
**Must not change:** the rail contents or order, the desktop rail, the unread
badge, the active-state styling, or `AdminShell`'s nav — admin's 15-item mobile
nav is an **accepted non-goal**, explicitly out of scope.
**Verify at 390px width.**

## Task 9 — REG-002 (CRM only): tab strips clip with no affordance

**File:** `src/views/crm/CrmScreen.tsx`
**Current:** the CRM tab strip and stage-tile strip use `overflow-x-auto` with a
`no-scrollbar` utility, so at 390px content is cut mid-word ("Bookings") with no
visual sign that more exists.
**Change:** give the strip a visible overflow affordance — an edge fade, or allow
wrapping, or restore a slim scrollbar. Pick one and use it consistently for both
strips in this file.
**Must not change:** the tab order, labels, `aria-selected` behaviour, or the
routing/query-param logic. Other clipped strips live in files owned by another
agent; do not touch them.

## Task 10 — REG-054: two screens have no `<h1>`

**File:** `src/views/agent/AgentScreen.tsx` — currently renders **no heading at
all**. Add a single `<h1>` naming the screen, matching how other screens title
themselves (a plain noun, sentence case, no slogan).
**Also:** in `src/views/crm/BoardView.tsx` the stage-column label is an `<h3>`
directly under the screen's `<h1>`, which skips `<h2>`. Change that one element
to `<h2>`.
**Must not change:** `src/ui/EmptyState.tsx` — it renders an `<h3>` and is shared
by many screens; changing it breaks heading order elsewhere. Another screen's
missing `h1` is owned by another agent.

## Task 11 — REG-004: login divider strikes through the paragraph

**File:** `src/auth/LoginPage.tsx`
**Current:** a decorative hairline is positioned absolutely at a fixed percentage
of the card height, while the content beside it is vertically centred. At 1440px
the line crosses the body paragraph.
**Change:** make the decoration never overlap text — reposition it relative to
the content flow, or remove it. Verify in both themes at 1440px and 390px.
**Must not change:** the form, its fields, validation, autofocus, the product
mark, or any copy.

## Task 12 — REG-008: the command palette cannot be opened on a phone

**Current:** the palette trigger in the top bar is `hidden … lg:flex`, and the
only other way in is a keyboard shortcut. On a phone there is no way to open it.
**The trigger lives in `src/shell/TopBar.tsx`, which another agent owns.**
**Therefore: do not implement this.** Write in your final report that REG-008
requires a `TopBar.tsx` change owned by lane A, and leave it. This task exists
only so you do not "discover" it and edit a forbidden file.

---

## Gates — run all six, all must pass

```
npx tsc -b
npm test
npm run build
npm run check:no-service-role
npm run check:tokens
npm run ext:build
```

Expected: `tsc` prints nothing. `npm test` passes (the suite is flaky under
load — if a few files time out, re-run just those files before reporting a
failure). `npm run build` prints a first-load line at or below **171.8 KB gz**
and a PWA line. `check:tokens` prints a checkmark — **if it fails you edited
`tokens.css`; revert that immediately.** `ext:build` completes.

If a gate fails because of a change you made, fix it. If it fails for a reason
you cannot trace to your own edits, stop and report — do not "fix" unrelated code.

## Screenshots

Not required for this lane. Lane D captures evidence. Do not run
`scripts/ext-shots.mjs` — it imports Playwright by absolute path from a sibling
repository and will fail or mislead.

## Commit and push

Commit in small groups, one per task or per pair of related tasks, with a short
message naming the REG id. Stage explicit paths only. Push `uxw01/ui`.
**Do not open a pull request. Do not merge anything. Do not touch `main`.**

## Final report

Write `docs/sessions/uxw01-stabilization/HANDOFF-ui.md` listing, per task: done
or not, the file and what changed, the test you added, and anything you stopped
on. Be honest about anything you skipped — an accurate "not done" is worth more
than a guess.

## Checklist

- [ ] 1 Button default type + test
- [ ] 2 Sheet scroll lock + test (no focus trap)
- [ ] 3 Seven contrast lines (and NOT the two passing lead-card ones)
- [ ] 4 EditorView main to section
- [ ] 5 DialectEditor add-button moved out of tablist (prompt untouched)
- [ ] 6 Three aside labels
- [ ] 7 Skip link in three shells
- [ ] 8 ManagerShell mobile nav holds 12 items, 44px targets at 390px
- [ ] 9 CrmScreen strip affordance
- [ ] 10 AgentScreen h1 + BoardView h3 to h2
- [ ] 11 LoginPage divider
- [ ] 12 REG-008 reported, not implemented
- [ ] six gates green
- [ ] committed, pushed, HANDOFF-ui.md written

**Do not stop after the first task or the first green test. Work the whole
checklist.**
