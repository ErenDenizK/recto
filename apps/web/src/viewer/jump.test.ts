import { afterEach, describe, expect, it } from 'vitest';

import {
  cancelJump,
  isFarJump,
  isJumping,
  jumpAt,
  jumpDuration,
  jumpScroll,
  MAX_JUMP_MS,
  MIN_JUMP_MS,
  whenJumpsLanded,
} from './jump';

describe('jump timing (motion-2026-10 viewer.md §1)', () => {
  it('grows with the distance and caps at 450 ms', () => {
    expect(jumpDuration(0, 800)).toBe(MIN_JUMP_MS);
    expect(jumpDuration(800, 800)).toBeCloseTo(325);
    expect(jumpDuration(400, 800)).toBeLessThan(jumpDuration(800, 800));
    expect(jumpDuration(100_000, 800)).toBe(MAX_JUMP_MS);
  });

  it('fades through beyond three screens', () => {
    expect(isFarJump(2400, 800)).toBe(false);
    expect(isFarJump(-2401, 800)).toBe(true);
  });

  it('eases out from its start to its end, and carries a start velocity', () => {
    expect(jumpAt(0, 100, 0, 0)).toBe(0);
    expect(jumpAt(0, 100, 0, 1)).toBe(100);
    // Ease-out: past the middle by half time.
    expect(jumpAt(0, 100, 0, 0.5)).toBeCloseTo(87.5);
    // A start velocity against the move turns smoothly instead of jumping.
    expect(jumpAt(0, 100, -400, 0.02)).toBeLessThan(0);
    expect(jumpAt(0, 100, -400, 1)).toBe(100);
  });
});

describe('jumpScroll', () => {
  let el: HTMLElement | null = null;
  afterEach(() => {
    if (el) cancelJump(el);
    el?.remove();
    el = null;
    document.documentElement.removeAttribute('data-motion');
  });

  const scroller = () => {
    const box = document.createElement('div');
    box.style.cssText = 'height: 400px; width: 200px; overflow: auto';
    const content = document.createElement('div');
    content.style.height = '20000px';
    box.append(content);
    document.body.append(box);
    el = box;
    return box;
  };

  it('lands on the target and leaves nothing running', async () => {
    const box = scroller();
    const landed = jumpScroll(box, { top: 600, left: 0 });
    expect(isJumping(box)).toBe(true);
    await expect(landed).resolves.toBe(true);
    expect(box.scrollTop).toBe(600);
    expect(isJumping(box)).toBe(false);
    await whenJumpsLanded();
  });

  it('fades the layer through a far jump and lands on the target', async () => {
    const box = scroller();
    const layer = box.firstElementChild as HTMLElement;
    const landed = jumpScroll(box, { top: 9000, left: 0 }, { layer });
    expect(layer.getAnimations().length).toBe(1);
    await expect(landed).resolves.toBe(true);
    expect(box.scrollTop).toBe(9000);
  });

  it('is cancelled where it is', async () => {
    const box = scroller();
    const landed = jumpScroll(box, { top: 1000, left: 0 });
    cancelJump(box);
    await expect(landed).resolves.toBe(false);
    expect(box.scrollTop).toBeLessThan(1000);
  });

  it('lands at once under reduced motion', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const box = scroller();
    await expect(jumpScroll(box, { top: 700, left: 0 })).resolves.toBe(true);
    expect(box.scrollTop).toBe(700);
    expect(isJumping(box)).toBe(false);
  });
});
