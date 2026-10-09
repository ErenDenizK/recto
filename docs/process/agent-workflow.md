# How the work runs: lanes, concurrency and verification

This replaces the earlier rule of "at most three implementers at once". That rule came from tighter
usage limits and older models. The limits that matter now are the machine's CPU and memory, and
two people editing the same file. Usage limits are no longer the constraint.

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

- Up to six implementers run at once, one per lane. Planning and research agents do not count:
  they only read.
- Heavy local commands go through `tools/dev/heavy.sh`, which takes a shared lock with one slot by
  default. These are `pnpm build`, Playwright runs and the full unit suite. Agents queue for the
  lock instead of running four builds on four cores.
- Light commands run freely: format, lint, typecheck, and focused vitest files with
  `--maxWorkers=1`.
- Cross-engine runs (Firefox, WebKit) and the full matrix happen in CI, not locally. Locally:
  Chromium plus the tablet project for the specs that cover the change.

## Merging

- The lead merges finished packages into `develop` in lane order (platform first). The lead runs the
  full unit suite and the touched e2e specs once on the merged result, then pushes.
- A red merge is fixed before anything else is pushed. A fix agent takes the failures; new packages
  keep running meanwhile.
- Deploys run from a green `develop` commit. Each deploy ends with an owner task script for the iPad.

## Briefs

Agents read `CLAUDE.md` automatically, so a brief names only the task, the inputs (owner
screenshots, spec sections) and the lane. Mechanical work (test fixes, sweeps, log triage) can use
a lighter model. Design and interaction work uses the default model.
