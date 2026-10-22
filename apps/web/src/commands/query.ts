/**
 * The palette's query parser (Epic 4, R12 E10; decision PRD-23). Pure: a typed string and the
 * document's facts go in, a typed intent comes out, and the palette renders it. Nothing here
 * runs a command; every intent that would act carries the resolved pages, so the palette can
 * show them before anything happens ("nothing runs unseen", E10 acceptance).
 *
 * Technique: a small rule grammar over a folded, tokenised query, not a model. The query is
 * folded as the fuzzy matcher folds it (`foldForSearch`: Turkish-aware case folding, no
 * diacritics, "SİL" and "sil" and "SIL" alike), apostrophe suffixes after numbers are dropped
 * ("7'ye" -> "7"), and Turkish page words are matched by stem ("sayfayı", "sayfaları" ->
 * `sayfa*`). A phrase is accepted only when every word of it is understood, so "delete
 * annotation" is left to the command list rather than half-parsed.
 *
 * Intents, in priority order: a page jump ("120", "p 120", "page 120", "sayfa 120"); a
 * page-range action ("rotate 3-7 right", "delete 4-6", "çift sayfaları sil", "delete even
 * pages"); open a recent file ("open <name>", "aç <ad>"); jump to a heading ("go to
 * Methods", "Methods git"). `null` means "no intent: rank commands as before".
 */
import { foldForSearch, fuzzyFilter } from './fuzzy';

/** What the parser knows about the open document and the recent files. */
export interface QueryContext {
  /** Pages in the open document; 0 when none is open. */
  readonly pageCount: number;
  /** The page in view, 1-based, for "this page". */
  readonly currentPage?: number;
  readonly headings?: readonly QueryHeading[];
  readonly recents?: readonly QueryRecent[];
}

export interface QueryHeading {
  readonly title: string;
  /** 1-based page the heading points at. */
  readonly page: number;
}

export interface QueryRecent {
  readonly id: string;
  readonly name: string;
}

export type PagesAction = 'rotate' | 'delete' | 'duplicate' | 'extract';

/** Why a phrase that looks like an intent cannot be carried out. */
export type InvalidReason =
  | 'no-document'
  | 'out-of-range'
  | 'reversed-range'
  | 'no-pages'
  | 'all-pages'
  /** "delete 2 pages": a count or page 2? Only a range or "page 2" says which. */
  | 'ambiguous-count';

export type QueryIntent =
  | { readonly kind: 'page'; readonly page: number; readonly pages: readonly [number] }
  | {
      readonly kind: 'pages';
      readonly action: PagesAction;
      /** The palette command that does it (`app-commands.ts`). */
      readonly commandId: string;
      /** Resolved, 1-based, ascending, no duplicates: what the palette shows before running. */
      readonly pages: readonly number[];
      /** The same pages as text, "3-7" or "2, 4, 6-8". */
      readonly pagesLabel: string;
      /** Rotation only: -1 is a quarter turn left, 1 right, 2 a half turn. */
      readonly turns?: -1 | 1 | 2;
    }
  | {
      /** "go to Methods": `matches` are the outline entries that fit, best first (never empty). */
      readonly kind: 'heading';
      readonly text: string;
      readonly matches: readonly QueryHeading[];
      readonly pages: readonly number[];
    }
  | { readonly kind: 'recent'; readonly text: string; readonly matches: readonly QueryRecent[] }
  | {
      readonly kind: 'invalid';
      readonly reason: InvalidReason;
      /** Which intent it would have been. */
      readonly for: 'page' | 'pages';
      /** The page count it was checked against, and the first page that failed, if any. */
      readonly pageCount: number;
      readonly page?: number | undefined;
    };

const MAX_MATCHES = 5;

/** Words that mean nothing to the grammar once the verb and the pages are found. */
const FILLER = new Set([
  'page',
  'pages',
  'pg',
  'pgs',
  'p',
  'the',
  'only',
  'please',
  'lutfen',
  'from',
  'in',
  'on',
  'of',
  'arasi',
  'numarali',
  'belgede',
  'numbered',
]);
const ALL_WORDS = new Set([
  'all',
  'every',
  'everything',
  'whole',
  'tum',
  'tumu',
  'tumunu',
  'hepsi',
  'hepsini',
  'butun',
]);
const EVEN = new Set(['even', 'cift', 'ciftleri']);
const ODD = new Set(['odd', 'tek', 'tekleri']);
const THIS_WORDS = new Set(['this', 'current', 'bu', 'mevcut', 'suanki']);
const RIGHT = new Set(['right', 'clockwise', 'cw', 'sag', 'saga']);
const LEFT = new Set(['left', 'ccw', 'counterclockwise', 'anticlockwise', 'sol', 'sola']);

const VERBS: readonly { readonly words: readonly string[]; readonly action: PagesAction }[] = [
  { words: ['rotate', 'turn', 'dondur', 'cevir'], action: 'rotate' },
  // "çıkar" is "remove" ("3. sayfayı çıkar"); only "ayıkla" and "ayrı dosya olarak çıkar" extract.
  { words: ['delete', 'remove', 'del', 'sil', 'kaldir', 'cikar'], action: 'delete' },
  { words: ['duplicate', 'copy', 'clone', 'cogalt', 'kopyala'], action: 'duplicate' },
  { words: ['extract', 'ayikla'], action: 'extract' },
];

const COMMAND_OF: Record<PagesAction, (turns?: number) => string> = {
  rotate: (turns) => (turns === -1 ? 'pages.rotateLeft' : 'pages.rotateRight'),
  delete: () => 'pages.delete',
  duplicate: () => 'pages.duplicate',
  extract: () => 'pages.extract',
};

/** The query as the grammar reads it: folded, number suffixes and ordinals dropped. */
function normalise(query: string): string {
  return foldForSearch(query.normalize('NFC').trim())
    .replace(/[’‘`´]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/(\d)'\w*/g, '$1')
    .replace(/(\d+)\s*(?:°|deg\w*|derece\w*)/g, 'deg$1')
    .replace(/(\d+)\s+(\d+)\s+kadar\b/g, '$1-$2')
    .replace(
      /(\d+)\s*(?:-|\.\.+|…|\bto\b|\bthrough\b|\bthru\b|\buntil\b|\bile\b|\bila\b)\s*(\d+)/g,
      '$1-$2',
    )
    .replace(/(\d)\.(?!\d)/g, '$1 ')
    .replace(/(first|last|ilk|son)\s+(\d+)/g, '$1:$2')
    .replace(/\b(first|last|ilk|son)\b(?!:)/g, '$1:1')
    .replace(/[,;&+]|\b(?:and|ve)\b/g, ' ')
    .replace(/\b(p|pg|page|sayfa)(\d)/g, '$1 $2')
    .replace(/(\d)(?:ye|ya|e|a)(?=\s+git\b)/g, '$1')
    .replace(/ayri dosya(?: olarak)? (?:cikar|kaydet)/g, 'ayikla')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ascending, de-duplicated page numbers as "3-7" or "2, 4, 6-8". */
export function formatPages(pages: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < pages.length; ) {
    let j = i;
    while (j + 1 < pages.length && pages[j + 1] === (pages[j] ?? 0) + 1) j++;
    parts.push(j > i ? `${pages[i]}-${pages[j]}` : `${pages[i]}`);
    i = j + 1;
  }
  return parts.join(', ');
}

const isPageWord = (token: string): boolean => FILLER.has(token) || /^sayfa\w*$/.test(token);

/** Pages named by the words of a phrase, or why not; null when a word is not understood. */
function resolvePages(
  tokens: readonly string[],
  ctx: QueryContext,
): { pages: number[] } | { reason: InvalidReason; page?: number } | null {
  const wanted = new Set<number>();
  const count = ctx.pageCount;
  const range = (from: number, to: number): { reason: InvalidReason; page?: number } | null => {
    if (from > to) return { reason: 'reversed-range', page: from };
    if (from < 1) return { reason: 'out-of-range', page: from };
    if (to > count) return { reason: 'out-of-range', page: to };
    for (let n = from; n <= to; n++) wanted.add(n);
    return null;
  };
  let understood = false;
  for (const token of tokens) {
    if (isPageWord(token)) continue;
    let failure: { reason: InvalidReason; page?: number } | null = null;
    let m: RegExpMatchArray | null;
    if ((m = /^(\d+)-(\d+)$/.exec(token))) failure = range(Number(m[1]), Number(m[2]));
    else if (/^\d+$/.test(token)) failure = range(Number(token), Number(token));
    else if ((m = /^(first|last|ilk|son):(\d+)$/.exec(token))) {
      const n = Number(m[2]);
      if (n < 1 || n > count) failure = { reason: 'out-of-range', page: n };
      else if (m[1] === 'first' || m[1] === 'ilk') failure = range(1, n);
      else failure = range(count - n + 1, count);
    } else if (ALL_WORDS.has(token)) failure = range(1, count);
    else if (EVEN.has(token)) for (let n = 2; n <= count; n += 2) wanted.add(n);
    else if (ODD.has(token)) for (let n = 1; n <= count; n += 2) wanted.add(n);
    else if (THIS_WORDS.has(token)) {
      // "delete this" is not "delete this page": the page word must be there.
      if (!tokens.some(isPageWord) || ctx.currentPage === undefined) return null;
      const current = ctx.currentPage;
      failure = range(current, current);
    } else return null;
    if (failure) return failure;
    understood = true;
  }
  if (!understood) return null;
  return { pages: [...wanted].sort((a, b) => a - b) };
}

function parsePageJump(norm: string, ctx: QueryContext): QueryIntent | null {
  const edge =
    /^(?:(?:go ?to|goto|jump to)\s+)?(first|last|ilk|son):1\s+(?:page|sayfa\w*)(?:\s+git)?$/.exec(
      norm,
    );
  if (edge) {
    if (ctx.pageCount < 1) return invalid('no-document', 'page', ctx);
    const page = edge[1] === 'first' || edge[1] === 'ilk' ? 1 : ctx.pageCount;
    return { kind: 'page', page, pages: [page] };
  }
  const m =
    /^(?:(?:go ?to|goto|git|jump to)\s+)?(?:(?:p|pg|page|sayfa\w*)\s+)?(\d+)(?:\s+(?:page|sayfa\w*))?(?:\s+git)?$/.exec(
      norm,
    );
  if (!m) return null;
  const page = Number(m[1]);
  if (ctx.pageCount < 1) return invalid('no-document', 'page', ctx, page);
  if (page < 1 || page > ctx.pageCount) return invalid('out-of-range', 'page', ctx, page);
  return { kind: 'page', page, pages: [page] };
}

function invalid(
  reason: InvalidReason,
  target: 'page' | 'pages',
  ctx: QueryContext,
  page?: number,
): QueryIntent {
  return { kind: 'invalid', reason, for: target, pageCount: ctx.pageCount, page };
}

function parsePagesAction(norm: string, ctx: QueryContext): QueryIntent | null {
  const words = norm.split(' ');
  const verbAt = words.findIndex((w) => VERBS.some((v) => v.words.includes(w)));
  if (verbAt < 0) return null;
  const verb = VERBS.find((v) => v.words.includes(words[verbAt] ?? ''));
  if (!verb) return null;
  let direction: -1 | 1 | undefined;
  let degrees: number | undefined;
  let rest: string[] = [];
  words.forEach((w, i) => {
    if (i === verbAt) return;
    if (verb.action === 'rotate' && RIGHT.has(w)) direction = 1;
    else if (verb.action === 'rotate' && LEFT.has(w)) direction = -1;
    else if (verb.action === 'rotate' && /^(?:saat|yonunde|yonune|saatin|tersi|tersine)$/.test(w)) {
      if (w === 'tersi' || w === 'tersine') direction = -1;
      else if (w === 'yonunde' || w === 'yonune') direction ??= 1;
    } else if (verb.action === 'rotate' && /^deg\d+$/.test(w)) degrees = Number(w.slice(3));
    else rest.push(w);
  });
  if (verb.action === 'rotate') {
    // A bare 90, 180 or 270 closing the phrase is degrees when something else names the pages
    // ("rotate 5 180") or nothing does ("rotate 180": the page in view); "rotate page 180" is
    // page 180.
    const last = rest.at(-1);
    if (degrees === undefined && last !== undefined && /^(?:90|180|270)$/.test(last)) {
      const before = rest.slice(0, -1);
      if (before.length === 0 || before.some((t) => !isPageWord(t))) {
        degrees = Number(last);
        rest = before;
      }
    }
    if (degrees !== undefined && ![90, 180, 270].includes(degrees)) return null;
    if (degrees !== undefined && !rest.some((t) => !isPageWord(t)))
      rest = [...rest, 'this', 'page'];
  }
  if (rest.some((t, i) => /^\d+$/.test(t) && rest[i + 1] === 'pages')) {
    return invalid('ambiguous-count', 'pages', ctx);
  }
  const resolved = resolvePages(rest, ctx);
  if (!resolved) return null;
  if (ctx.pageCount < 1) return invalid('no-document', 'pages', ctx);
  if ('reason' in resolved) return invalid(resolved.reason, 'pages', ctx, resolved.page);
  const { pages } = resolved;
  if (pages.length === 0) return invalid('no-pages', 'pages', ctx);
  if (verb.action === 'delete' && pages.length >= ctx.pageCount) {
    return invalid('all-pages', 'pages', ctx);
  }
  // A left turn is the only one with its own command; a half turn is two right turns.
  const quarters = (((((direction ?? 1) * (degrees ?? 90)) / 90) % 4) + 4) % 4;
  const resolvedTurns: -1 | 1 | 2 | undefined =
    verb.action === 'rotate' ? (quarters === 3 ? -1 : (quarters as 1 | 2)) : undefined;
  return {
    kind: 'pages',
    action: verb.action,
    commandId: COMMAND_OF[verb.action](resolvedTurns),
    pages,
    pagesLabel: formatPages(pages),
    ...(resolvedTurns === undefined ? {} : { turns: resolvedTurns }),
  };
}

/** The text of `original` that `norm` (same length as the folded original) matched as a group. */
function slice(original: string, folded: string, pattern: RegExp): string | null {
  const m = pattern.exec(folded);
  if (m?.[1] === undefined) return null;
  const start = m.index + m[0].indexOf(m[1]);
  return original.slice(start, start + m[1].length).trim();
}

const RECENT_STOP = new Set([
  'pdf',
  'file',
  'files',
  'dosya',
  'dosyalar',
  'recent',
  'recents',
  'son',
]);

function parseRecent(original: string, ctx: QueryContext): QueryIntent | null {
  const folded = foldForSearch(original);
  const text =
    slice(original, folded, /^\s*(?:open|ac)\s+(.+?)\s*$/) ??
    slice(original, folded, /^\s*(.+?)\s+ac\s*$/);
  if (!text || !ctx.recents?.length) return null;
  // "open pdf", "open file": about files in general, which is the Open command's.
  if (
    foldForSearch(text)
      .split(/\s+/)
      .every((w) => RECENT_STOP.has(w))
  )
    return null;
  const matches = fuzzyFilter(text, ctx.recents, (r) => r.name)
    .slice(0, MAX_MATCHES)
    .map((r) => r.item);
  return matches.length > 0 ? { kind: 'recent', text, matches } : null;
}

function parseHeading(original: string, ctx: QueryContext): QueryIntent | null {
  const folded = foldForSearch(original);
  let text =
    slice(original, folded, /^\s*(?:go ?to|goto|jump to|show section)\s+(.+?)\s*$/) ??
    slice(original, folded, /^\s*(.+?)\s+git\s*$/);
  if (!text) return null;
  text = text.replace(/['’]\w*$/u, '');
  // Turkish suffixes are cut on the folded text, so "BAŞLIĞINA" goes as "başlığına" does.
  const suffix = /\s+(?:bolum\w*|baslig\w*|section|heading)$/.exec(foldForSearch(text));
  if (suffix) text = text.slice(0, suffix.index);
  text = text.trim();
  if (text === '' || /^(?:\d+|page|pages|sayfa\w*)$/.test(foldForSearch(text))) return null;
  const matches = fuzzyFilter(text, ctx.headings ?? [], (h) => h.title)
    .slice(0, MAX_MATCHES)
    .map((r) => r.item);
  const first = matches[0];
  // Nothing to jump to: "go to settings" is for the command list.
  if (!first) return null;
  return { kind: 'heading', text, matches, pages: [first.page] };
}

/** Reads a palette query as an intent, or null when it is only a search for commands. */
export function parseQuery(query: string, ctx: QueryContext): QueryIntent | null {
  if (query.trim() === '') return null;
  const norm = normalise(query);
  return (
    parsePageJump(norm, ctx) ??
    parsePagesAction(norm, ctx) ??
    parseRecent(query.normalize('NFC'), ctx) ??
    parseHeading(query.normalize('NFC'), ctx)
  );
}
