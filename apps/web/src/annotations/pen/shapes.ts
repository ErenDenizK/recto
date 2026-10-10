/**
 * Hold to shape (motion-2026-10/ink-shapes.md; research innovation-2026-10 notes-ink §2): the
 * recogniser that `ink-input.ts` runs once, when a stroke ends in a still hold. Pure geometry
 * on the stroke's points (CSS px at the stroke's starting zoom); never called per frame.
 *
 * 1. **Resample** the stroke to `RESAMPLE` points evenly spaced along its length and measure
 *    it: size, closure, turning, curvature reversals, self-crossings.
 * 2. **Gate** handwriting out before any fit (`handwriting`): a closed candidate needs one lap
 *    of turning in one direction, at most one significant reversal, no crossing outside the
 *    closure and a path no longer than `MAX_LENGTH_RATIO` times its box's perimeter.
 * 3. **Fit** each family: a line (least squares), an arrow (a line with a one-stroke head), a
 *    polygon (Ramer–Douglas–Peucker on the closed loop, corners merged, then regularised: a
 *    rectangle with right angles, a square when the sides are nearly equal, a regular
 *    triangle, pentagon or hexagon when sides and angles are) and an ellipse (Halir–Flusser's
 *    direct least-squares fit; a circle when the axes are nearly equal). The loop's radial
 *    profile settles hexagon against circle (`radialHarmonics`, `rippleCorners`): a clear
 *    3-, 5- or 6-fold ripple adds the regular polygon it shows and takes the circle's bias.
 * 4. **Score** each fit by its normalised residual against its family's limit (`LIMITS`);
 *    the fits are ranked best first. Only the first needs to pass the limit; the others, up
 *    to `ALTERNATIVE_SLACK` times it, are what the chip cycles to.
 *
 * Every fit keeps the drawn size and orientation; angles snap to 0°/45°/90° only within
 * `SNAP_DEG`. In a writing context (`strict`) the limits tighten and shapes must be larger.
 */
import type { Point } from '../ink';
import { rotate } from './shape-outline';

export { arrowHead, axisAligned, ELLIPSE_SEGMENTS, outline, scaleGeometry } from './shape-outline';

/** What a fit is called (the chip's label and the commit's annotation kind). */
export type ShapeKind =
  | 'line'
  | 'arrow'
  | 'triangle'
  | 'rectangle'
  | 'square'
  | 'pentagon'
  | 'hexagon'
  | 'polygon'
  | 'circle'
  | 'ellipse';

/** A fitted shape's geometry (CSS px). */
export type ShapeGeometry =
  | { readonly type: 'line'; readonly a: Point; readonly b: Point; readonly arrow: boolean }
  /** Closed: the last vertex joins the first. */
  | { readonly type: 'polygon'; readonly vertices: readonly Point[] }
  | {
      readonly type: 'ellipse';
      readonly cx: number;
      readonly cy: number;
      readonly rx: number;
      readonly ry: number;
      /** Rotation of the x axis, radians. */
      readonly angle: number;
    };

export interface ShapeFit {
  readonly kind: ShapeKind;
  readonly geometry: ShapeGeometry;
  /** RMS distance of the stroke from the shape over the shape's size. */
  readonly residual: number;
  /** 1 for a perfect fit, 0 at the family's limit (negative beyond, alternatives only). */
  readonly score: number;
}

export interface RecognizeOptions {
  /** A writing context (another stroke just before this one): stricter limits, larger sizes. */
  readonly strict?: boolean;
}

/** Points the stroke is resampled to. */
export const RESAMPLE = 128;
/** Smallest box diagonal of a shape (CSS px); `STRICT_SIZE` times it in a writing context. */
export const MIN_SHAPE_PX = 32;
/** Smallest line (CSS px). */
export const MIN_LINE_PX = 24;
/** Shapes larger than this (CSS px of box diagonal) are not recognised. */
export const MAX_SHAPE_PX = 4000;
export const STRICT_SIZE = 1.5;
/** Limits are multiplied by this in a writing context. */
export const STRICT_LIMIT = 0.6;
/** Normalised RMS residual each family may reach. */
export const LIMITS = {
  /** Over the chord. */
  line: 0.03,
  /** Over the shaft. */
  arrow: 0.045,
  /** Over the mean side of the polygon's box ((w + h) / 2). */
  polygon: 0.05,
  /** Over the mean radius. */
  ellipse: 0.055,
} as const;
/** The chip offers fits up to this many times their limit. */
export const ALTERNATIVE_SLACK = 1.8;
/** Angles snap to multiples of 45° within this (degrees). */
export const SNAP_DEG = 5;
/** A line's chord must be at least this share of its length. */
export const LINE_STRAIGHTNESS = 0.94;
/** A closed shape's ends lie within this share of its box diagonal (or it crosses back). */
export const CLOSE_GAP = 0.25;
/** An overshoot past the start may stray this share of the box diagonal from the shape. */
export const TAIL_PX = 0.1;
/** Path length over box perimeter above which a stroke is writing, not a shape. */
export const MAX_LENGTH_RATIO = 1.35;
/** Turning against the main direction beyond this counts as a reversal (radians, 25°). */
export const REVERSAL_RAD = (25 * Math.PI) / 180;
/** Share of all turning that may go against the main direction. */
export const MAX_COUNTER_TURN = 0.2;
/** Smallest ratio of a closed shape's short side (or axis) to its long one. */
export const MIN_ASPECT = 0.18;
/**
 * A square or a circle wins over the rectangle or ellipse it regularises by this much score
 * (when it is near enough to be one at all): what a hand draws nearly square is meant square.
 */
export const REGULAR_BIAS = 0.3;
/** Axes this close (minor over major) make a circle. */
export const ROUND = 0.86;
/** Share of a polygon's turning that must happen at its corners (sharp corners, not a curve). */
export const MIN_CORNER_SHARE = 0.62;

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Vectors
// ---------------------------------------------------------------------------

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
/** Angle in (−π, π]. */
const wrap = (a: number) => {
  let r = a % TAU;
  if (r <= -Math.PI) r += TAU;
  if (r > Math.PI) r -= TAU;
  return r;
};

/** Distance from `p` to the segment a–b. */
function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Whether segments p1–p2 and q1–q2 cross (proper intersection). */
function crosses(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const d = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(q1, q2, p1);
  const d2 = d(q1, q2, p2);
  const d3 = d(p1, p2, q1);
  const d4 = d(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** The change of angle `delta` (radians) needed to bring `angle` to a multiple of 45°, or 0. */
export function snapDelta(angle: number, tolerance = SNAP_DEG * DEG): number {
  const step = Math.PI / 4;
  const nearest = Math.round(angle / step) * step;
  const delta = nearest - angle;
  return Math.abs(delta) <= tolerance ? delta : 0;
}

// ---------------------------------------------------------------------------
// Measuring a stroke
// ---------------------------------------------------------------------------

/** The polyline's length. */
export function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++)
    length += dist(points[i - 1] as Point, points[i] as Point);
  return length;
}

/** `n` points evenly spaced along the polyline (`closed`: along the loop back to the start). */
export function resample(points: readonly Point[], n: number, closed = false): Point[] {
  const path = closed && points.length > 1 ? [...points, points[0] as Point] : [...points];
  const first = path[0];
  if (!first) return [];
  const total = pathLength(path);
  if (total === 0 || path.length < 2) return Array.from({ length: n }, () => ({ ...first }));
  const count = closed ? n : n - 1;
  const step = total / count;
  const out: Point[] = [{ ...first }];
  let i = 1;
  let walked = 0;
  let from = first;
  for (let k = 1; k < count; k++) {
    const target = k * step;
    for (;;) {
      const to = path[i] as Point;
      const seg = dist(from, to);
      if (walked + seg >= target || i === path.length - 1) {
        const t = seg === 0 ? 0 : Math.min(1, (target - walked) / seg);
        const p = lerp(from, to, t);
        out.push(p);
        walked = target;
        from = p;
        break;
      }
      walked += seg;
      from = to;
      i++;
    }
  }
  if (!closed) out.push({ ...(path[path.length - 1] as Point) });
  return out;
}

/** What the gates read from a resampled stroke. */
export interface StrokeFeatures {
  /** Length of the stroke (CSS px). */
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly diagonal: number;
  /** Distance between the ends over the diagonal. */
  readonly gap: number;
  /** Signed turning along the stroke (radians). */
  readonly turning: number;
  /** Absolute turning (radians). */
  readonly absTurning: number;
  /** Reversals of the turning direction beyond `REVERSAL_RAD`. */
  readonly reversals: number;
  /** Turning against the main direction over all turning. */
  readonly counterTurn: number;
  /** Length over the box's perimeter. */
  readonly lengthRatio: number;
}

/** The turning at each resampled point (radians), over a ±2-point window to calm jitter. */
function turns(points: readonly Point[]): number[] {
  const out: number[] = [];
  const k = 2;
  for (let i = k; i < points.length - k; i++) {
    const a = points[i - k] as Point;
    const b = points[i] as Point;
    const c = points[i + k] as Point;
    if (dist(a, b) === 0 || dist(b, c) === 0) {
      out.push(0);
      continue;
    }
    const t1 = Math.atan2(b.y - a.y, b.x - a.x);
    const t2 = Math.atan2(c.y - b.y, c.x - b.x);
    // Each step of the window counted once: the window turns k times per point.
    out.push(wrap(t2 - t1) / k);
  }
  return out;
}

function bounds(points: readonly Point[]) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Turning against the stroke's main direction over all its turning, read on the stroke
 * simplified by RDP at 2 % of its diagonal, so hand jitter on a straight side does not count.
 */
function counterTurn(points: readonly Point[], diagonal: number): number {
  const v = rdp(points, Math.max(1, 0.02 * diagonal)).map((i) => points[i] as Point);
  let sum = 0;
  let abs = 0;
  for (let i = 1; i < v.length - 1; i++) {
    const a = v[i - 1] as Point;
    const b = v[i] as Point;
    const c = v[i + 1] as Point;
    const t = wrap(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
    sum += t;
    abs += Math.abs(t);
  }
  return abs === 0 ? 0 : (abs - Math.abs(sum)) / 2 / abs;
}

/** The gates' measures of a resampled stroke. */
export function features(points: readonly Point[]): StrokeFeatures {
  const length = pathLength(points);
  const box = bounds(points);
  const diagonal = Math.hypot(box.width, box.height);
  const first = points[0] ?? { x: 0, y: 0 };
  const last = points[points.length - 1] ?? first;
  const t = turns(points);
  let turning = 0;
  let absTurning = 0;
  for (const v of t) {
    turning += v;
    absTurning += Math.abs(v);
  }
  // Reversals with hysteresis: the turning must run REVERSAL_RAD the other way to count.
  let reversals = 0;
  let direction = 0;
  let run = 0;
  for (const v of t) {
    const sign = Math.sign(v);
    if (sign === 0) continue;
    if (direction === 0) {
      run += v;
      if (Math.abs(run) >= REVERSAL_RAD) {
        direction = Math.sign(run);
        run = 0;
      }
      continue;
    }
    if (sign === direction) {
      run = 0;
    } else {
      run += v;
      if (Math.abs(run) >= REVERSAL_RAD) {
        reversals++;
        direction = sign;
        run = 0;
      }
    }
  }
  const perimeter = 2 * (box.width + box.height);
  return {
    length,
    width: box.width,
    height: box.height,
    diagonal,
    gap: diagonal === 0 ? 0 : dist(first, last) / diagonal,
    turning,
    absTurning,
    reversals,
    counterTurn: counterTurn(points, diagonal),
    lengthRatio: perimeter === 0 ? Number.POSITIVE_INFINITY : length / perimeter,
  };
}

/**
 * Crossings of the stroke with itself, outside the closure: a segment from the first
 * `zone` of the stroke crossing one from the last `zone` is the loop closing, not a loop.
 */
export function selfCrossings(points: readonly Point[], zone = 0.25): number {
  const n = points.length;
  let count = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      if (i < n * zone && j > n * (1 - zone)) continue;
      if (
        crosses(
          points[i] as Point,
          points[i + 1] as Point,
          points[j] as Point,
          points[j + 1] as Point,
        )
      ) {
        count++;
      }
    }
  }
  return count;
}

/**
 * The loop of a closed stroke: the stroke up to where it comes back nearest its start (after
 * 70 % of its length), so an overshoot past the start is not part of the shape. Undefined when
 * the stroke does not come back within `CLOSE_GAP` of its box diagonal.
 */
export function closedLoop(points: readonly Point[], diagonal: number): Point[] | undefined {
  const first = points[0];
  if (!first || diagonal === 0) return undefined;
  const from = Math.floor(points.length * 0.7);
  let best = points.length - 1;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = from; i < points.length; i++) {
    const d = dist(points[i] as Point, first);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  if (bestD > CLOSE_GAP * diagonal) return undefined;
  const loop = points.slice(0, best + 1);
  // An overshoot retraces the shape; a tail that leaves it ("o" joining the next letter) is
  // writing.
  for (let i = best + 1; i < points.length; i++) {
    const p = points[i] as Point;
    let near = Number.POSITIVE_INFINITY;
    for (let j = 1; j < loop.length; j++) {
      near = Math.min(near, segmentDistance(p, loop[j - 1] as Point, loop[j] as Point));
    }
    if (near > TAIL_PX * diagonal) return undefined;
  }
  return loop;
}

// ---------------------------------------------------------------------------
// Fits
// ---------------------------------------------------------------------------

interface Candidate {
  readonly kind: ShapeKind;
  readonly geometry: ShapeGeometry;
  readonly residual: number;
  /** The family's limit for this residual. */
  readonly limit: number;
  /** Subtracted from the score: fewer corners win a tie (Occam). */
  readonly penalty?: number;
}

function rms(values: readonly number[]): number {
  if (values.length === 0) return 0;
  let s = 0;
  for (const v of values) s += v * v;
  return Math.sqrt(s / values.length);
}

/** The least-squares line through the points: its centre and unit direction. */
function principalAxis(points: readonly Point[]) {
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= points.length;
  my /= points.length;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { c: { x: mx, y: my }, d: { x: Math.cos(angle), y: Math.sin(angle) } };
}

/** A straight line: the ends projected on the least-squares line, snapped about the start. */
export function fitLine(points: readonly Point[], f: StrokeFeatures): Candidate | undefined {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return undefined;
  const chord = dist(first, last);
  if (chord === 0 || chord / f.length < LINE_STRAIGHTNESS) return undefined;
  const { c, d } = principalAxis(points);
  const project = (p: Point): Point => {
    const t = (p.x - c.x) * d.x + (p.y - c.y) * d.y;
    return { x: c.x + d.x * t, y: c.y + d.y * t };
  };
  // The residual is read against the least-squares line; the line drawn runs from the press
  // to the pointer (where the pen is held), as hold to straighten always did.
  const residual =
    rms(points.map((p) => segmentDistance(p, project(first), project(last)))) / chord;
  const a = { ...first };
  let b = { ...last };
  const snap = snapDelta(Math.atan2(b.y - a.y, b.x - a.x));
  if (snap !== 0) b = rotate(b, a, snap);
  return {
    kind: 'line',
    geometry: { type: 'line', a, b, arrow: false },
    residual,
    limit: LIMITS.line,
  };
}

/** Ramer–Douglas–Peucker over an open polyline: the kept indices. */
export function rdp(points: readonly Point[], epsilon: number): number[] {
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop() as [number, number];
    let worst = -1;
    let worstD = epsilon;
    for (let i = s + 1; i < e; i++) {
      const d = segmentDistance(points[i] as Point, points[s] as Point, points[e] as Point);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([s, worst], [worst, e]);
    }
  }
  const out: number[] = [];
  keep.forEach((k, i) => {
    if (k) out.push(i);
  });
  return out;
}

/** The exterior turn at vertex `i` of a closed polygon (radians, signed). */
function cornerTurn(v: readonly Point[], i: number): number {
  const n = v.length;
  const a = v[(i - 1 + n) % n] as Point;
  const b = v[i] as Point;
  const c = v[(i + 1) % n] as Point;
  return wrap(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x));
}

/**
 * The corners of a closed loop: RDP from its start and from the point farthest from it, then
 * vertices turning less than 28° or closer than 9 % of the perimeter to a neighbour dropped,
 * the flattest first. Returns indices into `loop`.
 */
function corners(loop: readonly Point[], diagonal: number): number[] {
  const n = loop.length;
  const start = loop[0] as Point;
  let far = 0;
  for (let i = 1; i < n; i++)
    if (dist(loop[i] as Point, start) > dist(loop[far] as Point, start)) far = i;
  const epsilon = Math.max(2, 0.045 * diagonal);
  const firstHalf = rdp(loop.slice(0, far + 1), epsilon);
  const secondHalf = rdp([...loop.slice(far), start], epsilon).map((i) => i + far);
  let idx = [...firstHalf, ...secondHalf.slice(1, -1)];
  const perimeter = pathLength([...loop, start]);
  for (;;) {
    const v = idx.map((i) => loop[i] as Point);
    if (v.length <= 3) break;
    let weakest = -1;
    let weakestTurn = Number.POSITIVE_INFINITY;
    for (let k = 0; k < v.length; k++) {
      const turn = Math.abs(cornerTurn(v, k));
      const prev = v[(k - 1 + v.length) % v.length] as Point;
      const short = dist(prev, v[k] as Point) < 0.09 * perimeter;
      // A vertex on a short edge competes with its neighbour: the flatter one goes.
      const weight = turn < 28 * DEG ? turn : short ? turn + Math.PI : Number.POSITIVE_INFINITY;
      if (weight < weakestTurn) {
        weakestTurn = weight;
        weakest = k;
      }
    }
    if (weakest < 0 || !Number.isFinite(weakestTurn)) break;
    if (weakestTurn >= Math.PI) {
      // The short edge: drop the flatter of its two ends.
      const prev = (weakest - 1 + v.length) % v.length;
      const drop =
        Math.abs(cornerTurn(v, prev)) < Math.abs(cornerTurn(v, weakest)) ? prev : weakest;
      idx = idx.filter((_, k) => k !== drop);
    } else {
      idx = idx.filter((_, k) => k !== weakest);
    }
  }
  return idx;
}

/** The turning at each point of a closed loop (radians), as `turns` but wrapping around. */
export function loopTurns(loop: readonly Point[]): number[] {
  const n = loop.length;
  const k = 2;
  return loop.map((b, i) => {
    const a = loop[(i - k + n) % n] as Point;
    const c = loop[(i + k) % n] as Point;
    if (dist(a, b) === 0 || dist(b, c) === 0) return 0;
    return wrap(Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x)) / k;
  });
}

/** Share of the loop's turning within ±4 % of its length of a corner. */
function cornerShare(loop: readonly Point[], at: readonly number[]): number {
  const t = loopTurns(loop);
  const n = loop.length;
  const window = Math.max(2, Math.round(n * 0.04));
  let total = 0;
  let near = 0;
  t.forEach((v, i) => {
    total += Math.abs(v);
    if (at.some((c) => Math.min(Math.abs(c - i), n - Math.abs(c - i)) <= window))
      near += Math.abs(v);
  });
  return total === 0 ? 0 : near / total;
}

/** RMS distance of the points from the closed polygon. */
function polygonResidual(points: readonly Point[], v: readonly Point[]): number {
  return rms(
    points.map((p) => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < v.length; i++) {
        best = Math.min(best, segmentDistance(p, v[i] as Point, v[(i + 1) % v.length] as Point));
      }
      return best;
    }),
  );
}

/** The polygon rotated about its centroid so its most nearly level edge snaps (within 5°). */
function snapPolygon(v: readonly Point[]): Point[] {
  const c = centroid(v);
  let best = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i] as Point;
    const b = v[(i + 1) % v.length] as Point;
    const d = snapDelta(Math.atan2(b.y - a.y, b.x - a.x));
    if (d !== 0 && (best === 0 || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best === 0 ? [...v] : v.map((p) => rotate(p, c, best));
}

function centroid(v: readonly Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of v) {
    x += p.x;
    y += p.y;
  }
  return { x: x / v.length, y: y / v.length };
}

/** Interior angle at each vertex (radians). */
function interiorAngles(v: readonly Point[]): number[] {
  return v.map((_, i) => Math.PI - Math.abs(cornerTurn(v, i)));
}

/** The rectangle closest to a quadrilateral: orientation from its edges (mod 90°). */
function rectangleOf(v: readonly Point[]): { w: number; h: number; angle: number; c: Point } {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i] as Point;
    const b = v[(i + 1) % v.length] as Point;
    const theta = Math.atan2(b.y - a.y, b.x - a.x);
    const len = dist(a, b);
    sx += Math.cos(4 * theta) * len;
    sy += Math.sin(4 * theta) * len;
  }
  const angle = Math.atan2(sy, sx) / 4;
  const c = centroid(v);
  const local = v.map((p) => rotate(p, c, -angle));
  const xs = local.map((p) => p.x).sort((a, b) => a - b);
  const ys = local.map((p) => p.y).sort((a, b) => a - b);
  const left = ((xs[0] ?? 0) + (xs[1] ?? 0)) / 2;
  const right = ((xs[2] ?? 0) + (xs[3] ?? 0)) / 2;
  const top = ((ys[0] ?? 0) + (ys[1] ?? 0)) / 2;
  const bottom = ((ys[2] ?? 0) + (ys[3] ?? 0)) / 2;
  const mid = { x: (left + right) / 2, y: (top + bottom) / 2 };
  return {
    w: right - left,
    h: bottom - top,
    angle,
    c: rotate(mid, c, angle),
  };
}

function rectangleVertices(c: Point, w: number, h: number, angle: number): Point[] {
  return [
    { x: c.x - w / 2, y: c.y - h / 2 },
    { x: c.x + w / 2, y: c.y - h / 2 },
    { x: c.x + w / 2, y: c.y + h / 2 },
    { x: c.x - w / 2, y: c.y + h / 2 },
  ].map((p) => rotate(p, c, angle));
}

/** The regular n-gon nearest the polygon: same centroid, mean radius, mean phase. */
function regularOf(v: readonly Point[]): Point[] {
  const n = v.length;
  const c = centroid(v);
  const r = v.reduce((s, p) => s + dist(p, c), 0) / n;
  const dir = Math.sign(polygonArea(v)) || 1;
  let sx = 0;
  let sy = 0;
  v.forEach((p, i) => {
    const phase = Math.atan2(p.y - c.y, p.x - c.x) - (dir * TAU * i) / n;
    sx += Math.cos(phase);
    sy += Math.sin(phase);
  });
  const phase = Math.atan2(sy, sx);
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (dir * TAU * i) / n;
    out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return out;
}

/** Signed area (positive: clockwise on screen, y down). */
function polygonArea(v: readonly Point[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i] as Point;
    const b = v[(i + 1) % v.length] as Point;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Coefficient of variation of the polygon's sides. */
function sideSpread(v: readonly Point[]): number {
  const sides = v.map((p, i) => dist(p, v[(i + 1) % v.length] as Point));
  const mean = sides.reduce((s, x) => s + x, 0) / sides.length;
  return mean === 0 ? 1 : rms(sides.map((s) => s - mean)) / mean;
}

const POLYGON_NAMES: Partial<Record<number, ShapeKind>> = {
  3: 'triangle',
  5: 'pentagon',
  6: 'hexagon',
};

/** Polygon fits of a closed loop: regularised when it is close, else as drawn. */
export function fitPolygons(loop: readonly Point[], f: StrokeFeatures): Candidate[] {
  const idx = corners(loop, f.diagonal);
  const n = idx.length;
  if (n < 3 || n > 6) return [];
  const drawn = idx.map((i) => loop[i] as Point);
  if (cornerShare(loop, idx) < MIN_CORNER_SHARE) return [];
  const box = bounds(loop);
  const scale = (box.width + box.height) / 2;
  if (
    scale === 0 ||
    Math.min(box.width, box.height) / Math.max(box.width, box.height) < MIN_ASPECT
  ) {
    return [];
  }
  const out: Candidate[] = [];
  const penalty = (n - 3) * 0.04;
  // Residuals are read before the 45° snap: a snap within 5° costs no score.
  const generic: Candidate = {
    kind: POLYGON_NAMES[n] ?? 'polygon',
    geometry: { type: 'polygon', vertices: snapPolygon(drawn) },
    residual: polygonResidual(loop, drawn) / scale,
    limit: LIMITS.polygon,
    // Irregular polygons lose a tie against their regular forms.
    penalty: penalty + 0.05,
  };
  if (n === 4) {
    const angles = interiorAngles(drawn);
    if (angles.every((a) => Math.abs(a - Math.PI / 2) < 22 * DEG)) {
      const r = rectangleOf(drawn);
      const square = Math.abs(r.w - r.h) / Math.max(r.w, r.h) < 0.12;
      const snapped = r.angle + snapDelta(r.angle);
      if (square) {
        const s = (r.w + r.h) / 2;
        const vertices = rectangleVertices(r.c, s, s, r.angle);
        out.push({
          kind: 'square',
          geometry: { type: 'polygon', vertices: rectangleVertices(r.c, s, s, snapped) },
          residual: polygonResidual(loop, vertices) / scale,
          limit: LIMITS.polygon,
          penalty: -REGULAR_BIAS,
        });
      }
      const vertices = rectangleVertices(r.c, r.w, r.h, r.angle);
      out.push({
        kind: 'rectangle',
        geometry: { type: 'polygon', vertices: rectangleVertices(r.c, r.w, r.h, snapped) },
        residual: polygonResidual(loop, vertices) / scale,
        limit: LIMITS.polygon,
        penalty: square ? 0.01 : 0,
      });
    }
    out.push({ ...generic, kind: 'polygon' });
    return out;
  }
  const regularAngle = Math.PI - TAU / n;
  const angles = interiorAngles(drawn);
  if (sideSpread(drawn) < 0.2 && angles.every((a) => Math.abs(a - regularAngle) < 20 * DEG)) {
    const vertices = regularOf(drawn);
    out.push({
      kind: POLYGON_NAMES[n] ?? 'polygon',
      geometry: { type: 'polygon', vertices: snapPolygon(vertices) },
      residual: polygonResidual(loop, vertices) / scale,
      limit: LIMITS.polygon,
      penalty,
    });
  }
  out.push(generic);
  return out;
}

/** Highest harmonic `radialHarmonics` measures. */
const MAX_HARMONIC = 8;

/**
 * The radial profile of a closed loop about its centroid as harmonics: `amp[k]` is the
 * amplitude of the k-fold ripple of the radius over the mean radius, `phase[k]` its phase. An
 * n-gon, even with rounded corners, rings at k = n (its corners stand out n times a lap); a
 * circle drawn with a few flat spots rings far weaker, and at more than six.
 */
export function radialHarmonics(loop: readonly Point[]): {
  centre: Point;
  radius: number;
  amp: number[];
  phase: number[];
} {
  const centre = centroid(loop);
  const r = loop.map((p) => dist(p, centre));
  const radius = r.reduce((a, b) => a + b, 0) / (r.length || 1);
  const amp: number[] = [];
  const phase: number[] = [];
  for (let k = 0; k <= MAX_HARMONIC; k++) {
    let re = 0;
    let im = 0;
    loop.forEach((p, i) => {
      const t = Math.atan2(p.y - centre.y, p.x - centre.x);
      const d = (r[i] as number) / radius - 1;
      re += d * Math.cos(k * t);
      im += d * Math.sin(k * t);
    });
    amp.push((2 * Math.hypot(re, im)) / (loop.length || 1));
    phase.push(Math.atan2(im, re));
  }
  return { centre, radius, amp, phase };
}

/** A k-fold ripple counts as corners from this amplitude (share of the mean radius). */
export const CORNER_RIPPLE = 0.012;
/** ...and when it is this many times every other ripple (bar the ellipse's k = 2, its multiples). */
export const CORNER_RIPPLE_LEAD = 2;

/** The corner count the radial profile shows (3, 5 or 6), or 0. */
export function rippleCorners(h: { amp: readonly number[] }): number {
  for (const n of [6, 5, 3]) {
    const a = h.amp[n] ?? 0;
    if (a < CORNER_RIPPLE) continue;
    let rival = 0;
    for (let k = 3; k <= MAX_HARMONIC; k++) {
      if (k !== n && k % n !== 0) rival = Math.max(rival, h.amp[k] ?? 0);
    }
    if (a >= CORNER_RIPPLE_LEAD * rival) return n;
  }
  return 0;
}

/**
 * The regular n-gon the radial ripple shows: corners where the radius peaks, its apothem the
 * loop's mean radius towards the middles of the sides (so rounded corners do not shrink it).
 */
function rippleFit(
  loop: readonly Point[],
  n: number,
  h: ReturnType<typeof radialHarmonics>,
): Candidate {
  const corner = (h.phase[n] ?? 0) / n;
  const half = Math.PI / n;
  let sum = 0;
  let count = 0;
  for (const p of loop) {
    const t = Math.atan2(p.y - h.centre.y, p.x - h.centre.x);
    // Angle from the nearest side's middle.
    const off = wrap(n * (t - corner - half)) / n;
    if (Math.abs(off) < half / 3) {
      sum += dist(p, h.centre);
      count++;
    }
  }
  const apothem = count > 0 ? sum / count : h.radius * Math.cos(half);
  const R = apothem / Math.cos(half);
  const vertices: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = corner + (TAU * i) / n;
    vertices.push({ x: h.centre.x + R * Math.cos(a), y: h.centre.y + R * Math.sin(a) });
  }
  const box = bounds(loop);
  const scale = (box.width + box.height) / 2;
  return {
    kind: POLYGON_NAMES[n] ?? 'polygon',
    geometry: { type: 'polygon', vertices: snapPolygon(vertices) },
    residual: polygonResidual(loop, vertices) / scale,
    limit: LIMITS.polygon,
    penalty: (n - 3) * 0.04 - REGULAR_BIAS,
  };
}

/** Real roots of x³ + a x² + b x + c. */
function cubicRoots(a: number, b: number, c: number): number[] {
  const q = (a * a - 3 * b) / 9;
  const r = (2 * a * a * a - 9 * a * b + 27 * c) / 54;
  if (r * r < q * q * q) {
    const t = Math.acos(Math.max(-1, Math.min(1, r / Math.sqrt(q * q * q))));
    const m = -2 * Math.sqrt(q);
    return [
      m * Math.cos(t / 3) - a / 3,
      m * Math.cos((t + TAU) / 3) - a / 3,
      m * Math.cos((t - TAU) / 3) - a / 3,
    ];
  }
  const A = -Math.sign(r) * Math.cbrt(Math.abs(r) + Math.sqrt(r * r - q * q * q));
  const B = A === 0 ? 0 : q / A;
  return [A + B - a / 3];
}

type M3 = [number, number, number, number, number, number, number, number, number];

function inv3(m: M3): M3 | undefined {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return undefined;
  return [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
}

const mul3 = (x: M3, y: M3): M3 => {
  const o = new Array<number>(9).fill(0) as M3;
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      for (let k = 0; k < 3; k++)
        o[r * 3 + c] = (o[r * 3 + c] ?? 0) + (x[r * 3 + k] as number) * (y[k * 3 + c] as number);
  return o;
};

interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly angle: number;
}

/**
 * Halir & Flusser's numerically stable direct least-squares ellipse fit (1998), on points
 * centred and scaled to unit RMS radius. Undefined when the conic is not an ellipse.
 */
export function fitEllipseLsq(points: readonly Point[]): Ellipse | undefined {
  const n = points.length;
  if (n < 6) return undefined;
  const c0 = centroid(points);
  const s =
    Math.sqrt(points.reduce((acc, p) => acc + (p.x - c0.x) ** 2 + (p.y - c0.y) ** 2, 0) / n) || 1;
  const S1 = new Array<number>(9).fill(0) as M3;
  const S2 = new Array<number>(9).fill(0) as M3;
  const S3 = new Array<number>(9).fill(0) as M3;
  for (const p of points) {
    const x = (p.x - c0.x) / s;
    const y = (p.y - c0.y) / s;
    const d1 = [x * x, x * y, y * y];
    const d2 = [x, y, 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const i = r * 3 + c;
        S1[i] = (S1[i] ?? 0) + (d1[r] as number) * (d1[c] as number);
        S2[i] = (S2[i] ?? 0) + (d1[r] as number) * (d2[c] as number);
        S3[i] = (S3[i] ?? 0) + (d2[r] as number) * (d2[c] as number);
      }
    }
  }
  const S3i = inv3(S3);
  if (!S3i) return undefined;
  const S2t: M3 = [S2[0], S2[3], S2[6], S2[1], S2[4], S2[7], S2[2], S2[5], S2[8]];
  const T = mul3(S3i, S2t).map((v) => -v) as M3;
  const M = S1.map((v, i) => v + (mul3(S2, T)[i] as number)) as M3;
  // C1⁻¹ · M with C1 = [[0, 0, 2], [0, −1, 0], [2, 0, 0]].
  const K: M3 = [M[6] / 2, M[7] / 2, M[8] / 2, -M[3], -M[4], -M[5], M[0] / 2, M[1] / 2, M[2] / 2];
  const trace = K[0] + K[4] + K[8];
  const minors = K[0] * K[4] - K[1] * K[3] + K[0] * K[8] - K[2] * K[6] + K[4] * K[8] - K[5] * K[7];
  const det =
    K[0] * (K[4] * K[8] - K[5] * K[7]) -
    K[1] * (K[3] * K[8] - K[5] * K[6]) +
    K[2] * (K[3] * K[7] - K[4] * K[6]);
  for (const lambda of cubicRoots(-trace, minors, -det)) {
    const r0 = [K[0] - lambda, K[1], K[2]];
    const r1 = [K[3], K[4] - lambda, K[5]];
    const r2 = [K[6], K[7], K[8] - lambda];
    const cross = (u: number[], v: number[]) => [
      (u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number),
      (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number),
      (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number),
    ];
    const candidates = [cross(r0, r1), cross(r0, r2), cross(r1, r2)];
    const v = candidates.reduce((best, x) => (Math.hypot(...x) > Math.hypot(...best) ? x : best));
    const [A, B, C] = v as [number, number, number];
    if (4 * A * C - B * B <= 0) continue;
    const D = T[0] * A + T[1] * B + T[2] * C;
    const E = T[3] * A + T[4] * B + T[5] * C;
    const F = T[6] * A + T[7] * B + T[8] * C;
    const den = B * B - 4 * A * C;
    const cx = (2 * C * D - B * E) / den;
    const cy = (2 * A * E - B * D) / den;
    const f0 = A * cx * cx + B * cx * cy + C * cy * cy + D * cx + E * cy + F;
    const angle = 0.5 * Math.atan2(B, A - C);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const l1 = A * cos * cos + B * cos * sin + C * sin * sin;
    const l2 = A * sin * sin - B * sin * cos + C * cos * cos;
    const rx2 = -f0 / l1;
    const ry2 = -f0 / l2;
    if (!(rx2 > 0) || !(ry2 > 0)) continue;
    return {
      cx: c0.x + cx * s,
      cy: c0.y + cy * s,
      rx: Math.sqrt(rx2) * s,
      ry: Math.sqrt(ry2) * s,
      angle,
    };
  }
  return undefined;
}

/** Radial distance of `p` from the ellipse. */
function ellipseDistance(p: Point, e: Ellipse): number {
  const local = rotate(p, { x: e.cx, y: e.cy }, -e.angle);
  const dx = local.x - e.cx;
  const dy = local.y - e.cy;
  const r = Math.hypot(dx, dy);
  if (r === 0) return Math.min(e.rx, e.ry);
  const cos = dx / r;
  const sin = dy / r;
  const re = (e.rx * e.ry) / Math.hypot(e.ry * cos, e.rx * sin);
  return Math.abs(r - re);
}

/** Ellipse (or circle) fits of a closed loop. */
export function fitEllipses(loop: readonly Point[]): Candidate[] {
  const e = fitEllipseLsq(loop);
  if (!e) return [];
  const major = Math.max(e.rx, e.ry);
  const minor = Math.min(e.rx, e.ry);
  if (minor / major < MIN_ASPECT) return [];
  const mean = Math.sqrt(e.rx * e.ry);
  // Normalise: rx the longer axis, the angle in (−90°, 90°], snapped within 5°.
  let angle = e.rx >= e.ry ? e.angle : e.angle + Math.PI / 2;
  angle = wrap(angle);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle <= -Math.PI / 2) angle += Math.PI;
  const ellipse: Ellipse = { cx: e.cx, cy: e.cy, rx: major, ry: minor, angle };
  const out: Candidate[] = [];
  // Read before the snap: a snap within 5° costs no score.
  const residual = rms(loop.map((p) => ellipseDistance(p, ellipse))) / mean;
  const round = minor / major > ROUND;
  if (round) {
    const r = (major + minor) / 2;
    const circle: Ellipse = { cx: e.cx, cy: e.cy, rx: r, ry: r, angle: 0 };
    out.push({
      kind: 'circle',
      geometry: { type: 'ellipse', ...circle },
      residual: rms(loop.map((p) => ellipseDistance(p, circle))) / r,
      limit: LIMITS.ellipse,
      penalty: -REGULAR_BIAS,
    });
  }
  out.push({
    kind: 'ellipse',
    geometry: { type: 'ellipse', ...ellipse, angle: angle + snapDelta(angle) },
    residual,
    limit: LIMITS.ellipse,
    penalty: round ? 0.01 : 0,
  });
  return out;
}

/**
 * An arrow drawn in one stroke: the shaft A→B, one barb B→C, back to the tip and the other
 * barb B→D (simplified by RDP to five vertices with the tip twice).
 */
export function fitArrow(points: readonly Point[], f: StrokeFeatures): Candidate | undefined {
  const idx = rdp(points, Math.max(2, 0.05 * f.diagonal));
  if (idx.length !== 5) return undefined;
  const [A, B, C, B2, D] = idx.map((i) => points[i] as Point) as [
    Point,
    Point,
    Point,
    Point,
    Point,
  ];
  const shaft = dist(A, B);
  if (shaft < MIN_LINE_PX || dist(B, B2) > 0.15 * shaft) return undefined;
  const tip = lerp(B, B2, 0.5);
  const barb = (p: Point) => {
    const len = dist(tip, p);
    if (len < 0.08 * shaft || len > 0.6 * shaft) return undefined;
    // The barb's angle off the shaft, seen from the tip back towards the tail.
    return wrap(Math.atan2(p.y - tip.y, p.x - tip.x) - Math.atan2(A.y - tip.y, A.x - tip.x));
  };
  const b1 = barb(C);
  const b2 = barb(D);
  if (b1 === undefined || b2 === undefined) return undefined;
  const ok = (a: number) => Math.abs(a) > 12 * DEG && Math.abs(a) < 70 * DEG;
  if (!ok(b1) || !ok(b2) || Math.sign(b1) === Math.sign(b2)) return undefined;
  // The shaft itself must be straight.
  const shaftPoints = points.slice(0, (idx[1] as number) + 1);
  const straightness = rms(shaftPoints.map((p) => segmentDistance(p, A, tip))) / shaft;
  const head =
    rms(
      points
        .slice(idx[1])
        .map((p) => Math.min(segmentDistance(p, tip, C), segmentDistance(p, tip, D))),
    ) / shaft;
  let end = tip;
  const snap = snapDelta(Math.atan2(tip.y - A.y, tip.x - A.x));
  if (snap !== 0) end = rotate(tip, A, snap);
  return {
    kind: 'arrow',
    geometry: { type: 'line', a: A, b: end, arrow: true },
    residual: Math.hypot(straightness, head),
    limit: LIMITS.arrow,
  };
}

// ---------------------------------------------------------------------------
// The recogniser
// ---------------------------------------------------------------------------

/** Why a stroke was not a shape (tests and the corpus report). */
export type Rejection = 'short' | 'large' | 'writing' | 'no-fit';

export interface Recognition {
  /** Ranked best first; empty when nothing fits. */
  readonly fits: readonly ShapeFit[];
  readonly rejected?: Rejection;
  readonly features?: StrokeFeatures;
}

/**
 * Whether a closed stroke reads as writing: more than one curvature reversal (none in a
 * writing context), much turning against its main direction, a crossing outside the closure
 * (a small loop, as in "e" or "l"), or a path much longer than its box (scribbles, words).
 */
export function handwriting(points: readonly Point[], f: StrokeFeatures, strict: boolean): boolean {
  if (f.reversals > (strict ? 0 : 1)) return true;
  if (f.counterTurn > MAX_COUNTER_TURN * (strict ? 0.6 : 1)) return true;
  if (f.lengthRatio > MAX_LENGTH_RATIO) return true;
  return selfCrossings(points) > 0;
}

/** The ranked fits of a stroke (see the module comment). */
export function recognizeShape(raw: readonly Point[], options: RecognizeOptions = {}): Recognition {
  const strict = options.strict === true;
  const tighten = strict ? STRICT_LIMIT : 1;
  const points = resample(dedupe(raw), RESAMPLE);
  if (points.length < 8) return { fits: [], rejected: 'short' };
  const f = features(points);
  const size = strict ? STRICT_SIZE : 1;
  if (f.diagonal > MAX_SHAPE_PX) return { fits: [], rejected: 'large', features: f };
  const candidates: Candidate[] = [];
  if (f.diagonal >= MIN_LINE_PX * size) {
    const line = fitLine(points, f);
    if (line) candidates.push(line);
    const arrow = fitArrow(points, f);
    if (arrow) candidates.push(arrow);
  }
  const loop = f.diagonal >= MIN_SHAPE_PX * size ? closedLoop(points, f.diagonal) : undefined;
  const writing = loop !== undefined && handwriting(points, f, strict);
  if (loop && !writing) {
    const lf = resample(loop, RESAMPLE, true);
    const lap = Math.abs(loopTurns(lf).reduce((s, v) => s + v, 0));
    // One lap, in one direction (a figure of eight turns ~0°, a spiral two laps).
    if (lap > 1.55 * Math.PI && lap < 2.5 * Math.PI) {
      // Over the drawn points only: the chord across a gap at the close is no corner.
      const ripple = radialHarmonics(resample(loop, RESAMPLE));
      const n = rippleCorners(ripple);
      const ellipses = fitEllipses(lf);
      // Corners in the radial profile: the regular polygon they show competes, and a circle
      // loses its bias (a hexagon drawn round is still a hexagon).
      candidates.push(
        ...fitPolygons(lf, f),
        ...(n > 0
          ? [
              rippleFit(lf, n, ripple),
              ...ellipses.map((c) => (c.kind === 'circle' ? { ...c, penalty: 0 } : c)),
            ]
          : ellipses),
      );
    }
  }
  if (candidates.length === 0) {
    return { fits: [], rejected: writing ? 'writing' : 'no-fit', features: f };
  }
  // Each fit's quality is its residual over its limit; the penalties (Occam, the bias to
  // squares and circles) only rank, they never let a fit pass its limit.
  const scored = candidates
    .map((c) => {
      const fit = c.residual / (c.limit * tighten);
      return { c, fit, q: fit + (c.penalty ?? 0) };
    })
    .sort((a, b) => a.q - b.q);
  const best = scored.find((x) => x.fit <= 1);
  if (!best) return { fits: [], rejected: 'no-fit', features: f };
  const fits: ShapeFit[] = [];
  const seen = new Set<ShapeKind>();
  for (const { c, fit, q } of [best, ...scored.filter((x) => x !== best)]) {
    if (fit > ALTERNATIVE_SLACK || seen.has(c.kind)) continue;
    seen.add(c.kind);
    fits.push({ kind: c.kind, geometry: c.geometry, residual: c.residual, score: 1 - q });
  }
  return { fits, features: f };
}

function dedupe(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last?.x !== p.x || last.y !== p.y) out.push({ x: p.x, y: p.y });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drawing a fit
// ---------------------------------------------------------------------------

/** The geometry's centre (what a hold-drag scales and rotates about). */
export function centreOf(g: ShapeGeometry): Point {
  switch (g.type) {
    case 'line':
      return g.a;
    case 'polygon':
      return centroid(g.vertices);
    case 'ellipse':
      return { x: g.cx, y: g.cy };
  }
}

/**
 * The geometry scaled by `scale` and rotated by `angle` about `centre`. A line keeps its start
 * and puts its end at `end` instead (it follows the pointer), snapped within 5°.
 */
export function transformShape(
  g: ShapeGeometry,
  centre: Point,
  scale: number,
  angle: number,
  end?: Point,
): ShapeGeometry {
  const move = (p: Point) => {
    const r = rotate(p, centre, angle);
    return { x: centre.x + (r.x - centre.x) * scale, y: centre.y + (r.y - centre.y) * scale };
  };
  switch (g.type) {
    case 'line': {
      if (!end) return g;
      const snap = snapDelta(Math.atan2(end.y - g.a.y, end.x - g.a.x));
      return { ...g, b: snap === 0 ? end : rotate(end, g.a, snap) };
    }
    case 'polygon': {
      const moved = g.vertices.map(move);
      return { type: 'polygon', vertices: angle === 0 ? moved : snapPolygon(moved) };
    }
    case 'ellipse': {
      const c = move({ x: g.cx, y: g.cy });
      let a = g.angle + angle;
      a += snapDelta(a);
      return { ...g, cx: c.x, cy: c.y, rx: g.rx * scale, ry: g.ry * scale, angle: a };
    }
  }
}
