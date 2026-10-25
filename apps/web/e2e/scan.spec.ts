/**
 * Camera scan end to end (big move 1, plan bm-scan-plan §3, PRD-34; behind `?scan=1`): Chromium
 * with a fake camera that films a tilted white page on a dark desk (`tools/fixtures/scan-y4m.ts`).
 * The outline is found and goes solid, Auto captures once and waits for the page to leave, and
 * one automatic and two manual captures are reordered and made into one new document with three pages.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Locator, type Page, test } from '@playwright/test';

import { chromiumLaunchOptions } from '../../../tooling/playwright-chromium.ts';

test.skip(({ browserName }) => browserName !== 'chromium', 'Fake camera files are Chromium-only');

const feed = join(mkdtempSync(join(tmpdir(), 'recto-scan-')), 'page.y4m');
// The generator is a script of its own (tools/fixtures), run with Node's own type stripping.
execFileSync(
  process.execPath,
  [
    '--experimental-strip-types',
    '--no-warnings=ExperimentalWarning',
    fileURLToPath(new URL('../../../tools/fixtures/scan-y4m.ts', import.meta.url)),
    feed,
  ],
  { stdio: 'inherit' },
);

test.use({
  viewport: { width: 1440, height: 900 },
  permissions: ['camera'],
  launchOptions: {
    ...chromiumLaunchOptions(),
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${feed}`,
    ],
  },
});

async function openSheet(page: Page): Promise<Locator> {
  await page.goto('./?lang=en&scan=1');
  await page.getByTestId('library-scan').click();
  const sheet = page.getByTestId('scan-sheet');
  await expect(sheet).toBeVisible();
  // The outline of the page, solid once it holds.
  await expect(sheet.getByTestId('scan-outline')).toHaveAttribute('data-locked', 'true', {
    timeout: 20_000,
  });
  return sheet;
}

test('the Scan button is not there without the flag', async ({ page }) => {
  await page.goto('./?lang=en');
  await expect(page.getByTestId('library-open')).toBeVisible();
  await expect(page.getByTestId('library-scan')).toHaveCount(0);
});

test('Auto captures a steady page once, then waits for the page to leave', async ({ page }) => {
  test.setTimeout(90_000);
  const sheet = await openSheet(page);
  await expect(sheet.getByTestId('scan-stack')).toContainText('1', { timeout: 20_000 });
  const hint = sheet.getByTestId('scan-hint');
  await expect(hint).toHaveText(/Captured/);
  // The page is still in view, so no capture follows: the outline is solid and the hint stays
  // "Captured" (not "Hold still") until the page leaves, with the count at one.
  await expect(sheet.getByTestId('scan-outline')).toHaveAttribute('data-locked', 'true');
  await expect(hint).toHaveText(/Captured/);
  await expect(sheet.getByTestId('scan-stack')).toContainText('1');
});

test('three captures, reordered, become one document with three pages', async ({ page }) => {
  test.setTimeout(120_000);
  const sheet = await openSheet(page);
  // Auto takes the first page by itself; Manual and the shutter take the other two.
  await expect(sheet.getByTestId('scan-stack')).toContainText('1', { timeout: 20_000 });
  await sheet.getByRole('radio', { name: 'Manual' }).click();
  const shutter = sheet.getByTestId('scan-shutter');
  for (const count of [2, 3]) {
    await shutter.click();
    await expect(sheet.getByTestId('scan-stack')).toContainText(String(count));
  }
  await sheet.getByTestId('scan-stack').click();
  const thumbs = sheet.getByTestId('scan-thumb');
  await expect(thumbs).toHaveCount(3);
  const order = () => thumbs.evaluateAll((els) => els.map((el) => el.getAttribute('data-page')));
  const [a, b, c] = await order();
  // The last capture is selected; two steps earlier puts it first.
  await sheet.getByTestId('scan-earlier').click();
  await sheet.getByTestId('scan-earlier').click();
  expect(await order()).toEqual([c, a, b]);

  await sheet.getByTestId('scan-done').click();
  await expect(sheet).toBeHidden({ timeout: 60_000 });
  await expect(page.getByRole('tab', { name: /Scan \d{1,2} \w{3,4} \d{4}/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('[data-page-index="2"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-page-index="3"]')).toHaveCount(0);
  await expect(page.getByTestId('save-button')).toHaveAttribute('data-state', 'save');
});
