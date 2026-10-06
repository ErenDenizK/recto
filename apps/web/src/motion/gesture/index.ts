/**
 * The gesture core (09-primitives §31; spec X5, D1-7): every recogniser and threshold of the
 * touch contract (research 19 §6, flows.md §7.1), on Pointer Events, with no dependency. The
 * consumers hit-test; this module only recognises.
 *
 * - `constants.ts`: `GESTURE`, the one threshold set (450 ms and 10 px long press, double tap,
 *   multi-finger taps, the pen quiet time, the reserved edges).
 * - `arena.ts`: the per-element arena that arbitrates (a claim resets the others).
 * - `long-press.ts`, `taps.ts`, `multi-finger-tap.ts`, `pinch.ts`: the pure recognisers.
 * - `wheel-zoom.ts`: the trackpad pinch and the Mod+wheel notch, told apart (D2-10).
 * - `dom.ts`: the attach functions (capture-phase presses, window releases, WebKit's callout,
 *   Android's `contextmenu` echo, Safari's gesture events).
 * - `hooks.ts`: `useLongPress`, `useTaps`, `useMultiFingerTap`, `usePinch`.
 *
 * Recognition never reads reduced motion (language.md §7.5): what a gesture does stays the
 * same; only the consumer's animation of the result changes.
 */
export {
  type Arena,
  type Contact,
  createArena,
  type PointerLike,
  type PointerPhase,
  type Recogniser,
} from './arena';
export { GESTURE, slopFor } from './constants';
export {
  attachLongPress,
  attachMultiFingerTap,
  attachPinch,
  attachRecogniser,
  attachTaps,
  type GestureTarget,
} from './dom';
export { useLongPress, useMultiFingerTap, usePinch, useTaps } from './hooks';
export { type LongPress, type LongPressOptions, longPress } from './long-press';
export { type MultiFingerTapOptions, multiFingerTap } from './multi-finger-tap';
export { type Pinch, type PinchOptions, type Point, pinch } from './pinch';
export { doubleTapReach, type TapOptions, taps } from './taps';
export {
  attachWheelZoom,
  WHEEL_ZOOM,
  type WheelLike,
  type WheelZoom,
  type WheelZoomOptions,
  wheelZoom,
  wheelZoomKind,
} from './wheel-zoom';
