/**
 * The page quad (plan bm-scan-plan §2 "Edge detection", steps 4 and 5 without the Hough branch):
 * each contour hull is simplified with Douglas-Peucker, reduced to four corners by dropping the
 * edge that adds the least area (its neighbours are extended to meet), and scored on area, fit to
 * the hull, corner angles and edge support. The best-scoring quad wins.
 */
import { at, convexHull, type Pt } from './contour';

export interface PageQuad {
  /** Corners in pixels, ordered top-left, top-right, bottom-right, bottom-left. */
  readonly corners: readonly [Pt, Pt, Pt, Pt];
  /** 0..1: how page-like the quad is. */
  readonly confidence: number;
}

/** A quad smaller than this share of the frame is not a page. */
const MIN_AREA_SHARE = 0.08;
/** The quad counts as full-confidence area from this share of the frame. */
const FULL_AREA_SHARE = 0.25;
/** Interior angles outside this range (degrees) are not a photographed rectangle. */
const MIN_ANGLE = 45;
const MAX_ANGLE = 135;

export function polygonArea(p: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = at(p, (i + 1) % p.length);
    a += at(p, i).x * q.y - q.x * at(p, i).y;
  }
  return Math.abs(a) / 2;
}

function distToLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dx * (a.y - p.y) - (a.x - p.x) * dy) / len;
}

function douglasPeucker(chain: readonly Pt[], eps: number): Pt[] {
  if (chain.length < 3) return [...chain];
  const first = at(chain, 0);
  const last = at(chain, chain.length - 1);
  let worst = 0;
  let split = 0;
  for (let i = 1; i < chain.length - 1; i++) {
    const d = distToLine(at(chain, i), first, last);
    if (d > worst) {
      worst = d;
      split = i;
    }
  }
  if (worst <= eps) return [first, last];
  const left = douglasPeucker(chain.slice(0, split + 1), eps);
  return [...left.slice(0, -1), ...douglasPeucker(chain.slice(split), eps)];
}

function lineIntersection(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}

/** A closed convex polygon reduced to four corners, or null when it has fewer than four. */
export function reduceToQuad(hull: readonly Pt[], diagonal: number): Pt[] | null {
  if (hull.length < 4) return null;
  // Split the ring at the vertex farthest from vertex 0, simplify both halves, rejoin.
  let far = 1;
  let best = 0;
  for (let i = 1; i < hull.length; i++) {
    const d = Math.hypot(at(hull, i).x - at(hull, 0).x, at(hull, i).y - at(hull, 0).y);
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const eps = diagonal * 0.01;
  let ring = [
    ...douglasPeucker(hull.slice(0, far + 1), eps).slice(0, -1),
    ...douglasPeucker([...hull.slice(far), at(hull, 0)], eps).slice(0, -1),
  ];
  while (ring.length > 4) {
    let pick = -1;
    let cheapest = Infinity;
    let point: Pt | null = null;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      // Drop edge i → i+1 by meeting the edges either side of it.
      const p0 = at(ring, (i + n - 1) % n);
      const p1 = at(ring, i);
      const p2 = at(ring, (i + 1) % n);
      const p3 = at(ring, (i + 2) % n);
      const m = lineIntersection(p0, p1, p2, p3);
      if (!m) continue;
      const cost = polygonArea([p1, m, p2]);
      if (cost < cheapest) {
        cheapest = cost;
        pick = i;
        point = m;
      }
    }
    if (pick < 0 || !point) return null;
    const next = (pick + 1) % n;
    ring = ring.filter((_, i) => i !== pick && i !== next);
    ring.splice(Math.min(pick, ring.length), 0, point);
  }
  return ring.length === 4 ? ring : null;
}

/** Corners as top-left, top-right, bottom-right, bottom-left (clockwise on screen). */
export function orderCorners(p: readonly Pt[]): [Pt, Pt, Pt, Pt] {
  const cx = p.reduce((s, q) => s + q.x, 0) / p.length;
  const cy = p.reduce((s, q) => s + q.y, 0) / p.length;
  const ring = [...p].sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
  );
  let tl = 0;
  for (let i = 1; i < ring.length; i++) {
    if (at(ring, i).x + at(ring, i).y < at(ring, tl).x + at(ring, tl).y) tl = i;
  }
  return [0, 1, 2, 3].map((k) => at(ring, (tl + k) % 4)) as [Pt, Pt, Pt, Pt];
}

function minMaxAngle(q: readonly Pt[]): [number, number] {
  let lo = 180;
  let hi = 0;
  for (let i = 0; i < 4; i++) {
    const a = at(q, (i + 3) % 4);
    const b = at(q, i);
    const c = at(q, (i + 1) % 4);
    const v1 = { x: a.x - b.x, y: a.y - b.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const ang =
      (Math.acos(
        (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1),
      ) *
        180) /
      Math.PI;
    lo = Math.min(lo, ang);
    hi = Math.max(hi, ang);
  }
  return [lo, hi];
}

/** Share of points along the quad's sides with an edge pixel (or the frame border) within 2 px. */
function edgeSupport(q: readonly Pt[], edges: Uint8Array, width: number, height: number): number {
  const R = 2;
  let hit = 0;
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const a = at(q, i);
    const b = at(q, (i + 1) % 4);
    const steps = Math.max(8, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(a.x + ((b.x - a.x) * s) / steps);
      const y = Math.round(a.y + ((b.y - a.y) * s) / steps);
      total++;
      if (x <= R || y <= R || x >= width - 1 - R || y >= height - 1 - R) {
        hit++;
        continue;
      }
      search: for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (edges[(y + dy) * width + x + dx]) {
            hit++;
            break search;
          }
        }
      }
    }
  }
  return hit / total;
}

/**
 * The best page quad among the edge components, or null when none looks like a page. The
 * candidates are each component alone and the union of the large ones: an outline Canny broke into
 * its four sides (or cut by ruled lines) only closes as a union.
 */
export function fitPageQuad(
  components: readonly (readonly Pt[])[],
  edges: Uint8Array,
  width: number,
  height: number,
): PageQuad | null {
  const diagonal = Math.hypot(width, height);
  const biggest = components[0]?.length ?? 0;
  const large = components.filter((c) => c.length * 4 >= biggest);
  const candidates = large.length > 1 ? [...components, large.flat()] : components;
  let best: PageQuad | null = null;
  for (const points of candidates) {
    const hull = convexHull(points);
    const ring = reduceToQuad(hull, diagonal);
    if (!ring) continue;
    const corners = orderCorners(ring);
    const area = polygonArea(corners);
    const share = area / (width * height);
    if (share < MIN_AREA_SHARE) continue;
    const [lo, hi] = minMaxAngle(corners);
    if (lo < MIN_ANGLE || hi > MAX_ANGLE) continue;
    const fit = Math.min(1, polygonArea(hull) / area);
    const support = edgeSupport(corners, edges, width, height);
    const confidence = support ** 3 * fit * (0.5 + 0.5 * Math.min(1, share / FULL_AREA_SHARE));
    if (!best || confidence > best.confidence) best = { corners, confidence };
  }
  return best;
}
