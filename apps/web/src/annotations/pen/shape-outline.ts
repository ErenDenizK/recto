/**
 * Drawing a shape fit (motion-2026-10/ink-shapes.md §4; `shapes.ts` recognises them): its
 * outline, an arrow's barbs, and the geometry helpers the commit needs. Apart from `shapes.ts`
 * because the commit (`shape-commit.ts`) is part of the editor's first load while the
 * recogniser loads with the pen (`shape-kit.ts`, PLAN.md §2.3 V1-P2).
 */
import type { Point } from '../ink';
import type { ShapeGeometry } from './shapes';

const TAU = 2 * Math.PI;

/** `p` turned by `angle` (radians) about `c`. */
export function rotate(p: Point, c: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

// ---------------------------------------------------------------------------
// Drawing a fit
// ---------------------------------------------------------------------------

/** Segments of an ellipse's outline. */
export const ELLIPSE_SEGMENTS = 72;

/**
 * The outline of a geometry as a polyline (closed shapes repeat their first point at the
 * end). An arrow is its shaft, then the head as one stroke: barb, tip, barb.
 */
export function outline(g: ShapeGeometry, width = 2): Point[] {
  switch (g.type) {
    case 'line': {
      if (!g.arrow) return [g.a, g.b];
      const head = arrowHead(g.a, g.b, width);
      return [g.a, g.b, head[0], g.b, head[1]];
    }
    case 'polygon':
      return [...g.vertices, g.vertices[0] as Point];
    case 'ellipse': {
      const out: Point[] = [];
      for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
        const t = (TAU * i) / ELLIPSE_SEGMENTS;
        out.push(
          rotate(
            { x: g.cx + g.rx * Math.cos(t), y: g.cy + g.ry * Math.sin(t) },
            { x: g.cx, y: g.cy },
            g.angle,
          ),
        );
      }
      return out;
    }
  }
}

/** The barbs of an open arrow at `b` (as PDF viewers draw /OpenArrow: 30°, 9 × width, ≥ 8 px). */
export function arrowHead(a: Point, b: Point, width: number): [Point, Point] {
  const len = Math.max(8, 9 * width);
  const back = Math.atan2(a.y - b.y, a.x - b.x);
  const at = (t: number) => ({ x: b.x + len * Math.cos(t), y: b.y + len * Math.sin(t) });
  return [at(back + Math.PI / 6), at(back - Math.PI / 6)];
}

/** Whether a polygon is an axis-aligned rectangle (a /Square annotation can carry it). */
export function axisAligned(vertices: readonly Point[], tolerance = 1e-3): boolean {
  if (vertices.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = vertices[i] as Point;
    const b = vertices[(i + 1) % 4] as Point;
    if (Math.abs(a.x - b.x) > tolerance && Math.abs(a.y - b.y) > tolerance) return false;
  }
  return true;
}

/** The geometry scaled by `k` about the origin (a zoom change). */
export function scaleGeometry(g: ShapeGeometry, k: number): ShapeGeometry {
  if (k === 1) return g;
  const at = (p: Point): Point => ({ x: p.x * k, y: p.y * k });
  switch (g.type) {
    case 'line':
      return { ...g, a: at(g.a), b: at(g.b) };
    case 'polygon':
      return { type: 'polygon', vertices: g.vertices.map(at) };
    case 'ellipse':
      return { ...g, cx: g.cx * k, cy: g.cy * k, rx: g.rx * k, ry: g.ry * k };
  }
}
