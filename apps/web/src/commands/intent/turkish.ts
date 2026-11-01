/**
 * Turkish word forms (PRD-39, spec §2.4). There is no general stemmer: a token matches a lexicon
 * stem only when the rest of the token is an allowed suffix chain for the stem's class. Folding
 * (`foldForSearch`) already removes the ı/i, ü/u, ö/o differences, so vowel harmony collapses to
 * `a/e` and `i/u` and the tables below stay small.
 */
import type { Tok } from './tokenise';

const PLURAL = ['', 'lar', 'ler'];
const POSSESSIVE = ['', 'i', 'u', 'si', 'su', 'm', 'im', 'um', 'miz', 'imiz', 'umuz', 'niz'];
const CASE = [
  '',
  ...['i', 'u', 'yi', 'yu', 'ni', 'nu', 'a', 'e', 'ya', 'ye', 'na', 'ne', 'da', 'de', 'ta', 'te'],
  ...['nda', 'nde', 'dan', 'den', 'tan', 'ten', 'ndan', 'nden', 'in', 'un', 'nin', 'nun'],
  ...['la', 'le', 'yla', 'yle'],
];

/** Every noun ending: plural, then possessive, then case, each optional (a few hundred strings). */
export const NOUN_CHAINS: ReadonlySet<string> = new Set(
  PLURAL.flatMap((p) => POSSESSIVE.flatMap((s) => CASE.map((c) => p + s + c))),
);

export type VerbForm = 'imp' | 'nom' | 'aor';
const VERB_ENDINGS: Readonly<Record<VerbForm, readonly string[]>> = {
  // bare, plural/polite, "let's"
  imp: ['', 'in', 'un', 'iniz', 'unuz', 'yin', 'yun', 'yiniz', 'yunuz', 'elim', 'alim'],
  // infinitive and nominal ("döndürmek istiyorum", "silmeyi")
  nom: ['mek', 'mak', 'meyi', 'mayi', 'mesi', 'masi'],
  // aorist: only with a question particle after it ("döndürür müsün", "silebilir misin")
  aor: ['ir', 'ur', 'ar', 'er', 'abilir', 'ebilir', 'yabilir', 'yebilir'],
};
const VERB_FORM = new Map<string, VerbForm>(
  (Object.keys(VERB_ENDINGS) as VerbForm[]).flatMap((f) =>
    VERB_ENDINGS[f].map((e) => [e, f] as const),
  ),
);

/** Is `rest` a noun chain or a verb ending: what may follow a stem of the lexicon. */
export const isKnownEnding = (rest: string): boolean =>
  NOUN_CHAINS.has(rest) || VERB_FORM.has(rest);

/** Question particles: fillers only right after a verb. */
export const PARTICLES: ReadonlySet<string> = new Set([
  'mi',
  'mu',
  'misin',
  'musun',
  'misiniz',
  'musunuz',
]);

/** What a verb stem matched as: its form, or a negation. */
export interface VerbMatch {
  readonly form: VerbForm;
  /** `silme`, `silmeyin`, `silmeden`: a negated verb never acts. */
  readonly negated: boolean;
}

/** The token as typed, folded, apostrophe suffix included. */
export const full = (tok: Tok): string => tok.text + tok.suf;
/** Is `tok` a plain word that is one of `words`? */
export const is = (tok: Tok | undefined, ...words: string[]): boolean =>
  tok?.kind === 'word' && words.includes(full(tok));

/** Is `tok` the noun `stem` with an allowed chain? */
export function isNoun(tok: Tok, stem: string): boolean {
  if (tok.kind !== 'word') return false;
  const f = full(tok);
  return f.startsWith(stem) && NOUN_CHAINS.has(f.slice(stem.length));
}

/** Is `tok` the verb `stem` in an accepted form, or negated? */
export function verbOf(tok: Tok, stem: string): VerbMatch | null {
  if (tok.kind !== 'word') return null;
  const f = full(tok);
  if (!f.startsWith(stem)) return null;
  const rest = f.slice(stem.length);
  const form = VERB_FORM.get(rest);
  if (form) return { form, negated: false };
  // `ma`/`me` right after the stem and not an infinitive: a negation (or the noun "deletion").
  return /^m[ae]/.test(rest) ? { form: 'imp', negated: true } : null;
}

/** `sayfadaki`, `3'teki`, `belgedeki`: "the thing on page N", never the page itself. */
export function isLocativeAdjective(tok: Tok): boolean {
  const ending = tok.kind === 'word' ? full(tok) : tok.kind === 'number' ? tok.suf : '';
  // "1-2 dışındaki" (all but): the one -ki word that is not about a place.
  return /(?:da|de|ta|te)ki$/.test(ending) && !ending.startsWith('disinda');
}

/** English and Turkish negators: a sentence holding one never acts. */
export function isNegator(tok: Tok): boolean {
  if (tok.kind !== 'word') return false;
  const f = full(tok);
  return (
    ['not', 'never', 'dont', 'cant', 'wont', 'without', 'nor', 'neither'].includes(f) ||
    (tok.suf === 't' && ['don', 'doesn', 'didn', 'can', 'won'].includes(tok.text))
  );
}

/** One edit apart (substitution, insertion, deletion or swap of neighbours). */
export function oneStepApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const [ra, rb] = [a.slice(i + 1), b.slice(i + 1)];
  return (
    ra === rb || // substitution
    a.slice(i + 1) === b.slice(i) || // deletion from a
    a.slice(i) === b.slice(i + 1) || // insertion into a
    (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) // swap
  );
}
