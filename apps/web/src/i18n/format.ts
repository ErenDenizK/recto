/** Locale-aware number formatting for the chrome (tabular numerals stay in CSS). */
import { getLocale } from './locale';

/** `1.25` → "125%" (en) / "%125" (tr). */
export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat(getLocale(), { style: 'percent', maximumFractionDigits: 0 }).format(
    ratio,
  );
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getLocale(), options).format(value);
}

/**
 * A day, short and day first: "3 Oct" / "3 Eki", with `year` "3 Oct 2026" / "3 Eki 2026"
 * (03-markup MK-11's "Signature, added 3 Oct"). English takes the `en-GB` conventions for it:
 * `en` alone puts the month first ("Oct 3, 2026").
 */
export function formatDay(date: Date | number, options: { readonly year?: boolean } = {}): string {
  const locale = getLocale();
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    day: 'numeric',
    month: 'short',
    ...(options.year ? { year: 'numeric' } : {}),
  }).format(date);
}

const SIZE_UNITS = ['KB', 'MB', 'GB', 'TB'] as const;

/**
 * A byte size in the locale's numerals (components/07-sheets.md §4.5: "2.4 MB" / "2,4 MB"):
 * binary multiples with decimal-looking units, one decimal under 100, as `formatBytes` in
 * `files/file-filters.ts` draws them in English.
 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${formatNumber(bytes, { maximumFractionDigits: 0 })} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = value >= 100 ? 0 : 1;
  const shown = formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${shown} ${SIZE_UNITS[unit]}`;
}
