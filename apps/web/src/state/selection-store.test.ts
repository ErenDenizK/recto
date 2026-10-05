import { type PageId, pageId, type VirtualDocument } from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import {
  clickSelection,
  EMPTY_SELECTION,
  extendSelection,
  marqueeSelection,
  moveFocusIndex,
  navigatorClick,
  navigatorExtend,
  pruneClipboard,
  pruneSelection,
  rangeBetween,
  sameSelection,
  selectAllOf,
  type SelectionSnapshot,
  toggleSelection,
  visibleSelection,
} from './selection-store';

const order: PageId[] = ['a', 'b', 'c', 'd', 'e'].map(pageId);
const [a, b, c, d, e] = order as [PageId, PageId, PageId, PageId, PageId];
const ids = (state: SelectionSnapshot) => [...state.selected].sort();
const plain = { shift: false, mod: false };

describe('selection helpers', () => {
  it('plain click selects one page and sets the anchor', () => {
    const next = clickSelection(selectAllOf(order, null), order, c, plain);
    expect(ids(next)).toEqual([c]);
    expect(next.anchor).toBe(c);
    expect(next.focused).toBe(c);
  });

  it('Mod+click toggles without touching the rest', () => {
    let state = clickSelection(EMPTY_SELECTION, order, b, plain);
    state = clickSelection(state, order, d, { shift: false, mod: true });
    expect(ids(state)).toEqual([b, d]);
    state = clickSelection(state, order, b, { shift: false, mod: true });
    expect(ids(state)).toEqual([d]);
  });

  it('Shift+click selects the range from the anchor in either direction', () => {
    let state = clickSelection(EMPTY_SELECTION, order, c, plain);
    state = clickSelection(state, order, e, { shift: true, mod: false });
    expect(ids(state)).toEqual([c, d, e]);
    // The anchor stays, so a second Shift+click pivots around it.
    state = clickSelection(state, order, a, { shift: true, mod: false });
    expect(ids(state)).toEqual([a, b, c]);
    expect(state.anchor).toBe(c);
  });

  it('Shift+Mod+click adds the range to the selection', () => {
    let state = clickSelection(EMPTY_SELECTION, order, a, plain);
    state = clickSelection(state, order, d, { shift: false, mod: true });
    state = clickSelection(state, order, e, { shift: true, mod: true });
    expect(ids(state)).toEqual([a, d, e]);
  });

  it('Shift without an anchor selects just the clicked page', () => {
    const state = clickSelection(EMPTY_SELECTION, order, b, { shift: true, mod: false });
    expect(ids(state)).toEqual([b]);
    expect(state.anchor).toBe(b);
  });

  it('extends from the anchor for Shift+Arrow and toggles for Space', () => {
    let state: SelectionSnapshot = { selected: new Set([b]), anchor: b, focused: b };
    state = extendSelection(state, order, d);
    expect(ids(state)).toEqual([b, c, d]);
    expect(state.focused).toBe(d);
    state = toggleSelection(state, c);
    expect(ids(state)).toEqual([b, d]);
  });

  it('rangeBetween ignores unknown ids', () => {
    expect(rangeBetween(order, pageId('zz'), c)).toEqual([c]);
    expect(rangeBetween(order, a, pageId('zz'))).toEqual([]);
  });

  it('moves grid focus with wrapping across rows and clamping at the edges', () => {
    // 5 pages in 2 columns: rows [0,1] [2,3] [4].
    expect(moveFocusIndex(1, 5, 'ArrowRight', 2)).toBe(2);
    expect(moveFocusIndex(2, 5, 'ArrowLeft', 2)).toBe(1);
    expect(moveFocusIndex(4, 5, 'ArrowRight', 2)).toBe(4);
    expect(moveFocusIndex(0, 5, 'ArrowLeft', 2)).toBe(0);
    expect(moveFocusIndex(1, 5, 'ArrowDown', 2)).toBe(3);
    expect(moveFocusIndex(3, 5, 'ArrowDown', 2)).toBe(3);
    expect(moveFocusIndex(3, 5, 'ArrowUp', 2)).toBe(1);
    expect(moveFocusIndex(3, 5, 'Home', 2)).toBe(0);
    expect(moveFocusIndex(0, 5, 'End', 2)).toBe(4);
    expect(moveFocusIndex(-1, 5, 'ArrowRight', 2)).toBe(1);
    expect(moveFocusIndex(0, 0, 'ArrowRight', 2)).toBe(-1);
  });

  it('prunes pages that left the workspace and keeps identity otherwise', () => {
    const state: SelectionSnapshot = { selected: new Set([a, b]), anchor: b, focused: b };
    expect(pruneSelection(state, () => true)).toBe(state);
    const pruned = pruneSelection(state, (id) => id !== b);
    expect(ids(pruned)).toEqual([a]);
    expect(pruned.anchor).toBeNull();
    expect(pruned.focused).toBeNull();
  });
});

describe('marqueeSelection', () => {
  const base = { selected: new Set([a]), anchor: a, focused: a };

  it('replaces the selection with the hits, focusing the first', () => {
    const next = marqueeSelection(base, [c, d], false);
    expect([...next.selected]).toEqual([c, d]);
    expect(next.focused).toBe(c);
    expect(next.anchor).toBe(c);
  });

  it('adds to the selection at press time when additive (Shift / Mod)', () => {
    expect([...marqueeSelection(base, [b], true).selected]).toEqual([a, b]);
  });

  it('keeps focus when the marquee touches nothing', () => {
    const next = marqueeSelection(base, [], false);
    expect(next.selected.size).toBe(0);
    expect(next.focused).toBe(a);
    expect(sameSelection(marqueeSelection(base, [], true).selected, base.selected)).toBe(true);
  });
});

describe('pruneClipboard', () => {
  it('drops pages that left the workspace and empties to null', () => {
    const clipboard = { pageIds: [a, b], mode: 'cut' as const };
    expect(pruneClipboard(clipboard, () => true)).toBe(clipboard);
    expect(pruneClipboard(clipboard, (id) => id === b)).toEqual({ pageIds: [b], mode: 'cut' });
    expect(pruneClipboard(clipboard, () => false)).toBeNull();
    expect(pruneClipboard(null, () => true)).toBeNull();
  });
});

describe('navigator safety (S10)', () => {
  const grid = { selected: new Set<PageId>(), anchor: null, focused: d };

  it('navigation never writes the selection: a plain click hands back the same state', () => {
    expect(navigatorClick(EMPTY_SELECTION, order, b, plain, a)).toBe(EMPTY_SELECTION);
    const selected = { selected: new Set([c]), anchor: c, focused: null };
    expect(navigatorClick(selected, order, b, plain, a)).toBe(selected);
  });

  it('Shift-click selects from the anchor, else from the page being read', () => {
    expect(ids(navigatorClick(EMPTY_SELECTION, order, d, { shift: true, mod: false }, b))).toEqual([
      b,
      c,
      d,
    ]);
    const anchored = { selected: new Set([a]), anchor: a, focused: null };
    expect(ids(navigatorClick(anchored, order, c, { shift: true, mod: false }, e))).toEqual([
      a,
      b,
      c,
    ]);
  });

  it('Mod-click toggles one page; the grid’s keyboard focus stays where it was', () => {
    const next = navigatorClick(grid, order, b, { shift: false, mod: true }, a);
    expect(ids(next)).toEqual([b]);
    expect(next.focused).toBe(d);
    expect(ids(navigatorClick(next, order, b, { shift: false, mod: true }, a))).toEqual([]);
  });

  it('Shift+Down extends from the row the key left, keeping the grid’s focus', () => {
    const next = navigatorExtend(grid, order, b, c);
    expect(ids(next)).toEqual([b, c]);
    expect(next.anchor).toBe(b);
    expect(next.focused).toBe(d);
  });

  it('a selection is visible on the page only where the navigator lists it', () => {
    const shown = { pages: [c, a, e].map((id) => ({ id })) } as unknown as VirtualDocument;
    const selected = new Set([a, b, c]);
    expect(visibleSelection(selected, undefined)).toEqual([]);
    expect(visibleSelection(new Set(), shown)).toEqual([]);
    // In the list's page order; `b` belongs to a document the list does not show.
    expect(visibleSelection(selected, shown)).toEqual([c, a]);
  });
});
