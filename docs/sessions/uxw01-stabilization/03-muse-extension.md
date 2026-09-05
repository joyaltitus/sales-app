# Lane C — extension presentation (Muse Spark 1.3, effort xhigh)

Worktree: `/Users/joyaltitus/Documents/wt/uxw01-ext`
Branch: `uxw01/ext`, based on `13a1d23`. `npm ci` already done.

You are running **at the same time as two other agents** on the same repository
in different worktrees. They own files you must never edit.

## Rules — read before any edit

1. **Only edit files in the allowlist.** If a fix seems to need another file:
   **stop, do not edit it, report it.**
2. **No opportunistic refactoring.** No renames, no import reordering, no
   reformatting, no extracting shared helpers unless a task says to.
3. **Never delete a feature.** Some labels and states in this extension are
   deliberate and unit-tested — notably the `untested` script chips, which are
   **intentional and must stay exactly as they are**. Some other things are
   features Joyal planned but has not wired yet. Leave all of it. Fix only
   layout, contrast, truncation, labelling and formatting defects.
4. **Never stage the whole tree** (no `git add -A`, no `git add .`). The repo
   holds untracked screenshots containing real phone numbers. Stage explicit
   paths.
5. This is a Chrome side panel. Its surfaces render at roughly **400px wide**.
   Every touch target must end up at least **44x44px**.

## Files you may edit — nothing else

```
extension/ui/LeadScreen.tsx
extension/ui/ObjectionChips.tsx
extension/ui/RebuttalCard.tsx
extension/ui/RoadmapStage.tsx
extension/ui/FollowingChip.tsx
extension/ui/ScriptSheet.tsx
extension/ui/CrmScreen.tsx
extension/ui/SaveLeadCard.tsx
extension/ui/TargetBar.tsx
extension/ui/ConversationReview.tsx
extension/ui/Input.tsx
extension/ui/time.ts
extension/app/screens/LibraryScreen.tsx
extension/app/OptionsPage.tsx
```
Plus co-located `*.test.ts(x)` for any of the above.

## Files another agent is editing right now — do not open to edit

```
extension/ui/OutcomeBar.tsx      <-- lane A owns it (objection default fix)
extension/ui/CallHud.tsx         <-- lane A owns it (token id, seat link, targets)
extension/lib/*                  <-- lane A owns outbox-store.ts
extension/app/App.tsx
everything under src/
```
If a task below seems to require one of these, **stop and report it.**

---

## Task 1 — REG-016: an unsaved chat's phone number lands in the Name field

**File:** `extension/ui/SaveLeadCard.tsx`
**Current:** when the open WhatsApp chat is not in the CRM, the Add-lead form is
seeded from the chat. The seed sets `name` to the chat's display name. When the
contact is unsaved, that display name **is the phone number**, so the form shows
`Name: +91 90000 11122` *and* the phone field filled, and the preview says it
will save as `+91…`. A lead gets created with a phone number as its name.
**The correct logic already exists in this same file** — there is a
`seedFrom()`-style helper that splits a value into name-vs-phone by whether it
looks numeric. The chat path bypasses it.
**Change:** route the chat seed through that existing helper so a numeric display
name fills **phone only** and leaves **name empty**.
**Must not change:** the non-chat seed path, the form fields, the save handler,
or the preview text template.
**Test:** in `extension/ui/SaveLeadCard.test.tsx`, add a case with a numeric
`displayName` asserting the name input is empty and the phone input is filled.
Existing fixtures use a human name — keep those tests passing unchanged.

## Task 2 — REG-017: touch targets below 44px

Bring interactive elements in **your files** up to at least 44x44px. Known
offenders, by file:
- `extension/ui/LeadScreen.tsx` — the Back, Open-chat and phone controls (32-36px)
- `extension/ui/ObjectionChips.tsx` — chips at 36px
- `extension/ui/RebuttalCard.tsx` — the expand control (~26px)
- `extension/ui/RoadmapStage.tsx` — the expand controls (~26px)
- `extension/ui/FollowingChip.tsx` — the switch at 32px
- `extension/ui/CrmScreen.tsx` — filter chips at 32px
- `extension/ui/SaveLeadCard.tsx` — filter chips at 32px
- `extension/ui/ScriptSheet.tsx` — the Close control (~36px)
- `extension/ui/Input.tsx` — search/time inputs at 40px
- `extension/app/OptionsPage.tsx` — the icon control at 40px
- `extension/app/screens/LibraryScreen.tsx` — filter chips at 32px

**Method:** raise the min-height/min-width (and padding where needed) using the
same Tailwind utility style already present in the file. Prefer growing the hit
area over growing the visible box where the design is tight.
**Must not change:** labels, icons, colours, ordering, or handlers.
**Note:** the audit listed four paths that do not exist. The list above is the
corrected one. If a file named here has no such control, skip it and say so.

## Task 3 — REG-022: the Save-conversation form is trapped in a nested scroller

**File:** `extension/ui/ConversationReview.tsx`
**Current:** a `max-h-72 overflow-y-auto` container sits inside the already
scrolling panel body, so the Cancel and Save buttons fall below the fold and reps
abandon the save.
**Change:** remove the nested scroll container so the panel scrolls once, and
make sure Cancel and Save are reachable at 400x900.
**Must not change:** the form fields, the save handler, or the message list
contents.

## Task 4 — REG-023: the rebuttal preview cuts off the close

**File:** `extension/ui/RebuttalCard.tsx`
**Current:** the preview slices to the first few lines and additionally clamps to
two lines, so the actual closing sentence — the part the rep needs to say — is
cut mid-phrase. The only escape is the tiny expand control from Task 2.
**Change:** show the full close, or add an explicit, clearly labelled "More"
affordance that is at least 44px tall.
**Must not change:** the rebuttal content, ordering, or the `untested` chip
(see rule 3 — that chip is intentional).

## Task 5 — REG-024: one time format and one money format

**Files:** `extension/ui/time.ts`, `extension/ui/ConversationReview.tsx`,
`extension/ui/TargetBar.tsx`, `extension/ui/SaveLeadCard.tsx`
**Current:** times render both as 24-hour (`22:57`, via the shared helper) and as
a raw locale string (`8:42 pm, 02/09/2026`, by rendering the timestamp directly).
Money renders as `1.9L` / `4L` short form next to `2,500` long form, and preset
chips use `60K` / `1L` beside a placeholder written `60,000`.
**Change:** pick **one** time format and **one** money format, and apply them
consistently across these four files. Use the existing shared helper in
`extension/ui/time.ts` for every time; if a money helper does not exist, add a
small one **in `extension/ui/time.ts` or a new tiny module inside your
allowlist** and use it everywhere in your files.
**Must not change:** the underlying values, any stored data, or formatting in
files outside your allowlist. If a money format is also used in `CallHud.tsx` or
`OutcomeBar.tsx`, **leave those alone** and note the inconsistency in your report.
**Test:** a small unit test for the money helper covering zero, thousands,
lakhs, and a null/undefined input.

## Task 6 — REG-025: the Following control is a switch wearing CTA copy

**File:** `extension/ui/FollowingChip.tsx`
**Current:** an element with `role="switch"` is labelled `Following — open a
chat`, which is an instruction, not a state. The same label also shows for group
chats, which are deliberately ignored.
**Change:** label it as a state: the followed contact's name when following, and
a clear paused/idle state otherwise. Give the "no chat open" case and the
"group chat, not followed" case **distinct** text so a rep can tell them apart.
**Must not change:** the `role="switch"`, the toggle handler, or the group-chat
behaviour itself.

## Task 7 — REG-027: the Library shows raw template placeholders

**File:** `extension/app/screens/LibraryScreen.tsx`
**Current:** template text renders with unmerged placeholders such as `{{name}}`
visible to the rep, because the merge only covers a couple of fields.
**Change:** render a readable preview — substitute a neutral sample value for
unmerged placeholders so no `{{…}}` reaches the screen.
**Must not change:** the stored template text, the merge logic used at send time,
or which templates are listed.

---

## Verification

Run all six gates:
```
npx tsc -b
npm test
npm run build
npm run check:no-service-role
npm run check:tokens
npm run ext:build
```
Expected: `tsc` silent; tests pass (flaky under load — re-run individual files
before declaring a regression); `ext:build` completes near 665 kB;
`check:tokens` prints a checkmark.

**Do not run `scripts/ext-shots.mjs`.** It imports Playwright by an absolute path
into a different repository on this machine, needs a display, and will either
fail or produce results you cannot trust. Screenshot evidence is lane D's job.
**Never claim "26/26 harness verified" — you are not running the harness.**

You can and should verify layout by reading the JSX and reasoning about the
400px width. State clearly in your report which changes you verified only by
reading, and which by test.

## Commit and push

Small commits, one per task, message naming the REG id. Stage explicit paths.
Push `uxw01/ext`. **Do not open a pull request, do not merge, do not touch
`main`.**

## Final report

Write `docs/sessions/uxw01-stabilization/HANDOFF-ext.md`: per task, done or not,
files touched, tests added, anything you stopped on, and any file you wanted to
edit but could not because another lane owns it.

## Checklist

- [ ] 1 SaveLeadCard numeric name to phone only + test
- [ ] 2 Tap targets 44px across the listed files
- [ ] 3 ConversationReview single scroll
- [ ] 4 RebuttalCard full close or real More
- [ ] 5 One time format + one money format + helper test
- [ ] 6 FollowingChip state labels, three distinct cases
- [ ] 7 LibraryScreen placeholder preview
- [ ] six gates green
- [ ] committed, pushed, HANDOFF-ext.md written
- [ ] `untested` chips untouched, no feature removed

**Do not stop after the first task. Work the whole checklist.**
