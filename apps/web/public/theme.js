/*
 * The theme before the first paint (ADR-0022 §2.4; spec D3-7). A classic script in the head of
 * index.html, run before the body is parsed: it reads the Theme setting the app stores
 * (`pdf-editor:appearance:v1`, state/appearance-store.ts) and writes the theme in force onto the
 * root and the theme-color metas, so a Light choice on a dark device (or the reverse) never
 * flashes the other theme. It restates `applyTheme` of src/state/theme.ts in plain script (the
 * CSP allows no inline script, and nothing is bundled before it); src/state/theme.test.ts runs
 * this file against that function. The app takes over once it mounts, and follows the device
 * while the setting is System.
 *
 * The tone flag (`?tone=beam|harbour|tideline`, tokens.css §8) rides here too, so its accent is
 * in force at first paint: the query is kept for the tab's session like `?top`
 * (`shell/compact/top-variant.ts`), `?tone=off` clears it, no flag leaves `data-tone` unset.
 */
/* global document, localStorage, location, matchMedia, sessionStorage, URLSearchParams */
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
  const asked = new URLSearchParams(location.search).get('tone');
  let tone = asked;
  try {
    if (asked === 'off') sessionStorage.removeItem('pdf-editor:tone:v1');
    else if (asked === 'beam' || asked === 'harbour' || asked === 'tideline')
      sessionStorage.setItem('pdf-editor:tone:v1', asked);
    else tone = sessionStorage.getItem('pdf-editor:tone:v1');
  } catch {
    // Storage blocked: the query still applies to this load.
  }
  if (tone === 'beam' || tone === 'harbour' || tone === 'tideline') {
    document.documentElement.setAttribute('data-tone', tone);
  }
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('light') ? 'light' : 'dark';
    meta.content = colours[setting === 'system' ? scheme : theme];
  }
})();
