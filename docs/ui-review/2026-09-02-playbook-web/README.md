# PLAY-A — Sales Hub playbook, settings, courses, script voice, teardown

Captured 2026-09-02 with `scripts/web-shots.mjs` (Playwright). No live login:
the Supabase origin is intercepted and answered from fixtures shaped like
migration 068's demo tenant, and a session is seeded into localStorage — the
same trick `scripts/ext-shots.mjs` uses for the extension.

Re-run:

```
VITE_SUPABASE_URL=https://shots.invalid VITE_SUPABASE_ANON_KEY=x npm run dev
VITE_SUPABASE_URL=https://shots.invalid node scripts/web-shots.mjs
```

Every shot asserts `scrollWidth - clientWidth <= 1` before it is taken, so
**no horizontal scroll at 390** is checked rather than eyeballed. All 22 passed.

## Files

Naming: `<n>-<screen>-<width>-<theme>.png`.

| File | What it shows |
|---|---|
| `01-library-1280-light.png` · `-390-` · `-dark` (4) | Library: "Call roadmap" numbered in call order, "Objections", win-rate chips (`71% · 24 rated`, `early · 3`, `untested`), version chips, dialect dots, filter row |
| `02-editor-manglish-1280-light.png` · `-390-` | Editor on the **Manglish** tab: authoring textarea, "As the rep sees it" preview merging real NEET-batch numbers, merge-token palette, Copy from English |
| `03-settings-1280-light.png` · `-390-` | Settings: dialect chips (English locked on), default dialect, UPI/payee/https-only pay link, token amount + note, and the live seat-reservation text the rep will send |
| `04-courses-1280-light.png` · `-390-` | Courses: `sales_facts` form per course, and under each the `{{course.…}}` tokens the standards ask for that the course cannot answer |
| `05-taxonomy-1280-light.png` · `-390-` | Taxonomy: Stage / Objection / Composed-text kinds, position field, archive |
| `06-read-1280-light.png` · `-390-` | Read (rep): dialect switcher, roadmap first, EN badge where a dialect is missing, "Say it my way" |
| `07-teardown-1280-light.png` · `-390-` · `-dark` (4) | Teardown: week picker + 15:00 countdown, objections by tag, standards by win rate, open gaps with the customer's exact words, fix box |
| `08-teardown-fix-1280-light.png` · `-390-` | Teardown fix box opened from a gap — the same dialect editor, change note prefilled with the customer's words |
| `09-my-script-voice-1280-light.png` · `-390-` | Rep settings "My script voice", scrolled to Fee / EMI: **Custom** + **Standard changed since your spin** chips, company version above, the rep's own version below |

Light + dark for Library and Teardown as asked; the rest are light at both
widths.

## Notes on what the fixtures deliberately show

- **Unresolved tokens are underlined** in every preview (`{{course.proof}}` on
  a course that has no `proof`). That is the Courses tab's whole job made
  visible, not a rendering bug.
- **`39% · 31 rated` on the cold-call hook** is the teardown's point: the most
  used opener is the worst performing one.
- **"Lock next step" reads `untested`** — 9 uses, 0 rated. Uses are not a win
  rate, and the UI refuses to imply otherwise.
- The Manglish/Hindi copy is fixture text written for these screenshots, not
  reviewed sales copy.

## Bundle

First-load JS **177.5 → 178.2 KB gz** (budget 200). The playbook tabs and the
teardown are inside the already-lazy DocsStudio chunk and a new lazy Teardown
chunk, so the rep bundle does not pay for either.
