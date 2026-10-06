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
 *
 * The spec names `ui-store` for `focusMode` and `chromeHidden`; they live here, beside the
 * frame that owns them, so the shared store keeps only state that outlives a window.
 */
import { create } from 'zustand';

export type TitleMenuFocus = 'menu' | 'name' | 'facts';
export type PillMenuFocus = 'first' | 'page';

export interface FrameState {
  readonly focusMode: boolean;
  readonly chromeHidden: boolean;
  readonly titleMenu: TitleMenuFocus | null;
  readonly pillMenu: PillMenuFocus | null;
  readonly findOpen: boolean;
  readonly findFocus: number;
}

const INITIAL: FrameState = {
  focusMode: false,
  chromeHidden: false,
  titleMenu: null,
  pillMenu: null,
  findOpen: false,
  findFocus: 0,
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

/** Tests: the frame as a window opens. */
export function resetFrameStore(): void {
  useFrameStore.setState(INITIAL);
}
