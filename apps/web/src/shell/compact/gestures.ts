/**
 * The compact reader's gesture rules, as pure functions (ADR-0033 §2.3 "Chrome";
 * `components/01-frame.md` F12 for the scroll thresholds).
 *
 * - **Hide on scroll:** 24 px of downward scroll (reset on a change of direction) hides the
 *   top bar and the capsule; 8 px upward, or reaching either end of the document, shows
 *   them. While `canHide` is false (the last input was a key, focus is in the chrome, a sheet,
 *   the menu or Find is open, the document fits the screen) they stay shown.
 * - **Taps:** a press that neither moved nor scrolled is a tap; two taps within 300 ms and
 *   32 px are a double tap (fit ⇄ 2× at the point), and a lone tap toggles the chrome once
 *   that window has passed.
 */

/** Downward scroll that hides the chrome, CSS px. */
export const HIDE_AFTER_PX = 24;
/** Upward scroll that shows it again, CSS px. */
export const SHOW_AFTER_PX = 8;
/** The page pill stays this long after the last scroll while the chrome is hidden. */
export const PILL_LINGER_MS = 1500;

export interface HideState {
  readonly hidden: boolean;
  /** Signed run of scroll in the current direction, CSS px. */
  readonly travel: number;
  readonly lastTop: number;
}

export const INITIAL_HIDE: HideState = { hidden: false, travel: 0, lastTop: 0 };

export interface ScrollSample {
  readonly top: number;
  /** The largest scrollTop (scrollHeight − clientHeight). */
  readonly maxTop: number;
  readonly canHide: boolean;
}

/** The chrome's state after a scroll event. */
export function onReaderScroll(state: HideState, sample: ScrollSample): HideState {
  const { top, maxTop, canHide } = sample;
  const delta = top - state.lastTop;
  if (!canHide || top <= 0 || top >= maxTop - 1) {
    return { hidden: false, travel: 0, lastTop: top };
  }
  if (delta === 0) return state.lastTop === top ? state : { ...state, lastTop: top };
  const travel =
    delta > 0
      ? state.travel > 0
        ? state.travel + delta
        : delta
      : state.travel < 0
        ? state.travel + delta
        : delta;
  let { hidden } = state;
  if (travel >= HIDE_AFTER_PX) hidden = true;
  else if (travel <= -SHOW_AFTER_PX) hidden = false;
  return { hidden, travel, lastTop: top };
}

/** A press that was not a tap: moved (CSS px) or held too long. */
export const TAP_MAX_MOVE_PX = 10;
export const TAP_MAX_DURATION_MS = 500;
/** Two taps this close in time and space are a double tap. */
export const DOUBLE_TAP_MS = 300;
export const DOUBLE_TAP_DISTANCE_PX = 32;

export interface PressSample {
  readonly x: number;
  readonly y: number;
  readonly time: number;
  /** The scroller's position when the press began and ended. */
  readonly scrollLeft: number;
  readonly scrollTop: number;
}

/** Whether a press from `down` to `up` was a tap: no movement, no scroll, not held. */
export function isTap(down: PressSample, up: PressSample): boolean {
  return (
    Math.hypot(up.x - down.x, up.y - down.y) <= TAP_MAX_MOVE_PX &&
    up.time - down.time <= TAP_MAX_DURATION_MS &&
    Math.abs(up.scrollTop - down.scrollTop) < 2 &&
    Math.abs(up.scrollLeft - down.scrollLeft) < 2
  );
}

export interface TapRecord {
  readonly x: number;
  readonly y: number;
  readonly time: number;
}

/** Whether `tap` completes a double tap begun by `previous`. */
export function isDoubleTap(previous: TapRecord | null, tap: TapRecord): boolean {
  return (
    previous !== null &&
    tap.time - previous.time <= DOUBLE_TAP_MS &&
    Math.hypot(tap.x - previous.x, tap.y - previous.y) <= DOUBLE_TAP_DISTANCE_PX
  );
}
