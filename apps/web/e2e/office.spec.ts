// page.evaluate callbacks run in the browser.
/**
 * On-device Office conversion, phase 1 (ADR-0035 §7): the real LibreOffice package, end to
 * end, behind `?office=1`. A Word file is picked, the sheet asks once, the ~79 MB package
 * downloads from the app's own origin into its cache, the page reloads once into
 * cross-origin isolation (granted by the service worker, public/sw-office.js), the file
 * converts in the worker, and the PDF opens as a tab through the normal open path.
 *
 * Then the rest of the app under isolation: a corpus PDF opens and renders (the PDFium worker
 * and its wasm), the UI font is loaded, and no request left the origin.
 *
 * It needs the package in the build (`node packages/engine/office/fetch.ts`, then the build);
 * without it the test is skipped. Chromium only for now: the other engines' isolation and
 * memory are phase 2.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { openFixtures, saveCopyBytes, useDownloadPath, useFileInputPicker } from './helpers';
import { docx } from './support/docx';

const lock = JSON.parse(
  readFileSync(
    new URL('../../../packages/engine/office/office.lock.json', import.meta.url),
    'utf8',
  ),
) as { readonly directory: string };
const packageBuilt = existsSync(
  fileURLToPath(new URL(`../dist/convert/${lock.directory}/soffice.js`, import.meta.url)),
);

test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium first (ADR-0035 §7)');
test.skip(!packageBuilt, 'The build has no Office package (packages/engine/office/fetch.ts)');

test('a Word file converts on the device and opens as a PDF', async ({ page }) => {
  test.setTimeout(300_000);
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));

  await useFileInputPicker(page);
  await useDownloadPath(page);
  await page.goto('./?office=1');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 30_000,
    })
    .toBe(true);
  // Before the package is installed nothing changes: the page is not isolated.
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);

  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles({
    name: 'report.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: docx(['First page: Recto converts this.', 'İkinci sayfa: ğüşiöç.', 'Third page.']),
  });

  const sheet = page.getByTestId('office-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByTestId('office-consent')).toContainText(/one-time conversion package/);
  await expect(page.getByTestId('office-file')).toHaveText('report.docx');

  // Download, then the one reload into isolation, then the conversion.
  const reloaded = page.waitForEvent('framenavigated', { timeout: 240_000 });
  const started = Date.now();
  await page.getByTestId('office-download').click();
  await reloaded;
  await expect(page.getByTestId('app-shell')).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);

  const isolatedAt = Date.now();
  await expect(page.getByRole('tab', { name: 'report' })).toBeVisible({ timeout: 180_000 });
  test.info().annotations.push({
    type: 'timing',
    description: `download and reload ${isolatedAt - started} ms, start and convert ${Date.now() - isolatedAt} ms`,
  });
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 3 · /, { timeout: 30_000 });
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible();
  await expect(sheet).toBeHidden();

  // The package is on the device, compressed as fetched, with its marker.
  const stored = await page.evaluate(async () => {
    const cache = await caches.open('pdf-editor-office');
    return (await cache.keys()).map((request) => new URL(request.url).pathname.split('/').pop());
  });
  expect(stored).toEqual(
    expect.arrayContaining(['soffice.wasm', 'soffice.data', 'soffice.js', 'installed.json']),
  );

  // The rest of the app under isolation: the converted PDF saves as a copy (the assembler and
  // analysis workers), PDFium opens and renders a corpus file, fonts load.
  const copy = await saveCopyBytes(page);
  expect(copy.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  await openFixtures(page, ['images.pdf']);
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check("1em 'Inter Recto'"))).toBe(true);
  const origin = new URL(page.url()).origin;
  const foreign = requested.filter((url) => /^https?:/.test(url) && new URL(url).origin !== origin);
  expect(foreign).toEqual([]);
});
