/**
 * Performance baseline (docs/research/perf-2026-10.md): drives the production build in
 * Playwright's Chromium and reports, per device profile, the medians of N runs of:
 *
 * 1. First visit: first paint, Home visible and interactive, bytes by type, the service
 *    worker's share, time until the link is quiet (precache installed, wasm warmed).
 * 2. Repeat visit: the same, with the service worker in control.
 * 3. Opening the sample (warm) and a generated large PDF: time to the first page and to the
 *    mounted thumbnails (desktop sidebar) and the Pages grid.
 * 4. Scrolling the large PDF one step per frame: frame p50/p95, dropped frames, long tasks,
 *    frames with a blank visible page; desktop with Glass Clear and Solid, the phone with GPU
 *    glass forced on and off (test builds only, GLS-13).
 * 5. Zoom repaint: a keyboard zoom step until every visible canvas is sharp again.
 * 6. Ink (`window.__inkStats`, `annotations/pen/ink-stats.ts`) and typing in Find (Event
 *    Timing durations), desktop.
 * 7. Memory: open and close the large PDF three times; JS heap after GC, DOM nodes, workers,
 *    and the PSS of the whole browser process tree (Linux `/proc`).
 * 8. Long tasks and long animation frames during open, Save a copy and Export as images,
 *    with the scripts the frames name, mapped through source maps when the build has them.
 *
 * `--cpu-profile` adds one sampled main-thread profile of open + scroll, aggregated by self
 * time and mapped to sources (build with `vite build --sourcemap` for file:line).
 *
 * Network: an in-process static server serves the build with gzip (as GitHub Pages does) and,
 * for the phone, one shared throttled link (bandwidth + per-request latency). CDP's network
 * emulation does not reach the service worker's own fetches, so the throttle sits here, and
 * a request whose Referer is `sw.js` counts as the worker's.
 *
 * Usage (from the repo root, after `RECTO_RENDER_OVERRIDE=1 pnpm build` in apps/web):
 *   node --experimental-strip-types tools/perf/baseline.ts [--runs 3] [--profiles desktop,phone]
 *     [--dist apps/web/dist] [--pages 300] [--only first,large,scroll,memory,ink,work]
 *     [--cpu-profile] [--trace] [--out <dir>] [--write-pdf <file>]
 * Wrap it in tools/dev/heavy.sh on a shared machine. Headless Chromium renders on the CPU
 * (SwiftShader): frame and glass numbers are a trend between builds on one machine.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync, deflateSync } from 'node:zlib';

import {
  type Browser,
  type BrowserContext,
  type CDPSession,
  chromium,
  type Page,
} from '@playwright/test';

import { chromiumLaunchOptions } from '../../tooling/playwright-chromium.ts';

// ---------------------------------------------------------------------------------------------
// Options

const argv = process.argv.slice(2);
const arg = (name: string, fallback: string): string => {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] && !argv[at + 1]?.startsWith('--')
    ? (argv[at + 1] as string)
    : fallback;
};
const flag = (name: string): boolean => argv.includes(`--${name}`);

const ROOT = resolve(import.meta.dirname, '../..');
const DIST = resolve(ROOT, arg('dist', 'apps/web/dist'));
const RUNS = Number(arg('runs', '3'));
const PROFILES = arg('profiles', 'desktop,phone').split(',');
const PAGES = Number(arg('pages', '300'));
const ONLY = new Set(arg('only', 'first,large,scroll,memory,ink,work').split(','));
const OUT = resolve(arg('out', join(tmpdir(), 'recto-perf')));
const CPU_PROFILE = flag('cpu-profile');
/** Records a Chromium trace of each scroll and sums main-thread self time by event name. */
const TRACE = flag('trace');
/** Adds Chromium memory-infra dumps (allocator sizes per process) to the memory section. */
const MEMORY_DUMP = flag('memory-dump');

/** `src/state/appearance-store.ts`, kept in step by hand (this script imports no app code). */
const APPEARANCE_KEY = 'pdf-editor:appearance:v1';
/** `src/annotations/pen/ink-stats.ts`. */
const INK_STATS_KEY = 'pdf-editor:dev:ink-stats';

interface Profile {
  readonly name: string;
  readonly viewport: { width: number; height: number };
  readonly dpr: number;
  readonly touch: boolean;
  readonly cpu: number;
  /** Link speed in bytes per ms and latency per request, or null for no throttle. */
  readonly net: { bytesPerMs: number; latencyMs: number } | null;
}

const PROFILE: Record<string, Profile> = {
  // The owner's class of machine: a 1440×900 window at DPR 2, no throttle.
  desktop: {
    name: 'desktop',
    viewport: { width: 1440, height: 900 },
    dpr: 2,
    touch: false,
    cpu: 1,
    net: null,
  },
  // A mid phone: Pixel 7 size, 4× CPU, Lighthouse's slow 4G (1.6 Mbps, 150 ms per request).
  phone: {
    name: 'phone',
    viewport: { width: 390, height: 844 },
    dpr: 3,
    touch: true,
    cpu: 4,
    net: { bytesPerMs: 1_600_000 / 8 / 1000, latencyMs: 150 },
  },
};

// ---------------------------------------------------------------------------------------------
// Static server with gzip, a shared throttled link and byte accounting

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.map': 'application/json',
  '.traineddata': 'application/octet-stream',
};
const COMPRESSIBLE = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.webmanifest',
  '.wasm',
  '.svg',
  '.ttf',
  '.txt',
  '.map',
]);

interface Hit {
  readonly path: string;
  readonly bytes: number;
  readonly sw: boolean;
  readonly at: number;
}

class Server {
  hits: Hit[] = [];
  lastActivity = Date.now();
  private open = 0;
  private nextFree = 0;
  private gz = new Map<string, Buffer>();
  private server = createServer((req, res) => void this.handle(req, res));
  net: Profile['net'] = null;
  port = 0;

  async start(): Promise<void> {
    await new Promise<void>((done) => this.server.listen(0, '127.0.0.1', done));
    this.port = (this.server.address() as AddressInfo).port;
  }

  stop(): Promise<void> {
    this.server.closeAllConnections();
    return new Promise((done) => this.server.close(() => done()));
  }

  reset(): void {
    this.hits = [];
    this.lastActivity = Date.now();
  }

  /** Resolves once nothing was in flight for `quietMs` (or after `maxMs`). */
  async quiet(quietMs: number, maxMs: number): Promise<number> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (this.open === 0 && Date.now() - this.lastActivity >= quietMs) break;
      await sleep(100);
    }
    return this.lastActivity;
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.open++;
    this.lastActivity = Date.now();
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      let file = join(DIST, path);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
      if (!existsSync(file)) {
        if (extname(path) === '') file = join(DIST, 'index.html');
        else {
          res.writeHead(404).end();
          return;
        }
      }
      path = file.slice(DIST.length + 1);
      const ext = extname(file);
      let body: Buffer = readFileSync(file);
      const headers: Record<string, string> = {
        'content-type': TYPES[ext] ?? 'application/octet-stream',
        'cache-control': 'max-age=600',
      };
      if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(String(req.headers['accept-encoding']))) {
        let zipped = this.gz.get(file);
        if (!zipped) {
          zipped = gzipSync(body);
          this.gz.set(file, zipped);
        }
        body = zipped;
        headers['content-encoding'] = 'gzip';
      }
      headers['content-length'] = String(body.length);
      if (this.net) await sleep(this.net.latencyMs);
      res.writeHead(200, headers);
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const chunk = 16 * 1024;
      for (let at = 0; at < body.length; at += chunk) {
        const part = body.subarray(at, at + chunk);
        if (this.net) {
          const now = Date.now();
          const begin = Math.max(now, this.nextFree);
          this.nextFree = begin + part.length / this.net.bytesPerMs;
          const wait = this.nextFree - now;
          if (wait > 1) await sleep(wait);
        }
        res.write(part);
        this.lastActivity = Date.now();
      }
      res.end();
      const referer = req.headers.referer ?? '';
      this.hits.push({ path, bytes: body.length, sw: referer.includes('/sw.js'), at: Date.now() });
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    } finally {
      this.open--;
      this.lastActivity = Date.now();
    }
  }
}

interface Bytes {
  totalKB: number;
  jsKB: number;
  wasmKB: number;
  swKB: number;
  swJsKB: number;
  requests: number;
}

function bytesOf(hits: readonly Hit[], until = Number.POSITIVE_INFINITY): Bytes {
  const kb = (n: number) => Math.round(n / 1024);
  const sum = (f: (h: Hit) => boolean) =>
    hits.filter((h) => h.at <= until && f(h)).reduce((s, h) => s + h.bytes, 0);
  return {
    totalKB: kb(sum(() => true)),
    jsKB: kb(sum((h) => /\.m?js$/.test(h.path))),
    wasmKB: kb(sum((h) => h.path.endsWith('.wasm'))),
    swKB: kb(sum((h) => h.sw)),
    swJsKB: kb(sum((h) => h.sw && /\.m?js$/.test(h.path))),
    requests: hits.filter((h) => h.at <= until).length,
  };
}

/** The precache list in `sw.js`: entries, raw and gzip KiB. */
function precache(): { entries: number; rawKB: number; gzipKB: number } {
  const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
  const urls = [...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map((m) => m[1] as string);
  let raw = 0;
  let gz = 0;
  for (const url of urls) {
    const file = join(DIST, url);
    if (!existsSync(file)) continue;
    const data = readFileSync(file);
    raw += data.length;
    gz += COMPRESSIBLE.has(extname(file)) ? gzipSync(data).length : data.length;
  }
  return { entries: urls.length, rawKB: Math.round(raw / 1024), gzipKB: Math.round(gz / 1024) };
}

// ---------------------------------------------------------------------------------------------
// A large mixed PDF: text, image and vector pages (no dependency: a small PDF writer)

function largePdf(pages: number, seedBase = 1): Buffer {
  const objects: (string | Buffer)[] = [];
  const add = (body: string | Buffer) => objects.push(body);
  const stream = (dict: string, data: Buffer) =>
    Buffer.concat([
      Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'),
      data,
      Buffer.from('\nendstream', 'latin1'),
    ]);
  const catalog = add('');
  const tree = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>');
  // Twelve distinct photograph-like images, 1000 × 700, Flate RGB with mild noise.
  const images: number[] = [];
  const [w, h] = [1000, 700];
  for (let k = 0; k < 12; k++) {
    const px = Buffer.alloc(w * h * 3);
    let seed = 7 + k * 31 + seedBase;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const n = (seed >> 16) % 12;
        const i = (y * w + x) * 3;
        px[i] = Math.min(255, Math.round((x / w) * (120 + k * 10)) + n);
        px[i + 1] = Math.min(255, Math.round((y / h) * 180) + n);
        px[i + 2] = Math.min(255, 120 + Math.round(Math.sin(x / (30 + k) + y / 50) * 80) + n);
      }
    }
    images.push(
      add(
        stream(
          `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`,
          deflateSync(px),
        ),
      ),
    );
  }
  const xobjects = images.map((id, k) => `/Im${k} ${id} 0 R`).join(' ');
  const kids: number[] = [];
  for (let p = 0; p < pages; p++) {
    let c = '';
    const kind = p % 4;
    if (kind === 0 || kind === 2) {
      c += `BT /F2 18 Tf 56 760 Td (Chapter ${p + 1}) Tj ET\nBT /F1 10 Tf 13 TL 56 730 Td\n`;
      for (let line = 0; line < 52; line++) {
        c += `(${p + 1}.${line + 1} The quick brown fox jumps over the lazy dog; pack my box with five dozen jugs.) Tj T*\n`;
      }
      c += 'ET\n';
    } else if (kind === 1) {
      const k = Math.floor(p / 4) % images.length;
      c += `q 500 0 0 350 56 400 cm /Im${k} Do Q\n`;
      c += `BT /F1 11 Tf 56 370 Td (Figure ${p + 1}: an image page) Tj ET\n`;
      c += `q 250 0 0 175 56 150 cm /Im${(k + 5) % images.length} Do Q\n`;
    } else {
      // A chart-like vector page: 1,500 small filled rectangles and a polyline.
      let seed = p * 17 + seedBase;
      for (let i = 0; i < 1500; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const x = 56 + (i % 50) * 10;
        const y = 100 + Math.floor(i / 50) * 20;
        c += `${(seed % 100) / 100} 0.4 ${((seed >> 8) % 100) / 100} rg ${x} ${y} 8 ${4 + (seed % 14)} re f\n`;
      }
      c += '0 0 0 RG 1 w 56 720 m ';
      for (let i = 0; i < 200; i++) c += `${56 + i * 2.5} ${700 + Math.sin(i / 9) * 40} l `;
      c += 'S\n';
    }
    const contents = add(stream('', Buffer.from(c, 'latin1')));
    kids.push(
      add(
        `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 612 792] /Contents ${contents} 0 R ` +
          `/Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> /XObject << ${xobjects} >> >> >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${tree} 0 R >>`;
  objects[tree - 1] =
    `<< /Type /Pages /Count ${pages} /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] >>`;
  const parts: Buffer[] = [Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  const offsets: number[] = [];
  let length = parts[0]?.length ?? 0;
  objects.forEach((body, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`, 'latin1'),
      typeof body === 'string' ? Buffer.from(body, 'latin1') : body,
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
    parts.push(chunk);
    length += chunk.length;
  });
  parts.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
        offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
        `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${length}\n%%EOF\n`,
      'latin1',
    ),
  );
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------------------------
// In-page instrumentation

/** Runs before every document: long tasks, long animation frames and slow events. */
function instrument(): void {
  interface Perf {
    lt: { s: number; d: number }[];
    loaf: {
      s: number;
      d: number;
      b: number;
      r: number;
      l: number;
      scripts: { src: string; fn: string; pos: number; d: number; inv: string }[];
    }[];
    ev: { name: string; s: number; d: number; delay: number }[];
  }
  const perf: Perf = { lt: [], loaf: [], ev: [] };
  (window as unknown as { __perf: Perf }).__perf = perf;
  const watch = (type: string, take: (e: PerformanceEntry) => void, extra = {}) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(take)).observe({
        type,
        buffered: true,
        ...extra,
      });
    } catch {
      // Unsupported entry type in this engine.
    }
  };
  watch('longtask', (e) => perf.lt.push({ s: e.startTime, d: e.duration }));
  watch('long-animation-frame', (e) => {
    const f = e as PerformanceEntry & {
      blockingDuration: number;
      renderStart: number;
      styleAndLayoutStart: number;
      scripts: {
        sourceURL: string;
        sourceFunctionName: string;
        sourceCharPosition: number;
        duration: number;
        invoker: string;
      }[];
    };
    perf.loaf.push({
      s: f.startTime,
      d: f.duration,
      b: f.blockingDuration,
      // Rendering: rAF and observers before style/layout, then style, layout and paint.
      r: f.renderStart > 0 ? f.styleAndLayoutStart - f.renderStart : 0,
      l: f.styleAndLayoutStart > 0 ? f.startTime + f.duration - f.styleAndLayoutStart : 0,
      scripts: f.scripts.map((s) => ({
        src: s.sourceURL,
        fn: s.sourceFunctionName,
        pos: s.sourceCharPosition,
        d: s.duration,
        inv: s.invoker,
      })),
    });
  });
  watch(
    'event',
    (e) => {
      const t = e as PerformanceEntry & { processingStart: number };
      perf.ev.push({
        name: e.name,
        s: e.startTime,
        d: e.duration,
        delay: t.processingStart - e.startTime,
      });
    },
    { durationThreshold: 16 },
  );
}

interface LongTasks {
  count: number;
  totalMs: number;
  maxMs: number;
  /** Total blocking time: the sum of each task's time over 50 ms. */
  tbtMs: number;
}

async function longTasks(page: Page, from: number, to: number): Promise<LongTasks> {
  const lt = await page.evaluate(
    ([a, b]) =>
      (window as unknown as { __perf: { lt: { s: number; d: number }[] } }).__perf.lt.filter(
        (t) => t.s >= (a as number) && t.s <= (b as number),
      ),
    [from, to],
  );
  return {
    count: lt.length,
    totalMs: Math.round(lt.reduce((s, t) => s + t.d, 0)),
    maxMs: Math.round(Math.max(0, ...lt.map((t) => t.d))),
    tbtMs: Math.round(lt.reduce((s, t) => s + Math.max(0, t.d - 50), 0)),
  };
}

/** The scripts long animation frames name between `from` and `to`, summed by source. */
interface Blame {
  src: string;
  fn: string;
  pos: number;
  ms: number;
}

const blames: Record<string, Blame[]> = {};

/** Long-animation-frame totals per label: where the frame time went. */
const frameSplits: Record<
  string,
  { frames: number; ms: number; scriptMs: number; renderMs: number; layoutMs: number }
> = {};

async function blame(page: Page, label: string, from: number, to: number): Promise<void> {
  const frames = await page.evaluate(
    ([a, b]) =>
      (
        window as unknown as {
          __perf: {
            loaf: {
              s: number;
              d: number;
              r: number;
              l: number;
              scripts: { src: string; fn: string; pos: number; d: number; inv: string }[];
            }[];
          };
        }
      ).__perf.loaf.filter((f) => f.s >= (a as number) && f.s <= (b as number)),
    [from, to],
  );
  const split = (frameSplits[label] ??= {
    frames: 0,
    ms: 0,
    scriptMs: 0,
    renderMs: 0,
    layoutMs: 0,
  });
  const list = (blames[label] ??= []);
  for (const f of frames) {
    split.frames++;
    split.ms += f.d;
    split.renderMs += f.r;
    split.layoutMs += f.l;
    for (const s of f.scripts) {
      split.scriptMs += s.d;
      const src = s.src.replace(/^https?:\/\/[^/]+\//, '');
      const fn = s.fn || s.inv;
      const found = list.find((x) => x.src === src && x.fn === fn && x.pos === s.pos);
      if (found) found.ms += s.d;
      else list.push({ src, fn, pos: s.pos, ms: s.d });
    }
  }
}

const now = (page: Page) => page.evaluate(() => performance.now());

/** Resolves to `performance.now()` in the page once `predicate` holds (polled each frame). */
async function until(page: Page, predicate: string, timeout = 120_000): Promise<number> {
  const handle = await page.waitForFunction(
    `(() => { try { return (${predicate}) ? performance.now() : 0; } catch { return 0; } })()`,
    undefined,
    { polling: 'raf', timeout },
  );
  return (await handle.jsonValue()) as number;
}

const HOME = `[...document.querySelectorAll('button')].some((b) => /Try the sample/.test(b.textContent ?? ''))`;
const FIRST_PAGE = `document.querySelector('[data-read-viewport] canvas[data-state="rendered"]')`;
const THUMBS = `(() => { const c = [...document.querySelectorAll('[data-thumb] canvas')]; return c.length > 0 && c.every((x) => x.dataset.state === 'rendered'); })()`;
const GRID = `(() => { const g = document.querySelector('[data-testid="light-table"]'); if (!g) return false; const r = g.getBoundingClientRect(); const c = [...g.querySelectorAll('canvas[data-state]')].filter((x) => { const b = x.getBoundingClientRect(); return b.bottom > r.top && b.top < r.bottom; }); return c.length > 0 && c.every((x) => x.dataset.state === 'rendered'); })()`;
const VISIBLE_SHARP = `(() => { const vp = document.querySelector('[data-read-viewport]'); if (!vp) return false; const r = vp.getBoundingClientRect(); const c = [...vp.querySelectorAll('canvas[data-state]')].filter((x) => { const b = x.getBoundingClientRect(); return b.width > 0 && b.bottom > r.top && b.top < r.bottom && b.right > r.left && b.left < r.right; }); return c.length > 0 && c.every((x) => x.dataset.state === 'rendered'); })()`;

/** TTI-lite: from `visible`, the first moment followed by 1 s without a long task. */
async function interactiveAt(page: Page, visible: number): Promise<number> {
  await sleep(3000);
  const lt = await page.evaluate(() =>
    (window as unknown as { __perf: { lt: { s: number; d: number }[] } }).__perf.lt
      .slice()
      .sort((a, b) => a.s - b.s),
  );
  let t = visible;
  for (const task of lt) {
    if (task.s + task.d <= t) continue;
    if (task.s < t + 1000) t = task.s + task.d;
    else break;
  }
  return t;
}

async function paints(page: Page): Promise<{ fp: number; fcp: number; lcp: number }> {
  return page.evaluate(
    () =>
      new Promise<{ fp: number; fcp: number; lcp: number }>((done) => {
        // Paint entries arrive after presentation, which can trail the DOM by a frame or two.
        let lcp = 0;
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) lcp = Math.max(lcp, e.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {
          // No LCP in this engine.
        }
        const began = performance.now();
        const poll = () => {
          const at = (name: string) =>
            performance.getEntriesByType('paint').find((e) => e.name === name)?.startTime ?? 0;
          const fcp = at('first-contentful-paint');
          if (fcp > 0 || performance.now() - began > 5000) {
            done({ fp: Math.round(at('first-paint')), fcp: Math.round(fcp), lcp: Math.round(lcp) });
          } else setTimeout(poll, 50);
        };
        poll();
      }),
  );
}

// ---------------------------------------------------------------------------------------------
// Contexts

async function context(
  browser: Browser,
  profile: Profile,
  init: { glass?: string; gpu?: boolean; inkStats?: boolean } = {},
): Promise<{ ctx: BrowserContext; page: Page; cdp: CDPSession }> {
  const ctx = await browser.newContext({
    viewport: profile.viewport,
    screen: profile.viewport,
    deviceScaleFactor: profile.dpr,
    hasTouch: profile.touch,
    isMobile: profile.touch,
    acceptDownloads: true,
    // The app's CSP forbids string evaluation, which waitForFunction's predicates need.
    bypassCSP: true,
    baseURL: `http://127.0.0.1:${server.port}/`,
  });
  await ctx.addInitScript(instrument);
  await ctx.addInitScript(
    ([glass, gpu, ink, appearance, inkKey]) => {
      Object.defineProperty(window, 'showOpenFilePicker', { value: undefined, configurable: true });
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
      if (glass) localStorage.setItem(appearance as string, JSON.stringify({ glass }));
      if (gpu) (window as { __rectoGpuGlass?: string }).__rectoGpuGlass = 'force';
      if (ink) localStorage.setItem(inkKey as string, '1');
    },
    [init.glass ?? '', init.gpu ?? false, init.inkStats ?? false, APPEARANCE_KEY, INK_STATS_KEY],
  );
  const page = await ctx.newPage();
  const cdp = await throttle(page, profile);
  return { ctx, page, cdp };
}

async function throttle(page: Page, profile: Profile): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
  return cdp;
}

/** Opens `buffer` through the Open button; resolves to the change event's page time. */
async function openFile(
  page: Page,
  profile: Profile,
  name: string,
  buffer: Buffer,
): Promise<number> {
  await page.evaluate(() => {
    document.addEventListener(
      'change',
      (e) => {
        if (e.target instanceof HTMLInputElement && e.target.type === 'file') {
          (window as unknown as { __openStart: number }).__openStart = performance.now();
        }
      },
      { capture: true, once: true },
    );
  });
  const chooser = page.waitForEvent('filechooser');
  const label = profile.touch ? /^(Open PDF|PDF aç)$/ : /^(Open files|Dosya aç)$/;
  await page.getByRole('button', { name: label }).first().click();
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer });
  return page.evaluate(
    () =>
      new Promise<number>((done) => {
        const poll = () => {
          const t = (window as unknown as { __openStart?: number }).__openStart;
          if (t !== undefined) done(t);
          else setTimeout(poll, 5);
        };
        poll();
      }),
  );
}

/** Waits until the visible pages are sharp and nothing changed for `ms`. */
async function settle(page: Page, ms = 1000): Promise<void> {
  await until(page, VISIBLE_SHARP, 120_000).catch(() => 0);
  await sleep(ms);
}

// ---------------------------------------------------------------------------------------------
// Sections

type Row = Record<string, number>;

async function firstAndRepeat(browser: Browser, profile: Profile): Promise<Row> {
  const row: Row = {};
  const { ctx, page } = await context(browser, profile);
  server.reset();
  const navAt = Date.now();
  await page.goto('./?lang=en', { waitUntil: 'commit' });
  const home = await until(page, HOME);
  const homeNode = Date.now();
  const p = await paints(page);
  row['first.fpMs'] = p.fp;
  row['first.fcpMs'] = p.fcp;
  row['first.lcpMs'] = p.lcp;
  row['first.homeVisibleMs'] = Math.round(home);
  row['first.homeInteractiveMs'] = Math.round(await interactiveAt(page, home));
  const atHome = bytesOf(server.hits, homeNode);
  row['first.homePageKB'] = atHome.totalKB - atHome.swKB;
  row['first.homePageJsKB'] = atHome.jsKB - atHome.swJsKB;
  row['first.homeSwKB'] = atHome.swKB;
  row['first.homeTbtMs'] = (await longTasks(page, 0, home)).tbtMs;
  row['first.offlineReadyMs'] = Math.round(
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active?.state !== 'activated') {
        await new Promise((done) => reg.active?.addEventListener('statechange', done));
      }
      return performance.now();
    }),
  );
  const quietAt = await server.quiet(4000, profile.net ? 180_000 : 60_000);
  const all = bytesOf(server.hits);
  row['first.quietMs'] = quietAt - navAt;
  row['first.totalKB'] = all.totalKB;
  row['first.jsKB'] = all.jsKB;
  row['first.wasmKB'] = all.wasmKB;
  row['first.swKB'] = all.swKB;
  row['first.requests'] = all.requests;
  await page.close();

  // Repeat visit: same context, the service worker in control.
  const again = await ctx.newPage();
  await throttle(again, profile);
  server.reset();
  await again.goto('./?lang=en', { waitUntil: 'commit' });
  const home2 = await until(again, HOME);
  row['repeat.fcpMs'] = (await paints(again)).fcp;
  row['repeat.homeVisibleMs'] = Math.round(home2);
  row['repeat.homeInteractiveMs'] = Math.round(await interactiveAt(again, home2));
  row['repeat.KB'] = bytesOf(server.hits).totalKB;

  // The sample, warm (everything cached): navigation to its first page, then thumbnails.
  server.reset();
  await again.goto('./?sample&lang=en', { waitUntil: 'commit' });
  row['sample.firstPageMs'] = Math.round(await until(again, FIRST_PAGE));
  if (!profile.touch) {
    await again.getByTestId('sidebar-toggle').click();
    row['sample.thumbsMs'] = Math.round(await until(again, THUMBS));
  }
  await settle(again);
  row['sample.KB'] = bytesOf(server.hits).totalKB;
  await ctx.close();
  return row;
}

interface FrameStats {
  p50: number;
  p95: number;
  max: number;
  dropped: number;
  frames: number;
  blankPct: number;
}

async function scrollRun(page: Page, frames = 300, step = 40): Promise<FrameStats> {
  return page.evaluate(
    async ({ frames, step }) => {
      const vp = document.querySelector<HTMLElement>('[data-read-viewport]');
      if (!vp) throw new Error('no viewport');
      const times: number[] = [];
      let checks = 0;
      let blank = 0;
      await new Promise<void>((done) => {
        let n = 0;
        const tick = (t: number) => {
          times.push(t);
          if (n % 6 === 0) {
            const r = vp.getBoundingClientRect();
            const pages = [...vp.querySelectorAll('[data-page-index]')].filter((el) => {
              const b = el.getBoundingClientRect();
              return b.height > 0 && b.bottom > r.top && b.top < r.bottom;
            });
            checks++;
            if (
              pages.some(
                (el) =>
                  !el.querySelector('canvas[data-state="rendered"], canvas[data-state="preview"]'),
              )
            )
              blank++;
          }
          if (n++ >= frames) {
            done();
            return;
          }
          vp.scrollTop += step;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      const iv = times.slice(1).map((t, i) => t - (times[i] ?? t));
      const sorted = [...iv].sort((a, b) => a - b);
      const at = (q: number) =>
        sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
      const r = (v: number) => Math.round(v * 10) / 10;
      return {
        p50: r(at(0.5)),
        p95: r(at(0.95)),
        max: r(sorted.at(-1) ?? 0),
        dropped: iv.reduce((s, v) => s + Math.max(0, Math.round(v / (1000 / 60)) - 1), 0),
        frames: iv.length,
        blankPct: Math.round((blank / Math.max(1, checks)) * 100),
      };
    },
    { frames, step },
  );
}

async function large(browser: Browser, profile: Profile, pdf: Buffer): Promise<Row> {
  const row: Row = {};
  const variants = profile.touch
    ? [
        { key: 'gpu', glass: 'clear', gpu: true },
        { key: 'css', glass: 'clear', gpu: false },
      ]
    : [
        { key: 'clear', glass: 'clear', gpu: false },
        { key: 'solid', glass: 'solid', gpu: false },
      ];
  for (const [i, v] of variants.entries()) {
    const { ctx, page, cdp } = await context(browser, profile, {
      glass: v.glass,
      gpu: v.gpu,
      inkStats: !profile.touch && i === 0,
    });
    await page.goto('./?lang=en');
    await until(page, HOME);
    await sleep(1500);
    if (TRACE && i === 0) {
      await browser.startTracing(page, {
        categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'blink'],
      });
    }
    const start = await openFile(page, profile, `large-${PAGES}.pdf`, pdf);
    const first = await until(page, FIRST_PAGE);
    if (i === 0) {
      row['large.firstPageMs'] = Math.round(first - start);
      if (!profile.touch) {
        await page.getByTestId('sidebar-toggle').click();
        row['large.thumbsMs'] = Math.round((await until(page, THUMBS)) - start);
      }
      await settle(page);
      const end = await now(page);
      const lt = await longTasks(page, start, end);
      row['large.openLongTasks'] = lt.count;
      row['large.openTbtMs'] = lt.tbtMs;
      row['large.openMaxTaskMs'] = lt.maxMs;
      await blame(page, `open (${profile.name})`, start, end);
      if (TRACE) traces[`open ${profile.name}`] = mainThreadSelf(await browser.stopTracing());
      if (!profile.touch) {
        // Closed again, so both glass variants scroll the same view.
        await page.getByTestId('sidebar-toggle').click();
        await settle(page);
      }
    } else await settle(page);
    if (ONLY.has('scroll')) {
      const t0 = await now(page);
      if (TRACE) {
        await browser.startTracing(page, {
          categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'blink'],
        });
      }
      const s = await scrollRun(page);
      if (TRACE)
        traces[`scroll ${profile.name} ${v.key}`] = mainThreadSelf(await browser.stopTracing());
      const t1 = await now(page);
      const lt = await longTasks(page, t0, t1);
      await blame(page, `scroll (${profile.name})`, t0, t1);
      row[`scroll.${v.key}.p50Ms`] = s.p50;
      row[`scroll.${v.key}.p95Ms`] = s.p95;
      row[`scroll.${v.key}.maxMs`] = s.max;
      row[`scroll.${v.key}.droppedPct`] = Math.round((s.dropped / (s.frames + s.dropped)) * 100);
      row[`scroll.${v.key}.blankPct`] = s.blankPct;
      const px = await page.evaluate(() => {
        const all = [...document.querySelectorAll('canvas')];
        return {
          count: all.length,
          mpx: all.reduce((sum, c) => sum + c.width * c.height, 0) / 1e6,
        };
      });
      row[`scroll.${v.key}.canvases`] = px.count;
      row[`scroll.${v.key}.canvasMpx`] = Math.round(px.mpx);
      row[`scroll.${v.key}.longTasks`] = lt.count;
      row[`scroll.${v.key}.tbtMs`] = lt.tbtMs;
      if (v.gpu) {
        const g = await page.evaluate(
          () => (window as { __gpuGlass?: { state: string } }).__gpuGlass?.state ?? 'none',
        );
        row[`scroll.${v.key}.gpuOn`] = g === 'on' || g === 'paused' ? 1 : 0;
      }
    }
    if (i === 0 && !profile.touch && ONLY.has('work')) Object.assign(row, await work(page, cdp));
    await ctx.close();
  }
  return row;
}

/** Desktop work on the open large document: zoom, grid, typing, ink, save, export. */
async function work(page: Page, _cdp: CDPSession): Promise<Row> {
  const row: Row = {};
  await page.evaluate(() => {
    const vp = document.querySelector<HTMLElement>('[data-read-viewport]');
    if (vp) vp.scrollTop = 0;
  });
  await settle(page);
  // Zoom: keydown to every visible canvas sharp at the new scale, three steps in.
  const zooms: number[] = [];
  for (let step = 0; step < 3; step++) {
    await page.locator('[data-read-viewport]').focus();
    await page.evaluate(() => {
      const w = window as unknown as { __zoomAt?: number; __zoomChanges?: number };
      w.__zoomChanges = 0;
      document.addEventListener('keydown', () => (w.__zoomAt = performance.now()), {
        capture: true,
        once: true,
      });
      new MutationObserver((list, obs) => {
        w.__zoomChanges = (w.__zoomChanges ?? 0) + list.length;
        setTimeout(() => obs.disconnect(), 10_000);
      }).observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-state'],
      });
    });
    await page.keyboard.press('Control+=');
    const done = await until(page, `window.__zoomChanges > 0 && ${VISIBLE_SHARP}`, 30_000);
    zooms.push(
      done - (await page.evaluate(() => (window as unknown as { __zoomAt: number }).__zoomAt)),
    );
    await sleep(800);
  }
  row['zoom.sharpMs'] = Math.round(median(zooms));
  row['zoom.sharpMaxMs'] = Math.round(Math.max(...zooms));
  await page.locator('[data-read-viewport]').focus();
  for (let step = 0; step < 3; step++) await page.keyboard.press('Control+-');
  await settle(page);

  // Ink on page 1 (the stats collector is on in this context).
  if (ONLY.has('ink')) {
    await page.locator('body').press('p');
    const layer = page.locator('[data-annotation-layer="0"]');
    const tool = await layer.getAttribute('data-tool', { timeout: 5000 }).catch(() => null);
    const stats = await page.evaluate(() =>
      Boolean((window as { __inkStats?: unknown }).__inkStats),
    );
    const box = await layer.boundingBox();
    if (tool !== 'ink' || !stats)
      console.log(`[perf] ink not armed (tool ${tool}, stats ${stats})`);
    if (box) {
      await page.evaluate(() =>
        (window as unknown as { __inkStats?: { reset(): void } }).__inkStats?.reset(),
      );
      const cdp = await page.context().newCDPSession(page);
      for (let s = 0; s < 3; s++) {
        const pts = Array.from({ length: 120 }, (_, i) => ({
          // Clear of the sidebar, which floats over the page's left edge.
          x: Math.max(box.x + 80, 560) + i * 3,
          y: box.y + 200 + s * 60 + Math.sin(i / 6) * 14,
        }));
        for (const [i, pt] of pts.entries()) {
          const type =
            i === 0 ? 'mousePressed' : i === pts.length - 1 ? 'mouseReleased' : 'mouseMoved';
          await cdp.send('Input.dispatchMouseEvent', {
            type,
            x: pt.x,
            y: pt.y,
            button: 'left',
            buttons: type === 'mouseReleased' ? 0 : 1,
            ...(type === 'mouseMoved' ? {} : { clickCount: 1 }),
            pointerType: 'mouse',
            timestamp: (performance.timeOrigin + performance.now()) / 1000,
          } as never);
          await sleep(8);
        }
        await sleep(300);
      }
      await sleep(2000);
      const ink = await page.evaluate(() =>
        (
          window as unknown as {
            __inkStats?: {
              summary(): {
                strokes: number;
                eventToDrawMs: { p50: number; p95: number };
                commitVisibleMs: { p50: number };
                bitmapSettledMs: { p50: number };
              };
            };
          }
        ).__inkStats?.summary(),
      );
      if (ink) {
        row['ink.strokes'] = ink.strokes;
        row['ink.eventToDrawP50Ms'] = round1(ink.eventToDrawMs.p50);
        row['ink.eventToDrawP95Ms'] = round1(ink.eventToDrawMs.p95);
        row['ink.commitVisibleMs'] = round1(ink.commitVisibleMs.p50);
        row['ink.bitmapSettledMs'] = round1(ink.bitmapSettledMs.p50);
      }
      await page.keyboard.press('Escape');
      await page.keyboard.press('v');
    }
  }

  // Typing in Find over the whole document: Event Timing durations of the keys.
  {
    const t0 = await now(page);
    await page.keyboard.press('Control+f');
    await page.keyboard.type('jumps over', { delay: 120 });
    await sleep(1500);
    const t1 = await now(page);
    const ev = await page.evaluate(
      ([a, b]) =>
        (
          window as unknown as { __perf: { ev: { name: string; s: number; d: number }[] } }
        ).__perf.ev.filter(
          (e) => e.s >= (a as number) && e.s <= (b as number) && /key|input/.test(e.name),
        ),
      [t0, t1],
    );
    const d = ev.map((e) => e.d);
    row['type.slowKeys'] = d.length;
    row['type.maxMs'] = Math.round(Math.max(0, ...d));
    row['type.tbtMs'] = (await longTasks(page, t0, t1)).tbtMs;
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
  }

  // The Pages grid: '3', then every tile in view rendered.
  {
    await page.locator('[data-read-viewport]').focus();
    const t0 = await now(page);
    await page.keyboard.press('3');
    row['grid.tilesMs'] = Math.round((await until(page, GRID, 60_000)) - t0);
    await page.keyboard.press('1');
    await settle(page);
  }

  // Save a copy (PDF), then Export pages as images (pages 1–10).
  {
    const t0 = await now(page);
    await page.getByTestId('document-menu').click();
    await page.getByRole('menuitem', { name: 'Save a copy…' }).click();
    const sheet = page.getByTestId('save-copy-sheet');
    const dl = page.waitForEvent('download', { timeout: 180_000 });
    const started = Date.now();
    await sheet.getByRole('button', { name: 'Download copy' }).click();
    await dl;
    row['save.copyMs'] = Date.now() - started;
    await sleep(500);
    const t1 = await now(page);
    const lt = await longTasks(page, t0, t1);
    row['save.longTasks'] = lt.count;
    row['save.tbtMs'] = lt.tbtMs;
    row['save.maxTaskMs'] = lt.maxMs;
    await blame(page, 'save (desktop)', t0, t1);
    await page.keyboard.press('Escape');
  }
  {
    await sleep(1000);
    const t0 = await now(page);
    await page.getByTestId('document-menu').click();
    await page.getByRole('menuitem', { name: 'Export pages as images…' }).click();
    const sheet = page.getByTestId('save-copy-sheet');
    await sheet.getByRole('textbox', { name: 'Pages' }).fill('1-10');
    const dl = page.waitForEvent('download', { timeout: 180_000 });
    const started = Date.now();
    await sheet.getByRole('button', { name: 'Download copy' }).click();
    await dl;
    row['export.imagesMs'] = Date.now() - started;
    await sleep(500);
    const t1 = await now(page);
    const lt = await longTasks(page, t0, t1);
    row['export.longTasks'] = lt.count;
    row['export.tbtMs'] = lt.tbtMs;
    row['export.maxTaskMs'] = lt.maxMs;
    await blame(page, 'export (desktop)', t0, t1);
  }
  return row;
}

/** PSS of this process's descendants (the browser tree), MiB, in all and by Chromium process type. Linux only. */
function treePssMB(): Record<string, number> {
  if (!existsSync('/proc/self/smaps_rollup')) return { all: 0 };
  const parent = new Map<number, number>();
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      parent.set(Number(name), ppid);
    } catch {
      // Gone.
    }
  }
  const mine = (pid: number): boolean => {
    for (let p = parent.get(pid); p !== undefined && p > 1; p = parent.get(p)) {
      if (p === process.pid) return true;
    }
    return false;
  };
  const kb: Record<string, number> = { all: 0 };
  for (const pid of parent.keys()) {
    if (!mine(pid)) continue;
    try {
      const m = /^Pss:\s+(\d+)/m.exec(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8'));
      const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      const type =
        /--type=([a-z-]+)/.exec(cmd)?.[1] ?? (cmd.includes('chrom') ? 'browser' : 'other');
      const value = Number(m?.[1] ?? 0);
      kb.all = (kb.all ?? 0) + value;
      kb[type] = (kb[type] ?? 0) + value;
    } catch {
      // Gone or not readable.
    }
  }
  return Object.fromEntries(Object.entries(kb).map(([k, v]) => [k, Math.round(v / 1024)]));
}

/** Allocator breakdowns from one memory-infra dump, MiB by process name ("Renderer: malloc"). */
const allocators: Record<string, Record<string, number>> = {};

async function memoryDump(browser: Browser, label: string): Promise<void> {
  const cdp = await browser.newBrowserCDPSession();
  const done = new Promise<string>((resolve) =>
    cdp.once('Tracing.tracingComplete', (e: { stream?: string }) => resolve(e.stream ?? '')),
  );
  await cdp.send('Tracing.start', {
    traceConfig: {
      includedCategories: ['disabled-by-default-memory-infra'],
      memoryDumpConfig: { triggers: [] },
    },
    transferMode: 'ReturnAsStream',
  } as never);
  await cdp.send('Tracing.requestMemoryDump', {
    deterministic: true,
    levelOfDetail: 'detailed',
  } as never);
  await cdp.send('Tracing.end');
  const stream = await done;
  let text = '';
  for (;;) {
    const chunk = await cdp.send('IO.read', { handle: stream });
    text += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data;
    if (chunk.eof) break;
  }
  await cdp.send('IO.close', { handle: stream });
  await cdp.detach();
  const parsed = JSON.parse(text) as
    | { traceEvents: { ph: string; pid: number; name: string; args?: Record<string, unknown> }[] }
    | { ph: string; pid: number; name: string; args?: Record<string, unknown> }[];
  const events = Array.isArray(parsed) ? parsed : parsed.traceEvents;
  const names = new Map<number, string>();
  for (const e of events) {
    if (e.ph === 'M' && e.name === 'process_name')
      names.set(e.pid, String((e.args as { name?: string }).name));
  }
  const out: Record<string, number> = {};
  for (const e of events) {
    if (e.ph !== 'v') continue;
    const dumps = (
      e.args as {
        dumps?: { allocators?: Record<string, { attrs?: { size?: { value: string } } }> };
      }
    ).dumps;
    for (const [name, node] of Object.entries(dumps?.allocators ?? {})) {
      if (name.includes('/') || !node.attrs?.size) continue;
      const mb = Number.parseInt(node.attrs.size.value, 16) / 1048576;
      if (mb < 5) continue;
      const key = `${names.get(e.pid) ?? e.pid}: ${name}`;
      out[key] = Math.round((out[key] ?? 0) + mb);
    }
  }
  allocators[label] = out;
}

/** Live canvases and bitmaps on the main thread's heap (a heap snapshot), by node name. */
async function heapCounts(cdp: CDPSession): Promise<Record<string, number>> {
  const chunks: string[] = [];
  const take = (e: { chunk: string }) => chunks.push(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', take);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', take);
  const snap = JSON.parse(chunks.join('')) as {
    snapshot: { meta: { node_fields: string[] } };
    nodes: number[];
    strings: string[];
  };
  const fields = snap.snapshot.meta.node_fields;
  const nameAt = fields.indexOf('name');
  const counts: Record<string, number> = {};
  for (let i = 0; i < snap.nodes.length; i += fields.length) {
    const name = snap.strings[snap.nodes[i + nameAt] as number] ?? '';
    if (/^(Detached )?(HTMLCanvasElement|ImageBitmap|OffscreenCanvas)$/.test(name)) {
      counts[name] = (counts[name] ?? 0) + 1;
    }
  }
  return counts;
}

async function memory(browser: Browser, profile: Profile, pdfs: Buffer[]): Promise<Row> {
  const row: Row = {};
  const { ctx, page, cdp } = await context(browser, profile);
  await cdp.send('Performance.enable');
  const sample = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await sleep(1500);
    await cdp.send('HeapProfiler.collectGarbage');
    const metrics = (await cdp.send('Performance.getMetrics')).metrics;
    const get = (n: string) => metrics.find((m) => m.name === n)?.value ?? 0;
    const pssBy = treePssMB();
    return {
      pss: pssBy.all ?? 0,
      renderer: pssBy.renderer ?? 0,
      gpu: pssBy['gpu-process'] ?? 0,
      heap: Math.round(get('JSHeapUsedSize') / 1048576),
      nodes: get('Nodes'),
      workers: page.workers().length,
    };
  };
  await page.goto('./?lang=en');
  await until(page, HOME);
  await sleep(3000);
  const base = await sample();
  if (MEMORY_DUMP) await memoryDump(browser, 'home');
  row['mem.baseHeapMB'] = base.heap;
  row['mem.basePssMB'] = base.pss;
  let peak = 0;
  for (const [i, pdf] of pdfs.entries()) {
    const name = `large-${i + 1}`;
    await openFile(page, profile, `${name}.pdf`, pdf);
    await until(page, FIRST_PAGE);
    await settle(page);
    // Walk the document so the caches fill: middle, end, back.
    for (const at of [0.5, 1, 0]) {
      await page.evaluate((f) => {
        const vp = document.querySelector<HTMLElement>('[data-read-viewport]');
        if (vp) vp.scrollTop = (vp.scrollHeight - vp.clientHeight) * f;
      }, at);
      await settle(page, 500);
    }
    const open = await sample();
    if (MEMORY_DUMP && i === 0) {
      await memoryDump(browser, 'one open');
      for (const [name, n] of Object.entries(await heapCounts(cdp))) row[`mem.open.${name}`] = n;
    }
    peak = Math.max(peak, open.pss);
    if (i === 0) {
      row['mem.openHeapMB'] = open.heap;
      row['mem.openPssMB'] = open.pss;
      row['mem.openRendererMB'] = open.renderer;
      row['mem.openGpuMB'] = open.gpu;
    }
    const tab = page.getByRole('tab', { name });
    await tab.hover();
    await tab.locator('[title^="Close"]').click({ force: true });
    await until(page, `!document.querySelector('[data-read-viewport] canvas')`, 30_000).catch(
      () => 0,
    );
    await sleep(2000);
  }
  const after = await sample();
  if (MEMORY_DUMP) {
    await memoryDump(browser, 'after 3 closes');
    for (const [name, n] of Object.entries(await heapCounts(cdp))) row[`mem.after.${name}`] = n;
  }
  row['mem.peakPssMB'] = peak;
  row['mem.afterHeapMB'] = after.heap;
  row['mem.afterPssMB'] = after.pss;
  row['mem.afterRendererMB'] = after.renderer;
  row['mem.afterGpuMB'] = after.gpu;
  row['mem.baseRendererMB'] = base.renderer;
  row['mem.baseGpuMB'] = base.gpu;
  row['mem.afterNodes'] = after.nodes;
  row['mem.afterWorkers'] = after.workers;
  row['mem.leakHeapMB'] = after.heap - base.heap;
  row['mem.leakPssMB'] = after.pss - base.pss;
  // What the workers hold (wasm heaps never shrink while a worker lives): end them and look
  // again. The page is unusable afterwards; this is the last sample.
  for (const worker of page.workers()) {
    await worker.evaluate(() => (self as unknown as { close(): void }).close()).catch(() => 0);
  }
  await sleep(2000);
  const ended = await sample();
  if (MEMORY_DUMP) await memoryDump(browser, 'workers ended');
  row['mem.workersHeldMB'] = after.pss - ended.pss;
  await ctx.close();
  return row;
}

const traces: Record<string, string[]> = {};

/** Self time per event name on the renderer main thread(s) of a trace, top 20. */
function mainThreadSelf(buffer: Buffer): string[] {
  const events = (
    JSON.parse(buffer.toString('utf8')) as {
      traceEvents: {
        name: string;
        ph: string;
        ts: number;
        dur?: number;
        pid: number;
        tid: number;
        args?: { name?: string };
      }[];
    }
  ).traceEvents;
  const mains = new Set(
    events
      .filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
      .map((e) => `${e.pid}:${e.tid}`),
  );
  const self = new Map<string, number>();
  const calls = new Map<string, number>();
  const byThread = new Map<string, typeof events>();
  for (const e of events) {
    const key = `${e.pid}:${e.tid}`;
    if (e.ph !== 'X' || !mains.has(key) || !e.dur) continue;
    let list = byThread.get(key);
    if (!list) byThread.set(key, (list = []));
    list.push(e);
  }
  for (const list of byThread.values()) {
    list.sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
    const stack: { end: number; name: string }[] = [];
    for (const e of list) {
      while (stack.length && (stack.at(-1)?.end ?? 0) <= e.ts) stack.pop();
      const parent = stack.at(-1);
      if (parent) self.set(parent.name, (self.get(parent.name) ?? 0) - (e.dur ?? 0));
      self.set(e.name, (self.get(e.name) ?? 0) + (e.dur ?? 0));
      calls.set(e.name, (calls.get(e.name) ?? 0) + 1);
      stack.push({ end: e.ts + (e.dur ?? 0), name: e.name });
    }
  }
  return [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, us]) => `${Math.round(us / 1000)} ms  ${name} (${calls.get(name)}×)`);
}

// ---------------------------------------------------------------------------------------------
// CPU profile and source maps

interface MapLine {
  segs: number[][];
}
const maps = new Map<string, { sources: string[]; names: string[]; lines: MapLine[] } | null>();
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function vlq(seg: string): number[] {
  const out: number[] = [];
  let value = 0;
  let shift = 0;
  for (const ch of seg) {
    const d = B64.indexOf(ch);
    value += (d & 31) << shift;
    if (d & 32) shift += 5;
    else {
      out.push(value & 1 ? -(value >> 1) : value >> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}

function sourceMap(file: string) {
  if (maps.has(file)) return maps.get(file);
  const path = join(DIST, `${file}.map`);
  let parsed: { sources: string[]; names: string[]; lines: MapLine[] } | null = null;
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
      sources: string[];
      names: string[];
      mappings: string;
    };
    const lines: MapLine[] = [];
    let src = 0;
    let sl = 0;
    let sc = 0;
    let nm = 0;
    for (const line of raw.mappings.split(';')) {
      const segs: number[][] = [];
      let col = 0;
      for (const s of line.split(',')) {
        if (!s) continue;
        const v = vlq(s);
        col += v[0] ?? 0;
        if (v.length >= 4) {
          src += v[1] ?? 0;
          sl += v[2] ?? 0;
          sc += v[3] ?? 0;
          if (v.length >= 5) nm += v[4] ?? 0;
          segs.push([col, src, sl, sc, v.length >= 5 ? nm : -1]);
        }
      }
      lines.push({ segs });
    }
    parsed = { sources: raw.sources, names: raw.names, lines };
  }
  maps.set(file, parsed);
  return parsed;
}

/** `chunk.js:line:col` (0-based in, 1-based out) → `src/…:line`, when a map is there. */
function original(file: string, line: number, col: number): string {
  const map = sourceMap(file);
  const segs = map?.lines[line]?.segs;
  if (!map || !segs?.length) return `${file}:${line + 1}:${col + 1}`;
  let best = segs[0] as number[];
  for (const s of segs) if ((s[0] ?? 0) <= col) best = s;
  const src = (map.sources[best[1] ?? 0] ?? '?')
    .replace(/^.*\/node_modules\/\.pnpm\/[^/]+\/node_modules\//, '')
    .replace(/^.*?\/?((apps|packages)\/)/, '$1')
    .replace(/^(\.\.\/)+/, '');
  return `${src}:${(best[2] ?? 0) + 1}`;
}

function originalAtChar(file: string, pos: number): string {
  const path = join(DIST, file);
  if (!existsSync(path) || pos < 0) return `${file}@${pos}`;
  const text = readFileSync(path, 'utf8').slice(0, pos);
  const line = text.split('\n').length - 1;
  const col = pos - (text.lastIndexOf('\n') + 1);
  return original(file, line, col);
}

async function cpuProfile(browser: Browser, profile: Profile, pdf: Buffer): Promise<string[]> {
  const { ctx, page, cdp } = await context(browser, profile);
  await page.goto('./?lang=en');
  await until(page, HOME);
  await sleep(1500);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 250 });
  await cdp.send('Profiler.start');
  await openFile(page, profile, 'profiled.pdf', pdf);
  await until(page, FIRST_PAGE);
  await settle(page);
  await scrollRun(page);
  await settle(page);
  const { profile: prof } = await cdp.send('Profiler.stop');
  await ctx.close();
  const total = prof.samples?.length ?? 1;
  const ms = (prof.endTime - prof.startTime) / 1000;
  const self = new Map<string, number>();
  for (const node of prof.nodes) {
    const f = node.callFrame;
    const file = f.url.replace(/^https?:\/\/[^/]+\//, '');
    const where = file ? original(file, f.lineNumber, f.columnNumber) : '';
    const key = `${f.functionName || '(anonymous)'} ${where}`.trim();
    self.set(key, (self.get(key) ?? 0) + (node.hitCount ?? 0));
  }
  return [...self.entries()]
    .filter(([k]) => !k.startsWith('(idle)'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k, n]) => `${Math.round((n / total) * ms)} ms  ${k}`);
}

// ---------------------------------------------------------------------------------------------
// Medians and report

function median(values: readonly number[]): number {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return Number.NaN;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? (v[mid] as number) : ((v[mid - 1] as number) + (v[mid] as number)) / 2;
}
const round1 = (v: number) => Math.round(v * 10) / 10;
const sleep = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

const server = new Server();

async function main(): Promise<void> {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error(`no build at ${DIST}`);
  mkdirSync(OUT, { recursive: true });
  await server.start();
  const browser = await chromium.launch({ ...chromiumLaunchOptions(), headless: true });
  const gpu = await (async () => {
    try {
      const cdp = await browser.newBrowserCDPSession();
      const info = (await cdp.send('SystemInfo.getInfo')) as {
        gpu: { devices: { deviceString: string }[] };
      };
      return info.gpu.devices.map((d) => d.deviceString).join('; ');
    } catch {
      return 'unknown';
    }
  })();
  const pdfs = [largePdf(PAGES, 1), largePdf(PAGES, 2), largePdf(PAGES, 3)];
  const writePdf = arg('write-pdf', '');
  if (writePdf) {
    // `--write-pdf <file>`: only write the generated document, for manual probes.
    writeFileSync(writePdf, pdfs[0] as Buffer);
    await browser.close();
    await server.stop();
    return;
  }
  const runs: Record<string, Row[]> = {};
  const log = (s: string) => console.log(`[perf] ${s}`);
  log(
    `build ${DIST}, ${RUNS} runs, large PDF ${PAGES} pages ${(pdfs[0]?.length ?? 0) >> 20} MiB, GPU ${gpu}`,
  );
  for (let run = 0; run < RUNS; run++) {
    for (const name of PROFILES) {
      const profile = PROFILE[name];
      if (!profile) throw new Error(`unknown profile ${name}`);
      server.net = profile.net;
      const row: Row = {};
      const step = async (label: string, f: () => Promise<Row>) => {
        try {
          Object.assign(row, await f());
        } catch (error) {
          log(`${name} run ${run + 1} ${label} failed: ${(error as Error).message.split('\n')[0]}`);
        }
      };
      if (ONLY.has('first')) await step('first', () => firstAndRepeat(browser, profile));
      server.net = null; // Opening local files and scrolling do not touch the network.
      if (ONLY.has('large')) await step('large', () => large(browser, profile, pdfs[0] as Buffer));
      if (ONLY.has('memory') && !profile.touch) {
        await step('memory', () => memory(browser, profile, pdfs));
      }
      (runs[name] ??= []).push(row);
      log(`${name} run ${run + 1}: ${JSON.stringify(row)}`);
    }
  }
  const cpu: Record<string, string[]> = {};
  for (const name of CPU_PROFILE ? PROFILES : []) {
    cpu[name] = await cpuProfile(browser, PROFILE[name] as Profile, pdfs[0] as Buffer);
  }
  await browser.close();
  await server.stop();

  const keys = [
    ...new Set(Object.values(runs).flatMap((rows) => rows.flatMap(Object.keys))),
  ].sort();
  const medians: Record<string, Record<string, number>> = {};
  for (const [name, rows] of Object.entries(runs)) {
    medians[name] = Object.fromEntries(
      keys.map((k) => [k, median(rows.map((r) => r[k] ?? Number.NaN))]),
    );
  }
  const blamed: Record<string, string[]> = {};
  for (const [label, list] of Object.entries(blames)) {
    blamed[label] = list
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 12)
      .map(
        (b) =>
          `${Math.round(b.ms / RUNS)} ms/run  ${b.fn}  ${b.src ? originalAtChar(b.src, b.pos) : '(no script)'}`,
      );
  }
  const splits = Object.fromEntries(
    Object.entries(frameSplits).map(([k, v]) => [
      k,
      Object.fromEntries(Object.entries(v).map(([n, x]) => [n, Math.round(x / RUNS)])),
    ]),
  );
  const result = {
    gpu,
    pages: PAGES,
    precache: precache(),
    medians,
    runs,
    splits,
    blamed,
    cpu,
    traces,
    allocators,
  };
  writeFileSync(join(OUT, 'baseline.json'), JSON.stringify(result, null, 2));
  const names = Object.keys(medians);
  const lines = [
    `| Measure | ${names.join(' | ')} |`,
    `| --- | ${names.map(() => '---:').join(' | ')} |`,
    ...keys.map((k) => `| ${k} | ${names.map((n) => String(medians[n]?.[k] ?? '')).join(' | ')} |`),
  ];
  writeFileSync(join(OUT, 'baseline.md'), `${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
  console.log(`precache ${JSON.stringify(result.precache)}`);
  console.log(`\nlong animation frames per run: ${JSON.stringify(splits, null, 1)}`);
  for (const [label, list] of Object.entries(blamed))
    console.log(`\n${label}:\n  ${list.join('\n  ')}`);
  for (const [label, list] of Object.entries(traces))
    console.log(`\ntrace ${label}:\n  ${list.join('\n  ')}`);
  for (const [name, list] of Object.entries(cpu)) {
    console.log(`\nCPU self time, ${name} (open + scroll):\n  ${list.join('\n  ')}`);
  }
  for (const [label, list] of Object.entries(allocators)) {
    const top = Object.entries(list).sort((a, b) => b[1] - a[1]);
    console.log(
      `\nallocators, ${label} (MiB):\n  ${top.map(([k, v]) => `${v}  ${k}`).join('\n  ')}`,
    );
  }
  log(`wrote ${join(OUT, 'baseline.json')}`);
}

await main();
