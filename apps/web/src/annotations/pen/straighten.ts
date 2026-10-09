/**
 * Straight pen lines and shapes (craft spec §5.6; research 12 §7; motion-2026-10/ink-shapes.md):
 * hold to shape, and Shift.
 *
 * - **Hold to shape.** While a stroke is drawn, a pointer that stays within `holdRadius` of
 *   one spot for `HOLD_STRAIGHTEN_MS` (`HOLD_WRITING_MS` in a writing context) asks the
 *   recogniser (`shapes.ts`) whether the stroke is a deliberate shape: a line, an arrow, a
 *   rectangle or square, a triangle, pentagon or hexagon, a circle or ellipse. Only a stroke
 *   that fits one with confidence snaps (`shape-hold.ts`); handwriting held still stays as
 *   written. A line runs from the stroke's first point to the pointer and follows it until
 *   release. A press held still before the pointer has moved does not count (there is no
 *   stroke yet). `HoldStill` is the timing rule over every sample the pipeline sees
 *   (coalesced and predicted pointer events too); the pipeline (`ink-input.ts`) asks it when
 *   the hold is due.
 * - **Writing context.** A stroke that starts within `WRITING_GAP_MS` of the previous
 *   stroke's release is writing: its hold must last `HOLD_WRITING_MS` and its fit is stricter
 *   (`RecognizeOptions.strict`).
 * - **The cue.** When the shape snaps it is drawn 1 px thicker for 120 ms, a visual cue in
 *   place of a haptic one; none under reduced motion.
 * - **Shift.** A straight line whose end snaps to the nearest multiple of 45° (horizontal,
 *   vertical or diagonal), in the preview as in the commit (`snapAngle`). With the
 *   Highlighter such a line over text becomes a Highlight by the usual rule (`highlighter.ts`).
 */
import { type Point, snapAngle } from '../ink';

/** How long the pointer must stay still (ms). */
export const HOLD_STRAIGHTEN_MS = 500;
/** How long in a writing context (ms). */
export const HOLD_WRITING_MS = 800;
/** A stroke pressed this soon after the previous release is writing (ms). */
export const WRITING_GAP_MS = 600;
/** How far a mouse may wander and still be still (CSS px). */
export const HOLD_STRAIGHTEN_PX = 3;
/** A pen's and a finger's tolerance: their contact trembles more than a mouse (CSS px). */
export const HOLD_PEN_PX = 4;
export const HOLD_TOUCH_PX = 6;

/** The still radius for a pointer type. */
export function holdRadius(pointerType: string): number {
  return pointerType === 'touch'
    ? HOLD_TOUCH_PX
    : pointerType === 'pen'
      ? HOLD_PEN_PX
      : HOLD_STRAIGHTEN_PX;
}
/** How long the snapped line is drawn thicker (ms). */
export const STRAIGHTEN_CUE_MS = 120;
/** How much thicker (CSS px). */
export const STRAIGHTEN_CUE_PX = 1;

/**
 * The hold rule over a stroke's samples (CSS px, event time in ms): the hold starts at the
 * newest sample that left the tolerance circle of the previous anchor.
 */
export class HoldStill {
  private startX = 0;
  private startY = 0;
  private anchorX = 0;
  private anchorY = 0;
  private anchorT = 0;
  /** The pointer has left the press's tolerance circle: there is a stroke to straighten. */
  private moved = false;

  constructor(
    readonly ms = HOLD_STRAIGHTEN_MS,
    readonly px = HOLD_STRAIGHTEN_PX,
  ) {}

  /** The press. */
  begin(x: number, y: number, t: number): void {
    this.startX = x;
    this.startY = y;
    this.anchorX = x;
    this.anchorY = y;
    this.anchorT = t;
    this.moved = false;
  }

  /** A sample; one beyond the tolerance of the anchor becomes the new anchor. */
  add(x: number, y: number, t: number): void {
    if (Math.hypot(x - this.anchorX, y - this.anchorY) <= this.px) return;
    this.anchorX = x;
    this.anchorY = y;
    this.anchorT = t;
    if (Math.hypot(x - this.startX, y - this.startY) > this.px) this.moved = true;
  }

  /** When the pointer last left the tolerance circle (the hold's start). */
  get anchorTime(): number {
    return this.anchorT;
  }

  /** Milliseconds until the hold is due at time `t` (≤ 0: due; Infinity: nothing to hold). */
  remaining(t: number): number {
    return this.moved ? this.anchorT + this.ms - t : Number.POSITIVE_INFINITY;
  }
}

/** The end of a straight line from `start` towards `end`: snapped to 45° steps with Shift. */
export function straightEnd(start: Point, end: Point, snap: boolean): Point {
  return snap ? snapAngle(start, end) : end;
}

/**
 * Whether motion is reduced (no straighten cue then): the system's query or the Reduce motion
 * setting, from the one source (language.md §7.5, A-9).
 */
export { reducedMotion as prefersReducedMotion } from '../../motion/reduced-motion';
