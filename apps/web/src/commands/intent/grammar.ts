/**
 * Clauses, slots and chains (PRD-39, spec §2.2 steps 4-7, §2.8, §2.9). A sentence is cut into
 * clauses at a conjunction that has a verb on both sides; each clause is read by every lexicon
 * entry whose action word it holds; an entry reads it only when every other word is a filler or
 * something its slots take (PRD-23's "every word understood", kept). The clauses' readings are
 * then joined, with the page and chain rules, into readings in run order.
 */
import { fuzzyFilter } from '../fuzzy';
import {
  COMPILED,
  FILLERS,
  matchPattern,
  type Compiled,
  type LexEntry,
  type Slot,
  type Unit,
} from './lexicon';
import { isPageWord, PAGE_VOCAB, readPages, type PageProblem, type PageRead } from './ranges';
import {
  formatOf,
  OFFICE_CAPABILITY,
  readLanguage,
  readPatterns,
  readRelation,
  readSize,
  readSplit,
  readTurn,
  sourceMarked,
  targetMarked,
  turnsOf,
  splitParts,
  TARGET_VOCAB,
  type Found,
  type SplitRead,
} from './targets';
import type { Tok } from './tokenise';
import { full, is, isKnownEnding, isNoun, PARTICLES } from './turkish';
import { FAMILY } from './types';
import type { Action, IntentContext, Pages, Problem, Step } from './types';

/** One way a clause can be read. */
export interface Sense {
  readonly action: Action;
  readonly step: Step;
  /** The entry's weight, times 0.95 for a folk phrase. */
  readonly weight: number;
  /** 1 when every slot came from the text, 0.9 when a default filled one. */
  readonly fit: number;
  readonly alwaysAsk: boolean;
  readonly problem: PageProblem | null;
  /** How the page slot was filled. */
  readonly pagesFrom: 'text' | 'default' | 'pronoun' | 'none';
  readonly span: readonly [number, number];
}

/** Things on a page that no action here touches: a word for one is never an unknown word. */
export const THINGS =
  'annotation annotations annotasyon yorum comment comments note notes not highlight highlights table tables tablo link links baglanti field fields alan form bookmark bookmarks header footer stamp damga shape sekil paragraph satir line passwords signatures'.split(
    ' ',
  );

/** Every stem the grammar knows: the lexicon's, page words, file types, things, fillers. */
const VOCAB: readonly string[] = [
  ...new Set([
    ...COMPILED.flatMap((c) => [...c.patterns, ...c.support, ...c.verbs]).flatMap((p) =>
      p.flatMap((u) => u.alts.map((a) => a.w)),
    ),
    ...PAGE_VOCAB,
    ...TARGET_VOCAB,
    ...THINGS,
    ...FILLERS,
  ]),
].filter((w) => w.length >= 2 && !w.startsWith('<'));

/** A word the grammar knows from somewhere, even if this action does not take it. */
export function knownWord(t: Tok): boolean {
  const f = full(t);
  return VOCAB.some((s) => f.startsWith(s) && (f === s || isKnownEnding(f.slice(s.length))));
}

const isObject = (t: Tok): boolean =>
  is(t, 'pdf', 'pdfs', 'file', 'files', 'document', 'documents', 'it', 'them') ||
  isNoun(t, 'dosya') ||
  isNoun(t, 'belge');

/** Every pattern of every entry matched in `toks`: the token indices it covers. */
function matches(
  c: Compiled,
  toks: readonly Tok[],
): { used: Set<number>; negated: boolean; aorist: boolean } | null {
  const used = new Set<number>();
  let negated = false;
  let aorist = false;
  const scan = (patterns: readonly (readonly Unit[])[]): boolean => {
    const ordered = [...patterns].sort((a, b) => b.length - a.length);
    let found = false;
    for (let i = 0; i < toks.length; ) {
      let hit = null;
      for (const p of ordered) {
        hit = matchPattern(p, toks, i);
        if (hit) break;
      }
      if (!hit) {
        i++;
        continue;
      }
      found = true;
      for (let k = 0; k < hit.len; k++) used.add(i + k);
      negated ||= hit.negated;
      aorist ||= hit.aorist;
      i += hit.len;
    }
    return found;
  };
  const words = scan(c.patterns);
  const verbs = c.verbs.length === 0 || scan(c.verbs);
  return words && verbs ? { used, negated, aorist } : null;
}

/** Indices of the tokens any entry takes as an action word, and whether one is negated. */
export function actionWords(toks: readonly Tok[]): { idx: Set<number>; negated: boolean } {
  const idx = new Set<number>();
  let negated = false;
  for (const c of COMPILED) {
    const m = matches(c, toks);
    if (!m) continue;
    for (const i of m.used) idx.add(i);
    negated ||= m.negated;
  }
  return { idx, negated };
}

/** Cuts the tokens at conjunctions that have a verb on both sides (spec §2.8). */
export function splitClauses(toks: readonly Tok[], verbs: ReadonlySet<number>): Tok[][] {
  const clauses: Tok[][] = [];
  let from = 0;
  const hasVerb = (a: number, b: number): boolean => {
    for (let i = a; i < b; i++) if (verbs.has(i)) return true;
    return false;
  };
  for (let i = 0; i < toks.length; i++) {
    if ((toks[i] as Tok).kind !== 'conj') continue;
    let next = i + 1;
    while (next < toks.length && (toks[next] as Tok).kind !== 'conj') next++;
    if (hasVerb(from, i) && hasVerb(i + 1, next)) {
      clauses.push(toks.slice(from, i));
      from = i + 1;
    }
  }
  clauses.push(toks.slice(from));
  return clauses.filter((c) => c.length > 0);
}

const sortedUnique = (pages: readonly number[]): number[] =>
  [...new Set(pages)].sort((a, b) => a - b);
const range1 = (n: number): number[] => Array.from({ length: Math.max(0, n) }, (_, i) => i + 1);

interface Filled {
  readonly pages: Pages;
  readonly from: Sense['pagesFrom'];
  readonly problem: PageProblem | null;
  readonly fit: number;
}

/** The pages an action gets: those typed, or its default (spec §2.1). */
function fillPages(entry: LexEntry, read: PageRead | null, ctx: IntentContext): Filled | null {
  const none: Pages = { pages: [], named: 'list' };
  if (read?.kind === 'unknown') return null;
  if (read?.kind === 'pronoun') return { pages: none, from: 'pronoun', problem: null, fit: 1 };
  if (read?.kind === 'ok' && read.explicit) {
    return {
      pages: { pages: read.pages, named: read.named },
      from: 'text',
      problem: read.problem,
      fit: 1,
    };
  }
  const selection = sortedUnique(ctx.selectedPages);
  const current = ctx.currentPage === undefined ? [] : [ctx.currentPage];
  switch (entry.pagesDefault) {
    case 'all':
      return {
        pages: { pages: range1(ctx.pageCount), named: 'all' },
        from: 'default',
        problem: null,
        fit: 0.9,
      };
    case 'current':
    case 'selection-or-current':
    case 'selection-or-none': {
      const useSelection = entry.pagesDefault !== 'current' && selection.length > 0;
      const pages = useSelection
        ? selection
        : entry.pagesDefault === 'selection-or-none'
          ? []
          : current;
      const named = useSelection ? 'selection' : pages.length > 0 ? 'current' : 'list';
      return {
        pages: { pages, named },
        from: 'default',
        problem: pages.length === 0 ? { kind: 'needs-pages' } : null,
        fit: 0.9,
      };
    }
    default:
      return { pages: none, from: 'none', problem: null, fit: 1 };
  }
}

interface Reader {
  readonly clause: readonly Tok[];
  readonly original: string;
  readonly ctx: IntentContext;
}
const slice = (r: Reader, a: Tok, b: Tok): string =>
  r.original.slice(a.start, b.end - (b.suf ? b.suf.length + 1 : 0));

/** Words that close a heading's name: "Yöntem bölümüne git". */
const HEADING_TAIL = /^(?:bolum|baslig|section|heading)/;
const RECENT_STOP = ['pdf', 'file', 'files', 'dosya', 'dosyalar', 'recent', 'recents', 'son'];
const FIND_TAIL = [
  'for',
  'the',
  'word',
  'kelime',
  'kelimesini',
  'kelimeyi',
  'ifade',
  'ifadesini',
  'metni',
  'metnini',
];

/** goto, heading, recent and find read the rest of the clause (spec §2.1). */
function readNavigation(
  entry: LexEntry,
  rest: readonly Tok[],
  r: Reader,
  used: Set<number>,
): Step | null {
  const kept = rest.filter((t) => t.kind !== 'conj');
  switch (entry.action) {
    case 'goto': {
      const wordCount = [...used].length;
      if (wordCount === 0) return null;
      const read = readPages(kept, r.ctx);
      if (read.kind !== 'ok' || !read.explicit) return null;
      const hasPageWord = kept.some(isPageWord);
      // "aç" opens files unless a page is named with its word ("7. sayfayı aç").
      if (r.clause.some((t) => /^ac(?:in|mak)?$/.test(full(t))) && !hasPageWord) return null;
      if (read.named === 'all' || read.named === 'even' || read.named === 'odd') return null;
      if (read.pages.length !== 1 && !read.problem) return null;
      return { action: 'goto', page: read.pages[0] ?? read.problem?.page ?? 0 };
    }
    case 'heading': {
      const words = kept.filter((t) => !FILLERS.has(full(t)));
      while (words.length > 0 && HEADING_TAIL.test((words.at(-1) as Tok).text)) words.pop();
      const first = words[0];
      const last = words.at(-1);
      if (!first || !last) return null;
      const text = slice(r, first, last).trim();
      if (/^(?:\d+|page|pages|sayfa\w*)$/.test(text.toLowerCase())) return null;
      const matches = fuzzyFilter(text, r.ctx.headings, (h) => h.title)
        .slice(0, 5)
        .map((m) => m.item);
      return matches.length > 0 ? { action: 'heading', text, matches } : null;
    }
    case 'recent': {
      const words = kept.filter((t) => !FILLERS.has(full(t)));
      const first = words[0];
      const last = words.at(-1);
      if (!first || !last || words.every((t) => RECENT_STOP.includes(full(t)))) return null;
      const text = slice(r, first, last).trim();
      const matches = fuzzyFilter(text, r.ctx.recents, (x) => x.name)
        .slice(0, 5)
        .map((m) => m.item);
      return matches.length > 0 ? { action: 'recent', text, matches } : null;
    }
    default: {
      const quoted = kept.find((t) => t.kind === 'quoted');
      if (quoted)
        return quoted.raw.trim() === '' ? null : { action: 'find', text: quoted.raw.trim() };
      const words = kept.filter(
        (t) => !(t.kind === 'word' && (FIND_TAIL.includes(full(t)) || isNoun(t, 'kelime'))),
      );
      const first = words[0];
      const last = words.at(-1);
      return first && last ? { action: 'find', text: slice(r, first, last).trim() } : null;
    }
  }
}

const NAVIGATE: ReadonlySet<Action> = new Set(['goto', 'heading', 'recent', 'find']);
const CONVERSION: ReadonlySet<Action> = new Set([
  'exportImages',
  'exportText',
  'unavailable',
  'officeToPdf',
]);

/** What a conversion sentence asks for, from its format words and which side each is on. */
function readConversion(
  entry: LexEntry,
  rest: readonly Tok[],
  ctx: IntentContext,
): { step: Step; rest: Tok[] } | null {
  const marked = rest.filter((t) => formatOf(t) !== null);
  const infos = marked.map((t) => ({
    t,
    f: formatOf(t) as NonNullable<ReturnType<typeof formatOf>>,
  }));
  const pdf = infos.find((x) => x.f.kind === 'pdf')?.t;
  const others = infos.filter((x) => x.f.kind !== 'pdf');
  const drop = (extra: Tok[]): Tok[] => rest.filter((t) => !extra.includes(t) && t !== pdf);
  const one = others[0];
  if (entry.action === 'unavailable' && !entry.slots.includes('format')) return null;
  if (entry.action === 'unavailable' && entry.slots[0] === 'language') return null;
  if (!one || others.length > 1) return null;
  const { t, f } = one;
  // Which side the word is on: the accusative or ablative is the source, the dative the target.
  const side = targetMarked(t)
    ? 'dst'
    : sourceMarked(t)
      ? 'src'
      : pdf
        ? t.start < pdf.start
          ? 'src'
          : 'dst'
        : 'dst';
  switch (entry.action) {
    case 'exportImages':
      return f.kind === 'img' && side === 'dst'
        ? {
            step: { action: 'exportImages', format: f.fmt, pages: { pages: [], named: 'all' } },
            rest: drop([t]),
          }
        : null;
    case 'exportText':
      return f.kind === 'txt' && side === 'dst'
        ? {
            step: { action: 'exportText', format: f.fmt === 'text' ? 'text' : 'markdown' },
            rest: drop([t]),
          }
        : null;
    case 'unavailable':
      return f.kind === 'off' && side === 'dst'
        ? {
            step: {
              action: 'unavailable',
              capability: OFFICE_CAPABILITY[f.which],
              nearest: 'document.exportMarkdown',
            },
            rest: drop([t]),
          }
        : null;
    default:
      return f.kind === 'off' &&
        ctx.officeEnabled &&
        (side === 'src' || !pdf) &&
        (side === 'src' || !targetMarked(t))
        ? { step: { action: 'officeToPdf' }, rest: drop([t]) }
        : null;
  }
}

const BARE_DEGREES = [90, 180, 270];

/** Reads one clause with one entry: its senses, or the unknown words that stopped it. */
function consume(
  c: Compiled,
  r: Reader,
  used: Set<number>,
  aorist: boolean,
): { senses: Sense[] } | { unknown: Tok[] } | null {
  const { entry } = c;
  const { clause, ctx } = r;
  const span: readonly [number, number] = [(clause[0] as Tok).start, (clause.at(-1) as Tok).end];
  const verbAt = Math.min(...used);
  // A conversion's file type may be the very word that made the entry read: keep it in view.
  let rest = clause.filter(
    (t, i) =>
      !used.has(i) || t.kind === 'size' || (CONVERSION.has(entry.action) && formatOf(t) !== null),
  );
  if (aorist) {
    const particle = clause[Math.max(...used) + 1];
    if (particle?.kind !== 'word' || !PARTICLES.has(full(particle))) return null;
    rest = rest.filter((t) => t !== particle);
  }
  // "silebilir misin", "döndürmek istiyorum": politeness after the verb.
  rest = rest.filter(
    (t) => !(clause.indexOf(t) > verbAt && (is(t, 'istiyorum', 'rica') || PARTICLES.has(full(t)))),
  );
  if (entry.slots.includes('format') || CONVERSION.has(entry.action)) {
    rest = rest.filter((t) => !is(t, 'olarak', 'as', 'into'));
  }
  for (const pattern of c.support) {
    for (let i = 0; i < rest.length; ) {
      const hit = matchPattern(pattern, rest, i);
      if (hit) rest.splice(i, hit.len);
      else i++;
    }
  }
  const weight = entry.weight * (entry.folk ? 0.95 : 1);
  const base = { action: entry.action, weight, alwaysAsk: entry.alwaysAsk === true, span } as const;
  const slots = new Set<Slot>(entry.slots);
  const explicit = new Set<Slot>();

  if (NAVIGATE.has(entry.action)) {
    const step = readNavigation(entry, rest, r, used);
    return step
      ? { senses: [{ ...base, step, fit: 1, problem: navProblem(step, ctx), pagesFrom: 'none' }] }
      : null;
  }

  let step: Step | null = null;
  if (CONVERSION.has(entry.action)) {
    const conv = readConversion(entry, rest, ctx);
    if (conv) {
      step = conv.step;
      rest = conv.rest;
      explicit.add('format');
    } else if (entry.slots[0] === 'format') return null;
  }
  if (entry.action === 'unavailable' && entry.slots[0] === 'language') {
    const lang = readLanguage(rest);
    if (lang) {
      rest = [...lang.rest];
      explicit.add('language');
    } else if (entry.needs) return null;
    step = { action: 'unavailable', capability: 'translate', nearest: null };
  }
  if (entry.object)
    rest = rest.filter((t) => !isObject(t) && !(t.kind === 'word' && formatOf(t)?.kind === 'pdf'));

  /** Reads a slot from what is left; what it takes is gone from `rest`. */
  const take = <T>(slot: Slot, read: (from: readonly Tok[]) => Found<T> | null): T | null => {
    const found = slots.has(slot) ? read(rest) : null;
    if (!found) return null;
    rest = [...found.rest];
    explicit.add(slot);
    return found.value;
  };
  const targetBytes = take('size', readSize);
  const kinds = take('patterns', readPatterns);
  const to = take('relation', readRelation);
  let turn: { dir: -1 | 0 | 1; deg: number | null } = { dir: 0, deg: null };
  if (slots.has('degrees') || slots.has('direction')) {
    const t = readTurn(rest);
    if (!t) return null;
    turn = t.value;
    rest = [...t.rest];
    // A bare 90, 180 or 270 closing the phrase is degrees when something else names the pages.
    const tail = [...rest]
      .reverse()
      .find((x) => x.kind !== 'conj' && !(x.kind === 'word' && FILLERS.has(full(x))));
    if (
      turn.deg === null &&
      tail?.kind === 'number' &&
      !tail.ord &&
      tail.suf === '' &&
      BARE_DEGREES.includes(tail.n)
    ) {
      const before = rest.filter(
        (x) =>
          x.start < tail.start && x.kind !== 'conj' && !(x.kind === 'word' && FILLERS.has(full(x))),
      );
      if (before.length === 0 || before.some((x) => !isPageWord(x))) {
        turn = { ...turn, deg: tail.n };
        rest = rest.filter((x) => x !== tail);
      }
    }
    if (turn.deg !== null || turn.dir !== 0) explicit.add('degrees');
  }
  let text: string | null = null;
  if (entry.action === 'watermark') {
    const quoted = rest.find((t) => t.kind === 'quoted');
    if (quoted) {
      text = quoted.raw;
      rest = rest.filter((t) => t !== quoted);
    } else {
      // One unquoted word right before "filigran…" or right after "watermark", in its own case.
      const key = clause.findIndex(
        (t, i) => used.has(i) && (t.text.startsWith('filigran') || t.text === 'watermark'),
      );
      const neighbour = clause[key]?.text === 'watermark' ? clause[key + 1] : clause[key - 1];
      if (
        neighbour?.kind === 'word' &&
        rest.includes(neighbour) &&
        !FILLERS.has(full(neighbour)) &&
        !knownWord(neighbour)
      ) {
        text = neighbour.raw;
        rest = rest.filter((t) => t !== neighbour);
      }
    }
    if (text !== null) explicit.add('text');
  }

  let variants: SplitRead[] = [{ how: 'choose', weight: 1, rest }];
  if (entry.action === 'split') {
    const reads = entry.fix?.every ? null : readSplit(rest);
    if (entry.fix?.every) variants = [{ how: { every: entry.fix.every }, weight: 1, rest }];
    else if (reads) variants = reads;
    else if (rest.some(isPageWord)) return null;
  }
  const out: Sense[] = [];
  for (const v of variants) {
    let left = v.rest;
    let pagesRead: PageRead | null = null;
    if (slots.has('pages') || slots.has('page')) {
      pagesRead = readPages(left, ctx);
      if (pagesRead.kind === 'unknown') {
        const unknown = pagesRead.toks.filter(
          (t) => t.kind === 'word' && !knownWord(t) && !/\d/.test(t.text),
        );
        return pagesRead.toks.length > 0 && unknown.length === pagesRead.toks.length
          ? { unknown }
          : null;
      }
      left = [];
      if (pagesRead.kind === 'ok' && pagesRead.explicit)
        explicit.add(slots.has('page') ? 'page' : 'pages');
    }
    const junk = left.filter(
      (t) => t.kind !== 'conj' && !(t.kind === 'word' && FILLERS.has(full(t))),
    );
    if (junk.length > 0) {
      const unknown = junk.filter((t) => t.kind === 'word' && !knownWord(t) && !/\d/.test(t.text));
      return unknown.length === junk.length && !NAVIGATE.has(entry.action) ? { unknown } : null;
    }
    if (entry.needs && !entry.needs.some((s) => explicit.has(s))) return null;

    const filled =
      slots.has('pages') || slots.has('page') ? fillPages(entry, pagesRead, ctx) : null;
    if (slots.has('pages') && filled === null) return null;
    const pages = filled?.pages ?? { pages: [], named: 'list' as const };
    const fit = filled?.fit ?? 1;
    const pagesFrom = filled?.from ?? 'none';
    let problem = filled?.problem ?? null;
    let built: Step | null;
    switch (entry.action) {
      case 'rotate':
        built = { action: 'rotate', pages, turns: entry.fix?.turns ?? turnsOf(turn.dir, turn.deg) };
        break;
      case 'delete':
      case 'duplicate':
      case 'extract':
      case 'reverse':
      case 'ocr':
      case 'pageNumbers':
        built = { action: entry.action, pages };
        break;
      case 'move':
        built = to ? { action: 'move', pages, to } : null;
        break;
      case 'split':
        built = { action: 'split', how: v.how };
        break;
      case 'watermark':
        built = { action: 'watermark', text, pages };
        break;
      case 'compress':
        built = { action: 'compress', targetBytes };
        break;
      case 'exportImages':
        built = step?.action === 'exportImages' ? { ...step, pages } : null;
        break;
      case 'exportText':
      case 'unavailable':
      case 'officeToPdf':
        built = step;
        break;
      case 'signPlace': {
        const page = pages.pages[0];
        if (pages.pages.length > 1) return null;
        built = { action: 'signPlace', page: page ?? problem?.page ?? ctx.currentPage ?? 0 };
        break;
      }
      case 'redactFind':
        built = kinds ? { action: 'redactFind', patterns: kinds } : null;
        break;
      default:
        built = { action: entry.action } as Step;
    }
    if (!built) return null;
    if (entry.action === 'compress' && targetBytes === null) problem = problem ?? null;
    const defaulted = entry.action === 'compress' && targetBytes === null ? 0.9 : 1;
    out.push({
      ...base,
      step: built,
      weight: weight * v.weight,
      fit: fit * defaulted,
      problem,
      pagesFrom,
    });
  }
  return { senses: out };
}

function navProblem(step: Step, ctx: IntentContext): PageProblem | null {
  if (ctx.pageCount < 1 && (step.action === 'goto' || step.action === 'find'))
    return { kind: 'no-document' };
  if (step.action === 'goto' && (step.page < 1 || step.page > ctx.pageCount))
    return { kind: 'out-of-range', page: step.page };
  return null;
}

export interface ClauseRead {
  readonly senses: Sense[];
  readonly negated: boolean;
  /** The best entry that stopped only on words it does not know. */
  readonly partial: { action: Action; unknown: Tok[]; weight: number } | null;
}

let seen: Set<LexEntry> | null = null;
/** Runs `run` and reports which lexicon entries read a clause meanwhile (the corpus uses all of them). */
export function traceLexicon<T>(run: () => T): { value: T; seen: ReadonlySet<LexEntry> } {
  const entries = new Set<LexEntry>();
  seen = entries;
  try {
    return { value: run(), seen: entries };
  } finally {
    seen = null;
  }
}

/** Reads one clause with every entry. */
export function readClause(
  clause: readonly Tok[],
  original: string,
  ctx: IntentContext,
): ClauseRead {
  const reader: Reader = { clause, original, ctx };
  const senses: Sense[] = [];
  let negated = false;
  let partial: ClauseRead['partial'] = null;
  for (const c of COMPILED) {
    const m = matches(c, clause);
    if (!m) continue;
    if (m.negated) {
      negated = true;
      continue;
    }
    const read = consume(c, reader, m.used, m.aorist);
    if (!read) continue;
    if ('unknown' in read) {
      if (
        !partial ||
        c.entry.weight > partial.weight ||
        (c.entry.weight === partial.weight && read.unknown.length < partial.unknown.length)
      ) {
        partial = { action: c.entry.action, unknown: read.unknown, weight: c.entry.weight };
      }
    } else {
      senses.push(...read.senses);
      seen?.add(c.entry);
    }
  }
  return { senses, negated, partial };
}

// ------------------------------------------------------------------------------- chains

const INHERIT: ReadonlySet<Action> = new Set(['rotate', 'delete', 'duplicate', 'extract', 'move']);
const hasPages = (s: Step): s is Extract<Step, { pages: Pages }> => 'pages' in s;

/** Document steps run first in typed order; the one finishing step runs last (spec §2.9). */
export const isFinishing = (s: Step): boolean =>
  FAMILY[s.action] === 'handoff' ||
  FAMILY[s.action] === 'output' ||
  (s.action === 'watermark' && s.text === null);

export interface Chained {
  readonly senses: readonly Sense[];
  readonly steps: readonly Step[];
  readonly score: number;
  readonly ask: boolean;
}

/** Joins one sense per clause: page ellipsis, pronouns and "go to, then" (spec §2.8). */
export function chain(picks: readonly Sense[]): Chained | null {
  const steps: Step[] = [];
  const senses: Sense[] = [];
  let score = 1;
  let ask = false;
  let goto: number | null = null;
  let previous = null as Pages | null;
  for (const [i, sense] of picks.entries()) {
    let step = sense.step;
    let fit = sense.fit;
    let from = sense.pagesFrom;
    let problem = sense.problem;
    if (NAVIGATE.has(sense.action)) {
      if (picks.length === 1) {
        steps.push(step);
        senses.push(sense);
        return { senses, steps, score: sense.weight * sense.fit, ask: sense.alwaysAsk };
      }
      if (sense.action !== 'goto' || i === picks.length - 1 || step.action !== 'goto') return null;
      goto = step.page;
      continue;
    }
    if (goto !== null) {
      if (from === 'text') return null;
      if (step.action === 'signPlace') step = { action: 'signPlace', page: goto };
      else if (hasPages(step) && (INHERIT.has(step.action) || step.action === 'ocr')) {
        step = { ...step, pages: { pages: [goto], named: 'list' } };
      } else return null;
      from = 'text';
      fit = 1;
      problem = null;
      goto = null;
    } else if (
      from === 'pronoun' ||
      (from === 'default' && INHERIT.has(sense.action) && previous && hasPages(step))
    ) {
      if (!previous || !hasPages(step)) return null;
      step = { ...step, pages: { ...previous, inherited: true } };
      fit = 1;
      problem = null;
    }
    previous =
      (from === 'text' || (hasPages(step) && step.pages.inherited)) && hasPages(step)
        ? step.pages
        : null;
    steps.push(step);
    senses.push({ ...sense, step, fit, problem });
    score *= sense.weight * fit;
    ask ||= sense.alwaysAsk;
  }
  return steps.length === 0 ? null : { senses, steps, score, ask };
}

// ----------------------------------------------------------------------- run order, problems

const PHONE: ReadonlySet<Action> = new Set([
  'goto',
  'heading',
  'find',
  'rotate',
  'delete',
  'duplicate',
  'move',
  'signPlace',
  'compress',
  'exportImages',
  'exportText',
  'saveCopy',
]);
const NO_DOCUMENT_OK: ReadonlySet<Action> = new Set([
  'recent',
  'unavailable',
  'officeToPdf',
  'combine',
]);
const SHIFTS: ReadonlySet<Action> = new Set(['delete', 'duplicate', 'move', 'reverse']);

export interface Planned {
  readonly steps: Step[];
  readonly spans: (readonly [number, number])[];
  readonly problem: { kind: Problem; step: number; page?: number } | null;
}

/** Puts a chain in run order and finds its first problem (spec §2.9). Null: it is not a chain. */
export function plan(ch: Chained, ctx: IntentContext): Planned | null {
  if (ch.steps.length > 1 && ch.steps.some((s) => s.action === 'unavailable')) return null;
  const order = ch.steps.map((_, i) => i);
  const run = [
    ...order.filter((i) => !isFinishing(ch.steps[i] as Step)),
    ...order.filter((i) => isFinishing(ch.steps[i] as Step)),
  ];
  const steps = run.map((i) => ch.steps[i] as Step);
  const spans = run.map((i) => (ch.senses[i] as Sense).span);
  const found: { kind: Problem; step: number; page?: number }[] = [];
  const report = (kind: Problem, step: number, page?: number): void => {
    found.push(page === undefined ? { kind, step } : { kind, step, page });
  };
  const deleted = new Set<number>();
  let shifts = false;
  let split = false;
  let finishing = 0;
  for (const [k, step] of steps.entries()) {
    const sense = ch.senses[run[k] as number] as Sense;
    if (ctx.pageCount < 1 && !NO_DOCUMENT_OK.has(step.action)) report('no-document', k);
    if (sense.problem) report(sense.problem.kind, k, sense.problem.page);
    if (ctx.edition === 'compact' && !PHONE.has(step.action)) report('phone', k);
    if (split && FAMILY[step.action] === 'document') report('after-split', k);
    if (isFinishing(step) && ++finishing === 2) report('two-finishing', k);
    if (step.action === 'split') {
      split = true;
      if (
        step.how !== 'choose' &&
        ctx.pageCount > 0 &&
        splitParts(ctx.pageCount, step.how).length < 2
      ) {
        report('single-part', k);
      }
    }
    if ((step.action === 'pageNumbers' || step.action === 'watermark') && hasPages(step)) {
      const { pages, named } = step.pages;
      const everyPage = named === 'all' || named === 'even' || named === 'odd';
      if (!everyPage && pages.some((p, i) => i > 0 && p !== (pages[i - 1] as number) + 1))
        report('not-a-run', k);
      if (!everyPage && shifts && sense.pagesFrom === 'text') report('shifted', k);
    }
    // A step on pages an earlier step deletes: they would be gone by then.
    if (
      step.action !== 'delete' &&
      hasPages(step) &&
      !['all', 'even', 'odd'].includes(step.pages.named) &&
      step.pages.pages.some((p) => deleted.has(p))
    ) {
      report('shifted', k);
    }
    if (step.action === 'delete') {
      for (const p of step.pages.pages) deleted.add(p);
      if (ctx.pageCount > 0 && deleted.size >= ctx.pageCount) report('all-pages', k);
    }
    if (SHIFTS.has(step.action)) shifts = true;
  }
  const first = found.reduce<(typeof found)[number] | null>(
    (a, b) => (a && a.step <= b.step ? a : b),
    null,
  );
  return { steps, spans, problem: first };
}
