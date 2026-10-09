/**
 * The save receipt's words (PLAN.md E13-u): counts after redactions, "Saved on this device"
 * otherwise, nothing for a copy that left through the share sheet.
 */
import { describe, expect, it } from 'vitest';

import type { SaveReceipt } from './receipt';
import { receiptLine } from './receipt-text';

const receipt = (over: Partial<SaveReceipt> = {}): SaveReceipt => ({
  acts: [],
  areasRemoved: 0,
  termsSearched: 0,
  matchesRemain: 0,
  pagesSearched: 0,
  bytes: 1024,
  ...over,
});

const act = { areas: 3, terms: 1, matches: [] } as unknown as SaveReceipt['acts'][number];

describe('receiptLine', () => {
  it('counts the areas removed and the matches left after redactions', () => {
    expect(receiptLine(receipt({ acts: [act], areasRemoved: 3 }), 'device')).toBe(
      '3 areas removed · 0 matches remain',
    );
    expect(receiptLine(receipt({ acts: [act], areasRemoved: 1, matchesRemain: 1 }), 'shared')).toBe(
      '1 area removed · 1 match remains',
    );
  });

  it('says where the file is when nothing was redacted, and nothing for a shared copy', () => {
    expect(receiptLine(receipt(), 'device')).toBe('Saved on this device');
    expect(receiptLine(receipt(), 'shared')).toBeUndefined();
  });
});
