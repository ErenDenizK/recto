/**
 * Gesture physics: release velocity, momentum projection and the rubber band (research 18 §9;
 * language.md §7.3 *sheet*, *pinch, smart zoom*, §7.5; 09-primitives §31).
 *
 * A release hands its velocity to a spring (Q-7: "a drag hands its velocity to the spring"):
 * `velocityTracker()` measures it, `project()` says where momentum would carry it so the caller
 * picks the nearest snap target, and `rubberBand()` gives the resistance past a limit. Under
 * reduced motion projection and the rubber band are off (§7.5: a release stops, then snaps
 * without overshoot); tracking itself stays 1:1.
 */
import { reducedMotion } from './reduced-motion';

/** Velocity over recent pointer samples. */
export interface VelocityTracker {
  /** Adds a sample: `t` in ms on the `performance.now()` clock (an event's `timeStamp`), px. */
  add(t: number, x: number, y: number): void;
  /** Px per second at `now`; zero when the last sample is over 50 ms old (the pointer stopped). */
  velocity(now?: number): { x: number; y: number };
}

/** A pointer that has not moved for this long has stopped: its release carries no momentum. */
const STOPPED_MS = 50;

/**
 * A least-squares velocity over the samples of the last `windowMs` (research 18 §9: 100 ms,
 * coalesced events included). Least squares rather than the last two samples, so one jittery
 * or late sample cannot fling a sheet across the screen. One tracker per gesture.
 */
export function velocityTracker(windowMs = 100): VelocityTracker {
  let samples: [t: number, x: number, y: number][] = [];
  return {
    add(t, x, y) {
      samples.push([t, x, y]);
      samples = samples.filter(([at]) => at >= t - windowMs);
    },
    velocity(now = performance.now()) {
      // The slope of x(t) and y(t) by least squares, with t counted from the newest sample.
      const newest = samples.at(-1)?.[0] ?? 0;
      let n = 0;
      let st = 0;
      let sx = 0;
      let sy = 0;
      let stt = 0;
      let stx = 0;
      let sty = 0;
      for (const [at, x, y] of samples) {
        const t = at - newest;
        n++;
        st += t;
        sx += x;
        sy += y;
        stt += t * t;
        stx += t * x;
        sty += t * y;
      }
      const d = (n * stt - st * st) / 1000;
      return d && now - newest <= STOPPED_MS
        ? { x: (n * stx - st * sx) / d, y: (n * sty - st * sy) / d }
        : { x: 0, y: 0 };
    },
  };
}

/**
 * The distance momentum carries a release of `velocity` (units per second) with the per-
 * millisecond `decelerationRate` (UIScrollView's projection, research 18 §9):
 * (v / 1000) · r / (1 − r). Use 0.998 for throwing things (a 1000 px/s flick goes 499 px) and
 * 0.99 for zoom and fine controls. Add it to the release position, snap to the nearest target,
 * then spring there on `fling` with the release velocity. Zero under reduced motion.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  if (reducedMotion()) return 0;
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * How far past a limit to show an `offset` that went past it, in a `dimension` (the sheet's
 * height, the viewport): (1 − 1 / (|x| · c / D + 1)) · D, with UIScrollView's c = 0.55
 * (research 18 §9). Signed like `offset`; always less than `dimension`. Zero under reduced
 * motion: the content stops at the limit.
 */
export function rubberBand(offset: number, dimension: number, constant = 0.55): number {
  if (reducedMotion() || dimension <= 0) return 0;
  return Math.sign(offset) * (1 - 1 / ((Math.abs(offset) * constant) / dimension + 1)) * dimension;
}
