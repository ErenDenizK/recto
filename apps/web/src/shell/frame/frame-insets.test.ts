import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  BAND_OFFSET,
  BAND_OFFSET_COMPACT,
  type FrameMeasure,
  freeInsets,
  freeInsetVars,
  insetsFromPadding,
  measureFrame,
  readSafeAreaInsets,
  sameInsets,
  useFloatingBottomChrome,
  useSafeAreaInsets,
  withMinimum,
  ZERO_INSETS,
} from './frame-insets';

describe('safe-area insets as numbers', () => {
  const made: HTMLElement[] = [];
  afterEach(() => {
    for (const element of made.splice(0)) element.remove();
  });

  it('reads an element’s padding as insets (the probe’s mechanism)', () => {
    const element = document.createElement('div');
    // An iPhone in portrait: status bar 47, home indicator 34.
    element.style.padding = '47px 0px 34px 0px';
    document.body.append(element);
    made.push(element);
    expect(insetsFromPadding(element)).toEqual({ top: 47, right: 0, bottom: 34, left: 0 });
  });

  it('keeps fractional insets and treats anything unreadable as zero', () => {
    const element = document.createElement('div');
    element.style.padding = '20.5px 47px 21px 47px';
    document.body.append(element);
    made.push(element);
    expect(insetsFromPadding(element)).toEqual({ top: 20.5, right: 47, bottom: 21, left: 47 });
  });

  it('is zero on a desktop browser, which has no safe area', () => {
    expect(readSafeAreaInsets()).toEqual(ZERO_INSETS);
    // One probe, reused.
    readSafeAreaInsets();
    expect(document.querySelectorAll('[data-safe-area-probe]')).toHaveLength(1);
  });

  it('applies the frame’s minimum per side', () => {
    expect(withMinimum({ top: 47, right: 0, bottom: 34, left: 0 }, 8)).toEqual({
      top: 47,
      right: 8,
      bottom: 34,
      left: 8,
    });
  });

  it('compares insets by value', () => {
    expect(sameInsets(ZERO_INSETS, { top: 0, right: 0, bottom: 0, left: 0 })).toBe(true);
    expect(sameInsets(ZERO_INSETS, { top: 0, right: 0, bottom: 1, left: 0 })).toBe(false);
  });

  it('the hook answers a stable snapshot', () => {
    const { result, rerender } = renderHook(() => useSafeAreaInsets());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first).toEqual(ZERO_INSETS);
  });
});

describe('the free rectangle (01-frame F1 §2)', () => {
  /** The large class at 1440 × 900 on a fine pointer, sidebar closed, at rest. */
  const large: FrameMeasure = {
    width: 1440,
    top: 44,
    sidebar: 0,
    sidebarDocked: true,
    band: 44,
    offset: BAND_OFFSET,
    focus: false,
  };

  it('leaves out the strip and the dock band at rest', () => {
    expect(freeInsets(large)).toEqual({ top: 44, right: 0, bottom: 60, left: 0 });
  });

  it('insets the docked sidebar from expanded up, never the overlay one (medium)', () => {
    expect(freeInsets({ ...large, sidebar: 280 }).left).toBe(280);
    expect(freeInsets({ ...large, sidebar: 320, sidebarDocked: false }).left).toBe(0);
  });

  it('insets nothing on the right: no panel docks there since the inspector left (D2-9)', () => {
    expect(freeInsets({ ...large, sidebar: 280 }).right).toBe(0);
  });

  it('keeps the offset alone in Focus, and nothing on the Library (no band item)', () => {
    expect(freeInsets({ ...large, focus: true }).bottom).toBe(BAND_OFFSET);
    expect(freeInsets({ ...large, band: 0 }).bottom).toBe(0);
  });

  it('grows with a taller band item (the palette) and uses 12 px on compact', () => {
    expect(freeInsets({ ...large, band: 64 }).bottom).toBe(80);
    const compact = { ...large, width: 390, offset: BAND_OFFSET_COMPACT, band: 44 };
    expect(freeInsets(compact).bottom).toBe(56);
  });

  it('writes the custom properties the stage, band, soft edge and toasts read', () => {
    expect(freeInsetVars({ top: 44, right: 0, bottom: 60, left: 280 })).toEqual({
      '--free-top': '44px',
      '--free-right': '0px',
      '--free-bottom': '60px',
      '--free-left': '280px',
    });
  });

  it('measures the layers by their offset sizes, ignoring transforms in flight', () => {
    const shell = document.createElement('div');
    shell.style.cssText = 'position: relative; width: 1000px; height: 600px;';
    const top = document.createElement('header');
    top.dataset.frameLayer = 'top';
    top.style.cssText = 'height: 44px; transform: translateY(-44px);';
    const sidebar = document.createElement('aside');
    sidebar.dataset.frameLayer = 'sidebar';
    sidebar.style.cssText = 'width: 280px; height: 10px;';
    const band = document.createElement('div');
    band.dataset.frameLayer = 'band';
    const dock = document.createElement('div');
    dock.dataset.bandItem = '';
    dock.style.cssText = 'height: 48px; transform: translateY(20px);';
    band.append(dock);
    shell.append(top, sidebar, band);
    document.body.append(shell);
    try {
      const measure = measureFrame(shell, { sidebarDocked: true, offset: 16, focus: false });
      expect(measure).toMatchObject({ width: 1000, top: 44, sidebar: 280, band: 48 });
      expect(freeInsets(measure)).toEqual({ top: 44, right: 0, bottom: 64, left: 280 });
    } finally {
      shell.remove();
    }
  });
});

describe('floating bottom chrome (08-feedback FB4 §2)', () => {
  it('reports how high a bar outside the band rises, ignoring its entrance transform', () => {
    const root = document.documentElement;
    const view = document.createElement('div');
    view.style.cssText = 'position: fixed; inset: 0;';
    const bar = document.createElement('div');
    bar.style.cssText =
      'position: absolute; bottom: 16px; left: 0; height: 44px; width: 200px; transform: translateY(8px);';
    view.append(bar);
    document.body.append(view);
    try {
      const { unmount } = renderHook(() => useFloatingBottomChrome({ current: bar }));
      expect(root.style.getPropertyValue('--chrome-float')).toBe('60px');
      unmount();
      expect(root.style.getPropertyValue('--chrome-float')).toBe('');
    } finally {
      view.remove();
    }
  });
});
