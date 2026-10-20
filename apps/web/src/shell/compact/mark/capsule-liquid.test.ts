/**
 * The capsule and ✎ as one body on the compositor (`capsule-liquid.ts`, DSN-43, MOT-14): the
 * parts that draw the capsule's shape without distorting it, ✎'s drop, and a run that moves
 * only transforms and leaves nothing at rest.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { settled } from '../../../../test/settled';
import { capsuleParts, DROP_SCALE, dropPart, fuseDock } from './capsule-liquid';

let dock: HTMLElement | null = null;

afterEach(() => {
  dock?.remove();
  dock = null;
});

describe('the capsule and ✎ as one body (DSN-43, MOT-14)', () => {
  it('draws the capsule as two round ends that translate and a middle that scales along x', () => {
    const from = { x: 100, y: 0, width: 200, height: 56 };
    const to = { x: 40, y: 0, width: 300, height: 56 };
    const [lead, trail, middle] = capsuleParts(from, to);
    // The ends are circles at the new box's ends, starting at the old ones.
    expect(lead).toEqual({
      box: { x: 40, y: 0, width: 56, height: 56 },
      radius: 28,
      from: [60, 0, 1, 1],
    });
    expect(trail?.box.x).toBe(284);
    expect(trail?.from).toEqual([-40, 0, 1, 1]);
    // The middle spans the ends' centres, square-cornered, from the old span's width.
    expect(middle?.box).toEqual({ x: 68, y: 0, width: 244, height: 56 });
    expect(middle?.radius).toBe(0);
    expect(middle?.fromLeft).toBe(true);
    expect(middle?.from[0]).toBe(60);
    expect(middle?.from[2]).toBeCloseTo(144 / 244);
  });

  it('carries ✎ as a drop into the capsule’s trailing end', () => {
    const edit = { x: 308, y: 0, width: 56, height: 56 };
    const end = { x: 244, y: 0, width: 56, height: 56 };
    expect(dropPart(edit, end)).toEqual({ box: edit, at: [-64, 0, DROP_SCALE, DROP_SCALE] });
  });

  it('moves a solid body under the pair by transforms alone, and leaves nothing at rest', async () => {
    dock = document.createElement('div');
    dock.style.cssText =
      'position:fixed;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:8px;';
    const capsule = document.createElement('nav');
    capsule.className = 'capsule mat mat-bar s10';
    capsule.style.cssText = 'width:200px;height:56px;border-radius:28px;';
    const edit = document.createElement('button');
    edit.dataset.testid = 'compact-edit';
    edit.style.cssText = 'width:56px;height:56px;';
    dock.append(capsule, edit);
    document.body.append(dock);
    const before = capsule.getBoundingClientRect();
    // Entering the island: ✎ steps out at once and the capsule widens.
    edit.setAttribute('data-away', '');
    edit.style.width = '0px';
    capsule.style.width = '300px';
    fuseDock(capsule, before);
    const layer = dock.querySelector<HTMLElement>('[data-testid="compact-dock-liquid"]');
    expect(layer).not.toBeNull();
    expect(capsule.hasAttribute('data-liquid')).toBe(true);
    expect(edit.hasAttribute('data-liquid')).toBe(true);
    const parts = [...(layer?.children ?? [])] as HTMLElement[];
    expect(parts).toHaveLength(4);
    for (const part of parts) {
      expect(part.className).toBe('mat mat-bar s10');
      // The solid twin while it moves (MOT-12).
      expect(part.hasAttribute('data-glass-moving')).toBe(true);
      // Only transforms animate: no layout, no mask, no clip.
      for (const animation of part.getAnimations()) {
        const keys = Object.keys((animation.effect as KeyframeEffect).getKeyframes()[0] ?? {});
        expect(
          keys.filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k)),
        ).toEqual(['transform']);
      }
    }
    // The run's own motion ends first; the layer is dropped on that end, a condition not a clock.
    const island = dock;
    await settled(island);
    await vi.waitFor(() => {
      expect(island.querySelector('[data-testid="compact-dock-liquid"]')).toBeNull();
      expect(capsule.hasAttribute('data-liquid')).toBe(false);
      expect(edit.hasAttribute('data-liquid')).toBe(false);
      expect(capsule.hasAttribute('data-glass-settle')).toBe(false);
    });
  });
});
