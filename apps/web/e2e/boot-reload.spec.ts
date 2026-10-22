/**
 * A boot whose edition chunk fails to load reloads once and comes up (PRD-26,
 * `src/pwa/boot-reload.ts`). Before it, the page stayed blank: in CI the reload after Settings
 * removed the Office package sometimes had a few of the app chunk's module requests aborted
 * (`net::ERR_ABORTED`), `import('./app')` rejected and nothing ever mounted (office.spec.ts).
 * Here the first request for the chunk is aborted on purpose. The service worker is blocked so
 * the route sees every request; the precache plays no part in what is tested.
 */
import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** The full edition's chunk (`main.tsx`): `assets/app-<hash>.js`, not its stylesheet. */
const APP_CHUNK = /\/assets\/app-[\w-]{8}\.js$/;

test('a failed edition chunk reloads the page once and the app boots', async ({ page }) => {
  let aborted = 0;
  await page.route(APP_CHUNK, async (route) => {
    if (aborted === 0) {
      aborted += 1;
      await route.abort();
      return;
    }
    await route.continue();
  });
  let loads = 0;
  page.on('load', () => {
    loads += 1;
  });

  await page.goto('./');
  await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 20_000 });
  expect(aborted).toBe(1);
  // The first load, then the one reload.
  expect(loads).toBe(2);
});

test('a chunk that keeps failing does not reload in a loop', async ({ page }) => {
  await page.route(APP_CHUNK, (route) => route.abort());
  let loads = 0;
  page.on('load', () => {
    loads += 1;
  });

  // The first load's failure reloads without an error; the reloaded page's failure is thrown,
  // which is where the decision not to reload again has been made.
  const thrown = page.waitForEvent('pageerror');
  await page.goto('./');
  await thrown;
  expect(loads).toBe(2);
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
});
