import { describe, expect, it } from 'vitest';

import { tickAt, tickPages } from './tick-hit';

describe('tickPages', () => {
  it('groups hits per page with the first hit and the count', () => {
    const hits = [
      { pageIndex: 0 },
      { pageIndex: 0 },
      { pageIndex: 3 },
      { pageIndex: 3 },
      { pageIndex: 3 },
    ];
    expect(tickPages(hits, 4)).toEqual([
      { pageIndex: 0, at: 0.125, first: 0, count: 2 },
      { pageIndex: 3, at: 0.875, first: 2, count: 3 },
    ]);
  });

  it('is empty without hits or pages', () => {
    expect(tickPages([], 4)).toEqual([]);
    expect(tickPages([{ pageIndex: 0 }], 0)).toEqual([]);
  });
});

describe('tickAt', () => {
  const pages = tickPages([{ pageIndex: 1 }, { pageIndex: 2 }, { pageIndex: 8 }], 10);

  it('finds the nearest tick within the tolerance', () => {
    expect(tickAt(pages, 0.86, 0.02)?.pageIndex).toBe(8);
    expect(tickAt(pages, 0.16, 0.02)?.pageIndex).toBe(1);
  });

  it('answers the nearer of two crowded ticks', () => {
    expect(tickAt(pages, 0.19, 0.1)?.pageIndex).toBe(1);
    expect(tickAt(pages, 0.24, 0.1)?.pageIndex).toBe(2);
  });

  it('misses between ticks and on an empty list', () => {
    expect(tickAt(pages, 0.5, 0.02)).toBeNull();
    expect(tickAt([], 0.5, 1)).toBeNull();
  });
});
