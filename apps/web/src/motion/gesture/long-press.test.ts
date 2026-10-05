/**
 * The long-press recogniser on synthetic pointer streams (04-context §2.3; research 19 §6;
 * 09-primitives §31): the 450 ms and 10 px thresholds, every cancellation, and arbitration.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pointerStream } from '../../../test/pointer-stream';
import type { PointerLike } from './arena';
import { GESTURE } from './constants';
import { longPress } from './long-press';
import { taps } from './taps';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.motion;
});

function setup(options: Partial<Parameters<typeof longPress>[0]> = {}) {
  const onFire = vi.fn<(e: PointerLike) => void>();
  const onPressEnd = vi.fn<(fired: boolean) => void>();
  const s = pointerStream();
  const recogniser = longPress({ onFire, onPressEnd, ...options });
  s.arena.add(recogniser);
  return { s, onFire, onPressEnd, recogniser };
}

describe('longPress', () => {
  it('fires at 450 ms with the press event, not a millisecond earlier', () => {
    const { s, onFire, onPressEnd } = setup();
    s.down(1, 100, 200).wait(GESTURE.longPressMs - 1);
    expect(onFire).not.toHaveBeenCalled();
    s.wait(1);
    expect(onFire).toHaveBeenCalledOnce();
    expect(onFire.mock.calls[0]?.[0]).toMatchObject({
      clientX: 100,
      clientY: 200,
      timeStamp: 1000,
    });
    expect(onPressEnd).toHaveBeenCalledWith(true);
    s.up(1);
    expect(onFire).toHaveBeenCalledOnce();
  });

  it('tolerates 10 px of movement and cancels past it', () => {
    const still = setup();
    still.s.down(1, 100, 100).move(1, 106, 108).wait(450);
    expect(still.onFire).toHaveBeenCalledOnce();

    const moved = setup();
    moved.s.down(1, 100, 100).move(1, 107, 108).wait(450);
    expect(moved.onFire).not.toHaveBeenCalled();
    expect(moved.onPressEnd).toHaveBeenCalledWith(false);
  });

  it('cancels on release, on pointercancel (a scroll) and on cancel()', () => {
    const released = setup();
    released.s.down(1, 0, 0).wait(300).up(1).wait(500);
    expect(released.onFire).not.toHaveBeenCalled();

    const scrolled = setup();
    scrolled.s.down(1, 0, 0).wait(100).cancel(1).wait(500);
    expect(scrolled.onFire).not.toHaveBeenCalled();

    const called = setup();
    called.s.down(1, 0, 0).wait(100);
    expect(called.recogniser.pending).toBe(true);
    called.recogniser.cancel();
    called.s.wait(500);
    expect(called.onFire).not.toHaveBeenCalled();
    expect(called.recogniser.pending).toBe(false);
  });

  it('is cancelled by a second pointer, and never starts with two down', () => {
    const { s, onFire } = setup();
    s.down(1, 0, 0).wait(200).down(2, 100, 0).wait(500);
    expect(onFire).not.toHaveBeenCalled();
    // The second finger lifts; the first is still down but the press is gone.
    s.up(2).wait(500);
    expect(onFire).not.toHaveBeenCalled();
  });

  it('answers touch and pen by default, never a mouse or a secondary button', () => {
    for (const [type, button, fires] of [
      ['touch', 0, true],
      ['pen', 0, true],
      ['mouse', 0, false],
      ['pen', 2, false],
    ] as const) {
      const { s, onFire } = setup();
      s.down(1, 0, 0, type, button).wait(450);
      expect(onFire, `${type} button ${button}`).toHaveBeenCalledTimes(fires ? 1 : 0);
    }
    const mouse = setup({ types: ['mouse'] });
    mouse.s.down(1, 0, 0, 'mouse').wait(450);
    expect(mouse.onFire).toHaveBeenCalledOnce();
  });

  it('never fires for a pointer the consumer refuses (a drawing pen)', () => {
    const drawing = (e: PointerLike) => e.pointerType === 'pen';
    const { s, onFire } = setup({ shouldStart: (e) => !drawing(e) });
    s.down(1, 0, 0, 'pen').wait(1000).up(1);
    expect(onFire).not.toHaveBeenCalled();
    s.down(2, 0, 0, 'touch').wait(450);
    expect(onFire).toHaveBeenCalledOnce();
  });

  it('fires at once when asked (Android’s contextmenu came first), once', () => {
    const { s, onFire, recogniser } = setup();
    s.down(1, 0, 0).wait(200);
    expect(recogniser.fire()).toBe(true);
    expect(onFire).toHaveBeenCalledOnce();
    s.wait(500);
    expect(recogniser.fire()).toBe(false);
    expect(onFire).toHaveBeenCalledOnce();
  });

  it('claims the arena when it fires, so its release is no tap', () => {
    const onTap = vi.fn<(e: PointerLike) => void>();
    const { s, onFire } = setup();
    s.arena.add(taps({ onTap }));
    s.down(1, 0, 0).wait(GESTURE.longPressMs).up(1);
    expect(onFire).toHaveBeenCalledOnce();
    expect(onTap).not.toHaveBeenCalled();
    // The claim lasts until every pointer lifted: the next press taps again.
    s.down(2, 0, 0).wait(80).up(2);
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('recognises the same under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { s, onFire } = setup();
    s.down(1, 0, 0).move(1, 5, 5).wait(450);
    expect(onFire).toHaveBeenCalledOnce();
  });

  it('stops its timer when it leaves the arena', () => {
    const onFire = vi.fn();
    const s = pointerStream();
    const remove = s.arena.add(longPress({ onFire }));
    s.down(1, 0, 0).wait(100);
    remove();
    s.wait(1000);
    expect(onFire).not.toHaveBeenCalled();
  });
});
