/*
 * The theme before the first paint (ADR-0022 §2.4; spec D3-7). A classic script in the head of
 * index.html, run before the body is parsed: it reads the Theme setting the app stores
 * (`pdf-editor:appearance:v1`, state/appearance-store.ts) and writes the theme in force onto the
 * root and the theme-color metas, so a Light choice on a dark device (or the reverse) never
 * flashes the other theme. It restates `applyTheme` of src/state/theme.ts in plain script (the
 * CSP allows no inline script, and nothing is bundled before it); src/state/theme.test.ts runs
 * this file against that function. The app takes over once it mounts, and follows the device
 * while the setting is System.
 */
/* global document, localStorage, matchMedia */
(() => {
  const colours = { dark: '#08090c', light: '#e6e8eb' };
  let setting = 'system';
  try {
    const stored = JSON.parse(localStorage.getItem('pdf-editor:appearance:v1') ?? 'null');
    if (stored && (stored.theme === 'light' || stored.theme === 'dark')) setting = stored.theme;
  } catch {
    // Storage blocked or unreadable: System.
  }
  const light =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
  const theme = setting === 'system' ? (light ? 'light' : 'dark') : setting;
  document.documentElement.setAttribute('data-theme', theme);
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('light') ? 'light' : 'dark';
    meta.content = colours[setting === 'system' ? scheme : theme];
  }
})();
