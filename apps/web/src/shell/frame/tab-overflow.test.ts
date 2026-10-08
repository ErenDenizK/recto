import { describe, expect, it } from 'vitest';

import { nameEnding, splitTabs, TAB_GAP_FINE, tabCapacity } from './tab-overflow';

/** The overflow chip's width in English ("3 more ▾") and Turkish ("3 daha ▾"), about. */
const CHIP = { en: 92, tr: 88 } as const;

describe('tab capacity (01-frame F4 §2)', () => {
  it('shows every tab while all fit at their minimum width', () => {
    expect(tabCapacity(3, 3 * 112 + 2 * TAB_GAP_FINE, 112, TAB_GAP_FINE, CHIP.en)).toBe(3);
  });

  it('gives room to the chip first once they do not all fit', () => {
    // 600 px of room: five 112 px tabs would fit, six do not; with the chip, four.
    expect(tabCapacity(6, 600, 112, TAB_GAP_FINE, CHIP.en)).toBe(4);
  });

  it('always shows the active tab, however narrow the strip', () => {
    expect(tabCapacity(6, 40, 112, TAB_GAP_FINE, CHIP.tr)).toBe(1);
    expect(tabCapacity(0, 400, 112, TAB_GAP_FINE, CHIP.en)).toBe(0);
  });

  // Six documents in the room the strip's other items leave at each class edge (fine tabs 112 px
  // with 2 px gaps, coarse 128 with 8; the trailing group grows with the Find field at 1280).
  it.each([
    ['medium, fine (600)', 600 - 330, 112, 2, 1],
    ['expanded, fine (840)', 840 - 560, 112, 2, 1],
    ['large, fine (1200)', 1200 - 610, 112, 2, 4],
    ['xlarge, fine (1600)', 1600 - 610, 112, 2, 6],
    ['tablet, coarse (820)', 820 - 520, 128, 8, 1],
  ])('%s: %i px of room, %i px tabs, %i px gaps', (_label, room, min, gap, expected) => {
    expect(tabCapacity(6, room, min, gap, CHIP.en)).toBe(expected);
  });
});

describe('which tabs show (01-frame F4 §2: the active tab and its neighbours stay)', () => {
  const tabs = ['a', 'b', 'c', 'd', 'e', 'f'];

  it('keeps every tab when all fit', () => {
    expect(splitTabs(tabs, 2, 6)).toEqual({ visible: tabs, overflow: [] });
  });

  it('centres the run on the active tab where the ends allow', () => {
    expect(splitTabs(tabs, 3, 3)).toEqual({ visible: ['c', 'd', 'e'], overflow: ['a', 'b', 'f'] });
  });

  it('clamps the run at either end', () => {
    expect(splitTabs(tabs, 0, 3).visible).toEqual(['a', 'b', 'c']);
    expect(splitTabs(tabs, 5, 3).visible).toEqual(['d', 'e', 'f']);
  });

  it('starts at the first tab on the Library, where none is active', () => {
    expect(splitTabs(tabs, -1, 2)).toEqual({
      visible: ['a', 'b'],
      overflow: ['c', 'd', 'e', 'f'],
    });
  });

  it('never shows fewer than one tab, and keeps document order in the overflow', () => {
    const split = splitTabs(tabs, 4, 0);
    expect(split.visible).toEqual(['e']);
    expect(split.overflow).toEqual(['a', 'b', 'c', 'd', 'f']);
  });
});

describe('a tab name keeps its ending when it truncates (owner feedback F4)', () => {
  it('keeps a trailing parenthetical or number whole', () => {
    expect(nameEnding('Recto sample (extract)')).toEqual({
      head: 'Recto sample',
      tail: '(extract)',
    });
    expect(nameEnding('Recto sample (2)')).toEqual({ head: 'Recto sample', tail: '(2)' });
    expect(nameEnding('Recto örnek belge (ayıklanan)')).toEqual({
      head: 'Recto örnek belge',
      tail: '(ayıklanan)',
    });
    expect(nameEnding('scan 2')).toEqual({ head: 'scan', tail: '2' });
  });

  it('cuts at the end when there is no short ending, or nothing before it', () => {
    expect(nameEnding('report')).toBeNull();
    expect(nameEnding('Combined – simple-text, rotated-pages')).toBeNull();
    expect(nameEnding('2024')).toBeNull();
    expect(nameEnding('(extract)')).toBeNull();
    expect(nameEnding('notes (a very long remark here)')).toBeNull();
  });
});
