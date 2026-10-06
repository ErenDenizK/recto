/**
 * The door from the page into the Pages grid (05-canvas §4 *Release*, flows.md §7.1; spec
 * D2-10): a pinch released more than 15 % below fit page, or a Mod+wheel notch out at fit page
 * after a pause, opens the grid at the page under the gesture, as a *view change* (240 ms View
 * Transition, language.md §7.3).
 *
 * One function, so the Pages grid of D2-5 replaces what it opens without touching the zoom
 * controller. Today it opens Arrange (the light table, `stage/ArrangeView.tsx`): the page gets
 * the grid's keyboard focus and Arrange reveals it on mount (`takeGridReveal`), as the `3` key
 * does, and the mode is announced as that key announces it.
 */
import type { PageId } from '@pdf-editor/document-model';

import { m } from '../i18n';
import { viewTransition } from '../motion/view-transition';
import { announce } from '../shell/announcer';
import { useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';

/** The page the grid shows first once it mounts; taken once. */
let reveal: PageId | null = null;

/** The page to reveal as the grid mounts, if a door asked for one (taken once). */
export function takeGridReveal(): PageId | null {
  const page = reveal;
  reveal = null;
  return page;
}

/** What the door does; D2-5 swaps it for the Pages grid's own entrance. */
type Door = (page: PageId) => void;

const openArrange: Door = (page) => {
  reveal = page;
  useSelectionStore.getState().setFocused(page);
  void viewTransition(() => useUiStore.getState().setViewMode('arrange'), { name: 'grid' });
  announce(m.mode_arrange_long());
};

let door: Door = openArrange;

/** Opens the Pages grid at `page` of the active document (module header). */
export function enterPagesGrid(page: PageId): void {
  door(page);
}

/** Replaces the door (the Pages grid, D2-5; tests); null restores today's. */
export function setPagesGridDoor(next: Door | null): void {
  door = next ?? openArrange;
}
