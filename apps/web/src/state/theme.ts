/**
 * The theme (ADR-0022 §2.4; language.md §1.3; spec D3-7): **System · Light · Dark**, default
 * System, the two themes equal. The setting lives in `appearance-store`; this module resolves it
 * and writes it onto the document, with no store of its own, so the boot script and the app
 * agree on one rule.
 *
 * - **Resolved, always.** The root carries `data-theme="light"` or `"dark"` whenever the app has
 *   run: Light or Dark as chosen, System as the device's `prefers-color-scheme` now (and again
 *   whenever it changes, `subscribeSystemTheme`). Every light rule keys on that one attribute:
 *   the theme block of `tokens.css`, the light σ lines and lens of `materials.css`, the few
 *   module rules that differ by theme. `tokens.css` repeats its light block under the media query
 *   for a root without the attribute, a page that has not run the script.
 * - **Before the first paint.** `public/theme.js`, a classic script in `index.html`'s head (CSP
 *   `script-src 'self'` allows no inline one), reads the stored setting and writes the same
 *   attribute and theme colour before the body is parsed, so a Light choice on a dark device
 *   never flashes dark. It restates this module's rule in plain script; `theme.test.ts` runs it
 *   against `applyTheme` for every setting and scheme.
 * - **`theme-color`.** `index.html` gives one per scheme (`#08090c`, `#e6e8eb`: each theme's
 *   canvas). A chosen theme sets both to its own colour, so the browser's chrome follows the
 *   choice rather than the device; System puts each back to its scheme's.
 */

export type ThemeSetting = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_SETTINGS: readonly ThemeSetting[] = ['system', 'light', 'dark'];

/** Each theme's canvas (`--canvas`, tokens.css §1 and §2), the browser chrome's colour. */
export const THEME_COLOURS: Readonly<Record<Theme, string>> = {
  dark: '#08090c',
  light: '#e6e8eb',
};

const LIGHT_QUERY = '(prefers-color-scheme: light)';

const lightList = (): MediaQueryList | null =>
  typeof matchMedia === 'function' ? matchMedia(LIGHT_QUERY) : null;

/** The device's scheme; dark when it says nothing (dark is the app's first theme). */
export function systemTheme(): Theme {
  return lightList()?.matches ? 'light' : 'dark';
}

/** The theme a setting puts in force now. */
export function resolveTheme(setting: ThemeSetting): Theme {
  return setting === 'system' ? systemTheme() : setting;
}

/** Calls `listener` whenever the device's scheme changes. */
export function subscribeSystemTheme(listener: () => void): () => void {
  const list = lightList();
  list?.addEventListener('change', listener);
  return () => list?.removeEventListener('change', listener);
}

/**
 * Writes the theme a setting puts in force onto `root` (`data-theme`) and the document's
 * `theme-color` metas, and returns it.
 */
export function applyTheme(root: HTMLElement, setting: ThemeSetting): Theme {
  const theme = resolveTheme(setting);
  if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
  for (const meta of root.ownerDocument.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )) {
    const scheme: Theme = meta.media.includes('light') ? 'light' : 'dark';
    meta.content = THEME_COLOURS[setting === 'system' ? scheme : theme];
  }
  return theme;
}
