/**
 * Targets other than pages (PRD-39, spec §2.3): sizes, degrees and direction, formats, the
 * redaction finder's patterns, languages, where a page moves to, how a document splits, and the
 * text of a watermark. Each reader takes the tokens a clause has left and returns what it found
 * with the tokens still unread, or null when the clause says nothing about it.
 */
import type { PatternId } from '../../redaction/patterns';
import type { Step, Unavailable } from './types';
import { full, is, isNoun } from './turkish';
import type { Tok } from './tokenise';

type Rest = readonly Tok[];
export interface Found<T> {
  readonly value: T;
  readonly rest: Rest;
}

const without = (rest: Rest, drop: ReadonlySet<Tok>): Tok[] => rest.filter((t) => !drop.has(t));

// ---------------------------------------------------------------------------------- sizes

const COMPARATORS = new Set(
  'under below less than smaller at most max maximum upto altina altinda alti en fazla maksimum azami gecmesin kucuk az'.split(
    ' ',
  ),
);

/** A size and its comparator words ("under 2 MB", "2 MB altına"): all mean "at most". */
export function readSize(rest: Rest): Found<number> | null {
  const sizes = rest.filter((t) => t.kind === 'size');
  const size = sizes[0];
  if (!size || sizes.length > 1) return null;
  const drop = new Set<Tok>([
    size,
    ...rest.filter((t) => t.kind === 'word' && COMPARATORS.has(t.text)),
  ]);
  return { value: size.n, rest: without(rest, drop) };
}

// ------------------------------------------------------------------- degrees and direction

/** Reads "90 derece", "180°", and the direction words; `null` when the degrees are not a turn. */
export function readTurn(rest: Rest): Found<{ deg: number | null; dir: -1 | 0 | 1 }> | null {
  let dir: -1 | 0 | 1 = 0;
  let deg: number | null = null;
  const drop = new Set<Tok>();
  for (const t of rest) {
    if (t.kind === 'degrees') {
      if (![90, 180, 270].includes(t.n) || deg !== null) return null;
      deg = t.n;
      drop.add(t);
    } else if (t.kind === 'word') {
      const right =
        ['right', 'clockwise', 'cw', 'yonunde', 'yonune'].includes(full(t)) || isNoun(t, 'sag');
      const left =
        ['left', 'ccw', 'counterclockwise', 'anticlockwise', 'tersi', 'tersine'].includes(
          full(t),
        ) || isNoun(t, 'sol');
      if (right || left) {
        dir = right ? 1 : -1;
        drop.add(t);
      } else if (full(t) === 'saat' || full(t) === 'saatin') drop.add(t);
    }
  }
  return { value: { deg, dir }, rest: without(rest, drop) };
}

/** Quarter turns for a direction and degrees: 1 right, -1 left, 2 a half turn. */
export function turnsOf(dir: -1 | 0 | 1, deg: number | null): -1 | 1 | 2 {
  const quarters = (((((dir || 1) * (deg ?? 90)) / 90) % 4) + 4) % 4;
  return quarters === 3 ? -1 : (quarters as 1 | 2);
}

// -------------------------------------------------------------------------------- formats

export type FormatInfo =
  | { readonly kind: 'img'; readonly fmt: 'jpeg' | 'png' | 'webp'; readonly generic: boolean }
  | { readonly kind: 'txt'; readonly fmt: 'text' | 'markdown'; readonly generic: boolean }
  | { readonly kind: 'off'; readonly which: 'word' | 'excel' | 'powerpoint' }
  | { readonly kind: 'pdf' };

/** Folded stem -> format. "Generic" words (resim, text) need a verb; jpg, png, md can stand alone. */
const FORMATS: readonly (readonly [string, FormatInfo])[] = [
  ...['jpg', 'jpeg'].map((s) => [s, { kind: 'img', fmt: 'jpeg', generic: false }] as const),
  ['png', { kind: 'img', fmt: 'png', generic: false }],
  ['webp', { kind: 'img', fmt: 'webp', generic: false }],
  ...['resim', 'resm', 'gorsel', 'image', 'images', 'picture', 'pictures', 'photo', 'photos'].map(
    (s) => [s, { kind: 'img', fmt: 'jpeg', generic: true }] as const,
  ),
  ...['fotograf', 'foto'].map((s) => [s, { kind: 'img', fmt: 'jpeg', generic: true }] as const),
  ...['txt', 'md', 'markdown'].map(
    (s) => [s, { kind: 'txt', fmt: s === 'txt' ? 'text' : 'markdown', generic: false }] as const,
  ),
  ...['text', 'metin', 'metn'].map(
    (s) => [s, { kind: 'txt', fmt: 'text', generic: true }] as const,
  ),
  ...['word', 'docx', 'doc'].map((s) => [s, { kind: 'off', which: 'word' }] as const),
  ...['excel', 'xlsx', 'xls'].map((s) => [s, { kind: 'off', which: 'excel' }] as const),
  ...['powerpoint', 'pptx', 'ppt', 'sunum'].map(
    (s) => [s, { kind: 'off', which: 'powerpoint' }] as const,
  ),
  ['pdf', { kind: 'pdf' }],
  ['pdfs', { kind: 'pdf' }],
];

export function formatOf(t: Tok): FormatInfo | null {
  for (const [stem, info] of FORMATS) if (isNoun(t, stem)) return info;
  return null;
}

/** Which side of a conversion a word is on: the accusative or ablative is the source. */
export function sourceMarked(t: Tok): boolean {
  return /^(?:i|u|yi|yu|ni|nu|dan|den|tan|ten|ndan|nden|lari|leri)$/.test(t.suf);
}
export function targetMarked(t: Tok): boolean {
  return /^(?:a|e|ya|ye|na|ne)$/.test(t.suf);
}

export const OFFICE_CAPABILITY: Readonly<Record<'word' | 'excel' | 'powerpoint', Unavailable>> = {
  word: 'pdf-to-word',
  excel: 'pdf-to-excel',
  powerpoint: 'pdf-to-powerpoint',
};

// ---------------------------------------------------------------------- redaction patterns

const ALL_BUT_DATE: readonly PatternId[] = ['email', 'iban', 'card', 'tckn', 'phone'];
const PATTERN_ORDER: readonly PatternId[] = [...ALL_BUT_DATE, 'date'];
const PATTERN_WORDS: readonly (readonly [string, readonly PatternId[]])[] = [
  ...['iban', 'ibans'].map((w) => [w, ['iban']] as const),
  ...['email', 'emails', 'e-mail', 'e-mails', 'mail', 'mails', 'e-posta', 'eposta'].map(
    (w) => [w, ['email']] as const,
  ),
  ...['phone', 'phones', 'telephone', 'telefon', 'tel', 'gsm'].map((w) => [w, ['phone']] as const),
  ...['tckn', 'tc kimlik', 'kimlik no', 'tc no', 'tc numara', 'kimlik'].map(
    (w) => [w, ['tckn']] as const,
  ),
  ...['card', 'cards', 'kart', 'kredi kart', 'credit card', 'credit cards'].map(
    (w) => [w, ['card']] as const,
  ),
  ...['date', 'dates', 'tarih'].map((w) => [w, ['date']] as const),
  ...['personal', 'sensitive', 'pii', 'kisisel', 'hassas'].map((w) => [w, ALL_BUT_DATE] as const),
];

/** Pattern names ("IBAN'ları", "tc kimlik", "kişisel"): the ids in finder order. */
export function readPatterns(rest: Rest): Found<readonly PatternId[]> | null {
  const ids = new Set<PatternId>();
  const drop = new Set<Tok>();
  for (let i = 0; i < rest.length; i++) {
    for (const [phrase, found] of PATTERN_WORDS) {
      const parts = phrase.split(' ');
      const at = rest.slice(i, i + parts.length);
      if (
        at.length === parts.length &&
        parts.every((p, k) =>
          k < parts.length - 1 ? is(at[k] as Tok, p) : isNoun(at[k] as Tok, p),
        )
      ) {
        for (const id of found) ids.add(id);
        for (const t of at) drop.add(t);
        i += parts.length - 1;
        break;
      }
    }
  }
  if (ids.size === 0) return null;
  return { value: PATTERN_ORDER.filter((id) => ids.has(id)), rest: without(rest, drop) };
}

// ----------------------------------------------------------------------------- languages

const LANGUAGES =
  'turkce turkish ingilizce english almanca german fransizca french ispanyolca spanish rusca russian arapca arabic'.split(
    ' ',
  );
export function readLanguage(rest: Rest): Found<string> | null {
  const t = rest.find((x) => LANGUAGES.some((l) => isNoun(x, l)));
  return t ? { value: t.text, rest: rest.filter((x) => x !== t) } : null;
}

// ------------------------------------------------------------------------------- move

type MoveTo = Extract<Step, { action: 'move' }>['to'];
const BEFORE = ['before', 'onune', 'onunde', 'oncesine', 'oncesinde'];
const AFTER = ['after', 'arkasina', 'arkasinda', 'sonrasina', 'sonrasinda'];
const START = ['start', 'beginning', 'top', 'front', 'basa', 'basina'];
const END = ['end', 'bottom', 'back', 'sona', 'sonuna'];
const isPageWord = (t: Tok): boolean =>
  t.kind === 'word' && /^(?:page|pages|pg|p$|sayfa)/.test(t.text);

/** "before 2", "2'nin önüne", "after page 4", "to the end", "başa": where pages go. */
export function readRelation(rest: Rest): Found<MoveTo> | null {
  for (const [i, t] of rest.entries()) {
    const before = BEFORE.includes(full(t));
    if (before || AFTER.includes(full(t))) {
      // English puts the page after the word ("before 2"), Turkish before it ("2'nin önüne").
      const forward = rest.slice(i + 1).find((x) => !isPageWord(x));
      const back = rest
        .slice(0, i)
        .reverse()
        .find((x) => !isPageWord(x));
      const target = forward?.kind === 'number' ? forward : back?.kind === 'number' ? back : null;
      if (!target) return null;
      const to: MoveTo = before ? { before: target.n } : { after: target.n };
      return { value: to, rest: rest.filter((x) => x !== t && x !== target) };
    }
    if (START.includes(full(t)) || END.includes(full(t))) {
      const drop = new Set<Tok>([t]);
      const prev = rest[i - 1];
      if (prev && is(prev, 'en')) drop.add(prev);
      return { value: START.includes(full(t)) ? 'start' : 'end', rest: without(rest, drop) };
    }
  }
  return null;
}

// ------------------------------------------------------------------------------- split

type SplitHow = Extract<Step, { action: 'split' }>['how'];
export interface SplitRead {
  readonly how: SplitHow;
  readonly weight: number;
  readonly rest: Rest;
}

/**
 * How a split is asked for: "every 10", "her 10 sayfada", "10 sayfada bir", "at 10", "10.
 * sayfadan", "into 3 parts", "3 parçaya". A bare number is the one known two-way case
 * ("böl 10": every 10, or a new part at 10), so it gives two reads.
 */
export function readSplit(rest: Rest): SplitRead[] | null {
  const numbers = rest.filter((t) => t.kind === 'number');
  const n = numbers[0];
  if (!n || numbers.length > 1) return null;
  const pageish = (t: Tok): boolean => isPageWord(t);
  const every = rest.filter((t) => is(t, 'every', 'each', 'her'));
  const bir = rest.filter((t) => is(t, 'bir'));
  const at = rest.filter((t) => is(t, 'at'));
  const parts = rest.filter(
    (t) =>
      is(t, 'into') ||
      ['part', 'parts', 'piece', 'pieces', 'documents', 'files'].includes(t.text) ||
      isNoun(t, 'parca') ||
      isNoun(t, 'belge'),
  );
  const ablative = n.ord && rest.some((t) => pageish(t) && /(?:dan|den)$/.test(t.text + t.suf));
  const read = (how: SplitHow, weight: number, used: Tok[]): SplitRead => ({
    how,
    weight,
    rest: rest.filter((t) => t !== n && !used.includes(t) && !pageish(t)),
  });
  if (every.length > 0 || (bir.length > 0 && rest.some(pageish))) {
    return [read({ every: n.n }, 1, [...every, ...bir])];
  }
  if (at.length > 0 || ablative) return [read({ at: [n.n] }, 1, at)];
  if (parts.length > 0) return [read({ parts: n.n }, 1, parts)];
  return [read({ every: n.n }, 1, []), read({ at: [n.n] }, 0.8, [])];
}

/** The pages of each part a split makes, as [first, last] pairs (1-based). Empty when it cannot. */
export function splitParts(pageCount: number, how: SplitHow): [number, number][] {
  if (how === 'choose' || pageCount < 1) return [];
  let starts: number[] = [];
  if ('every' in how) {
    if (how.every < 1) return [];
    for (let s = 1; s <= pageCount; s += how.every) starts.push(s);
  } else if ('at' in how) {
    starts = [1, ...how.at.filter((p) => p > 1 && p <= pageCount)];
  } else {
    if (how.parts < 1 || how.parts > pageCount) return [];
    for (let k = 0; k < how.parts; k++) starts.push(1 + Math.floor((k * pageCount) / how.parts));
  }
  starts = [...new Set(starts)].sort((a, b) => a - b);
  return starts.map((s, k) => [s, (starts[k + 1] ?? pageCount + 1) - 1]);
}

/** Stems of the format and pattern words, for the lexicon's list of known words. */
export const TARGET_VOCAB: readonly string[] = [
  ...FORMATS.map(([stem]) => stem),
  ...PATTERN_WORDS.flatMap(([phrase]) => phrase.split(' ')),
  ...LANGUAGES,
];
