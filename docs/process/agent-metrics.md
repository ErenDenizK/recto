# Agent metrics

One row per agent lane, from R21 (`model-routing.md`). R21–R22 ran every lane on Opus 5.5 and every
log read on Haiku 5.5; they are the baseline the Sonnet lanes are compared with.

Columns: **tokens** are the subagent totals the harness reports (cache reads included, so they track
volume, not the bill); **first CI** is whether the PR's first CI run passed without a fix; **fix
rounds** counts pushes needed after that; **stray** counts files changed outside the brief's scope;
**review** counts blocking findings of the Opus reviewer (— when no review ran).

## Summary by kind of work (R21–R22, all Opus 5.5)

| Kind | Lanes | Tokens (sum) | First CI green | Notes |
|---|---|---|---|---|
| Taste + build (glass, scroll bar, top strip, Library, polish) | 6 | 2.17 M | 1 of 6 | reds were WebKit paint cost and test timing, not logic |
| Audit + fixes (menus, QA read-through) | 2 | 0.80 M | 0 of 2 | one test each followed a moved command or string |
| Root cause (CI fixers, flaky-test root causes, motion profiling) | 7 | 1.70 M | 3 of 3 measured | found two real app bugs (press origin, tab edge) |
| Settled spec / scoped (docs, bundle, tests, panels, refactor) | 5 | 1.39 M | 4 of 4 measured | the Sonnet candidates |
| Research (Plan) | 1 | 0.12 M | — | |
| Log reads and doc checks (Haiku 5.5) | ~12 | ~0.8 M | 12 of 12 correct | |

## Per lane

| Round | Lane | Model | Effort | Tokens | Minutes | First CI | Fix rounds | Stray | Review |
|---|---|---|---|---|---|---|---|---|---|
| R21 | glass: fixed tone, soft rim, one material | Opus 5.5 | default | 456K | 116 | no | 2 | 0 | — |
| R21 | menus and copy clean-up | Opus 5.5 | default | 458K | 74 | no | 1 | 0 | — |
| R21 | motion: WebKit liquid, grow-out, edit scroll | Opus 5.5 | default | 374K | 69 | no | 1 | 0 | — |
| R21 | scroll bar v1, glass buttons | Opus 5.5 | default | 283K | 56 | no | 2 | 0 | — |
| R21 | top strip pieces | Opus 5.5 | default | 242K | 58 | no | 1 | 0 | — |
| R21 | Library redo | Opus 5.5 | default | 379K | 68 | no (another lane's bug) | 1 | 0 | — |
| R21 | QA read-through | Opus 5.5 | default | 345K | 125 | no | 1 | 0 | — |
| R21 | CI fixer (PRs #6, #7) | Opus 5.5 | default | 204K | 53 | — | — | 0 | — |
| R21 | CI fixer (PRs #8, #9) | Opus 5.5 | default | 387K | 82 | — | — | 0 | — |
| R21 | root cause: flaky side-sheet spec | Opus 5.5 | default | 219K | 37 | yes | 0 | 0 | — |
| R21 | root cause: tab edge | Opus 5.5 | default | 168K | 47 | yes | 0 | 0 | — |
| R22 | research: phone sheets, clean-up plan | Opus 5.5 (Plan) | default | 124K | 9 | — | — | — | — |
| R22 | docs clean-up | Opus 5.5 | default | 170K | 10 | yes | 0 | 0 | — |
| R22 | bundle | Opus 5.5 | default | 153K | 31 | yes | 0 | 0 | — |
| R22 | scroll bar v2 and polish | Opus 5.5 | default | 400K | 175 | no | 1 | 0 | — |
| R22 | test reliability | Opus 5.5 | default | 310K | 127 | yes | 0 | 0 | — |
| R22 | motion profiling and fixes | Opus 5.5 | default | 543K | 198 | yes | 0 | 0 | — |
| R22 | phone panels (DSN-53) | Opus 5.5 | default | 429K | 83 | yes | 0 | 0 | — |
| R22 | refactor (X1–X3) | Opus 5.5 | default | 331K | 74 | yes | 0 | 0 | — |
| R21–R22 | CI log reads (~12) | Haiku 5.5 | default | 55–84K each | <1 each | — | — | — | — |
| R22 | Claude Code docs check | Haiku 5.5 | default | 56K | <1 | — | — | — | — |

Sonnet lanes start below this line.

| R22 | timing-budget tests (implementer) | Sonnet 5.5 | medium | 69K | 12 | yes | 0 | 0 | — |
| R22 | decisions index split (implementer) | Sonnet 5.5 | medium | 110K + fix round | 4 + fix | yes | 0 | 1 (tsconfig include, accepted) | 0 blocking, 2 warnings fixed |
| R22 | review of the decisions split (reviewer) | Opus 5.5 | medium | 77K | 2 | — | — | — | — |
| R23 | GPU glass after a pause (implementer) | Sonnet 5.5 | medium | 75K | 11 | no (an unrelated unit flake) | 0 | 0 | — |

## R23, cycle 1 (first cycle under PRC-24)

| Round | Lane | Model | Effort | Tokens | Minutes | First CI | Fix rounds | Stray | Review |
|---|---|---|---|---|---|---|---|---|---|
| R23 | modal state, then toast clearance under modals | Opus 5.5 | medium | 122K + 179K + 217K | 31 + 29 + 13 | no (a real regression: a paused toast covered a sheet's button, tablet e2e) | 2 | 0 | 0 blocking, 5 warnings fixed |
| R23 | review of the modal lane (reviewer) | Opus 5.5 | medium | 35K | 1 | — | — | — | — |
| R23 | phone pen root cause (owner report) | Opus 5.5 | medium | 126K | 24 | yes | 0 | 0 | — |
| R23 | flaky timing tests (idle, hold, exit motion) | Opus 5.5 | medium | 111K + 170K | 37 + 33 | no (another timing test failed) | 1 | 0 | — |
| R23 | user-test kit (strategist) | Opus 5.5 | medium | 75K | 5 | no (a Pages 503 in the link check) | 0 | 0 | — |
| R23 | conversion research (strategist) | Opus 5.5 | medium | 68K | 1 | — | — | — | — |
| R23 | stale backlog audit (Explore) | Haiku 5.5 | low | 28K | 2 | — | — | — | — |
| R23 | CI log reads (5) | Haiku 5.5 | low | 61–94K each | <1 each | — | — | — | — |

Cycle 1 notes: three Sonnet lanes so far, all first-CI red only for reasons outside their change; the
comparison with the Opus baseline waits for lanes 4–6. Owner-reported bugs and CI flakes took most
of the cycle's Opus spend (about 0.8 M of 1.05 M).

