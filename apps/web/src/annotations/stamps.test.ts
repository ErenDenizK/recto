import { describe, expect, it } from 'vitest';

import { placedStampRect } from './stamps';

describe('placedStampRect (DSN-81)', () => {
  const natural = { width: 120, height: 40 };

  it('centres a click at the natural size, sides swapped on a quarter turn', () => {
    const at = { x: 300, y: 400 };
    expect(placedStampRect(natural, 0, { at })).toEqual({ x: 240, y: 380, width: 120, height: 40 });
    expect(placedStampRect(natural, 180, { at })).toEqual({
      x: 240,
      y: 380,
      width: 120,
      height: 40,
    });
    expect(placedStampRect(natural, 90, { at })).toEqual({
      x: 280,
      y: 340,
      width: 40,
      height: 120,
    });
    expect(placedStampRect(natural, 270, { at })).toEqual({
      x: 280,
      y: 340,
      width: 40,
      height: 120,
    });
  });

  it('takes the width the viewer dragged, keeping the aspect', () => {
    const drag = { x: 100, y: 100, width: 90, height: 90 };
    // Unrotated: the dragged width runs along user x.
    expect(placedStampRect(natural, 0, { drag })).toEqual({
      x: 100,
      y: 160,
      width: 90,
      height: 30,
    });
    // A quarter turn: along user y, so the /Rect is 30 wide and 90 tall.
    expect(placedStampRect(natural, 90, { drag })).toEqual({
      x: 100,
      y: 100,
      width: 30,
      height: 90,
    });
  });
});
