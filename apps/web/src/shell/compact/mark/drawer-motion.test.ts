/**
 * The tool drawer's release hands the finger's speed to its spring (MOT-18; Q-7).
 */
import { describe, expect, it } from 'vitest';

import { springs } from '../../../motion/springs';
import { AWAY_MAX, handOff, progressFrames, TOWARD_MAX } from './drawer-motion';

describe('drawer release velocity', () => {
  it('turns px/s into progress per second along the way the panel is drawn', () => {
    // A swipe 100 px down springing back (offset = 100 · q, q → 0), the finger moving up.
    expect(handOff(-400, 100, -1)).toBeCloseTo(-4, 9);
    // A throw closing a drawer 300 px above its closed place, 60 px down (q → 0 over −240 px).
    expect(handOff(1200, 60 - 300, -1)).toBeCloseTo(-5, 9);
    expect(handOff(0, 100, -1)).toBe(0);
  });

  it('carries up to 20 distances a second toward the rest, 3 away from it', () => {
    expect(handOff(-1e5, 100, -1)).toBe(-TOWARD_MAX);
    expect(handOff(1e5, 100, -1)).toBe(AWAY_MAX);
    expect(handOff(1e5, 100, 1)).toBe(TOWARD_MAX);
  });

  it('a released spring starts at that speed, with no stall at the hand-off', () => {
    const still = progressFrames(springs.smooth, 1, 0, 0).values;
    const thrown = progressFrames(springs.smooth, 1, -4, 0).values;
    // One 120 Hz frame in: from rest it has barely moved; at −4 /s it has gone ≈ 4 / 120.
    expect(1 - (still[1] ?? 1)).toBeLessThan(0.01);
    expect(1 - (thrown[1] ?? 1)).toBeGreaterThan(0.025);
    expect(thrown.at(-1)).toBe(0);
    // Zero bounce: it never passes the rest.
    expect(thrown.every((q) => q >= 0)).toBe(true);
  });
});
