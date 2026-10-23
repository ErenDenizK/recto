import { describe, expect, it } from 'vitest';

import { isSoft, SOFT_FRACTION } from './placeholder';

describe('placeholder choice (DSN-64)', () => {
  it('asks for a quarter of the scale first', () => {
    expect(SOFT_FRACTION).toBe(0.25);
  });

  it('veils a bitmap below half the asked scale, and only that', () => {
    expect(isSoft(0.5, 2)).toBe(true);
    expect(isSoft(0.99, 2)).toBe(true);
    expect(isSoft(1, 2)).toBe(false);
    expect(isSoft(1.9, 2)).toBe(false);
  });
});
