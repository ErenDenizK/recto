/**
 * FLIP with scale, interruption and retarget (language.md §7.3 *reflow*; quality-bar.md Q-2;
 * 09-primitives §31; spec D0-12).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { flip } from './flip';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function box(left = 0, width = 100): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position: absolute; top: 20px; left: ${left}px; width: ${width}px; height: 40px;`;
  document.body.append(el);
  return el;
}

const x = (el: Element) => el.getBoundingClientRect().x;

/** At rest with nothing left behind (Q-2). */
function expectAtRest(el: HTMLElement) {
  expect(el.style.transform).toBe('');
  expect(getComputedStyle(el).transform).toBe('none');
  expect(el.style.willChange).toBe('');
  expect(el.getAnimations()).toHaveLength(0);
}

afterEach(() => {
  delete document.documentElement.dataset.motion;
  document.body.replaceChildren();
});

describe('flip', () => {
  it('plays from the old box to the new one and leaves no transform at rest', async () => {
    const el = box();
    const from = x(el);
    const done = flip([el], () => {
      el.style.left = '200px';
    });
    // The first frame shows the element where it was.
    expect(x(el)).toBeCloseTo(from, 0);
    await wait(80);
    expect(x(el)).toBeGreaterThan(from);
    expect(x(el)).toBeLessThan(from + 200);
    await done;
    expect(x(el)).toBe(from + 200);
    expectAtRest(el);
  });

  it('carries a size change by scale', async () => {
    const el = box(0, 100);
    const done = flip([el], () => {
      el.style.width = '200px';
    });
    const first = el.getBoundingClientRect();
    expect(first.width).toBeCloseTo(100, 0);
    expect(first.x).toBeCloseTo(0 + el.offsetParent!.getBoundingClientRect().x, 0);
    await done;
    expect(el.getBoundingClientRect().width).toBe(200);
    expectAtRest(el);
  });

  it('an interrupted flip continues from where it is and ends at the newest layout', async () => {
    const el = box();
    const origin = x(el);
    const first = flip([el], () => {
      el.style.left = '200px';
    });
    await wait(90);
    const mid = x(el);
    expect(mid).toBeGreaterThan(origin);
    const second = flip([el], () => {
      el.style.left = '400px';
    });
    // No jump: the second flip starts where the first one was on screen.
    expect(Math.abs(x(el) - mid)).toBeLessThan(1.5);
    await Promise.all([first, second]);
    expect(x(el)).toBe(origin + 400);
    expectAtRest(el);
  });

  it('carries its velocity through a reversal instead of turning on the spot', async () => {
    const el = box();
    const origin = x(el);
    const spring = 'glide';
    const first = flip(
      [el],
      () => {
        el.style.left = '300px';
      },
      { spring },
    );
    await wait(80);
    const mid = x(el);
    const back = flip(
      [el],
      () => {
        el.style.left = '0px';
      },
      { spring },
    );
    // Still moving forward over the next frames after being sent back (research 18 §6.2);
    // `glide` turns about 25 ms after a reversal at this speed.
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      await nextFrame();
      seen.push(x(el));
    }
    expect(Math.max(...seen)).toBeGreaterThan(mid + 0.5);
    await Promise.all([first, back]);
    expect(x(el)).toBe(origin);
    expectAtRest(el);
  });

  it('leaves alone what did not move, what was not there before and what has gone', async () => {
    const still = box(0);
    const moved = box(150);
    const entering = document.createElement('div');
    const leaving = box(300);
    const done = flip([still, moved, entering, leaving], () => {
      moved.style.left = '250px';
      document.body.append(entering);
      leaving.remove();
    });
    expect(still.getAnimations()).toHaveLength(0);
    expect(entering.getAnimations()).toHaveLength(0);
    expect(leaving.getAnimations()).toHaveLength(0);
    expect(moved.getAnimations()).toHaveLength(1);
    await done;
    expectAtRest(moved);
  });

  it('only applies the change under reduced motion', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const el = box();
    const from = x(el);
    await flip([el], () => {
      el.style.left = '200px';
    });
    expect(x(el)).toBe(from + 200);
    expectAtRest(el);
  });
});
