import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  APPEARANCE_STORAGE_KEY,
  applyAppearance,
  DEFAULT_APPEARANCE,
  effectiveGlass,
  loadAppearance,
  parseAppearance,
  useAppearanceRoot,
  useAppearanceStore,
} from './appearance-store';
import { resetRenderQuality, useRenderQualityStore } from './render-quality';

afterEach(() => {
  useAppearanceStore.setState(DEFAULT_APPEARANCE);
  localStorage.removeItem(APPEARANCE_STORAGE_KEY);
  resetRenderQuality();
});

describe('appearance settings', () => {
  it('starts on Theme System, Glass unpicked (the start state applies), Reduce motion System, Background glow on, Dim pages off', () => {
    expect(DEFAULT_APPEARANCE).toEqual({
      theme: 'system',
      glass: null,
      motion: 'system',
      glow: true,
      dimPages: false,
    });
    localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
    // Under automation the test build's override starts at Clear (spec X36).
    expect(effectiveGlass(null)).toBe('clear');
    expect(effectiveGlass('tinted')).toBe('tinted');
  });

  it('validates stored settings field by field', () => {
    for (const value of [undefined, null, 42, 'x', [], [true]]) {
      expect(parseAppearance(value)).toEqual(DEFAULT_APPEARANCE);
    }
    expect(
      parseAppearance({ theme: 'light', glass: 'tinted', motion: 'reduced', glow: false }),
    ).toEqual({
      theme: 'light',
      glass: 'tinted',
      motion: 'reduced',
      glow: false,
      dimPages: false,
    });
    // A stored value from before D3-7 (no theme), or a stray one, follows the system.
    expect(parseAppearance({ glass: 'tinted' }).theme).toBe('system');
    expect(parseAppearance({ theme: 'sepia' }).theme).toBe('system');
    expect(parseAppearance({ theme: true }).theme).toBe('system');
    expect(parseAppearance({ theme: 'dark' }).theme).toBe('dark');
    expect(parseAppearance({ glass: 'frosted' }).glass).toBeNull();
    expect(parseAppearance({ glass: true }).glass).toBeNull();
    // A stored value from before D3-4 (no motion), or a stray one, follows the system.
    expect(parseAppearance({ motion: 'on' }).motion).toBe('system');
    expect(parseAppearance({ motion: true }).motion).toBe('system');
    // A stored value from before G5 (no glow), or a stray one, keeps the glow on (the default).
    expect(parseAppearance({ theme: 'dark' }).glow).toBe(true);
    expect(parseAppearance({ glow: 'off' }).glow).toBe(true);
    expect(parseAppearance({ glow: false }).glow).toBe(false);
    // Dim pages (MOB-17) is on only when stored as `true`.
    expect(parseAppearance({ theme: 'dark' }).dimPages).toBe(false);
    expect(parseAppearance({ dimPages: 'on' }).dimPages).toBe(false);
    expect(parseAppearance({ dimPages: true }).dimPages).toBe(true);
  });

  it('migrates M8’s switches once: Reduce transparency on becomes Solid (ADR-0024 §2.4)', () => {
    expect(parseAppearance({ glassPanels: true, reduceTransparency: true }).glass).toBe('solid');
    expect(parseAppearance({ glassPanels: true, reduceTransparency: false }).glass).toBeNull();
    expect(parseAppearance({ reduceTransparency: 'yes' }).glass).toBeNull();
    // A choice already made wins over a stray old field.
    expect(parseAppearance({ glass: 'clear', reduceTransparency: true }).glass).toBe('clear');
    localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify({ glassPanels: true, reduceTransparency: true, motion: 'reduced' }),
    );
    expect(loadAppearance()).toEqual({
      theme: 'system',
      glass: 'solid',
      motion: 'reduced',
      glow: true,
      dimPages: false,
    });
    // Written back in the new shape, so the migration runs once.
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? 'null')).toEqual({
      theme: 'system',
      glass: 'solid',
      motion: 'reduced',
      glow: true,
      dimPages: false,
    });
  });

  it('persists each change under its versioned key', () => {
    useAppearanceStore.getState().setGlass('tinted');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? 'null')).toEqual({
      theme: 'system',
      glass: 'tinted',
      motion: 'system',
      glow: true,
      dimPages: false,
    });
    useAppearanceStore.getState().setGlass('solid');
    useAppearanceStore.getState().setMotion('reduced');
    useAppearanceStore.getState().setTheme('light');
    useAppearanceStore.getState().setGlow(false);
    useAppearanceStore.getState().setDimPages(true);
    expect(loadAppearance()).toEqual({
      theme: 'light',
      glass: 'solid',
      motion: 'reduced',
      glow: false,
      dimPages: true,
    });
  });

  it('writes the settings as root attributes', () => {
    const root = document.createElement('div');
    applyAppearance(root, { theme: 'light', glass: 'solid', motion: 'reduced' });
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-glass')).toBe('solid');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    applyAppearance(root, DEFAULT_APPEARANCE);
    // System, in a browser that reports a dark scheme (vitest.config.ts).
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-glass')).toBe('clear');
    expect(root.hasAttribute('data-motion')).toBe(false);
    expect(root.hasAttribute('data-dim-pages')).toBe(false);
    applyAppearance(root, { ...DEFAULT_APPEARANCE, dimPages: true });
    expect(root.hasAttribute('data-dim-pages')).toBe(true);
  });

  it('keeps the document element in step while mounted, and clears it after', () => {
    const root = document.documentElement;
    const { unmount } = renderHook(() => useAppearanceRoot());
    expect(root.getAttribute('data-glass')).toBe('clear');
    expect(root.hasAttribute('data-degrade')).toBe(false);
    expect(root.getAttribute('data-theme')).toBe('dark');
    act(() => {
      useAppearanceStore.getState().setTheme('light');
      useAppearanceStore.getState().setGlass('tinted');
      useAppearanceStore.getState().setMotion('reduced');
      useAppearanceStore.getState().setDimPages(true);
    });
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.hasAttribute('data-dim-pages')).toBe(true);
    expect(root.getAttribute('data-glass')).toBe('tinted');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    act(() => useRenderQualityStore.getState().stepDown());
    expect(root.getAttribute('data-degrade')).toBe('1');
    unmount();
    expect(root.hasAttribute('data-glass')).toBe(false);
    expect(root.hasAttribute('data-motion')).toBe(false);
    expect(root.hasAttribute('data-degrade')).toBe(false);
    expect(root.hasAttribute('data-dim-pages')).toBe(false);
    // The theme stays: the boot script owns it from the first paint (theme.ts).
    expect(root.getAttribute('data-theme')).toBe('light');
    root.removeAttribute('data-theme');
  });

  it('makes every tier solid under Glass Solid and dense under Tinted (computed styles)', async () => {
    await import('../styles/tokens.css');
    const root = document.documentElement;
    const read = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
    expect(read('--glass-panel-filter')).not.toBe('none');
    root.setAttribute('data-glass', 'solid');
    try {
      for (const tier of ['chip', 'bar', 'panel', 'menu', 'sheet', 'lit']) {
        expect(read(`--glass-${tier}-filter`), tier).toBe('none');
        expect(read(`--glass-${tier}-tint`), tier).toBe(read(`--glass-${tier}-solid`));
      }
      root.setAttribute('data-glass', 'tinted');
      for (const tier of ['chip', 'bar', 'panel', 'menu', 'sheet', 'lit']) {
        expect(read(`--glass-${tier}-alpha`), tier).toBe('0.9');
        expect(read(`--glass-${tier}-filter`), tier).not.toBe('none');
      }
    } finally {
      root.removeAttribute('data-glass');
    }
  });

  it('dims the paper only in the dark theme with Dim pages on (computed styles, MOB-17)', async () => {
    await import('../styles/tokens.css');
    const root = document.documentElement;
    const read = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
    root.setAttribute('data-theme', 'dark');
    try {
      expect(read('--page-filter')).toBe('none');
      expect(read('--page-background')).toBe('#ffffff');
      root.setAttribute('data-dim-pages', '');
      expect(read('--page-filter')).toBe('brightness(0.8)');
      expect(read('--page-background')).toBe('#cccccc');
      root.setAttribute('data-theme', 'light');
      expect(read('--page-filter')).toBe('none');
      expect(read('--page-background')).toBe('#ffffff');
    } finally {
      root.removeAttribute('data-dim-pages');
      root.removeAttribute('data-theme');
    }
  });
});
