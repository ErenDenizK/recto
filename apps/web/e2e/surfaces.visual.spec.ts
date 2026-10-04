/**
 * Pinned screens (quality-bar Q-13; spec redesign D0-3, growing per drop): screenshot baselines of
 * the control primitives and of Home, Read and Edit, so a change that moves a pixel shows as a
 * diff in review.
 *
 * - **Primitives**: `test/harness/primitives.html`, a gallery of every D0-3 control in its states,
 *   served by a Vite dev server this spec starts (no gallery ships in the app). Hover, pressed and
 *   focus are forced through CDP on the elements marked `data-force`, so they show side by side.
 *   Taken at a fine pointer and at a coarse one (touch, as the `tablet` project).
 * - **Surfaces**: Home, Read and Edit (with the Text group's options tier) of the production
 *   build at 1440 × 900 (fine) and 820 × 1180 (coarse, the tablet).
 *
 * Only the dark theme exists until D3, which adds the light baselines. Baselines are Chromium's
 * only (`*-chromium-linux.png` beside this file); other engines skip. **The lead updates them**,
 * after looking at the diff, with
 *
 *   cd apps/web && pnpm build && E2E_SKIP_BUILD=1 pnpm exec playwright test surfaces.visual \
 *     --project=chromium --update-snapshots
 *
 * and commits the changed PNGs with the change that caused them. The tolerance absorbs
 * antialiasing differences between Chromium builds, not layout changes.
 */
import { fileURLToPath } from 'node:url';

import { expect, type Page, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

import { enterEdit, openFixtures, useFileInputPicker } from './helpers';

const WEB = fileURLToPath(new URL('..', import.meta.url));

const SHOT = { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 } as const;

test.beforeEach(({ browserName }, info) => {
  test.skip(browserName !== 'chromium' || info.project.name !== 'chromium', 'Chromium baselines');
});

/** Forces each `[data-force]` element's pseudo-class through CDP. */
async function forceStates(page: Page): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await session.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector: '[data-force]',
  });
  for (const nodeId of nodeIds) {
    const { attributes } = await session.send('DOM.getAttributes', { nodeId });
    const at = attributes.indexOf('data-force');
    const state = attributes[at + 1] ?? 'hover';
    const forced = state === 'focus-visible' ? ['focus', 'focus-visible'] : [state];
    await session.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced });
  }
}

test.describe('primitives', () => {
  test.describe.configure({ mode: 'serial' });
  let server: ViteDevServer;
  let url = '';

  test.beforeAll(async ({ browserName }) => {
    if (browserName !== 'chromium') return;
    server = await createServer({
      root: WEB,
      configFile: `${WEB}vite.config.ts`,
      logLevel: 'error',
      server: { port: 0, strictPort: false },
    });
    await server.listen();
    url = `${server.resolvedUrls?.local[0] ?? ''}test/harness/primitives.html`;
  });

  test.afterAll(async () => {
    await server?.close();
  });

  async function shoot(page: Page, name: string): Promise<void> {
    await page.goto(url);
    await expect(page.locator('[data-row="Progress"]')).toBeVisible({ timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    // The busy button's glyph appears after 400 ms.
    await page.waitForTimeout(600);
    await forceStates(page);
    await page.mouse.move(0, 0);
    await expect(page.locator('main')).toHaveScreenshot(`${name}.png`, SHOT);
  }

  test('fine pointer', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 1400 });
    await shoot(page, 'primitives-fine');
  });

  test.describe('coarse pointer', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 1100, height: 1600 } });

    test('coarse pointer', async ({ page }) => {
      await shoot(page, 'primitives-coarse');
      // Controls are 44 px on a coarse pointer (Q-9).
      const save = page.getByRole('button', { name: 'Save copy' }).first();
      expect((await save.boundingBox())?.height).toBe(44);
    });
  });
});

test.describe('surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await useFileInputPicker(page);
  });

  async function surfaces(page: Page, size: string): Promise<void> {
    await page.goto('./?lang=en');
    await expect(page.getByRole('button', { name: /^Open files/ }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot(`home-${size}.png`, SHOT);

    await openFixtures(page, ['simple-text.pdf']);
    await expect(page.locator('canvas[data-state="rendered"]').first()).toBeAttached({
      timeout: 20_000,
    });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`read-${size}.png`, SHOT);

    await enterEdit(page);
    await page
      .getByRole('toolbar', { name: 'Tools', exact: true })
      .locator('[data-bar-group="text"]')
      .click();
    await page.locator('body').press('t');
    await page.locator('body').press('t');
    await expect(page.getByTestId('options-tier')).toBeVisible();
    // The keys above leave the group's focus ring showing; the baseline is the resting bar.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot(`edit-${size}.png`, SHOT);
  }

  test('1440 × 900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await surfaces(page, '1440');
  });

  test.describe('the tablet', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 1180 } });

    test('820 × 1180', async ({ page }) => {
      await surfaces(page, '820');
    });
  });
});
