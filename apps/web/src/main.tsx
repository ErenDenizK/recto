// 'Inter Recto' is served from this origin (public/fonts/, CSP font-src 'self'); fonts.css
// declares it and index.html preloads its Latin file (ADR-0027 §2.1).
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';

import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { getLocale } from './i18n/locale';
import { loadOrReload } from './pwa/boot-reload';
import { armServiceWorkerRegistration, startServiceWorker } from './pwa/register';
import { applyProtoOptions } from './proto-options';
import { launchEdition } from './shell/frame/edition';
import { useSizeClass } from './shell/frame/size-class';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing from index.html');
}

startServiceWorker();

// Lab builds only (`RECTO_LAB=1`, ED-3): compiled out of every other build.
if (__LAB__) void import('./lab').then((lab) => lab.startLab());

// The colour audit's board prototypes (r29, temporary): dev server and test builds only.
if (import.meta.env.DEV || __RENDER_OVERRIDE__)
  applyProtoOptions(document.documentElement, location.search);

/**
 * Turkish needs the Latin Extended file (ğ İ ş) on its first screen; `index.html` preloads only
 * the Latin one (ADR-0027 §2.1: English sessions never pay for it), so a Turkish launch asks for
 * it now, while the edition's chunk loads, rather than when the first ş is laid out (Q-8).
 */
if (getLocale() === 'tr')
  void document.fonts?.load("1em 'Inter Recto'", 'ğİş').catch(() => undefined);

/**
 * The edition is decided once, here, before anything renders (ADR-0033 §2.1): a phone gets
 * the compact edition, everything else the full one. Each edition is its own chunk, loaded
 * lazily, so a phone never downloads the full shell (`app.tsx`, today's tree, unchanged) and
 * a desktop never downloads the compact one (`shell/compact/`). `?edition=compact|full`
 * overrides the choice for the session. A chunk that fails to load is imported again, then
 * the page reloads once, then a static screen offers Reload (`pwa/boot-reload.ts`, PRD-26):
 * never a blank page.
 */
const Edition =
  launchEdition() === 'compact'
    ? lazy(() =>
        loadOrReload(() => import('./shell/compact/CompactApp'), 'compact', 'CompactApp')
          .then((module) => ({ default: module.CompactApp }))
          .finally(armServiceWorkerRegistration),
      )
    : lazy(() =>
        loadOrReload(() => import('./app'), 'full', 'App')
          .then((module) => ({ default: module.App }))
          .finally(armServiceWorkerRegistration),
      );

/** Mirrors the size class on `:root` (`data-size`, `data-short`) in both editions. */
function FrameClass() {
  useSizeClass();
  return null;
}

createRoot(container).render(
  <StrictMode>
    <FrameClass />
    {/* Nothing to show for the few milliseconds the edition's chunk takes: the canvas. */}
    <Suspense fallback={null}>
      <Edition />
    </Suspense>
  </StrictMode>,
);
