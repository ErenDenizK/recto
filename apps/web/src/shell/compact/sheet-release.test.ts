/**
 * The phone sheet's release (motion-2026-10 forms-compact §7; DSN-53): the curves start at the
 * finger's speed toward each end state, on `fling` above 300 px/s and `glide` below, and the
 * detent they head for is the one Base UI's Drawer settles on.
 */
import { describe, expect, it } from 'vitest';

import { springToLinear } from '../../motion';
import { releaseCurves, releaseTarget, turnClose, turnVelocity } from './sheet-release';

/** The first stop after 0 of a `linear()` curve: how far it gets in its first instant. */
const firstStop = (easing: string) => Number(/linear\(0, ([\d.-]+)/.exec(easing)?.[1]);

describe('releaseCurves', () => {
  it('carries a fast upward release into the snap back to the detent', () => {
    const fast = releaseCurves(120, -900, 380);
    const still = releaseCurves(120, 0, 380);
    expect(firstStop(fast['--release-open-ease'])).toBeGreaterThan(
      firstStop(still['--release-open-ease']),
    );
    // Above 300 px/s: the fling token; at rest: glide.
    expect(fast['--release-open-ms']).toBe(`${springToLinear('fling', 900 / 120).duration}ms`);
    expect(still['--release-open-ms']).toBe(`${springToLinear('glide').duration}ms`);
  });

  it('carries a downward release toward a lower detent (large to medium)', () => {
    // The detent is 200 px below: a downward speed is toward it.
    const down = releaseCurves(-200, 600, 500);
    const still = releaseCurves(-200, 0, 500);
    expect(firstStop(down['--release-open-ease'])).toBeGreaterThan(
      firstStop(still['--release-open-ease']),
    );
  });

  it('carries a downward release into the close', () => {
    const down = releaseCurves(200, 600, 300);
    const still = releaseCurves(200, 0, 300);
    expect(firstStop(down['--release-close-ease'])).toBeGreaterThan(
      firstStop(still['--release-close-ease']),
    );
  });

  it('settles every curve within A-10’s 500 ms to 1 %', () => {
    for (const v of [-2000, -300, 0, 300, 2000]) {
      const curves = releaseCurves(150, v, 350);
      expect(parseInt(curves['--release-open-ms'], 10)).toBeLessThanOrEqual(800);
      expect(parseInt(curves['--release-close-ms'], 10)).toBeLessThanOrEqual(800);
    }
  });

  it('turns a release moving away from the end state without a deep dip', () => {
    // A fast downward release that still snaps back: the curve dips below 0 only a little.
    const easing = releaseCurves(60, 1500, 440)['--release-open-ease'];
    const stops = [...easing.matchAll(/(-?[\d.]+) [\d.]+%/g)].map((m) => Number(m[1]));
    expect(Math.min(...stops)).toBeLessThan(0);
    expect(Math.min(...stops)).toBeGreaterThan(-0.12);
  });
});

describe('releaseTarget', () => {
  // A 700 px sheet whose medium detent sits 300 px below large.
  const offsets = [0, 300];
  const height = 700;

  it('settles on the nearest detent after a slow release', () => {
    expect(releaseTarget(40, 0, offsets, height)).toBe(0);
    expect(releaseTarget(260, 0, offsets, height)).toBe(300);
  });

  it('goes up a detent on a quick flick up', () => {
    expect(releaseTarget(290, -900, offsets, height)).toBe(0);
  });

  it('closes on a quick flick down, or past halfway to closed', () => {
    expect(releaseTarget(310, 900, offsets, height)).toBeNull();
    expect(releaseTarget(560, 0, offsets, height)).toBeNull();
  });
});

describe('a sheet turned back mid-entrance (MOT-18)', () => {
  it('reads the speed from the latest sample at least 4 ms old', () => {
    const samples = [
      { t: 0, y: 400 },
      { t: 16, y: 380 },
      { t: 32, y: 340 },
    ];
    // 340 -> 300 over 16 ms is -2500 px/s (up), and a sample 1 ms old is skipped.
    expect(turnVelocity([...samples, { t: 47, y: 301 }], 48, 300)).toBeCloseTo(-2500, 0);
    expect(turnVelocity([], 10, 300)).toBe(0);
    expect(turnVelocity([{ t: 9, y: 310 }], 10, 300)).toBe(0);
  });

  it('closes on a spring that starts at the speed it had, capped away from the closed side', () => {
    // Rising at 4100 px/s with 800 px to go: away from closing, so 3 distances/s at most.
    expect(turnClose(-4100, 800)).toEqual({ token: 'fling', velocity: -2400 });
    // Rising slowly keeps its speed; falling is carried up to 20 distances/s.
    expect(turnClose(-300, 800)).toEqual({ token: 'glide', velocity: -300 });
    expect(turnClose(9000, 400)).toEqual({ token: 'fling', velocity: 8000 });
    expect(turnClose(0, 400)).toEqual({ token: 'glide', velocity: 0 });
  });
});
