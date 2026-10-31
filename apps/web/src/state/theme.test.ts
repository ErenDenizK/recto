/**
 * The theme (ADR-0022 §2.4; spec D3-7): System · Light · Dark resolved onto `data-theme` and the
 * `theme-color` metas by `theme.ts`, and the same rule run by the boot script before the first
 * paint (`public/theme.js`), which this file executes against it for every setting and scheme.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import indexHtml from '../../index.html?raw';
import tokensCss from '../styles/tokens.css?raw';
import { LABS_KEY } from '../labs/stored';
import { APPEARANCE_STORAGE_KEY } from './appearance-store';
import { applyFener, FENER_STORAGE_KEY } from './fener';
import {
  applyTheme,
  FENER_THEME_COLOURS,
  resolveTheme,
  subscribeSystemTheme,
  THEME_COLOURS,
  THEME_SETTINGS,
  type ThemeSetting,
} from './theme';

/** A device that reports `scheme`, with a way to flip it. */
function emulateScheme(scheme: 'light' | 'dark') {
  let current = scheme;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(prefers-color-scheme: light)' && current === 'light';
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    flip(next: 'light' | 'dark') {
      current = next;
      for (const listener of listeners) listener();
    },
    listeners,
  };
}

/** A document head like index.html's: one theme-color per scheme. */
function headWithMetas(): HTMLMetaElement[] {
  return (['dark', 'light'] as const).map((scheme) => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.media = `(prefers-color-scheme: ${scheme})`;
    meta.content = THEME_COLOURS[scheme];
    document.head.append(meta);
    return meta;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const meta of document.head.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  for (const name of ['data-theme', 'data-fener', 'data-accent']) {
    document.documentElement.removeAttribute(name);
  }
  localStorage.removeItem(APPEARANCE_STORAGE_KEY);
  localStorage.removeItem(LABS_KEY);
  localStorage.removeItem(FENER_STORAGE_KEY);
  history.replaceState(null, '', location.pathname);
});

describe('the theme setting (ADR-0022 §2.4)', () => {
  it('resolves System to the device scheme and holds a chosen theme whatever it says', () => {
    expect(THEME_SETTINGS).toEqual(['system', 'light', 'dark']);
    const device = emulateScheme('dark');
    expect(resolveTheme('system')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    device.flip('light');
    expect(resolveTheme('system')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('writes data-theme and the theme colours: both a chosen theme’s, or each its scheme’s', () => {
    emulateScheme('dark');
    const [dark, light] = headWithMetas() as [HTMLMetaElement, HTMLMetaElement];
    const root = document.documentElement;
    expect(applyTheme(root, 'light')).toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    expect([dark.content, light.content]).toEqual(['#e6e8eb', '#e6e8eb']);
    applyTheme(root, 'dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect([dark.content, light.content]).toEqual(['#08090c', '#08090c']);
    applyTheme(root, 'system');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect([dark.content, light.content]).toEqual(['#08090c', '#e6e8eb']);
  });

  it('colours the browser’s chrome with Fener’s canvases while the root carries data-fener', () => {
    emulateScheme('dark');
    const [dark, light] = headWithMetas() as [HTMLMetaElement, HTMLMetaElement];
    const root = document.documentElement;
    applyFener(root, 'violet');
    applyTheme(root, 'light');
    expect([dark.content, light.content]).toEqual([
      FENER_THEME_COLOURS.light,
      FENER_THEME_COLOURS.light,
    ]);
    applyTheme(root, 'system');
    expect([dark.content, light.content]).toEqual([
      FENER_THEME_COLOURS.dark,
      FENER_THEME_COLOURS.light,
    ]);
    applyFener(root, null);
    applyTheme(root, 'system');
    expect([dark.content, light.content]).toEqual([THEME_COLOURS.dark, THEME_COLOURS.light]);
  });

  it('tells its subscribers when the device changes scheme', () => {
    const device = emulateScheme('dark');
    const heard = vi.fn();
    const unsubscribe = subscribeSystemTheme(heard);
    device.flip('light');
    expect(heard).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(device.listeners.size).toBe(0);
  });

  it('colours the browser’s chrome with each theme’s canvas, as index.html declares', () => {
    const canvasOf = (selector: RegExp) => {
      const body = selector.exec(tokensCss.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1] ?? '';
      const step = /--canvas:\s*var\((--n\d+)\)/.exec(body)?.[1] ?? '';
      return new RegExp(`${step}:\\s*(#[0-9a-f]{6})`).exec(body)?.[1];
    };
    expect(canvasOf(/:root,\s*\[data-theme='dark'\]\s*\{([^{}]*)\}/)).toBe(THEME_COLOURS.dark);
    expect(canvasOf(/\n\[data-theme='light'\]\s*\{([^{}]*)\}/)).toBe(THEME_COLOURS.light);
    const html = new DOMParser().parseFromString(indexHtml, 'text/html');
    const metas = [...html.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
      (meta) => [meta.media, meta.content],
    );
    expect(metas).toEqual([
      ['(prefers-color-scheme: dark)', THEME_COLOURS.dark],
      ['(prefers-color-scheme: light)', THEME_COLOURS.light],
    ]);
    expect(html.querySelector('meta[name="color-scheme"]')?.getAttribute('content')).toBe(
      'dark light',
    );
  });
});

describe('the boot script (public/theme.js), before the first paint', () => {
  // Served from `public/` at the root, as the app serves it (an import of `public/` is not).
  let bootScript = '';
  beforeAll(async () => {
    bootScript = await (await fetch('/theme.js')).text();
    expect(bootScript).toContain('pdf-editor:appearance:v1');
  });

  /** Runs the script as index.html does (a classic script, synchronously), then returns what it
   * wrote. */
  function boot() {
    const script = document.createElement('script');
    script.textContent = bootScript;
    document.head.append(script);
    script.remove();
    const metas = [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')];
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      colours: metas.map((meta) => meta.content),
    };
  }

  it('is loaded by index.html as a classic script in the head, before the body', () => {
    const html = new DOMParser().parseFromString(indexHtml, 'text/html');
    const script = html.head.querySelector('script[src$="theme.js"]');
    expect(script).not.toBeNull();
    expect(script?.getAttribute('type')).toBeNull();
    expect(script?.hasAttribute('defer')).toBe(false);
    expect(script?.hasAttribute('async')).toBe(false);
    expect(html.body.querySelector('script[src$="theme.js"]')).toBeNull();
  });

  it('writes what applyTheme writes, for every stored setting and device scheme', () => {
    const stored: (ThemeSetting | 'missing' | 'garbled')[] = [...THEME_SETTINGS, 'missing'];
    stored.push('garbled');
    for (const scheme of ['dark', 'light'] as const) {
      for (const setting of stored) {
        emulateScheme(scheme);
        const metas = headWithMetas();
        if (setting === 'missing') localStorage.removeItem(APPEARANCE_STORAGE_KEY);
        else if (setting === 'garbled') localStorage.setItem(APPEARANCE_STORAGE_KEY, '{nope');
        else
          localStorage.setItem(
            APPEARANCE_STORAGE_KEY,
            JSON.stringify({ theme: setting, glass: null }),
          );
        const booted = boot();
        const effective: ThemeSetting =
          setting === 'missing' || setting === 'garbled' ? 'system' : setting;
        document.documentElement.removeAttribute('data-theme');
        for (const meta of metas) meta.content = '';
        const theme = applyTheme(document.documentElement, effective);
        expect(booted, `${setting} on a ${scheme} device`).toEqual({
          theme,
          colours: metas.map((meta) => meta.content),
        });
        for (const meta of metas) meta.remove();
      }
    }
  });

  it('writes Fener’s attributes and canvases from the address or Labs, and the stored preset', () => {
    const cases: readonly {
      label: string;
      search: string;
      labs: unknown;
      kept: string | null;
      expected: 'indigo' | 'violet' | 'blue' | null;
    }[] = [
      { label: 'off', search: '', labs: null, kept: 'violet', expected: null },
      { label: 'address on', search: '?fener=1', labs: null, kept: null, expected: 'indigo' },
      {
        label: 'address off',
        search: '?fener=0',
        labs: { flags: { fener: '1' } },
        kept: 'blue',
        expected: null,
      },
      {
        label: 'Labs on, violet',
        search: '',
        labs: { flags: { fener: '1' } },
        kept: '{"accent":"violet"}',
        expected: 'violet',
      },
      {
        label: 'Labs on, blue',
        search: '?x=1',
        labs: { flags: { fener: '1' } },
        kept: '{"accent":"blue"}',
        expected: 'blue',
      },
      {
        label: 'Labs on, garbled',
        search: '',
        labs: { flags: { fener: '1' } },
        kept: '{nope',
        expected: 'indigo',
      },
      {
        label: 'Labs on, unknown',
        search: '',
        labs: { flags: { fener: '1' } },
        kept: '{"accent":"lime"}',
        expected: 'indigo',
      },
    ];
    for (const scheme of ['dark', 'light'] as const) {
      for (const c of cases) {
        emulateScheme(scheme);
        const metas = headWithMetas();
        history.replaceState(null, '', `${location.pathname}${c.search}`);
        if (c.labs === null) localStorage.removeItem(LABS_KEY);
        else localStorage.setItem(LABS_KEY, JSON.stringify(c.labs));
        if (c.kept === null) localStorage.removeItem(FENER_STORAGE_KEY);
        else localStorage.setItem(FENER_STORAGE_KEY, c.kept);
        const root = document.documentElement;
        const booted = boot();
        const seen = {
          fener: root.hasAttribute('data-fener'),
          accent: root.getAttribute('data-accent'),
          theme: booted.theme,
          colours: booted.colours,
        };
        // What the app writes: Fener first, then the theme.
        for (const name of ['data-theme', 'data-fener', 'data-accent']) root.removeAttribute(name);
        for (const meta of metas) meta.content = '';
        applyFener(root, c.expected);
        applyTheme(root, 'system');
        expect(seen, `${c.label} on a ${scheme} device`).toEqual({
          fener: c.expected !== null,
          accent: c.expected,
          theme: root.getAttribute('data-theme'),
          colours: metas.map((meta) => meta.content),
        });
        for (const name of ['data-fener', 'data-accent']) root.removeAttribute(name);
        for (const meta of metas) meta.remove();
      }
    }
  });
});
