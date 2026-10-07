// page.evaluate callbacks run in the browser.
/**
 * The teaching sample (redesign D4-2; components/02-library.md §11, L10; flows.md §9.2):
 * `?sample` and `?sample=tr` open it once after launch and leave the address, so a reload opens
 * no second copy; with a restored session it opens as one more tab; and the service worker's
 * precache opens it offline after one visit.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  openFixtures,
  sessionSettled,
  useFileInputPicker,
  waitForSnapshot,
  openDocumentTitles,
} from './helpers';

const sampleTabs = (page: Page) => page.getByRole('tab', { name: /^Recto (sample|örnek belge)/ });

/** The address has no `sample` parameter left. */
async function expectCleanAddress(page: Page): Promise<void> {
  await expect.poll(() => new URL(page.url()).searchParams.has('sample')).toBe(false);
}

/** A page of the active document rendered through PDFium. */
async function expectRendered(page: Page): Promise<void> {
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible({
    timeout: 20_000,
  });
}

test('?sample opens the sample once and leaves the address; a reload opens no second copy', async ({
  page,
}) => {
  await page.goto('./?sample');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expectCleanAddress(page);
  await expect(sampleTabs(page)).toHaveCount(1);
  await expectRendered(page);

  // The session keeps the open sample (where storage is kept), but nothing opens it again.
  const keeping = (await page.locator('html').getAttribute('data-session')) === 'ready';
  if (keeping) await waitForSnapshot(page);
  await page.reload();
  await sessionSettled(page);
  await expectCleanAddress(page);
  await expect(sampleTabs(page)).toHaveCount(keeping ? 1 : 0);
  await expect(page.getByRole('tab', { name: /^Recto sample \(2\)/ })).toHaveCount(0);
});

test('?sample=tr opens the Turkish sample in an English UI', async ({ page }) => {
  await page.goto('./?sample=tr');
  await expect(page.getByRole('tab', { name: 'Recto örnek belge', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expectCleanAddress(page);
  await expect(sampleTabs(page)).toHaveCount(1);
  await expectRendered(page);
});

test('Fill & sign on the welcome page brings the sample’s form into view', async ({ page }) => {
  // V2 review item 23: the door opened the Sign set and nothing on page 1 changed.
  await page.goto('./?sample');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  await expectRendered(page);
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 4 · /);
  await page
    .locator('[data-capsule]')
    .getByRole('button', { name: /^Fill & sign/ })
    .click();
  await expect(page.getByTestId('page-pill')).toHaveText(/^2 \/ 4 · /);
  const field = page.locator('[data-form-layer] [data-field-name]').first();
  await expect(field).toBeInViewport();
  // The door focuses the palette, not the field: typing does not fill it yet.
  await expect(field).not.toBeFocused();
});

test('the palette’s Try the sample opens a fresh copy each time', async ({ page }) => {
  await page.goto('./');
  await sessionSettled(page);
  for (const title of ['Recto sample', 'Recto sample (2)']) {
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox', { name: 'Search commands' }).fill('sample');
    await expect(
      page.getByRole('option', { name: /Try the sample/, selected: true }),
    ).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: title, selected: true })).toBeVisible({
      timeout: 20_000,
    });
  }
  // The second copy may sit in the strip's "N more" menu on a narrow strip (01-frame F4).
  await expect
    .poll(async () =>
      (await openDocumentTitles(page)).filter((title) => /^Recto (sample|örnek belge)/.test(title)),
    )
    .toHaveLength(2);
});

test('with a restored session the sample opens as one more tab', async ({ page }) => {
  await useFileInputPicker(page);
  await page.goto('./');
  await sessionSettled(page);
  test.skip(
    (await page.locator('html').getAttribute('data-session')) !== 'ready',
    'This engine keeps no session (no OPFS), so there is nothing to restore',
  );
  await openFixtures(page, ['simple-text.pdf']);
  await expect(page.getByRole('tab', { name: 'simple-text' })).toBeVisible();
  await waitForSnapshot(page);

  await page.goto('./?sample=en');
  await expect(page.getByRole('tab', { name: 'Recto sample', selected: true })).toBeVisible({
    timeout: 20_000,
  });
  expect(await openDocumentTitles(page)).toContain('simple-text');
  await expectCleanAddress(page);
});

test.describe('offline', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Service worker + offline emulation is verified on Chromium (as in offline.spec.ts)',
  );

  test('the sample opens offline after one visit', async ({ page, context }) => {
    await page.goto('./');
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 30_000,
      })
      .toBe(true);
    // Both samples are in the precache.
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        urls.push(...(await cache.keys()).map((request) => request.url));
      }
      return urls.filter((url) => /\/sample\/recto-sample-(en|tr)\.pdf/.test(url)).length;
    });
    expect(cached).toBe(2);
    // The engine wasm is warmed into its runtime cache once the shell is offline-ready.
    await expect
      .poll(
        () =>
          page.evaluate(async () => (await (await caches.open('pdf-editor-wasm')).keys()).length),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    await context.setOffline(true);
    await page.goto('./?sample=tr');
    await expect(page.getByRole('tab', { name: 'Recto örnek belge', selected: true })).toBeVisible({
      timeout: 20_000,
    });
    await expectCleanAddress(page);
    await expectRendered(page);
    await context.setOffline(false);
  });
});
