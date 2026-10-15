/**
 * The teaching sample's files (MOB-11, MOB-12; components/02-library.md §11, L10; redesign
 * D4-2): one PDF per edition and language in `public/sample/`, built from one page catalog by
 * `tools/fixtures/sample-fixture.ts` and precached by the service worker (`vite.config.ts`,
 * 02.14), so the sample opens offline once the app has loaded with a connection. The full
 * edition gets the full cut (`recto-sample-{en,tr}.pdf`, 8 pages); the compact edition the
 * phone cut (`recto-sample-phone-{en,tr}.pdf`, the 6 pages whose lessons work on a phone, in
 * its own words). Two files rather than one trimmed at open: an untouched sample stays the file
 * as opened (pristine; Save a copy and Share hand out its own bytes) and its page numbers,
 * links and outline are true in each edition.
 *
 * The file a person gets is named for the sample's language ("Recto sample.pdf", "Recto örnek
 * belge.pdf"), not the UI's, since it names the document's own language; a second open while
 * the first is still open is "Recto sample (2).pdf", and so on. Each one carries the fixtures'
 * fixed date as its `lastModified`, which, with the name, tells the session a sample from a
 * person's own file (`isSampleFile`): the sample joins Recents only once changed (02.14).
 */
import { m } from '../i18n';
import type { Edition } from '../shell/frame/edition';
import { toast } from '../ui/Toast/toast';
import type { SampleLocale } from './sample-param';

/** The document title per sample language (L10 §5). */
export const SAMPLE_TITLES: Readonly<Record<SampleLocale, string>> = {
  en: 'Recto sample',
  tr: 'Recto örnek belge',
};

/** `lastModified` of every sample File: the fixtures' fixed date (tools/fixtures/lib/common.ts). */
export const SAMPLE_LAST_MODIFIED = Date.UTC(2024, 0, 1);

/** The file's name in `public/sample/` for a language and edition (MOB-12). */
export function sampleFileOf(locale: SampleLocale, edition: Edition = 'full'): string {
  return edition === 'compact' ? `recto-sample-phone-${locale}.pdf` : `recto-sample-${locale}.pdf`;
}

/** The shipped file's URL under the deployment base (`sample/recto-sample-en.pdf`). */
export function sampleUrl(
  locale: SampleLocale,
  edition: Edition = 'full',
  base = import.meta.env.BASE_URL,
): string {
  return new URL(`sample/${sampleFileOf(locale, edition)}`, new URL(base, location.href)).href;
}

/**
 * The file name for the next open: the title, or the title with the first free " (n)" from 2
 * when a document of that title is open (`openTitles`).
 */
export function sampleFileName(locale: SampleLocale, openTitles: Iterable<string>): string {
  const title = SAMPLE_TITLES[locale];
  const taken = new Set(openTitles);
  if (!taken.has(title)) return `${title}.pdf`;
  let n = 2;
  while (taken.has(`${title} (${n})`)) n += 1;
  return `${title} (${n}).pdf`;
}

const SAMPLE_NAME = new RegExp(
  `^(${Object.values(SAMPLE_TITLES).join('|')})( \\(\\d+\\))?\\.pdf$`,
  'u',
);

/** Whether a file (or a source's file facts) is a sample as the app opened it. */
export function isSampleFile(file: { readonly name: string; readonly lastModified: number }) {
  return file.lastModified === SAMPLE_LAST_MODIFIED && SAMPLE_NAME.test(file.name);
}

export type SampleFetch =
  | { readonly ok: true; readonly bytes: ArrayBuffer }
  | { readonly ok: false; readonly reason: 'offline' | 'failed' };

/**
 * Loads a sample's bytes from the app's own origin (the precache answers offline). Never
 * rejects: offline and not yet cached is `offline`, anything else that went wrong `failed`.
 */
export async function fetchSampleBytes(
  locale: SampleLocale,
  edition: Edition = 'full',
  fetcher: typeof fetch = fetch,
): Promise<SampleFetch> {
  try {
    const response = await fetcher(sampleUrl(locale, edition));
    if (!response.ok) return { ok: false, reason: 'failed' };
    return { ok: true, bytes: await response.arrayBuffer() };
  } catch {
    return { ok: false, reason: navigator.onLine ? 'failed' : 'offline' };
  }
}

/** The sample as a File named for the next open (see `sampleFileName`). */
export function sampleFile(
  locale: SampleLocale,
  bytes: ArrayBuffer,
  openTitles: Iterable<string>,
): File {
  return new File([bytes], sampleFileName(locale, openTitles), {
    type: 'application/pdf',
    lastModified: SAMPLE_LAST_MODIFIED,
  });
}

/**
 * Loads the sample and makes its File, or says why it could not (a failure toast: "The sample
 * needs to load once with a connection" offline before the first load, else "Could not load
 * the sample") and resolves to undefined. Both editions' doors use it, each for its own cut:
 * `openSample` on the full edition, the compact Library's Try the sample and `?sample` link on
 * phones (`edition` 'compact').
 */
export async function loadSampleFile(
  locale: SampleLocale,
  edition: Edition,
  openTitles: Iterable<string>,
): Promise<File | undefined> {
  const loaded = await fetchSampleBytes(locale, edition);
  if (!loaded.ok) {
    toast.failure(loaded.reason === 'offline' ? m.sample_offline() : m.sample_failed(), {
      key: 'sample-failed',
      testId: 'sample-failed',
    });
    return undefined;
  }
  return sampleFile(locale, loaded.bytes, openTitles);
}
