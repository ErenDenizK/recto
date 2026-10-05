/**
 * Pinch: two fingers that scale and pan (05-canvas §4; research 19 §3.3, M-16, M-18; research
 * 18 §9 *pinch zoom*; 09-primitives §31 `usePinch`).
 *
 * The first two touch pointers make the pair; a third finger is ignored, a pen never pinches.
 * The pair becomes a pinch once either finger moves past `GESTURE.slopPx` or their span
 * changes by as much; the pinch then claims the arena, which cancels a pending long press, a
 * two-finger tap and any tap. Scale is 1:1 from the span when the second finger landed (the
 * grab is kept, research 18 §9) and the origin is the fingers' midpoint, the focal point to
 * zoom about. Release (either finger lifts, or the browser takes one) ends the gesture with the
 * velocity of log2(scale) in units per second from `velocityTracker()`, the quantity the zoom
 * controller projects with r 0.99 and hands to `--spring-fling`. Recognition never reads
 * reduced motion: tracking stays 1:1 and the consumer drops the momentum (language.md §7.5).
 *
 * Safari's `gesturestart` / `gesturechange` / `gestureend` (a trackpad pinch, which has no
 * pointers) drive the same callbacks through `external()`; the DOM wiring ignores them while a
 * pointer pair is down, since iOS sends both for one touch pinch.
 *
 * `touch-action`: the element keeps `pan-x pan-y` (the stage, M-18) so one finger scrolls
 * natively and the browser's own pinch zoom is off there, or `none` where the consumer pans too.
 * With `auto` or `manipulation` the browser zooms the page and cancels the pointers.
 */
import { velocityTracker } from '../velocity';
import { distance, type PointerLike, type Recogniser } from './arena';
import { GESTURE } from './constants';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PinchOptions {
  /** The pinch began about `origin` (client px). */
  onStart?(origin: Point): void;
  /** Scale since the start (1 = unchanged) and the current focal point. */
  onChange?(scale: number, origin: Point): void;
  /** The fingers lifted: the last scale, the velocity of log2(scale) per second, the origin. */
  onEnd?(scale: number, velocity: number, origin: Point): void;
}

export interface Pinch<E extends PointerLike = PointerLike> extends Recogniser<E> {
  /** Whether a pinch is under way. */
  readonly active: boolean;
  /** Safari gesture events: `scale` since the gesture began, at `origin`, at time `t`. */
  external(phase: 'start' | 'change' | 'end', scale: number, origin: Point, t: number): void;
}

interface Finger {
  readonly id: number;
  readonly startX: number;
  readonly startY: number;
  x: number;
  y: number;
}

export function pinch<E extends PointerLike = PointerLike>(options: PinchOptions): Pinch<E> {
  let pair: [Finger, Finger] | null = null;
  /** Span when the pair formed. */
  let span = 1;
  let active = false;
  let scale = 1;
  let origin: Point = { x: 0, y: 0 };
  let tracker = velocityTracker();

  const begin = (at: Point, t: number) => {
    active = true;
    scale = 1;
    origin = at;
    tracker = velocityTracker();
    tracker.add(t, 0, 0);
    options.onStart?.(at);
  };
  const change = (next: number, at: Point, t: number) => {
    scale = next;
    origin = at;
    tracker.add(t, Math.log2(next), 0);
    options.onChange?.(next, at);
  };
  /** Ends the pinch; `t` undefined ends it with no momentum (the arena was reset). */
  const finish = (t?: number) => {
    if (!active) return;
    active = false;
    options.onEnd?.(scale, t === undefined ? 0 : tracker.velocity(t).x, origin);
  };
  /** One of the pair lifted, or the browser took it (05-canvas §4: a lost pointer ends it). */
  const lift = (e: PointerLike) => {
    if (!pair?.some((f) => f.id === e.pointerId)) return;
    pair = null;
    finish(e.timeStamp);
  };

  const geometry = ([a, b]: [Finger, Finger]) => ({
    span: Math.max(1, distance(a.x, a.y, b.x, b.y)),
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  });

  const recogniser: Pinch<E> = {
    get active() {
      return active;
    },
    down(e, arena) {
      if (pair || e.pointerType !== 'touch' || arena.touches() !== 2) return;
      const fingers: Finger[] = [];
      for (const [id, contact] of arena.contacts) {
        if (contact.pointerType !== 'touch') continue;
        fingers.push({ id, startX: contact.x, startY: contact.y, x: contact.x, y: contact.y });
      }
      const [a, b] = fingers;
      if (!a || !b) return;
      pair = [a, b];
      span = geometry(pair).span;
    },
    move(e, arena) {
      const finger = pair?.find((f) => f.id === e.pointerId);
      if (!pair || !finger) return;
      finger.x = e.clientX;
      finger.y = e.clientY;
      const now = geometry(pair);
      if (!active) {
        const moved = pair.some((f) => distance(f.startX, f.startY, f.x, f.y) > GESTURE.slopPx);
        if (!moved && Math.abs(now.span - span) <= GESTURE.slopPx) return;
        const [a, b] = pair;
        begin({ x: (a.startX + b.startX) / 2, y: (a.startY + b.startY) / 2 }, e.timeStamp);
        arena.claim(recogniser);
      }
      change(now.span / span, now.mid, e.timeStamp);
    },
    up: lift,
    cancel: lift,
    reset() {
      pair = null;
      finish();
    },
    external(phase, next, at, t) {
      if (phase === 'start') begin(at, t);
      else if (!active) return;
      else if (phase === 'change') change(next, at, t);
      else finish(t);
    },
  };
  return recogniser;
}
