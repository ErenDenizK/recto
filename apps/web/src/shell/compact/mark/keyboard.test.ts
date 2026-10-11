/**
 * The keyboard on phones (keyboard.ts): the inset the keyboard covers from a visual viewport
 * (offsetTop drift clamped, a pinch zoom ignored), the scroll that reveals a field, and the
 * watcher and keep-in-view against a mocked `visualViewport` that shrinks as a keyboard rises.
 * Also the Text tool's registration over the stub (text-tool.ts), its tap rule and the typing
 * state that sends the island away.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useToolStore } from '../../../viewer/tool-store';
import { capsuleAway, resetCompactStore, setTyping, useCompactStore } from '../compact-store';
import {
  ACCESSORY_GAP,
  ACCESSORY_HEIGHT,
  keepInView,
  keyboardInset,
  REVEAL_MARGIN,
  revealDelta,
  watchKeyboard,
} from './keyboard';
import { compactTool } from './registry';
import { boxAt, TEXT_SIZES } from './text-presets';
import './tools';
import './text-tool';

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

describe('keyboardInset', () => {
  it('is what the visual viewport leaves uncovered at the foot', () => {
    expect(keyboardInset(844, { height: 844, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(844, { height: 508, offsetTop: 0 })).toBe(336);
    // Safari panned the visual viewport down: the keyboard still covers the same foot.
    expect(keyboardInset(844, { height: 508, offsetTop: 100 })).toBe(236);
  });

  it('clamps an offsetTop left over after the keyboard closed (iOS 26)', () => {
    expect(keyboardInset(844, { height: 844, offsetTop: 24 })).toBe(0);
    expect(keyboardInset(844, { height: 508, offsetTop: -12 })).toBe(336);
  });

  it('reports none for a pinch zoom or without a visual viewport', () => {
    expect(keyboardInset(844, { height: 400, offsetTop: 0, scale: 2 })).toBe(0);
    expect(keyboardInset(844, null)).toBe(0);
  });
});

describe('revealDelta', () => {
  const band = { top: 100, bottom: 500 };

  it('leaves a field inside the band where it is', () => {
    expect(revealDelta({ top: 200, bottom: 240 }, band)).toBe(0);
  });

  it('scrolls a field under the band up into it, with the margin', () => {
    expect(revealDelta({ top: 600, bottom: 640 }, band)).toBe(640 - (500 - REVEAL_MARGIN));
  });

  it('scrolls a field above the band down into it', () => {
    expect(revealDelta({ top: 40, bottom: 80 }, band)).toBe(40 - (100 + REVEAL_MARGIN));
  });

  it('keeps the top of a field taller than the band', () => {
    expect(revealDelta({ top: 300, bottom: 1000 }, band)).toBe(300 - (100 + REVEAL_MARGIN));
  });
});

/** A visual viewport whose height a test sets, as a keyboard would. */
class FakeViewport extends EventTarget {
  height = window.innerHeight;
  offsetTop = 0;
  scale = 1;
  set(height: number) {
    this.height = height;
    this.dispatchEvent(new Event('resize'));
  }
}

describe('watching the keyboard', () => {
  let viewport: FakeViewport;
  const real = Object.getOwnPropertyDescriptor(window, 'visualViewport');

  beforeEach(() => {
    viewport = new FakeViewport();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    resetCompactStore();
  });

  afterEach(() => {
    if (real) Object.defineProperty(window, 'visualViewport', real);
    else delete (window as { visualViewport?: unknown }).visualViewport;
    document.body.replaceChildren();
  });

  const variable = (name: string) => document.documentElement.style.getPropertyValue(name);

  it('writes --kb-inset and the free rectangle while watched, and removes them after', () => {
    const heard: number[] = [];
    const stop = watchKeyboard((state) => heard.push(state.inset));
    expect(variable('--kb-inset')).toBe('0px');
    viewport.set(window.innerHeight - 300);
    expect(variable('--kb-inset')).toBe('300px');
    expect(heard.at(-1)).toBe(300);
    // Typing: the free rectangle ends above the keyboard's Done.
    setTyping(true);
    expect(variable('--free-bottom')).toBe(`${300 + ACCESSORY_HEIGHT + 2 * ACCESSORY_GAP}px`);
    stop();
    expect(variable('--kb-inset')).toBe('');
    expect(variable('--free-bottom')).toBe('');
  });

  it('scrolls the reader so the field rises above the keyboard', async () => {
    const scroller = document.createElement('div');
    scroller.setAttribute('data-read-viewport', '');
    Object.assign(scroller.style, { position: 'fixed', inset: '0', overflow: 'auto' });
    const column = document.createElement('div');
    column.style.height = `${window.innerHeight * 3}px`;
    const field = document.createElement('textarea');
    Object.assign(field.style, {
      position: 'absolute',
      top: `${window.innerHeight - 200}px`,
      height: '40px',
    });
    column.append(field);
    scroller.append(column);
    document.body.append(scroller);
    setTyping(true);
    const stop = keepInView(field);
    await frame();
    expect(scroller.scrollTop).toBe(0);

    viewport.set(window.innerHeight - 300);
    await frame();
    await frame();
    const box = field.getBoundingClientRect();
    const doneTop = window.innerHeight - 300 - ACCESSORY_GAP - ACCESSORY_HEIGHT;
    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(box.bottom).toBeLessThanOrEqual(doneTop - ACCESSORY_GAP);
    // The scroller's foot is padded while the keyboard is up, and given back after.
    expect(scroller.style.paddingBottom).toBe(`${300 + ACCESSORY_HEIGHT}px`);
    stop();
    expect(scroller.style.paddingBottom).toBe('');
  });
});

describe('the Text tool', () => {
  afterEach(() => resetCompactStore());

  it('replaces the stub with its options and arms the text box', () => {
    const spec = compactTool('text');
    expect(spec?.Options).toBeDefined();
    expect(spec?.soon).toBeFalsy();
    spec?.arm?.('doc' as never);
    expect(useToolStore.getState().mode).toBe('text-box');
    expect(TEXT_SIZES).toHaveLength(3);
  });

  it('edits the topmost box a tap reaches, within the slop', () => {
    const boxes = [
      { id: 'a', rect: { left: 0, top: 0, right: 100, bottom: 40 } },
      { id: 'b', rect: { left: 50, top: 20, right: 150, bottom: 60 } },
    ];
    expect(boxAt(boxes, 60, 30)?.id).toBe('b');
    expect(boxAt(boxes, 10, 10)?.id).toBe('a');
    expect(boxAt(boxes, 155, 65)?.id).toBe('b');
    expect(boxAt(boxes, 300, 300)).toBeUndefined();
  });

  it('sends the island away while typing, and closes the drawer', () => {
    useCompactStore.setState({ editing: true, drawerOpen: true });
    setTyping(true);
    expect(capsuleAway(useCompactStore.getState())).toBe(true);
    expect(useCompactStore.getState().drawerOpen).toBe(false);
    setTyping(false);
    expect(capsuleAway(useCompactStore.getState())).toBe(false);
  });
});
