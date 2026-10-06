/**
 * The Pages grid's pure rules (`components/06-navigation.md` PG1–PG6, `04-context` §10,
 * `07-sheets` S15–S16; spec D2-5): pinch detents, the Pages bar's shedding, the capsule's shape,
 * the sections each scope shows, centred columns, the grid's per-device choices, Extract's
 * prefilled ranges and Combine's starting order.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import { computeLayout, GRID, gridMetrics } from '../../dnd/geometry';
import { initialCombineOrder } from '../../pages-sheets/CombineSheet';
import { rangesText } from '../../pages-sheets/ExtractSheet';
import { capsuleShape } from '../../shell/capsule/capsule-content';
import {
  DEFAULT_GRID,
  DEFAULT_LAYOUT,
  parseGridPrefs,
  parseLayout,
  toStoredLayout,
} from '../../state/ui-store';
import { pagesBarFold } from './PagesBar';
import { GRID_PINCH_OPEN, GRID_PINCH_STEP, pinchGridSize } from './pinch-in-grid';

const a = 'doc-a' as DocumentId;
const b = 'doc-b' as DocumentId;
const c = 'doc-c' as DocumentId;

describe('pinch in the grid (PG1 §6)', () => {
  it('steps one size per ×1.4 of scale, both ways, and stops at the ends', () => {
    expect(pinchGridSize(1, 1)).toEqual({ size: 1, opens: false });
    expect(pinchGridSize(1, GRID_PINCH_STEP * 0.99).size).toBe(1);
    expect(pinchGridSize(1, GRID_PINCH_STEP).size).toBe(2);
    expect(pinchGridSize(1, GRID_PINCH_STEP ** 2).size).toBe(3);
    expect(pinchGridSize(1, 1 / GRID_PINCH_STEP).size).toBe(0);
    expect(pinchGridSize(1, 0.1).size).toBe(0);
    expect(pinchGridSize(3, 50).size).toBe(4);
  });

  it('opens the page only past the largest size by a further 15 %', () => {
    // From Medium, Largest is three steps out.
    const largest = GRID_PINCH_STEP ** 3;
    expect(pinchGridSize(1, largest)).toEqual({ size: 4, opens: false });
    expect(pinchGridSize(1, largest * GRID_PINCH_OPEN).opens).toBe(true);
    expect(pinchGridSize(4, GRID_PINCH_OPEN * 0.99).opens).toBe(false);
    expect(pinchGridSize(4, GRID_PINCH_OPEN).opens).toBe(true);
    expect(pinchGridSize(4, 0.5).opens).toBe(false);
  });

  it('treats a broken scale as no change', () => {
    expect(pinchGridSize(2, Number.NaN)).toEqual({ size: 2, opens: false });
    expect(pinchGridSize(2, 0)).toEqual({ size: 2, opens: false });
  });
});

describe('the Pages bar sheds by the room it has (04-context §2.2, §10)', () => {
  it('keeps everything, then folds Duplicate and Move to, then Extract', () => {
    expect(pagesBarFold(1200, false)).toBe('full');
    expect(pagesBarFold(700, false)).toBe('mid');
    expect(pagesBarFold(500, false)).toBe('tight');
    // Coarse pointers' 44 px items need more room for the same form.
    expect(pagesBarFold(900, true)).toBe('mid');
    expect(pagesBarFold(788, true)).toBe('tight');
    expect(pagesBarFold(Number.POSITIVE_INFINITY, true)).toBe('full');
  });
});

describe('the capsule shows the Pages bar (X21)', () => {
  it('in the grid, whatever Markup and Lock say', () => {
    expect(capsuleShape({ markup: false, lock: undefined, grid: true, pages: true })).toBe('pages');
    expect(capsuleShape({ markup: true, lock: undefined, grid: true, pages: true })).toBe('pages');
    expect(capsuleShape({ markup: false, lock: 'user', grid: true, pages: true })).toBe('pages');
  });

  it('in viewing for a sidebar selection, but never over the open palette', () => {
    expect(capsuleShape({ markup: false, lock: undefined, pages: true })).toBe('pages');
    expect(capsuleShape({ markup: true, lock: undefined, pages: true })).toBe('palette');
    expect(capsuleShape({ markup: false, lock: 'signed', pages: true })).toBe('pages');
    expect(capsuleShape({ markup: false, lock: 'signed' })).toBe('locked');
    expect(capsuleShape({ markup: false, lock: undefined })).toBe('dock');
  });
});

describe('centred columns (PG1 §2)', () => {
  it('shares what the columns leave between both sides, never less than the gutter', () => {
    const left = gridMetrics(1440, 144);
    const centred = gridMetrics(1440, 144, { centre: true });
    expect(centred.columns).toBe(left.columns);
    expect(left.padX).toBe(GRID.padX);
    const used = centred.columns * 144 + (centred.columns - 1) * GRID.gapX;
    expect(centred.padX).toBe(Math.floor((1440 - used) / 2));
    expect(gridMetrics(150, 144, { centre: true }).padX).toBe(GRID.padX);
  });

  it('lays out a section without a header (This document) from its first row', () => {
    const metrics = gridMetrics(1000, 144);
    const layout = computeLayout(
      [{ id: a, count: 3, collapsed: false, header: false }],
      metrics,
      40,
      24,
    );
    const section = layout.sections[0];
    expect(section?.top).toBe(24);
    expect(section?.gridTop).toBe(24);
    expect(layout.totalHeight).toBe((section?.bottom ?? 0) + 40);
  });
});

describe("the grid's choices per device (PG2)", () => {
  it('stores scope and size only when they differ from the defaults', () => {
    expect(toStoredLayout(DEFAULT_LAYOUT).grid).toBeUndefined();
    expect(toStoredLayout({ ...DEFAULT_LAYOUT, ...DEFAULT_GRID_PREFS }).grid).toBeUndefined();
    const stored = toStoredLayout({ ...DEFAULT_LAYOUT, gridScope: 'all', arrangeSize: 3 });
    expect(stored.grid).toEqual({ scope: 'all', size: 3 });
    expect(parseGridPrefs(stored)).toEqual({ gridScope: 'all', arrangeSize: 3 });
    // The rest of the layout reads as before.
    expect(parseLayout(stored)).toEqual(DEFAULT_LAYOUT);
  });

  it('reads anything unexpected as the defaults, field by field', () => {
    expect(parseGridPrefs(undefined)).toEqual({ gridScope: 'document', arrangeSize: 1 });
    expect(parseGridPrefs({ grid: { scope: 'every', size: 9 } })).toEqual({
      gridScope: 'document',
      arrangeSize: 4,
    });
    expect(parseGridPrefs({ grid: { scope: 'all', size: 1.5 } })).toEqual({
      gridScope: 'all',
      arrangeSize: 1,
    });
  });
});

const DEFAULT_GRID_PREFS = { gridScope: DEFAULT_GRID.scope, arrangeSize: DEFAULT_GRID.size };

describe('Extract prefills its pages (S16)', () => {
  it('joins runs with a hyphen, in page order, 1-based', () => {
    expect(rangesText([])).toBe('');
    expect(rangesText([2])).toBe('3');
    expect(rangesText([4, 2, 5, 6])).toBe('3, 5-7');
    expect(rangesText([0, 1, 2, 9])).toBe('1-3, 10');
    expect(rangesText([3, 3, 4])).toBe('4-5');
  });
});

describe("Combine's starting order (S15)", () => {
  it('starts from the active document, every document checked', () => {
    expect(initialCombineOrder([a, b, c], b, undefined)).toEqual({
      order: [b, a, c],
      checked: [a, b, c],
    });
  });

  it('starts from the Library’s choice, only those checked', () => {
    expect(initialCombineOrder([a, b, c], a, [c, a])).toEqual({
      order: [c, a, b],
      checked: [c, a],
    });
  });
});
