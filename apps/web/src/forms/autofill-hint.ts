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

function tokenFor(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const words = normalise(text);
  if (ELSEWHERE.some((w) => words.includes(` ${w} `))) return 'off';
  return RULES.find(([, phrases]) => phrases.some((p) => words.includes(` ${p} `)))?.[0];
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
