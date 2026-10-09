/**
 * The compact sheet's release (motion-2026-10 forms-compact §7): the curves start at the
 * finger's speed toward each end state, on `fling` above 300 px/s and `glide` below.
 */
import { describe, expect, it } from 'vitest';

import { springToLinear } from '../../motion';
import { releaseCurves } from './sheet-release';

/** The first stop after 0 of a `linear()` curve: how far it gets in its first instant. */
const firstStop = (easing: string) => Number(/linear\(0, ([\d.-]+)/.exec(easing)?.[1]);

describe('releaseCurves', () => {
  it('carries a fast upward release into the snap back to the detent', () => {
    const fast = releaseCurves(120, -900, 500);
    const still = releaseCurves(120, 0, 500);
    expect(firstStop(fast['--release-open-ease'])).toBeGreaterThan(
      firstStop(still['--release-open-ease']),
    );
    // Above 300 px/s: the fling token; at rest: glide.
    expect(fast['--release-open-ms']).toBe(`${springToLinear('fling', 900 / 120).duration}ms`);
    expect(still['--release-open-ms']).toBe(`${springToLinear('glide').duration}ms`);
  });

  it('carries a downward release into the close', () => {
    const down = releaseCurves(200, 600, 500);
    const still = releaseCurves(200, 0, 500);
    expect(firstStop(down['--release-close-ease'])).toBeGreaterThan(
      firstStop(still['--release-close-ease']),
    );
  });

  it('settles every curve within A-10’s 500 ms to 1 %', () => {
    for (const v of [-2000, -300, 0, 300, 2000]) {
      const curves = releaseCurves(150, v, 500);
      expect(parseInt(curves['--release-open-ms'], 10)).toBeLessThanOrEqual(800);
      expect(parseInt(curves['--release-close-ms'], 10)).toBeLessThanOrEqual(800);
    }
  });

  it('turns a release moving away from the end state without a deep dip', () => {
    // A fast downward release that still snaps back: the curve dips below 0 only a little.
    const easing = releaseCurves(60, 1500, 500)['--release-open-ease'];
    const stops = [...easing.matchAll(/(-?[\d.]+) [\d.]+%/g)].map((m) => Number(m[1]));
    expect(Math.min(...stops)).toBeLessThan(0);
    expect(Math.min(...stops)).toBeGreaterThan(-0.12);
  });
});
