// page.evaluate callbacks run in the browser.
/**
 * Offline (ADR-0010): after one online visit the service worker serves the app shell from
 * its precache and the engine wasm from its runtime cache, so a reload with the network
 * off still loads the shell and opens a PDF. Also checks that the worker scope and the
 * manifest's scope / start_url / id follow the deployment base path (VITE_BASE_PATH).
 *
 * PF-17 (docs/plan/v1/PLAN.md V1-F15): with the network blocked, every file the worker
 * precached is served, and every split surface opens: the lazy sheets (Settings, Save a
 * copy, Recognize text, Batch, New signature), the Compare place and its Changes panel, the
 * Turkish locale and the compact edition. tools/qa/bundle-budget.ts checks at build time that
 * every emitted chunk is in the precache list.
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { openFixtures, openSaveCopy, useFileInputPicker } from './helpers';

const BASE_PATH = process.env.VITE_BASE_PATH ?? '/';

test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Service worker + offline emulation is verified on Chromium',
);

test('the shell and the engine work offline after one visit', async ({ page, context }) => {
  await useFileInputPicker(page);
  await page.goto('./');
  await expect(page.getByTestId('app-shell')).toBeVisible();

  // The worker controls the page (clientsClaim) with the scope of the base path.
  const scope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(new URL(scope).pathname).toBe(BASE_PATH);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  // The manifest follows the base path, too.
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return null;
    return (await (await fetch(link.href)).json()) as Record<string, unknown>;
  });
  expect(manifest).toMatchObject({ scope: BASE_PATH, start_url: BASE_PATH, id: BASE_PATH });

  // The engine wasm is warmed into the runtime cache once the shell is offline-ready.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const cache = await caches.open('pdf-editor-wasm');
          return (await cache.keys()).length;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);

  // The privacy popover reports the worker as installed (on the Library, from its footer chip).
  await page.getByTestId('library-privacy').click();
  await expect(page.getByTestId('sw-status')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByTestId('sw-status')).toHaveText(/works offline/);
  await page.keyboard.press('Escape');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Read, mark up, sign and arrange PDFs.' }),
  ).toBeVisible();
  // Really offline: anything not in a cache fails.
  const reachable = await page.evaluate(() =>
    fetch('./not-cached.txt', { cache: 'no-store' }).then(
      () => true,
      () => false,
    ),
  );
  expect(reachable).toBe(false);

  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.getByRole('tab', { name: 'simple-text', selected: true })).toBeVisible();
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 3 · /);
  // A page actually rendered through PDFium (wasm from the cache).
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible();

  // Nothing left the device.
  // ◎ is a glyph now (01-frame F8): its name says it.
  await expect(page.getByTestId('privacy-indicator')).toHaveAccessibleName(
    'Privacy: nothing has left this device',
  );
  await context.setOffline(false);
});

/** Runs a palette command by its title. */
async function palette(page: Page, query: string, option: RegExp): Promise<void> {
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByRole('combobox', { name: 'Search commands' });
  await expect(input).toBeVisible();
  await input.fill(query);
  await page.getByRole('option', { name: option }).first().click();
}

/** Waits for a sheet (its chunk came from the precache), then closes it with Escape. */
async function dismiss(page: Page, sheet: Locator): Promise<void> {
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
}

test('every precached file and every split surface opens offline (PF-17)', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  // Force the <a download> path: Playwright cannot drive the native save picker.
  await page.addInitScript({
    content:
      "Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });",
  });
  await useFileInputPicker(page);
  await page.goto('./?lang=en');
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
  // Both engine wasm files are warmed into the runtime cache: PDFium and qpdf.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const cache = await caches.open('pdf-editor-wasm');
          return (await cache.keys()).length;
        }),
      { timeout: 60_000 },
    )
    .toBe(2);

  await context.setOffline(true);

  // 1. Every precached file comes from the worker.
  const precache = await page.evaluate(async () => {
    const name = (await caches.keys()).find((key) => key.includes('precache'));
    if (name === undefined) return { urls: [] as string[], failed: ['no precache'] };
    const cache = await caches.open(name);
    const urls = (await cache.keys()).map((request) => {
      const url = new URL(request.url);
      url.searchParams.delete('__WB_REVISION__');
      return url.href;
    });
    const failed: string[] = [];
    for (const url of urls) {
      try {
        const response = await fetch(url);
        await response.arrayBuffer();
        if (!response.ok) failed.push(url);
      } catch {
        failed.push(url);
      }
    }
    return { urls, failed };
  });
  expect(precache.failed).toEqual([]);
  expect(precache.urls.filter((url) => url.endsWith('.js')).length).toBeGreaterThan(50);
  // The engine's bundled fonts, for text edits and page furniture.
  expect(precache.urls.some((url) => url.endsWith('.ttf'))).toBe(true);

  // 2. The split surfaces, after an offline reload.
  await page.reload();
  await expect(page.getByTestId('app-shell')).toBeVisible();
  await openFixtures(page, ['compare-a.pdf', 'compare-b.pdf']);
  await page.keyboard.press('1');
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });

  await palette(page, 'Settings', /^Settings…/);
  await dismiss(page, page.getByTestId('settings-sheet'));

  await dismiss(page, await openSaveCopy(page));

  await page.getByTestId('document-menu').click();
  await page.getByRole('menuitem', { name: 'Recognize text (OCR)…' }).click();
  await dismiss(page, page.getByTestId('ocr-dialog'));

  await palette(page, 'batch', /Batch…/);
  await dismiss(page, page.getByTestId('batch-dialog'));

  await page.locator('[data-dock-item="sign"]').click();
  const markup = page.getByRole('toolbar', { name: 'Markup', exact: true });
  await markup.getByRole('button', { name: 'Sign', exact: true }).click();
  await dismiss(page, page.getByRole('dialog', { name: 'New signature' }));
  await markup.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(markup).toBeHidden();

  // The Compare place, a run, and the Changes panel in the sidebar.
  await page.keyboard.press('4');
  const setup = page.getByTestId('compare-setup');
  await expect(setup).toBeVisible();
  await setup.getByRole('combobox', { name: 'Original (A)' }).click();
  await page.getByRole('option', { name: 'compare-a' }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await setup.getByRole('combobox', { name: 'Revised (B)' }).click();
  await page.getByRole('option', { name: 'compare-b' }).click();
  await setup.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.getByTestId('compare-view')).toHaveAttribute('data-status', 'done', {
    timeout: 60_000,
  });
  await expect(page.getByTestId('changes-panel')).toBeVisible();

  // The Turkish locale and the compact edition load from the precache too.
  await page.goto('./?lang=tr');
  await expect(
    page.getByRole('heading', { name: 'PDF’leri okuyun, işaretleyin, imzalayın ve düzenleyin.' }),
  ).toBeVisible();
  await page.goto('./?edition=compact&lang=en');
  await expect(page.getByTestId('compact-library')).toBeVisible();
  await context.setOffline(false);
});
