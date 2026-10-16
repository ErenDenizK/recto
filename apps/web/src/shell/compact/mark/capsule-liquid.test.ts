/**
 * The capsule and ✎ as one liquid body (`capsule-liquid.ts`, DSN-43): ✎'s shrinking drop, the
 * neck that follows its fold, and a run that leaves nothing at rest.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { DOCK_NECK, dropShape, fuseDock, neckFor } from './capsule-liquid';

const frames = (count: number) =>
  new Promise<void>((resolve) => {
    let left = count;
    const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });

let dock: HTMLElement | null = null;

afterEach(() => {
  dock?.remove();
  dock = null;
});

describe('the capsule and ✎ as one body (DSN-43)', () => {
  it('folds ✎ as a drop centred in its box', () => {
    expect(dropShape({ x: 10, y: 0, width: 56, height: 56 })).toEqual({
      x: 10,
      y: 0,
      width: 56,
      height: 56,
      radius: 28,
    });
    // Half folded: a 28 px circle in the middle of its 28 px wide box.
    expect(dropShape({ x: 10, y: 0, width: 28, height: 56 })).toEqual({
      x: 10,
      y: 14,
      width: 28,
      height: 28,
      radius: 14,
    });
    expect(dropShape({ x: 10, y: 0, width: 0, height: 56 }).width).toBe(0);
  });

  it('has no neck with ✎ at rest and the whole neck once it is a quarter folded', () => {
    expect(neckFor(56, 56)).toBe(0);
    expect(neckFor(49, 56)).toBeCloseTo(DOCK_NECK / 2);
    expect(neckFor(42, 56)).toBe(DOCK_NECK);
    expect(neckFor(0, 56)).toBe(DOCK_NECK);
  });

  it('masks one glass layer to the union while ✎ moves, and leaves nothing at rest', async () => {
    dock = document.createElement('div');
    dock.style.cssText = 'position:fixed;left:0;right:0;bottom:12px;display:flex;gap:8px;';
    const capsule = document.createElement('nav');
    capsule.style.cssText = 'width:200px;height:56px;border-radius:28px;';
    const edit = document.createElement('button');
    edit.dataset.testid = 'compact-edit';
    edit.style.cssText = 'width:56px;height:56px;transition:width 200ms linear;';
    dock.append(capsule, edit);
    document.body.append(dock);
    edit.getBoundingClientRect();
    edit.style.width = '0px';
    fuseDock(capsule);
    const layer = dock.querySelector<HTMLElement>('[data-testid="compact-dock-liquid"]');
    expect(layer).not.toBeNull();
    expect(capsule.hasAttribute('data-liquid')).toBe(true);
    expect(edit.hasAttribute('data-liquid')).toBe(true);
    expect(layer?.className).toBe('mat mat-bar s10');
    await frames(3);
    expect(layer?.style.maskImage.startsWith('url("data:image/svg+xml,')).toBe(true);
    // Its box spans the pair.
    expect(Number.parseFloat(layer?.style.width ?? '0')).toBeGreaterThan(200);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await frames(3);
    expect(dock.querySelector('[data-testid="compact-dock-liquid"]')).toBeNull();
    expect(capsule.hasAttribute('data-liquid')).toBe(false);
    expect(edit.hasAttribute('data-liquid')).toBe(false);
  });
});
