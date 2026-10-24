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
 * - `compactSession`: what a read-only phone session loads (docs/research/perf/compact-session-2026-10.md):
 *   the gzip of the main-frame scripts tools/qa/compact-session.ts recorded in a browser, sized
 *   here from `dist`. It fails when that file is missing, from another build or scenario version,
 *   or lacks a file of the static `compact` closure. Its growth cap waits for a baseline the
 *   owner signs off (PRC-11); until then it prints "baseline pending owner sign-off". The files
 *   after paint (outside the static closure) and the ungated "⋯ opened" scenario print under it.
 * - `engineClient`: the closure of the `client` chunk, `@pdf-editor/engine/client` (PF-2): the
 *   engine code the main thread loads to open the first document (the worker proxies and pure
 *   helpers, never pdf-lib or EmbedPDF), JS gzip. The audit's ceiling is 120 KB.
 * - `pdfiumWorker`: the PDFium worker script and its closure, raw (parsed before the first
 *   render).
 * - `precache`: the bytes the service worker precaches.
 *
 * It also checks PF-17 (V1-F15): every emitted script, stylesheet and font of at most 1 MiB is
 * in the service worker's precache list (except EmbedPDF's never-loaded `worker-engine-*`
 * chunk, excluded in vite.config.ts), so every lazy surface opens offline. Wasm is
 * runtime-cached instead (ADR-0010; src/pwa/register.ts warms it).
 *
 * Under the measures, each gated closure's largest chunks print with their share of its gzip,
 * and under each chunk its largest modules, so a growth shows where it came from. The modules
 * come from the build's `recto:bundle-modules` report (apps/web/vite.config.ts, written to
 * apps/web/node_modules/.cache/recto/): a module's share is its rendered length (after tree
 * shaking, before minification) over its chunk's, applied to the chunk's gzip, so it is an
 * estimate. A chunk the report does not name (another build's) prints without modules.
 *
 * And what a web release build must not carry (docs/plan/v1/editions.md §4.1, §4.4):
 *
 * - **V1-P3, ED-1: zero desktop bytes.** No emitted script names the desktop adapter or Tauri
 *   (`platform/desktop`, `@tauri-apps/`, `__TAURI__`).
 * - **ED-3: no lab code.** No emitted script carries `src/lab/`'s marker (`recto-lab-build`);
 *   a build made with `RECTO_LAB=1` is not a release build and fails here.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '../..');
const CONFIG_PATH = join(import.meta.dirname, 'bundle-budget.json');
/** The module report `recto:bundle-modules` writes at each build (apps/web/vite.config.ts). */
const MODULES_PATH = join(ROOT, 'apps/web/node_modules/.cache/recto/bundle-modules.json');
/** Chunks per closure, and modules per chunk, in the breakdown. */
/** SCENARIO_VERSION of tools/qa/compact-session.ts. */
const SESSION_VERSION = 1;
/** The recorder's output (tools/qa/compact-session.ts). */
const SESSION_PATH = join(ROOT, 'apps/web/node_modules/.cache/recto/compact-session.json');
const TOP_CHUNKS = 6;
const TOP_MODULES = 3;

type MeasureName =
  | 'firstPaint'
  | 'editor'
  | 'compact'
  | 'compactSession'
  | 'engineClient'
  | 'pdfiumWorker'
  | 'precache';

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
  compact: 'Compact edition JS gzip (static)',
  compactSession: 'Compact read session JS gzip',
  engineClient: 'First-open engine JS gzip (PF-2)',
  pdfiumWorker: 'PDFium worker script, raw',
  precache: 'Service-worker precache, raw',
};

/** Static `import … from "./x.js"`, `import "./x.js"` and `export … from "./x.js"`. */
const STATIC_EDGE =
  /(?:^|[^.\w$])(?:import|export)\s*(?:[\w$*{}\s,]*?\s*from\s*)?["'](\.\.?\/[^"']+\.js)["']/g;

/** Strings only the desktop target's code contains (V1-P3, ED-1). */
const DESKTOP_MARKERS = ['platform/desktop', '@tauri-apps/', '__TAURI__'];
/** `LAB_BUILD_MARKER` of apps/web/src/lab/index.ts (ED-3). */
const LAB_MARKER = 'recto-lab-build';

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
  /** The one chunk named `<name>-<hash>.js` (a hash is eight word characters and dashes). */
  const chunk = (name: string): string => {
    const pattern = new RegExp(`^${name.replace(/\./g, '\\.')}-[\\w-]{8}\\.js$`);
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
  const engineClient = closure([chunk('client')]);
  const pdfiumWorker = closure([chunk('pdfium.worker')]);
  const session = readSession(dist, assetFiles, compact, sizeOf);
  const measures: Record<MeasureName, number> = {
    firstPaint: firstPaint.gzip,
    editor: editor.gzip,
    compact: compact.gzip,
    compactSession: session.measured.gzip,
    engineClient: engineClient.gzip,
    pdfiumWorker: pdfiumWorker.raw,
    precache: precacheBytes,
  };
  const fileCounts: Partial<Record<MeasureName, number>> = {
    firstPaint: firstPaint.files.length,
    editor: editor.files.length,
    compact: compact.files.length,
    compactSession: session.measured.files.length,
    engineClient: engineClient.files.length,
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
      base === undefined
        ? name === 'compactSession'
          ? ' (baseline pending owner sign-off; growth cap inactive)'
          : ''
        : ` (${signedPercent(value / base - 1)} vs baseline ${kb(base)})`;
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

  // PRD-26: each edition's chunk is a facade only the entry imports, and only dynamically, so a
  // launch may import it again under a fresh URL without a second copy of any module.
  const editions = [chunk('app'), chunk('CompactApp')].map((file) => file.replace(/^.*[\\/]/, ''));
  for (const name of assetFiles.filter((file) => file.endsWith('.js'))) {
    if (editions.includes(name)) continue;
    const source = readFileSync(join(assets, name), 'utf8');
    const statics = [...source.matchAll(STATIC_EDGE)].map((match) => match[1] as string);
    for (const edition of editions) {
      const entry = /^main-[\w-]{8}\.js$/.test(name);
      if (entry ? statics.some((edge) => edge.endsWith(edition)) : source.includes(edition))
        problems.push(`assets/${name} imports the edition chunk ${edition} (PRD-26)`);
    }
  }

  // V1-P3 (ED-1) and ED-3: what a web release build must not carry.
  for (const name of assetFiles.filter((file) => file.endsWith('.js'))) {
    const source = readFileSync(join(assets, name), 'utf8');
    const desktop = DESKTOP_MARKERS.find((marker) => source.includes(marker));
    if (desktop)
      problems.push(`Desktop code in the web build (V1-P3): ${desktop} in assets/${name}`);
    if (source.includes(LAB_MARKER)) problems.push(`Lab code in the build (ED-3): assets/${name}`);
  }

  rows.push(
    `${'First paint CSS gzip (not gated)'.padEnd(38)} ${kb(firstPaintCss.gzip).padStart(10)}`,
  );
  console.log(rows.join('\n'));
  console.log(`\nCompact read session, after paint (outside the static closure):`);
  console.log(describeFiles(session.afterPaint, assets, sizeOf).join('\n'));
  console.log(`\nCompact "⋯ opened" scenario, extra files (not gated):`);
  console.log(describeFiles(session.opened, assets, sizeOf).join('\n'));
  const modules = readModules();
  const breakdown: [string, Closure][] = [
    [MEASURE_LABELS.firstPaint, firstPaint],
    [MEASURE_LABELS.editor, editor],
    [MEASURE_LABELS.compact, compact],
    [MEASURE_LABELS.engineClient, engineClient],
  ];
  for (const [label, measured] of breakdown) {
    console.log(`\n${label}, largest chunks:`);
    console.log(describeClosure(measured, assets, sizeOf, modules).join('\n'));
  }
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

interface SessionReport {
  /** The recorded files, as a closure-shaped measure. */
  readonly measured: Closure;
  /** The recorded files outside the static `compact` closure, largest first. */
  readonly afterPaint: readonly string[];
  /** Files the "⋯ opened" scenario added, largest first. */
  readonly opened: readonly string[];
}

/**
 * The recorder's file list (tools/qa/compact-session.ts) sized from `dist`. Exits when it is
 * missing, from another build or scenario version, names a file `dist` lacks, or misses a file of
 * the static `compact` closure (a closure larger than the session means a broken scenario).
 */
function readSession(
  dist: string,
  assetFiles: readonly string[],
  compact: Closure,
  sizeOf: (path: string) => { raw: number; gzip: number },
): SessionReport {
  let report: { version?: number; main?: string; files?: string[]; moreOpened?: string[] };
  try {
    report = JSON.parse(readFileSync(SESSION_PATH, 'utf8')) as typeof report;
  } catch {
    return fail(
      `No compact session record at ${SESSION_PATH}. Run tools/qa/compact-session.ts after the build.`,
    );
  }
  const entry = assetFiles.find((file) => /^main-[\w-]{8}\.js$/.test(file));
  if (report.version !== SESSION_VERSION || report.main !== entry)
    fail(
      `The compact session record is from another build or scenario version ` +
        `(record: v${report.version} ${report.main}; expected: v${SESSION_VERSION} ${entry}). Run tools/qa/compact-session.ts again.`,
    );
  const assets = join(dist, 'assets');
  const paths = (names: readonly string[] = []) => names.map((name) => join(assets, name));
  const files = paths(report.files);
  const gone = files.concat(paths(report.moreOpened)).filter((file) => !existsSync(file));
  if (gone.length > 0) fail(`Compact session files missing from dist: ${gone.join(', ')}`);
  const listed = new Set(files);
  const absent = compact.files.filter((file) => !listed.has(file));
  if (absent.length > 0)
    fail(
      `The compact session list lacks ${absent.length} file(s) of the static compact closure ` +
        `(the scenario is broken): ${absent.map((file) => file.slice(assets.length + 1)).join(', ')}`,
    );
  const inClosure = new Set(compact.files);
  return {
    measured: {
      files: [...files].sort(),
      raw: files.reduce((sum, file) => sum + sizeOf(file).raw, 0),
      gzip: files.reduce((sum, file) => sum + sizeOf(file).gzip, 0),
    },
    afterPaint: files.filter((file) => !inClosure.has(file)),
    opened: paths(report.moreOpened),
  };
}

/** Rendered bytes per module, per emitted chunk (`assets/name-hash.js`); empty without a report. */
type ModuleReport = Readonly<Record<string, Readonly<Record<string, number>>>>;

function readModules(): ModuleReport {
  try {
    return JSON.parse(readFileSync(MODULES_PATH, 'utf8')) as ModuleReport;
  } catch {
    return {};
  }
}

/** The closure's largest chunks by gzip, each with its largest modules (estimated gzip). */
function describeClosure(
  measured: Closure,
  assets: string,
  sizeOf: (path: string) => { raw: number; gzip: number },
  modules: ModuleReport,
): string[] {
  const chunks = measured.files
    .map((file) => ({ file, gzip: sizeOf(file).gzip }))
    .sort((a, b) => b.gzip - a.gzip);
  const lines: string[] = [];
  for (const { file, gzip } of chunks.slice(0, TOP_CHUNKS)) {
    const name = file.slice(assets.length + 1);
    lines.push(`  ${kb(gzip).padStart(9)}  ${percentOf(gzip, measured.gzip)}  ${name}`);
    const rendered = Object.entries(modules[`assets/${name}`] ?? {});
    const total = rendered.reduce((sum, [, length]) => sum + length, 0);
    for (const [id, length] of rendered.sort((a, b) => b[1] - a[1]).slice(0, TOP_MODULES)) {
      lines.push(
        `  ${''.padStart(9)}  ${kb((gzip * length) / total).padStart(9)}  ${moduleName(id)}`,
      );
    }
  }
  const rest = chunks.slice(TOP_CHUNKS);
  if (rest.length > 0) {
    const gzip = rest.reduce((sum, chunk) => sum + chunk.gzip, 0);
    lines.push(`  ${kb(gzip).padStart(9)}  ${percentOf(gzip, measured.gzip)}  ${rest.length} more`);
  }
  return lines;
}

/** Files with their gzip, largest first; a note when there are none. */
function describeFiles(
  files: readonly string[],
  assets: string,
  sizeOf: (path: string) => { raw: number; gzip: number },
): string[] {
  if (files.length === 0) return ['  none'];
  return files
    .map((file) => ({ name: file.slice(assets.length + 1), gzip: sizeOf(file).gzip }))
    .sort((a, b) => b.gzip - a.gzip)
    .map(({ name, gzip }) => `  ${kb(gzip).padStart(9)}  ${name}`);
}

/** A module id without the pnpm store path: `zustand/esm/vanilla.mjs`, `apps/web/src/main.tsx`. */
function moduleName(id: string): string {
  return id.replace(/^\0/, '').replace(/^(?:.*\/)?node_modules\/\.pnpm\/[^/]+\/node_modules\//, '');
}

function percentOf(part: number, whole: number): string {
  return `${((part / whole) * 100).toFixed(0).padStart(3)} %`;
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
