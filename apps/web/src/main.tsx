// Fonts are self-hosted from node_modules (CSP: font-src 'self', no data: URLs). Subsets
// load on demand through unicode-range, so unused scripts cost nothing. See fonts.css for
// why JetBrains Mono is declared by hand.
import '@fontsource-variable/inter/wght.css';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/global.css';

import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { startServiceWorker } from './pwa/register';
import { launchEdition } from './shell/frame/edition';
import { useSizeClass } from './shell/frame/size-class';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing from index.html');
}

startServiceWorker();

/**
 * The edition is decided once, here, before anything renders (ADR-0033 §2.1): a phone gets
 * the compact edition, everything else the full one. Each edition is its own chunk, loaded
 * lazily, so a phone never downloads the full shell (`app.tsx`, today's tree, unchanged) and
 * a desktop never downloads the compact one (`shell/compact/`). `?edition=compact|full`
 * overrides the choice for the session.
 */
const Edition =
  launchEdition() === 'compact'
    ? lazy(() =>
        import('./shell/compact/CompactApp').then((module) => ({ default: module.CompactApp })),
      )
    : lazy(() => import('./app').then((module) => ({ default: module.App })));

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
