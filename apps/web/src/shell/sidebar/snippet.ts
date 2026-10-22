/**
 * The one line of context under a Find result (06-navigation N4; R25 Epic 6 lane 2): about
 * `RADIUS` characters either side of the match, cut at word boundaries, with "…" where text
 * was dropped. Pure, so the cuts are unit-tested (`snippet.test.ts`).
 */
import { splitContext } from '../../viewer/search';

/** Characters kept either side of the match. */
export const SNIPPET_RADIUS = 40;

export interface Snippet {
  readonly before: string;
  readonly match: string;
  readonly after: string;
}

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);
const isLowSurrogate = (ch: string | undefined) =>
  ch !== undefined && ch >= '\uDC00' && ch <= '\uDFFF';

/** The last ~`radius` characters of `text`, starting at a word; "…" first when cut. */
export function cutLeading(text: string, radius = SNIPPET_RADIUS): string {
  if (text.length <= radius) return text;
  let start = text.length - radius;
  if (!isSpace(text[start - 1]) && !isSpace(text[start])) {
    // Inside a word: begin at the next one, or, in one long word, cut it where it stands.
    const gap = text.indexOf(' ', start);
    if (gap >= 0 && gap < text.length - 1) start = gap + 1;
    else if (isLowSurrogate(text[start])) start++;
  }
  return `…${text.slice(start).trimStart()}`;
}

/** The first ~`radius` characters of `text`, ending at a word; "…" last when cut. */
export function cutTrailing(text: string, radius = SNIPPET_RADIUS): string {
  if (text.length <= radius) return text;
  let end = radius;
  if (!isSpace(text[end - 1]) && !isSpace(text[end])) {
    const gap = text.lastIndexOf(' ', end);
    if (gap > 0) end = gap;
    else if (isLowSurrogate(text[end])) end--;
  }
  return `${text.slice(0, end).trimEnd()}…`;
}

/**
 * Cuts a hit's context around its match. The match is found at the engine's offsets, else by
 * the query with Find's case folding (`splitContext`: Turkish İ matches i, offsets kept).
 */
export function cutSnippet(
  hit: Parameters<typeof splitContext>[0],
  query: string,
  matchCase: boolean,
  radius = SNIPPET_RADIUS,
): Snippet {
  const { before, match, after } = splitContext(hit, query, matchCase);
  if (match === '') {
    // Nothing to centre on: the start of the line.
    return { before: '', match: '', after: cutTrailing(before + after, radius * 2) };
  }
  return { before: cutLeading(before, radius), match, after: cutTrailing(after, radius) };
}
