/**
 * The teaching sample (MOB-11, MOB-12; docs/design/sample-2026-10/design.md and technical.md):
 * Margin No. 07 / Kenar Sayı 07, a fictional quarterly's press-week folder, one feature per
 * page. One page catalog (sample/catalog.ts) is cut into one file per edition and language:
 *
 *   recto-sample-{en,tr}.pdf        full edition (desktop, tablet): 8 pages, ≤ 125 KB each
 *   recto-sample-phone-{en,tr}.pdf  compact edition (phones): 6 pages, ≤ 90 KB each
 *
 * each with its own folios, outline, links, tags and edition-true try lines, and a manifest
 * (apps/web/test/sample-manifest.json) the unit and e2e specs read: pages, fields, the scan
 * page, the edit targets, sizes and hashes. The app picks the file by edition
 * (apps/web/src/sample/sample-file.ts).
 *
 *   pnpm --filter @pdf-editor/fixtures-tool sample          # (re)write the files and manifest
 *   pnpm --filter @pdf-editor/fixtures-tool sample --check  # rebuild in memory, compare
 *
 * Everything is drawn here: text in subsets of the bundled OFL faces (Inter Regular and Bold,
 * Noto Serif Regular; packages/engine/assets/fonts/LICENSES.md), set the way the paragraph
 * editor reads it (sample/kit.ts), shapes as paths, and the scan rasterised by lib/raster.ts
 * from JetBrains Mono's and Inter's outlines (sample/pages/scan.ts). Determinism follows the
 * corpus: fixed Info dates, a trailer /ID and a PRNG from the file name, fixed subset tags, and
 * pdf-lib's own deflate, so a rebuild is byte-identical (`--check` and the unit test hold it).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, sha256 } from './lib/common.ts';
import { buildCut, sampleFile } from './sample/build.ts';
import { pagesOf } from './sample/catalog.ts';
import type { SampleEdition, SampleLocale } from './sample/context.ts';
import { COPY } from './sample/copy.ts';
import { AGREEMENT_FIELDS } from './sample/pages/agreement.ts';
import type { SetText } from './sample/kit.ts';
import type { FeatureLayout } from './sample/pages/feature.ts';

export type { SampleEdition, SampleLocale };
export { sampleFile };

export const SAMPLE_LOCALES: readonly SampleLocale[] = ['en', 'tr'];
export const SAMPLE_EDITIONS: readonly SampleEdition[] = ['full', 'phone'];
/** Where the app serves them from (`sample/…`, precached, vite.config.ts). */
export const SAMPLE_DIR = join(REPO_ROOT, 'apps', 'web', 'public', 'sample');
/** The manifest the app's unit and e2e specs read. */
export const SAMPLE_MANIFEST = join(REPO_ROOT, 'apps', 'web', 'test', 'sample-manifest.json');
/** Per-file caps (MOB-12): the full cut ≤ 125 KB, the phone cut ≤ 90 KB. */
export const SAMPLE_MAX_BYTES: Readonly<Record<SampleEdition, number>> = {
  full: 125 * 1024,
  phone: 90 * 1024,
};
/**
 * All four together (MOB-13, raised by MOB-14 for v2's light and grain): they are precached,
 * so the four are capped together as well as one by one; the scan's 2-bit storage pays for
 * part of the light.
 */
export const SAMPLE_TOTAL_MAX_BYTES = 344 * 1024;
/** The form's fields in tab order (the agreement page). */
export const SAMPLE_FIELDS = AGREEMENT_FIELDS;

export async function buildSample(
  locale: SampleLocale,
  edition: SampleEdition = 'full',
): Promise<Uint8Array> {
  return (await buildCut(locale, edition)).bytes;
}

export interface SampleManifestFile {
  readonly file: string;
  readonly locale: SampleLocale;
  readonly edition: SampleEdition;
  readonly title: string;
  /** Page ids in order (sample/catalog.ts). */
  readonly pages: readonly string[];
  readonly pageCount: number;
  readonly outline: readonly string[];
  /** 1-based page numbers of the lessons. */
  readonly formPage: number;
  readonly featurePage: number;
  readonly scanPages: readonly number[];
  readonly fields: readonly string[];
  /** The cover's links: the 1-based pages they open. */
  readonly coverLinks: readonly number[];
  /**
   * The feature's edit targets: each paragraph's first words (as the text layer reads its first
   * line), its line count and alignment.
   */
  readonly edit: Readonly<
    Record<string, { readonly start: string; readonly lines: number; readonly align: string }>
  >;
  /** The scan's typed letter (OCR's ground truth), on files with a scan page. */
  readonly scanText?: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface SampleManifest {
  readonly $comment: string;
  readonly files: readonly SampleManifestFile[];
}

/** The first few words of `text` without the `**` bold marks. */
const startOf = (text: string, words = 4) =>
  text.replaceAll('**', '').split(' ').slice(0, words).join(' ');

export async function buildSamples(): Promise<{
  files: Map<string, Uint8Array>;
  manifest: SampleManifest;
  /** Every paragraph each file sets, as set (the line-break checks, MOB-15). */
  texts: Map<string, readonly SetText[]>;
}> {
  const files = new Map<string, Uint8Array>();
  const texts = new Map<string, readonly SetText[]>();
  const entries: SampleManifestFile[] = [];
  for (const locale of SAMPLE_LOCALES) {
    for (const edition of SAMPLE_EDITIONS) {
      const file = sampleFile(locale, edition);
      const { bytes, notes } = await buildCut(locale, edition);
      files.set(file, bytes);
      texts.set(file, notes.texts);
      const copy = COPY[locale];
      const ids = pagesOf(edition).map((p) => p.id);
      const page = (id: string) => ids.indexOf(id) + 1;
      const feature = notes.extras.feature as FeatureLayout;
      const f = copy.feature;
      const edit: Record<string, { start: string; lines: number; align: string }> = {};
      [...f.col1, f.p5, f.p6].forEach((text, i) => {
        const key = `p${i + 1}`;
        edit[key] = { start: startOf(text), lines: feature.paragraphs[key] ?? 0, align: 'justify' };
      });
      edit.quote = {
        start: startOf(f.quote, 3),
        lines: feature.paragraphs.quote ?? 0,
        align: 'left',
      };
      entries.push({
        file,
        locale,
        edition,
        title: copy.title,
        pages: ids,
        pageCount: ids.length,
        outline: ids.map((id) => copy.outline[id] ?? id),
        formPage: page('agreement'),
        featurePage: page('feature'),
        scanPages: pagesOf(edition)
          .map((p, i) => (p.scan ? i + 1 : 0))
          .filter(Boolean),
        fields: [...SAMPLE_FIELDS],
        coverLinks: copy.cover.lines.map((l) => page(l.page)),
        edit,
        ...(edition === 'full'
          ? { scanText: copy.scan.letter.filter((l) => l && l !== '#signature').join('\n') }
          : {}),
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }
  }
  return {
    files,
    texts,
    manifest: {
      $comment:
        'Generated by tools/fixtures/sample-fixture.ts (pnpm --filter @pdf-editor/fixtures-tool sample); do not edit.',
      files: entries,
    },
  };
}

/**
 * The manifest as committed: JSON formatted by the repository's Biome (as generate.ts does
 * for test/fixtures/manifest.json), so `pnpm format:check` stays green; plain JSON when Biome
 * is missing.
 */
export function manifestText(manifest: SampleManifest): string {
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  const biome = join(REPO_ROOT, 'node_modules', '.bin', 'biome');
  if (!existsSync(biome)) return json;
  try {
    return execFileSync(biome, ['format', `--stdin-file-path=${SAMPLE_MANIFEST}`], {
      cwd: REPO_ROOT,
      input: json,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return json;
  }
}

/** Size problems of a build, empty when every cap holds. */
export function sizeProblems(files: ReadonlyMap<string, Uint8Array>): string[] {
  const problems: string[] = [];
  let total = 0;
  for (const locale of SAMPLE_LOCALES) {
    for (const edition of SAMPLE_EDITIONS) {
      const file = sampleFile(locale, edition);
      const size = files.get(file)?.length ?? 0;
      total += size;
      if (size > SAMPLE_MAX_BYTES[edition])
        problems.push(`${file} is ${size} bytes, over the ${SAMPLE_MAX_BYTES[edition]}-byte cap`);
    }
  }
  if (total > SAMPLE_TOTAL_MAX_BYTES)
    problems.push(`the four files are ${total} bytes, over the ${SAMPLE_TOTAL_MAX_BYTES}-byte cap`);
  return problems;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const { files, manifest } = await buildSamples();
  const problems = sizeProblems(files);
  if (problems.length) throw new Error(problems.join('\n'));
  const text = manifestText(manifest);
  if (check) {
    const stale = [...files]
      .filter(([file, bytes]) => {
        const path = join(SAMPLE_DIR, file);
        return !existsSync(path) || sha256(readFileSync(path)) !== sha256(bytes);
      })
      .map(([file]) => file);
    if (!existsSync(SAMPLE_MANIFEST) || readFileSync(SAMPLE_MANIFEST, 'utf8') !== text)
      stale.push('sample-manifest.json');
    if (stale.length) {
      console.error(`Not reproducible / out of date: ${stale.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    console.log(`All four samples and the manifest are byte-identical to ${SAMPLE_DIR}.`);
    return;
  }
  mkdirSync(SAMPLE_DIR, { recursive: true });
  let total = 0;
  for (const [file, bytes] of files) {
    writeFileSync(join(SAMPLE_DIR, file), bytes);
    total += bytes.length;
    console.log(
      `${file.padEnd(28)} ${String(bytes.length).padStart(8)} B  ${sha256(bytes).slice(0, 12)}`,
    );
  }
  writeFileSync(SAMPLE_MANIFEST, text);
  console.log(`${'all four'.padEnd(28)} ${String(total).padStart(8)} B`);
}

// Run as a script (`node sample-fixture.ts`); importing it (the unit test) builds nothing.
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
