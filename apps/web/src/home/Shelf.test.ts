/**
 * The first line of a shelf (`firstRowFit`, DSN-93): how many covers sit on one row before
 * "Show all", from their known widths. Pure, so no browser.
 */
import { describe, expect, it } from 'vitest';

import { firstRowFit } from './Shelf';

describe('firstRowFit', () => {
  it('counts the tiles that fit with their gaps, a pixel to spare', () => {
    // 158 + 44 + 158 + 44 + 158 = 562.
    expect(firstRowFit([158, 158, 158, 158], 44, 563)).toBe(3);
    expect(firstRowFit([158, 158, 158, 158], 44, 562)).toBe(2);
    expect(firstRowFit([158, 158, 158, 158], 44, 1200)).toBe(4);
  });

  it('takes the true widths: a wide deck cover costs more than a page', () => {
    expect(firstRowFit([158, 317, 158, 158], 44, 800)).toBe(3);
    expect(firstRowFit([158, 317, 158, 158], 44, 700)).toBe(2);
  });

  it('always keeps one tile, and none for an empty shelf', () => {
    expect(firstRowFit([360, 360], 44, 100)).toBe(1);
    expect(firstRowFit([], 44, 1200)).toBe(0);
  });
});
