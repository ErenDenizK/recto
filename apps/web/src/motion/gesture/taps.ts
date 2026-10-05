/**
 * Taps and double taps (research 19 §6; flows.md §7.1; 05-canvas §4 *double tap*;
 * 09-primitives §31 `useTaps`).
 *
 * A tap is a press of the primary button released within `GESTURE.longPressMs` that moved no
 * more than the slop (`GESTURE.slopPx` for touch and pen, `GESTURE.mouseDragPx` for a mouse),
 * while it was the only pointer down. A double tap is a second tap of the same pointer type
 * that lands within `GESTURE.doubleTapMs` of the first one's release and within
 * `GESTURE.doubleTapPx` of it (coarse: touch and pen) or `GESTURE.doubleTapFinePx` (a mouse).
 *
 * By default each tap calls `onTap` as it lands and the second also calls `onDoubleTap`, in the
 * order of DOM `click`, `click`, `dblclick`. With `exclusive`, a consumer that must not act twice
 * (smart zoom under a tap that would also clear the selection) gets either one `onTap`, held
 * back until no second tap can come, or one `onDoubleTap` and no single taps.
 *
 * A second pointer cancels the tap in progress (09-primitives §31 rules); a fired long press
 * claims the arena, so its release is no tap.
 */
import { type Arena, distance, type PointerLike, type Recogniser } from './arena';
import { GESTURE, slopFor } from './constants';

export interface TapOptions<E extends PointerLike = PointerLike> {
  /** A single tap (held back by `GESTURE.doubleTapMs` when `exclusive`); its release event. */
  onTap?(e: E): void;
  /** The second of two quick, close taps; its release event. */
  onDoubleTap?: ((e: E) => void) | undefined;
  /** One gesture, one call: a double tap fires no single taps. */
  exclusive?: boolean | undefined;
  /** Pointer types that tap; all by default. */
  types?: readonly string[] | undefined;
}

interface Landing {
  readonly pointerType: string;
  readonly x: number;
  readonly y: number;
  /** Release time. */
  readonly t: number;
}

/** The distance two taps may be apart and still make a double tap, by pointer type. */
export function doubleTapReach(pointerType: string): number {
  return pointerType === 'mouse' ? GESTURE.doubleTapFinePx : GESTURE.doubleTapPx;
}

export function taps<E extends PointerLike = PointerLike>(options: TapOptions<E>): Recogniser<E> {
  let press: { id: number; pointerType: string; x: number; y: number; t: number } | null = null;
  /** The last single tap, while a second one could still make it a double. */
  let last: Landing | null = null;
  /** An exclusive single tap waiting for `doubleTapMs` to pass. */
  let held: { e: E; timer: ReturnType<typeof setTimeout> } | null = null;

  /** Forgets the held tap (it became a double tap, or the recogniser left). */
  const drop = () => {
    if (held) clearTimeout(held.timer);
    held = null;
  };
  /** The held tap lands now. */
  const flush = () => {
    const tap = held;
    drop();
    if (tap) options.onTap?.(tap.e);
  };

  return {
    down(e, arena: Arena<E>) {
      if (arena.contacts.size !== 1) {
        press = null;
        return;
      }
      const types = options.types;
      if (e.button !== 0 || (types && !types.includes(e.pointerType))) return;
      press = {
        id: e.pointerId,
        pointerType: e.pointerType,
        x: e.clientX,
        y: e.clientY,
        t: e.timeStamp,
      };
    },
    move(e) {
      if (press?.id !== e.pointerId) return;
      if (distance(press.x, press.y, e.clientX, e.clientY) > slopFor(press.pointerType)) {
        press = null;
      }
    },
    up(e) {
      if (press?.id !== e.pointerId) return;
      const tap = press;
      press = null;
      if (e.timeStamp - tap.t > GESTURE.longPressMs) return;
      const double =
        options.onDoubleTap !== undefined &&
        last !== null &&
        last.pointerType === tap.pointerType &&
        tap.t - last.t <= GESTURE.doubleTapMs &&
        distance(last.x, last.y, tap.x, tap.y) <= doubleTapReach(tap.pointerType);
      if (double) {
        last = null;
        if (options.exclusive) drop();
        else options.onTap?.(e);
        options.onDoubleTap?.(e);
        return;
      }
      last = { pointerType: tap.pointerType, x: tap.x, y: tap.y, t: e.timeStamp };
      if (options.exclusive && options.onDoubleTap) {
        // A previous single tap still held cannot pair any more: it lands first.
        flush();
        held = { e, timer: setTimeout(flush, GESTURE.doubleTapMs) };
      } else {
        options.onTap?.(e);
      }
    },
    cancel(e) {
      if (press?.id === e.pointerId) press = null;
    },
    reset() {
      press = null;
      last = null;
    },
    dispose() {
      press = null;
      last = null;
      drop();
    },
  };
}
