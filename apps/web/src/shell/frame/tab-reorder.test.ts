import type { DocumentId } from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import { orderIndex, reorderSlot } from './tab-reorder';

const ids = (...names: string[]) => names as DocumentId[];

describe('dragging a tab to reorder (motion-2026-10 frame.md §7)', () => {
  it('lands in the slot whose centre the pointer has passed', () => {
    const centres = [50, 150, 250];
    expect(reorderSlot(centres, 0, 40)).toBe(0);
    expect(reorderSlot(centres, 0, 160)).toBe(1);
    expect(reorderSlot(centres, 0, 400)).toBe(2);
    expect(reorderSlot(centres, 2, 10)).toBe(0);
    expect(reorderSlot(centres, 2, 120)).toBe(1);
  });

  it('maps the visible slot onto the whole order, tabs in "N more" included', () => {
    const order = ids('a', 'b', 'c', 'd');
    // a, b, c show; d is in "N more".
    expect(orderIndex(order, ids('a', 'b', 'c'), ids('a')[0]!, 1)).toBe(1);
    expect(orderIndex(order, ids('a', 'b', 'c'), ids('a')[0]!, 2)).toBe(2);
    expect(orderIndex(order, ids('a', 'b', 'c'), ids('c')[0]!, 0)).toBe(0);
  });
});
