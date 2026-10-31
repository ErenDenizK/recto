/**
 * Page expressions (PRD-39, spec §2.3; PRD-23 for the forms that were there): numbers, ranges,
 * lists, ordinals, number words, edges, parity, "all", "this page", the selection, an open end
 * ("5 to end"), an exception ("all except 3") and a pronoun for the previous clause's pages.
 * A word that is not one of these is handed back, so the clause is not read ("every word is
 * understood"). When a form could be read two ways ("iki sayfayı sil": the page 2 or two pages;
 * "all 3"; "on iki" with nothing to say it is twelve) it is not read at all: a miss costs a
 * sentence, a wrong page costs the document.
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

/** A number word: its value, whether it is an ordinal, and how it can join the next word. */
interface Word {
  readonly n: number;
  readonly ord: boolean;
  readonly lang: 'en' | 'tr';
  /** `unit` 1-9, `teen` 10-19 (a whole word), `tens` 20-90 (takes a unit after it). */
  readonly cls: 'unit' | 'teen' | 'tens';
}
const table = (
  words: string,
  values: readonly number[],
  ord: boolean,
  lang: Word['lang'],
  cls: Word['cls'],
): [string, Word][] =>
  words.split(' ').map((w, i) => [w, { n: values[i] as number, ord, lang, cls }] as [string, Word]);
const seq = (from: number, to: number, step = 1): number[] =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const EN_WORDS = new Map<string, Word>([
  ...table('one two three four five six seven eight nine', seq(1, 9), false, 'en', 'unit'),
  ...table(
    'ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen',
    seq(10, 19),
    false,
    'en',
    'teen',
  ),
  ...table(
    'twenty thirty forty fifty sixty seventy eighty ninety',
    seq(20, 90, 10),
    false,
    'en',
    'tens',
  ),
  ...table(
    'first second third fourth fifth sixth seventh eighth ninth',
    seq(1, 9),
    true,
    'en',
    'unit',
  ),
  ...table(
    'tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth',
    seq(10, 19),
    true,
    'en',
    'teen',
  ),
  ...table(
    'twentieth thirtieth fortieth fiftieth sixtieth seventieth eightieth ninetieth',
    seq(20, 90, 10),
    true,
    'en',
    'tens',
  ),
]);
const TR_CARDINALS = new Map<string, Word>([
  ...table('bir iki uc dort bes alti yedi sekiz dokuz', seq(1, 9), false, 'tr', 'unit'),
  ...table(
    'yirmi otuz kirk elli altmis yetmis seksen doksan',
    seq(20, 90, 10),
    false,
    'tr',
    'tens',
  ),
]);
/** Turkish ordinals take the noun suffixes ("ikinciyi", "ikinci sayfa"), so they match by stem. */
const TR_ORDINALS = new Map<string, Word>([
  ...table(
    'birinci ikinci ucuncu dorduncu besinci altinci yedinci sekizinci dokuzuncu',
    seq(1, 9),
    true,
    'tr',
    'unit',
  ),
  ...table('onuncu', [10], true, 'tr', 'teen'),
  ...table(
    'yirminci otuzuncu kirkinci ellinci altmisinci yetmisinci sekseninci doksaninci',
    seq(20, 90, 10),
    true,
    'tr',
    'tens',
  ),
]);
/** The word a token is on its own, or null. "on" is not here: see `tenAt`. */
function wordOf(t: Tok | undefined): Word | null {
  if (t?.kind !== 'word') return null;
  const f = full(t);
  const exact = EN_WORDS.get(f) ?? TR_CARDINALS.get(f);
  if (exact) return exact;
  for (const [stem, w] of TR_ORDINALS) if (isNoun(t, stem)) return w;
  // "twenty-one", "twenty-first": the one hyphenated form that is a clean composition.
  const parts = f.split('-');
  if (parts.length === 2) {
    const [a, b] = [EN_WORDS.get(parts[0] as string), EN_WORDS.get(parts[1] as string)];
    if (a && b && a.cls === 'tens' && !a.ord && b.cls === 'unit') return { ...b, n: a.n + b.n };
  }
  return null;
}
/**
 * Turkish "on" (ten) against English "on" (a preposition, a filler): it is ten only when a
 * Turkish word says so, a unit or ordinal after it ("on iki") or a Turkish page word beside it
 * ("on sayfa", "sayfa on").
 */
function tenAt(list: readonly Tok[], i: number): Word | null {
  if (!is(list[i], 'on')) return null;
  const next = list[i + 1];
  const w = wordOf(next);
  if (w?.lang === 'tr' && w.cls === 'unit') return { ...w, n: 10 + w.n };
  const prev = list[i - 1];
  if ((next && noun(next, 'sayfa')) || (prev && noun(prev, 'sayfa')))
    return { n: 10, ord: false, lang: 'tr', cls: 'teen' };
  return null;
}

/** A number the page expression names: a digit token or a (composed) number word. */
interface Num {
  readonly n: number;
  /** An ordinal: "3.", "3'üncü", "third", "on ikinci". */
  readonly ord: boolean;
  /** Tokens it takes. */
  readonly len: number;
  readonly word: boolean;
  /** The digits carried a case suffix ("5'e", "5'ten"). */
  readonly suf: string;
}
function numberAt(list: readonly Tok[], i: number): Num | null {
  const t = list[i];
  if (!t) return null;
  if (t.kind === 'number') return { n: t.n, ord: t.ord, len: 1, word: false, suf: t.suf };
  if (t.kind !== 'word') return null;
  const ten = tenAt(list, i);
  if (ten) {
    const joined = ten.n > 10;
    return { n: ten.n, ord: ten.ord, len: joined ? 2 : 1, word: true, suf: '' };
  }
  const w = wordOf(t);
  if (!w) return null;
  // Tens then units, in one language: "twenty one", "yirmi birinci".
  const next = wordOf(list[i + 1]);
  if (w.cls === 'tens' && !w.ord && next?.lang === w.lang && next.cls === 'unit') {
    return { n: w.n + next.n, ord: next.ord, len: 2, word: true, suf: '' };
  }
  return { n: w.n, ord: w.ord, len: 1, word: true, suf: '' };
}
/** Is this token something that names a page ("3", "3-5", "last", "third")? */
const isItem = (t: Tok | undefined): boolean =>
  !!t &&
  (t.kind === 'number' ||
    t.kind === 'range' ||
    (t.kind === 'word' && (FIRST.includes(full(t)) || LAST.includes(full(t)) || !!wordOf(t))));

const DATIVE = /^(?:a|e|ya|ye)$/;
const ABLATIVE = /^(?:dan|den|tan|ten)$/;
/** The case a number carries, on its digits ("5'e") or, for an ordinal, on its page word ("5. sayfaya"). */
function caseOf(n: Num, page: Tok | undefined): 'dat' | 'abl' | '' {
  if (DATIVE.test(n.suf)) return 'dat';
  if (ABLATIVE.test(n.suf)) return 'abl';
  if (!n.ord || page?.kind !== 'word') return '';
  const rest = /^sayfa(?:lar|ler)?(.*)$/.exec(full(page))?.[1] ?? '';
  return DATIVE.test(rest) ? 'dat' : ABLATIVE.test(rest) ? 'abl' : '';
}
const FIRST = ['first', 'ilk'];
const LAST = ['last', 'son'];
const EXCEPT_EN = ['except', 'but', 'excluding', 'besides'];
const exceptTr = (t: Tok): boolean => noun(t, 'haric') || full(t).startsWith('disinda');
const PRONOUNS = ['it', 'them', 'onu', 'onlari', 'bunu', 'bunlari'];

/** Words that, in a page expression, say "from here to the end", the page included. */
const openEnd = (t: Tok | undefined): boolean =>
  !!t && is(t, 'onwards', 'itibaren', 'sona', 'sonuna');
/**
 * "sonrası" ("what comes after"): the pages after, not the page itself. Lead decision: "5'ten
 * sonrası" is 6 to the end, like "5'ten sonra"; the spec's first reading (5 to the end) is out.
 */
const afterWord = (t: Tok | undefined): boolean =>
  !!t && noun(t, 'sonra') && full(t).startsWith('sonrasi');

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
  ...EN_WORDS.keys(),
  ...TR_CARDINALS.keys(),
  ...TR_ORDINALS.keys(),
  'kadar',
  'arasi',
  'sondan',
  'document',
  'belge',
];

/**
 * Reads the page tokens of a clause against the document as it is. `navigate` is for "go to":
 * there "7 sayfa" is the page 7 (PRD-23), where a document step reads it as a count and refuses.
 */
export function readPages(toks: readonly Tok[], ctx: IntentContext, navigate = false): PageRead {
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
    const skipPageWords = (k: number): number => {
      while (list[k] && isPageWord(list[k] as Tok)) k++;
      return k;
    };
    for (let i = 0; i < list.length; i++) {
      const t = list[i] as Tok;
      const next = list[i + 1];
      if (t.kind === 'range') {
        add(t.n, t.m, 'list');
        // "3 ile 5 arası", "3-5 arasını": the words that close a range.
        const j = skipPageWords(i + 1);
        if (list[j] && isNoun(list[j], 'arasi')) i = j;
        continue;
      }
      if (t.kind === 'word' && (FIRST.includes(full(t)) || LAST.includes(full(t)))) {
        let n = 1;
        const j = skipPageWords(i + 1);
        const arg = numberAt(list, j);
        if (arg && !arg.ord) {
          n = arg.n;
          i = j + arg.len - 1;
        }
        if (n < 1 || n > count) add(n, n, 'edge');
        else if (FIRST.includes(full(t))) add(1, n, 'edge');
        else add(count - n + 1, count, 'edge');
        continue;
      }
      if (t.kind === 'word' && full(t) === 'sondan') {
        // "sondan ikinci sayfa": the ordinal counted from the end. A count ("sondan iki") is not.
        const j = skipPageWords(i + 1);
        const arg = numberAt(list, j);
        if (!arg?.ord) unknown.push(t);
        else {
          add(count - arg.n + 1, count - arg.n + 1, 'edge');
          i = j + arg.len - 1;
        }
        continue;
      }
      const nm = numberAt(list, i);
      if (nm) {
        const end = i + nm.len - 1;
        const after = list[end + 1];
        const j = skipPageWords(end + 1);
        const tail = list[j];
        const mark = caseOf(nm, after);
        const toEnd = (is(tail, 'to', 'until') && is(list[j + 1], 'end')) || openEnd(tail);
        if (nm.word && numberAt(list, end + 1)?.word) {
          // "twenty twenty", "bir iki": two number words that do not compose are not a number.
          unknown.push(t);
          i = end;
        } else if (nm.word && !nm.ord && !hasPageWord) {
          // A number word names a page only beside a page word ("sayfa üç"); alone it is a count.
          unknown.push(t);
          i = end;
        } else if (toEnd) {
          add(nm.n, count, 'edge');
          i = is(tail, 'to', 'until') ? j + 1 : j;
          if (is(list[i + 1], 'kadar')) i++;
        } else if (mark === 'dat' && is(tail, 'kadar')) {
          // "5'e kadar", "5. sayfaya kadar": up to and with 5.
          add(1, nm.n, 'edge');
          i = j;
        } else if (
          afterWord(tail) ||
          (mark === 'abl' && tail?.kind === 'conj' && tail.text === 'sonra')
        ) {
          // "5'ten sonra", "5. sayfadan sonra", "5'ten sonrasını": after 5, not 5 itself.
          if (nm.n < 1 || nm.n > count) add(nm.n, nm.n, 'edge');
          else if (nm.n === count) {
            explicit = true;
            problem ??= { kind: 'no-pages' };
          } else add(nm.n + 1, count, 'edge');
          i = j;
        } else if (
          next?.kind === 'conj' &&
          next.text === 've' &&
          list[i + 2]?.kind === 'number' &&
          isNoun(list[skipPageWords(i + 3)] ?? t, 'arasi')
        ) {
          // "3 ve 5 arası": the pages between and with the two.
          add(nm.n, (list[i + 2] as Tok).n, 'list');
          i = skipPageWords(i + 3);
        } else if (
          !nm.ord &&
          nm.suf === '' &&
          after &&
          isPageWord(after) &&
          !(navigate && !nm.word && !isPlural(after))
        ) {
          // "iki sayfayı sil", "3 sayfa", "delete 2 pages": a count, not a page.
          explicit = true;
          problem ??= { kind: 'ambiguous-count' };
        } else if (nm.ord && is(after, 'to', 'from') && LAST.includes(full(list[end + 2] ?? t))) {
          // "second to last": counted from the end; "first to last" is a range, not read.
          if (nm.n < 2) unknown.push(t);
          else {
            add(count - nm.n + 1, count - nm.n + 1, 'edge');
            i = end + 2;
          }
        } else if (is(after, 'of') && list[end + 2]?.kind === 'number') {
          // "page 3 of 24": only when 24 is the document's own length.
          if ((list[end + 2] as Tok).n === count && count > 0) {
            add(nm.n, nm.n, 'list');
            i = end + 2;
          } else unknown.push(after as Tok);
        } else {
          add(nm.n, nm.n, 'list');
          i = end;
        }
        continue;
      }
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
        // "3 to last", "3 of 5": a filler between two pages makes a form this does not read.
        if (is(t, 'to', 'of', 'from')) {
          let k = i - 1;
          while (k >= 0 && isPageWord(list[k] as Tok)) k--;
          if (isItem(list[k]) && isItem(list[skipPageWords(i + 1)])) unknown.push(t);
        }
        continue;
      }
      if (
        t.kind === 'word' &&
        (is(t, 'even') || noun(t, 'cift') || is(t, 'odd') || noun(t, 'tek'))
      ) {
        const even = is(t, 'even') || noun(t, 'cift');
        // "tek sayfayı sil" is a single page and "tek bir sayfa" one page: parity names pages
        // in the plural ("tek sayfaları") or as numbered ("tek numaralı sayfa").
        let k = i + 1;
        let numbered = false;
        while (is(list[k], 'numarali', 'numbered')) {
          numbered = true;
          k++;
        }
        const follower = list[k];
        if (
          !numbered &&
          follower &&
          ((isPageWord(follower) && !isPlural(follower)) || is(follower, 'bir', 'one'))
        ) {
          unknown.push(t);
          continue;
        }
        addAll(
          range1(count).filter((p) => p % 2 === (even ? 0 : 1)),
          even ? 'even' : 'odd',
        );
        if (count < 1) problem ??= { kind: 'no-document' };
        else if (even && count < 2) problem ??= { kind: 'no-pages' };
      } else if (
        t.kind === 'word' &&
        (is(t, 'all', 'every', 'everything', 'whole', 'entire') ||
          noun(t, 'tum', 'tumu', 'butun', 'hepsi') ||
          full(t) === 'her')
      ) {
        if (count < 1) problem ??= { kind: 'no-document' };
        addAll(range1(count), 'all');
        while (
          list[i + 1] &&
          (isPageWord(list[i + 1] as Tok) || isDocumentWord(list[i + 1] as Tok))
        )
          i++;
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
    // "all" next to other pages ("all 3", "everything on page 3") would swallow them.
    if (named.has('all') && named.size > 1) problem ??= { kind: 'ambiguous-count' };
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
