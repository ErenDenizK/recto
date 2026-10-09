# Motion R14: the Pages grid (pages lane)

Goal: the grid should feel like a light table (Apple Photos, Keynote). Pages are picked up, put
down, turned, thrown away and sent somewhere, and you can see each of those happen. Everything
runs on the motion core (`src/motion/`) and the tokens: transform and opacity only, Web Animations
without `fill` at rest, and nothing left on an element once it stops (Q-2).

## What was there before

- The page view ⇄ grid View Transition (`grid/grid-transition.ts`). The current page already
  morphed into its cell (`page-current`). The rest of the view faded in as one image.
- FLIP reflow of the cells (`grid/flip-cells.tsx`) on `smooth` for reorders, size steps and
  collapses. Deletes and inserts popped: the cell was there, then it wasn't.
- The drag preview was a still copy at 0.96 on both paths. Neighbours did not move, a drop cut
  straight to the new order, and a cancel removed the preview at once.
- Rotate swapped the thumbnail for a blank sheet and then the new render.

## What changed

| Moment | Motion | Timing | Where |
|---|---|---|---|
| Enter the grid | The page morphs into its cell (the View Transition, unchanged). The other cells on screen fade in and grow from 0.94, ordered by distance from the current page. The cascade runs inside the transition's live new view | 100 ms each, stagger ≤ 50 ms, **150 ms in all**; scale on the `quick` curve, opacity `--ease-out` | `cell-motion.ts` `cascadeIn`, called from `enterGrid` |
| Leave the grid (Done, Esc, `1`, a click, pinch out) | The reverse: while the page view prepares, the other cells fade and shrink to 0.94, the farthest first, and the cell then grows back into its page | 150 ms in all, `--ease-exit`; undone if the way out is abandoned | `cascadeOut` in `leaveGrid` (pinch uses `leaveGrid`) |
| Lift (touch and pen) | The preview rises to **1.04** on `quick`, turns fully opaque and takes `--e4`. It leans toward the drag from the pointer's horizontal velocity, **at most 3°** (3° at 1200 px/s), around the grab point, and straightens as the finger stops (velocity reads 0 after 50 ms) | `quick` | `lift.ts` |
| Multi-select lift | The other selected pages on screen fly from their cells into the stack under the finger and fade into it. The stack keeps its offset sheets and count badge | `quick` curve | `lift.ts` `gatherUnder` |
| Make way | The two cells next to the insertion bar step 10 px apart, and step back when the gap moves on. Retargeted from where they are, so moving along a row reads as a ripple | `smooth` | `make-way.ts`, driven by the drop highlight (both drag paths) |
| Drop | The dropped pages start their reflow from where the preview was (under the finger or pointer) on **`fling`** (bounce 0.15: a small overshoot). A stack fans out to its slots from one point. A drop on the page's own slot settles back the same way. A cancel, or a drop where nothing lands, flies the preview back to its cell | `fling`; flying back on `smooth` | `noteDropOrigin` + `playCells`; `ArrangeView` (mouse) and `grid-pointer-drag.ts` (touch) |
| Select | The check badge pops in from 0.4 on `pop`, and the page gives a little (0.97 → 1). Pages added together ripple in reading order outward from the anchor (Shift-click, Shift+arrows, Mod+A, the marquee) | step 24 ms, ripple ≤ 150 ms | `rippleSelection`, subscribed in `LightTable` |
| Delete | A copy of the page shrinks to 0.8 and fades where it was, drawn beneath the cells, while the neighbours close the gap (the existing FLIP) | `--duration-base`, `--ease-exit` | `shrinkOut` from `FlipCells` |
| Undo of a delete, insert, duplicate, paste | A page new to the workspace grows from 0.8 and fades in where it lands. A group staggers by 20 ms (≤ 100 ms) | `smooth` curve | `growIn` from `FlipCells` |
| Extract | Copies of the pages fly along a short arc (up to 80 px above the straight line) into the new document's tab and shrink to it. The tab then takes a *receive* bounce (1.08 → 1 on `pop`) | 380 ms, stagger ≤ 30 ms (≤ 8 pages fly) | `flyToTab` in `extractPages` |
| Rotate | The sheet lays out in its new shape, starts turned back by the rotation and scaled to the old box, then springs to rest. A still copy of the old bitmap, turned to match, covers the sheet until the new render arrives, so the page never goes blank mid-turn. A second rotate mid-flight continues from the drawn angle | `smooth` curve, Web Animations | `rotate-motion.ts`, from `PageCell` |
| Size slider, scope | Unchanged: the size step and the scope switch were already FLIPped (`arrangeSize` and the sections are in `flipKey`). Checked in the frame strips | `smooth` | `flip-cells.tsx` |

How `FlipCells` tells a delete or an arrival apart from scrolling: it keeps the set of page ids in
the workspace. A drawn cell whose page is no longer in any document leaves with a ghost. A drawn
cell whose page was not in the workspace before grows in. A cell that merely enters the virtual
window stays still (MC-27, as before).

## Reduced motion (A-9)

Under reduced motion only opacity changes, within 150 ms. The cascade fades with no scale and no
stagger, in 100 ms. The badge fades in over 100 ms. Delete fades in 150 ms and arrivals fade in
over 100 ms. The tab blinks its opacity. Lift, lean, gather, make-way, the flight back, the extract
flight and the rotation spin do not run. The reflow is instant, as before.

## Limits (A-10)

Everything settles within 500 ms, delays included:

- Cascade: 150 ms.
- Ripple: `pop` 336 ms + ≤ 150 ms.
- Arrivals: `smooth` 381 ms + ≤ 100 ms.
- Extract flight: ≤ 500 ms.
- *Receive* bounce: starts on a timer, not as an animation delay.

`e2e/motion.spec.ts` A-9 (both paths) and A-10 pass on Chromium. The tour deletes and undoes in
the grid and passes through the door.

## Limits and what is left

- **The mouse path's preview is the browser's drag image**, a still snapshot. It is now scaled to
  1.04 but cannot lean or animate. A follower drawn on `dragover` stutters, so the mouse keeps the
  native image. The settle on drop, make-way, the ripple and the rest work the same for the mouse.
- Rotating mid-flight keeps the drawn angle but not the spring's velocity: Web Animations do not
  expose it.
- Extract flies from the cells' places at the moment of the extract. The grid switches to the new
  document at once, so with *This document* the copies leave from where the pages were.
- Moving pages to another document in the *This document* scope (Move to ▾) has no flight yet.
- Not done: a pinch that scrubs the cascade live (the pinch still commits at its threshold and
  then plays the way out).

## Verification

- Unit: `stage/grid/cell-motion.test.ts`, 11 tests: the cascade's order and its 150 ms, the
  reduced fade, ripple order, the ghost cleaning up after itself, arrivals, the 3° lean cap,
  make-way neighbours, the rotation turn and no transform at rest. The grid, stage and dnd suites
  pass, as do typecheck, lint and format.
- Frame strips (animations slowed 8×, Chromium screencast) at 1440 × 900 (mouse) and on the
  tablet project (touch): enter, select range, rotate, delete, undo, mouse drag, size step,
  extract and leave, then touch drag and multi-page stack drag. One defect was found and fixed:
  the delete ghost was drawn above the neighbours closing the gap, so they passed under it; it is
  now first in the layer.
