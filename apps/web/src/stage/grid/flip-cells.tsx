/**
 * *Reflow* for the Pages grid's cells (`components/06-navigation.md` PG1 §7, PG4 §7, PG5 §7;
 * language.md §7.3; MC-28): a reorder, a drop, a size step, a delete or a section collapse moves
 * each cell from where it was drawn to its new place on `--spring-smooth`, by FLIP through
 * `motion/`'s `animateStyle`, compositor-only and with no transform left at rest (Q-2).
 *
 * - **Whatever made the change.** A drag, Alt+arrows, the Pages bar's ‹ ›, Undo or a size step
 *   all reach the grid as a new layout, so the boundary watches the layout (`flipKey`) instead
 *   of each act: the boxes are read before React writes the DOM (a class component's
 *   `getSnapshotBeforeUpdate`, the one place that can) and the cells move right after, before
 *   paint.
 * - **By page.** `motion/flip.ts` animates elements that survive a change. A grid cell often does
 *   not: the virtualized rows are keyed by row, so a page that changes rows is drawn by a new
 *   element. Cells are matched by page id instead: each cell drawn after the change starts from
 *   the box its page had before, or from where a running reflow had it, so a second change
 *   mid-flight turns smoothly. Cells new to the virtual window, or whose page was not drawn
 *   before, do not move (MC-27).
 * - Under reduced motion nothing moves (`animateStyle` is instant there).
 */
import { Component, type ReactNode, type RefObject } from 'react';

import { animateStyle, stopTransform } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';

/** Moves smaller than this (CSS px) are not animated. */
const STILL = 0.5;
const CELL = '[role="gridcell"][data-page-id]';

type Boxes = ReadonlyMap<string, DOMRect>;

function cellsOf(root: ParentNode): Map<string, HTMLElement> {
  const cells = new Map<string, HTMLElement>();
  for (const cell of root.querySelectorAll<HTMLElement>(CELL)) {
    const id = cell.dataset.pageId;
    if (id !== undefined) cells.set(id, cell);
  }
  return cells;
}

/** Every drawn cell's box on screen, by page id; running reflows stop where they are. */
export function readCells(root: ParentNode): Boxes {
  const boxes = new Map<string, DOMRect>();
  const cells = cellsOf(root);
  // Every read before the first write.
  for (const [id, cell] of cells) boxes.set(id, cell.getBoundingClientRect());
  for (const cell of cells.values()) stopTransform(cell);
  return boxes;
}

/** Moves each cell drawn in `root` now from its page's box in `before` to where it is. */
export function playCells(root: ParentNode, before: Boxes): void {
  const moves: { cell: HTMLElement; from: [number, number, number, number] }[] = [];
  for (const [id, cell] of cellsOf(root)) {
    const first = before.get(id);
    if (!first) continue;
    const last = cell.getBoundingClientRect();
    if (last.width === 0 || last.height === 0) continue;
    const sx = first.width / last.width;
    const sy = first.height / last.height;
    const dx = first.x - last.x + (first.width - last.width) / 2;
    const dy = first.y - last.y + (first.height - last.height) / 2;
    if (Math.abs(dx) < STILL && Math.abs(dy) < STILL && Math.abs(sx - 1) < 1e-3) continue;
    moves.push({ cell, from: [dx, dy, sx, sy] });
  }
  for (const { cell, from } of moves) {
    animateStyle(cell, 'transform', from, [0, 0, 1, 1], { spring: 'smooth' });
  }
}

interface FlipCellsProps {
  /** The element holding the cells. */
  readonly root: RefObject<HTMLElement | null>;
  /** Changes when the layout may have moved cells (sections, pages, sizes). */
  readonly flipKey: unknown;
  readonly children: ReactNode;
}

/** Plays the cells' reflow whenever `flipKey` changes (module header). */
export class FlipCells extends Component<FlipCellsProps> {
  override getSnapshotBeforeUpdate(previous: FlipCellsProps): Boxes | null {
    const root = this.props.root.current;
    if (!root || previous.flipKey === this.props.flipKey || reducedMotion()) return null;
    return readCells(root);
  }

  override componentDidUpdate(
    _previous: FlipCellsProps,
    _state: unknown,
    before: Boxes | null,
  ): void {
    const root = this.props.root.current;
    if (root && before) playCells(root, before);
  }

  override render(): ReactNode {
    return this.props.children;
  }
}
