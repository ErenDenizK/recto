/**
 * The touch contract's thresholds as one constant set (09-primitives §31; research 19 §6;
 * flows.md §7.1; spec X5). Every recogniser in `motion/gesture/` reads these and nothing else,
 * so a threshold changes in one place for the page menu, the cards, the tabs, ↶ and the
 * thumbnails alike.
 */
export const GESTURE = {
  /** Long press (M-20): UIKit uses 500 ms, Android 400 ms; Base UI's own 500 ms is not used. */
  longPressMs: 450,
  /** Movement that ends a touch or pen press: a long press, a tap (WWDC18's "10 points"). */
  slopPx: 10,
  /** A second tap must land this soon after the first one lifted (Android's measure). */
  doubleTapMs: 300,
  /** …and this close to it, for touch and pen (coarse: a lifted finger lands imprecisely). */
  doubleTapPx: 24,
  /**
   * …and this close with a mouse (fine): a mouse that moved further between two clicks was
   * repositioned, not double-clicked (the desktop double-click rectangle; `mouseDragPx`).
   */
  doubleTapFinePx: 4,
  /** Every finger of a multi-finger tap lands within this of the first one (M-17). */
  multiTapMs: 150,
  /** …each moves less than this… */
  multiTapPx: 12,
  /** …and all have lifted within this of the first contact (research 19 §6). */
  multiTapUpMs: 300,
  /** A pen in contact, or lifted this recently, turns finger multi-taps off (palm rule). */
  penQuietMs: 500,
  /** A mouse press that moves this far is a drag, not a click (research 18 §9). */
  mouseDragPx: 4,
  /** After a long press fires, the `click` of its release is swallowed this long (04 §2.3). */
  clickEchoMs: 400,
  /** …and Android's `contextmenu` from the same touch is ignored this long (04 §2.3). */
  contextMenuEchoMs: 700,
  /** Reserved edges (M-22): no custom swipe starts this close to the sides, bottom, top. */
  edge: { side: 24, bottom: 34, top: 44 },
} as const;

/** The touch slop for a pointer type: a mouse drags after 4 px, touch and pen after 10. */
export function slopFor(pointerType: string): number {
  return pointerType === 'mouse' ? GESTURE.mouseDragPx : GESTURE.slopPx;
}
