/**
 * Wheel zoom (05-canvas §4 *Behaviour*; spec D2-10): a trackpad pinch is 1:1 and ends 150 ms
 * after its last event; a Mod+wheel notch is one step; wheels without Mod or a pinch are left
 * to scroll.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Point } from './pinch';
import { WHEEL_ZOOM, type WheelLike, wheelZoom, wheelZoomKind } from './wheel-zoom';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const wheel = (deltaY: number, t: number, extra: Partial<WheelLike> = {}): WheelLike => ({
  deltaY,
  deltaMode: 0,
  clientX: 200,
  clientY: 300,
  timeStamp: t,
  ctrlKey: true,
  metaKey: false,
  ...extra,
});

function setup() {
  const onStart = vi.fn<(origin: Point) => void>();
  const onChange = vi.fn<(scale: number, origin: Point) => void>();
  const onEnd = vi.fn<(scale: number, velocity: number, origin: Point) => void>();
  const onNotch = vi.fn<(direction: 1 | -1, origin: Point, t: number) => void>();
  return { onStart, onChange, onEnd, onNotch, r: wheelZoom({ onStart, onChange, onEnd, onNotch }) };
}

describe('wheelZoomKind', () => {
  it('tells mouse notches from trackpad pinches', () => {
    expect(wheelZoomKind({ deltaY: 100, deltaMode: 0 })).toBe('notch');
    expect(wheelZoomKind({ deltaY: -120, deltaMode: 0 })).toBe('notch');
    expect(wheelZoomKind({ deltaY: 3, deltaMode: 1 })).toBe('notch');
    expect(wheelZoomKind({ deltaY: -2.5, deltaMode: 0 })).toBe('trackpad');
    expect(wheelZoomKind({ deltaY: 12, deltaMode: 0 })).toBe('trackpad');
    expect(wheelZoomKind({ deltaY: 60.5, deltaMode: 0 })).toBe('trackpad');
  });
});

describe('wheelZoom', () => {
  it('leaves a wheel without Mod to scroll', () => {
    const { r, onStart, onNotch } = setup();
    expect(r.wheel(wheel(100, 0, { ctrlKey: false }))).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
    expect(onNotch).not.toHaveBeenCalled();
  });

  it('turns a notch into one step in or out', () => {
    const { r, onNotch, onStart } = setup();
    expect(r.wheel(wheel(-100, 10))).toBe(true);
    expect(r.wheel(wheel(100, 20, { ctrlKey: false, metaKey: true }))).toBe(true);
    expect(onNotch.mock.calls).toEqual([
      [1, { x: 200, y: 300 }, 10],
      [-1, { x: 200, y: 300 }, 20],
    ]);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('tracks a trackpad pinch 1:1 and ends it 150 ms after the last event', () => {
    const { r, onStart, onChange, onEnd } = setup();
    let t = 0;
    for (let i = 0; i < 10; i++) {
      r.wheel(wheel(-5, (t += 16)));
    }
    expect(onStart).toHaveBeenCalledTimes(1);
    const last = onChange.mock.calls.at(-1)?.[0] ?? 0;
    expect(last).toBeCloseTo(Math.exp(50 / WHEEL_ZOOM.pxPerE), 6);
    expect(r.active).toBe(true);
    // A large delta inside the pinch stays part of it.
    r.wheel(wheel(-60, t + 16));
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(WHEEL_ZOOM.endMs - 1);
    expect(onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    const [scale, velocity] = onEnd.mock.calls[0] ?? [];
    expect(scale).toBeCloseTo(Math.exp(110 / WHEEL_ZOOM.pxPerE), 6);
    // Zooming in: a positive log2 velocity.
    expect(velocity).toBeGreaterThan(0);
    expect(r.active).toBe(false);
  });

  it('ends a pinch with no momentum when disposed', () => {
    const { r, onEnd } = setup();
    r.wheel(wheel(-4, 16));
    r.wheel(wheel(-4, 32));
    r.dispose();
    expect(onEnd).toHaveBeenCalledWith(expect.any(Number), 0, { x: 200, y: 300 });
  });
});
