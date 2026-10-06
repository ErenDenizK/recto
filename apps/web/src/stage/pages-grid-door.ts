/**
 * The door from the page into the Pages grid (05-canvas §4 *Release*, flows.md §7.1; spec
 * D2-10): a pinch released more than 15 % below fit page, or a Mod+wheel notch out at fit page
 * after a pause, opens the grid at the page under the gesture, as a *view change* (240 ms View
 * Transition, language.md §7.3).
 *
 * One function, so the Pages grid replaces what it opens without touching the zoom
 * controller: the grid's own entrance (`grid/grid-transition.ts`, spec D2-5), which morphs the
 * page into its cell, focuses the cell and announces the grid.
 */
import type { PageId } from '@pdf-editor/document-model';

import { enterGrid } from './grid/grid-transition';

export { takeGridReveal } from './grid/grid-transition';

/** What the door does: the Pages grid's entrance; tests may swap it. */
type Door = (page: PageId) => void;

const openGrid: Door = (page) => enterGrid({ page });

let door: Door = openGrid;

/** Opens the Pages grid at `page` of the active document (module header). */
export function enterPagesGrid(page: PageId): void {
  door(page);
}

/** Replaces the door (tests); null restores the Pages grid's. */
export function setPagesGridDoor(next: Door | null): void {
  door = next ?? openGrid;
}
