/**
 * The app's scroll bar (GLS-26, `scroll-thumbs.ts`): native bars hidden once it runs, a bar over
 * whichever scroller scrolls, one transform per scroll, shown under a fine pointer at the
 * trailing edge only over the scroller itself, a drag that scrolls `instant` and names what is
 * under it, and the opt-out property.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installScrollThumbs, setScrollLabel } from './scroll-thumbs';

let stop: () => void = () => undefined;
let scroller: HTMLDivElement;
let row: HTMLDivElement;

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
const bar = (axis: 'x' | 'y') =>
  document.querySelector<HTMLElement>(`[data-axis="${axis}"]`) as HTMLElement;
const pointer = (type: string, target: Element, x: number, y: number, extra = {}) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerType: 'mouse',
      pointerId: 1,
      button: 0,
      ...extra,
    }),
  );

beforeEach(() => {
  scroller = document.createElement('div');
  scroller.style.cssText =
    'position:fixed;top:100px;left:100px;width:300px;height:400px;overflow-y:auto';
  row = document.createElement('div');
  row.style.height = '4000px';
  scroller.append(row);
  document.body.append(scroller);
  stop = installScrollThumbs();
});

afterEach(() => {
  stop();
  scroller.remove();
});

describe('the app-wide scroll bar', () => {
  it('hides the native bars and takes no gutter', () => {
    expect(document.documentElement).toHaveAttribute('data-scroll-thumbs');
    expect(getComputedStyle(scroller).scrollbarWidth).toBe('none');
    expect(scroller.clientWidth).toBe(300);
  });

  it('shows over the scroller that scrolls, moved by one transform, and fades at rest', async () => {
    const y = bar('y');
    expect(y).not.toHaveAttribute('data-shown');
    scroller.scrollTop = 1800;
    await frame();
    await frame();
    expect(y).toHaveAttribute('data-shown');
    const box = y.getBoundingClientRect();
    // At the trailing edge, inset 3 px from the scroller's ends.
    expect(box.right).toBeCloseTo(400, 0);
    expect(box.top).toBeCloseTo(103, 0);
    expect(box.height).toBeCloseTo(394, 0);
    const thumb = y.firstElementChild as HTMLElement;
    // 394 × 400 / 4000 px, about 39 px, half-way down its travel.
    expect(thumb.offsetHeight).toBeGreaterThanOrEqual(39);
    expect(thumb.style.transform).toMatch(/^translateY\((\d+)px\)$/);
    const at = Number(/(\d+)/.exec(thumb.style.transform)?.[1]);
    expect(at / (394 - thumb.offsetHeight)).toBeCloseTo(0.5, 1);
    await expect.poll(() => y.hasAttribute('data-shown'), { timeout: 3000 }).toBe(false);
  });

  it('shows and takes the pointer only at the trailing edge, over the scroller itself', () => {
    const y = bar('y');
    pointer('pointerover', row, 300, 300);
    pointer('pointermove', row, 300, 300);
    expect(y).not.toHaveAttribute('data-hot');
    pointer('pointermove', row, 393, 300);
    expect(y).toHaveAttribute('data-hot');
    expect(y).toHaveAttribute('data-shown');
    expect(getComputedStyle(y).pointerEvents).toBe('auto');
    // Something laid over the scroller's edge keeps its pointer.
    const handle = document.createElement('div');
    document.body.append(handle);
    pointer('pointermove', handle, 393, 300);
    expect(y).not.toHaveAttribute('data-hot');
    handle.remove();
  });

  it('drags the scroller instantly and names what is under the thumb', async () => {
    scroller.style.scrollBehavior = 'smooth';
    setScrollLabel(scroller, (top) => `at ${Math.round(top)}`);
    const y = bar('y');
    y.setPointerCapture = () => undefined;
    pointer('pointerover', row, 393, 300);
    pointer('pointermove', row, 393, 300);
    // A press beside the thumb jumps there (its middle under the pointer) and keeps dragging.
    pointer('pointerdown', y, 393, 103 + 197);
    expect(y).toHaveAttribute('data-drag');
    expect(scroller.scrollTop).toBeGreaterThan(1500);
    pointer('pointermove', y, 393, 103 + 394);
    expect(scroller.scrollTop).toBe(3600);
    await frame();
    await frame();
    const label = y.querySelector('span') as HTMLElement;
    expect(label.hidden).toBe(false);
    expect(label.textContent).toBe('at 3600');
    pointer('pointerup', y, 393, 497);
    expect(y).not.toHaveAttribute('data-drag');
    expect(label.hidden).toBe(true);
  });

  it('leaves a scroller with --scroll-bar: none alone', async () => {
    scroller.style.setProperty('--scroll-bar', 'none');
    scroller.scrollTop = 500;
    await frame();
    await frame();
    expect(bar('y')).not.toHaveAttribute('data-shown');
  });

  it('gives the native bars back once stopped', () => {
    stop();
    expect(document.documentElement).not.toHaveAttribute('data-scroll-thumbs');
    expect(document.querySelector('[data-axis]')).toBeNull();
    expect(getComputedStyle(scroller).scrollbarWidth).toBe('thin');
  });
});
