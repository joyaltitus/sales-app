# PLAY-B — extension playbook surfaces, 2026-09-02

Captured from the **built** extension (`.output/chrome-mv3`) by
`node scripts/ext-playbook-shots.mjs`, at **380 × 700** — the narrowest panel a
rep actually gets. Supabase is intercepted and answered from fixtures inside
that script; no live credential is used, and no WhatsApp session is driven.

Both themes are captured. `-light` / `-dark` suffixes.

## The 380px overflow assertion

The script does not only screenshot — it **measures**. After the shots that
matter it asserts `scrollWidth <= clientWidth`, which is exactly "this element
has content it cannot show without a sideways scroll", and exits non-zero if any
of them fail. Last run:

```
✓ light · HUD (no course):          scrollWidth 354 ≤ clientWidth 354
✓ light · HUD (longest Manglish):   scrollWidth 354 ≤ clientWidth 354
✓ light · RebuttalCard:             scrollWidth 334 ≤ clientWidth 334
✓ light · ScriptSheet:              scrollWidth 380 ≤ clientWidth 380
✓ light · Library:                  scrollWidth 380 ≤ clientWidth 380
✓ dark  · HUD (no course):          scrollWidth 354 ≤ clientWidth 354
✓ dark  · HUD (longest Manglish):   scrollWidth 354 ≤ clientWidth 354
✓ dark  · RebuttalCard:             scrollWidth 334 ≤ clientWidth 334
✓ dark  · ScriptSheet:              scrollWidth 380 ≤ clientWidth 380
✓ dark  · Library:                  scrollWidth 380 ≤ clientWidth 380

Wrote docs/ui-review/2026-09-02-playbook-extension — nothing overflowed 380px.
```

The "longest Manglish" case is the seeded worst case: a five-line transliterated
paragraph carrying five merge tokens, which is what produces the long unbroken
strings that actually break a narrow column.

## The files

| File | What it shows |
| --- | --- |
| `01-hud-default` | The HUD as a rep first sees it: **no course picked**, so the quiet warn chip is up, `{{course.name}}` stays visible in the opener, and Insert is still live. Roadmap at 1/4 on the follow-up opener, which is what an overdue lead gets. |
| `02-hook-selector` | The same step with the opener switched to **Cold** — the guess is a guess, and the rep overrides it in one tap. |
| `03-hud-offer-course-picked` | Course picked. Every number fills in place: fee ₹85,000, EMI ₹7,100, batch date. The warn chip is gone. |
| `04-hud-manglish-longest` | The offer step in **Manglish**, on the longest seeded paragraph. Clamped to two lines, wrapped, no sideways scroll. |
| `05-rebuttal-card` | "Too expensive" tapped: the rebuttal replaces the roadmap body, carries its 68% win rate and its counts, and offers `Insert to WA` + 👍/👎. `← back to The offer` is the whole navigation model — the roadmap keeps its step. |
| `06-script-sheet-standard` | Expand: version chip, win rate with counts, the company standard read-only with tokens filled, and the rep's line about where the standard is edited. |
| `07-script-sheet-spin` | The same sheet's **My spin** section: the rep's own wording, per dialect, with the 1,500-character counter, Save and Reset. |
| `08-token-close-row` | The close row after the seat link is tapped: `Open in UPI app` and `✓ Token received` under the button. |
| `09-feedback-strip` | After an outcome is logged: "N scripts used this call, rate them", listing only what has not been rated. Rated rows never come back. |
| `10-library` | The Library tab, grouped Call roadmap / Objections / Composed texts, dialect chips, win-rate badges, `Custom` where the rep has a spin. |
| `11-settings` | The Settings tab's new **Scripts** group: default dialect, default wording, roadmap-on-open, and the link out to Sales Hub for everything the whole team shares. |

## What is deliberately not here

* No live-login proof. The session runs unattended with no demo rep credential
  available, so every capture is fixture-backed — see the PR body.
* No editor for a company standard, anywhere in the extension. Screenshots 06
  and 07 are the whole story: read it, write your own version of it, and follow
  a link if you are the manager who owns it.
