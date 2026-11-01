/**
 * Fener's flag, preset and root attributes (DSN-88): off by default and written onto the root
 * only while on; the preset is one of three, kept per device in `pdf-editor:fener:v1`, and any
 * other stored value reads as the default.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { applyAppearance, DEFAULT_APPEARANCE, useAppearanceRoot } from './appearance-store';
import {
  applyFener,
  decideFener,
  DEFAULT_FENER_PRESET,
  FENER_PRESETS,
  FENER_STORAGE_KEY,
  fenerEnabled,
  parseFenerPreset,
  setFenerForTests,
  useFenerStore,
} from './fener';
import { readJson } from './safe-storage';

beforeEach(() => {
  localStorage.clear();
  useFenerStore.setState({ accent: DEFAULT_FENER_PRESET });
});

afterEach(() => {
  setFenerForTests(null);
  const root = document.documentElement;
  for (const name of ['data-fener', 'data-accent', 'data-theme']) root.removeAttribute(name);
});

describe('the flag', () => {
  it('is decided by the address when it says anything, else by Labs', () => {
    expect(decideFener('', null)).toBe(false);
    expect(decideFener('', '1')).toBe(true);
    expect(decideFener('', '0')).toBe(false);
    expect(decideFener('?fener=1', null)).toBe(true);
    expect(decideFener('?fener=0', '1')).toBe(false);
    expect(decideFener('?fener=yes', '1')).toBe(false);
    expect(decideFener('?other=1', '1')).toBe(true);
  });

  it('is off unless the address or Labs turns it on', () => {
    expect(fenerEnabled()).toBe(false);
    setFenerForTests(true);
    expect(fenerEnabled()).toBe(true);
    setFenerForTests(null);
    expect(fenerEnabled()).toBe(false);
  });
});

describe('the preset', () => {
  it('lists Çivit, Mor, Mavi and starts on Çivit', () => {
    expect([...FENER_PRESETS]).toEqual(['indigo', 'violet', 'blue']);
    expect(DEFAULT_FENER_PRESET).toBe('indigo');
    expect(useFenerStore.getState().accent).toBe('indigo');
  });

  it('reads the stored object, and anything else as the default', () => {
    expect(parseFenerPreset({ accent: 'violet' })).toBe('violet');
    expect(parseFenerPreset({ accent: 'blue' })).toBe('blue');
    for (const bad of [undefined, null, 3, 'blue', {}, { accent: 'lime' }, { accent: ['blue'] }]) {
      expect(parseFenerPreset(bad), JSON.stringify(bad)).toBe('indigo');
    }
  });

  it('keeps a choice per device under pdf-editor:fener:v1', () => {
    expect(FENER_STORAGE_KEY).toBe('pdf-editor:fener:v1');
    expect(localStorage.getItem(FENER_STORAGE_KEY)).toBeNull();
    useFenerStore.getState().setAccent('violet');
    expect(JSON.parse(localStorage.getItem(FENER_STORAGE_KEY) ?? 'null')).toEqual({
      accent: 'violet',
    });
    expect(parseFenerPreset(JSON.parse(localStorage.getItem(FENER_STORAGE_KEY) ?? 'null'))).toBe(
      'violet',
    );
    // Damaged storage reads as the default.
    localStorage.setItem(FENER_STORAGE_KEY, '{not json');
    expect(readJson(FENER_STORAGE_KEY)).toBeUndefined();
    expect(parseFenerPreset(readJson(FENER_STORAGE_KEY))).toBe('indigo');
  });
});

describe('the root attributes', () => {
  it('writes data-fener and data-accent, and takes both off with null', () => {
    const root = document.createElement('div');
    applyFener(root, 'blue');
    expect(root.hasAttribute('data-fener')).toBe(true);
    expect(root.getAttribute('data-accent')).toBe('blue');
    applyFener(root, 'violet');
    expect(root.getAttribute('data-accent')).toBe('violet');
    applyFener(root, null);
    expect(root.hasAttribute('data-fener')).toBe(false);
    expect(root.hasAttribute('data-accent')).toBe(false);
  });

  it('is part of the appearance only with an accent given', () => {
    const root = document.createElement('div');
    applyAppearance(root, DEFAULT_APPEARANCE);
    expect(root.hasAttribute('data-fener')).toBe(false);
    applyAppearance(root, { ...DEFAULT_APPEARANCE, accent: 'violet' });
    expect(root.getAttribute('data-accent')).toBe('violet');
    applyAppearance(root, { ...DEFAULT_APPEARANCE, accent: null });
    expect(root.hasAttribute('data-fener')).toBe(false);
  });

  it('puts the preset on the document element while mounted with the flag on, and clears it', () => {
    const root = document.documentElement;
    setFenerForTests(true);
    const { unmount } = renderHook(() => useAppearanceRoot());
    expect(root.hasAttribute('data-fener')).toBe(true);
    expect(root.getAttribute('data-accent')).toBe('indigo');
    act(() => useFenerStore.getState().setAccent('blue'));
    expect(root.getAttribute('data-accent')).toBe('blue');
    unmount();
    expect(root.hasAttribute('data-fener')).toBe(false);
    expect(root.hasAttribute('data-accent')).toBe(false);
  });

  it('writes nothing with the flag off, whatever preset a device kept', () => {
    const root = document.documentElement;
    useFenerStore.setState({ accent: 'violet' });
    const { unmount } = renderHook(() => useAppearanceRoot());
    expect(root.hasAttribute('data-fener')).toBe(false);
    expect(root.hasAttribute('data-accent')).toBe(false);
    unmount();
  });
});
