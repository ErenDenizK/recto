/**
 * Two- and three-finger taps on synthetic pointer streams (research 19 §6, M-17; flows.md
 * §7.1; 09-primitives §31): the 150 ms landing window, the 300 ms lift window, 12 px, the pen
 * quiet time, and the pinch's claim.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pointerStream } from '../../../test/pointer-stream';
import { GESTURE } from './constants';
import { type MultiFingerTapOptions, multiFingerTap } from './multi-finger-tap';
import { pinch } from './pinch';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  delete document.documentElement.dataset.motion;
});

function setup(options: Partial<MultiFingerTapOptions> = {}) {
  const onTwo = vi.fn();
  const onThree = vi.fn();
  const s = pointerStream();
  s.arena.add(multiFingerTap({ onTwo, onThree, ...options }));
  return { s, onTwo, onThree };
}

describe('multiFingerTap', () => {
  it('two fingers: onTwo once, on the last lift', () => {
    const { s, onTwo, onThree } = setup();
    s.down(1, 100, 100).wait(40).down(2, 200, 100).wait(80).up(1);
    expect(onTwo).not.toHaveBeenCalled();
    s.wait(20).up(2);
    expect(onTwo).toHaveBeenCalledOnce();
    expect(onThree).not.toHaveBeenCalled();
  });

  it('three fingers: onThree', () => {
    const { s, onTwo, onThree } = setup();
    s.down(1, 0, 0).wait(30).down(2, 50, 0).wait(30).down(3, 100, 0).wait(60);
    s.up(2).up(1).up(3);
    expect(onThree).toHaveBeenCalledOnce();
    expect(onTwo).not.toHaveBeenCalled();
  });

  it('one finger or four call nothing', () => {
    const { s, onTwo, onThree } = setup();
    s.down(1, 0, 0).wait(50).up(1);
    s.wait(1000);
    s.down(1, 0, 0).down(2, 40, 0).down(3, 80, 0).down(4, 120, 0).wait(50);
    s.up(1).up(2).up(3).up(4);
    expect(onTwo).not.toHaveBeenCalled();
    expect(onThree).not.toHaveBeenCalled();
  });

  it('needs every finger down within 150 ms of the first', () => {
    const ok = setup();
    ok.s.down(1, 0, 0).wait(GESTURE.multiTapMs).down(2, 50, 0).wait(50).up(1).up(2);
    expect(ok.onTwo).toHaveBeenCalledOnce();
    const late = setup();
    late.s
      .down(1, 0, 0)
      .wait(GESTURE.multiTapMs + 1)
      .down(2, 50, 0)
      .wait(50)
      .up(1)
      .up(2);
    expect(late.onTwo).not.toHaveBeenCalled();
  });

  it('needs every finger up within 300 ms of the first contact', () => {
    const ok = setup();
    ok.s.down(1, 0, 0).down(2, 50, 0).wait(GESTURE.multiTapUpMs).up(1).up(2);
    expect(ok.onTwo).toHaveBeenCalledOnce();
    const slow = setup();
    slow.s.down(1, 0, 0).down(2, 50, 0).wait(200).up(1).wait(101).up(2);
    expect(slow.onTwo).not.toHaveBeenCalled();
  });

  it('allows under 12 px of movement per finger', () => {
    const ok = setup();
    ok.s.down(1, 0, 0).down(2, 50, 0).move(1, 7, 9).move(2, 61, 0).up(1).up(2);
    expect(ok.onTwo).toHaveBeenCalledOnce();
    const moved = setup();
    moved.s.down(1, 0, 0).down(2, 50, 0).move(2, 62, 0).up(1).up(2);
    expect(moved.onTwo).not.toHaveBeenCalled();
  });

  it('is off while a pen is down and for 500 ms after it lifts (palm rule)', () => {
    const { s, onTwo } = setup();
    s.down(9, 300, 300, 'pen');
    s.down(1, 0, 0).down(2, 50, 0).wait(50).up(1).up(2);
    expect(onTwo).not.toHaveBeenCalled();
    s.up(9).wait(GESTURE.penQuietMs - 1);
    s.down(1, 0, 0).down(2, 50, 0).wait(50).up(1).up(2);
    expect(onTwo).not.toHaveBeenCalled();
    s.wait(GESTURE.penQuietMs);
    s.down(1, 0, 0).down(2, 50, 0).wait(50).up(1).up(2);
    expect(onTwo).toHaveBeenCalledOnce();
  });

  it('a pen landing during the group spoils it; a mouse is ignored', () => {
    const { s, onTwo } = setup();
    s.down(1, 0, 0).down(2, 50, 0).down(9, 300, 300, 'pen').up(9).up(1).up(2);
    expect(onTwo).not.toHaveBeenCalled();
    s.wait(1000).down(5, 0, 0, 'mouse').up(5);
    s.down(1, 0, 0).down(2, 50, 0).wait(50).up(1).up(2);
    expect(onTwo).toHaveBeenCalledOnce();
  });

  it('acts only while enabled (Markup), read at the tap', () => {
    let enabled = false;
    const { s, onTwo } = setup({ enabled: () => enabled });
    s.down(1, 0, 0).down(2, 50, 0).up(1).up(2);
    expect(onTwo).not.toHaveBeenCalled();
    enabled = true;
    s.wait(1000).down(1, 0, 0).down(2, 50, 0).up(1).up(2);
    expect(onTwo).toHaveBeenCalledOnce();
    const off = setup({ enabled: false });
    off.s.down(1, 0, 0).down(2, 50, 0).up(1).up(2);
    expect(off.onTwo).not.toHaveBeenCalled();
  });

  it('a finger joining one already held starts no group; pointercancel spoils it', () => {
    const { s, onTwo } = setup();
    s.down(1, 0, 0).wait(400).down(2, 50, 0).up(2).up(1);
    s.wait(1000).down(1, 0, 0).down(2, 50, 0).cancel(1).up(2);
    expect(onTwo).not.toHaveBeenCalled();
  });

  it('gives way to a pinch, which claims the arena once its fingers move', () => {
    const { s, onTwo } = setup();
    const onStart = vi.fn();
    s.arena.add(pinch({ onStart }));
    // Under 12 px for the tap's own rule, but past the 10 px slop: a pinch.
    s.down(1, 100, 100).down(2, 200, 100).move(2, 211, 100).up(1).up(2);
    expect(onStart).toHaveBeenCalledOnce();
    expect(onTwo).not.toHaveBeenCalled();
  });

  it('recognises the same under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduced';
    const { s, onThree } = setup();
    s.down(1, 0, 0).down(2, 50, 0).down(3, 100, 0).up(1).up(2).up(3);
    expect(onThree).toHaveBeenCalledOnce();
  });
});
