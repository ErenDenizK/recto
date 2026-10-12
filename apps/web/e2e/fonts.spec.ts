/**
 * 'Inter Recto' on a cold load (quality-bar Q-8; spec redesign D3-5; ADR-0027 §2.1):
 *
 * - **Nothing shifts.** In a fresh context (empty cache, no service worker), the layout-shift
 *   entries recorded from the first paint until the fonts are in and the shell is at rest sum
 *   to 0, in English and in Turkish (whose Latin Extended file `main.tsx` asks for early).
 * - **The face is the one shipped.** The chrome is set in 'Inter Recto' from this origin: the
 *   preloaded Latin file is fetched once (the preload is used, not doubled by the stylesheet;
 *   `public/preload-face.js` matches the preload's mode to the engine's, PRC-16),
 *   nothing comes from another origin, and no Fontsource or JetBrains Mono file is requested.
 * - **The fallback is metric-matched.** With the font held back so the first paint is in
 *   'Inter Recto Fallback' (Arial or Liberation Sans scaled by `size-adjust`, with Inter's ascent
 *   and descent), the swap barely moves the shell: the layout-shift score stays under 0.01 (it
 *   measured 0 on Home when this was written). This is the safety net behind the preload, for a
 *   slow network or a machine whose Arial differs.
 *
 * Layout Instability (`layout-shift` entries) is a Chromium API; Firefox and WebKit skip the
 * shift checks and keep the rest.
 *
 * "Fetched once" is counted on the server side, by a counting proxy in front of the preview,
 * not by `page.route`: a route turns request interception on, and in WebKit Playwright then
 * disables resource caching (`Network.setResourceCachingDisabled`), so the face's use of the
 * preloaded file goes to the network again and the route sees two fetches that Safari never
 * makes. Nor by `request` events or resource-timing entries: WebKit reports a
 * memory-cache reuse as both. The proxy leaves every engine's caches as a visitor has them and
 * sees each request that leaves the browser, a revalidation included.
 */
import { createServer, request as forward } from 'node:http';
import type { AddressInfo } from 'node:net';

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

/**
 * A proxy in front of `upstream` (the preview server) that counts the requests reaching it by
 * path. Its own origin serves the same build, so the page is still served from one origin.
 */
async function countingProxy(upstream: string) {
  const target = new URL(upstream);
  const hits = new Map<string, number>();
  /** Each request, `path` plus ` (conditional)` when the browser revalidated a copy it had. */
  const log: string[] = [];
  // `localhost` may resolve to ::1 for the browser and the preview server but to 127.0.0.1 here
  // (or the other way round, CI's container differs from a laptop): a refused address tries the
  // next. Only GETs and HEADs come through (a page load), so nothing has a body to replay.
  const hosts =
    target.hostname === 'localhost' ? ['localhost', '127.0.0.1', '::1'] : [target.hostname];
  const server = createServer((incoming, outgoing) => {
    const path = new URL(incoming.url ?? '/', 'http://proxy').pathname;
    hits.set(path, (hits.get(path) ?? 0) + 1);
    const conditional = incoming.headers['if-none-match'] ?? incoming.headers['if-modified-since'];
    log.push(conditional ? `${path} (conditional)` : path);
    const attempt = (index: number) => {
      const upstreamRequest = forward(
        {
          hostname: hosts[index],
          port: target.port,
          path: incoming.url,
          method: incoming.method,
          headers: { ...incoming.headers, host: target.host },
        },
        (response) => {
          // The deployed site's caching, not the preview server's: GitHub Pages serves every
          // file with `max-age=600`, while `vite preview` says `no-cache`, which lets an engine
          // revalidate a preloaded font when the face asks for it, a request no visitor makes.
          const headers = { ...response.headers, 'cache-control': 'max-age=600' };
          outgoing.writeHead(response.statusCode ?? 502, headers);
          response.pipe(outgoing);
        },
      );
      upstreamRequest.on('error', (error) => {
        if (index + 1 < hosts.length && !outgoing.headersSent) attempt(index + 1);
        else {
          console.error(`counting proxy: ${incoming.method} ${incoming.url}: ${String(error)}`);
          outgoing.destroy();
        }
      });
      upstreamRequest.end();
    };
    attempt(0);
  });
  await new Promise<void>((listening) => server.listen(0, listening));
  const { port } = server.address() as AddressInfo;
  return {
    /** `upstream`'s URL (base path included) moved to the proxy's origin. */
    url: Object.assign(new URL(upstream), { port: String(port) }).href,
    log: () => log.join('\n'),
    hits: (suffix: string) =>
      [...hits].reduce((sum, [path, n]) => (path.endsWith(suffix) ? sum + n : sum), 0),
    close: () =>
      new Promise<void>((closed) => {
        server.close(() => closed());
        server.closeAllConnections();
      }),
  };
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
  browserName,
  baseURL,
}) => {
  const proxy = await countingProxy(baseURL ?? 'http://localhost:4173/');
  const page = await freshPage(browser);
  const fonts: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font' || /\.(woff2?|ttf|otf)(\?|$)/.test(request.url())) {
      fonts.push(new URL(request.url()).pathname);
    }
  });
  await page.goto(new URL('./?lang=tr', proxy.url).href);
  await settle(page);
  // Fetched once: counted where the requests arrive, the server (see the head of this file).
  expect(proxy.hits('/fonts/inter-recto-latin.woff2'), proxy.log()).toBe(1);
  // Through the head's preload (PRC-16): in the mode the engine's face fetches in, CORS but in
  // WebKit, so the face uses it rather than fetching the file again.
  const preloads = await page.evaluate(() =>
    [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map(
      (link) => ({ path: new URL(link.href).pathname, crossOrigin: link.crossOrigin }),
    ),
  );
  expect(preloads).toHaveLength(1);
  expect(preloads[0]?.path).toMatch(/\/fonts\/inter-recto-latin\.woff2$/);
  expect(preloads[0]?.crossOrigin).toBe(browserName === 'webkit' ? null : 'anonymous');
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
  await proxy.close();
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
