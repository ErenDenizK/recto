/**
 * Compact session JS recorder (docs/research/perf/compact-session-2026-10.md "Measure spec").
 * The static `compact` closure of bundle-budget.ts is not what a phone loads: idle prefetches add
 * more after paint. This script drives the built phone edition in Chromium and records which
 * `assets/*.js` files the main frame requests in a read-only session; bundle-budget.ts then
 * measures their gzip from `dist` (the browser only names files).
 *
 *   node --experimental-strip-types tools/qa/compact-session.ts [dist]
 *
 * Setup: a static server on `dist`, the Pixel 7 profile (390×844, touch), service workers
 * blocked so every fetch is visible, locale `en`.
 *
 * Scenario "read" (run twice, union of the file lists): open `/`, tap Try the sample, wait for
 * page 1 to render, scroll to the last page and wait for it to render, then wait at least 15 s
 * after page 1 and until 5 s pass with no request (the idle timeouts top out at 4 s). The file
 * list leaves out worker scripts and the files only worker entries reach statically.
 *
 * Scenario "more" (once, printed and never gated): the read steps, then a tap on the title menu (the document's ⋯ menu); the files it
 * adds beyond the read list show what the intent costs.
 *
 * Output: apps/web/node_modules/.cache/recto/compact-session.json with the file names, the
 * `main-*.js` name as the build fingerprint and `SCENARIO_VERSION`; bump the version when the
 * scenario changes, so an old file cannot pass for a new scenario (bundle-budget.ts checks it).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

import { chromium, devices, type Page } from '@playwright/test';

import { chromiumLaunchOptions } from '../../tooling/playwright-chromium.ts';

const SCENARIO_VERSION = 1;

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(ROOT, 'apps/web/node_modules/.cache/recto/compact-session.json');
const MIN_WAIT_MS = 15_000;
const QUIET_MS = 5_000;
const RUNS = 2;

/** Static `import … from "./x.js"` edges, as in bundle-budget.ts. */
const STATIC_EDGE =
  /(?:^|[^.\w$])(?:import|export)\s*(?:[\w$*{}\s,]*?\s*from\s*)?["'](\.\.?\/[^"']+\.js)["']/g;

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function serve(dist: string): Promise<{ origin: string; close: () => void }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0] as string);
    let file = resolve(dist, `.${path}`);
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory())
      file = join(dist, 'index.html');
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      done({ origin: `http://127.0.0.1:${port}`, close: () => server.close() });
    }),
  );
}

/** The scripts `entries` reach through static edges, as names under `assets`. */
function reach(assets: string, entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = entries.map((name) => join(assets, name));
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_EDGE))
      queue.push(resolve(file, '..', match[1] as string));
  }
  return new Set([...seen].map((file) => file.slice(assets.length + 1)));
}

/**
 * The files only worker entries reach statically: the main frame does not load them. Playwright
 * attributes a worker's fetches to its frame, so these are dropped by name. What the entry or
 * the phone edition reaches stays, even when a worker shares it.
 */
function workerOnly(assets: string, names: readonly string[]): Set<string> {
  const workers = names.filter((name) => /\.worker-[\w-]+\.js$/.test(name));
  const main = names.filter((name) => /^(?:main|CompactApp)-[\w-]{8}\.js$/.test(name));
  const skip = reach(assets, workers);
  for (const name of reach(assets, main)) skip.delete(name);
  return skip;
}

async function quiet(page: Page, lastRequest: () => number): Promise<void> {
  while (Date.now() - lastRequest() < QUIET_MS) await page.waitForTimeout(250);
}

/** One session: the read steps, then (with `openMore`) a tap on ⋯. Returns the script names. */
async function session(origin: string, openMore: boolean): Promise<[string[], string[]]> {
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const context = await browser.newContext({
      ...devices['Pixel 7'],
      serviceWorkers: 'block',
      locale: 'en-US',
    });
    const page = await context.newPage();
    const read = new Set<string>();
    const more = new Set<string>();
    let target = read;
    let last = Date.now();
    page.on('request', (request) => {
      last = Date.now();
      if (request.frame() !== page.mainFrame()) return;
      const name = /\/assets\/([^/?#]+\.js)(?:[?#]|$)/.exec(request.url())?.[1];
      if (name) target.add(name);
    });
    await page.goto(`${origin}/?lang=en`);
    await page.getByTestId('compact-library').waitFor();
    await page.getByRole('button', { name: 'Try the sample' }).click();
    const rendered = (index: string) =>
      page.locator(`[data-page-index="${index}"] canvas[data-state="rendered"]`).first();
    await rendered('0').waitFor({ timeout: 60_000 });
    const firstRendered = Date.now();
    const lastIndex = (await page
      .locator('[data-page-index]')
      .last()
      .getAttribute('data-page-index')) as string;
    await page.locator(`[data-page-index="${lastIndex}"]`).scrollIntoViewIfNeeded();
    await rendered(lastIndex).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(Math.max(0, MIN_WAIT_MS - (Date.now() - firstRendered)));
    await quiet(page, () => last);
    if (openMore) {
      target = more;
      const trigger = page.getByTestId('compact-title-menu-trigger');
      // Scrolling hides the chrome; the top of the document shows it again.
      await page.locator('[data-page-index="0"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1_000);
      await trigger.tap({ timeout: 10_000 });
      await page.waitForTimeout(1_000);
      await quiet(page, () => last);
    }
    return [[...read], [...more].filter((name) => !read.has(name))];
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const dist = resolve(ROOT, process.argv[2] ?? 'apps/web/dist');
  const assets = join(dist, 'assets');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(`No build at ${dist}. Run \`pnpm build\` first.`);
    process.exit(1);
  }
  const entry = readdirSync(assets).find((name) => /^main-[\w-]{8}\.js$/.test(name));
  if (!entry) {
    console.error(`No main-*.js in ${assets}.`);
    process.exit(1);
  }
  const server = await serve(dist);
  try {
    const union = new Set<string>();
    let moreOpened: string[] = [];
    for (let run = 0; run < RUNS; run++) {
      const [files, more] = await session(server.origin, run === 0);
      for (const file of files) union.add(file);
      if (run === 0) moreOpened = more;
      console.log(`run ${run + 1}: ${files.length} files`);
    }
    const skip = workerOnly(assets, readdirSync(assets));
    const keep = (name: string) => !skip.has(name) && !name.includes('.worker-');
    const files = [...union].filter(keep).sort();
    const opened = moreOpened.filter((name) => keep(name) && !union.has(name)).sort();
    mkdirSync(join(OUT, '..'), { recursive: true });
    writeFileSync(
      OUT,
      `${JSON.stringify({ version: SCENARIO_VERSION, main: entry, files, moreOpened: opened }, null, 2)}\n`,
    );
    console.log(`${files.length} session files, ${opened.length} more after ⋯. Wrote ${OUT}.`);
  } finally {
    server.close();
  }
}

await main();
