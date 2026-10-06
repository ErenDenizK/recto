/**
 * The palette's measured fold (`03-markup` MK-2 §2, 03.2, 03.9): row widths, labels before
 * items, flows' fold order, and the ladder for narrow windows, on the palette's own items and
 * order (`palette-groups.ts`) with widths like the rendered ones (fine pointer, English).
 */
import { describe, expect, it } from 'vitest';

import { type FoldItem, foldPalette, rowWidth } from './palette-fold';
import { FOLD_STEPS, ITEM_GROUP, PALETTE_ITEMS, type PaletteItem } from './palette-groups';

/** Fine-pointer widths as measured at 1440 × 900 in English (32 px buttons). */
const WIDTH: Readonly<Record<PaletteItem, number>> = {
  done: 76,
  select: 32,
  pens: 96,
  highlighter: 32,
  eraser: 32,
  lasso: 32,
  shapes: 32,
  'text-box': 32,
  note: 32,
  image: 32,
  stamp: 32,
  sign: 70,
  chips: 244,
  stepper: 120,
  'add-field': 32,
  outlines: 32,
  'edit-text': 98,
  redact: 88,
  more: 32,
};
const LABELLED = new Set<PaletteItem>(['done', 'sign', 'edit-text', 'redact']);
const METRICS = { gap: 2, separator: 13, padding: 12 };

function items(except: readonly PaletteItem[] = []): FoldItem[] {
  return PALETTE_ITEMS.filter((id) => !except.includes(id)).map((id) => ({
    id,
    group: ITEM_GROUP[id],
    width: WIDTH[id],
    bareWidth: LABELLED.has(id) ? 32 : undefined,
  }));
}

const fold = (available: number, except: readonly PaletteItem[] = []) =>
  foldPalette(items(except), FOLD_STEPS, available, METRICS);

describe('palette fold', () => {
  it('measures a row: items, gaps within a group, a separator between shown groups, padding', () => {
    const row: FoldItem[] = [
      { id: 'a', group: 'x', width: 10 },
      { id: 'b', group: 'x', width: 10 },
      { id: 'c', group: 'y', width: 20 },
    ];
    expect(rowWidth(row, new Set(), new Set(), METRICS)).toBe(12 + 10 + 2 + 10 + 13 + 20);
    // A group folded away takes its separator with it.
    expect(rowWidth(row, new Set(['c']), new Set(), METRICS)).toBe(12 + 22);
    expect(rowWidth(row, new Set(['a', 'b']), new Set(), METRICS)).toBe(12 + 20);
  });

  it('keeps the whole row when it fits', () => {
    const result = fold(2000);
    expect(result.folded).toEqual([]);
    expect(result.bare.size).toBe(0);
    expect(result.fits).toBe(true);
  });

  it('drops Redact and Edit text labels before any item folds', () => {
    const full = fold(2000).width;
    const result = fold(full - 50);
    expect([...result.bare]).toEqual(['redact']);
    expect(result.folded).toEqual([]);
    const both = fold(full - 100);
    expect([...both.bare]).toEqual(['redact', 'edit-text']);
    expect(both.folded).toEqual([]);
  });

  it("folds in flows' order: Stamp, Image, Add field, outlines, Redact, Edit text, then the chips", () => {
    const full = fold(2000).width;
    const labelsOff = full - 56 - 66;
    expect(fold(labelsOff - 1).folded).toEqual(['stamp']);
    expect(fold(labelsOff - 40).folded).toEqual(['image', 'stamp']);
    const result = fold(full - 500);
    expect(result.folded).toEqual(
      expect.arrayContaining(['stamp', 'image', 'add-field', 'outlines', 'redact', 'edit-text']),
    );
    // The chips go before Sign loses its name (03.7: they move to the strip's row).
    expect(result.folded).toContain('chips');
    expect(result.visible).toContain('sign');
  });

  it('the ladder for narrow windows: Eraser, then the Highlighter, then Text box (03.9)', () => {
    const result = fold(330, ['chips', 'stepper']);
    expect(result.visible).toEqual(['done', 'select', 'pens', 'more']);
    expect(result.bare.has('done')).toBe(false);
    expect(result.fits).toBe(true);
    // Narrower still, Done keeps its check alone.
    expect(fold(250, ['chips', 'stepper']).bare.has('done')).toBe(true);
    // Wider: the Highlighter stays, the eraser is gone.
    const wider = fold(420, ['chips', 'stepper']);
    expect(wider.visible).toContain('highlighter');
    expect(wider.visible).not.toContain('eraser');
  });

  it('never folds Done, Select, the pens or +', () => {
    const result = fold(0);
    expect(result.visible).toEqual(['done', 'select', 'pens', 'more']);
    expect(result.fits).toBe(false);
  });

  it('a wider label (Turkish) folds sooner, by measurement', () => {
    const tr: FoldItem[] = items().map((item) =>
      item.id === 'edit-text' ? { ...item, width: 128 } : item,
    );
    const available = fold(2000).width;
    expect(fold(available).folded).toEqual([]);
    expect(foldPalette(tr, FOLD_STEPS, available, METRICS).bare.size).toBeGreaterThan(0);
  });
});
