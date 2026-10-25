/**
 * The browser's own autofill for PDF text fields (PRD-32, IM-2). A field's tooltip or name,
 * English or Turkish, maps to an HTML autocomplete token; anything else stays `off`. The
 * browser keeps what it suggests: Recto stores and sends nothing (PRD-32, the privacy gate).
 */
import type { FormField } from '@pdf-editor/engine';

/** Ordered: the first rule with a phrase in the text wins, so specific rules come first. */
const RULES: readonly (readonly [token: string, phrases: readonly string[]])[] = [
  ['bday', ['date of birth', 'birth date', 'birthday', 'dob', 'dogum tarihi', 'dogum']],
  ['postal-code', ['postal code', 'post code', 'postcode', 'zip', 'zip code', 'posta kodu']],
  ['email', ['email', 'e mail', 'eposta', 'e posta']],
  ['tel', ['phone', 'telephone', 'mobile', 'tel', 'telefon', 'gsm', 'cep']],
  [
    'organization',
    ['organization', 'organisation', 'company', 'employer', 'kurum', 'sirket', 'firma'],
  ],
  ['country-name', ['country', 'ulke']],
  ['address-level2', ['city', 'town', 'sehir', 'il']],
  ['street-address', ['street address', 'street', 'address', 'adres']],
  ['name', ['full name', 'ad soyad', 'adi soyadi', 'isim']],
  ['family-name', ['family name', 'last name', 'surname', 'soyad', 'soyadi']],
  ['given-name', ['given name', 'first name', 'forename', 'ad', 'adi']],
  ['name', ['your name', 'name']],
];

/** Lower case (Turkish rules), accents folded, words split at case changes and punctuation. */
function normalise(text: string): string {
  const split = text.replace(/([a-z])([A-Z])/g, '$1 $2');
  const folded = split
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return ` ${folded.replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

function tokenFor(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  const words = normalise(text);
  return RULES.find(([, phrases]) => phrases.some((p) => words.includes(` ${p} `)))?.[0];
}

/** The autocomplete token for a text field: its tooltip decides first, then its name. */
export function autofillToken(field: Pick<FormField, 'name' | 'tooltip' | 'password'>): string {
  if (field.password) return 'off';
  return tokenFor(field.tooltip) ?? tokenFor(field.name) ?? 'off';
}
