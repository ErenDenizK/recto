/** The liquid menu's choreography (DSN-39, `liquid-menu.ts`): the blob and the content's fade. */
import { describe, expect, it } from 'vitest';

import type { LiquidRect } from './liquid-mask';
import { blobAt, contentOpacity, LIQUID_OPEN_MS } from './liquid-menu';

const button: LiquidRect = { x: 334, y: 12, width: 44, height: 44, radius: 22 };
const menu: LiquidRect = { x: 146, y: 12, width: 232, height: 300, radius: 16 };
const OPEN = { stiffness: 144, damping: 14 };
const centre = (r: LiquidRect) => [r.x + r.width / 2, r.y + r.height / 2] as const;

describe('the liquid menu', () => {
  it('starts as the button and ends as the menu', () => {
    expect(blobAt(button, menu, 0, OPEN, LIQUID_OPEN_MS)).toEqual(button);
    const end = blobAt(button, menu, 2000, OPEN, LIQUID_OPEN_MS);
    expect(end.x).toBeCloseTo(menu.x, 0);
    expect(end.width).toBeCloseTo(menu.width);
    expect(end.radius).toBeCloseTo(menu.radius);
  });

  it('leaves the button before it grows, so a neck joins them', () => {
    const early = blobAt(button, menu, 90, OPEN, LIQUID_OPEN_MS);
    const [bx, by] = centre(button);
    const [ex, ey] = centre(early);
    expect(Math.hypot(ex - bx, ey - by)).toBeGreaterThan(40);
    expect(early.width).toBeLessThan(button.width * 2);
  });

  it('fades the content in after the blob has left, and out first', () => {
    expect(contentOpacity(true, 0)).toBe(0);
    expect(contentOpacity(true, LIQUID_OPEN_MS)).toBe(1);
    expect(contentOpacity(false, 0)).toBe(1);
    expect(contentOpacity(false, 150)).toBe(0);
  });
});
