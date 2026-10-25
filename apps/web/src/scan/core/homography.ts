/**
 * Homography between two quads (plan bm-scan-plan §2 "Perspective warp": solved on the CPU, an
 * 8×8 elimination). Matrices are 9 numbers, row-major, with h[8] = 1 on a solved one.
 */
import type { Pt } from './contour';

export type Matrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

/** The homography that maps each `src[i]` onto `dst[i]`; null when the points are degenerate. */
export function solveHomography(src: readonly Pt[], dst: readonly Pt[]): Matrix3 | null {
  // The 8 × 9 augmented system, row-major in one array.
  const m = new Float64Array(72);
  const cell = (r: number, c: number) => m[r * 9 + c] ?? 0;
  for (let i = 0; i < 4; i++) {
    const p = src[i];
    const q = dst[i];
    if (!p || !q) return null;
    m.set([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y, q.x], i * 18);
    m.set([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y, q.y], i * 18 + 9);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) {
      if (Math.abs(cell(r, col)) > Math.abs(cell(pivot, col))) pivot = r;
    }
    if (Math.abs(cell(pivot, col)) < 1e-12) return null;
    for (let c = 0; c < 9; c++) {
      const keep = cell(col, c);
      m[col * 9 + c] = cell(pivot, c);
      m[pivot * 9 + c] = keep;
    }
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = cell(r, col) / cell(col, col);
      for (let c = col; c < 9; c++) m[r * 9 + c] = cell(r, c) - f * cell(col, c);
    }
  }
  const h = (i: number) => cell(i, 8) / cell(i, i);
  return [h(0), h(1), h(2), h(3), h(4), h(5), h(6), h(7), 1];
}

export function applyHomography(h: Matrix3, p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** The inverse (adjugate), scaled so h[8] = 1; null when singular. */
export function invertHomography(h: Matrix3): Matrix3 | null {
  const [a, b, c, d, e, f, g, i, j] = h;
  const A = e * j - f * i;
  const B = c * i - b * j;
  const C = b * f - c * e;
  const det = a * A + d * B + g * C;
  if (Math.abs(det) < 1e-12) return null;
  const inv = [
    A,
    B,
    C,
    f * g - d * j,
    a * j - c * g,
    c * d - a * f,
    d * i - e * g,
    b * g - a * i,
    a * e - b * d,
  ];
  const s = inv[8] ?? 0;
  if (Math.abs(s) < 1e-12) return null;
  const [r0 = 0, r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0, r6 = 0, r7 = 0] = inv;
  return [r0 / s, r1 / s, r2 / s, r3 / s, r4 / s, r5 / s, r6 / s, r7 / s, 1];
}
