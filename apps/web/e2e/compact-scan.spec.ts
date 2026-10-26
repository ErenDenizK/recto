/**
 * Camera scan on the phone (EDN-23, big move 1; `?scan=1`): the `phone` project, with Chromium's
 * fake camera filming a tilted white page on a dark desk (`tools/fixtures/scan-y4m.ts`, as
 * `scan.spec.ts`). The Library's Scan button opens a full-screen sheet with a 72 px shutter low
 * in the window; Auto takes the first page, the shutter the second; the review's actions are
 * 44 px targets; Done opens one new document in the compact reader with two pages.
 *
 * Set CAPTURE_SCREENSHOTS=<dir> to write the review screenshots (the Library with its Scan
 * button, the camera, the review), dark and light.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Locator, type Page, test } from '@playwright/test';

import { chromiumLaunchOptions } from '../../../tooling/playwright-chromium.ts';
import { atRest, motionDone } from './helpers';

test.skip(({ browserName }) => browserName !== 'chromium', 'Fake camera files are Chromium-only');

const SHOTS = process.env.CAPTURE_SCREENSHOTS;

const feed = join(mkdtempSync(join(tmpdir(), 'recto-compact-scan-')), 'page.y4m');
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

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await motionDone(page);
  const scheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  await page.screenshot({ path: join(SHOTS, `scan-phone-${name}-${scheme}.png`) });
}

async function openSheet(page: Page): Promise<Locator> {
  await page.goto('./?lang=en&scan=1');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  await shot(page, 'library');
  await page.getByTestId('compact-scan').tap();
  const sheet = page.getByTestId('scan-sheet');
  await expect(sheet).toBeVisible();
  await atRest(sheet);
  // The outline of the page, solid once it holds.
  await expect(sheet.getByTestId('scan-outline')).toHaveAttribute('data-locked', 'true', {
    timeout: 20_000,
  });
  return sheet;
}

test('the Scan button is not there without the flag', async ({ page }) => {
  await page.goto('./?lang=en');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  await expect(page.getByTestId('compact-scan')).toHaveCount(0);
});

test('Scan opens a full-screen sheet with a 72 px shutter in thumb reach', async ({ page }) => {
  test.setTimeout(60_000);
  const sheet = await openSheet(page);
  const view = page.viewportSize();
  expect(view).not.toBeNull();
  const box = await sheet.boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: view?.width, height: view?.height });
  const shutter = await sheet.getByTestId('scan-shutter').boundingBox();
  expect(shutter?.width).toBe(72);
  expect(shutter?.height).toBe(72);
  expect((shutter?.y ?? 0) + 72).toBeGreaterThan((view?.height ?? 0) * 0.75);
  expect((shutter?.y ?? 0) + 72).toBeLessThanOrEqual(view?.height ?? 0);
  await shot(page, 'camera');
});

test('two captures become one document with two pages in the reader', async ({ page }) => {
  test.setTimeout(120_000);
  const sheet = await openSheet(page);
  // Auto takes the first page by itself; Manual and the shutter take the second.
  await expect(sheet.getByTestId('scan-stack')).toContainText('1', { timeout: 20_000 });
  await sheet.getByRole('radio', { name: 'Manual' }).tap();
  await sheet.getByTestId('scan-shutter').tap();
  await expect(sheet.getByTestId('scan-stack')).toContainText('2');

  await sheet.getByTestId('scan-stack').tap();
  await expect(sheet.getByTestId('scan-thumb')).toHaveCount(2);
  const review = sheet.getByTestId('scan-review');
  await expect(review).toBeVisible();
  await expect(sheet.getByTestId('scan-preview')).toBeVisible({ timeout: 20_000 });
  // Every action of the review is a finger-sized target.
  for (const id of [
    'scan-adjust',
    'scan-rotate',
    'scan-retake',
    'scan-delete',
    'scan-earlier',
    'scan-later',
    'scan-another',
    'scan-done',
  ]) {
    const target = await sheet.getByTestId(id).boundingBox();
    expect(target?.width, id).toBeGreaterThanOrEqual(44);
    expect(target?.height, id).toBeGreaterThanOrEqual(44);
  }
  await shot(page, 'review');

  await sheet.getByTestId('scan-done').tap();
  await expect(page.getByTestId('compact-reader')).toBeVisible({ timeout: 60_000 });
  await expect(sheet).toBeHidden();
  await expect(page.locator('[data-page-index="1"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-page-index="2"]')).toHaveCount(0);
});

test.describe('light', () => {
  test.skip(!SHOTS, 'Screenshots only');
  test.use({ colorScheme: 'light' });

  test('the Library button, the camera and the review', async ({ page }) => {
    test.setTimeout(90_000);
    const sheet = await openSheet(page);
    await shot(page, 'camera');
    await expect(sheet.getByTestId('scan-stack')).toContainText('1', { timeout: 20_000 });
    await sheet.getByTestId('scan-stack').tap();
    await expect(sheet.getByTestId('scan-preview')).toBeVisible({ timeout: 20_000 });
    await shot(page, 'review');
  });
});
