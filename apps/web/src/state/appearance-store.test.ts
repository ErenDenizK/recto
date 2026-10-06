import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  APPEARANCE_STORAGE_KEY,
  applyAppearance,
  DEFAULT_APPEARANCE,
  loadAppearance,
  parseAppearance,
  useAppearanceRoot,
  useAppearanceStore,
} from './appearance-store';

afterEach(() => {
  useAppearanceStore.setState(DEFAULT_APPEARANCE);
  localStorage.removeItem(APPEARANCE_STORAGE_KEY);
});

describe('appearance settings', () => {
  it('defaults the switches to off and Reduce motion to System', () => {
    expect(DEFAULT_APPEARANCE).toEqual({
      glassPanels: false,
      reduceTransparency: false,
      motion: 'system',
    });
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
  });

  it('validates stored settings field by field', () => {
    for (const value of [undefined, null, 42, 'x', [], [true]]) {
      expect(parseAppearance(value)).toEqual(DEFAULT_APPEARANCE);
    }
    expect(parseAppearance({ glassPanels: true, reduceTransparency: 'yes' })).toEqual({
      glassPanels: true,
      reduceTransparency: false,
      motion: 'system',
    });
    expect(
      parseAppearance({ glassPanels: 1, reduceTransparency: true, motion: 'reduced' }),
    ).toEqual({
      glassPanels: false,
      reduceTransparency: true,
      motion: 'reduced',
    });
    // A stored value from before D3-4 (no motion), or a stray one, follows the system.
    expect(parseAppearance({ motion: 'on' }).motion).toBe('system');
    expect(parseAppearance({ motion: true }).motion).toBe('system');
  });

  it('persists each change under its versioned key', () => {
    useAppearanceStore.getState().setGlassPanels(true);
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? 'null')).toEqual({
      glassPanels: true,
      reduceTransparency: false,
      motion: 'system',
    });
    useAppearanceStore.getState().setReduceTransparency(true);
    expect(loadAppearance()).toMatchObject({ glassPanels: true, reduceTransparency: true });
    useAppearanceStore.getState().setGlassPanels(false);
    expect(loadAppearance()).toMatchObject({ glassPanels: false, reduceTransparency: true });
    useAppearanceStore.getState().setMotion('reduced');
    expect(loadAppearance().motion).toBe('reduced');
  });

  it('writes the settings as root attributes', () => {
    const root = document.createElement('div');
    applyAppearance(root, { glassPanels: true, reduceTransparency: true, motion: 'reduced' });
    expect(root.hasAttribute('data-glass-panels')).toBe(true);
    expect(root.getAttribute('data-transparency')).toBe('reduced');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    applyAppearance(root, DEFAULT_APPEARANCE);
    expect(root.hasAttribute('data-glass-panels')).toBe(false);
    expect(root.hasAttribute('data-transparency')).toBe(false);
    expect(root.hasAttribute('data-motion')).toBe(false);
  });

  it('keeps the document element in step while mounted, and clears it after', () => {
    const root = document.documentElement;
    const { unmount } = renderHook(() => useAppearanceRoot());
    expect(root.hasAttribute('data-glass-panels')).toBe(false);
    act(() => {
      useAppearanceStore.getState().setGlassPanels(true);
      useAppearanceStore.getState().setReduceTransparency(true);
      useAppearanceStore.getState().setMotion('reduced');
    });
    expect(root.hasAttribute('data-glass-panels')).toBe(true);
    expect(root.getAttribute('data-transparency')).toBe('reduced');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    unmount();
    expect(root.hasAttribute('data-glass-panels')).toBe(false);
    expect(root.hasAttribute('data-transparency')).toBe(false);
    expect(root.hasAttribute('data-motion')).toBe(false);
  });

  it('makes every glass tier solid under the switch (computed styles)', async () => {
    await import('../styles/tokens.css');
    const root = document.documentElement;
    const read = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
    expect(read('--glass-frame-filter')).not.toBe('none');
    root.setAttribute('data-transparency', 'reduced');
    try {
      expect(read('--glass-filter')).toBe('none');
      expect(read('--glass-frame-filter')).toBe('none');
      expect(read('--glass-menu-filter')).toBe('none');
      expect(read('--glass-frame')).toBe(read('--surface-1'));
    } finally {
      root.removeAttribute('data-transparency');
    }
  });
});
