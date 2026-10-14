import { describe, expect, it } from 'vitest';

import {
  affineCss,
  fitOnto,
  IDENTITY,
  lerpAffine,
  lerpBox,
  project,
  sample,
} from './morph-geometry';
import {
  columnsFor,
  type GridFrame,
  gridLayout,
  maxScroll,
  pageAtPoint,
  rowsInView,
  scrollToCentre,
  slotBox,
  TILE_GAP,
  tileBox,
} from './overview-layout';

const PHONE: GridFrame = {
  width: 390,
  height: 844,
  insetLeft: 0,
  insetRight: 0,
  padTop: 20,
  padBottom: 96,
};
const LETTER = { width: 612, height: 792 };
const LANDSCAPE = { width: 792, height: 612 };

describe('the overview grid (MOB-2)', () => {
  it('fills the width in 2, 3 or 4 columns with 12 px gaps and margins', () => {
    for (const columns of [2, 3, 4]) {
      const layout = gridLayout(12, PHONE, columns);
      const first = slotBox(layout, 0);
      const last = slotBox(layout, columns - 1);
      expect(first.left).toBe(12);
      expect(last.left + last.width).toBeCloseTo(390 - 12, 6);
      expect(slotBox(layout, 1).left - (first.left + first.width)).toBeCloseTo(TILE_GAP, 6);
      // Hit targets stay at least 44 px at the densest step (Q-9).
      expect(first.width).toBeGreaterThan(44);
    }
    expect(slotBox(gridLayout(12, PHONE, 3), 0).width).toBe(114);
  });

  it('names the detents for a phone upright and keeps the tiles’ size on its side', () => {
    expect([2, 3, 4].map((d) => columnsFor(d, 390))).toEqual([2, 3, 4]);
    expect([2, 3, 4].map((d) => columnsFor(d, 320))).toEqual([2, 3, 4]);
    expect([2, 3, 4].map((d) => columnsFor(d, 844))).toEqual([4, 6, 9]);
  });

  it('keeps the safe area at the sides', () => {
    const layout = gridLayout(4, { ...PHONE, width: 844, insetLeft: 47, insetRight: 47 }, 3);
    expect(slotBox(layout, 0).left).toBe(47);
  });

  it('fits each page in its slot, centred across and on the slot’s foot', () => {
    const layout = gridLayout(6, PHONE, 3);
    const slot = slotBox(layout, 4);
    const portrait = tileBox(layout, 4, LETTER);
    expect(portrait.width).toBe(Math.round(slot.width));
    expect(portrait.top + portrait.height).toBe(slot.top + slot.height);
    const wide = tileBox(layout, 4, LANDSCAPE);
    expect(wide.width).toBe(Math.round(slot.width));
    expect(wide.height).toBeLessThan(slot.height);
    expect(wide.top + wide.height).toBe(slot.top + slot.height);
    // The page keeps its aspect (within the rounding).
    expect(wide.width / wide.height).toBeCloseTo(792 / 612, 1);
  });

  it('mounts only the rows near the viewport', () => {
    const layout = gridLayout(400, PHONE, 3);
    const rows = rowsInView(layout, 0, 844, 844);
    expect(rows.first).toBe(0);
    expect(rows.last).toBeLessThan(20);
    const deep = rowsInView(layout, 50 * layout.rowHeight, 844, 844);
    expect(deep.first).toBeGreaterThan(40);
    expect(deep.last - deep.first).toBeLessThan(20);
    expect(rowsInView(gridLayout(0, PHONE, 3), 0, 844)).toEqual({ first: 0, last: -1 });
  });

  it('scrolls a tile’s middle to a height, as far as the content allows', () => {
    const layout = gridLayout(400, PHONE, 3);
    const top = scrollToCentre(layout, 150, 300, 844);
    const slot = slotBox(layout, 150);
    expect(slot.top + slot.height / 2 - top).toBeCloseTo(300, 6);
    expect(scrollToCentre(layout, 0, 300, 844)).toBe(0);
    expect(scrollToCentre(layout, 399, 100, 844)).toBe(maxScroll(layout, 844));
  });

  it('finds the page under a point, the gaps included', () => {
    const layout = gridLayout(10, PHONE, 3);
    const slot = slotBox(layout, 4);
    expect(pageAtPoint(layout, slot.left + 10, slot.top + 10)).toBe(4);
    expect(pageAtPoint(layout, slot.left - TILE_GAP / 2 + 1, slot.top)).toBe(4);
    expect(pageAtPoint(layout, 389, 99_999)).toBe(9);
    expect(pageAtPoint(layout, 0, 0)).toBe(0);
  });
});

describe('the morph keeps the page and its tile one (MOB-2)', () => {
  const reader = { left: 8, top: 120, width: 374, height: 484 };
  const tile = { left: 101, top: 400, width: 187, height: 242 };
  const planeOrigin = { x: 0, y: -260 };
  const stageOrigin = { x: 0, y: -900 };
  const page = { left: 8, top: 1020, width: 374, height: 484 };

  it('starts the grid scaled so the tile lies on the page, and rests untransformed', () => {
    const from = fitOnto(tile, planeOrigin, project(IDENTITY, stageOrigin, page));
    const start = project(from, planeOrigin, tile);
    expect(start.left).toBeCloseTo(reader.left, 6);
    expect(start.top).toBeCloseTo(reader.top, 6);
    expect(start.width).toBeCloseTo(reader.width, 6);
    expect(start.height).toBeCloseTo(reader.height, 6);
  });

  it('moves both layers so the anchor lies on the same box at every progress', () => {
    const pageOnScreen = project(IDENTITY, stageOrigin, page);
    const tileOnScreen = project(IDENTITY, planeOrigin, tile);
    const planeFrom = fitOnto(tile, planeOrigin, pageOnScreen);
    const stageTo = fitOnto(page, stageOrigin, tileOnScreen);
    for (const p of [0, 0.27, 0.5, 0.8, 1, 1.06]) {
      const viaGrid = project(lerpAffine(planeFrom, IDENTITY, p), planeOrigin, tile);
      const viaReader = project(lerpAffine(IDENTITY, stageTo, p), stageOrigin, page);
      const expected = lerpBox(pageOnScreen, tileOnScreen, p);
      for (const box of [viaGrid, viaReader]) {
        expect(Math.abs(box.left - expected.left)).toBeLessThan(1);
        expect(Math.abs(box.top - expected.top)).toBeLessThan(1);
        expect(Math.abs(box.width - expected.width)).toBeLessThan(1);
      }
    }
    // At rest the grid carries nothing (Q-2).
    expect(affineCss(lerpAffine(planeFrom, IDENTITY, 1))).toBe('translate(0px, 0px) scale(1)');
  });

  it('samples a move between two progresses for the effect’s easing', () => {
    const frames = sample((p) => p * 2, 0.25, 1, 3);
    expect(frames.map((f) => f.offset)).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect(frames[0]?.value).toBeCloseTo(0.5, 9);
    expect(frames[3]?.value).toBeCloseTo(2, 9);
  });
});
