---
name: repo-gates
description: Runs the Recto repo-wide gates that a focused test run misses (tokens, css-scale, focus-scan, motion, materials, palette, copy check, decisions index). Use before pushing or reporting any change that touches CSS, tokens, colours, focus styles, motion, user-facing strings, e2e-visible ids or docs/process decisions, and again after merging develop into a branch.
---

# Repo gates

Some Recto tests scan every file of a kind, not the file you changed. A focused vitest run on your
own test never reaches them, so they go red only in CI (R29: three PRs red on tokens, css-scale,
focus-scan and the decisions index; three more red in the merge queue on a spacing value, a danger
colour and a test expecting the old Tools button). Run the rows your change touches, in order, one
at a time (never vitest beside lint, typecheck or build).

## What to run

| You changed | Run | It fails when |
|---|---|---|
| anything | `pnpm format:check`, then `pnpm lint`, then `pnpm typecheck` (root) | format, eslint, i18n compile, types |
| any `.css` under `apps/web/src`, a token, a colour, a focus or motion rule | `cd apps/web && pnpm exec vitest run --maxWorkers=1 src/styles src/annotations/palette.test.ts` | see the notes below |
| `en.json` / `tr.json`, `README.md`, `apps/web/about/` | `node --experimental-strip-types --no-warnings=ExperimentalWarning tools/copy-check/check.ts` | banned words, `!`, emoji, PNGs in CSS, native colour inputs |
| `docs/process/decisions*` | `node --experimental-strip-types --no-warnings=ExperimentalWarning tools/qa/decisions-index.ts` | an id in one file and not the other, twice, or in the wrong area (`decision-rows`) |
| a link in `docs/research/` | check each relative target exists (CI runs lychee offline on it) | a missing file or anchor |
| a label, command id, test id or visible name | `grep -rn '<old text>' apps/web/src apps/web/e2e apps/web/test` | a test or spec still names the old one |

## Notes on the style gates

- **css-scale:** a literal off the token scales fails. Use the token; never add a line to
  `css-scale.allow.ts` (it only shrinks). Cleaning a listed file means lowering its count too.
- **focus-scan:** a focus rule uses one of the four forms in `styles/focus.css`; no ring of its own.
  A suppressed ring clears both bands and is listed in `SUPPRESSED` with its reason.
- **tokens:** a changed colour must keep every contrast pair; read the failing pair, do not move it.
- **materials:** `materials.css` is generated: `pnpm --filter @pdf-editor/web materials`, never
  hand-edited.
- **motion:** every reduced-motion rule answers the setting as well as the system query.

## After merging develop

Another lane's merge can break yours without a text conflict. After `git merge origin/develop`,
rerun the rows above for your files and for the files the merge brought in that yours depend on.

## Report

List each command with its result line. A row you did not run is named as not run, with why.
