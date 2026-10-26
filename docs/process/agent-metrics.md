# Agent metrics

One row per agent lane, from R21 (`model-routing.md`). R21–R22 ran every lane with the judge and every
log read with the reader; they are the baseline the builder lanes are compared with.

Columns: **tokens** are the subagent totals the harness reports (cache reads included, so they track
volume, not the bill); **first CI** is whether the PR's first CI run passed without a fix; **fix
rounds** counts pushes needed after that; **stray** counts files changed outside the brief's scope;
**review** counts blocking findings of the judge reviewer (— when no review ran).

From the first lane after PRC-29 (skills adopted, 2026-10-21), new rows add four columns; older rows
keep the old header. **Diff** is the lane's `--shortstat` as `+added/−removed` lines
(`lean-change`); **review→CI** is the reviewer's blocking findings as `earned/wasted` (wasted: CI
would also have caught it); **false green** counts report claims that a check passed which CI then
failed (`verify-before-done`, target 0); **recur** notes, for root-cause lanes, whether the same
symptom returned within two weeks (`root-cause`). Each skill is judged after six lanes that load it,
against the last six lanes of the same kind before it; a skill that does not move its numbers goes.
Header for new tables:

| Round | Lane | Tier | Effort | Tokens | Minutes | First CI | Fix rounds | Stray | Review | Diff | Review→CI | False green | Recur |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

## Summary by kind of work (R21–R22, all judge)

| Kind | Lanes | Tokens (sum) | First CI green | Notes |
|---|---|---|---|---|
| Taste + build (glass, scroll bar, top strip, Library, polish) | 6 | 2.17 M | 1 of 6 | reds were WebKit paint cost and test timing, not logic |
| Audit + fixes (menus, QA read-through) | 2 | 0.80 M | 0 of 2 | one test each followed a moved command or string |
| Root cause (CI fixers, flaky-test root causes, motion profiling) | 7 | 1.70 M | 3 of 3 measured | found two real app bugs (press origin, tab edge) |
| Settled spec / scoped (docs, bundle, tests, panels, refactor) | 5 | 1.39 M | 4 of 4 measured | the builder candidates |
| Research (Plan) | 1 | 0.12 M | — | |
| Log reads and doc checks (reader) | ~12 | ~0.8 M | 12 of 12 correct | |

## Per lane

| Round | Lane | Tier | Effort | Tokens | Minutes | First CI | Fix rounds | Stray | Review |
|---|---|---|---|---|---|---|---|---|---|
| R21 | glass: fixed tone, soft rim, one material | judge | default | 456K | 116 | no | 2 | 0 | — |
| R21 | menus and copy clean-up | judge | default | 458K | 74 | no | 1 | 0 | — |
| R21 | motion: WebKit liquid, grow-out, edit scroll | judge | default | 374K | 69 | no | 1 | 0 | — |
| R21 | scroll bar v1, glass buttons | judge | default | 283K | 56 | no | 2 | 0 | — |
| R21 | top strip pieces | judge | default | 242K | 58 | no | 1 | 0 | — |
| R21 | Library redo | judge | default | 379K | 68 | no (another lane's bug) | 1 | 0 | — |
| R21 | QA read-through | judge | default | 345K | 125 | no | 1 | 0 | — |
| R21 | CI fixer (PRs #6, #7) | judge | default | 204K | 53 | — | — | 0 | — |
| R21 | CI fixer (PRs #8, #9) | judge | default | 387K | 82 | — | — | 0 | — |
| R21 | root cause: flaky side-sheet spec | judge | default | 219K | 37 | yes | 0 | 0 | — |
| R21 | root cause: tab edge | judge | default | 168K | 47 | yes | 0 | 0 | — |
| R22 | research: phone sheets, clean-up plan | judge (Plan) | default | 124K | 9 | — | — | — | — |
| R22 | docs clean-up | judge | default | 170K | 10 | yes | 0 | 0 | — |
| R22 | bundle | judge | default | 153K | 31 | yes | 0 | 0 | — |
| R22 | scroll bar v2 and polish | judge | default | 400K | 175 | no | 1 | 0 | — |
| R22 | test reliability | judge | default | 310K | 127 | yes | 0 | 0 | — |
| R22 | motion profiling and fixes | judge | default | 543K | 198 | yes | 0 | 0 | — |
| R22 | phone panels (DSN-53) | judge | default | 429K | 83 | yes | 0 | 0 | — |
| R22 | refactor (X1–X3) | judge | default | 331K | 74 | yes | 0 | 0 | — |
| R21–R22 | CI log reads (~12) | reader | default | 55–84K each | <1 each | — | — | — | — |
| R22 | Claude Code docs check | reader | default | 56K | <1 | — | — | — | — |

The builder lanes start below this line.

| R22 | timing-budget tests (implementer) | builder | medium | 69K | 12 | yes | 0 | 0 | — |
| R22 | decisions index split (implementer) | builder | medium | 110K + fix round | 4 + fix | yes | 0 | 1 (tsconfig include, accepted) | 0 blocking, 2 warnings fixed |
| R22 | review of the decisions split (reviewer) | judge | medium | 77K | 2 | — | — | — | — |
| R23 | GPU glass after a pause (implementer) | builder | medium | 75K | 11 | no (an unrelated unit flake) | 0 | 0 | — |

## R23, cycle 1 (first cycle under PRC-24)

| Round | Lane | Tier | Effort | Tokens | Minutes | First CI | Fix rounds | Stray | Review |
|---|---|---|---|---|---|---|---|---|---|
| R23 | modal state, then toast clearance under modals | judge | medium | 122K + 179K + 217K | 31 + 29 + 13 | no (a real regression: a paused toast covered a sheet's button, tablet e2e) | 2 | 0 | 0 blocking, 5 warnings fixed |
| R23 | review of the modal lane (reviewer) | judge | medium | 35K | 1 | — | — | — | — |
| R23 | phone pen root cause (owner report) | judge | medium | 126K | 24 | yes | 0 | 0 | — |
| R23 | flaky timing tests (idle, hold, exit motion) | judge | medium | 111K + 170K | 37 + 33 | no (another timing test failed) | 1 | 0 | — |
| R23 | user-test kit (strategist) | judge | medium | 75K | 5 | no (a Pages 503 in the link check) | 0 | 0 | — |
| R23 | conversion research (strategist) | judge | medium | 68K | 1 | — | — | — | — |
| R23 | stale backlog audit (Explore) | reader | low | 28K | 2 | — | — | — | — |
| R23 | CI log reads (5) | reader | low | 61–94K each | <1 each | — | — | — | — |

Cycle 1 notes: three builder lanes so far, all first-CI red only for reasons outside their change; the
comparison with the judge baseline waits for lanes 4–6. Owner-reported bugs and CI flakes took most
of the cycle's judge spend (about 0.8 M of 1.05 M).

## R24, cycle 5

| Round | Lane | Tier | Effort | Tokens | Minutes | First CI | Fix rounds | Stray | Review |
|---|---|---|---|---|---|---|---|---|---|
| R24 | Text (.txt) to PDF (implementer) | builder | medium | 181K + 234K | 44 + 32 | no (the kept-names test lists file-picker ids; the lead added the new id) | 2 (review, CI) | 1 (`session/snapshot.ts`, needed for the dirty state, accepted) | 2 blocking, 6 warnings fixed |
| R24 | review of Text to PDF (reviewer) | judge | medium | 43K | 3 | — | — | — | — |
| R24 | CI log reads (2) | reader | low | 56–63K each | <1 each | — | — | — | — |

Cycles 2–4 lanes (#29–#46) have no rows: their numbers were not kept at the time. From cycle 5 on,
each lane gets its row in the cycle that merges it.
