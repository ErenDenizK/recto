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
- In Normal and Safe, mechanical work (test fixes, sweeps, log triage) runs on a lighter model.
- In Safe, the lead makes small fixes inline instead of briefing an agent, and lets CI do the
  verifying.
- The lead says which mode is in force when reporting to the owner.

## Browser tests run last (owner, 2026-10-09)

End-to-end browser tests never hold up the work. Implementers verify with format, lint,
typecheck, focused unit tests and screenshots, then report. The lead merges and pushes on a green
unit suite. Playwright runs, local or in CI, are batched: the QA lane works through e2e failures
after each wave, and the full cross-engine matrix is required only before a deploy the owner will
look at.

## Merging

- `develop` is the dev branch: all work lands there and deploys run from it; `main` takes only
  the manual releases the owner asks for (decision PRC-5).
- The lead merges finished packages into `develop` in lane order (platform first). The lead runs the
  full unit suite once on the merged result, then pushes. E2E follows later (see above).
- A red merge is fixed before anything else is pushed. A fix agent takes the failures; new packages
  keep running meanwhile.
- Deploys run from a green `develop` commit. Each deploy ends with an owner task script for the iPad.

## Briefs

Agents read `CLAUDE.md` automatically, so a brief names only the task, the inputs (owner
screenshots, spec sections) and the lane. Mechanical work (test fixes, sweeps, log triage) can use
a lighter model. Design and interaction work uses the default model.
