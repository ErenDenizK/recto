/**
 * The thumbnail list's geometry (06-navigation N2 §2, §2.4): one row rule, the box at the
 * default width, the drop gap from a pointer, and Alt+arrow targets.
 */
import type { PageId } from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import { stepTarget } from './thumbnail-actions';
import {
  dropIndexAt,
  gapOffset,
  ROW,
  rowHeight,
  rowOffsets,
  thumbnailBox,
} from './thumbnail-layout';

describe('thumbnail layout', () => {
  it('fits Preview-sized thumbnails at the default 280 px and grows a little wider', () => {
    expect(thumbnailBox(279)).toEqual({ width: 128, height: 166 });
    expect(thumbnailBox(400).width).toBeGreaterThan(128);
    expect(thumbnailBox(400).width).toBeLessThanOrEqual(168);
    expect(thumbnailBox(239).width).toBeGreaterThanOrEqual(88);
  });

  it('gives every row the same rule: padding, page, gap, label, padding', () => {
    expect(rowHeight(100)).toBe(8 + 100 + 8 + 16 + 8);
    const offsets = rowOffsets([100, 50]);
    expect(offsets.rows).toEqual([
      { start: ROW.listStart, size: rowHeight(100) + ROW.gap },
      { start: ROW.listStart + rowHeight(100) + ROW.gap, size: rowHeight(50) + ROW.gap },
    ]);
    expect(offsets.total).toBe(
      ROW.listStart + rowHeight(100) + rowHeight(50) + 2 * ROW.gap + ROW.listEnd,
    );
  });

  it('lands a drag before a row while above its middle, after the last below', () => {
    const offsets = rowOffsets([100, 100, 100]);
    const [first, second] = offsets.rows;
    if (!first || !second) throw new Error('rows');
    expect(dropIndexAt(offsets, 0)).toBe(0);
    expect(dropIndexAt(offsets, first.start + first.size / 2 - 1)).toBe(0);
    expect(dropIndexAt(offsets, first.start + first.size / 2 + 1)).toBe(1);
    expect(dropIndexAt(offsets, second.start + 2)).toBe(1);
    expect(dropIndexAt(offsets, 10_000)).toBe(3);
    // The bar sits in the gap between rows.
    expect(gapOffset(offsets, 1)).toBe(second.start - ROW.gap);
    expect(gapOffset(offsets, 0)).toBe(first.start - ROW.gap);
  });

  it('moves a block by one place with Alt+arrows, gaps counted before removal', () => {
    const order = ['a', 'b', 'c', 'd'] as PageId[];
    expect(stepTarget(order, ['c' as PageId], -1)).toBe(1);
    expect(stepTarget(order, ['b' as PageId], 1)).toBe(3);
    expect(stepTarget(order, ['b', 'c'] as PageId[], 1)).toBe(4);
    expect(stepTarget(order, ['a' as PageId], -1)).toBeUndefined();
    expect(stepTarget(order, ['d' as PageId], 1)).toBeUndefined();
  });
});
