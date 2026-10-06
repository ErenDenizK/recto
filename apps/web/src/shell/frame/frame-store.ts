/**
 * The frame's window state (`components/01-frame.md` F5, F6, F11, F12, F13): what the frame
 * shows over the page right now. Per window, never in the snapshot or `localStorage`: Focus
 * is "per window, not kept in the snapshot" (F13 §6), and hidden bars, open menus and the
 * Find field are moments, not settings.
 *
 * - `focusMode` (F13, RA-12): the dock and the page pill step away; the strip stays from
 *   medium up (◆, Find, Save and ↶ stay reachable), the compact bar goes too.
 * - `chromeHidden` (F12): the compact bar and the dock moved out by hide on scroll.
 * - `titleMenu`: the title menu is open, and what took focus when it opened (`menu`, the
 *   first row; `name`, the name field for F2 and Rename…; `facts`).
 * - `pillMenu`: the page pill's menu is open (`page` for Mod+G, which focuses Go to page).
 * - `findOpen` / `findFocus`: the Find field laid over the strip below 1280 px (F6 §2), and
 *   a counter Mod+F bumps to focus and select the field wherever it is.
 * - `sidebarOverlay` / `overlaySidebarShown`: on medium and compact-height the sidebar is laid
 *   over the page (F1 §2, "page unchanged: no reflow"), so it shows only once asked for in
 *   this window (▤, Mod+B, a view opened), never from the stored layout alone, and a press
 *   outside or Esc puts it away. The stored open state stays the docked sidebar's.
 *
 * The spec names `ui-store` for `focusMode` and `chromeHidden`; they live here, beside the
 * frame that owns them, so the shared store keeps only state that outlives a window.
 */
import { create } from 'zustand';

import { useUiStore } from '../../state/ui-store';

export type TitleMenuFocus = 'menu' | 'name' | 'facts';
export type PillMenuFocus = 'first' | 'page';

export interface FrameState {
  readonly focusMode: boolean;
  readonly chromeHidden: boolean;
  readonly titleMenu: TitleMenuFocus | null;
  readonly pillMenu: PillMenuFocus | null;
  readonly findOpen: boolean;
  readonly findFocus: number;
  readonly sidebarOverlay: boolean;
  readonly overlaySidebarShown: boolean;
}

const INITIAL: FrameState = {
  focusMode: false,
  chromeHidden: false,
  titleMenu: null,
  pillMenu: null,
  findOpen: false,
  findFocus: 0,
  sidebarOverlay: false,
  overlaySidebarShown: false,
};

export const useFrameStore = create<FrameState>()(() => INITIAL);

export function setFocusMode(focusMode: boolean): void {
  if (useFrameStore.getState().focusMode !== focusMode) useFrameStore.setState({ focusMode });
}

export function setChromeHidden(chromeHidden: boolean): void {
  if (useFrameStore.getState().chromeHidden !== chromeHidden) {
    useFrameStore.setState({ chromeHidden });
  }
}

export function openTitleMenu(focus: TitleMenuFocus = 'menu'): void {
  useFrameStore.setState({ titleMenu: focus, chromeHidden: false });
}

export function closeTitleMenu(): void {
  useFrameStore.setState({ titleMenu: null });
}

export function openPillMenu(focus: PillMenuFocus = 'first'): void {
  useFrameStore.setState({ pillMenu: focus, chromeHidden: false });
}

export function closePillMenu(): void {
  useFrameStore.setState({ pillMenu: null });
}

/** Mod+F: shows the Find field (over the strip below 1280 px) and focuses it. */
export function focusFindEntry(): void {
  useFrameStore.setState((s) => ({
    findOpen: true,
    findFocus: s.findFocus + 1,
    chromeHidden: false,
  }));
}

export function closeFindOverlay(): void {
  useFrameStore.setState({ findOpen: false });
}

/** The sidebar is laid over the page from now on (medium, compact-height), or docked again. */
export function setSidebarOverlay(sidebarOverlay: boolean): void {
  if (useFrameStore.getState().sidebarOverlay === sidebarOverlay) return;
  useFrameStore.setState({ sidebarOverlay, overlaySidebarShown: false });
}

/** Shows or puts away the sidebar laid over the page. */
export function showOverlaySidebar(overlaySidebarShown: boolean): void {
  if (useFrameStore.getState().overlaySidebarShown !== overlaySidebarShown) {
    useFrameStore.setState({ overlaySidebarShown });
  }
}

/** Whether the sidebar shows: the stored state, and when laid over the page, asked for. */
export function sidebarShown(stored: boolean, frame: FrameState): boolean {
  return stored && (!frame.sidebarOverlay || frame.overlaySidebarShown);
}

export function useSidebarShown(): boolean {
  const stored = useUiStore((s) => s.leftPanelOpen);
  const frame = useFrameStore((s) => s.sidebarOverlay && !s.overlaySidebarShown);
  return stored && !frame;
}

/** ▤ and Mod+B: the docked sidebar flips its stored state; the laid-over one shows or goes. */
export function toggleSidebar(): void {
  const ui = useUiStore.getState();
  if (!useFrameStore.getState().sidebarOverlay) {
    ui.toggleLeftPanel();
    return;
  }
  if (sidebarShown(ui.leftPanelOpen, useFrameStore.getState())) {
    showOverlaySidebar(false);
    return;
  }
  if (!ui.leftPanelOpen) ui.toggleLeftPanel();
  showOverlaySidebar(true);
}

/** Tests: the frame as a window opens. */
export function resetFrameStore(): void {
  useFrameStore.setState(INITIAL);
}
