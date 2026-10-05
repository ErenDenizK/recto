/**
 * The gesture core's DOM wiring in a real browser (09-primitives §31; 04-context §2.3): the
 * arena per element, the long press's WebKit callout guard and its echoes, scroll
 * cancellation, the hooks, and real touches through the DevTools protocol for long press and
 * pinch.
 */
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cdp } from 'vitest/browser';

import { attachLongPress, attachPinch, attachTaps, gestureArena } from './dom';
import { useLongPress } from './hooks';

/** Chrome DevTools Protocol, typed loosely (the provider's session type is not exported). */
function devtools(method: string, params: object): Promise<unknown> {
  return (cdp() as unknown as { send(m: string, p: object): Promise<unknown> }).send(
    method,
    params,
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups) cleanup();
  cleanups = [];
  document.body.replaceChildren();
});

function box(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:40px;top:40px;width:300px;height:300px;';
  document.body.append(el);
  return el;
}

function pointer(
  type: string,
  target: EventTarget,
  x: number,
  y: number,
  init: PointerEventInit = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    pointerId: 11,
    pointerType: 'touch',
    isPrimary: true,
    button: type === 'pointermove' ? -1 : 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('attachLongPress', () => {
  it('fires at 450 ms with the press event and leaves the press itself alone', async () => {
    const el = box();
    const onFire = vi.fn<(e: PointerEvent) => void>();
    cleanups.push(attachLongPress(el, { onFire }));
    const down = pointer('pointerdown', el, 100, 100);
    expect(down.defaultPrevented).toBe(false);
    await sleep(300);
    expect(onFire).not.toHaveBeenCalled();
    await sleep(250);
    expect(onFire).toHaveBeenCalledOnce();
    expect(onFire.mock.calls[0]?.[0].target).toBe(el);
    pointer('pointerup', el, 100, 100);
  });

  it('suppresses the callout and selection on the pressed element until the finger lifts', async () => {
    const el = box();
    el.style.setProperty('user-select', 'text');
    cleanups.push(attachLongPress(el, { onFire: () => undefined }));
    pointer('pointerdown', el, 100, 100);
    // `-webkit-touch-callout` exists only in WebKit; other engines drop the declaration.
    if (CSS.supports('-webkit-touch-callout', 'none')) {
      expect(el.style.getPropertyValue('-webkit-touch-callout')).toBe('none');
    }
    expect(getComputedStyle(el).userSelect).toBe('none');
    const select = new Event('selectstart', { bubbles: true, cancelable: true });
    el.dispatchEvent(select);
    expect(select.defaultPrevented).toBe(true);
    await sleep(500);
    // Fired: still suppressed while the finger stays down (iOS selects at its own 500 ms).
    expect(getComputedStyle(el).userSelect).toBe('none');
    pointer('pointerup', el, 100, 100);
    expect(el.style.getPropertyValue('user-select')).toBe('text');
    expect(el.style.getPropertyValue('-webkit-touch-callout')).toBe('');
    const later = new Event('selectstart', { bubbles: true, cancelable: true });
    el.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it('restores at once when the press is cancelled by movement', () => {
    const el = box();
    cleanups.push(attachLongPress(el, { onFire: () => undefined }));
    pointer('pointerdown', el, 100, 100);
    expect(el.style.getPropertyValue('user-select')).toBe('none');
    pointer('pointermove', el, 100, 130);
    expect(el.style.getPropertyValue('user-select')).toBe('');
  });

  it("swallows Android's contextmenu echo and the release's click", async () => {
    const el = box();
    const onFire = vi.fn();
    const clicks = vi.fn();
    const menus = vi.fn();
    cleanups.push(attachLongPress(el, { onFire }));
    document.addEventListener('click', clicks);
    document.addEventListener('contextmenu', menus);
    cleanups.push(() => {
      document.removeEventListener('click', clicks);
      document.removeEventListener('contextmenu', menus);
    });
    pointer('pointerdown', el, 100, 100);
    await sleep(500);
    expect(onFire).toHaveBeenCalledOnce();
    const echo = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(echo);
    expect(echo.defaultPrevented).toBe(true);
    pointer('pointerup', el, 100, 100);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicks).not.toHaveBeenCalled();
    expect(menus).not.toHaveBeenCalled();
    // Only the one click: the next is a click again.
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicks).toHaveBeenCalledOnce();
  });

  it('lets the next tap click when the release brought no click of its own', async () => {
    // Chromium's touch gestures end a long press in a long tap, without a click: the swallow
    // must not wait for one and eat a tap on the popup the long press opened (History's Cancel).
    const el = box();
    const other = document.createElement('button');
    document.body.append(other);
    const clicks = vi.fn();
    cleanups.push(attachLongPress(el, { onFire: vi.fn() }));
    document.addEventListener('click', clicks);
    cleanups.push(() => document.removeEventListener('click', clicks));
    pointer('pointerdown', el, 100, 100);
    await sleep(500);
    pointer('pointerup', el, 100, 100);
    // A new touch, well within the echo window, and its click.
    pointer('pointerdown', other, 10, 10, { pointerId: 12 });
    pointer('pointerup', other, 10, 10, { pointerId: 12 });
    other.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(clicks).toHaveBeenCalledOnce();
  });

  it('counts a contextmenu that arrives first as the fire, once', async () => {
    const el = box();
    const onFire = vi.fn();
    cleanups.push(attachLongPress(el, { onFire }));
    pointer('pointerdown', el, 100, 100);
    await sleep(100);
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(onFire).toHaveBeenCalledOnce();
    await sleep(450);
    expect(onFire).toHaveBeenCalledOnce();
    pointer('pointerup', el, 100, 100);
  });

  it('leaves a right-click alone', () => {
    const el = box();
    cleanups.push(attachLongPress(el, { onFire: () => undefined }));
    pointer('pointerdown', el, 100, 100, { pointerType: 'mouse', button: 2 });
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
    pointer('pointerup', el, 100, 100, { pointerType: 'mouse', button: 2 });
  });

  it('is cancelled by a scroll during the press', async () => {
    const el = box();
    const scroller = document.createElement('div');
    scroller.style.cssText = 'height:100px;overflow:auto';
    scroller.innerHTML = '<div style="height:400px"></div>';
    el.append(scroller);
    const onFire = vi.fn();
    cleanups.push(attachLongPress(el, { onFire }));
    pointer('pointerdown', scroller, 100, 100);
    scroller.scrollTop = 50;
    await sleep(500);
    expect(onFire).not.toHaveBeenCalled();
    pointer('pointerup', el, 100, 100);
  });

  it('hears a second finger even when a layer below stops the press', async () => {
    const el = box();
    const layer = document.createElement('div');
    layer.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.append(layer);
    const onFire = vi.fn();
    cleanups.push(attachLongPress(el, { onFire }));
    pointer('pointerdown', el, 100, 100);
    pointer('pointerdown', layer, 200, 100, { pointerId: 12, isPrimary: false });
    await sleep(500);
    expect(onFire).not.toHaveBeenCalled();
    pointer('pointerup', el, 200, 100, { pointerId: 12 });
    pointer('pointerup', el, 100, 100);
  });

  it('shares one arena per element and unwires with its last recogniser', () => {
    const el = box();
    const a = attachLongPress(el, { onFire: () => undefined });
    const b = attachTaps(el, { onTap: () => undefined });
    expect(gestureArena(el)?.size).toBe(2);
    a();
    expect(gestureArena(el)?.size).toBe(1);
    b();
    expect(gestureArena(el)).toBeUndefined();
  });
});

describe('useLongPress', () => {
  it('attaches to the ref and calls the latest callback', async () => {
    const calls: string[] = [];
    function Probe({ label }: { label: string }) {
      const ref = useRef<HTMLDivElement>(null);
      useLongPress(ref, { onFire: () => calls.push(label) });
      return <div ref={ref} data-testid="probe" style={{ width: 200, height: 200 }} />;
    }
    const view = render(<Probe label="first" />);
    view.rerender(<Probe label="second" />);
    const el = view.getByTestId('probe');
    pointer('pointerdown', el, 50, 50);
    await sleep(500);
    pointer('pointerup', el, 50, 50);
    expect(calls).toEqual(['second']);
    view.unmount();
    expect(gestureArena(el)).toBeUndefined();
  });
});

/**
 * Real touches through the DevTools protocol, in the coordinates of the top-level page: the
 * test runs inside the runner's iframe, which may be offset and scaled.
 */
async function touch(type: 'touchStart' | 'touchMove' | 'touchEnd', points: [number, number][]) {
  const frame = window.frameElement?.getBoundingClientRect();
  const scale = frame && window.innerWidth ? frame.width / window.innerWidth : 1;
  await devtools('Input.dispatchTouchEvent', {
    type,
    touchPoints: points.map(([x, y], id) => ({
      x: (frame?.left ?? 0) + x * scale,
      y: (frame?.top ?? 0) + y * scale,
      id,
    })),
  });
  return scale;
}

describe('real touches (DevTools protocol)', () => {
  it('a held touch long-presses once; no contextmenu gets through', async () => {
    const el = box();
    const onFire = vi.fn();
    const menus = vi.fn();
    cleanups.push(attachLongPress(el, { onFire }));
    const onMenu = (e: Event) => {
      if (!e.defaultPrevented) menus();
    };
    document.addEventListener('contextmenu', onMenu);
    cleanups.push(() => document.removeEventListener('contextmenu', onMenu));
    await touch('touchStart', [[150, 150]]);
    await sleep(800);
    await touch('touchEnd', []);
    expect(onFire).toHaveBeenCalledOnce();
    expect(menus).not.toHaveBeenCalled();
  });

  it('two touches pinch: scale and focal point, then release', async () => {
    const el = box();
    el.style.touchAction = 'none';
    const onStart = vi.fn();
    const onChange = vi.fn<(scale: number, origin: { x: number; y: number }) => void>();
    const onEnd = vi.fn<(scale: number, velocity: number) => void>();
    const onFire = vi.fn();
    cleanups.push(attachPinch(el, { onStart, onChange, onEnd }));
    cleanups.push(attachLongPress(el, { onFire }));
    await touch('touchStart', [[140, 190]]);
    await touch('touchStart', [
      [140, 190],
      [240, 190],
    ]);
    for (let i = 1; i <= 5; i++) {
      await touch('touchMove', [
        [140 - i * 10, 190],
        [240 + i * 10, 190],
      ]);
    }
    await touch('touchEnd', []);
    await sleep(500);
    expect(onStart).toHaveBeenCalledOnce();
    const [scale, origin] = onChange.mock.calls.at(-1) ?? [];
    expect(scale).toBeCloseTo(2, 1);
    expect(origin?.x).toBeCloseTo(190, 0);
    expect(origin?.y).toBeCloseTo(190, 0);
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onFire).not.toHaveBeenCalled();
  });
});
