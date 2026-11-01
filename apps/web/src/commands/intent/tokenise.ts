/**
 * Step 2 (PRD-39, spec §2.2): the folded text as tokens with a kind. A decimal size (`1,5 MB`) is
 * read before a comma can become a list separator; a range (`3-5`, `3 to 5`, `3'ten 5'e`) is one
 * token; a word keeps an apostrophe suffix apart (`pdf'i` is `pdf` + `i`).
 */
import { normalise } from './normalise';

export type TokKind =
  | 'number'
  | 'range'
  | 'size'
  | 'degrees'
  | 'quoted'
  | 'decimal'
  | 'conj'
  | 'word';

export interface Tok {
  readonly kind: TokKind;
  /** Folded text; a word's base without its apostrophe suffix; a quote's folded inner text. */
  readonly text: string;
  /** Folded suffix after an apostrophe (or the case ending of a number); '' when none. */
  readonly suf: string;
  readonly start: number;
  readonly end: number;
  /** A number, the start of a range, bytes of a size, degrees. */
  readonly n: number;
  /** The end of a range. */
  readonly m: number;
  /** An ordinal number (`3.`, `3'üncü`). */
  readonly ord: boolean;
  /** The original text: a quote's inner text with its case; otherwise the typed slice. */
  readonly raw: string;
}

const RULES: readonly (readonly [string, RegExp])[] = [
  ['dq', /"([^"]*)"/y],
  ['sq', /'([^']+)'(?![\p{L}\p{N}])/uy],
  [
    'size',
    /(\d+(?:[.,]\d+)?)(\s*)(kilobayt|kilobyte|megabayt|megabyte|gigabayt|gigabyte|kb|mb|gb|b|k|m)(?![\p{L}\p{N}])(?:'(\p{L}+))?/uy,
  ],
  ['deg', /(\d+)\s*(?:°|derece\p{L}*|degrees?(?!\p{L})|deg(?!\p{L}))(?:'(\p{L}+))?/uy],
  ['range1', /(\d+)\s*(?:-|\.\.+|…)\s*(\d+)(?:\.(?!\d))?/y],
  ['range2', /(\d+)\s+(?:to|through|thru|until|ile|ila)\s+(\d+)/y],
  ['range3', /(\d+)'?(?:ten|tan|den|dan)\s+(\d+)'?(?:e|a|ye|ya)(?!\p{L})(?:\s+kadar(?!\p{L}))?/uy],
  ['decimal', /\d+\.\d+/y],
  [
    'num',
    /(\d+)(?:'(\p{L}+)|(ten|tan|den|dan|ye|ya|nin|nun|st|nd|rd|th)(?!\p{L})|([eaiu])(?=\s+git(?!\p{L})))?(\.(?!\d))?(?![\p{L}\p{N}])/uy,
  ],
  ['pw', /(?:pg|page|sayfa|p)(?=\d)/y],
  ['conj', /[,;&+]/y],
  ['word', /([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)(?:'(\p{L}+))?/uy],
];
/** Every unit starts with its power of 1024: b, kilo…, mega…, giga… */
const POWER = 'bkmg';
const CONJ_WORDS = new Set(['and', 've', 'then', 'sonra', 'ardindan']);
const ORDINAL_SUFFIX = /^(?:inci|nci|uncu|ncu|st|nd|rd|th)/;

/** Tokens of a typed text, in order. Punctuation that carries no meaning is skipped. */
export function tokenise(text: string): { tokens: Tok[]; original: string } {
  const { original, folded } = normalise(text);
  const tokens: Tok[] = [];
  const push = (
    kind: TokKind,
    start: number,
    end: number,
    t: string,
    f: Partial<Pick<Tok, 'suf' | 'n' | 'm' | 'ord' | 'raw'>> = {},
  ): void => {
    tokens.push({
      kind,
      text: t,
      suf: f.suf ?? '',
      start,
      end,
      n: f.n ?? 0,
      m: f.m ?? 0,
      ord: f.ord ?? false,
      raw: f.raw ?? original.slice(start, end),
    });
  };
  let i = 0;
  scan: while (i < folded.length) {
    const char = folded.charAt(i);
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === '<') {
      push('word', i, i + 1, 'under');
      i += folded.charAt(i + 1) === '=' ? 2 : 1;
      continue;
    }
    for (const [rule, re] of RULES) {
      if (rule === 'sq' && i > 0 && /[\p{L}\p{N}]/u.test(folded.charAt(i - 1))) continue;
      re.lastIndex = i;
      const m = re.exec(folded);
      if (!m) continue;
      const end = i + m[0].length;
      const num = (s: string | undefined): number => Number((s ?? '0').replace(',', '.'));
      if (rule === 'dq' || rule === 'sq') {
        push('quoted', i, end, m[1] ?? '', { raw: original.slice(i + 1, end - 1) });
      } else if (rule === 'size') {
        const unit = m[3] ?? '';
        if ((unit === 'b' || unit === 'k' || unit === 'm') && (m[2] ?? '') !== '') continue;
        push('size', i, end, m[0], {
          n: Math.round(num(m[1]) * 1024 ** POWER.indexOf(unit.charAt(0))),
          suf: m[4] ?? '',
        });
      } else if (rule === 'deg') {
        push('degrees', i, end, m[0], { n: Number(m[1]), suf: m[2] ?? '' });
      } else if (rule.startsWith('range')) {
        push('range', i, end, m[0], { n: Number(m[1]), m: Number(m[2]) });
      } else if (rule === 'decimal') {
        push('decimal', i, end, m[0], { n: num(m[0]) });
      } else if (rule === 'num') {
        const suf = m[2] ?? m[3] ?? m[4] ?? '';
        push('number', i, end, m[1] ?? '', {
          n: Number(m[1]),
          suf,
          ord: m[5] !== undefined || ORDINAL_SUFFIX.test(suf),
        });
      } else if (rule === 'pw') {
        push('word', i, end, m[0]);
      } else if (rule === 'conj') {
        push('conj', i, end, m[0]);
      } else {
        const word = m[1] ?? '';
        push(CONJ_WORDS.has(word) && !m[2] ? 'conj' : 'word', i, end, word, { suf: m[2] ?? '' });
      }
      i = end;
      continue scan;
    }
    i++;
  }
  return { tokens, original };
}
