/**
 * The pointer path's state machine (`components/06-navigation.md` §2.4, PG5 §9; flows.md S13)
 * on synthetic pointer streams: the mouse lifts after 4 px, a touch after a 450 ms hold and then
 * movement, a touch that moves first is a scroll, a held touch released still is the menu, the
 * guard refuses at the lift, and a second pointer cancels.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pointerStream } from '../../test/pointer-stream';
import type { PointerLike } from '../motion/gesture/arena';
import { GESTURE } from '../motion/gesture/constants';
import { longPress } from '../motion/gesture/long-press';
import { attachPointerDrag, pointerDrag, type PointerDragOptions } from './pointer-drag';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(options: Partial<PointerDragOptions> = {}) {
  const calls = {
    onLift: vi.fn<(e: PointerLike, start: PointerLike) => boolean>(() => true),
    onMove: vi.fn<(e: PointerLike) => void>(),
    onDrop: vi.fn<(e: PointerLike) => void>(),
    onCancel: vi.fn<() => void>(),
    onHold: vi.fn<(e: PointerLike) => void>(),
    onHoldRelease: vi.fn<(e: PointerLike) => void>(),
    onEnd: vi.fn<() => void>(),
  };
  const s = pointerStream();
  const drag = pointerDrag({ shouldStart: () => true, ...calls, ...options });
  s.arena.add(drag);
  return { s, drag, ...calls };
}

describe('pointerDrag', () => {
  it('lifts a mouse drag after 4 px and drops it where it is released', () => {
    const t = setup();
    t.s.down(1, 100, 100, 'mouse').move(1, 103, 102);
    expect(t.onLift).not.toHaveBeenCalled();
    t.s.move(1, 100, 106);
    expect(t.onLift).toHaveBeenCalledOnce();
    expect(t.onLift.mock.calls[0]?.[1]).toMatchObject({ clientX: 100, clientY: 100 });
    expect(t.drag.phase).toBe('lifted');
    t.s.move(1, 100, 160).up(1, 100, 170);
    expect(t.onMove).toHaveBeenCalledTimes(2);
    expect(t.onDrop).toHaveBeenCalledOnce();
    expect(t.onDrop.mock.calls[0]?.[0]).toMatchObject({ clientY: 170 });
    expect(t.onCancel).not.toHaveBeenCalled();
    expect(t.drag.phase).toBe('idle');
  });

  it('leaves a mouse click alone: no lift, no drop', () => {
    const t = setup();
    t.s.down(1, 10, 10, 'mouse').move(1, 12, 12).up(1);
    expect(t.onLift).not.toHaveBeenCalled();
    expect(t.onDrop).not.toHaveBeenCalled();
    expect(t.onEnd).toHaveBeenCalledOnce();
  });

  it('lifts a pen like a mouse, after 4 px (06 §2.4)', () => {
    const t = setup();
    t.s.down(1, 0, 0, 'pen').move(1, 0, 5);
    expect(t.onLift).toHaveBeenCalledOnce();
  });

  it('lets a touch that moves first scroll (S13): no hold, no lift', () => {
    const t = setup();
    t.s.down(1, 100, 100).wait(120).move(1, 100, 140).wait(GESTURE.longPressMs);
    expect(t.onHold).not.toHaveBeenCalled();
    t.s.move(1, 100, 300).up(1);
    expect(t.onLift).not.toHaveBeenCalled();
    expect(t.drag.phase).toBe('idle');
  });

  it('holds a touch at 450 ms, then lifts on movement and drops', () => {
    const t = setup();
    t.s.down(1, 50, 50).wait(GESTURE.longPressMs - 1);
    expect(t.onHold).not.toHaveBeenCalled();
    t.s.wait(1);
    expect(t.onHold).toHaveBeenCalledOnce();
    expect(t.drag.phase).toBe('held');
    t.s.move(1, 52, 52);
    expect(t.onLift).not.toHaveBeenCalled();
    t.s.move(1, 50, 90);
    expect(t.onLift).toHaveBeenCalledOnce();
    t.s.up(1, 50, 120);
    expect(t.onDrop).toHaveBeenCalledOnce();
    expect(t.onHoldRelease).not.toHaveBeenCalled();
  });

  it('opens the menu for a held touch released without moving (06.3)', () => {
    const t = setup();
    t.s.down(1, 50, 50).wait(GESTURE.longPressMs).up(1);
    expect(t.onHoldRelease).toHaveBeenCalledOnce();
    expect(t.onLift).not.toHaveBeenCalled();
  });

  it('refuses at the lift when the guard says no (a locked document)', () => {
    const t = setup({ onLift: () => false });
    t.s.down(1, 0, 0, 'mouse').move(1, 0, 20).move(1, 0, 60).up(1);
    expect(t.onMove).not.toHaveBeenCalled();
    expect(t.onDrop).not.toHaveBeenCalled();
    expect(t.drag.phase).toBe('idle');
  });

  it('cancels a lifted drag on a second pointer, pointercancel and cancel()', () => {
    const second = setup();
    second.s.down(1, 0, 0, 'mouse').move(1, 0, 20).down(2, 50, 50);
    expect(second.onCancel).toHaveBeenCalledOnce();
    expect(second.onDrop).not.toHaveBeenCalled();

    const browser = setup();
    browser.s.down(1, 0, 0).wait(GESTURE.longPressMs).move(1, 0, 30).cancel(1);
    expect(browser.onCancel).toHaveBeenCalledOnce();

    const esc = setup();
    esc.s.down(1, 0, 0, 'mouse').move(1, 0, 20);
    esc.drag.cancel();
    esc.s.up(1);
    expect(esc.onCancel).toHaveBeenCalledOnce();
    expect(esc.onDrop).not.toHaveBeenCalled();
  });

  it('ignores presses the consumer refuses and secondary buttons', () => {
    const refused = setup({ shouldStart: () => false });
    refused.s.down(1, 0, 0, 'mouse').move(1, 0, 40).up(1);
    expect(refused.onLift).not.toHaveBeenCalled();

    const right = setup();
    right.s.down(1, 0, 0, 'mouse', 2).move(1, 0, 40).up(1);
    expect(right.onLift).not.toHaveBeenCalled();
  });

  it('claims the arena at the hold, so a long press beside it does not fire too', () => {
    const t = setup();
    const onFire = vi.fn();
    // Joined after the drag: the drag's hold timer runs first and claims.
    t.s.arena.add(longPress({ onFire }));
    t.s
      .down(1, 0, 0)
      .wait(GESTURE.longPressMs + 10)
      .up(1);
    expect(t.onHoldRelease).toHaveBeenCalledOnce();
    expect(onFire).not.toHaveBeenCalled();
  });
});

describe('attachPointerDrag', () => {
  function pointer(type: string, target: EventTarget, x: number, y: number, pointerId = 21) {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        pointerId,
        pointerType: 'mouse',
        isPrimary: true,
        button: type === 'pointermove' ? -1 : 0,
      }),
    );
  }
  const click = (target: EventTarget) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };

  it("swallows the drop's click, but not the next press's when the drop brought none", () => {
    const el = document.createElement('div');
    const other = document.createElement('button');
    document.body.append(el, other);
    const onDrop = vi.fn();
    const remove = attachPointerDrag(el, {
      shouldStart: () => true,
      onLift: () => true,
      onMove: () => undefined,
      onDrop,
      onCancel: () => undefined,
    });
    try {
      const drag = () => {
        pointer('pointerdown', el, 10, 10);
        pointer('pointermove', el, 10, 30);
        pointer('pointerup', el, 10, 40);
      };
      drag();
      expect(onDrop).toHaveBeenCalledOnce();
      expect(click(el).defaultPrevented).toBe(true);
      // A finger that moved brings no click: the next tap, within the echo window, is a tap.
      drag();
      pointer('pointerdown', other, 5, 5, 22);
      pointer('pointerup', other, 5, 5, 22);
      expect(click(other).defaultPrevented).toBe(false);
    } finally {
      remove();
      el.remove();
      other.remove();
    }
  });
});
