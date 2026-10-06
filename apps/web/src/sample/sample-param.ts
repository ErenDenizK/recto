/**
 * The `?sample` link parameter (components/02-library.md §11, L10 §6; flows.md §9.2): the about
 * page's "Try it with a demo PDF" opens the teaching sample after launch.
 *
 * - `?sample=en` and `?sample=tr` choose the sample's language; `?sample`, `?sample=` or any
 *   other value means the UI's language.
 * - The parameter is read once at boot and removed from the address with
 *   `history.replaceState` (other parameters and the hash stay), so a reload opens no second
 *   copy.
 * - Nothing in the query is ever fetched: the value only picks one of the two files the app
 *   ships (`open-sample.ts`).
 */
import type { Locale } from '../i18n/locale';

export type SampleLocale = 'en' | 'tr';

export const SAMPLE_PARAM = 'sample';

/** The sample's language a query asks for, or null when it has no `sample` parameter. */
export function sampleLocaleFromSearch(search: string, uiLocale: Locale): SampleLocale | null {
  const params = new URLSearchParams(search);
  if (!params.has(SAMPLE_PARAM)) return null;
  const value = params.get(SAMPLE_PARAM)?.trim().toLowerCase();
  if (value === 'en' || value === 'tr') return value;
  return uiLocale === 'tr' ? 'tr' : 'en';
}

/**
 * Reads `?sample` from the address and removes it in place. Returns the sample's language,
 * or null when the address has none (and then leaves the address alone).
 */
export function takeSampleParam(uiLocale: Locale, win: Window = window): SampleLocale | null {
  const url = new URL(win.location.href);
  const locale = sampleLocaleFromSearch(url.search, uiLocale);
  if (locale === null) return null;
  url.searchParams.delete(SAMPLE_PARAM);
  try {
    win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // A sandboxed frame may refuse; the sample still opens once (the boot reads it once).
  }
  return locale;
}
