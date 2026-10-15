/**
 * Glass lab maths (docs/research/23-liquid-glass-lab.md §2): the signed distance of a rounded
 * rectangle, a smooth union, the bezel's height profile and the Snell bend that turns its slope
 * into a backdrop displacement. The same formulas run in three places: the T1 displacement map
 * (`t1-lens.ts`, per pixel on the CPU), the T2 shader (`t2-gl.ts`, GLSL) and the T0/T1 morph
 * outline (`contour.ts`).
 *
 * Techniques adapted, with credit (all MIT licence):
 * - the rounded-rect SDF and the polynomial smooth minimum are Inigo Quilez's public formulas,
 *   as used by liquid-glass-studio (Charles Yin, MIT) and Liquid DOM (Andras Prifer, MIT);
 * - the convex-squircle bezel profile h(x) = sqrt(1 − (1 − x)^4) and the refraction of a
 *   straight-down ray through the profile's normal follow Liquid DOM's `shaders.ts` (MIT).
 */

export interface Rect {
  /** Centre, CSS px. */
  readonly cx: number;
  readonly cy: number;
  /** Half width and half height, CSS px. */
  readonly hw: number;
  readonly hh: number;
  /** Corner radius, CSS px (clamped to the shorter half side). */
  readonly r: number;
}

/** Signed distance from (x, y) to a rounded rectangle: negative inside, CSS px. */
export function sdRoundRect(x: number, y: number, rect: Rect): number {
  const r = Math.min(rect.r, rect.hw, rect.hh);
  const qx = Math.abs(x - rect.cx) - rect.hw + r;
  const qy = Math.abs(y - rect.cy) - rect.hh + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Polynomial smooth minimum: the union of two fields with a fillet of size `k` where they
 * meet, so two shapes closer than `k` grow a bridge (the "gooey" merge). k = 0 is a hard union.
 */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

/** A field made of rectangles: each group is smooth-unioned inside, groups are hard-unioned. */
export interface Shape extends Rect {
  readonly group: number;
}

export function sceneDistance(x: number, y: number, shapes: readonly Shape[], k: number): number {
  let total = Number.POSITIVE_INFINITY;
  let group = Number.NaN;
  let inGroup = Number.POSITIVE_INFINITY;
  for (const shape of shapes) {
    const d = sdRoundRect(x, y, shape);
    if (shape.group === group) {
      inGroup = smin(inGroup, d, k);
    } else {
      total = Math.min(total, inGroup);
      group = shape.group;
      inGroup = d;
    }
  }
  return Math.min(total, inGroup);
}

/**
 * The bezel's slope at `inward` px from the edge (Liquid DOM's convex squircle): the surface
 * rises as h(x) = sqrt(1 − (1 − x)^4) over the bezel width, so it is steep at the rim and flat
 * inside. Returns dh/dx, which is also the slope in px per px because h is scaled by the width.
 */
export function bezelSlope(inward: number, bezel: number): number {
  if (bezel <= 0 || inward >= bezel) return 0;
  const x = Math.max(0, inward / bezel);
  const u = 1 - x;
  const inside = Math.max(1 - u ** 4, 1e-4);
  // tan(85°): a vertical wall would send the ray to infinity.
  return Math.min((2 * u ** 3) / Math.sqrt(inside), 11.43);
}

/**
 * How far the backdrop is displaced under a surface of the given slope, CSS px, along the
 * inward normal: a ray straight down refracts through the tilted surface (Snell, n = ior) and
 * travels `depth` px through the glass before it meets the backdrop. A positive value samples
 * from further inside the shape, so the rim magnifies what lies under the middle, as a convex
 * lens does.
 */
export function snellPull(slope: number, ior: number, depth: number): number {
  if (slope === 0 || ior <= 1) return 0;
  // The normal of z = h(d) tilted by `slope`: (slope, 0, 1) normalised, incident (0, 0, −1).
  const len = Math.hypot(slope, 1);
  const nx = slope / len;
  const nz = 1 / len;
  const eta = 1 / ior;
  const cosI = nz; // −dot(N, I)
  const k = 1 - eta * eta * (1 - cosI * cosI);
  if (k < 0) return 0;
  const a = eta * cosI - Math.sqrt(k); // R = eta·I + a·N
  const rx = a * nx;
  const rz = -eta + a * nz;
  return (-rx / -rz) * depth;
}
