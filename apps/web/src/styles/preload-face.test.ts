/**
 * The UI face's preload (ADR-0027 §2.1; decisions PRC-16): `public/preload-face.js`, run as the
 * pages run it, adds one `<link rel=preload as=font>` for the file its `data-href` names, in CORS
 * mode except in WebKit, whose same-origin `@font-face` fetch is no-cors (so each engine's face
 * reuses the preload instead of fetching the file again).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import aboutHtml from '../../about/index.html?raw';
import indexHtml from '../../index.html?raw';
import fontsCss from './fonts.css?raw';

const FILE = '/fonts/inter-recto-latin.woff2';

/** Runs the script as a classic script with `data-href`, then returns the preloads it added. */
function boot(script: string, href: string | null): HTMLLinkElement[] {
  const element = document.createElement('script');
  if (href !== null) element.dataset.href = href;
  element.textContent = script;
  document.head.append(element);
  element.remove();
  return [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"]')];
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const link of document.head.querySelectorAll('link[rel="preload"]')) link.remove();
});

describe('the face preload (public/preload-face.js)', () => {
  // Served from `public/` at the root, as the app serves it (an import of `public/` is not).
  let script = '';
  beforeAll(async () => {
    script = await (await fetch('/preload-face.js')).text();
    expect(script).toContain('dataset.href');
  });

  it('is loaded by both pages as a classic script in the head, naming the face’s Latin file', () => {
    for (const [page, source] of [
      ['index.html', indexHtml],
      ['about/index.html', aboutHtml],
    ] as const) {
      const html = new DOMParser().parseFromString(source, 'text/html');
      const element = html.head.querySelector<HTMLScriptElement>('script[src$="preload-face.js"]');
      expect(element, page).not.toBeNull();
      expect(element?.getAttribute('type'), page).toBeNull();
      expect(element?.hasAttribute('async'), page).toBe(false);
      expect(element?.hasAttribute('defer'), page).toBe(false);
      expect(element?.dataset.href, page).toBe(`%BASE_URL%${FILE.slice(1)}`);
      // The preload replaces the static link, which could not suit every engine.
      expect(html.head.querySelector('link[rel="preload"]'), page).toBeNull();
    }
    // The file the face declares (Vite prefixes the base path), so the preload is used.
    expect(fontsCss).toContain(`url('${FILE}') format('woff2')`);
  });

  it('preloads the file in CORS mode in Chromium and Firefox', () => {
    for (const vendor of ['Google Inc.', '']) {
      vi.spyOn(navigator, 'vendor', 'get').mockReturnValue(vendor);
      const links = boot(script, FILE);
      expect(links, vendor).toHaveLength(1);
      const [link] = links;
      expect(link?.as).toBe('font');
      expect(link?.type).toBe('font/woff2');
      expect(link?.getAttribute('crossorigin')).toBe('anonymous');
      expect(new URL(link?.href ?? '').pathname).toBe(FILE);
      link?.remove();
    }
  });

  it('preloads it without crossorigin in WebKit, as its face fetches it (no-cors)', () => {
    vi.spyOn(navigator, 'vendor', 'get').mockReturnValue('Apple Computer, Inc.');
    const links = boot(script, FILE);
    expect(links).toHaveLength(1);
    expect(links[0]?.as).toBe('font');
    expect(links[0]?.hasAttribute('crossorigin')).toBe(false);
    expect(new URL(links[0]?.href ?? '').pathname).toBe(FILE);
  });

  it('adds nothing when the page names no file', () => {
    expect(boot(script, null)).toEqual([]);
  });
});
