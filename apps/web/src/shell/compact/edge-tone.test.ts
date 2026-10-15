/** The adaptive scroll edge's tone (DSN-40, `edge-tone.ts`). */
import { describe, expect, it } from 'vitest';

import { colourLuminance, meanLuminance, toneFor } from './edge-tone';

describe('the edge tone', () => {
  it('reads a page’s luminance from its pixels, skipping transparent ones', () => {
    expect(meanLuminance([255, 255, 255, 255])).toBeCloseTo(1);
    expect(meanLuminance([0, 0, 0, 255, 255, 255, 255, 0])).toBeCloseTo(0);
    expect(meanLuminance([0, 0, 0, 0])).toBeNull();
    expect(colourLuminance('rgb(8, 9, 12)')).toBeLessThan(0.01);
    expect(colourLuminance('rgba(230, 232, 235, 1)')).toBeGreaterThan(0.75);
  });

  it('flips dark below 0.35 and light above 0.5, keeping the last tone between', () => {
    expect(toneFor(0.05, 0)).toBe(1);
    expect(toneFor(0.9, 1)).toBe(0);
    expect(toneFor(0.42, 0)).toBe(0);
    expect(toneFor(0.42, 1)).toBe(1);
  });
});
