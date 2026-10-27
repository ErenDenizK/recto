/**
 * The dock's Tools entry (DSN-76): open Tools, pick Compare and see the
 * Compare place open, the same command the title menu runs. Port 4133.
 */
import { expect, type Page, test } from '@playwright/test';

import { openFixtures, useFileInputPicker } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Verified on Chromium');
test.use({ viewport: { width: 1440, height: 900 } });

async function setUp(page: Page): Promise<void> {
  await useFileInputPicker(page);
  await page.goto('./');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, ['compare-a.pdf', 'compare-b.pdf']);
  await page.keyboard.press('1');
}

/** Waits until nothing finite animates (the menu's entrance). */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .every(
          (a) =>
            a.playState !== 'running' ||
            !Number.isFinite(Number(a.effect?.getComputedTiming().endTime)),
        ),
    undefined,
    { timeout: 10_000 },
  );
}

const dock = (page: Page) => page.getByRole('toolbar', { name: 'Document tools', exact: true });

test('Tools → Compare opens the Compare setup', async ({ page }) => {
  await setUp(page);
  await dock(page).getByRole('button', { name: 'Tools', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Tools' });
  await expect(menu).toBeVisible();
  await settled(page);
  await expect(menu.getByRole('menuitem')).toHaveCount(6);
  await menu.getByRole('menuitem', { name: /^Compare/ }).click();
  await expect(page.getByTestId('compare-setup')).toBeVisible();
});
