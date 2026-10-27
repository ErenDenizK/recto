/**
 * The My info fill plan (BM-4, PRD-32 amended): which fields of the active document the saved
 * profile can fill, with what text, and which rows start ticked. Pure: it reads the stops
 * (`fieldStops` order) and the profile, writes nothing, and touches no store.
 *
 * Offered: empty or filled text fields and combo boxes whose tooltip or name `matchField`
 * knows. Never offered: ELSEWHERE fields (child, spouse…), passwords, read-only fields,
 * buttons, signatures, checkboxes, radios and list boxes (v1).
 */
import { dateText } from '../../markup/fill-bar-date';
import type { FieldStop } from '../form-store';
import { type FieldMatch, matchField, type MatchConfidence } from '../autofill-hint';

/** The profile as the plan reads it (structural; the store's record satisfies it). */
export interface MyInfo {
  readonly givenName?: string | undefined;
  readonly familyName?: string | undefined;
  readonly fullName?: string | undefined;
  readonly email?: string | undefined;
  readonly tel?: string | undefined;
  /** ISO `YYYY-MM-DD`. */
  readonly birthDate?: string | undefined;
  readonly street?: string | undefined;
  readonly street2?: string | undefined;
  readonly district?: string | undefined;
  readonly city?: string | undefined;
  readonly postalCode?: string | undefined;
  readonly country?: string | undefined;
  readonly organization?: string | undefined;
  readonly jobTitle?: string | undefined;
  readonly nationalId?: string | undefined;
}

/** Why a row is (not) ticked. */
export type FillReason =
  | 'ready'
  | 'low-confidence'
  | 'filled'
  | 'duplicate'
  | 'overflow'
  | 'comb'
  | 'no-option';

export interface FillRow {
  readonly stop: FieldStop;
  readonly token: string;
  /** The text to put in the field (an option's export value for a combo box). */
  readonly value: string;
  /** What the field holds now ('' when empty). */
  readonly current: string;
  readonly confidence: MatchConfidence;
  readonly ticked: boolean;
  readonly reason: FillReason;
}

/** Lower case (Turkish), accents folded, for comparing labels and options. */
function fold(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function clean(text: string | undefined): string {
  return text?.trim() ?? '';
}

/** The text of `token` from the profile ('' when the profile has none). */
function rawValue(token: string, match: FieldMatch, field: FieldStop['field'], info: MyInfo) {
  const given = clean(info.givenName);
  const family = clean(info.familyName);
  switch (token) {
    case 'name':
      return clean(info.fullName) || [given, family].filter(Boolean).join(' ');
    case 'given-name':
      return given;
    case 'family-name':
      return family;
    case 'email':
      return clean(info.email);
    case 'tel':
      return clean(info.tel);
    case 'bday':
      return clean(info.birthDate);
    case 'postal-code':
      return clean(info.postalCode);
    case 'country-name':
      return clean(info.country);
    case 'address-level1':
      return clean(info.city);
    case 'address-level2':
      return match.phrase === 'ilce' ? clean(info.district) : clean(info.city);
    case 'address-line2':
      return clean(info.street2);
    case 'street-address':
      return field.multiline === true
        ? [clean(info.street), clean(info.street2)].filter(Boolean).join('\n')
        : clean(info.street);
    case 'organization':
      return clean(info.organization);
    case 'job-title':
      return clean(info.jobTitle);
    case 'national-id':
      return clean(info.nationalId);
    default:
      return '';
  }
}

/** The date in the pattern the label shows, else ddmmyyyy for 8 cells, else the locale's. */
function formatDate(iso: string, label: string, maxLength: number | undefined, locale: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!parts) return '';
  const [, y = '', mo = '', d = ''] = parts;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (date.getMonth() !== Number(mo) - 1 || date.getDate() !== Number(d)) return '';
  const text = label.toLocaleLowerCase('tr');
  const year = (long: boolean) => (long ? y : y.slice(2));
  const us = /mm([./-])dd\1(yyyy|yy)/.exec(text);
  if (us) return [mo, d, year(us[2] === 'yyyy')].join(us[1]);
  const iso8601 = /yyyy([./-])(?:mm|aa)\1(?:dd|gg)/.exec(text);
  if (iso8601) return [y, mo, d].join(iso8601[1]);
  const day = /(?:dd|gg)([./-])(?:mm|aa)\1(yyyy|yy)/.exec(text);
  if (day) {
    const out = [d, mo, year(day[2] === 'yyyy')].join(day[1]);
    if (maxLength !== 8 || out.length <= 8) return out;
  }
  if (maxLength === 8) return `${d}${mo}${y}`;
  return dateText(date, locale);
}

const CAPITALS = ['buyuk harf', 'block capitals', 'capital letters', 'block letters'];

/** Whether the field asks for capitals in its label. */
function wantsCapitals(label: string): boolean {
  const text = ` ${fold(label).replace(/[^a-z0-9]+/g, ' ')} `;
  return CAPITALS.some((c) => text.includes(` ${c} `));
}

/** The text a field holds now ('' for anything but a text value). */
function currentOf(field: FieldStop['field']): string {
  return typeof field.value === 'string' ? field.value : '';
}

/**
 * The plan for `stops` (in their order). One row per field (its first widget); nothing for
 * fields My info cannot or must not fill, or whose profile value is empty. High and medium
 * rows on empty fields start ticked. A row stays unticked when it is low, the field already
 * holds text, the token already appeared above, or the text does not fit the field.
 */
export function planFill(
  stops: readonly FieldStop[],
  info: MyInfo,
  options: { readonly locale: string },
): FillRow[] {
  const rows: FillRow[] = [];
  const seenFields = new Set<string>();
  const seenTokens = new Set<string>();
  for (const stop of stops) {
    const { field } = stop;
    if (field.readOnly || field.password === true) continue;
    if (field.kind !== 'text' && field.kind !== 'combobox') continue;
    const key = `${stop.source ?? ''}|${stop.fieldId ?? ''}|${stop.name}`;
    if (seenFields.has(key)) continue;
    seenFields.add(key);
    const match = matchField(field);
    if (match === null) continue;
    const label = `${field.tooltip ?? ''} ${field.name}`;
    let value = rawValue(match.token, match, field, info);
    if (value === '') continue;
    if (match.token === 'bday') {
      value = formatDate(value, label, field.maxLength, options.locale);
      if (value === '') continue;
    }
    if (match.token === 'tel' && (field.comb === true || value.length > (field.maxLength ?? 1e9))) {
      value = value.replace(/\D/g, '');
    }
    if (match.token !== 'email' && wantsCapitals(label)) value = value.toLocaleUpperCase('tr');

    // An ID number goes only where an 11-digit number fits, on a high match.
    if (match.token === 'national-id') {
      const max = field.maxLength;
      if (match.confidence !== 'high') continue;
      if (max !== undefined && max < 11) continue;
      if (field.comb === true && max !== 11) continue;
    }
    let confidence = match.confidence;
    let reason: FillReason = 'ready';
    if (field.kind === 'combobox' && (field.options?.length ?? 0) > 0) {
      const wanted = fold(value);
      const at = (field.options ?? []).findIndex((o) => fold(o) === wanted);
      if (at >= 0) value = field.exportValues?.[at] ?? field.options?.[at] ?? value;
      else if (field.editable === true) {
        confidence = 'low';
        reason = 'no-option';
      } else continue;
    } else if (field.kind === 'combobox' && field.editable !== true) {
      continue;
    } else if (field.maxLength !== undefined && value.length > field.maxLength) {
      confidence = 'low';
      reason = 'overflow';
    } else if (field.comb === true && field.maxLength === undefined) {
      confidence = 'low';
      reason = 'comb';
    }

    const current = currentOf(field);
    const repeat = seenTokens.has(match.token);
    if (current !== '') reason = 'filled';
    else if (reason === 'ready') {
      if (repeat) reason = 'duplicate';
      else if (confidence === 'low') reason = 'low-confidence';
    }
    // An ID number is never ticked from the field name alone.
    if (reason === 'ready' && match.token === 'national-id' && match.from === 'name') {
      reason = 'low-confidence';
    }
    if (reason === 'ready') seenTokens.add(match.token);
    rows.push({
      stop,
      token: match.token,
      value,
      current,
      confidence,
      ticked: reason === 'ready',
      reason,
    });
  }
  return rows;
}
