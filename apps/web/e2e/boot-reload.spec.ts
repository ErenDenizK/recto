/**
 * A boot whose edition chunk fails to load reloads once and comes up (PRD-26,
 * `src/pwa/boot-reload.ts`). Before it, the page stayed blank: in CI the reload after Settings
 * removed the Office package sometimes had a few of the app chunk's module requests aborted
 * (`net::ERR_ABORTED`), `import('./app')` rejected and nothing ever mounted (office.spec.ts).
 *
 * Here the chunk is answered 503 with `no-store` until the page reloads.
 * The booted page is checked by its two main-frame navigations, the chunk's answers and the
 * reload's note in session storage. The service worker is blocked so the route sees every
 * request; the precache plays no part here.
 */
import { expect, type Page, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** `src/pwa/boot-reload.ts`: set when the page reloaded for a failed launch chunk. */
const BOOT_RELOAD_KEY = 'pdf-editor:boot-reload:v1';

/** The full edition's chunk (`main.tsx`): `assets/app-<hash>.js`, not its stylesheet. */
const APP_CHUNK = /\/assets\/app-[\w-]{8}\.js$/;

const UNAVAILABLE = {
  status: 503,
  headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
  body: 'unavailable',
};

/** Counts the page's main-frame navigations (the first load, then each reload). */
function countNavigations(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) count += 1;
  });
  return () => count;
}

test('a failed edition chunk reloads the page once and the app boots', async ({ page }) => {
  // Every request for the chunk fails until the page reloads: an engine may fetch it more than
  // once for one import (Firefox did, and its second fetch then booted without any reload).
  const documents = countNavigations(page);
  const answers: string[] = [];
  await page.route(APP_CHUNK, async (route) => {
    if (documents() <= 1) {
      answers.push('503');
      await route.fulfill(UNAVAILABLE);
    } else {
      answers.push('ok');
      await route.continue();
    }
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');
  try {
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    throw new Error(
      `no shell; documents ${documents()}, chunk answers ${answers.join(',')}, page errors ${JSON.stringify(errors)}`,
      { cause: error },
    );
  }
  // The first document's chunk failed, the one reload fetched it and booted.
  expect(documents()).toBe(2);
  expect(answers[0]).toBe('503');
  expect(answers.at(-1)).toBe('ok');
  expect(await page.evaluate((key) => sessionStorage.getItem(key), BOOT_RELOAD_KEY)).not.toBeNull();
});

test('a chunk that keeps failing does not reload in a loop', async ({ page }) => {
  await page.route(APP_CHUNK, (route) => route.fulfill(UNAVAILABLE));
  const navigations = countNavigations(page);

  // The first load's failure reloads without an error; the reloaded page's failure is thrown,
  // which is where the decision not to reload again has been made.
  const thrown = page.waitForEvent('pageerror');
  await page.goto('./');
  await thrown;
  expect(navigations()).toBe(2);
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
});
