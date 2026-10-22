/* eslint-disable -- temporary probe */
// page.evaluate callbacks run in the browser.
/**
 * On-device Office conversion, phases 1 and 2 (ADR-0035 §7, EDN-20): the real LibreOffice
 * package, end to end, behind `?office=1`. A Word file is picked, the sheet asks once, the
 * ~79 MB package downloads from the app's own origin into its cache, the page reloads once into
 * cross-origin isolation (granted by the service worker, public/sw-office.js), the file
 * converts in the worker, and the PDF opens as a tab through the normal open path. A
 * spreadsheet and a presentation then convert on the installed package, the rest of the app
 * runs under isolation (a corpus PDF renders, the UI font loads, no request left the origin),
 * and Settings removes the package: the next load is not isolated.
 *
 * It runs on every project that lists it (chromium, firefox, webkit, tablet, ipad). After the
 * reload it asserts `crossOriginIsolated` and a usable `SharedArrayBuffer`. Peak memory is
 * sampled from the host (`ps` RSS of the browser processes every 500 ms, Linux only; shared
 * pages count once per process, so it over-reads) and written as a `peak-memory` annotation.
 *
 * Required in CI: chromium, firefox, tablet. webkit and ipad (Playwright's WebKit on Linux, not
 * iPad Safari) run with `continue-on-error` in the `e2e-office` job: if that WebKit cannot get
 * isolation through the service worker, or has no SharedArrayBuffer, the failure is that
 * engine's gap, and docs/qa/office-ipad-checklist.md carries the claim on a real iPad.
 *
 * It needs the package in the build (`node packages/engine/office/fetch.ts`, then the build);
 * without it the test is skipped.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import {
  atRest,
  openFixtures,
  saveCopyBytes,
  useDownloadPath,
  useFileInputPicker,
} from './helpers';
import { docx } from './support/docx';
import { pptx, xlsx } from './support/ooxml';

const lock = JSON.parse(
  readFileSync(
    new URL('../../../packages/engine/office/office.lock.json', import.meta.url),
    'utf8',
  ),
) as { readonly directory: string };
const packageBuilt = existsSync(
  fileURLToPath(new URL(`../dist/convert/${lock.directory}/soffice.js`, import.meta.url)),
);

test.skip(!packageBuilt, 'The build has no Office package (packages/engine/office/fetch.ts)');

/** Browser processes on the host (Chromium, Firefox, WebKit's helpers). */
const BROWSER_PROCESS = /chrom|headless_shell|firefox|MiniBrowser|WebKit|Web Content|WebProcess/i;

/** Sums the RSS (MB) of the browser processes every 500 ms; Linux only, otherwise a no-op. */
function sampleMemory(): () => number | null {
  if (process.platform !== 'linux') return () => null;
  let peak = 0;
  const sample = () =>
    execFile('ps', ['-eo', 'rss=,comm='], (error, out) => {
      if (error) return;
      let kb = 0;
      for (const line of out.split('\n')) {
        const match = /^\s*(\d+)\s+(.*)$/.exec(line);
        if (match && BROWSER_PROCESS.test(match[2] ?? '')) kb += Number(match[1]);
      }
      peak = Math.max(peak, kb / 1024);
    });
  sample();
  const timer = setInterval(sample, 500);
  return () => {
    clearInterval(timer);
    return peak > 0 ? Math.round(peak) : null;
  };
}

/**
 * Waits for the app after a navigation: the shell mounted, then at rest. A boot is not an
 * animation: on a cold first visit (the service worker precaching beside it) or right after a
 * page that held the converter's wasm heap, the shell can mount later than `atRest`'s 5 s allow,
 * and the poll runs out on a shell that is not there yet (CI, PR #55, first tries: WebKit after
 * the first `goto`, Chromium after the last reload; locally the shell rests ~1.5 s after a
 * navigation, even with the CPU slowed 4×). So the mount gets the navigation's own allowance
 * first, and `atRest` keeps its 5 s for the motion.
 */
async function booted(page: Page): Promise<void> {
  const shell = page.getByTestId('app-shell');
  await expect(shell).toBeVisible({ timeout: 30_000 });
  await atRest(shell);
}

const OOXML = 'application/vnd.openxmlformats-officedocument.';

/**
 * On a failure, what the page knew: whether it is isolated, the service worker that controls
 * it, the package cache's entries and what the Office sheet says, so a CI failure on an
 * engine that cannot run here says where the flow stopped.
 */
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;
  const state = await page
    .evaluate(async () => {
      const registration = await navigator.serviceWorker?.getRegistration();
      const cache = await caches.open('pdf-editor-office').catch(() => null);
      const keys = cache === null ? [] : await cache.keys();
      return {
        url: location.href,
        crossOriginIsolated,
        sharedArrayBuffer: typeof SharedArrayBuffer,
        controller: navigator.serviceWorker?.controller?.state ?? null,
        active: registration?.active?.state ?? null,
        waiting: registration?.waiting?.state ?? null,
        officeCache: keys.map((request) => new URL(request.url).pathname),
        sheet: document.querySelector('[data-testid="office-sheet"]')?.textContent ?? null,
      };
    })
    .catch((error: unknown) => ({ unreadable: String(error) }));
  const description = JSON.stringify(state);
  console.log(`[office] ${testInfo.project.name}: ${description}`);
  testInfo.annotations.push({ type: 'office-state', description });
});

/** Picks a file through the Open files button. */
async function pick(page: Page, name: string, mimeType: string, buffer: Buffer): Promise<void> {
  const chooser = page.waitForEvent('filechooser');
  await page
    .getByRole('button', { name: /^(Open files|Dosya aç)$/ })
    .first()
    .click();
  await (await chooser).setFiles({ name, mimeType, buffer });
}

test('a Word file converts on the device and opens as a PDF', async ({ page }) => {
  test.setTimeout(480_000);
  const stopSampling = sampleMemory();
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  // PROBE (temporary): what the page did, with times.
  const t0 = Date.now();
  const log = (...a: unknown[]) => console.log(`[probe +${Date.now() - t0}ms]`, ...a);
  page.on('console', (msg) => log('console', msg.type(), msg.text().slice(0, 200)));
  page.on('pageerror', (e) => log('pageerror', String(e.stack ?? e).slice(0, 1500)));
  page.on('requestfailed', (r) => log('requestfailed', r.url(), r.failure()?.errorText));
  page.on('dialog', (d) => {
    log('dialog', d.type());
    void d.accept();
  });
  page.on('load', () => log('load', page.url()));
  page.on('crash', () => log('crash'));
  page.on('worker', (w) => log('worker', w.url()));
  const pending = new Map<object, string>();
  let watching = false;
  page.on('request', (r) => {
    if (watching) log('req', r.url(), r.resourceType(), r.serviceWorker() ? 'sw' : '');
    pending.set(r, r.url());
  });
  page.on('requestfinished', (r) => {
    pending.delete(r);
  });
  page.on('requestfailed', (r) => pending.delete(r));
  page.on('response', (r) => {
    if (watching) log('res', r.status(), r.url(), r.fromServiceWorker() ? 'fromSW' : '');
  });
  page.context().on('serviceworker', (w) => log('sw', w.url()));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  cdp.on('Network.loadingFailed', (e) => {
    if (watching) log('cdp loadingFailed', JSON.stringify(e));
  });

  await useFileInputPicker(page);
  await useDownloadPath(page);
  await page.goto('./?office=1');
  await booted(page);
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

  await pick(
    page,
    'report.docx',
    `${OOXML}wordprocessingml.document`,
    docx(['First page: Recto converts this.', 'İkinci sayfa: ğüşiöç.', 'Third page.']),
  );

  // The sheet comes with the lazy Office chunk, loaded by this first pick: mounted, then at rest.
  const sheet = page.getByTestId('office-sheet');
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await atRest(sheet);
  await expect(page.getByTestId('office-consent')).toContainText(/one-time conversion package/);
  await expect(page.getByTestId('office-file')).toHaveText('report.docx');

  // Download, then the one reload into isolation, then the conversion. The reload is a new
  // document's `load`, not any `framenavigated` (a same-document URL change fires that too).
  const reloaded = page.waitForEvent('load', { timeout: 240_000 });
  const started = Date.now();
  await page.getByTestId('office-download').click();
  await reloaded;
  await booted(page);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  expect(await page.evaluate(() => typeof SharedArrayBuffer)).toBe('function');

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
    expect.arrayContaining([
      'soffice.wasm',
      'soffice.data',
      'soffice.js',
      'NOTICE.txt',
      'MPL-2.0.txt',
      'installed.json',
    ]),
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

  // A spreadsheet and a presentation on the installed package: no consent, no reload.
  const convertedAt = Date.now();
  await pick(
    page,
    'ledger.xlsx',
    `${OOXML}spreadsheetml.sheet`,
    xlsx([
      ['Item', 'Amount'],
      ['Ağaç', '12'],
      ['Şeker', '7'],
    ]),
  );
  await expect(page.getByRole('tab', { name: 'ledger' })).toBeVisible({ timeout: 180_000 });
  await expect(page.locator('main canvas[data-state="rendered"]').first()).toBeVisible();
  const sheetMs = Date.now() - convertedAt;
  const deckAt = Date.now();
  await pick(
    page,
    'deck.pptx',
    `${OOXML}presentationml.presentation`,
    pptx(['First slide', 'İkinci slayt', 'Third slide']),
  );
  await expect(page.getByRole('tab', { name: 'deck' })).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId('page-pill')).toHaveText(/^1 \/ 3 · /, { timeout: 30_000 });
  test.info().annotations.push({
    type: 'timing-formats',
    description: `xlsx ${sheetMs} ms, pptx ${Date.now() - deckAt} ms`,
  });

  // Settings, Office conversion package, Remove…, confirm: after a reload the page is no
  // longer isolated (PRD-21).
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').first().fill('Settings');
  await page
    .getByRole('option', { name: /^Settings…/ })
    .first()
    .click();
  const settings = page.getByTestId('settings-sheet');
  await atRest(settings);
  const row = settings.getByTestId('settings-office-remove');
  await row.scrollIntoViewIfNeeded();
  await expect(settings.getByText('Office conversion package')).toBeVisible();
  await row.click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(row).toBeDisabled();
  const [worker] = page.context().serviceWorkers();
  log('patching sw', worker?.url());
  await worker
    ?.evaluate(() => {
      const g = self as unknown as {
        __probe: string[];
        caches: CacheStorage;
        fetch: typeof fetch;
      };
      const t = Date.now();
      const out: string[] = [];
      g.__probe = out;
      const note = (s: string) => out.push(`+${Date.now() - t} ${s}`);
      const proto = (
        self as unknown as { FetchEvent: { prototype: { respondWith(p: unknown): void } } }
      ).FetchEvent.prototype;
      const respondWith = proto.respondWith;
      proto.respondWith = function (this: { request: Request }, p: unknown) {
        const url = this.request.url;
        Promise.resolve(p).then(
          (r) => {
            const res = r as Response;
            if (!res || res.type === 'error' || res.status !== 200)
              note(`resp ${url} ${res?.type} ${res?.status}`);
            const clone = res?.clone?.();
            clone?.arrayBuffer().then(
              () => undefined,
              (e: unknown) => note(`body error ${url} ${String(e)}`),
            );
          },
          (e: unknown) => note(`respondWith rejected ${url} ${String(e)}`),
        );
        return respondWith.call(this, p);
      };
      const match = Cache.prototype.match;
      Cache.prototype.match = function (this: Cache, ...a: Parameters<Cache['match']>) {
        return match.apply(this, a).catch((e: unknown) => {
          note(
            `cache.match error ${String(a[0] instanceof Request ? a[0].url : a[0])} ${String(e)}`,
          );
          throw e;
        });
      };
      const f = g.fetch;
      g.fetch = (...a: Parameters<typeof fetch>) =>
        f(...a).then(
          (r) => {
            note(`sw fetch ${String(a[0] instanceof Request ? a[0].url : a[0])} ${r.status}`);
            return r;
          },
          (e: unknown) => {
            note(
              `sw fetch error ${String(a[0] instanceof Request ? a[0].url : a[0])} ${String(e)}`,
            );
            throw e;
          },
        );
      self.addEventListener('error', (e) => note(`error ${String((e as ErrorEvent).message)}`));
      self.addEventListener('unhandledrejection', (e) =>
        note(`unhandledrejection ${String((e as PromiseRejectionEvent).reason)}`),
      );
      note('patched');
    })
    .catch((e: unknown) => log('patch failed', String(e)));
  log('final reload');
  pending.clear();
  watching = true;
  await page.reload();
  log('reloaded');
  try {
    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 30_000 });
    log('booted');
  } catch (error) {
    log('BOOT FAILED; pending requests', [...pending.values()]);
    const dump = await page
      .evaluate(async () => {
        const nav = performance.getEntriesByType('navigation')[0] as
          | PerformanceNavigationTiming
          | undefined;
        const registration = await navigator.serviceWorker?.getRegistration();
        return {
          root: document.getElementById('root')?.innerHTML.slice(0, 500),
          html: Object.fromEntries(Object.entries(document.documentElement.dataset)),
          readyState: document.readyState,
          nav: nav && {
            type: nav.type,
            duration: nav.duration,
            worker: nav.workerStart,
            status: nav.responseStatus,
          },
          resources: performance.getEntriesByType('resource').map((e) => {
            const r = e as PerformanceResourceTiming;
            return `${new URL(r.name).pathname} ${Math.round(r.startTime)}+${Math.round(r.duration)} ${r.responseStatus}`;
          }),
          controller: navigator.serviceWorker?.controller?.scriptURL,
          active: registration?.active?.scriptURL,
          session: sessionStorage.length,
          keys: Object.keys(sessionStorage),
          caches: await caches.keys(),
        };
      })
      .catch((e: unknown) => String(e));
    log('BOOT FAILED dump', JSON.stringify(dump));
    log(
      'sw workers now',
      page
        .context()
        .serviceWorkers()
        .map((w) => w.url()),
      worker === page.context().serviceWorkers()[0],
    );
    const swLog = await worker
      ?.evaluate(
        () => (self as unknown as { __probe?: string[] }).__probe ?? 'no probe (restarted?)',
      )
      .catch((e: unknown) => `sw evaluate failed ${String(e)}`);
    log('SW LOG', JSON.stringify(swLog));
    throw error;
  }
  await atRest(page.getByTestId('app-shell'));
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);

  const peak = stopSampling();
  test.info().annotations.push({
    type: 'peak-memory',
    description: peak === null ? 'not sampled (not Linux)' : `${peak} MB (browser RSS sum)`,
  });
});
