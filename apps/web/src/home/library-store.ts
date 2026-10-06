/**
 * The Library's Select mode (`02-library` L4–L6; flows §4.6): selection is a mode, so one
 * click on a card opens it until the person asks to select. Select (the head), the ○ on a card,
 * a long press, a right-click, Space, Shift- or Mod-click and Mod+A turn it on; Done, the bar's
 * ✕ and the second Esc turn it off and clear the selection.
 *
 * Session only and local to the Library: the checked cards themselves stay in `ui-store`'s
 * `homeSelection`, which the Files list shares. The mode is on while this flag is set **or** any
 * card is checked, so files opened together (they arrive checked) and a selection made in the
 * Files list show the ○ and the bar without a second step (`useSelecting`).
 */
import { create } from 'zustand';

import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { liveSelection } from './home-model';

interface LibraryState {
  /** Select was pressed (or a gesture entered the mode) and Done has not been. */
  readonly selecting: boolean;
}

export const useLibraryStore = create<LibraryState>()(() => ({ selecting: false }));

/** Turns Select mode on or off; off also clears the checked cards. */
export function setSelecting(on: boolean): void {
  useLibraryStore.setState({ selecting: on });
  if (!on) useUiStore.getState().setHomeSelection([], null);
}

/** Enters Select mode, keeping what is checked (a gesture that also checks a card). */
export function enterSelecting(): void {
  if (!useLibraryStore.getState().selecting) useLibraryStore.setState({ selecting: true });
}

/** Whether the Library is in Select mode: asked for, or with cards checked. */
export function isSelecting(): boolean {
  if (useLibraryStore.getState().selecting) return true;
  const order = useWorkspaceStore.getState().workspace.documentOrder;
  return liveSelection(order, useUiStore.getState().homeSelection).length > 0;
}

/** `isSelecting` for components. */
export function useSelecting(): boolean {
  const flag = useLibraryStore((s) => s.selecting);
  const order = useWorkspaceStore((s) => s.workspace.documentOrder);
  const checked = useUiStore((s) => liveSelection(order, s.homeSelection).length);
  return flag || checked > 0;
}

/** Back to rest (tests; the last document closing). */
export function resetLibraryStore(): void {
  useLibraryStore.setState({ selecting: false });
}
