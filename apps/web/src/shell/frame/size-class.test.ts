import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyFrameClass,
  createFrameClassSource,
  frameClassOf,
  isCompactHeight,
  isTight,
  sizeClassOf,
  useSizeClass,
  type ViewportSource,
} from './size-class';

/** A window stand-in whose size the test sets, with a working `resize` event. */
function fakeWindow(width: number, height: number) {
  const listeners = new Set<() => void>();
  const size = { width, height };
  const win: ViewportSource & { resize(w: number, h: number): void; readonly listeners: number } = {
    get innerWidth() {
      return size.width;
    },
    get innerHeight() {
      return size.height;
    },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    resize(w, h) {
      size.width = w;
      size.height = h;
      for (const listener of listeners) listener();
    },
    get listeners() {
      return listeners.size;
    },
  };
  return win;
}

describe('size classes (ADR-0031 §2 item 1)', () => {
  it.each([
    [0, 'compact'],
    [320, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [839, 'medium'],
    [840, 'expanded'],
    [1199, 'expanded'],
    [1200, 'large'],
    [1599, 'large'],
    [1600, 'xlarge'],
    [2560, 'xlarge'],
  ] as const)('%i px wide is %s', (width, expected) => {
    expect(sizeClassOf(width)).toBe(expected);
  });

  it('flags compact-height below 480 high and 1000 wide, a phone on its side', () => {
    expect(isCompactHeight(844, 390)).toBe(true);
    expect(isCompactHeight(999, 479)).toBe(true);
    expect(isCompactHeight(1000, 479)).toBe(false);
    expect(isCompactHeight(999, 480)).toBe(false);
    expect(isCompactHeight(390, 844)).toBe(false);
  });

  it('flags tight below 352 high at any width', () => {
    expect(isTight(351)).toBe(true);
    expect(isTight(352)).toBe(false);
    // 320 × 256: a desktop at 400 % zoom (A-20).
    expect(frameClassOf(320, 256)).toEqual({ size: 'compact', short: true, tight: true });
    expect(frameClassOf(1440, 300)).toEqual({ size: 'large', short: false, tight: true });
  });

  it('classifies the reference sizes of the frame spec', () => {
    expect(frameClassOf(390, 844)).toEqual({ size: 'compact', short: false, tight: false });
    expect(frameClassOf(844, 390)).toEqual({ size: 'expanded', short: true, tight: false });
    expect(frameClassOf(820, 1180)).toEqual({ size: 'medium', short: false, tight: false });
    expect(frameClassOf(1180, 820)).toEqual({ size: 'expanded', short: false, tight: false });
    expect(frameClassOf(1440, 900)).toEqual({ size: 'large', short: false, tight: false });
    expect(frameClassOf(1920, 1080)).toEqual({ size: 'xlarge', short: false, tight: false });
  });
});

describe('the frame class source', () => {
  it('answers the same object until the class changes', () => {
    const win = fakeWindow(1440, 900);
    const source = createFrameClassSource(win);
    const first = source.get();
    win.resize(1500, 880);
    expect(source.get()).toBe(first);
    win.resize(800, 880);
    expect(source.get()).not.toBe(first);
    expect(source.get().size).toBe('medium');
  });

  it('calls back on resize (rotation and zoom fire it too) until unsubscribed', () => {
    const win = fakeWindow(390, 844);
    const source = createFrameClassSource(win);
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);
    win.resize(844, 390);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.get()).toEqual({ size: 'expanded', short: true, tight: false });
    unsubscribe();
    expect(win.listeners).toBe(0);
  });
});

describe('the root attributes', () => {
  afterEach(() => {
    const root = document.documentElement;
    delete root.dataset.size;
    root.removeAttribute('data-short');
    root.removeAttribute('data-tight');
  });

  it('writes data-size and toggles data-short and data-tight', () => {
    const root = document.createElement('div');
    applyFrameClass(root, { size: 'expanded', short: true, tight: false });
    expect(root.dataset.size).toBe('expanded');
    expect(root.hasAttribute('data-short')).toBe(true);
    expect(root.hasAttribute('data-tight')).toBe(false);
    applyFrameClass(root, { size: 'compact', short: false, tight: true });
    expect(root.dataset.size).toBe('compact');
    expect(root.hasAttribute('data-short')).toBe(false);
    expect(root.hasAttribute('data-tight')).toBe(true);
  });

  it('useSizeClass mirrors the window on :root', () => {
    const { result } = renderHook(() => useSizeClass());
    expect(result.current).toEqual(frameClassOf(window.innerWidth, window.innerHeight));
    expect(document.documentElement.dataset.size).toBe(result.current.size);
    expect(document.documentElement.hasAttribute('data-short')).toBe(result.current.short);
  });
});
