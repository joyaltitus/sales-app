# Lane D — integration, evidence, production (Muse Spark 1.3, effort xhigh)

Working directory: `/Users/joyaltitus/Documents/sales-app` (the main checkout).
Branch to create: `uxw01/stabilization` from `origin/main`.

**Start only when lanes A, B and C have all pushed and exited.** Verify that
before doing anything — see step 1. You are the only agent running at this point.

## Objective

Merge the three lane branches, prove the result is green, capture evidence
safely, and open **one** pull request for Joyal. You are an integrator, not a
fixer. **Do not invent fixes.** If something is broken, report it.

## Absolute rules

1. **Never stage the whole tree.** `docs/ui-review/worldclass-01/phase2-discovery/`
   is untracked, is **not** gitignored, and contains 94 screenshots — several
   with real customer names and one with a full `+91` phone number. A single
   `git add -A` puts that in git history permanently and irreversibly. Always
   `git add <explicit path>`.
2. **Do not merge to `main`.** Open the PR and stop. Joyal merges.
3. Never force-push. Never bypass git hooks. Never reset or clean destructively.
4. Never edit `src/ui/tokens.css`, `src/lib/supabase.ts`, `src/lib/gateway-key.ts`,
   `.env*`, `.github/workflows/`, `.claude/`.
5. **Do not remove any feature.** Placeholders for planned-but-unbuilt features
   are intentional.
6. If a merge conflict appears, **stop and report it with the conflicting
   hunks.** Do not resolve a conflict in code you do not understand — the three
   lanes were partitioned so that conflicts should not occur, so a conflict means
   an assumption broke and Joyal needs to know.

## Step 1 — confirm the lanes are done

```
git fetch --all
git log --oneline -1 uxw01/core
git log --oneline -1 uxw01/ui
git log --oneline -1 uxw01/ext
ls docs/sessions/uxw01-stabilization/HANDOFF-*.md
```
All three branches must have commits beyond `13a1d23`, and all three HANDOFF
files must exist. If any is missing, **stop and report** — do not proceed with a
partial merge.

Read all three HANDOFF files before merging. They list what was deferred and any
existing test assertions that were deliberately flipped.

## Step 2 — build the integration branch

```
git switch main
git pull --ff-only
git switch -c uxw01/stabilization
git merge --no-ff uxw01/core
git merge --no-ff uxw01/ui
git merge --no-ff uxw01/ext
```
Merge in that order. Expect no conflicts. If you get one, stop (rule 6).

## Step 3 — the gates

```
npm ci
npx tsc -b
npm test
npm run build
npm run check:no-service-role
npm run check:tokens
npm run ext:build
```

Record the exact output of each. Required results:
- `tsc -b` prints nothing.
- `npm test` — every file passes. The suite is flaky under load: if a handful of
  files time out, re-run **those files alone** before calling it a regression.
  Report the final pass count.
- `npm run build` prints `first-load JS: N KB gz (budget 200 KB)`.
  **N must be at or below 171.8** — that is the Phase 1 achieved figure and this
  release must not spend its headroom. If N is above 171.8 but below 200, the
  build passes but you must **report it as a regression**, not ignore it.
  Also record the PWA entry count and KiB (baseline: 45 entries / 1104.27 KiB).
- `check:no-service-role` and `check:tokens` each print a checkmark. If
  `check:tokens` fails, someone edited `tokens.css` — report it, do not "fix"
  the checksum.
- `ext:build` completes (baseline 665 kB).

**Do not weaken any of these to make them pass.** If something fails, report it
with the exact output.

## Step 4 — behaviour verification

Joyal has authorised **live writes in the Vidya Sagar demo tenant** — it is demo
data. He has **not** authorised any external communication.

**Permitted:** create, edit and clean up records named `UXW01-QA-<timestamp>` —
leads, todos, follow-ups, call outcomes, objections, targets. Delete everything
you create and list what you deleted.

**Forbidden without an explicit named recipient from Joyal:** sending any
WhatsApp message, running a broadcast, sending an email, sending an invite, or
any other outbound customer contact. If a check requires one, mark it
**Blocked** with the reason. Do not simulate it and call it passed.

Verify, and record pass/fail/blocked for each:
- Rep at 390x844 and 1440x900, light and dark.
- Manager at 390x844 and 1440x900, light and dark.
  **No manager-role account exists.** Verify manager surfaces through
  deterministic tests and fixtures only. **Never claim a live manager session.**
- Client-admin at 1440x900 only (mobile admin is an accepted non-goal).
- Role walls: a rep visiting `/manage` and `/admin` still redirects to `/rep`.
- Route-prefix navigation: from each shell, every in-app link stays inside that
  shell's prefix. This is the main thing lane A changed — exercise it.
- Session expiry lands on a recoverable sign-in screen with "session expired"
  guidance, **not** the "no workspace" empty state.
- No fabricated data on an empty tenant; Phase 1 honest empty states intact.
- Rapid double-activation of a write control produces one write or an error.
- A denied or failed write keeps visible state and explains recovery.

Extension: the deterministic harness is `node scripts/ext-shots.mjs`, run after
`npm run ext:build`. **It imports Playwright by absolute path from
`~/Documents/hub-service/node_modules` and needs a display.** If that import
fails, the harness did not run — say so and mark it Blocked. Never report
"26/26" unless you actually saw 26 captures succeed.
The **live WhatsApp send loop is Blocked** — no safe test chat exists. Say so
plainly; do not claim live extension behaviour.

## Step 5 — evidence and PII

Any new screenshots go in a fresh directory under
`docs/ui-review/worldclass-01/`. Before adding **any** image to git:
- open it and confirm it shows no customer name, no phone number, no message
  body;
- prefer an empty tenant or `UXW01-QA-*` fixture data;
- if a shot has PII, either retake it clean or leave it uncommitted.

The 94 existing screenshots under `phase2-discovery/` stay **untracked**. Do not
add them. Do not gitignore them either — leave that directory exactly as it is.

Extension harness screenshots are generated from hardcoded synthetic fixtures and
are safe to commit.

Confirm before committing: `git status --short` and `git diff --cached --stat`.

## Step 6 — the pull request

```
git push -u origin uxw01/stabilization
gh pr create --base main --title "UXW01: pre-Phase-2 stabilization" --body "..."
```

The body must contain:
- what changed, grouped by lane, with the REG ids;
- the gate output: test pass count, first-load KB gz vs the 171.8 baseline, PWA
  entries/KiB, ext:build size;
- the behaviour checklist with pass/fail/**blocked** per line;
- **every Blocked item with its exact reason** — no silent omissions;
- the deliberately flipped test assertions and why (lane A's handoff lists them);
- what was deferred to Phase 2;
- a note that live extension WhatsApp and live manager coverage remain unverified.

No credentials, no tokens, no customer names, no phone numbers, no message
bodies anywhere in the PR.

Then watch CI: the `build` job and the `gitleaks` job must both pass. Report the
result. **Stop there.** Do not merge.

## Step 7 — after Joyal merges (only if he says so)

`main` auto-promotes to `production` via the workflow. Then:
- `curl -s https://sales-app-joyal.zeabur.app/version.json` — the commit must
  match the merge commit;
- load the app, sign in, confirm the shell renders and navigation stays in-shell;
- report the result.

Do none of this until Joyal explicitly tells you the merge is done.

## Checklist

- [ ] 1 all three branches + handoffs present, handoffs read
- [ ] 2 integration branch built, no conflicts
- [ ] 3 six gates green, numbers recorded, nothing weakened
- [ ] 4 behaviour verified per role/viewport/theme, blocked items named
- [ ] 5 evidence PII-checked, phase2-discovery still untracked
- [ ] 6 PR opened with full body, CI watched, not merged
- [ ] 7 production verified only after Joyal's go-ahead

**Report honestly. A truthful "Blocked, because X" is the correct answer; a
claimed pass you did not observe is the one unacceptable outcome.**
