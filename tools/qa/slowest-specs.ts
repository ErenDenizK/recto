/**
 * The slowest end-to-end specs of a run (plan 2026-10-17 lane T3: shards balance by time, and
 * a spec that grows is seen before it takes a shard past its limit). Reads Playwright's JSON
 * reports (`apps/web/playwright.config.ts` writes `apps/web/playwright-timings/results.json`)
 * and prints the ten specs that took longest, each file's time summed over its tests, retries
 * included (what the shard spent on it), then the ten slowest tests.
 *
 *   node --experimental-strip-types tools/qa/slowest-specs.ts [report.json | dir]… [--top N]
 *
 * With no path it reads apps/web/playwright-timings/results.json. A directory is searched for
 * `*.json` reports, so the per-shard files CI keeps (`e2e-timings-<project>-<shard>`) can be
 * downloaded into one folder and read together.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Result {
  readonly duration: number;
  readonly status?: string;
}
interface Test {
  readonly projectName?: string;
  readonly results?: readonly Result[];
}
interface Spec {
  readonly title: string;
  readonly file: string;
  readonly line?: number;
  readonly tests?: readonly Test[];
}
interface Suite {
  readonly title?: string;
  readonly file?: string;
  readonly specs?: readonly Spec[];
  readonly suites?: readonly Suite[];
}
interface Report {
  readonly suites?: readonly Suite[];
}

/** One test's time on one project. */
export interface Timing {
  readonly file: string;
  readonly title: string;
  readonly project: string;
  readonly ms: number;
  readonly runs: number;
}

/** Every test's time in `report`, retries summed. */
export function timings(report: Report): Timing[] {
  const found: Timing[] = [];
  const walk = (suite: Suite, path: readonly string[]) => {
    const here = suite.title && !suite.file?.endsWith(suite.title) ? [...path, suite.title] : path;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? [];
        found.push({
          file: spec.file,
          title: [...here, spec.title].join(' › '),
          project: test.projectName ?? '',
          ms: results.reduce((sum, r) => sum + r.duration, 0),
          runs: results.length,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return found;
}

/** Each spec file's total, slowest first. */
export function bySpec(all: readonly Timing[]): { file: string; ms: number; tests: number }[] {
  const files = new Map<string, { ms: number; tests: number }>();
  for (const t of all) {
    const entry = files.get(t.file) ?? { ms: 0, tests: 0 };
    entry.ms += t.ms;
    entry.tests += 1;
    files.set(t.file, entry);
  }
  return [...files].map(([file, entry]) => ({ file, ...entry })).sort((a, b) => b.ms - a.ms);
}

function reports(paths: readonly string[]): string[] {
  const out: string[] = [];
  for (const path of paths) {
    if (!existsSync(path)) throw new Error(`no report at ${path}: run Playwright first`);
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path)) {
        const child = join(path, name);
        if (statSync(child).isDirectory() || name.endsWith('.json')) out.push(...reports([child]));
      }
    } else out.push(path);
  }
  return out;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).padStart(7)} s`;

function main(argv: readonly string[]): void {
  const at = argv.indexOf('--top');
  const top = at >= 0 ? Number(argv[at + 1]) : 10;
  const paths = argv.filter((_, i) => i !== at && i !== at + 1);
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const files = reports(
    paths.length > 0 ? paths : [join(root, 'apps/web/playwright-timings/results.json')],
  );
  const all = files.flatMap((file) => timings(JSON.parse(readFileSync(file, 'utf8')) as Report));
  if (all.length === 0) {
    console.log(`No test results in ${files.map((f) => relative(root, f)).join(', ')}.`);
    return;
  }
  const total = all.reduce((sum, t) => sum + t.ms, 0);
  console.log(`${all.length} tests, ${seconds(total).trim()} in all (${files.length} report(s))`);
  console.log(`\nSlowest ${top} specs (tests × projects, retries included):`);
  for (const spec of bySpec(all).slice(0, top)) {
    const share = ((spec.ms / total) * 100).toFixed(0).padStart(3);
    console.log(`${seconds(spec.ms)} ${share} %  ${String(spec.tests).padStart(3)}  ${spec.file}`);
  }
  console.log(`\nSlowest ${top} tests:`);
  for (const t of [...all].sort((a, b) => b.ms - a.ms).slice(0, top)) {
    const retries = t.runs > 1 ? ` (${t.runs} runs)` : '';
    console.log(`${seconds(t.ms)}  [${t.project}] ${t.file} › ${t.title}${retries}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
