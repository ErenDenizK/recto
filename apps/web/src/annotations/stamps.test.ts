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

  it.each([
    // The dragged width runs along user x (0°, 180°) or user y (90°, 270°); the stamp sits at
    // the viewer's top of the box: user top on 0°, user bottom on 180°, left on 90°, right on 270°.
    [0, { x: 100, y: 160, width: 90, height: 30 }],
    [90, { x: 100, y: 100, width: 30, height: 90 }],
    [180, { x: 100, y: 100, width: 90, height: 30 }],
    [270, { x: 160, y: 100, width: 30, height: 90 }],
  ] as const)(
    'takes the width the viewer dragged, at the box top as seen, on %i°',
    (rotation, rect) => {
      const drag = { x: 100, y: 100, width: 90, height: 90 };
      expect(placedStampRect(natural, rotation, { drag })).toEqual(rect);
    },
  );
});
