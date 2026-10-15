/**
 * The backdrop lens's map (language.md §2.7; decisions GLS-3, GLS-11; `material-lens.ts`): the
 * rounded rectangle's distance, the Snell pull over the bezel, and the map drawn per size.
 */
import { describe, expect, it } from 'vitest';

import { BAR_LENS, CHIP_LENS, lensMap, roundRectDistance, snellPull } from './material-lens';

describe('the lens map (GLS-11)', () => {
  it('measures the distance to a rounded rectangle, negative inside', () => {
    expect(roundRectDistance(50, 20, 100, 40, 20)).toBeCloseTo(-20, 5);
    expect(roundRectDistance(0, 20, 100, 40, 20)).toBeCloseTo(0, 5);
    // The capsule's round end: a corner point is outside.
    expect(roundRectDistance(0, 0, 100, 40, 20)).toBeGreaterThan(0);
  });

  it('pulls most at the rim, nothing past the bezel, never beyond the cap', () => {
    for (const shape of [CHIP_LENS, BAR_LENS]) {
      expect(snellPull(shape.bezel, shape)).toBe(0);
      expect(snellPull(shape.bezel + 5, shape)).toBe(0);
      const rim = snellPull(0.5, shape);
      const inside = snellPull(shape.bezel * 0.8, shape);
      expect(rim).toBeGreaterThan(inside);
      expect(rim).toBeLessThanOrEqual(shape.pull);
    }
    expect(BAR_LENS.pull).toBeLessThanOrEqual(12);
  });

  it('draws a map at the size asked, neutral in the middle', () => {
    const { url, scale } = lensMap(120, 40, 20, BAR_LENS);
    expect(url).toMatch(/^data:image\/png/);
    expect(scale).toBeCloseTo((2 * BAR_LENS.pull * 255) / 254, 5);
  });
});
