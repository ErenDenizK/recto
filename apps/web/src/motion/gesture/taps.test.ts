/**
 * Taps and double taps on synthetic pointer streams (research 19 §6; flows.md §7.1;
 * 09-primitives §31): time and distance thresholds, coarse and fine, exclusivity.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pointerStream } from '../../../test/pointer-stream';
import type { PointerLike } from './arena';
import { GESTURE } from './constants';
import { doubleTapReach, type TapOptions, taps } from './taps';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.motion;
});

function setup(options: Partial<TapOptions> = {}) {
  const onTap = vi.fn<(e: PointerLike) => void>();
  const onDoubleTap = vi.fn<(e: PointerLike) => void>();
  const s = pointerStream();
  s.arena.add(taps({ onTap, onDoubleTap, ...options }));
  return { s, onTap, onDoubleTap };
}

/** One tap of `id` at (x, y): down, 60 ms, up. */
const tap = (
  s: ReturnType<typeof pointerStream>,
  id: number,
  x: number,
  y: number,
  type = 'touch',
) => s.down(id, x, y, type).wait(60).up(id);

describe('taps', () => {
  it('taps on release, within the slop and before a long press', () => {
    const { s, onTap } = setup();
    s.down(1, 50, 50).move(1, 58, 54).wait(100).up(1);
    expect(onTap).toHaveBeenCalledOnce();
    // Past 10 px: a drag (a scroll), no tap.
    s.wait(1000).down(2, 50, 50).move(2, 61, 50).up(2);
    // Held past 450 ms: a long press, no tap.
    s.wait(1000)
      .down(3, 50, 50)
      .wait(GESTURE.longPressMs + 1)
      .up(3);
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('gives a mouse a 4 px slop', () => {
    const { s, onTap } = setup();
    s.down(1, 0, 0, 'mouse').move(1, 4, 0).up(1);
    s.wait(1000).down(2, 0, 0, 'mouse').move(2, 5, 0).up(2);
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('pairs two taps within 300 ms of the first release and 24 px (coarse)', () => {
    const { s, onTap, onDoubleTap } = setup();
    tap(s, 1, 100, 100).wait(GESTURE.doubleTapMs);
    tap(s, 2, 112, 118);
    expect(onDoubleTap).toHaveBeenCalledOnce();
    // Not exclusive: click, click, dblclick.
    expect(onTap).toHaveBeenCalledTimes(2);
  });

  it('does not pair taps too late, too far, or of different pointer types', () => {
    const late = setup();
    tap(late.s, 1, 100, 100).wait(GESTURE.doubleTapMs + 1);
    tap(late.s, 2, 100, 100);
    expect(late.onDoubleTap).not.toHaveBeenCalled();

    const far = setup();
    tap(far.s, 1, 100, 100).wait(100);
    tap(far.s, 2, 125, 100);
    expect(far.onDoubleTap).not.toHaveBeenCalled();

    const mixed = setup();
    tap(mixed.s, 1, 100, 100, 'pen').wait(100);
    tap(mixed.s, 2, 100, 100, 'touch');
    expect(mixed.onDoubleTap).not.toHaveBeenCalled();
  });

  it('is fine with a mouse: 4 px apart pairs, 5 px does not', () => {
    expect(doubleTapReach('mouse')).toBe(GESTURE.doubleTapFinePx);
    expect(doubleTapReach('touch')).toBe(GESTURE.doubleTapPx);
    expect(doubleTapReach('pen')).toBe(GESTURE.doubleTapPx);
    const near = setup();
    tap(near.s, 1, 10, 10, 'mouse').wait(100);
    tap(near.s, 1, 14, 10, 'mouse');
    expect(near.onDoubleTap).toHaveBeenCalledOnce();
    const apart = setup();
    tap(apart.s, 1, 10, 10, 'mouse').wait(100);
    tap(apart.s, 1, 15, 10, 'mouse');
    expect(apart.onDoubleTap).not.toHaveBeenCalled();
  });

  it('starts afresh after a double tap: a third tap is a single', () => {
    const { s, onDoubleTap } = setup();
    tap(s, 1, 0, 0).wait(100);
    tap(s, 1, 0, 0).wait(100);
    tap(s, 1, 0, 0);
    expect(onDoubleTap).toHaveBeenCalledOnce();
  });

  it('exclusive: a double tap fires no single taps; a single waits 300 ms', () => {
    const { s, onTap, onDoubleTap } = setup({ exclusive: true });
    tap(s, 1, 0, 0).wait(150);
    tap(s, 2, 0, 0);
    expect(onDoubleTap).toHaveBeenCalledOnce();
    s.wait(1000);
    expect(onTap).not.toHaveBeenCalled();

    tap(s, 3, 0, 0).wait(GESTURE.doubleTapMs - 1);
    expect(onTap).not.toHaveBeenCalled();
    s.wait(1);
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('exclusive: a held tap lands first when the next tap cannot pair with it', () => {
    const { s, onTap, onDoubleTap } = setup({ exclusive: true });
    tap(s, 1, 0, 0).wait(100);
    tap(s, 2, 200, 0);
    expect(onTap).toHaveBeenCalledOnce();
    expect(onTap.mock.calls[0]?.[0]).toMatchObject({ clientX: 0 });
    s.wait(GESTURE.doubleTapMs);
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('exclusive without onDoubleTap taps at once', () => {
    const onTap = vi.fn<(e: PointerLike) => void>();
    const s = pointerStream();
    s.arena.add(taps({ onTap, exclusive: true }));
    tap(s, 1, 0, 0);
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('is cancelled by a second pointer and by pointercancel', () => {
    const { s, onTap } = setup();
    s.down(1, 0, 0).down(2, 50, 0).up(2).up(1);
    s.wait(1000).down(3, 0, 0).cancel(3);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('ignores secondary buttons and types it was not given', () => {
    const { s, onTap } = setup({ types: ['touch'] });
    s.down(1, 0, 0, 'mouse').up(1);
    s.down(2, 0, 0, 'touch', 2).up(2);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('recognises the same under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { s, onDoubleTap } = setup();
    tap(s, 1, 0, 0).wait(200);
    tap(s, 1, 10, 10);
    expect(onDoubleTap).toHaveBeenCalledOnce();
  });
});
