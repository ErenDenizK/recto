/**
 * The long-press recogniser (04-context §2.3; research 19 §6, M-20; 09-primitives §31).
 *
 * | Step   | Behaviour |
 * |--------|-----------|
 * | Start  | A press of an allowed pointer type (touch and pen by default), the only pointer down, primary button, and `shouldStart` agrees (the consumer refuses a drawing pointer, a grabber) |
 * | Fire   | `GESTURE.longPressMs` (450 ms) with no more than `GESTURE.slopPx` (10 px) of movement; the recogniser claims the arena, so the release is no tap |
 * | Cancel | Movement past the slop, a second pointer (a pinch, a two-finger tap), the release, `pointercancel` (the browser started a scroll), another recogniser's claim, or `cancel()` (the DOM wiring's scroll start) |
 *
 * The press point is the start point: `onFire` receives the press event, and the consumer
 * hit-tests that. Pure logic over the arena; the echoes (Android's `contextmenu`, the release's
 * `click`) and WebKit's callout are the DOM wiring's (`dom.ts`).
 */
import { type Arena, distance, type PointerLike, type Recogniser } from './arena';
import { GESTURE } from './constants';

export interface LongPressOptions<E extends PointerLike = PointerLike> {
  /** The press held still for `GESTURE.longPressMs`; receives the press event (start point). */
  onFire(e: E): void;
  /** Pointer types that may long-press; touch and pen by default (a mouse right-clicks). */
  types?: readonly string[] | undefined;
  /** Whether this press may become a long press (consumers refuse drawing pointers here). */
  shouldStart?(e: E): boolean;
  /** The press became a candidate (DOM wiring: suppress the callout under it). */
  onPressStart?(e: E): void;
  /** The candidate ended: fired, or cancelled. */
  onPressEnd?(fired: boolean): void;
}

export interface LongPress<E extends PointerLike = PointerLike> extends Recogniser<E> {
  /** Whether a press is waiting to fire. */
  readonly pending: boolean;
  /** Fires the waiting press now (Android's `contextmenu` arrived first); false if none. */
  fire(): boolean;
  /** Drops the waiting press: with no event (a scroll started), or for `e`'s pointer. */
  cancel(e?: E): void;
}

const DEFAULT_TYPES: readonly string[] = ['touch', 'pen'];

export function longPress<E extends PointerLike = PointerLike>(
  options: LongPressOptions<E>,
): LongPress<E> {
  let press: { e: E; arena: Arena<E>; timer: ReturnType<typeof setTimeout> } | null = null;

  const end = (fired: boolean) => {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
    options.onPressEnd?.(fired);
  };

  const fire = (): boolean => {
    if (!press) return false;
    const { e, arena } = press;
    end(true);
    arena.claim(recogniser);
    options.onFire(e);
    return true;
  };

  const recogniser: LongPress<E> = {
    get pending() {
      return press !== null;
    },
    fire,
    down(e, arena) {
      // A second pointer cancels: a pinch or a two-finger tap, never a long press.
      if (arena.contacts.size !== 1) {
        end(false);
        return;
      }
      const types = options.types ?? DEFAULT_TYPES;
      if (!types.includes(e.pointerType) || e.button !== 0) return;
      if (options.shouldStart && !options.shouldStart(e)) return;
      end(false);
      press = { e, arena, timer: setTimeout(fire, GESTURE.longPressMs) };
      options.onPressStart?.(e);
    },
    move(e) {
      if (press?.e.pointerId !== e.pointerId) return;
      const start = press.e;
      if (distance(start.clientX, start.clientY, e.clientX, e.clientY) > GESTURE.slopPx) {
        end(false);
      }
    },
    up(e) {
      if (press?.e.pointerId === e.pointerId) end(false);
    },
    cancel(e?: E) {
      if (e === undefined || press?.e.pointerId === e.pointerId) end(false);
    },
    reset() {
      end(false);
    },
    dispose() {
      end(false);
    },
  };
  return recogniser;
}
