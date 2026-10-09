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
 * - **Leaving and landing** (`cell-motion.ts`): a page gone from every document (a delete) leaves
 *   a copy at its place that shrinks and fades while the neighbours close the gap; a page new to
 *   the workspace (an insert, a duplicate, the undo of a delete) grows in where it lands.
 * - **Dropped pages** start from the drag preview's place under the finger (`noteDropOrigin`)
 *   on `fling`, whose small overshoot is the settle, so a stack fans out to its slots.
 * - Under reduced motion nothing moves (`animateStyle` is instant there); leaving and landing
 *   only fade.
 */
import { Component, type ReactNode, type RefObject } from 'react';

import { animateStyle, stopTransform } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
import { useWorkspaceStore } from '../../state/workspace-store';
import {
  cellsById,
  clearDropOrigin,
  dropOriginOf,
  growIn,
  type SheetSnapshot,
  shrinkOut,
  snapshotSheet,
} from './cell-motion';

/** Moves smaller than this (CSS px) are not animated. */
const STILL = 0.5;

type Boxes = ReadonlyMap<string, DOMRect>;

/** Every drawn cell's box on screen, by page id; running reflows stop where they are. */
export function readCells(root: ParentNode): Boxes {
  const boxes = new Map<string, DOMRect>();
  const cells = cellsById(root);
  // Every read before the first write.
  for (const [id, cell] of cells) boxes.set(id, cell.getBoundingClientRect());
  for (const cell of cells.values()) stopTransform(cell);
  return boxes;
}

/**
 * Every page in the workspace now and its document (to tell a delete from a scroll, and an
 * arrival from a reveal).
 */
function workspacePages(): Map<string, string> {
  const ids = new Map<string, string>();
  for (const doc of Object.values(useWorkspaceStore.getState().workspace.documents)) {
    for (const page of doc?.pages ?? []) ids.set(page.id, doc.id);
  }
  return ids;
}

/**
 * Moves each cell drawn in `root` now from its page's box in `before` to where it is; a
 * dropped page from the drop's origin, on `fling`; a page not drawn before that `known` did not
 * have in its document (a new page, or one brought back from another document, as an undo of
 * Move to ▾ does) grows in.
 */
export function playCells(
  root: ParentNode,
  before: Boxes,
  known?: ReadonlyMap<string, string>,
): void {
  const moves: {
    cell: HTMLElement;
    from: [number, number, number, number];
    dropped: boolean;
  }[] = [];
  let arrivals = 0;
  for (const [id, cell] of cellsById(root)) {
    const origin = dropOriginOf(id);
    const first = origin ?? before.get(id);
    if (!first) {
      if (known && known.get(id) !== cell.dataset.documentId)
        growIn(cell, Math.min(arrivals++ * 20, 100));
      continue;
    }
    const last = cell.getBoundingClientRect();
    if (last.width === 0 || last.height === 0) continue;
    const sx = first.width / last.width;
    const sy = first.height / last.height;
    const dx = first.x - last.x + (first.width - last.width) / 2;
    const dy = first.y - last.y + (first.height - last.height) / 2;
    if (Math.abs(dx) < STILL && Math.abs(dy) < STILL && Math.abs(sx - 1) < 1e-3) continue;
    moves.push({ cell, from: [dx, dy, sx, sy], dropped: origin !== undefined });
  }
  clearDropOrigin();
  for (const { cell, from, dropped } of moves) {
    animateStyle(cell, 'transform', from, [0, 0, 1, 1], { spring: dropped ? 'fling' : 'smooth' });
  }
}

/** What a reflow keeps from before the change: the boxes, and copies of pages about to go. */
interface Snapshot {
  readonly boxes: Boxes;
  readonly leaving: readonly SheetSnapshot[];
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
  /** The workspace's pages as of the last layout, to tell arrivals and deletes apart. */
  private known: Map<string, string> | null = null;

  override componentDidMount(): void {
    this.known = workspacePages();
  }

  override getSnapshotBeforeUpdate(previous: FlipCellsProps): Snapshot | null {
    const root = this.props.root.current;
    if (!root || previous.flipKey === this.props.flipKey) return null;
    // The store has the new workspace already; the DOM still shows the old cells.
    const now = workspacePages();
    const leaving: SheetSnapshot[] = [];
    for (const [id, cell] of cellsById(root)) {
      if (now.has(id)) continue;
      const shot = snapshotSheet(cell);
      if (shot) leaving.push(shot);
    }
    return { boxes: reducedMotion() ? new Map() : readCells(root), leaving };
  }

  override componentDidUpdate(
    _previous: FlipCellsProps,
    _state: unknown,
    before: Snapshot | null,
  ): void {
    const root = this.props.root.current;
    const known = this.known;
    if (before) this.known = workspacePages();
    if (!root || !before) return;
    for (const shot of before.leaving) shrinkOut(shot, root);
    playCells(root, before.boxes, known ?? undefined);
  }

  override render(): ReactNode {
    return this.props.children;
  }
}
