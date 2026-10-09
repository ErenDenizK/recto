/** The signature's smoothed line (motion-2026-10 forms-compact §2). */
import { describe, expect, it } from 'vitest';

import { svgPath } from './smooth-ink';

describe('svgPath', () => {
  it('joins the samples by curves through their midpoints, ending on the last one', () => {
    expect(svgPath([[0, 0, 10, 0, 10, 10, 20, 10]])).toBe('M0 0Q10 0 10 5Q10 10 15 10L20 10');
  });

  it('draws a straight line for two points and a dot for one', () => {
    expect(svgPath([[0, 0, 10, 0]])).toBe('M0 0L10 0');
    expect(svgPath([[5, 5]])).toBe('M5 5L5.1 5');
  });
});
