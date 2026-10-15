/**
 * Liquid shapes for glass (research 23 §5.2, GLS-3, GLS-4): several rounded rectangles fused
 * into one outline by a polynomial smooth minimum, traced by marching squares and handed to a
 * glass element as its `mask-image`, so one backdrop-filtered body takes the union's shape.
 * A mask, never `clip-path: path()`: the glass lab saw a path clip leave part of a filtered
 * backdrop unclipped (GLS-4).
 *
 * Pure geometry, no DOM beyond the returned CSS value, so any surface can fuse with it: the
 * split top's liquid menus (`liquid-menu.ts`, DSN-39) today, the bottom capsule's pieces merging
 * as one body later (DSN-37). Trace only while a shape moves: a few thousand field samples a
 * frame at the 2.5 px grid; at rest nothing is masked.
 *
 * Formulas restated, with credit (all MIT licence): the rounded-rect SDF and the polynomial
 * smooth minimum are Inigo Quilez's public formulas, as liquid-glass-studio (Charles Yin) and
 * Liquid DOM (Andras Prifer) use them; the springs' numbers follow Liquid DOM's showcase menu.
 * The lab's own copy is `lab/glass/sdf.ts` and `contour.ts` (the app shares no module with the
 * lab, GLS-1).
 */

/** A rounded rectangle by its box in one coordinate space, CSS px. */
export interface LiquidRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Corner radius, clamped to half the shorter side. */
  readonly radius: number;
}

/** The marching squares' grid, CSS px (research 23 §5.2). */
export const LIQUID_GRID = 2.5;

/** Signed distance from (px, py) to `rect`: negative inside, CSS px. */
export function sdRoundRect(px: number, py: number, rect: LiquidRect): number {
  const hw = rect.width / 2;
  const hh = rect.height / 2;
  const r = Math.max(0, Math.min(rect.radius, hw, hh));
  const qx = Math.abs(px - (rect.x + hw)) - hw + r;
  const qy = Math.abs(py - (rect.y + hh)) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Polynomial smooth minimum: the union of two fields with a fillet of `k` px where they meet, so
 * two shapes nearer than `k` grow a neck between them. `k` = 0 is the hard union.
 */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}

/** The smooth union's distance at (px, py). */
export function unionDistance(
  px: number,
  py: number,
  shapes: readonly LiquidRect[],
  k: number,
): number {
  let d = Number.POSITIVE_INFINITY;
  for (const shape of shapes) {
    const s = sdRoundRect(px, py, shape);
    d = d === Number.POSITIVE_INFINITY ? s : smin(d, s, k);
  }
  return d;
}

/**
 * The zero contour of `field` over the box (x0, y0, w, h) as an SVG path, in coordinates
 * relative to (x0, y0): marching squares on a `step` grid, with the saddle cells resolved by the
 * cell's centre so a neck stays joined while it is thin.
 */
export function contourPath(
  field: (x: number, y: number) => number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  step: number = LIQUID_GRID,
): string {
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;
  const v = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) v[j * cols + i] = field(x0 + i * step, y0 + j * step);
  }
  const at = (i: number, j: number) => v[j * cols + i] ?? 1;
  // Edge ids: the horizontal edge (i, j)–(i + 1, j) is even, the vertical (i, j)–(i, j + 1) odd.
  const hEdge = (i: number, j: number) => (j * cols + i) * 2;
  const vEdge = (i: number, j: number) => (j * cols + i) * 2 + 1;
  const point = (edge: number): readonly [number, number] => {
    const cell = edge >> 1;
    const i = cell % cols;
    const j = Math.floor(cell / cols);
    const a = at(i, j);
    if ((edge & 1) === 0) {
      const t = a / (a - at(i + 1, j));
      return [(i + t) * step, j * step];
    }
    const t = a / (a - at(i, j + 1));
    return [i * step, (j + t) * step];
  };
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const list = links.get(from);
      if (list) list.push(to);
      else links.set(from, [to]);
    }
  };
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const index =
        (at(i, j) < 0 ? 1 : 0) |
        (at(i + 1, j) < 0 ? 2 : 0) |
        (at(i + 1, j + 1) < 0 ? 4 : 0) |
        (at(i, j + 1) < 0 ? 8 : 0);
      if (index === 0 || index === 15) continue;
      const top = hEdge(i, j);
      const bottom = hEdge(i, j + 1);
      const left = vEdge(i, j);
      const right = vEdge(i + 1, j);
      switch (index) {
        case 1:
        case 14:
          link(left, top);
          break;
        case 2:
        case 13:
          link(top, right);
          break;
        case 3:
        case 12:
          link(left, right);
          break;
        case 4:
        case 11:
          link(right, bottom);
          break;
        case 6:
        case 9:
          link(top, bottom);
          break;
        case 7:
        case 8:
          link(left, bottom);
          break;
        default: {
          // 5 and 10, the saddles: joined when the cell's centre is inside.
          const centre = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4;
          if (centre < 0 === (index === 5)) {
            link(left, bottom);
            link(top, right);
          } else {
            link(left, top);
            link(right, bottom);
          }
        }
      }
    }
  }
  const seen = new Set<number>();
  const parts: string[] = [];
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const loop: number[] = [];
    let previous = -1;
    let current = start;
    while (!seen.has(current)) {
      seen.add(current);
      loop.push(current);
      const next = (links.get(current) ?? []).find((e) => e !== previous && !seen.has(e));
      if (next === undefined) break;
      previous = current;
      current = next;
    }
    if (loop.length < 3) continue;
    parts.push(
      loop
        .map((edge, n) => {
          const [x, y] = point(edge);
          return `${n === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join('') + 'Z',
    );
  }
  return parts.join('');
}

/**
 * The CSS `mask-image` that shapes an element whose box is `box` (same space as the shapes) to
 * the smooth union of `shapes` within the box; `'none'` when nothing of them is inside it. The
 * field is cut to the box and traced on a grid a little larger, so an outline that meets the
 * box's edge (a button in the menu's corner) still closes there.
 */
export function unionMask(
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  shapes: readonly LiquidRect[],
  k: number,
): string {
  const w = Math.max(1, Math.ceil(box.width));
  const h = Math.max(1, Math.ceil(box.height));
  const pad = 2 * LIQUID_GRID;
  const edge: LiquidRect = { x: box.x, y: box.y, width: w, height: h, radius: 0 };
  const field = (x: number, y: number) =>
    Math.max(unionDistance(x, y, shapes, k), sdRoundRect(x, y, edge));
  const d = contourPath(field, box.x - pad, box.y - pad, w + 2 * pad, h + 2 * pad);
  if (d === '') return 'none';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<path transform="translate(${-pad} ${-pad})" d="${d}" fill="#fff"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * A damped spring's progress from 0 to 1 after `t` s (unit mass, at rest at the start): Liquid
 * DOM's stiffness / damping pairs (`{ stiffness: 144, damping: 14 }` for a menu's centre).
 */
export function springProgress(stiffness: number, damping: number, t: number): number {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * w0 * t);
    return 1 - decay * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/** A CSS cubic Bézier easing as a function of progress 0–1 (solved by bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let n = 0; n < 24; n++) {
      const mid = (lo + hi) / 2;
      if (curve(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return curve(y1, y2, (lo + hi) / 2);
  };
}
