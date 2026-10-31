/*
 * The theme before the first paint (ADR-0022 §2.4; spec D3-7). A classic script in the head of
 * index.html, run before the body is parsed: it reads the Theme setting the app stores
 * (`pdf-editor:appearance:v1`, state/appearance-store.ts) and writes the theme in force onto the
 * root and the theme-color metas, so a Light choice on a dark device (or the reverse) never
 * flashes the other theme. It restates `applyTheme` of src/state/theme.ts in plain script (the
 * CSP allows no inline script, and nothing is bundled before it); src/state/theme.test.ts runs
 * this file against that function. It also writes Fener's `data-fener` and `data-accent` (DSN-88,
 * `state/fener.ts`: the address `?fener=1|0`, else the Labs toggle in `pdf-editor:labs:v1`, and
 * the preset in `pdf-editor:fener:v1`), so a Fener user never sees today's colours first, and
 * the metas take Fener's canvases. The app takes over once it mounts, and follows the device
 * while the setting is System.
 */
/* global document, localStorage, location, matchMedia, URLSearchParams */
(() => {
  let colours = { dark: '#08090c', light: '#e6e8eb' };
  let setting = 'system';
  try {
    const stored = JSON.parse(localStorage.getItem('pdf-editor:appearance:v1') ?? 'null');
    if (stored && (stored.theme === 'light' || stored.theme === 'dark')) setting = stored.theme;
  } catch {
    // Storage blocked or unreadable: System.
  }
  // Fener's rule (`decideFener`): the address decides when it says anything, else Labs, whose
  // storage is read only then, so `?fener=1` still works where storage is blocked.
  let accent = null;
  const asked = new URLSearchParams(location.search).get('fener');
  let fener = asked === '1';
  if (asked === null) {
    try {
      fener =
        JSON.parse(localStorage.getItem('pdf-editor:labs:v1') ?? 'null')?.flags?.fener === '1';
    } catch {
      // Storage blocked or unreadable: today's colours.
    }
  }
  if (fener) {
    accent = 'indigo';
    try {
      const kept = JSON.parse(localStorage.getItem('pdf-editor:fener:v1') ?? 'null')?.accent;
      if (kept === 'violet' || kept === 'blue') accent = kept;
    } catch {
      // An unreadable preset is the default.
    }
  }
  if (accent !== null) {
    document.documentElement.setAttribute('data-fener', '');
    document.documentElement.setAttribute('data-accent', accent);
    colours = { dark: '#07090d', light: '#e6e9f2' };
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
