/** Find's ticks on the scroll bar (DSN-62): one per hit page, the current hit's separate. */
import { describe, expect, it } from 'vitest';

import { ticksOf } from './search-ticks';

describe('ticksOf', () => {
  it('has no ticks without hits', () => {
    expect(ticksOf([], -1, 10)).toBeNull();
  });

  it('merges hits of a page into one tick at the page centre and marks the current page', () => {
    const hits = [{ pageIndex: 0 }, { pageIndex: 0 }, { pageIndex: 3 }];
    expect(ticksOf(hits, 2, 4)).toEqual({ at: [0.125, 0.875], current: 0.875 });
  });
});
