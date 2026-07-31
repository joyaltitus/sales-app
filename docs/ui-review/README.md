# UI-DESIGN-01 — visual review (morning-first)

Read order for Joyal (≈5 min):

1. **`gallery/`** — the decision. One full gallery page per direction × theme
   (`gallery-<direction>-<theme>.png`, plus one 390px phone run). Every page
   shows the same composites: Sign in, Dashboard hero, Inbox queue at 390px,
   Thread + seam, primitives/states. Pick a direction; the live version is
   `/preview` on the branch build (`?d=graphite|evergreen|ledger` deep-links).
2. **`rebuilt/`** — the rebuilt Login on the frozen tokens, phone/desktop ×
   both themes (other rebuilt surfaces are inside the gallery pages — the
   authenticated screens can't be walked by an unwatched session; see
   `../ui-audit.md` scope note).
3. **`audit-before/`** — what the public surfaces looked like before
   (login/kitchen-sink/samples), for contrast.

Then: `../ui-audit.md` — findings, closed/kept table, the four
PROPOSED-SUPERSESSION items, and the one-line direction swap.

Bundle: **150.2 → 154.6 KB gz** first-load (budget 200) — the gallery is a
lazy chunk; growth is ErrorState + login/dashboard rebuild + one icon.
