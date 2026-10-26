/**
 * Auto-capture steadiness (plan bm-scan-plan §2: "corners hold within 1.5 % of the diagonal for
 * ~700 ms and sharpness passes"). The tracker anchors on the first quad of a hold; a quad that
 * strays from the anchor, a missing quad or a blurred frame starts the hold again.
 */
import type { Pt } from './contour';

export const HOLD_MS = 700;
/** Largest corner drift from the anchor, as a share of the frame diagonal. */
export const DRIFT_SHARE = 0.015;
/**
 * Smallest Laplacian variance (`sharpness()` of a 480 px frame) for a capture. A starting value
 * for the camera lane to tune on real devices (plan §2: sharpness gate).
 */
export const MIN_SHARPNESS = 30;

/** Smallest detection confidence the worker feeds the tracker; a weaker quad counts as lost. */
export const MIN_CONFIDENCE = 0.6;

export interface StabilityTracker {
  /** Feed one frame; true once the quad has held still for `HOLD_MS` on sharp frames. */
  push(corners: readonly Pt[] | null, sharp: number, timeMs: number): boolean;
  reset(): void;
}

/** @param diagonal the frame diagonal in the same units as the corners */
export function createStabilityTracker(diagonal: number): StabilityTracker {
  let anchor: readonly Pt[] | null = null;
  let since = 0;
  return {
    push(corners, sharp, timeMs) {
      if (!corners || sharp < MIN_SHARPNESS) {
        anchor = null;
        return false;
      }
      const held = anchor;
      const drift = held
        ? Math.max(
            ...corners.map((c, i) => {
              const a = held[i];
              return a ? Math.hypot(c.x - a.x, c.y - a.y) : Infinity;
            }),
          )
        : Infinity;
      if (drift > diagonal * DRIFT_SHARE) {
        anchor = corners;
        since = timeMs;
        return false;
      }
      return timeMs - since >= HOLD_MS;
    },
    reset() {
      anchor = null;
    },
  };
}
