/**
 * The rendered-pixel harness's own Vite config (components/09-primitives.md §28, spec 09.11;
 * docs/specs/redesign.md §10.3, D3-1). A separate config, served on its own port by
 * Playwright's `webServer` (`pnpm exec vite --config harness/vite.config.ts`), so the app that
 * Playwright tests stays byte-identical to the deploy build: the harness is never an input of
 * the app's build and never in its service-worker precache.
 *
 * It runs as a dev server: nothing to build before a run, and the CSS it serves is the app's
 * own `tokens.css`, `reset.css` and `global.css`, unminified.
 */
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // The harness imports the app's styles and coverage registry from `../src`.
  publicDir: false,
  // Its own dependency cache, apart from the app's dev server's.
  cacheDir: '../node_modules/.vite-harness',
  plugins: [react()],
  // Pre-bundled at start, so the first page load never triggers a dependency reload mid-test.
  optimizeDeps: { include: ['react', 'react-dom/client'] },
  server: { strictPort: true },
  clearScreen: false,
  logLevel: 'warn',
});
