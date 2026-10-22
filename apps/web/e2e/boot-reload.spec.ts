/**
 * A boot whose edition chunk fails to load reloads once and comes up (PRD-26,
 * `src/pwa/boot-reload.ts`). Before it, the page stayed blank: in CI the reload after Settings
 * removed the Office package sometimes had a few of the app chunk's module requests aborted
 * (`net::ERR_ABORTED`), `import('./app')` rejected and nothing ever mounted (office.spec.ts).
 *
 * Here the chunk's first answer is a 503 with `no-store`, a failure every engine treats as a
 * failed module load and none keeps in its memory cache (an aborted route left WebKit's reload
 * unfinished). Reloads are counted as main-frame navigation requests, not `load` events: the
 * chunk can fail, and the page reload, before the first document's `load` (Firefox). The
 * service worker is blocked so the route sees every request; the precache plays no part here.
 */
import { expect, type Page, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

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
  const navigations = countNavigations(page);

  await page.goto('./');
  await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 20_000 });
  // The first load failed the chunk, the one reload fetched it again and booted.
  expect(requests).toBe(2);
  expect(navigations()).toBe(2);
  const type = await page.evaluate(
    () => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type,
  );
  expect(type).toBe('reload');
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
