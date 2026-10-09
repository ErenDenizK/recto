/**
 * 'Inter Recto' on a cold load (quality-bar Q-8; spec redesign D3-5; ADR-0027 §2.1):
 *
 * - **Nothing shifts.** In a fresh context (empty cache, no service worker), the layout-shift
 *   entries recorded from the first paint until the fonts are in and the shell is at rest sum
 *   to 0, in English and in Turkish (whose Latin Extended file `main.tsx` asks for early).
 * - **The face is the one shipped.** The chrome is set in 'Inter Recto' from this origin: the
 *   preloaded Latin file is fetched once (the preload is used, not doubled by the stylesheet),
 *   nothing comes from another origin, and no Fontsource or JetBrains Mono file is requested.
 * - **The fallback is metric-matched.** With the font held back so the first paint is in
 *   'Inter Recto Fallback' (Arial or Liberation Sans scaled by `size-adjust`, with Inter's ascent
 *   and descent), the swap barely moves the shell: the layout-shift score stays under 0.01 (it
 *   measured 0 on Home when this was written). This is the safety net behind the preload, for a
 *   slow network or a machine whose Arial differs.
 *
 * Layout Instability (`layout-shift` entries) is a Chromium API; Firefox and WebKit skip the
 * shift checks and keep the rest.
 */
import { type Browser, expect, type Page, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

/** Records layout shifts from navigation on, as `window.__shifts` (no input in these runs). */
async function recordShifts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const shifts: { value: number; sources: string[] }[] = [];
    (window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
    if (!PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) return;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
        sources?: { node?: Node | null }[];
      })[]) {
        if (entry.hadRecentInput) continue;
        shifts.push({
          value: entry.value,
          sources: (entry.sources ?? []).map((s) =>
            s.node instanceof Element
              ? `${s.node.tagName.toLowerCase()}.${s.node.className}`.slice(0, 80)
              : String(s.node?.nodeName),
          ),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

/** Loads Home cold and waits for the fonts and for the shell to be at rest. */
async function coldLoad(page: Page, lang: 'en' | 'tr'): Promise<void> {
  await page.goto(`./?lang=${lang}`);
  await settle(page);
}

/** Waits for Home, the fonts and the shell at rest. */
async function settle(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: /^(Open files|Dosya aç)/ }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      // The aura's endless drift (Q-10's one exception) never comes to rest.
      .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );
  // Two frames for the observer to deliver what the last layout produced.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

const shifts = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __shifts: { value: number; sources: string[] }[] }).__shifts,
  );

const total = (list: { value: number }[]) => list.reduce((sum, s) => sum + s.value, 0);

async function freshPage(browser: Browser): Promise<Page> {
  // A new context: an empty HTTP cache and no service worker, as on a first visit.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  });
  return context.newPage();
}

for (const lang of ['en', 'tr'] as const) {
  test(`a cold load shifts nothing (${lang})`, async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'layout-shift entries are a Chromium API');
    const page = await freshPage(browser);
    await recordShifts(page);
    await coldLoad(page, lang);
    const list = await shifts(page);
    expect(total(list), JSON.stringify(list)).toBe(0);
    await page.context().close();
  });
}

test('the chrome is set in the shipped face, from this origin, preloaded once', async ({
  browser,
}) => {
  const page = await freshPage(browser);
  const fonts: string[] = [];
  let latinFetches = 0;
  await page.route('**/fonts/inter-recto-latin.woff2', async (route) => {
    latinFetches += 1;
    await route.continue();
  });
  page.on('request', (request) => {
    if (request.resourceType() === 'font' || /\.(woff2?|ttf|otf)(\?|$)/.test(request.url())) {
      fonts.push(new URL(request.url()).pathname);
    }
  });
  await coldLoad(page, 'tr');
  // Fetched once: counted where a request leaves the page for the network (the route), not as
  // `request` events or resource-timing entries. WebKit reports the face's use of the preloaded
  // file as a second request and a second timing entry although it is served from the memory
  // cache; a real second fetch would reach the route twice.
  expect(latinFetches, fonts.join('\n')).toBe(1);
  expect(fonts.some((path) => path.endsWith('/fonts/inter-recto-latin-ext.woff2'))).toBe(true);
  expect(fonts.filter((path) => /fontsource|jetbrains|inter-latin-wght/i.test(path))).toEqual([]);
  const face = await page.evaluate(() => ({
    family: getComputedStyle(document.body).fontFamily,
    loaded: document.fonts.check("13px 'Inter Recto'", 'Aa ğİş'),
    origins: [
      ...new Set(
        performance
          .getEntriesByType('resource')
          .filter((e) => /\.(woff2?|ttf|otf)$/.test(new URL(e.name).pathname))
          .map((e) => new URL(e.name).origin),
      ),
    ],
  }));
  // The first family, however the engine serializes it: Chromium and Firefox keep the quotes,
  // while CSSOM lets a name of plain identifiers serialize bare (`Inter Recto, …`).
  const first = face.family
    .split(',')[0]
    ?.trim()
    .replace(/^(['"])(.*)\1$/, '$2');
  expect(first, face.family).toBe('Inter Recto');
  expect(face.loaded).toBe(true);
  expect(face.origins).toEqual([new URL(page.url()).origin]);
  await page.context().close();
});

test('with the font held back, the swap from the fallback barely moves the chrome', async ({
  browser,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'layout-shift entries are a Chromium API');
  const page = await freshPage(browser);
  await recordShifts(page);
  // Hold the font until the shell has painted in the fallback.
  let release: () => void = () => undefined;
  const held = new Promise<void>((done) => {
    release = done;
  });
  await page.route('**/fonts/inter-recto-*.woff2', async (route) => {
    await held;
    await route.continue();
  });
  // `load` would wait for the preloaded font.
  await page.goto('./?lang=en', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^Open files/ }).first()).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check("13px 'Inter Recto'", 'A'))).toBe(false);
  await page.waitForTimeout(300);
  release();
  await settle(page);
  expect(await page.evaluate(() => document.fonts.check("13px 'Inter Recto'", 'A'))).toBe(true);
  const list = await shifts(page);
  expect(total(list), JSON.stringify(list)).toBeLessThan(0.01);
  await page.context().close();
});
