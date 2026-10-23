import { describe, expect, it } from 'vitest';

import { keyTarget, pageAtPointer, trackOffset, visibleRange } from './strip-model';

describe('pageAtPointer', () => {
  it('picks the item under the pointer when every page fits', () => {
    // 8 pages, pitch 70, inner run starts at x 100.
    expect(pageAtPointer(100, 100, 560, 8, 70)).toBe(0);
    expect(pageAtPointer(169, 100, 560, 8, 70)).toBe(0);
    expect(pageAtPointer(170, 100, 560, 8, 70)).toBe(1);
    expect(pageAtPointer(9999, 100, 560, 8, 70)).toBe(7);
    expect(pageAtPointer(-50, 100, 560, 8, 70)).toBe(0);
  });

  it('scales the pointer over the whole document when pages do not fit', () => {
    // 500 pages in a 640 px run: the ends are the ends, the middle is the middle.
    expect(pageAtPointer(0, 0, 640, 500, 70)).toBe(0);
    expect(pageAtPointer(640, 0, 640, 500, 70)).toBe(499);
    expect(pageAtPointer(320, 0, 640, 500, 70)).toBe(250);
    expect(pageAtPointer(-20, 0, 640, 500, 70)).toBe(0);
    expect(pageAtPointer(900, 0, 640, 500, 70)).toBe(499);
  });

  it('has no page without pages', () => {
    expect(pageAtPointer(10, 0, 100, 0, 70)).toBe(0);
  });
});

describe('trackOffset', () => {
  it('rests at 0 when the pages fit', () => {
    expect(trackOffset(3, 8, 70, 600)).toBe(0);
  });
  it('centres the page and holds both ends', () => {
    expect(trackOffset(0, 500, 70, 640)).toBe(0);
    expect(trackOffset(499, 500, 70, 640)).toBe(640 - 500 * 70);
    expect(trackOffset(100, 500, 70, 640)).toBe(320 - 100.5 * 70);
  });
});

describe('visibleRange', () => {
  it('keeps a handful of items of a 500-page track, not 500', () => {
    const offset = trackOffset(250, 500, 70, 640);
    const { first, last } = visibleRange(offset, 640, 70, 500);
    expect(last - first + 1).toBeLessThan(20);
    expect(first).toBeLessThanOrEqual(250);
    expect(last).toBeGreaterThanOrEqual(250);
  });
  it('clamps to the document', () => {
    expect(visibleRange(0, 640, 70, 3)).toEqual({ first: 0, last: 2 });
    expect(visibleRange(0, 640, 70, 0)).toEqual({ first: 0, last: -1 });
  });
});

describe('keyTarget', () => {
  it('moves by one, by a screen, and to the ends', () => {
    expect(keyTarget('ArrowRight', 3, 10, 5)).toBe(4);
    expect(keyTarget('ArrowLeft', 0, 10, 5)).toBe(0);
    expect(keyTarget('PageDown', 8, 10, 5)).toBe(9);
    expect(keyTarget('Home', 8, 10, 5)).toBe(0);
    expect(keyTarget('End', 2, 10, 5)).toBe(9);
    expect(keyTarget('a', 2, 10, 5)).toBeNull();
  });
});
