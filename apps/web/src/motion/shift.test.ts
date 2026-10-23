/**
 * `shift()`: a resting place that moved, sprung into from where the element was drawn, with
 * the speed it had (MOT-18; Q-2, Q-10).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { shift } from './shift';

function box(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = 'position: absolute; left: 0; top: 0; width: 40px; height: 40px';
  document.body.append(el);
  return el;
}

/** The rendered `translate` along y (px). */
const shownY = (el: Element) => {
  const value = getComputedStyle(el).translate;
  return value === 'none' ? 0 : Number.parseFloat(value.split(' ')[1] ?? '0');
};

afterEach(() => {
  delete document.documentElement.dataset.motion;
  document.body.replaceChildren();
});

describe('shift', () => {
  it('draws the element where it was and springs it into its place, leaving nothing inline', async () => {
    const el = box();
    const motion = shift(el, 0, 56);
    expect(motion).not.toBeNull();
    expect(shownY(el)).toBeCloseTo(56, 0);
    // On a pinned clock, not the runner's: a third of the way in it is between the two places,
    // and at its end it rests with nothing left inline.
    const [running] = el.getAnimations();
    const end = Number(running?.effect?.getComputedTiming().endTime ?? 0);
    if (running) running.currentTime = end / 3;
    expect(shownY(el)).toBeGreaterThan(0);
    expect(shownY(el)).toBeLessThan(56);
    if (running) running.currentTime = end;
    await motion?.finished;
    expect(el.style.translate).toBe('');
    expect(getComputedStyle(el).translate).toBe('none');
    expect(el.style.willChange).toBe('');
  });

  it('a second shift mid-flight adds to where it is drawn, keeps the speed and starts on this frame', () => {
    const el = box();
    const up = shift(el, 0, 56);
    const [running] = el.getAnimations();
    if (running) running.currentTime = 60;
    const [, y = 0] = up?.value ?? [];
    const [, v = 0] = up?.velocity ?? [];
    expect(v).toBeLessThan(-100);
    // The place moves back down by 56 px: drawn where it was, so 56 px further from the new one.
    const down = shift(el, 0, -56);
    const [, y2 = 0] = down?.value ?? [];
    const [, v2 = 0] = down?.velocity ?? [];
    expect(y2).toBeCloseTo(y - 56, 3);
    expect(v2).toBeCloseTo(v, 3);
    // A turn: never pending a frame, which would draw the turn's position twice.
    const [turned] = el.getAnimations();
    expect(turned?.pending).toBe(false);
    expect(turned?.startTime).toBe(Number(document.timeline.currentTime));
  });

  it('does nothing for a move under half a pixel, and jumps under reduced motion', () => {
    expect(shift(box(), 0, 0.2)).toBeNull();
    document.documentElement.dataset.motion = 'reduced';
    const el = box();
    shift(el, 0, 56);
    expect(el.getAnimations()).toHaveLength(0);
    expect(getComputedStyle(el).translate).toBe('none');
  });
});
