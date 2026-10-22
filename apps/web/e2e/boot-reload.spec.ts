/**
 * A boot whose edition chunk fails to load still comes up (PRD-26,
 * `src/pwa/boot-reload.ts`). Before it, the page stayed blank: in CI the reload after Settings
 * removed the Office package sometimes had a few of the app chunk's module requests aborted
 * (`net::ERR_ABORTED`), `import('./app')` rejected and nothing ever mounted (office.spec.ts).
 *
 * The launch first imports the chunk again under a fresh URL (`?r=`), then reloads once. Here
 * the chunk is answered 503 with `no-store`: under its own URL only (the retry boots the page),
 * then for every request until the reload (the reload boots it), then always (one reload, then
 * the static screen). A shared chunk that fails, which no retry reaches, ends on the screen too,
 * and its Reload loads a cache-busted document URL, keeping the address's parameters (WebKit
 * still fails the shared chunk on that page: a known Safari gap, PRD-26). The
 * booted page is checked by its main-frame navigations, the chunk's answers and the reload's
 * note in session storage. The service worker is blocked so the route sees every request; the
 * precache plays no part here.
 */
import { expect, type Page, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/** `src/pwa/boot-reload.ts`: set when the page reloaded for a failed launch chunk. */
const BOOT_RELOAD_KEY = 'pdf-editor:boot-reload:v1';

/** What both editions load (vite.config.ts `editionGroups`): `assets/editions-<hash>.js`. */
const SHARED_CHUNK = /\/assets\/editions-[\w-]{8}\.js(\?r=\d+)?$/;

/** The full edition's chunk (`main.tsx`): `assets/app-<hash>.js`, retried with `?r=`. */
const APP_CHUNK = /\/assets\/app-[\w-]{8}\.js(\?r=\d+)?$/;

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

/** The page's uncaught errors, for a failure message. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Waits for the shell; when it does not come, says what the page saw. */
async function shellOrSay(page: Page, seen: () => string, errors: string[]): Promise<void> {
  try {
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    throw new Error(`no shell; ${seen()}, page errors ${JSON.stringify(errors)}`, {
      cause: error,
    });
  }
}

test('a failed edition chunk is imported again in the page and the app boots', async ({ page }) => {
  // The chunk's own URL fails for this page, as a failed module keeps failing under its URL;
  // the retry asks for it under a fresh one.
  const documents = countNavigations(page);
  const answers: string[] = [];
  await page.route(APP_CHUNK, async (route) => {
    const retried = new URL(route.request().url()).searchParams.has('r');
    answers.push(retried ? 'retry ok' : '503');
    if (retried) await route.continue();
    else await route.fulfill(UNAVAILABLE);
  });
  const errors = collectErrors(page);

  await page.goto('./');
  await shellOrSay(
    page,
    () => `documents ${documents()}, chunk answers ${answers.join(',')}`,
    errors,
  );
  expect(documents()).toBe(1);
  expect(answers).toContain('503');
  expect(answers.at(-1)).toBe('retry ok');
  expect(await page.evaluate((key) => sessionStorage.getItem(key), BOOT_RELOAD_KEY)).toBeNull();
});

test('when the retry fails too, the page reloads once and the app boots', async ({ page }) => {
  // Every request for the chunk, retried or not, fails until the page reloads: an engine may
  // fetch it more than once for one import (Firefox does).
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
  const errors = collectErrors(page);

  await page.goto('./');
  await shellOrSay(
    page,
    () => `documents ${documents()}, chunk answers ${answers.join(',')}`,
    errors,
  );
  expect(documents()).toBe(2);
  expect(answers[0]).toBe('503');
  expect(answers.at(-1)).toBe('ok');
  expect(await page.evaluate((key) => sessionStorage.getItem(key), BOOT_RELOAD_KEY)).not.toBeNull();
});

test('a chunk that keeps failing reloads once, then says so, never in a loop', async ({ page }) => {
  await page.route(APP_CHUNK, (route) => route.fulfill(UNAVAILABLE));
  const navigations = countNavigations(page);

  await page.goto('./');
  // The screen comes once the reloaded page's retry has failed too: no reload after it.
  await expect(page.getByTestId('boot-failure')).toBeVisible({ timeout: 20_000 });
  expect(navigations()).toBe(2);
  await expect(page.getByTestId('app-shell')).toHaveCount(0);
});

test('a shared chunk that fails leaves the static screen, whose Reload busts the URL', async ({
  page,
}) => {
  // The chunk both editions share: no retry asks for it under a fresh URL.
  await page.route(SHARED_CHUNK, (route) => route.fulfill(UNAVAILABLE));
  const navigations = countNavigations(page);

  await page.goto('./?office=0');
  const screen = page.getByTestId('boot-failure');
  await expect(screen).toBeVisible({ timeout: 20_000 });
  await expect(screen).toHaveAttribute('role', 'alert');
  await expect(screen).toContainText('Recto could not start');
  expect(navigations()).toBe(2);

  // Reload loads the address again under `_r`, keeping its parameters. Whether that page then
  // boots differs: Chromium and Firefox ask for the shared chunk again, WebKit hands the reloaded
  // page its earlier failure (PRD-26), so it is the navigation that is checked here.
  await page.unroute(SHARED_CHUNK);
  await screen.getByRole('button', { name: 'Reload' }).click();
  await expect.poll(navigations, { message: 'the Reload navigation' }).toBe(3);
  await expect(page).toHaveURL(/[?&]_r=\d+/);
  await expect(page).toHaveURL(/[?&]office=0/);
});
