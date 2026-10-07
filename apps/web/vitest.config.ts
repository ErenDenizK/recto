import { fileURLToPath } from 'node:url';

import { playwright } from '@vitest/browser-playwright';
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import { chromiumLaunchOptions } from '../../tooling/playwright-chromium.ts';
import viteConfig from './vite.config.ts';

/**
 * The files that emulate a touch screen over CDP (`Emulation.setTouchEmulationEnabled`) to test
 * coarse-pointer layouts. Turning that emulation off does not give the page its fine pointer
 * back: Playwright's headless Chromium reports `pointer: fine` and `hover: hover` only through
 * its launch flags (`--blink-settings=primaryPointerType=…`), and Chromium restores the
 * platform's pointers instead, which headless has none of (`pointer: none`, `hover: none`).
 * Browser mode runs every file of a worker in one page, so that state outlived the file and
 * every later file in the worker lost its fine-pointer layout (in CI, the sidebar's Find field
 * at 1440 px). These files run in their own project, on their own pages; `test/fine-pointer.ts`
 * fails any other file that starts without a fine pointer, naming the cause.
 */
const TOUCH_EMULATING = [
  'src/ui/fields.test.tsx',
  'src/ui/Keycaps.touch.test.tsx',
  'src/ui/ink.gallery.test.tsx',
  'src/ui/Select.test.tsx',
  'src/ui/Slider.test.tsx',
  'src/stage/PageScrubber.test.tsx',
];

// Component tests run in a real browser (Vitest browser mode) with the same Vite plugins
// (React, React Compiler, `@` alias) as the application build.
export default mergeConfig(
  viteConfig,
  defineConfig({
    server: {
      fs: {
        // Vite 8 denies *.{crt,pem,key,p12,pfx,cer,der} by default; the signature tests read
        // the test-only .p12 files in test/fixtures/pki, so only .p12 is re-allowed (as in
        // packages/engine/vitest.config.ts).
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem,key,pfx,cer,der}',
          '.npmrc',
          '.yarnrc.yml',
          '**/.git/**',
        ],
      },
    },
    // Pre-bundle every dependency the tests reach lazily (engine wasm loader, fontkit,
    // fflate, the UI primitives). Discovering one mid-run makes Vite reload the browser,
    // which times out whichever test iframe is starting at that moment (seen in CI).
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        '@base-ui/react',
        // Base UI is imported by subpath; each is its own pre-bundle entry, and a new one
        // discovered mid-run reloads the browser (seen when the drawer and slider arrived).
        '@base-ui/react/alert-dialog',
        '@base-ui/react/avatar',
        '@base-ui/react/button',
        '@base-ui/react/checkbox',
        '@base-ui/react/checkbox-group',
        '@base-ui/react/context-menu',
        '@base-ui/react/dialog',
        '@base-ui/react/drawer',
        '@base-ui/react/menu',
        '@base-ui/react/number-field',
        '@base-ui/react/popover',
        '@base-ui/react/progress',
        '@base-ui/react/radio',
        '@base-ui/react/radio-group',
        '@base-ui/react/scroll-area',
        '@base-ui/react/select',
        '@base-ui/react/slider',
        '@base-ui/react/switch',
        '@base-ui/react/tabs',
        '@base-ui/react/tooltip',
        '@testing-library/react',
        '@embedpdf/pdfium',
        '@pdf-editor/engine > @embedpdf/engines',
        '@pdf-editor/engine > @embedpdf/engines/pdfium-worker-engine',
        '@cantoo/pdf-lib',
        // Dependencies reached only through the linked engine package resolve from its
        // own node_modules, so they must be named as nested entries.
        '@pdf-editor/engine > fflate',
        '@pdf-editor/engine > @cantoo/fontkit',
        '@pdf-editor/engine > @cantoo/pdf-lib',
        '@pdf-editor/engine > comlink',
        // The paragraph layout (main thread, text-edit/ParagraphEditor.tsx); CommonJS.
        '@pdf-editor/engine > linebreak',
        'zustand',
        '@tanstack/react-virtual',
        '@atlaskit/pragmatic-drag-and-drop-hitbox/list-item',
      ],
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
      setupFiles: ['./test/setup.ts'],
      passWithNoTests: true,
      browser: {
        enabled: true,
        headless: true,
        // Dark, as the suite was written: Theme defaults to System (spec D3-7) and Playwright
        // reports a light scheme unless told; light tests set `data-theme` themselves.
        provider: playwright({
          launchOptions: chromiumLaunchOptions(),
          contextOptions: { colorScheme: 'dark' },
        }),
        instances: [
          {
            browser: 'chromium',
            exclude: [...configDefaults.exclude, ...TOUCH_EMULATING],
            // An instance's own setup files are not resolved against the root; give the path.
            setupFiles: [fileURLToPath(new URL('./test/fine-pointer.ts', import.meta.url))],
          },
          { browser: 'chromium', name: 'chromium-touch', include: TOUCH_EMULATING },
        ],
      },
    },
  }),
);
