/**
 * The teaching sample's manifest (`apps/web/test/sample-manifest.json`, written by
 * tools/fixtures/sample-fixture.ts; MOB-12): what each file holds, so the specs follow the
 * sample instead of pinning its pages. `sampleEntry('en', 'phone')` is the file the compact
 * edition opens for an English sample.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface SampleEntry {
  readonly file: string;
  readonly locale: 'en' | 'tr';
  readonly edition: 'full' | 'phone';
  readonly title: string;
  readonly pages: readonly string[];
  readonly pageCount: number;
  readonly outline: readonly string[];
  readonly formPage: number;
  readonly featurePage: number;
  readonly scanPages: readonly number[];
  readonly fields: readonly string[];
  readonly coverLinks: readonly number[];
  readonly edit: Readonly<
    Record<string, { readonly start: string; readonly lines: number; readonly align: string }>
  >;
  readonly bytes: number;
}

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../test/sample-manifest.json', import.meta.url)), 'utf8'),
) as { files: SampleEntry[] };

export const SAMPLE_FILES: readonly SampleEntry[] = manifest.files;

export function sampleEntry(locale: 'en' | 'tr', edition: 'full' | 'phone'): SampleEntry {
  const entry = manifest.files.find((f) => f.locale === locale && f.edition === edition);
  if (!entry) throw new Error(`no ${locale} ${edition} sample in the manifest`);
  return entry;
}
