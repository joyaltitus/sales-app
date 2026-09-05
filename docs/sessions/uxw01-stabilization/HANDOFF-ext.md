# HANDOFF — Lane C extension presentation (uxw01/ext)

Branch `uxw01/ext`, 7 commits on top of `13a1d23`. All work inside the
spec allowlist. Layout verified by reading JSX at 400px width unless a test
is named; no harness run (lane D's job).

## Per task

### 1. REG-016 numeric chat name — DONE
- `extension/ui/SaveLeadCard.tsx`: added `seedFromChat()` routing the chat
  seed through the existing `seedFrom()` split; numeric display name leaves
  Name empty, phone from `phoneE164`. Applied to both the initial `chat`
  seed and the "Use open chat" tap. Non-chat path, fields, save handler,
  preview template unchanged.
- `extension/ui/SaveLeadCard.test.tsx`: new case — numeric `displayName`
  `+91 90000 11122` asserts Name empty, Phone `+919000011122`.
  Verified by test (10/10 in file pass).

### 2. REG-017 touch targets 44px — DONE with two skips
- Raised to `min-h-11`/`h-11`/`min-w-11` (plus `min-h-11` on text/time/search
  inputs via their `className` pass-through): LeadScreen Back / Open-chat /
  phone; ObjectionChips chips; RebuttalCard back + expand; RoadmapStage
  collapsed rows, both expands, hook variants; FollowingChip switch;
  CrmScreen date chips + Retry; SaveLeadCard presets + Not-now + 4 inputs;
  ScriptSheet dialect chips; LibraryScreen dialect chips + search input;
  OptionsPage delete icon (`h-11 w-11`), time inputs, snippet title input,
  CrmScreen search input.
- Labels, icons, colours, ordering, handlers unchanged.
- SKIPPED, not edited: `extension/ui/Input.tsx` does not exist (nothing to
  fix); the ScriptSheet "Close" control lives in `src/ui/Sheet.tsx`, which
  lane A owns (`everything under src/`) — left alone.
- Verified by reading (measured Tailwind sizes); `tsc` + full suite green.

### 3. REG-022 nested scroller — DONE
- `extension/ui/ConversationReview.tsx`: removed `max-h-72 overflow-y-auto`
  from the message `<ul>`; panel scrolls once, Cancel/Save stay in flow.
  Fields, handler, list contents unchanged. Verified by reading.

### 4. REG-023 rebuttal preview cuts the close — DONE
- `extension/ui/RebuttalCard.tsx`: kept the 3-paragraph/2-line preview, added
  an explicit full-width labelled `More` button (`min-h-11`,
  `aria-label="Show full <label>"`) calling the existing `onExpand`.
  Content, ordering, `untested` chip untouched. Verified by reading + `tsc`.

### 5. REG-024 one time + one money format — DONE (money unified; time exception noted)
- `extension/ui/time.ts`: added `formatMoney()` — the ONE extension money
  format (compact Indian K/L/Cr, `—` for null/undefined/NaN, never ₹0).
- `extension/ui/TargetBar.tsx`: all amounts via `formatMoney`; fixed the
  `₹2,500`-style outlier (`toLocaleString`) to `₹2K`. No more `src/`
  money import in this file.
- `extension/ui/SaveLeadCard.tsx`: placeholder `₹60,000` → `₹60K` to match
  the `₹25K…₹1.5L` preset chips (presets themselves live in
  `src/lib/lead-fields.ts`, lane-A owned, already compact — not touched).
- `extension/ui/time.test.ts` (new): zero → `₹0`; thousands → K; lakhs/crores;
  null/undefined → `—`. `TargetBar.test.tsx` updated to the unified format.
  Verified by test (4/4 + 3/3 pass).
- TIME exception: `ConversationReview` stamps are verbatim WhatsApp locale
  strings (`8:42 pm, 02/09/2026`), not ISO. Running them through
  `formatClock` misparses DD/MM (verified: parses as Feb 9, not Sep 2) and
  `extension/lib/wa-chat.ts` (lane A) explicitly forbids re-parsing. Left
  verbatim; all ISO times in owned files already use `formatClock`/`formatDay`.
- Left alone per spec and noted: `CallHud.tsx:463` (`₹… seat link`,
  `toLocaleString`) and any `OutcomeBar.tsx` money — other lane owns both.

### 6. REG-025 Following switch copy — DONE (caller wiring still needed)
- `extension/ui/FollowingChip.tsx`: `role="switch"` + handler + group-ignore
  behaviour unchanged. Labels now state, all containing Following/Not
  following: `Not following chats` (paused) · `Following <name>` ·
  `Following — no chat open` (replaces the instructional `open a chat`) ·
  `Following — group not followed` (new, behind optional `isGroup`).
- `extension/ui/FollowingChip.test.tsx` (new): three cases incl. no-chat vs
  group distinctness. Verified by test (3/3).
- STOPPED, not edited: distinguishing a live group from no-chat needs
  `extension/app/App.tsx` + `extension/app/follow-chat.ts` +
  `extension/lib/wa-chat.ts` (all other-lane owned) to thread the chat kind
  through. The component accepts optional `isGroup` (defaults false, existing
  caller unaffected); until the owning lane passes it, groups read as
  `no chat open`. No file outside the allowlist was touched.

### 7. REG-027 Library raw placeholders — DONE
- `extension/app/screens/LibraryScreen.tsx`: preview-only `PREVIEW_SAMPLES`
  + `previewVars()`; card preview and the opened `ScriptSheet` display use
  sampled vars so no `{{…}}` reaches the screen. Stored text, send-time
  `renderSnippet` merge (still real rep/client values), and listing unchanged.
- `extension/app/screens/library-screen.test.tsx`: new case — "The offer"
  card contains no `{{` and shows `Sample course`. Verified by test (11/11).

## Gates (all green, this worktree)
- `npx tsc -b` — silent, exit 0
- `npm test` — 100 files / 716 tests pass
- `npm run build` — ok; first-load JS 171.8 KB gz; PWA 45 entries / 1104.27 KiB
- `npm run check:no-service-role` — checkmark
- `npm run check:tokens` — checkmark
- `npm run ext:build` — ok, 666.31 kB total (near the 665 kB mark)
- `scripts/ext-shots.mjs` — never run, per spec. No harness claim made.

## Preservation
- `untested` chips untouched (no edits to `WinRateChip` logic or labels).
- No feature removed: presets, group-ignore, fallbacks, spins, sheet flows intact.
- No whole-tree staging; every commit used explicit paths.

## Commits (7, one per task)
`76ff26d` REG-016 · `0b75f1d` REG-017 · `ab0fb18` REG-022 ·
`80f5670` REG-023 · `44757ac` REG-024 · `2b8b8b2` REG-025 · `b238443` REG-027.
