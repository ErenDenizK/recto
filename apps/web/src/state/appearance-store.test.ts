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
  it('leaves Glass unpicked (the start state applies) and Reduce motion on System', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ glass: null, motion: 'system' });
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
    expect(parseAppearance({ glass: 'tinted', motion: 'reduced' })).toEqual({
      glass: 'tinted',
      motion: 'reduced',
    });
    expect(parseAppearance({ glass: 'frosted' }).glass).toBeNull();
    expect(parseAppearance({ glass: true }).glass).toBeNull();
    // A stored value from before D3-4 (no motion), or a stray one, follows the system.
    expect(parseAppearance({ motion: 'on' }).motion).toBe('system');
    expect(parseAppearance({ motion: true }).motion).toBe('system');
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
    expect(loadAppearance()).toEqual({ glass: 'solid', motion: 'reduced' });
    // Written back in the new shape, so the migration runs once.
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? 'null')).toEqual({
      glass: 'solid',
      motion: 'reduced',
    });
  });

  it('persists each change under its versioned key', () => {
    useAppearanceStore.getState().setGlass('tinted');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY) ?? 'null')).toEqual({
      glass: 'tinted',
      motion: 'system',
    });
    useAppearanceStore.getState().setGlass('solid');
    useAppearanceStore.getState().setMotion('reduced');
    expect(loadAppearance()).toEqual({ glass: 'solid', motion: 'reduced' });
  });

  it('writes the settings as root attributes', () => {
    const root = document.createElement('div');
    applyAppearance(root, { glass: 'solid', motion: 'reduced' });
    expect(root.getAttribute('data-glass')).toBe('solid');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    applyAppearance(root, DEFAULT_APPEARANCE);
    expect(root.getAttribute('data-glass')).toBe('clear');
    expect(root.hasAttribute('data-motion')).toBe(false);
  });

  it('keeps the document element in step while mounted, and clears it after', () => {
    const root = document.documentElement;
    const { unmount } = renderHook(() => useAppearanceRoot());
    expect(root.getAttribute('data-glass')).toBe('clear');
    expect(root.hasAttribute('data-degrade')).toBe(false);
    act(() => {
      useAppearanceStore.getState().setGlass('tinted');
      useAppearanceStore.getState().setMotion('reduced');
    });
    expect(root.getAttribute('data-glass')).toBe('tinted');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    act(() => useRenderQualityStore.getState().stepDown());
    expect(root.getAttribute('data-degrade')).toBe('1');
    unmount();
    expect(root.hasAttribute('data-glass')).toBe(false);
    expect(root.hasAttribute('data-motion')).toBe(false);
    expect(root.hasAttribute('data-degrade')).toBe(false);
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
});
