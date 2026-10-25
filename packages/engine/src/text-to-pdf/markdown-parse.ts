/**
 * A small Markdown parser for `.md` to PDF (PRD-28): a CommonMark subset, pure, no imports.
 *
 * Blocks: fenced code, thematic breaks, ATX and setext headings, block quotes, nested bullet and
 * numbered lists, GFM pipe tables (header row, `:---:` alignment; PRD-30), paragraphs (hard
 * breaks kept), form feeds as page breaks. Inline: escapes, code spans, links (text, title
 * dropped), autolinks, images as their alt text, `*` and `_` emphasis.
 * Not supported, kept as literal text: indented code, HTML, strikethrough, footnotes.
 */

export interface InlineRun {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
  readonly href?: string;
}

export interface ListItem {
  readonly runs: readonly InlineRun[];
  readonly children: readonly ListBlock[];
}

export interface ListBlock {
  readonly kind: 'list';
  readonly ordered: boolean;
  readonly start: number;
  readonly items: readonly ListItem[];
}

export type TableAlign = 'left' | 'center' | 'right';

export interface TableBlock {
  readonly kind: 'table';
  /** One alignment per column, from the delimiter row (`:--`, `:-:`, `--:`; none is left). */
  readonly align: readonly TableAlign[];
  readonly head: readonly (readonly InlineRun[])[];
  /** Body rows, each padded or cut to the header's column count. */
  readonly rows: readonly (readonly (readonly InlineRun[])[])[];
}

export type MdBlock =
  | {
      readonly kind: 'heading';
      readonly level: 1 | 2 | 3 | 4 | 5 | 6;
      readonly runs: readonly InlineRun[];
    }
  | { readonly kind: 'paragraph'; readonly runs: readonly InlineRun[] }
  | ListBlock
  | { readonly kind: 'code'; readonly lines: readonly string[] }
  | { readonly kind: 'quote'; readonly blocks: readonly MdBlock[] }
  | TableBlock
  | { readonly kind: 'rule' }
  | { readonly kind: 'pagebreak' };

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

const ASCII_PUNCT = /[!-/:-@[-`{-~]/;
const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/;

interface TextToken {
  readonly type: 'text';
  readonly text: string;
}
interface RunsToken {
  readonly type: 'runs';
  readonly runs: readonly InlineRun[];
}
interface DelimToken {
  readonly type: 'delim';
  readonly char: string;
  count: number;
  readonly canOpen: boolean;
  readonly canClose: boolean;
}
type Token = TextToken | RunsToken | DelimToken;

const plain = (text: string, extra: Partial<InlineRun> = {}): InlineRun => ({
  text,
  bold: false,
  italic: false,
  code: false,
  ...extra,
});

/** The end index (exclusive of the bracket) of the `]` matching the `[` at `open`, or -1. */
function matchBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') i++;
    else if (ch === '`') {
      const run = /^`+/.exec(text.slice(i))?.[0] ?? '`';
      const close = text.indexOf(run, i + run.length);
      if (close >= 0) i = close + run.length - 1;
      else i += run.length - 1;
    } else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return i;
  }
  return -1;
}

/** `(url "title")` at `open` (a `(`): the url and the index after the `)`, or undefined. */
function parseDestination(
  text: string,
  open: number,
): { readonly url: string; readonly end: number } | undefined {
  let i = open + 1;
  while (i < text.length && text[i] === ' ') i++;
  let url: string;
  if (text[i] === '<') {
    const close = text.indexOf('>', i);
    if (close < 0) return undefined;
    url = text.slice(i + 1, close);
    i = close + 1;
  } else {
    let depth = 0;
    const from = i;
    while (i < text.length) {
      const ch = text[i] ?? '';
      if (ch === '\\') i++;
      else if (ch === '(') depth++;
      else if (ch === ')') {
        if (depth === 0) break;
        depth--;
      } else if (SPACE.test(ch)) break;
      i++;
    }
    url = text.slice(from, i).replace(/\\(.)/g, (m0, c: string) => (ASCII_PUNCT.test(c) ? c : m0));
  }
  while (i < text.length && SPACE.test(text[i] ?? '')) i++;
  if (text[i] === '"' || text[i] === "'" || text[i] === '(') {
    const quote = text[i] === '(' ? ')' : (text[i] as string);
    const close = text.indexOf(quote, i + 1);
    if (close < 0) return undefined;
    i = close + 1;
    while (i < text.length && SPACE.test(text[i] ?? '')) i++;
  }
  return text[i] === ')' ? { url, end: i + 1 } : undefined;
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer !== '') tokens.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === '\\' && i + 1 < text.length && ASCII_PUNCT.test(text[i + 1] as string)) {
      buffer += text[i + 1] as string;
      i += 2;
    } else if (ch === '`') {
      const run = /^`+/.exec(text.slice(i))?.[0] ?? '`';
      let close = -1;
      for (let from = i + run.length; from < text.length; ) {
        const at = text.indexOf('`', from);
        if (at < 0) break;
        const len = /^`+/.exec(text.slice(at))?.[0].length ?? 1;
        if (len === run.length) {
          close = at;
          break;
        }
        from = at + len;
      }
      if (close < 0) {
        buffer += run;
        i += run.length;
      } else {
        let content = text.slice(i + run.length, close).replace(/\n/g, ' ');
        if (content.startsWith(' ') && content.endsWith(' ') && content.trim() !== '') {
          content = content.slice(1, -1);
        }
        flush();
        tokens.push({ type: 'runs', runs: [plain(content, { code: true })] });
        i = close + run.length;
      }
    } else if (ch === '!' && text[i + 1] === '[') {
      const close = matchBracket(text, i + 1);
      const dest =
        close >= 0 && text[close + 1] === '(' ? parseDestination(text, close + 1) : undefined;
      if (close >= 0 && dest) {
        flush();
        tokens.push({ type: 'runs', runs: parseInline(text.slice(i + 2, close)) });
        i = dest.end;
      } else {
        buffer += ch;
        i++;
      }
    } else if (ch === '[') {
      const close = matchBracket(text, i);
      const dest =
        close >= 0 && text[close + 1] === '(' ? parseDestination(text, close + 1) : undefined;
      if (close >= 0 && dest) {
        flush();
        const inner = parseInline(text.slice(i + 1, close));
        tokens.push({
          type: 'runs',
          runs: dest.url === '' ? inner : inner.map((r) => ({ ...r, href: dest.url })),
        });
        i = dest.end;
      } else {
        buffer += ch;
        i++;
      }
    } else if (ch === '<') {
      const auto = /^<([a-zA-Z][a-zA-Z0-9+.-]*:[^\s<>]*)>/.exec(text.slice(i));
      if (auto) {
        flush();
        const url = auto[1] as string;
        tokens.push({
          type: 'runs',
          runs: [plain(url.replace(/^mailto:/i, ''), { href: url })],
        });
        i += auto[0].length;
      } else {
        buffer += ch;
        i++;
      }
    } else if (ch === '*' || ch === '_') {
      let end = i;
      while (text[end] === ch) end++;
      const before = i > 0 ? (text[i - 1] as string) : '';
      const after = end < text.length ? (text[end] as string) : '';
      let canOpen = after !== '' && !SPACE.test(after);
      let canClose = before !== '' && !SPACE.test(before);
      if (ch === '_') {
        if (before !== '' && WORD_CHAR.test(before)) canOpen = false;
        if (after !== '' && WORD_CHAR.test(after)) canClose = false;
      }
      flush();
      tokens.push({ type: 'delim', char: ch, count: end - i, canOpen, canClose });
      i = end;
    } else {
      buffer += ch;
      i++;
    }
  }
  flush();
  return tokens;
}

function mergeRuns(runs: readonly InlineRun[]): InlineRun[] {
  const out: InlineRun[] = [];
  for (const run of runs) {
    if (run.text === '') continue;
    const last = out[out.length - 1];
    if (
      last?.bold === run.bold &&
      last.italic === run.italic &&
      last.code === run.code &&
      last.href === run.href
    ) {
      out[out.length - 1] = { ...last, text: last.text + run.text };
    } else out.push(run);
  }
  return out;
}

/** Inline Markdown to styled runs; adjacent runs of equal style are merged. */
export function parseInline(text: string): InlineRun[] {
  const tokens = tokenize(text);
  const bold = new Array<number>(tokens.length + 1).fill(0);
  const italic = new Array<number>(tokens.length + 1).fill(0);
  for (let c = 0; c < tokens.length; c++) {
    const closer = tokens[c] as Token;
    if (closer.type !== 'delim' || !closer.canClose) continue;
    while (closer.count > 0) {
      let o = c - 1;
      while (o >= 0) {
        const cand = tokens[o] as Token;
        if (cand.type === 'delim' && cand.char === closer.char && cand.canOpen && cand.count > 0) {
          break;
        }
        o--;
      }
      if (o < 0) break;
      const opener = tokens[o] as DelimToken;
      const strong = opener.count >= 2 && closer.count >= 2;
      const use = strong ? 2 : 1;
      opener.count -= use;
      closer.count -= use;
      const mark = strong ? bold : italic;
      mark[o + 1] = (mark[o + 1] ?? 0) + 1;
      mark[c] = (mark[c] ?? 0) - 1;
    }
  }
  const out: InlineRun[] = [];
  let b = 0;
  let it = 0;
  tokens.forEach((token, index) => {
    b += bold[index] ?? 0;
    it += italic[index] ?? 0;
    const isBold = b > 0;
    const isItalic = it > 0;
    if (token.type === 'text') out.push(plain(token.text, { bold: isBold, italic: isItalic }));
    else if (token.type === 'delim') {
      out.push(plain(token.char.repeat(token.count), { bold: isBold, italic: isItalic }));
    } else {
      for (const run of token.runs) {
        out.push({ ...run, bold: run.bold || isBold, italic: run.italic || isItalic });
      }
    }
  });
  return mergeRuns(out);
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const RULE = /^ {0,3}([-*_])( *\1){2,} *$/;
const ATX = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const QUOTE = /^ {0,3}> ?/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)]) +(.*)$/;
const SETEXT_1 = /^ {0,3}=+ *$/;
const SETEXT_2 = /^ {0,3}-+ *$/;

const isBlank = (line: string) => line.trim() === '';

/** A table's delimiter row: cells of dashes with optional colons, e.g. `|:--|:-:|--:|`. */
const TABLE_DELIMITER = /^ {0,3}\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** The cells of one table row: split on unescaped pipes, outer pipes dropped (`\|` is a pipe). */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string;
    if (ch === '\\' && line[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (ch === '\\' && line[i + 1] === '\\') {
      cell += '\\\\';
      i++;
    } else if (ch === '|') {
      cells.push(cell);
      cell = '';
    } else cell += ch;
  }
  cells.push(cell);
  const trimmed = cells.map((c) => c.trim());
  if (line.trim().startsWith('|')) trimmed.shift();
  if (line.trim().endsWith('|') && !/(?<!\\)(?:\\\\)*\\\|$/.test(line.trim())) trimmed.pop();
  return trimmed;
}

/** Whether `line` and the delimiter row after it open a table with the same column count. */
function opensTable(line: string, next: string | undefined): boolean {
  if (next === undefined || !line.includes('|') || !TABLE_DELIMITER.test(next)) return false;
  if (!next.includes('|')) return false;
  return splitRow(line).length === splitRow(next).length;
}

/** Whether `line` starts a block that may interrupt a paragraph (for lazy continuation). */
function startsBlock(line: string): boolean {
  return (
    FENCE.test(line) || RULE.test(line) || ATX.test(line) || QUOTE.test(line) || ITEM.test(line)
  );
}

/** Lines of one paragraph to inline text: hard breaks (two spaces, a backslash) become `\n`. */
function joinLines(lines: readonly string[]): string {
  let out = '';
  lines.forEach((raw, index) => {
    let line = raw.replace(/^\s+/, '');
    const last = index === lines.length - 1;
    let separator = ' ';
    if (/ {2,}$/.test(line) || /(?<!\\)\\$/.test(line)) separator = '\n';
    line = line.replace(/ +$/, '').replace(/(?<!\\)\\$/, '');
    out += last ? line : line + separator;
  });
  return out.replace(/\s+$/, '');
}

interface FlatItem {
  readonly indent: number;
  readonly content: number;
  readonly ordered: boolean;
  readonly number: number;
  readonly lines: string[];
}

interface MutableList {
  kind: 'list';
  ordered: boolean;
  start: number;
  items: { runs: InlineRun[]; children: MutableList[]; lines: string[]; content: number }[];
}

function buildLists(flat: readonly FlatItem[]): ListBlock[] {
  const roots: MutableList[] = [];
  const stack: { list: MutableList; indent: number }[] = [];
  for (const item of flat) {
    const top = stack[stack.length - 1];
    const parent = top?.list.items[top.list.items.length - 1];
    let target: MutableList | undefined;
    if (top && parent && item.indent >= parent.content) {
      target = { kind: 'list', ordered: item.ordered, start: item.number, items: [] };
      parent.children.push(target);
      stack.push({ list: target, indent: item.indent });
    } else {
      while (
        stack.length > 1 &&
        item.indent < (stack[stack.length - 1] as { indent: number }).indent
      ) {
        stack.pop();
      }
      const current = stack[stack.length - 1];
      if (current && stack.length === 1 && current.list.ordered !== item.ordered) {
        stack.pop();
      }
      target = stack[stack.length - 1]?.list;
      if (!target) {
        target = { kind: 'list', ordered: item.ordered, start: item.number, items: [] };
        roots.push(target);
        stack.push({ list: target, indent: item.indent });
      }
    }
    target.items.push({ runs: [], children: [], lines: item.lines, content: item.content });
  }
  const finish = (list: MutableList): ListBlock => ({
    kind: 'list',
    ordered: list.ordered,
    start: list.start,
    items: list.items.map((it) => ({
      runs: parseInline(joinLines(it.lines)),
      children: it.children.map(finish),
    })),
  });
  return roots.map(finish);
}

function parseBlocks(lines: readonly string[]): MdBlock[] {
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length > 0) blocks.push({ kind: 'paragraph', runs: parseInline(joinLines(para)) });
    para = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    const fence = FENCE.exec(line);
    if (fence) {
      flushPara();
      const marker = fence[1] as string;
      const indent = /^ */.exec(line)?.[0].length ?? 0;
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const current = lines[i] as string;
        const closing = new RegExp(`^ {0,3}\\${marker[0]}{${marker.length},} *$`).test(current);
        if (closing) {
          i++;
          break;
        }
        body.push(current.replace(new RegExp(`^ {0,${indent}}`), ''));
        i++;
      }
      blocks.push({ kind: 'code', lines: body });
      continue;
    }
    if (isBlank(line)) {
      flushPara();
      i++;
      continue;
    }
    if (opensTable(line, lines[i + 1])) {
      flushPara();
      const head = splitRow(line);
      const align = splitRow(lines[i + 1] as string).map((c): TableAlign => {
        const left = c.startsWith(':');
        const right = c.endsWith(':');
        return left && right ? 'center' : right ? 'right' : 'left';
      });
      const rows: InlineRun[][][] = [];
      i += 2;
      while (i < lines.length) {
        const current = lines[i] as string;
        if (isBlank(current) || startsBlock(current)) break;
        const cells = splitRow(current);
        rows.push(head.map((_, c) => parseInline(cells[c] ?? '')));
        i++;
      }
      blocks.push({ kind: 'table', align, head: head.map((c) => parseInline(c)), rows });
      continue;
    }
    if (para.length > 0 && SETEXT_1.test(line)) {
      blocks.push({ kind: 'heading', level: 1, runs: parseInline(joinLines(para)) });
      para = [];
      i++;
      continue;
    }
    if (para.length > 0 && SETEXT_2.test(line)) {
      blocks.push({ kind: 'heading', level: 2, runs: parseInline(joinLines(para)) });
      para = [];
      i++;
      continue;
    }
    if (RULE.test(line)) {
      flushPara();
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }
    const atx = ATX.exec(line);
    if (atx) {
      flushPara();
      blocks.push({
        kind: 'heading',
        level: (atx[1] as string).length as 1 | 2 | 3 | 4 | 5 | 6,
        runs: parseInline((atx[2] ?? '').trim()),
      });
      i++;
      continue;
    }
    if (QUOTE.test(line)) {
      flushPara();
      const inner: string[] = [];
      while (i < lines.length) {
        const current = lines[i] as string;
        if (QUOTE.test(current)) {
          inner.push(current.replace(QUOTE, ''));
        } else if (
          !isBlank(current) &&
          !startsBlock(current) &&
          inner.length > 0 &&
          !isBlank(inner[inner.length - 1] as string) &&
          !FENCE.test(inner[inner.length - 1] as string)
        ) {
          inner.push(current);
        } else break;
        i++;
      }
      blocks.push({ kind: 'quote', blocks: parseBlocks(inner) });
      continue;
    }
    if (ITEM.test(line)) {
      flushPara();
      const flat: FlatItem[] = [];
      while (i < lines.length) {
        const current = lines[i] as string;
        if (isBlank(current)) {
          let next = i + 1;
          while (next < lines.length && isBlank(lines[next] as string)) next++;
          if (
            next < lines.length &&
            ITEM.test(lines[next] as string) &&
            !RULE.test(lines[next] as string)
          ) {
            i = next;
            continue;
          }
          break;
        }
        const item = RULE.test(current) ? null : ITEM.exec(current);
        if (item) {
          const marker = item[2] as string;
          const indent = (item[1] as string).length;
          flat.push({
            indent,
            content:
              indent +
              marker.length +
              (/^ */.exec(item[0].slice(indent + marker.length))?.[0].length ?? 0),
            ordered: /\d/.test(marker),
            number: /\d/.test(marker) ? Number.parseInt(marker, 10) : 1,
            lines: [item[3] as string],
          });
        } else {
          const indented = (/^ */.exec(current)?.[0].length ?? 0) > 0;
          if (!indented && startsBlock(current)) break;
          if (flat.length === 0) break;
          (flat[flat.length - 1] as FlatItem).lines.push(current);
        }
        i++;
      }
      blocks.push(...buildLists(flat));
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  return blocks;
}

/** Parses Markdown (already decoded and normalised) into blocks. */
export function parseMarkdown(text: string): MdBlock[] {
  const sections = text.split('\f');
  if (sections.length > 1 && isBlank(sections[sections.length - 1] as string)) sections.pop();
  const blocks: MdBlock[] = [];
  sections.forEach((section, index) => {
    if (index > 0) blocks.push({ kind: 'pagebreak' });
    blocks.push(...parseBlocks(section.split('\n')));
  });
  return blocks;
}
