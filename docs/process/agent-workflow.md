# How the work runs: lanes, concurrency and verification

This replaces the earlier rule of "at most three implementers at once". There is no fixed cap.
Three things set how much runs at once: the machine's CPU and memory (the heavy lock), two people
editing the same file (lanes), and the weekly usage limit (the budget mode, below).

## Lanes (file ownership)

A work package owns one lane. Packages in different lanes run in parallel. Two packages in the same
lane run one after the other.

| Lane | Owns |
|---|---|
| frame | `shell/frame/`, the top pieces, the page pill, the free rect |
| capsule | `shell/capsule/`, the dock, the morph |
| ink | `markup/`, `annotations/pen/`, ink strip, presets |
| pages | `stage/grid/`, `stage/` cells, `light-table/` |
| viewer | `viewer/`, reading, links, find, outline, sidebar |
| library | `home/`, `files/`, `session/`, recents |
| engine | `packages/*`, workers, rendering, save/export (internal, no UI) |
| forms | forms, signatures, fill & sign |
| platform | `styles/` tokens, `motion/`, `commands/keymap.ts`, `ui/` primitives |

The platform lane changes shared foundations, so each of its packages merges first in its wave,
and the other packages rebase onto it.

**Clean-up lanes run last (R22, brief C-9).** A lane that restructures shared documents
(`docs/process/decisions.md`, `CLAUDE.md`, this file, the specs' tables) or moves files many
lanes touch starts after the wave's feature lanes have merged, and rebases onto them. While
feature lanes run, other lanes only append rows (the full row in `decisions/<area>.md`, its
one-line entry in the index `decisions.md`) and fix links into them; they never split, reorder
or rewrite it. Superseded documents move to `docs/archive/` with a line
in its README.

## Concurrency

- At most one implementer per lane. How many lanes run at once is set by the budget mode
  (below). Planning and research agents do not take a lane: they only read.
- Heavy local commands go through `tools/dev/heavy.sh`, which takes a shared lock with one slot by
  default. These are `pnpm build`, Playwright runs and the full unit suite. Agents queue for the
  lock instead of running four builds on four cores.
- Light commands run freely: format, lint, typecheck, and focused vitest files with
  `--maxWorkers=1`, but never vitest at the same time as lint, typecheck or build in one
  checkout (Paraglide regenerates its files under both).
- Cross-engine runs (Firefox, WebKit) and the full matrix happen in CI, not locally. Locally:
  Chromium plus the tablet project for the specs that cover the change.

## Budget modes (owner, 2026-10-09)

Usage limits are weekly and reset on **Saturday at 07:00 Turkey time** (04:00 UTC). A burst
spends the week's budget fast, so the mode is chosen on purpose and stated in each wave's plan.

| Mode | Implementers | Research | Verification | When |
|---|---|---|---|---|
| **Burst** | Up to 8, one per lane | Research fan-outs allowed | As usual: focused tests, screenshots, the heavy lock | Only when the owner opens a burst window |
| **Normal** | 3–4, in disjoint lanes | Allowed, sized to the question | As usual | When the owner raises the mode from Safe |
| **Safe or minimal** | 1–2 | No research fan-outs | CI only, no local Playwright or full builds beyond what a fix needs | The default |

- **In force from 2026-10-10: Normal, started low** (2–3 implementers; the lead raises it when
  the work needs it and says so in the report; never a 10–20 agent fan-out without the owner).
- **The default after a burst window is Safe**, until the owner raises it. A burst window
  closes when the owner says so, or at the end of the time the owner gave.
- Which model a lane runs on is set by `model-routing.md` (PRC-23) in every mode: settled-spec
  lanes with the builder (`implementer`), taste and unknown-cause lanes with the judge, reads with the reader.
  The builder's lower cost buys more lanes within a mode, never a lower bar.
- In Safe, the lead makes small fixes inline instead of briefing an agent, and lets CI do the
  verifying.
- The lead says which mode is in force when reporting to the owner.

## Browser tests run last (owner, 2026-10-09)

End-to-end browser tests never hold up the work. Implementers verify with format, lint,
typecheck, focused unit tests and screenshots, then report. The lead merges and pushes on a green
unit suite. Playwright runs, local or in CI, are batched: the QA lane works through e2e failures
after each wave, and the full cross-engine matrix is required only before a deploy the owner will
look at.

## Merging (PRC-17, PRC-18)

- `develop` is the dev branch: all work lands there and deploys run from it; `main` takes only
  the manual releases the owner asks for (decision PRC-5).
- Each lane's package is a branch (for example `r22/docs`) with its own pull request into
  `develop`.
  Commits carry the owner as author and committer and the session's `Co-Authored-By` trailer.
- A PR carries one concern, titled as a Conventional Commit that names the visible change. Its
  body: What, Why (brief item or decision ids), How tested, Screenshots for UI (1440 × 900 and
  tablet), Decisions added; rows that do not apply are deleted. Fix-ups for the PR's own
  mistakes are folded before it opens. A docs-only change rides the next lane's PR.
- The lead merges each PR with a merge commit (never squash) once its checks are green, in lane
  order (platform first, clean-up lanes last), and runs the full unit suite on the merged
  result. E2E follows later (see above).
- A red merge is fixed before anything else merges. A fix agent takes the failures; new packages
  keep running meanwhile.
- Deploys run from a green `develop` commit. Each deploy ends with an owner task script for the iPad.

## Briefs

Agents read `CLAUDE.md` automatically, so a brief stays short and self-contained:

1. **Objective** in two or three sentences, with the owner's brief item.
2. **Decisions to read** (row ids) and inputs (screenshots, spec sections).
3. **Files in scope** (the lane) and **files out of scope** (other lanes' files right now).
4. **Checks to run** and the **output** wanted (report length, screenshots, numbers).
5. **Done condition**: pushed branch name, no PR unless asked.

Pick the agent and model by `model-routing.md`: an `implementer` (builder) only when the brief
settles every decision; otherwise a judge agent. Before an `implementer` lane's PR opens, the lead
checks its `git diff --stat` against the files in scope and adds the lane's row to
`agent-metrics.md` once its first CI run is known.

## Colour audit harness

`tools/colour-audit/` measures text, icon and focus-ring contrast (WCAG 2.x and APCA) on the built
app across desk, tablet and phone, light and dark, standard and more-contrast. A colour lane quotes
its before and after against `tools/colour-audit/baseline/` (`agg.txt`, `top40.md`) in its PR
(rendering is deterministic on the software rasteriser, so a re-run on the same tree matches within
0.5 points per slice). Its README says how to rerun it; run the measures through `tools/dev/heavy.sh`.
