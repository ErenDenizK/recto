/**
 * A boot whose edition chunk fails to load reloads once and comes up (PRD-26,
 * `src/pwa/boot-reload.ts`). Before it, the page stayed blank: in CI the reload after Settings
 * removed the Office package sometimes had a few of the app chunk's module requests aborted
 * (`net::ERR_ABORTED`), `import('./app')` rejected and nothing ever mounted (office.spec.ts).
 *
 * Here the chunk's first answer is a 503 with `no-store`, a failed module load in every engine.
 * The booted page is checked by the chunk's two routed requests and the reload's
 * note in session storage, which hold in every engine (a reload's navigation type and its
 * request event do not, in Firefox). The service worker is blocked so the route sees every
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
  let requests = 0;
  await page.route(APP_CHUNK, async (route) => {
    requests += 1;
    if (requests === 1) await route.fulfill(UNAVAILABLE);
    else await route.continue();
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('./');
  try {
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    throw new Error(`no shell; chunk requests ${requests}, page errors ${JSON.stringify(errors)}`, {
      cause: error,
    });
  }
  // The first load failed the chunk, the one reload fetched it again and booted.
  expect(requests).toBe(2);
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
