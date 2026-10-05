/**
 * Pinch on synthetic pointer streams (05-canvas §4; research 18 §9; 09-primitives §31): the
 * slop before it claims, 1:1 scale and focal point, release velocity of log2(scale), lost
 * pointers, Safari's gesture events, and arbitration with long press and taps.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pointerStream } from '../../../test/pointer-stream';
import type { PointerLike } from './arena';
import { longPress } from './long-press';
import { type Point, pinch } from './pinch';
import { taps } from './taps';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.motion;
});

function setup() {
  const onStart = vi.fn<(origin: Point) => void>();
  const onChange = vi.fn<(scale: number, origin: Point) => void>();
  const onEnd = vi.fn<(scale: number, velocity: number, origin: Point) => void>();
  const s = pointerStream();
  const recogniser = pinch({ onStart, onChange, onEnd });
  s.arena.add(recogniser);
  return { s, onStart, onChange, onEnd, recogniser };
}

describe('pinch', () => {
  it('waits for the slop, then tracks scale 1:1 about the midpoint', () => {
    const { s, onStart, onChange, recogniser } = setup();
    s.down(1, 100, 300).down(2, 300, 300);
    s.move(2, 309, 300);
    expect(onStart).not.toHaveBeenCalled();
    s.move(2, 311, 300);
    expect(recogniser.active).toBe(true);
    expect(onStart).toHaveBeenCalledWith({ x: 200, y: 300 });
    // Scale from the span when the second finger landed (200 px): 211 / 200.
    expect(onChange).toHaveBeenLastCalledWith(1.055, { x: 205.5, y: 300 });
    s.move(1, 0, 300).move(2, 400, 300);
    expect(onChange).toHaveBeenLastCalledWith(2, { x: 200, y: 300 });
  });

  it('pans the focal point with both fingers at a constant span', () => {
    const { s, onChange } = setup();
    s.down(1, 100, 100).down(2, 200, 100).move(1, 100, 150).move(2, 200, 150);
    expect(onChange).toHaveBeenLastCalledWith(1, { x: 150, y: 150 });
  });

  it('hands the release velocity of log2(scale) per second, zero after a pause', () => {
    const flung = setup();
    flung.s.down(1, 0, 0).down(2, 100, 0);
    // Doubles in 160 ms, steadily in log space: 1 / 0.16 = 6.25 per second.
    for (let i = 1; i <= 10; i++) flung.s.wait(16).move(2, 100 * 2 ** (i / 10), 0);
    flung.s.up(2);
    const [scale, velocity] = flung.onEnd.mock.calls[0] ?? [];
    expect(scale).toBeCloseTo(2, 6);
    expect(velocity).toBeCloseTo(6.25, 1);

    const held = setup();
    held.s.down(1, 0, 0).down(2, 100, 0).wait(16).move(2, 150, 0).wait(16).move(2, 200, 0);
    held.s.wait(80).up(1);
    expect(held.onEnd.mock.calls[0]?.[1]).toBe(0);
  });

  it('ends when either finger lifts or is lost, and a two-finger tap is no pinch', () => {
    const lost = setup();
    lost.s.down(1, 0, 0).down(2, 100, 0).move(2, 150, 0).cancel(1);
    expect(lost.onEnd).toHaveBeenCalledOnce();
    expect(lost.onEnd.mock.calls[0]?.[0]).toBe(1.5);
    lost.s.move(2, 300, 0).up(2);
    expect(lost.onEnd).toHaveBeenCalledOnce();

    const tapped = setup();
    tapped.s.down(1, 0, 0).down(2, 100, 0).up(1).up(2);
    expect(tapped.onStart).not.toHaveBeenCalled();
    expect(tapped.onEnd).not.toHaveBeenCalled();
  });

  it('ignores a third finger, pens and mice', () => {
    const { s, onChange, onStart } = setup();
    s.down(1, 0, 0, 'pen').down(2, 100, 0, 'touch').move(2, 200, 0);
    s.down(3, 0, 0, 'mouse').move(3, 50, 50);
    expect(onStart).not.toHaveBeenCalled();
    s.up(1).up(3).up(2);

    s.down(4, 0, 0).down(5, 100, 0).down(6, 50, 50).move(6, 90, 90);
    expect(onStart).not.toHaveBeenCalled();
    s.move(5, 200, 0);
    expect(onChange).toHaveBeenLastCalledWith(2, { x: 100, y: 0 });
  });

  it('cancels a pending long press and taps by its claim', () => {
    const { s } = setup();
    const onFire = vi.fn<(e: PointerLike) => void>();
    const onTap = vi.fn<(e: PointerLike) => void>();
    s.arena.add(longPress({ onFire }));
    s.arena.add(taps({ onTap }));
    s.down(1, 0, 0).wait(100).down(2, 100, 0).move(2, 160, 0).wait(500);
    s.up(2).up(1);
    expect(onFire).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it('drives the same callbacks from Safari gesture events', () => {
    const { recogniser, onStart, onChange, onEnd } = setup();
    recogniser.external('change', 3, { x: 0, y: 0 }, 0);
    expect(onChange).not.toHaveBeenCalled();
    recogniser.external('start', 1, { x: 10, y: 20 }, 1000);
    recogniser.external('change', 1.5, { x: 10, y: 20 }, 1016);
    recogniser.external('end', 1.5, { x: 10, y: 20 }, 1020);
    expect(onStart).toHaveBeenCalledWith({ x: 10, y: 20 });
    expect(onChange).toHaveBeenCalledWith(1.5, { x: 10, y: 20 });
    expect(onEnd.mock.calls[0]?.[0]).toBe(1.5);
    expect(onEnd.mock.calls[0]?.[1]).toBeGreaterThan(0);
  });

  it('ends without momentum when the arena resets (the window lost focus)', () => {
    const { s, onEnd } = setup();
    s.down(1, 0, 0).down(2, 100, 0).wait(16).move(2, 200, 0);
    s.arena.reset();
    expect(onEnd).toHaveBeenCalledWith(2, 0, { x: 100, y: 0 });
  });

  it('recognises and measures the same under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { s, onEnd } = setup();
    s.down(1, 0, 0).down(2, 100, 0);
    for (let i = 1; i <= 10; i++) s.wait(16).move(2, 100 * 2 ** (i / 10), 0);
    s.up(2);
    expect(onEnd.mock.calls[0]?.[1]).toBeCloseTo(6.25, 1);
  });
});
