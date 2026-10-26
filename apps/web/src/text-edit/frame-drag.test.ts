import { layoutParagraph, decideOverflow } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import type { PageFrame } from '../viewer/geometry';
import {
  clampMove,
  cropOf,
  frameChangeOf,
  frameChanged,
  initialFrame,
  moveBy,
  nudgeOf,
  pastSlop,
  snapTo,
  textDelta,
  userDelta,
  widthBy,
} from './frame-drag';
import { cssFromUser } from './glyph-canvas';
import { initialState, relayout } from './paragraph-model';
import { paragraph } from './paragraph-fixtures';

const upright: PageFrame = {
  size: { width: 612, height: 792 },
  originX: 0,
  originY: 0,
  rotation: 0,
  scale: 2,
};
/** /Rotate 90: user x runs down the screen, user y runs right. */
const turned: PageFrame = { ...upright, size: { width: 792, height: 612 }, rotation: 90 };

describe('frame drag (TXT-24)', () => {
  it('becomes a drag only past the slop, more for a finger than a mouse', () => {
    expect(pastSlop(3, 0, 'mouse')).toBe(false);
    expect(pastSlop(4, 0, 'mouse')).toBe(true);
    expect(pastSlop(5, 5, 'touch')).toBe(false);
    expect(pastSlop(6, 6, 'touch')).toBe(true);
  });

  it('turns a screen vector into the page’s user space, on a turned page too', () => {
    expect(userDelta(upright, 20, 10)).toEqual({ dx: 10, dy: -5 });
    // Rotated 90° clockwise: a step right on the screen is up the page's y... and down is +x.
    const down = userDelta(turned, 0, 20);
    const right = userDelta(turned, 20, 0);
    expect(Math.hypot(down.dx, down.dy)).toBeCloseTo(10);
    expect(Math.hypot(right.dx, right.dy)).toBeCloseTo(10);
    expect(Math.abs(down.dx) > Math.abs(down.dy)).toBe(true);
    expect(Math.abs(right.dy) > Math.abs(right.dx)).toBe(true);
  });

  it('keeps the paragraph inside the CropBox', () => {
    const box = { x: 100, y: 100, width: 200, height: 50 };
    const crop = cropOf(upright);
    expect(clampMove(box, crop, { dx: -500, dy: 900 })).toEqual({ dx: -100, dy: 642 });
    expect(clampMove(box, crop, { dx: 5, dy: -5 })).toEqual({ dx: 5, dy: -5 });
  });

  it('snaps the left edge within 4 CSS px, unless Alt is held', () => {
    expect(snapTo(104, [100, 300], false)).toBe(100);
    expect(snapTo(105, [100, 300], false)).toBeUndefined();
    expect(snapTo(104, [100], true)).toBeUndefined();
  });

  it('moves with the pointer, snaps to another column and names the guide', () => {
    const box = { x: 100, y: 500, width: 200, height: 50 };
    const base = { dx: 0, dy: 0 };
    const start = { x: 400, y: 400 };
    // 200 CSS px left edge; the pointer goes 66 px right: 266, 2 px from the anchor at 268.
    const snapped = moveBy({
      frame: upright,
      box,
      base,
      start,
      now: { x: 466, y: 400 },
      anchors: [200, 268],
      alt: false,
    });
    expect(snapped.guide).toBe(268);
    expect(snapped.dx * upright.scale).toBeCloseTo(68);
    const free = moveBy({
      frame: upright,
      box,
      base,
      start,
      now: { x: 466, y: 400 },
      anchors: [200, 268],
      alt: true,
    });
    expect(free.guide).toBeUndefined();
    expect(free.dx * upright.scale).toBeCloseTo(66);
  });

  it('adds to the move it began from and never leaves the page', () => {
    const box = { x: 100, y: 100, width: 200, height: 50 };
    const moved = moveBy({
      frame: upright,
      box,
      base: { dx: 400, dy: 0 },
      start: { x: 0, y: 0 },
      now: { x: 1000, y: 0 },
      anchors: [],
      alt: false,
    });
    expect(moved.dx).toBe(312);
  });

  it('keeps a side bar to the room beside the paragraph and to four font sizes', () => {
    const original = { left: 72, right: 312 };
    const room = { roomLeft: 20, roomRight: 30, size: 10 };
    expect(widthBy({ side: 'right', base: original, original, along: 100, ...room }).right).toBe(
      342,
    );
    expect(widthBy({ side: 'left', base: original, original, along: -100, ...room }).left).toBe(52);
    expect(widthBy({ side: 'right', base: original, original, along: -1000, ...room }).right).toBe(
      112,
    );
    expect(widthBy({ side: 'left', base: original, original, along: 1000, ...room }).left).toBe(
      272,
    );
  });

  it('reads a CSS vector along the writing direction', () => {
    const cssOfText = cssFromUser(upright);
    expect(textDelta(cssOfText, 20, 0).dx).toBeCloseTo(10);
  });

  it('sends the measure only when the width changed', () => {
    const block = { measure: { left: 72, right: 312 } };
    const still = { ...initialFrame(block), dx: 3, dy: -2 };
    expect(frameChanged(initialFrame(block), block)).toBe(false);
    expect(frameChangeOf(still, block)).toEqual({ dx: 3, dy: -2 });
    expect(frameChangeOf({ ...still, right: 250 }, block)).toEqual({
      dx: 3,
      dy: -2,
      measure: { left: 72, right: 250 },
    });
  });

  it('nudges 1 pt, or 10 pt with Shift, in the screen’s direction', () => {
    expect(nudgeOf(upright, 'ArrowRight', false)).toEqual({ dx: 1, dy: 0 });
    expect(nudgeOf(upright, 'ArrowUp', true)).toEqual({ dx: 0, dy: 10 });
    const down = nudgeOf(turned, 'ArrowDown', false);
    expect(Math.hypot(down?.dx ?? 0, down?.dy ?? 0)).toBeCloseTo(1);
    expect(Math.abs(down?.dx ?? 0)).toBeCloseTo(1);
    expect(nudgeOf(upright, 'a', false)).toBeNull();
  });
});

describe('a width the side bars asked for (TXT-24)', () => {
  const fns = { layoutParagraph, decideOverflow };
  const lines = ['aaaa bbbb cccc dddd', 'eeee ffff gggg hhhh'];

  it('lays the whole paragraph out again in the new measure', () => {
    const setup = paragraph(lines, { width: 20 * 6 });
    const state = initialState(setup.input, 0);
    const same = relayout(fns, setup, state);
    expect(same.layout.lines.map((l) => l.status)).toEqual(['kept', 'kept']);
    const narrow = relayout(fns, setup, state, { left: 72, right: 72 + 10 * 6 });
    expect(narrow.layout.lines.length).toBeGreaterThan(2);
    expect(narrow.layout.lines.every((l) => l.status === 'rewritten')).toBe(true);
  });
});
