import { defineConfig, devices } from '@playwright/test';

import { chromiumLaunchOptions } from '../../tooling/playwright-chromium.ts';
import { HARNESS_PORT, HARNESS_URL } from './e2e/support/harness-server.ts';

// End-to-end tests run against the production build served by `vite preview`, under the
// same base path that GitHub Pages will use (VITE_BASE_PATH, default `/`).
const basePath = process.env.VITE_BASE_PATH ?? '/';
const port = Number(process.env.E2E_PORT ?? 4173);
const isCI = Boolean(process.env.CI);

/**
 * The phone and tablet projects (spec redesign D0-2, ADR-0033 §2.4, §3): Chromium with touch
 * and a mobile viewport, and a screen equal to the viewport, so the edition rule (a coarse
 * pointer and a screen side under 600 CSS px, `shell/frame/edition.ts`) sees a phone or a
 * tablet. `?edition` stays unset. The phones run only the compact edition's spec; the
 * tablet runs the full edition's smoke spec, the touch gestures (long press, D1-7; pinch and
 * the page scrubber, D2-10) and ↶ ↷ with the History scrubber (D0-6) for now.
 * Both also run the bar audit (Q-9).
 */
const PHONE = { width: 390, height: 844 };
const PHONE_LANDSCAPE = { width: 844, height: 390 };
const TABLET = { width: 820, height: 1180 };
const COMPACT_SPEC = '**/compact.spec.ts';
/** The control-system audit (quality-bar Q-9, spec D0-3) runs on every density and edition. */
const BAR_AUDIT_SPEC = '**/bar-audit.spec.ts';
/** The sheets' presentation on the medium class with a coarse pointer (spec D0-4). */
const SHEETS_SPEC = '**/sheets.spec.ts';
/** The Settings sheet as a form sheet on the medium class (spec D0-10). */
const SETTINGS_SPEC = '**/settings.spec.ts';
/** Save a copy's Share copy and J13B's touch count (spec D0-9, §10.5: jobs on the tablet). */
const SAVE_COPY_SPECS = ['**/save-copy.spec.ts', '**/jobs.spec.ts'];
/** Menus keep to the window, scrolling inside it at 44 px rows (XD-3). */
const MENUS_SPEC = '**/menus.spec.ts';
/**
 * Playwright's WebKit has no origin private file system, so the app keeps no snapshots there and
 * rightly shows "Changes are not kept in this window" until dismissed (ADR-0032 §2.7). Its specs
 * start with that warning already dismissed, so it neither covers the controls under test nor
 * counts as one more toast and glass surface; `session.spec.ts` clears it to check the warning.
 */
const NOT_KEPT_SEEN = {
  cookies: [],
  origins: [
    {
      origin: `http://localhost:${port}`,
      localStorage: [{ name: 'pdf-editor:session:not-kept-dismissed:v1', value: 'true' }],
    },
  ],
};
/**
 * No frames at rest on the compact reader too (quality-bar Q-10, A-23; spec D0-QA); the tablet
 * runs its idle, sweep and limits tests as well (spec D3-4).
 */
const MOTION_SPEC = '**/motion.spec.ts';
const touchDevice = (
  size: { width: number; height: number },
  userAgent: string,
  deviceScaleFactor: number,
) => ({
  ...devices['Pixel 7'],
  userAgent,
  viewport: size,
  screen: size,
  deviceScaleFactor,
  isMobile: true,
  hasTouch: true,
  launchOptions: chromiumLaunchOptions(),
});

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: new URL(basePath, `http://localhost:${port}`).href,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: COMPACT_SPEC,
      use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions() },
    },
    { name: 'firefox', testIgnore: COMPACT_SPEC, use: { ...devices['Desktop Firefox'] } },
    {
      name: 'webkit',
      testIgnore: COMPACT_SPEC,
      use: { ...devices['Desktop Safari'], storageState: NOT_KEPT_SEEN },
    },
    {
      name: 'phone',
      testMatch: [COMPACT_SPEC, BAR_AUDIT_SPEC, MOTION_SPEC],
      use: touchDevice(PHONE, devices['Pixel 7'].userAgent, 3),
    },
    {
      name: 'phone-land',
      testMatch: COMPACT_SPEC,
      use: touchDevice(PHONE_LANDSCAPE, devices['Pixel 7'].userAgent, 3),
    },
    {
      name: 'tablet',
      testMatch: [
        '**/smoke.spec.ts',
        '**/library.spec.ts',
        '**/long-press.spec.ts',
        '**/history.spec.ts',
        '**/tab-strip.spec.ts',
        // The frame's free rectangle and jobs on the medium class (spec D2-1).
        '**/frame-layout.spec.ts',
        '**/canvas-zoom.spec.ts',
        BAR_AUDIT_SPEC,
        SHEETS_SPEC,
        SETTINGS_SPEC,
        ...SAVE_COPY_SPECS,
        MENUS_SPEC,
        // Reduced motion per token and the limits on the tablet too (spec D3-4).
        MOTION_SPEC,
        // `?sample` opens the teaching sample on the tablet too (spec D4-2).
        '**/sample.spec.ts',
      ],
      use: touchDevice(TABLET, devices['Galaxy Tab S4'].userAgent, 2),
    },
    // Rendered pixels without the GPU (ADR-0028; research 22 §3.2; docs/specs/redesign.md D0-1):
    // the compositor's software path, where a backdrop blur large against a surface was measured
    // leaking the page. Runs only the specs tagged @pixels (e2e/support/pixels.ts).
    {
      name: 'chromium-nogpu',
      grep: /@pixels/,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { ...chromiumLaunchOptions(), args: ['--disable-gpu'] },
      },
    },
  ],
  webServer: [
    {
      // Build first so the tests exercise exactly what is deployed; `pnpm build` in CI has
      // already produced `dist/`, and E2E_SKIP_BUILD=1 reuses it.
      command: `${process.env.E2E_SKIP_BUILD ? '' : 'pnpm build && '}pnpm preview --port ${port} --strictPort`,
      url: new URL(basePath, `http://localhost:${port}`).href,
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      // The rendered-pixel harness (09-primitives §28, spec 09.11, D3-1): its own Vite config on
      // its own port, so the app above stays the deploy build. A dev server: nothing to build.
      command: `pnpm exec vite --config harness/vite.config.ts --port ${HARNESS_PORT} --strictPort`,
      url: HARNESS_URL,
      reuseExistingServer: !isCI,
      timeout: 60_000,
    },
  ],
});
