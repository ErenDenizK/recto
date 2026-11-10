/**
 * The palette's measured fold (`03-markup` MK-2 §2, 03.2, 03.9; DSN-91): row widths, flows' fold
 * order and the ladder for narrow windows, on the palette's own items and order
 * (`palette-groups.ts`) with widths like the rendered ones. There are no labels to drop: the row
 * only folds items, and Done, the one word, stays.
 */
import { describe, expect, it } from 'vitest';

import { type FoldItem, foldPalette, rowWidth } from './palette-fold';
import { FOLD_STEPS, ITEM_GROUP, PALETTE_ITEMS, type PaletteItem } from './palette-groups';

/** Widths as measured at 1440 × 900 in English: 44 px slots, Done's word, the chips' plates. */
const WIDTH: Readonly<Record<PaletteItem, number>> = {
  done: 62,
  select: 44,
  pens: 138,
  highlighter: 44,
  eraser: 44,
  lasso: 44,
  shapes: 44,
  'text-box': 44,
  note: 44,
  image: 44,
  stamp: 44,
  sign: 44,
  chips: 138,
  stepper: 120,
  'add-field': 44,
  outlines: 44,
  'edit-text': 44,
  redact: 44,
  more: 44,
};
/** Two px between slots, 14 of air plus 2 each side between groups, the pad and the rim. */
const METRICS = { gap: 2, separator: 18, padding: 12 };

function items(except: readonly PaletteItem[] = []): FoldItem[] {
  return PALETTE_ITEMS.filter((id) => !except.includes(id)).map((id) => ({
    id,
    group: ITEM_GROUP[id],
    width: WIDTH[id],
  }));
}

const fold = (available: number, except: readonly PaletteItem[] = []) =>
  foldPalette(items(except), FOLD_STEPS, available, METRICS);

describe('palette fold', () => {
  it('measures a row: items, gaps within a group, air between shown groups, padding', () => {
    const row: FoldItem[] = [
      { id: 'a', group: 'x', width: 10 },
      { id: 'b', group: 'x', width: 10 },
      { id: 'c', group: 'y', width: 20 },
    ];
    expect(rowWidth(row, new Set(), new Set(), METRICS)).toBe(12 + 10 + 2 + 10 + 18 + 20);
    // A group folded away takes its air with it.
    expect(rowWidth(row, new Set(['c']), new Set(), METRICS)).toBe(12 + 22);
    expect(rowWidth(row, new Set(['a', 'b']), new Set(), METRICS)).toBe(12 + 20);
  });

  it('keeps the whole row when it fits', () => {
    const result = fold(2000);
    expect(result.folded).toEqual([]);
    expect(result.bare.size).toBe(0);
    expect(result.fits).toBe(true);
  });

  it('has no label steps: nothing is ever bare, items fold first', () => {
    expect(FOLD_STEPS.some((step) => step.kind === 'label')).toBe(false);
    const full = fold(2000).width;
    const result = fold(full - 1);
    expect(result.bare.size).toBe(0);
    expect(result.folded).toEqual(['stamp']);
  });

  it('puts Done last and keeps Select with the Draw tools in one run', () => {
    expect(PALETTE_ITEMS.at(-1)).toBe('done');
    expect(PALETTE_ITEMS.slice(0, 6)).toEqual([
      'select',
      'pens',
      'highlighter',
      'eraser',
      'lasso',
      'text-box',
    ]);
    expect(ITEM_GROUP.select).toBe(ITEM_GROUP.lasso);
    expect(PALETTE_ITEMS.indexOf('text-box')).toBeLessThan(PALETTE_ITEMS.indexOf('shapes'));
  });

  it("folds in flows' order: Stamp, Image, Add field, outlines, Redact, Edit text, then the chips", () => {
    const full = fold(2000).width;
    expect(fold(full - 1).folded).toEqual(['stamp']);
    expect(fold(full - 47).folded).toEqual(['image', 'stamp']);
    const result = fold(full - 400);
    expect(result.folded).toEqual(
      expect.arrayContaining(['stamp', 'image', 'add-field', 'outlines', 'redact', 'edit-text']),
    );
    // The chips go before Sign folds (03.7: they move to the strip's row).
    expect(result.folded).toContain('chips');
    expect(result.visible).toContain('sign');
  });

  it('the ladder for narrow windows: Eraser, then the Highlighter, then Text box (03.9)', () => {
    const result = fold(380, ['chips', 'stepper']);
    expect(result.visible).toEqual(['select', 'pens', 'more', 'done']);
    expect(result.fits).toBe(true);
    // Wider: the Highlighter stays, the eraser is gone.
    const wider = fold(520, ['chips', 'stepper']);
    expect(wider.visible).toContain('highlighter');
    expect(wider.visible).not.toContain('eraser');
  });

  it('never folds Done, Select, the pens or +', () => {
    const result = fold(0);
    expect(result.visible).toEqual(['select', 'pens', 'more', 'done']);
    expect(result.fits).toBe(false);
  });

  it('a wider measured item folds sooner, by measurement', () => {
    const wide: FoldItem[] = items().map((item) =>
      item.id === 'chips' ? { ...item, width: 200 } : item,
    );
    const available = fold(2000).width;
    expect(fold(available).folded).toEqual([]);
    expect(foldPalette(wide, FOLD_STEPS, available, METRICS).folded).not.toEqual([]);
  });
});
