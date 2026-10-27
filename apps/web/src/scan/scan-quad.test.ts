/**
 * The corner helpers of the scan (critic, 25 Oct): the inset that keeps the desk's edge out of the
 * warped page, and the corner names that follow a rotation.
 */
import { describe, expect, it } from 'vitest';

import { homographyFor, type Quad, type Raster, warpCpu } from './warp/cpu';
import { cornerPositions, defaultQuad, insetQuad, rotateQuad } from './scan-store';

const W = 400;
const H = 600;
const DARK = 30;
const LIGHT = 240;

/** A white page (x 50..350, y 50..550) on a dark desk. */
function desk(): Raster {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const on = x >= 50 && x < 350 && y >= 50 && y < 550;
      const v = on ? LIGHT : DARK;
      data.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return { data, width: W, height: H };
}

/** The share of the outermost two rows and columns of `out` that is dark. */
function darkBorder(out: Raster): number {
  let dark = 0;
  let total = 0;
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      if (x > 1 && y > 1 && x < out.width - 2 && y < out.height - 2) continue;
      total += 1;
      if ((out.data[(y * out.width + x) * 4] ?? 0) < 128) dark += 1;
    }
  }
  return dark / total;
}

// The detector's outline sits about 1 px outside the paper.
const OUTSIDE: Quad = [
  { x: 49, y: 49 },
  { x: 351, y: 49 },
  { x: 351, y: 551 },
  { x: 49, y: 551 },
];

describe('insetQuad', () => {
  it('leaves no band of desk along the warped page', () => {
    const src = desk();
    const warp = (quad: Quad) => warpCpu(src, homographyFor(quad, 300, 500), 300, 500);
    expect(darkBorder(warp(OUTSIDE))).toBeGreaterThan(0.2);
    expect(darkBorder(warp(insetQuad(OUTSIDE)))).toBe(0);
  });

  it('keeps the centre and moves each edge in by 0.8 % of its length', () => {
    const q = insetQuad(defaultQuad(1000, 1000));
    const original = defaultQuad(1000, 1000);
    // Edge length 880: the left edge moves in by 0.008 * 880 = 7.04 px.
    expect(q[0].x - original[0].x).toBeCloseTo(7.04, 1);
    expect(q[2].x - original[2].x).toBeCloseTo(-7.04, 1);
  });
});

describe('cornerPositions', () => {
  it('names an upright quad in order', () => {
    expect(cornerPositions(defaultQuad(100, 200))).toEqual([0, 1, 2, 3]);
  });

  it('follows a rotation: the handle that moved keeps the place it is at', () => {
    const q = defaultQuad(100, 200);
    // After a quarter turn the quad's first point is the old bottom-left corner.
    const turned = rotateQuad(q);
    expect(turned[0]).toEqual(q[3]);
    // The picture did not move, so the handle at the bottom left is still named bottom left.
    expect(cornerPositions(turned)).toEqual([3, 0, 1, 2]);
  });
});
