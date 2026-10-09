/**
 * Bundle budgets (docs/plan/v1/PLAN.md §2.3 V1-P1…P3, backlog PF-14 · CR-6; the audit's item 14,
 * docs/plan/v1/perf-audit.md). Reads a production build of the web app and measures what each
 * edition loads before it can work, then fails when a measure is over its absolute gate or has
 * grown by more than the growth cap since the recorded baseline.
 *
 *   node --experimental-strip-types tools/qa/bundle-budget.ts [dist] [--write-baseline]
 *
 * `dist` defaults to apps/web/dist. The gates, the cap and the baseline live in
 * tools/qa/bundle-budget.json. `--write-baseline` records the current measures as the new
 * baseline: the lead does that once per wave, after the merge (a growth the owner accepted is
 * recorded the same way, in its own commit).
 *
 * A **closure** is an emitted chunk plus every chunk it reaches through static `import … from`
 * and `export … from` edges. Dynamic `import()` and Vite's preload lists are not followed:
 * they load later, on demand. Sizes are bytes; gzip is Node's zlib at its default level, as in
 * the audit; sizes print in KiB (1 KB = 1024 B), the unit of the audit and of PLAN.md §2.3.
 * Measures:
 *
 * - `firstPaint` (V1-P1): the scripts index.html links, with their closures, JS gzip. This is
 *   the audit's "118 KB" baseline; the stylesheets it links are printed beside it, not gated.
 * - `editor` (V1-P2): the closure of the `app` chunk (the editor, loaded before the first page),
 *   JS gzip.
 * - `compact`: the closure of the `CompactApp` chunk (the phone edition, ADR-0033), JS gzip.
 * - `pdfiumWorker`: the PDFium worker script and its closure, raw (parsed before the first
 *   render).
 * - `precache`: the bytes the service worker precaches.
 *
 * It also checks PF-17 (V1-F15): every emitted script, stylesheet and font of at most 1 MiB is
 * in the service worker's precache list (except EmbedPDF's never-loaded `worker-engine-*`
 * chunk, excluded in vite.config.ts), so every lazy surface opens offline. Wasm is
 * runtime-cached instead (ADR-0010; src/pwa/register.ts warms it).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '../..');
const CONFIG_PATH = join(import.meta.dirname, 'bundle-budget.json');

type MeasureName = 'firstPaint' | 'editor' | 'compact' | 'pdfiumWorker' | 'precache';

interface BudgetConfig {
  readonly $comment?: string;
  /** Absolute ceilings in bytes. */
  readonly gates: Readonly<Record<MeasureName, number>>;
  /** Allowed growth over the baseline, as a fraction (0.01 = 1 %). */
  readonly growthCap: number;
  /** The measures recorded at the start of the wave, in bytes. */
  readonly baseline: Readonly<Partial<Record<MeasureName, number>>>;
}

interface Closure {
  readonly files: readonly string[];
  readonly raw: number;
  readonly gzip: number;
}

const MEASURE_LABELS: Readonly<Record<MeasureName, string>> = {
  firstPaint: 'First paint JS gzip (V1-P1)',
  editor: 'Editor initial JS gzip (V1-P2)',
  compact: 'Compact edition JS gzip',
  pdfiumWorker: 'PDFium worker script, raw',
  precache: 'Service-worker precache, raw',
};

/** Static `import … from "./x.js"`, `import "./x.js"` and `export … from "./x.js"`. */
const STATIC_EDGE =
  /(?:^|[^.\w$])(?:import|export)\s*(?:[\w$*{}\s,]*?\s*from\s*)?["'](\.\.?\/[^"']+\.js)["']/g;

function main(): void {
  const args = process.argv.slice(2);
  const writeBaseline = args.includes('--write-baseline');
  const distArg = args.find((arg) => !arg.startsWith('--'));
  const dist = resolve(ROOT, distArg ?? 'apps/web/dist');
  if (!existsSync(join(dist, 'index.html'))) {
    fail(`No build at ${dist}. Run \`pnpm build\` first.`);
  }
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as BudgetConfig;

  const assets = join(dist, 'assets');
  const sizes = new Map<string, { raw: number; gzip: number }>();
  const sizeOf = (path: string) => {
    let size = sizes.get(path);
    if (!size) {
      const bytes = readFileSync(path);
      size = { raw: bytes.length, gzip: gzipSync(bytes).length };
      sizes.set(path, size);
    }
    return size;
  };

  const closure = (entries: readonly string[]): Closure => {
    const seen = new Set<string>();
    const queue = [...entries];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      if (!file.endsWith('.js')) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(STATIC_EDGE)) {
        queue.push(resolve(file, '..', match[1] as string));
      }
    }
    const files = [...seen].sort();
    let raw = 0;
    let gzip = 0;
    for (const file of files) {
      const size = sizeOf(file);
      raw += size.raw;
      gzip += size.gzip;
    }
    return { files, raw, gzip };
  };

  const assetFiles = readdirSync(assets);
  /** The one chunk named `<name>-<hash>.js` (a hash is word characters and dashes). */
  const chunk = (name: string): string => {
    const pattern = new RegExp(`^${name.replace(/\./g, '\\.')}-[\\w-]+\\.js$`);
    const found = assetFiles.filter((file) => pattern.test(file));
    if (found.length !== 1)
      fail(`Expected one ${name}-*.js chunk in ${assets}, found ${found.length}.`);
    return join(assets, found[0] as string);
  };

  // index.html: module scripts, modulepreloads and stylesheets under the base path.
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const linked = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+\.(?:js|css))"/g)].map(
    (match) => join(assets, (match[1] as string).replace(/^.*\/assets\//, '')),
  );
  const linkedCss = linked.filter((file) => file.endsWith('.css'));

  const precacheList = readPrecache(dist);
  const precacheBytes = precacheList.reduce((sum, url) => {
    const path = join(dist, url);
    return sum + (existsSync(path) ? statSync(path).size : 0);
  }, 0);

  const firstPaint = closure(linked.filter((file) => file.endsWith('.js')));
  const firstPaintCss = closure(linkedCss);
  const editor = closure([chunk('app')]);
  const compact = closure([chunk('CompactApp')]);
  const pdfiumWorker = closure([chunk('pdfium.worker')]);
  const measures: Record<MeasureName, number> = {
    firstPaint: firstPaint.gzip,
    editor: editor.gzip,
    compact: compact.gzip,
    pdfiumWorker: pdfiumWorker.raw,
    precache: precacheBytes,
  };
  const fileCounts: Partial<Record<MeasureName, number>> = {
    firstPaint: firstPaint.files.length,
    editor: editor.files.length,
    compact: compact.files.length,
    pdfiumWorker: pdfiumWorker.files.length,
    precache: precacheList.length,
  };

  const problems: string[] = [];
  const rows: string[] = [];
  for (const name of Object.keys(MEASURE_LABELS) as MeasureName[]) {
    const value = measures[name];
    const gate = config.gates[name];
    const base = config.baseline[name];
    const cap = base === undefined ? undefined : Math.floor(base * (1 + config.growthCap));
    const growth =
      base === undefined ? '' : ` (${signedPercent(value / base - 1)} vs baseline ${kb(base)})`;
    rows.push(
      `${MEASURE_LABELS[name].padEnd(38)} ${kb(value).padStart(10)}  gate ${kb(gate)}, ${fileCounts[name]} files${growth}`,
    );
    if (value > gate)
      problems.push(`${MEASURE_LABELS[name]}: ${kb(value)} is over the gate of ${kb(gate)}.`);
    if (!writeBaseline && cap !== undefined && value > cap) {
      problems.push(
        `${MEASURE_LABELS[name]}: ${kb(value)} grew more than ${config.growthCap * 100} % over the baseline ` +
          `${kb(base as number)}. Shrink it, or record a growth the owner accepted with --write-baseline.`,
      );
    }
  }

  // PF-17: every emitted script, stylesheet and font (≤ 1 MiB, ADR-0010) is precached.
  const precached = new Set(precacheList);
  const missing = assetFiles
    .filter(
      (name) =>
        (/\.(js|css)$/.test(name) && !name.startsWith('worker-engine-')) ||
        (/\.(woff2?|ttf|otf)$/.test(name) && statSync(join(assets, name)).size <= 1024 * 1024),
    )
    .map((name) => `assets/${name}`)
    .filter((url) => !precached.has(url));
  for (const url of missing) problems.push(`Not precached (PF-17): ${url}`);

  rows.push(
    `${'First paint CSS gzip (not gated)'.padEnd(38)} ${kb(firstPaintCss.gzip).padStart(10)}`,
  );
  console.log(rows.join('\n'));
  if (writeBaseline) {
    const next: BudgetConfig = { ...config, baseline: measures };
    writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`\nBaseline written to ${CONFIG_PATH}.`);
  }
  if (problems.length > 0) {
    console.error(`\n${problems.join('\n')}`);
    process.exit(1);
  }
  console.log('\nBundle budgets: OK.');
}

/** The URLs of the generated service worker's `precacheAndRoute([...])` list. */
function readPrecache(dist: string): string[] {
  const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
  const urls = [...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map((match) => match[1] as string);
  if (urls.length === 0) fail(`No precache list in ${join(dist, 'sw.js')}.`);
  return urls;
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function signedPercent(fraction: number): string {
  const percent = (fraction * 100).toFixed(1);
  return fraction >= 0 ? `+${percent} %` : `${percent} %`;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
