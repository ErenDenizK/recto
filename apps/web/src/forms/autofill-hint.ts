/**
 * The browser's own autofill for PDF text fields (PRD-32, IM-2). A field's tooltip or name,
 * English or Turkish, maps to an HTML autocomplete token; anything else stays `off`. The
 * browser keeps what it suggests: Recto stores and sends nothing (PRD-32, the privacy gate).
 */
import type { FormField } from '@pdf-editor/engine';

/**
 * Words that say the field is about someone or something else (a child, a parent, a bank, a
 * user name, a file name): the field stays `off` whatever else it says.
 */
const ELSEWHERE = [
  'child',
  'children',
  'kid',
  'father',
  'mother',
  'parent',
  'spouse',
  'wife',
  'husband',
  'partner',
  'emergency',
  'user name',
  'username',
  'file',
  'bank',
  'cocuk',
  'baba',
  'anne',
  'es',
  'acil',
  'kullanici adi',
  'dosya',
  'banka',
];

/** Ordered: the first rule with a phrase in the text wins, so specific rules come first. */
const RULES: readonly (readonly [token: string, phrases: readonly string[]])[] = [
  ['bday', ['date of birth', 'birth date', 'birthday', 'dob', 'dogum tarihi']],
  ['postal-code', ['postal code', 'post code', 'postcode', 'zip', 'zip code', 'posta kodu']],
  ['email', ['email', 'e mail', 'eposta', 'e posta', 'epostasi', 'e postasi']],
  [
    'tel',
    ['phone', 'telephone', 'mobile', 'tel', 'telefon', 'telefonu', 'telefonunuz', 'gsm', 'cep'],
  ],
  ['country-name', ['country', 'ulke']],
  ['address-level1', ['il']],
  ['address-level2', ['city', 'town', 'sehir', 'ilce']],
  ['address-line2', ['address line 2', 'address 2', 'adres 2', 'adres satiri 2']],
  ['street-address', ['street address', 'street', 'address', 'adres', 'adresi', 'adresiniz']],
  [
    'organization',
    ['organization', 'organisation', 'company', 'employer', 'kurum', 'sirket', 'firma'],
  ],
  [
    'name',
    [
      'full name',
      'first and last name',
      'name and surname',
      'ad soyad',
      'adi soyadi',
      'ad ve soyad',
      'adi ve soyadi',
      'adiniz soyadiniz',
      'isim',
    ],
  ],
  ['family-name', ['family name', 'last name', 'surname', 'soyad', 'soyadi', 'soyadiniz']],
  ['given-name', ['given name', 'first name', 'forename', 'ad', 'adi']],
  ['name', ['your name', 'name', 'adiniz']],
];

/** Lower case (Turkish rules), accents folded, words split at case changes and punctuation. */
function normalise(text: string): string {
  const split = text.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  const folded = split
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return ` ${folded.replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

interface Hit {
  readonly token: string;
  readonly phrase: string;
  /** The whole label is the phrase (nothing else in it). */
  readonly exact: boolean;
}

type Rules = readonly (readonly [token: string, phrases: readonly string[]])[];

/** The first rule with a phrase in the text, and its longest phrase there. `else` = ELSEWHERE. */
function scan(text: string | undefined, rules: Rules = RULES): Hit | 'else' | undefined {
  if (text === undefined) return undefined;
  const words = normalise(text);
  if (ELSEWHERE.some((w) => words.includes(` ${w} `))) return 'else';
  for (const [token, phrases] of rules) {
    const found = phrases.filter((p) => words.includes(` ${p} `));
    const phrase = found.reduce((a, b) => (b.length > a.length ? b : a), '');
    if (phrase !== '') return { token, phrase, exact: words.trim() === phrase };
  }
  return undefined;
}

function tokenFor(text: string | undefined): string | undefined {
  const hit = scan(text);
  return hit === 'else' ? 'off' : hit?.token;
}

/**
 * Tokens only My info fills (BM-4, PRD-32 amended); `autofillToken` never returns them. They
 * go before the shared rules: "company title" is a job title, not a company.
 */
const MY_INFO_RULES: Rules = [
  ['job-title', ['job title', 'title', 'unvan', 'gorev']],
  [
    'national-id',
    [
      'tc kimlik no',
      't c kimlik no',
      'tc kimlik',
      't c kimlik',
      'kimlik no',
      'tckn',
      'national id',
    ],
  ],
];

export type MatchConfidence = 'high' | 'medium' | 'low';

export interface FieldMatch {
  readonly token: string;
  readonly from: 'tooltip' | 'name';
  readonly phrase: string;
  readonly confidence: MatchConfidence;
}

/**
 * What a field asks for, for My info (BM-4): the same rules and ELSEWHERE guard as
 * `autofillToken`, plus `job-title` and `national-id`, with a confidence. High: a multi-word
 * phrase, or the whole label. Medium: one word inside a longer label, or a name match where a
 * tooltip exists. Low: a one or two letter name alone, or a three letter phrase inside a longer
 * name. A tooltip decides first, then the name; ELSEWHERE words in either, and passwords, match
 * nothing. The street token is returned as `street-address` whatever the field's lines.
 */
export function matchField(
  field: Pick<FormField, 'name'> & Partial<Pick<FormField, 'tooltip' | 'password'>>,
): FieldMatch | null {
  if (field.password) return null;
  const tip = field.tooltip?.trim() ?? '';
  const byTip = tip === '' ? undefined : scan(tip, [...MY_INFO_RULES, ...RULES]);
  const byName = scan(field.name, [...MY_INFO_RULES, ...RULES]);
  if (byTip === 'else' || byName === 'else') return null;
  const from = byTip !== undefined ? 'tooltip' : 'name';
  const hit = byTip ?? byName;
  if (hit === undefined) return null;
  let confidence: MatchConfidence = hit.exact || hit.phrase.includes(' ') ? 'high' : 'medium';
  if (from === 'name') {
    const letters = hit.phrase.length;
    if (tip !== '' && confidence === 'high') confidence = 'medium';
    if (letters <= 2 || (letters === 3 && !hit.exact)) confidence = 'low';
  }
  return { token: hit.token, from, phrase: hit.phrase, confidence };
}

/**
 * The autocomplete token for a text field: its tooltip decides first, then its name. A street
 * address is `street-address` in a multi-line field and `address-line1` in a single line. An
 * editable combo box with choices stays `off`: its choices are the field's own list.
 */
export function autofillToken(
  field: Pick<FormField, 'name'> &
    Partial<Pick<FormField, 'tooltip' | 'password' | 'multiline' | 'kind' | 'options'>>,
): string {
  if (field.password) return 'off';
  if (field.kind === 'combobox' && (field.options?.length ?? 0) > 0) return 'off';
  const token = tokenFor(field.tooltip) ?? tokenFor(field.name) ?? 'off';
  return token === 'street-address' && field.multiline !== true ? 'address-line1' : token;
}
