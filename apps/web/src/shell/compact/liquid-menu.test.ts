/** The split top's menus out of their button (DSN-39, MOT-13, `liquid-menu.ts`): where they grow from. */
import { describe, expect, it } from 'vitest';

import { growOrigin, startScale } from './liquid-menu';

const button = { x: 334, y: 12, width: 44, height: 44 };
const menu = { x: 146, y: 12, width: 232, height: 300 };

describe('the menu out of its button', () => {
  it('starts about the size of its button', () => {
    // 44 / 232 = 0.19 across, 44 / 300 down: the larger, kept at least 0.2.
    expect(startScale(button, menu)).toBe(0.2);
    const wide = { x: 0, y: 0, width: 120, height: 100 };
    expect(startScale(button, wide)).toBeCloseTo(44 / 100);
    expect(startScale(button, { x: 0, y: 0, width: 40, height: 40 })).toBe(1);
  });

  it('grows from the point over its button, inside its own box', () => {
    expect(growOrigin(button, menu)).toEqual([210, 22]);
    // A button past the menu's edge: the origin stays on the edge.
    expect(growOrigin({ x: 400, y: -30, width: 44, height: 44 }, menu)).toEqual([232, 0]);
  });
});
