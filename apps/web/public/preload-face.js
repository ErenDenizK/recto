/*
 * Preloads the UI face's Latin file (`data-href`) for the first paint (ADR-0027 §2.1, Q-8) in
 * the mode the engine's `@font-face` fetches it, so it is fetched once (decisions PRC-16): CORS
 * (`crossorigin`) in Chromium and Firefox, no-cors in WebKit, told apart by `navigator.vendor`.
 * A file, as the CSP allows no inline script; src/styles/preload-face.test.ts runs it.
 */
/* global document, navigator */
(() => {
  const href = document.currentScript?.dataset.href;
  if (!href) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'font';
  link.type = 'font/woff2';
  if (navigator.vendor !== 'Apple Computer, Inc.') link.crossOrigin = 'anonymous';
  link.href = href;
  document.head.append(link);
})();
