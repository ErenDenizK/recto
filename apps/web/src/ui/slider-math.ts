/**
 * The Slider's maths (`10-ink.md` §3.3, §3.5), pure so it can be tested without a browser.
 *
 * - **Scales.** A slider moves a knob along a *position* `t` from 0 (start) to 1 (end); the
 *   scale maps that position to a value. Linear for opacity, hue, saturation, brightness and
 *   quality. Logarithmic for widths: `t = ln(w / min) / ln(max / min)`, so the pen's range of
 *   0.25–24 pt gives 0.25–2 pt the first 45 % of the travel, where the small widths people
 *   write with need the room. Stops for a width with detents (the pen's, the Highlighter's):
 *   the ends and the detents sit at equal shares of the travel, so their ticks are evenly
 *   spaced, and each span between two stops is logarithmic (the pen's 0.25–2 pt keep 4 of 9
 *   spans, 44 %). Every scale round-trips within 1e-9 of the value.
 * - **Rounding.** Linear values round to the slider's step from its minimum (as a native
 *   range does). Logarithmic values round to two significant digits (0.37, 1.5, 13 pt), the
 *   precision a readout shows, unless the caller gives a step.
 * - **Detents** are magnetic: within a threshold in CSS pixels of a detent (4 px fine, 6 px
 *   coarse, §3.2) the position snaps to it. The threshold is in pixels, not in value units,
 *   so a detent feels the same on a short and a long track and on either scale.
 * - **Keys** (§3.4): an arrow moves one step, or to the next detent on a slider with detents;
 *   Shift and PageUp/PageDown move ten; Home and End go to the ends.
 * - **Rubber band** (§3.2 "Past the end"): the track stretches along a drag past its end by
 *   at most 6 px, Apple's scroll-view curve `(1 − 1 / (x·c / d + 1)) · d`. The motion core
 *   (`09-primitives` §31) will offer the same function; this copy keeps the primitive free of
 *   that package until it lands.
 * - **Stroke dot** (§3.3): the width slider's knob is the round white knob of every slider
 *   holding the stroke as it will draw, a dot of `width × zoom × 96/72` px clamped to the
 *   knob's inside (2–14 px fine, 3–20 coarse), so the knob itself never changes size.
 * - **Taper** (§3.3): the width track as one SVG path, a pill whose height grows from start
 *   to end, with true tangents between its two round caps.
 * - **Bubble** (§3.1): how far the value bubble shifts to stay inside the viewport.
 */

export type SliderScale = 'linear' | 'log' | 'stops';

export interface SliderRange {
  readonly min: number;
  readonly max: number;
  readonly scale: SliderScale;
  /** The `stops` scale's inner stops (the detents); without any it is the log scale. */
  readonly detents?: readonly number[] | undefined;
}

/** Most a dragged track stretches past either end, CSS px (§3.2). */
export const STRETCH_MAX_PX = 6;
/** Detent snap distance, CSS px: fine (mouse) and coarse (touch, pen) pointers (§3.2). */
export const DETENT_SNAP_PX = { fine: 4, coarse: 6 } as const;
/** The width knob's stroke dot, CSS px (§3.3): inside the 22 / 28 px knob, a 4 px ring kept. */
export const STROKE_DOT = {
  fine: { min: 2, max: 14 },
  coarse: { min: 3, max: 20 },
} as const;
/** CSS px per point at 100 % zoom. */
export const PX_PER_PT = 96 / 72;
/** One arrow press on a logarithmic slider without detents, as a share of the travel. */
export const LOG_KEY_STEP = 0.01;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function valid(range: SliderRange): boolean {
  if (!(range.max > range.min)) return false;
  return range.scale === 'linear' || range.min > 0;
}

/** The `stops` scale's stops: both ends and the detents strictly inside, ascending. */
function scaleStops(range: SliderRange): number[] {
  const inner = (range.detents ?? []).filter((d) => d > range.min && d < range.max);
  return [range.min, ...new Set(inner.sort((a, b) => a - b)), range.max];
}

/** The knob's position (0–1) for a value, clamped to the range. */
export function valueToPosition(value: number, range: SliderRange): number {
  if (!valid(range) || !Number.isFinite(value)) return 0;
  const v = clamp(value, range.min, range.max);
  if (range.scale === 'stops') {
    const stops = scaleStops(range);
    const spans = stops.length - 1;
    for (let i = 0; i < spans; i++) {
      const a = stops[i] as number;
      const b = stops[i + 1] as number;
      if (v <= b || i === spans - 1) return (i + Math.log(v / a) / Math.log(b / a)) / spans;
    }
  }
  if (range.scale !== 'linear') {
    return Math.log(v / range.min) / Math.log(range.max / range.min);
  }
  return (v - range.min) / (range.max - range.min);
}

/** The value at a knob position (0–1, clamped), unrounded. */
export function positionToValue(position: number, range: SliderRange): number {
  if (!valid(range) || !Number.isFinite(position)) return range.min;
  const t = clamp(position, 0, 1);
  if (range.scale === 'stops') {
    const stops = scaleStops(range);
    const spans = stops.length - 1;
    const i = Math.min(spans - 1, Math.floor(t * spans));
    const a = stops[i] as number;
    const b = stops[i + 1] as number;
    return a * (b / a) ** (t * spans - i);
  }
  if (range.scale !== 'linear') return range.min * (range.max / range.min) ** t;
  return range.min + t * (range.max - range.min);
}

/** Decimal places of a number as written (`0.05` → 2, `1e-7` → 7). */
function decimals(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const text = String(Math.abs(value));
  const exponent = /e-(\d+)$/.exec(text);
  if (exponent) return Number(exponent[1]);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** `value` rounded to a multiple of `step` counted from `origin` (no float noise). */
export function roundToStep(value: number, step: number, origin = 0): number {
  if (!(step > 0) || !Number.isFinite(value)) return value;
  const rounded = Math.round((value - origin) / step) * step + origin;
  return Number(rounded.toFixed(Math.max(decimals(step), decimals(origin))));
}

/** `value` rounded to `digits` significant digits (0.374 → 0.37, 13.4 → 13). */
export function roundSignificant(value: number, digits = 2): number {
  if (value === 0 || !Number.isFinite(value)) return value;
  return Number(value.toPrecision(digits));
}

/**
 * The value a slider shows and reports: rounded to `step` (from `min`) when one is given,
 * else to the step the scale implies (1 for linear, two significant digits for log), then
 * clamped to the range.
 */
export function roundValue(value: number, range: SliderRange, step?: number): number {
  let rounded: number;
  if (step !== undefined && step > 0) rounded = roundToStep(value, step, range.min);
  else if (range.scale !== 'linear') rounded = roundSignificant(value, 2);
  else rounded = roundToStep(value, 1, range.min);
  return clamp(rounded, range.min, range.max);
}

/** Detents inside the range, sorted and without duplicates. */
export function detentsIn(detents: readonly number[] | undefined, range: SliderRange): number[] {
  if (!detents) return [];
  return [...new Set(detents.filter((d) => d >= range.min && d <= range.max))].sort(
    (a, b) => a - b,
  );
}

export interface Snap {
  /** The position after snapping (0–1). */
  readonly position: number;
  /** The detent snapped to, or undefined. */
  readonly detent: number | undefined;
}

/**
 * Snaps a knob position to the nearest detent within `thresholdPx` CSS pixels of it, on a
 * track whose knob travels `travelPx`. Outside every detent's reach the position is kept.
 */
export function snapToDetent(
  position: number,
  detents: readonly number[],
  range: SliderRange,
  travelPx: number,
  thresholdPx: number,
): Snap {
  if (!(travelPx > 0)) return { position, detent: undefined };
  let best: number | undefined;
  let bestPx = Number.POSITIVE_INFINITY;
  for (const detent of detents) {
    const px = Math.abs(valueToPosition(detent, range) - position) * travelPx;
    if (px <= thresholdPx && px < bestPx) {
      best = detent;
      bestPx = px;
    }
  }
  return best === undefined
    ? { position, detent: undefined }
    : { position: valueToPosition(best, range), detent: best };
}

export interface KeyStepOptions extends SliderRange {
  /** Value units for a linear slider (default 1); ignored on a log slider without one. */
  readonly step?: number | undefined;
  readonly detents?: readonly number[] | undefined;
}

/**
 * The value after `count` steps in `direction` (§3.4): on a slider with detents a step is
 * the next stop (the detents and both ends); on a linear slider it is `step`; on a log
 * slider without detents it is `LOG_KEY_STEP` of the travel (or `step` value units when
 * given). The result is rounded like a dragged value and clamped.
 */
export function keyStep(
  value: number,
  direction: 1 | -1,
  count: number,
  options: KeyStepOptions,
): number {
  const range: SliderRange = options;
  const detents = detentsIn(options.detents, range);
  if (detents.length > 0) {
    const stops = [...new Set([range.min, ...detents, range.max])].sort((a, b) => a - b);
    // Small tolerance, so a value a rounding hair off a stop counts as on it.
    const epsilon = (range.max - range.min) * 1e-9;
    let at = value;
    for (let i = 0; i < count; i++) {
      const next =
        direction > 0
          ? stops.find((s) => s > at + epsilon)
          : [...stops].reverse().find((s) => s < at - epsilon);
      if (next === undefined) break;
      at = next;
    }
    return clamp(at, range.min, range.max);
  }
  if (range.scale !== 'linear' && options.step === undefined) {
    const t = valueToPosition(value, range) + direction * count * LOG_KEY_STEP;
    const next = roundValue(positionToValue(t, range), range);
    // Two significant digits can round a small move back to where it started: take the
    // next representable value so a key press always moves.
    if (next === roundValue(value, range) && t > 0 && t < 1) {
      return keyStep(value, direction, count + 1, options);
    }
    return next;
  }
  const step = options.step ?? 1;
  return roundValue(value + direction * count * step, range, step);
}

/**
 * Apple's rubber band: how far content follows a pull of `overshoot` px past an edge, with
 * `size` the most it can ever move (the limit as the pull grows) and `c` the stiffness.
 * Sign-preserving.
 */
export function rubberBand(overshoot: number, size: number, c = 0.55): number {
  if (!(size > 0) || !Number.isFinite(overshoot) || overshoot === 0) return 0;
  const x = Math.abs(overshoot);
  const moved = (1 - 1 / ((x * c) / size + 1)) * size;
  return Math.sign(overshoot) * moved;
}

/** The track's stretch for a pointer `overshoot` px past an end: at most `STRETCH_MAX_PX`. */
export function stretchFor(overshoot: number): number {
  return rubberBand(overshoot, STRETCH_MAX_PX);
}

/** The width knob's stroke dot (§3.3): the stroke's diameter at `zoom`, clamped, CSS px. */
export function strokeDot(widthPt: number, zoom: number, coarse: boolean): number {
  const limits = coarse ? STROKE_DOT.coarse : STROKE_DOT.fine;
  const raw = widthPt * zoom * PX_PER_PT;
  if (!Number.isFinite(raw)) return limits.min;
  return clamp(raw, limits.min, limits.max);
}

function n(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * The tapered width track (§3.3) as one SVG path in a box of `width` × `height` px: a pill
 * from a cap of `start` px diameter at the left to `end` px at the right, centred
 * vertically. The straight edges are the outer tangents of the two caps, so the outline
 * has no corner where an edge meets a cap.
 */
export function taperPath(width: number, height: number, start: number, end: number): string {
  const r0 = start / 2;
  const r1 = end / 2;
  const cy = height / 2;
  const x0 = r0;
  const x1 = width - r1;
  const d = x1 - x0;
  if (!(d > Math.abs(r1 - r0))) return '';
  // Outer tangent: the normal (−s, ∓c) is shared by both caps.
  const s = (r1 - r0) / d;
  const c = Math.sqrt(1 - s * s);
  const top0 = [x0 - r0 * s, cy - r0 * c];
  const top1 = [x1 - r1 * s, cy - r1 * c];
  const bottom1 = [x1 - r1 * s, cy + r1 * c];
  const bottom0 = [x0 - r0 * s, cy + r0 * c];
  // The larger cap's arc is more than a half circle when it is the larger one.
  const endLarge = r1 >= r0 ? 1 : 0;
  const startLarge = r1 >= r0 ? 0 : 1;
  return [
    `M${n(top0[0] ?? 0)} ${n(top0[1] ?? 0)}`,
    `L${n(top1[0] ?? 0)} ${n(top1[1] ?? 0)}`,
    `A${n(r1)} ${n(r1)} 0 ${endLarge} 1 ${n(bottom1[0] ?? 0)} ${n(bottom1[1] ?? 0)}`,
    `L${n(bottom0[0] ?? 0)} ${n(bottom0[1] ?? 0)}`,
    `A${n(r0)} ${n(r0)} 0 ${startLarge} 1 ${n(top0[0] ?? 0)} ${n(top0[1] ?? 0)}`,
    'Z',
  ].join(' ');
}

/**
 * How far (px) a bubble of `width` centred at `centre` must move along x to keep `margin`
 * px from both viewport edges. 0 when it fits; a bubble wider than the room is centred.
 */
export function bubbleShift(
  centre: number,
  width: number,
  viewportWidth: number,
  margin = 8,
): number {
  const left = centre - width / 2;
  const room = viewportWidth - 2 * margin;
  if (width >= room) return (viewportWidth - width) / 2 - left;
  if (left < margin) return margin - left;
  const right = left + width;
  if (right > viewportWidth - margin) return viewportWidth - margin - right;
  return 0;
}
