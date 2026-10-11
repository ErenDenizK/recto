/**
 * The phone's selection chrome (`design/phone-2026-10/README.md` §4 "Placing a signature selects
 * it, with handles sized for touch"; Q-9's 44 px targets), installed on the annotation layer
 * when the editing chunk loads (`annotations/selection-chrome.ts`): the four corner handles
 * drawn at 14 px, each inside a 48 px hit square (still over 44 px where the page's fit scale
 * shrinks it slightly, as in landscape), and the phone's own bar (`TouchBar.tsx`) in place of
 * the desktop AnnotationBar. A drag on the selection moves it, as on the desktop.
 */
import { setSelectionChrome } from '../../../annotations/selection-chrome';
import { TouchBar } from './TouchBar';

/** The drawn handle and its hit square, CSS px. */
export const TOUCH_HANDLE = 14;
export const TOUCH_HANDLE_HIT = 48;

setSelectionChrome({
  handle: TOUCH_HANDLE,
  hit: TOUCH_HANDLE_HIT,
  cornersOnly: true,
  Bar: TouchBar,
});
