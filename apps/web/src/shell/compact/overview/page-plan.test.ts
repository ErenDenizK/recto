import { describe, expect, it } from 'vitest';

import { type GridFrame, gridLayout, slotBox } from './overview-layout';
import {
  dropGap,
  EDGE_SPEED,
  EDGE_ZONE,
  edgeSpeed,
  insertionIndex,
  movesSomething,
  partName,
  splitRanges,
} from './page-plan';

const PHONE: GridFrame = {
  width: 390,
  height: 844,
  insetLeft: 0,
  insetRight: 0,
  padTop: 20,
  padBottom: 96,
};

describe('the overview’s page acts (MOB-3)', () => {
  it('adds after the selection, else after the page it opened on, else at the end', () => {
    expect(insertionIndex(10, [2, 5], 0)).toBe(6);
    expect(insertionIndex(10, [], 3)).toBe(4);
    expect(insertionIndex(10, [], undefined)).toBe(10);
    expect(insertionIndex(10, [9], 0)).toBe(10);
  });

  it('drops before the page under the finger, or after it past its middle', () => {
    const layout = gridLayout(12, PHONE, 3);
    const slot = slotBox(layout, 4);
    expect(dropGap(layout, slot.left + 5, slot.top + 10)).toBe(4);
    expect(dropGap(layout, slot.left + slot.width - 5, slot.top + 10)).toBe(5);
    expect(dropGap(layout, 2, 2)).toBe(0);
  });

  it('knows a drop that changes nothing', () => {
    expect(movesSomething([3], 3)).toBe(false);
    expect(movesSomething([3], 4)).toBe(false);
    expect(movesSomething([3], 5)).toBe(true);
    expect(movesSomething([3], 0)).toBe(true);
    expect(movesSomething([3, 4, 5], 4)).toBe(false);
    // Scattered pages gather even into their own span.
    expect(movesSomething([1, 4], 2)).toBe(true);
    expect(movesSomething([], 2)).toBe(false);
  });

  it('splits so a new file starts at each selected page', () => {
    expect(splitRanges(10, [3, 6])).toEqual([
      [0, 3],
      [3, 6],
      [6, 10],
    ]);
    // The first page starts the first file anyway; repeats and strays are ignored.
    expect(splitRanges(10, [0, 6, 6, 12])).toEqual([
      [0, 6],
      [6, 10],
    ]);
    expect(splitRanges(4, [])).toEqual([[0, 4]]);
  });

  it('scrolls near the edges, faster deeper in', () => {
    expect(edgeSpeed(400, 0, 844)).toBe(0);
    expect(edgeSpeed(0, 0, 844)).toBe(-EDGE_SPEED);
    expect(edgeSpeed(844, 0, 844)).toBe(EDGE_SPEED);
    const shallow = edgeSpeed(844 - EDGE_ZONE + 10, 0, 844);
    const deep = edgeSpeed(844 - 10, 0, 844);
    expect(shallow).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(shallow);
  });

  it('names a part after the document', () => {
    expect(partName('report.pdf', 'pages 3–5')).toBe('report (pages 3–5).pdf');
    expect(partName('  ', 'page 1')).toBe('document (page 1).pdf');
  });
});
