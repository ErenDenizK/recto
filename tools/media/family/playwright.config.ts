import { devices, defineConfig } from '@playwright/test';

import { chromiumLaunchOptions } from '../../../tooling/playwright-chromium.ts';
import { HERMETIC_ARGS } from '../lib/browser.ts';

// Family captures (docs/family/README.md §5): the screens and the one clip the maker's family
// kit asks of every product, shot from the production build the way the media scenes are
// (docs/specs/presentation.md §2), at the family's two sizes. Its own port, so neither the e2e
// server (4173) nor the media scenes' (4180) is reused by mistake. FAMILY_SKIP_BUILD=1 reuses
// apps/web/dist, which must then have been built with RECTO_RENDER_OVERRIDE=1.
const port = Number(process.env.FAMILY_PORT ?? 4181);
const origin = `http://localhost:${port}`;
const build = process.env.FAMILY_SKIP_BUILD ? '' : 'pnpm --filter @pdf-editor/web build && ';

/** The landscape tablet of CLAUDE.md's screenshot rule: touch, coarse pointer, 2x. */
const TABLET = { width: 1180, height: 820 } as const;

export default defineConfig({
  testDir: '.',
  testMatch: /\.capture\.ts$/,
  // One browser at a time: the clip must not compete for the CPU with a still.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 120_000,
  reporter: [['list']],
  outputDir: '../out/family/test-results',
  use: {
    baseURL: `${origin}/`,
    browserName: 'chromium',
    timezoneId: 'UTC',
    locale: 'en-US',
    colorScheme: 'dark',
    video: 'off',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        launchOptions: { ...chromiumLaunchOptions(), args: [...HERMETIC_ARGS] },
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Galaxy Tab S4 landscape'],
        viewport: { ...TABLET },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        launchOptions: { ...chromiumLaunchOptions(), args: [...HERMETIC_ARGS] },
      },
    },
  ],
  webServer: {
    command: `${build}pnpm --filter @pdf-editor/web preview --port ${port} --strictPort`,
    // The test-only render override (docs/specs/redesign.md X36): Glass Clear and no cost-ladder
    // step on a runner that renders in software, as lib/stage.ts explains.
    env: { RECTO_RENDER_OVERRIDE: '1' },
    url: `${origin}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
