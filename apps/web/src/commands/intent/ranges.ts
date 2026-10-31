/**
 * Page expressions (PRD-39, spec §2.3; PRD-23 for the forms that were there): numbers, ranges,
 * lists, ordinals, number words, edges, parity, "all", "this page", the selection, an open end
 * ("5 to end"), an exception ("all except 3") and a pronoun for the previous clause's pages.
 * A word that is not one of these is handed back, so the clause is not read ("every word is
 * understood").
 */
import { FILLERS } from './lexicon';
import type { Tok } from './tokenise';
import { full, is, isNoun } from './turkish';
import type { IntentContext, Pages, Problem } from './types';

export interface PageProblem {
  readonly kind: Problem;
  readonly page?: number;
}
export type PageRead =
  | {
      readonly kind: 'ok';
      readonly pages: readonly number[];
      readonly named: Pages['named'];
      /** False when only page words were there ("delete pages"): the action's default applies. */
      readonly explicit: boolean;
      readonly problem: PageProblem | null;
    }
  | { readonly kind: 'pronoun' }
  | { readonly kind: 'unknown'; readonly toks: readonly Tok[] };

const noun = (t: Tok, ...stems: string[]): boolean => stems.some((s) => isNoun(t, s));

export const isPageWord = (t: Tok): boolean =>
  is(t, 'page', 'pages', 'pg', 'pgs', 'p') || noun(t, 'sayfa');
const isPlural = (t: Tok): boolean =>
  is(t, 'pages', 'pgs') || (noun(t, 'sayfa') && /^sayfa(?:lar|ler)/.test(full(t)));
/** Words of a document that follow "all" ("whole document", "tüm belge"). */
const isDocumentWord = (t: Tok): boolean =>
  is(t, 'document', 'documents', 'file', 'files', 'pdf') || noun(t, 'belge', 'dosya');

const ORDINALS =
  'first second third fourth fifth sixth seventh eighth ninth tenth birinci ikinci ucuncu dorduncu besinci altinci yedinci sekizinci dokuzuncu onuncu'.split(
    ' ',
  );
const NUMBER_WORDS =
  'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(
    ' ',
  );
const NUMBER_WORDS_TR = 'bir iki uc dort bes alti yedi sekiz dokuz on yirmi'.split(' ');
const numberWord = (t: Tok): number => {
  if (t.kind !== 'word') return 0;
  const en = NUMBER_WORDS.indexOf(full(t));
  if (en >= 0) return en + 1;
  const tr = NUMBER_WORDS_TR.indexOf(full(t));
  return tr < 0 ? 0 : tr === 10 ? 20 : tr + 1;
};
const FIRST = ['first', 'ilk'];
const LAST = ['last', 'son'];
const EXCEPT_EN = ['except', 'but', 'excluding', 'besides'];
const exceptTr = (t: Tok): boolean => noun(t, 'haric') || full(t).startsWith('disinda');
const PRONOUNS = ['it', 'them', 'onu', 'onlari', 'bunu', 'bunlari'];

/** Words that, in a page expression, say "and everything after". */
const openEnd = (t: Tok | undefined): boolean =>
  !!t &&
  (is(t, 'onwards', 'itibaren', 'sona', 'sonuna') ||
    (noun(t, 'sonra') && full(t).startsWith('sonrasi')));

/** Words this module reads as page expressions: the lexicon adds them to what it knows. */
export const PAGE_VOCAB: readonly string[] = [
  ...[
    'page',
    'pages',
    'pg',
    'pgs',
    'p',
    'sayfa',
    'all',
    'every',
    'everything',
    'whole',
    'entire',
    'tum',
    'tumu',
    'butun',
    'hepsi',
    'her',
  ],
  ...[
    'even',
    'odd',
    'cift',
    'tek',
    'this',
    'current',
    'bu',
    'mevcut',
    'suanki',
    'selected',
    'these',
    'selection',
    'secili',
    'sectik',
  ],
  ...[
    'first',
    'last',
    'ilk',
    'son',
    'end',
    'onwards',
    'itibaren',
    'sona',
    'sonrasi',
    'haric',
    'disinda',
    ...EXCEPT_EN,
    ...PRONOUNS,
  ],
  ...ORDINALS,
  ...NUMBER_WORDS,
  ...NUMBER_WORDS_TR,
  'document',
  'belge',
];

/** Reads the page tokens of a clause against the document as it is. */
export function readPages(toks: readonly Tok[], ctx: IntentContext): PageRead {
  const count = ctx.pageCount;
  const selection = [...new Set(ctx.selectedPages)].sort((a, b) => a - b);
  const hasPageWord = toks.some(isPageWord);
  const plural = toks.some(isPlural);

  // An exception splits the expression: "all except 3", "3 hariç" (Turkish puts it after).
  const en = toks.findIndex((t) => t.kind === 'word' && EXCEPT_EN.includes(full(t)));
  const tr = toks.findIndex((t) => t.kind === 'word' && exceptTr(t));
  if (en >= 0 || tr >= 0) {
    const at = en >= 0 ? en : tr;
    const [excl, base] =
      en >= 0 ? [toks.slice(at + 1), toks.slice(0, at)] : [toks.slice(0, at), toks.slice(at + 1)];
    const baseRead = base.some((t) => !skippable(t) && t.kind !== 'conj') ? items(base) : null;
    const exclRead = items(excl);
    if (exclRead.unknown.length > 0 || (baseRead && baseRead.unknown.length > 0)) {
      return { kind: 'unknown', toks: [...exclRead.unknown, ...(baseRead?.unknown ?? [])] };
    }
    const problem = baseRead?.problem ?? exclRead.problem;
    const baseSet = baseRead ? baseRead.set : new Set(range1(count));
    const pages = [...baseSet].filter((p) => !exclRead.set.has(p)).sort((a, b) => a - b);
    return done(pages, 'except', problem, count);
  }
  const r = items(toks);
  if (r.unknown.length > 0) return { kind: 'unknown', toks: r.unknown };
  if (r.pronoun)
    return r.set.size === 0 && !r.explicit ? { kind: 'pronoun' } : { kind: 'unknown', toks: [] };
  if (!r.explicit) return { kind: 'ok', pages: [], named: 'list', explicit: false, problem: null };
  return done(
    [...r.set].sort((a, b) => a - b),
    r.named,
    r.problem,
    count,
  );

  function skippable(t: Tok): boolean {
    return (t.kind === 'word' && FILLERS.has(full(t))) || isPageWord(t) || t.kind === 'conj';
  }

  function items(list: readonly Tok[]): {
    set: Set<number>;
    named: Pages['named'];
    explicit: boolean;
    pronoun: boolean;
    problem: PageProblem | null;
    unknown: Tok[];
  } {
    const set = new Set<number>();
    const named = new Set<Pages['named']>();
    const unknown: Tok[] = [];
    let problem: PageProblem | null = null;
    let pronoun = false;
    let explicit = false;
    const add = (from: number, to: number, how: Pages['named']): void => {
      explicit = true;
      named.add(how);
      if (problem) return;
      if (count < 1) problem = { kind: 'no-document', page: from };
      else if (from > to) problem = { kind: 'reversed-range', page: from };
      else if (from < 1) problem = { kind: 'out-of-range', page: from };
      else if (to > count) problem = { kind: 'out-of-range', page: to };
      else for (let n = from; n <= to; n++) set.add(n);
    };
    const addAll = (pages: readonly number[], how: Pages['named']): void => {
      explicit = true;
      named.add(how);
      for (const p of pages) set.add(p);
    };
    for (let i = 0; i < list.length; i++) {
      const t = list[i] as Tok;
      const next = list[i + 1];
      if (t.kind === 'conj' || isPageWord(t) || (t.kind === 'word' && FILLERS.has(full(t)))) {
        // "from 5 on": an open end that the filler words would otherwise hide.
        if (
          is(t, 'on') &&
          list[i - 2] &&
          is(list[i - 2], 'from') &&
          list[i - 1]?.kind === 'number'
        ) {
          const n = (list[i - 1] as Tok).n;
          if (set.has(n)) {
            for (let p = n; p <= count; p++) set.add(p);
            named.add('edge');
          }
        }
        continue;
      }
      if (t.kind === 'range') add(t.n, t.m, 'list');
      else if (t.kind === 'number') {
        let j = i + 1;
        while (list[j] && isPageWord(list[j] as Tok)) j++;
        const after = list[j];
        const toEnd = (is(after, 'to', 'until') && is(list[j + 1], 'end')) || openEnd(after);
        if (toEnd) {
          add(t.n, count, 'edge');
          i = is(after, 'to', 'until') ? j + 1 : j;
        } else if (is(next, 'pages') && !t.ord && t.suf === '') {
          explicit = true;
          problem ??= { kind: 'ambiguous-count' };
        } else add(t.n, t.n, 'list');
      } else if (t.kind === 'word' && (FIRST.includes(full(t)) || LAST.includes(full(t)))) {
        let n = 1;
        let j = i + 1;
        while (list[j] && isPageWord(list[j] as Tok)) j++;
        const arg = list[j];
        if (arg?.kind === 'number' && !arg.ord) {
          n = arg.n;
          i = j;
        } else if (arg && numberWord(arg) && !is(arg, 'bir', 'one')) {
          n = numberWord(arg);
          i = j;
        }
        const first = FIRST.includes(full(t));
        if (n < 1 || n > count) add(n, n, 'edge');
        else if (first) add(1, n, 'edge');
        else add(count - n + 1, count, 'edge');
      } else if (t.kind === 'word' && ORDINALS.some((o) => o !== 'first' && isNoun(t, o))) {
        const n = (ORDINALS.findIndex((o) => isNoun(t, o)) % 10) + 1;
        add(n, n, 'list');
      } else if (
        t.kind === 'word' &&
        numberWord(t) &&
        (!is(t, 'bir', 'one', 'on') || hasPageWord)
      ) {
        add(numberWord(t), numberWord(t), 'list');
      } else if (
        t.kind === 'word' &&
        (is(t, 'all', 'every', 'everything', 'whole', 'entire') ||
          noun(t, 'tum', 'tumu', 'butun', 'hepsi', 'her'))
      ) {
        if (count < 1) problem ??= { kind: 'no-document' };
        addAll(range1(count), 'all');
        while (
          list[i + 1] &&
          (isPageWord(list[i + 1] as Tok) || isDocumentWord(list[i + 1] as Tok))
        )
          i++;
      } else if (t.kind === 'word' && (is(t, 'even') || noun(t, 'cift'))) {
        addAll(
          range1(count).filter((p) => p % 2 === 0),
          'even',
        );
        if (count < 1) problem ??= { kind: 'no-document' };
        else if (count < 2) problem ??= { kind: 'no-pages' };
      } else if (t.kind === 'word' && (is(t, 'odd') || noun(t, 'tek'))) {
        addAll(
          range1(count).filter((p) => p % 2 === 1),
          'odd',
        );
        if (count < 1) problem ??= { kind: 'no-document' };
      } else if (
        t.kind === 'word' &&
        (is(t, 'this', 'current', 'bu', 'mevcut') || noun(t, 'suanki'))
      ) {
        if (!hasPageWord) unknown.push(t);
        else if (plural && is(t, 'this', 'bu')) addAll(selection, 'selection');
        else if (ctx.currentPage === undefined || count < 1) {
          explicit = true;
          problem ??= { kind: count < 1 ? 'no-document' : 'no-pages' };
        } else addAll([ctx.currentPage], 'current');
      } else if (
        t.kind === 'word' &&
        (is(t, 'selected', 'these', 'selection') || noun(t, 'secili', 'sectik'))
      ) {
        addAll(selection, 'selection');
        if (selection.length === 0) problem ??= { kind: 'no-pages' };
      } else if (t.kind === 'word' && PRONOUNS.includes(full(t))) {
        pronoun = true;
      } else unknown.push(t);
    }
    const names = [...named];
    return {
      set,
      named: names.length === 1 ? (names[0] as Pages['named']) : 'list',
      explicit,
      pronoun,
      problem,
      unknown,
    };
  }
}

const range1 = (count: number): number[] =>
  Array.from({ length: Math.max(0, count) }, (_, i) => i + 1);

function done(
  pages: number[],
  named: Pages['named'],
  problem: PageProblem | null,
  count: number,
): PageRead {
  const p = problem ?? (pages.length === 0 && count > 0 ? { kind: 'no-pages' as const } : null);
  return { kind: 'ok', pages, named, explicit: true, problem: p };
}
