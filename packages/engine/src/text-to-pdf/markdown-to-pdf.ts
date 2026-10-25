/**
 * Markdown to a PDF (PRD-28), on the layout of plain text (PRD-19): real, extractable text in the
 * bundled Noto Sans at 11 pt / 1.4, 72 pt margins, A4 by default. Paragraphs, headings, list
 * items and quotes are broken by the paragraph line-breaker with styled spans (bold and italic
 * are synthetic, as the assembler sets them: stroke and skew); code is JetBrains Mono, wrapped by
 * character in a grey box. Headings follow the UI type scale to an 11 pt body (H4 stays at least
 * 1.15 × body so PDF to Markdown still reads H1 to H4 back). Links are blue and underlined; http,
 * https and mailto ones also get a URI Link annotation.
 */
import {
  type Color,
  degrees,
  grayscale,
  type PDFFont,
  PDFDocument,
  type PDFPage,
  PDFString,
  rgb,
  TextRenderingMode,
} from '@cantoo/pdf-lib';

import {
  bundledFace,
  loadBundledFont,
  SYNTHETIC_BOLD_STROKE,
  SYNTHETIC_ITALIC_DEGREES,
} from '../fonts';
import { layoutParagraph } from '../text-edit/linebreak';
import { decodeTextBytes, normalizeText } from './decode';
import {
  type InlineRun,
  type ListBlock,
  type MdBlock,
  parseMarkdown,
  type TableBlock,
} from './markdown-parse';
import {
  isDropped,
  TEXT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
  TEXT_MARGIN,
  TEXT_PAGE_SIZE,
  type TextToPdfOptions,
} from './text-to-pdf';

/** Heading sizes H1 to H6 (points): the UI type scale against an 11 pt body (PRD-28). */
const HEADING_SIZE = [24, 18.5, 14.5, 13, 11, 11] as const;
const HEADING_LINE = 1.25;
const BLOCK_GAP = 8;
const HEADING_AFTER = 4;
const ITEM_GAP = 2;
const LIST_STEP = 18;
const MARKER_GAP = 4;
const QUOTE_INDENT = 14;
const CODE_PADDING = 6;
const LINK_COLOR = rgb(0.07, 0.36, 0.78);
const TABLE_SIZE = 10;
const TABLE_LINE = 1.35;
const CELL_PAD_X = 6;
const CELL_PAD_Y = 4;
const TABLE_BORDER = grayscale(0.8);
const SAFE_LINK = /^(https?:|mailto:)/i;

interface Face {
  readonly font: PDFFont;
  readonly supported: ReadonlySet<number>;
}

interface RunStyle {
  readonly face: Face;
  readonly size: number;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly color: Color;
  readonly href?: string;
}

interface Context {
  /** Left edge of the content, from the margin (points). */
  readonly indent: number;
  readonly color: number;
}

function hasCode(blocks: readonly MdBlock[]): boolean {
  const inList = (list: ListBlock): boolean =>
    list.items.some((i) => i.runs.some((r) => r.code) || i.children.some(inList));
  return blocks.some((b) => {
    if (b.kind === 'code') return true;
    if (b.kind === 'quote') return hasCode(b.blocks);
    if (b.kind === 'list') return inList(b);
    if (b.kind === 'table') {
      return [b.head, ...b.rows].some((row) => row.some((cell) => cell.some((r) => r.code)));
    }
    if (b.kind === 'heading' || b.kind === 'paragraph') return b.runs.some((r) => r.code);
    return false;
  });
}

/**
 * Wraps one code line to `columns` characters: at the last space before the edge, by character
 * only inside an unbroken run; continuation lines keep the source line's own leading indent.
 */
export function wrapCode(chars: readonly string[], columns: number): string[] {
  if (chars.length === 0) return [''];
  let lead = 0;
  while (chars[lead] === ' ') lead++;
  const pad = new Array<string>(Math.min(lead, Math.floor(columns / 2))).fill(' ');
  const out: string[] = [];
  let seg = [...chars];
  while (seg.length > columns) {
    let segLead = 0;
    while (seg[segLead] === ' ') segLead++;
    let cut = -1;
    for (let k = columns; k > segLead; k--) {
      if (seg[k] === ' ') {
        cut = k;
        break;
      }
    }
    let rest: string[];
    if (cut > 0) {
      out.push(seg.slice(0, cut).join('').trimEnd());
      let next = cut;
      while (seg[next] === ' ') next++;
      rest = seg.slice(next);
    } else {
      out.push(seg.slice(0, columns).join(''));
      rest = seg.slice(columns);
    }
    if (rest.length === 0) return out;
    seg = [...pad, ...rest];
  }
  out.push(seg.join(''));
  return out;
}

/** Converts the bytes of a Markdown file to PDF bytes. */
export async function markdownToPdf(
  bytes: Uint8Array,
  options: TextToPdfOptions = {},
): Promise<Uint8Array> {
  const pageSize = options.pageSize ?? TEXT_PAGE_SIZE;
  const text = Array.from(normalizeText(decodeTextBytes(bytes)))
    .filter((c) => !isDropped(c.codePointAt(0) ?? 0))
    .join('');
  const blocks = parseMarkdown(text);
  const [sansBytes, monoBytes, { default: fontkit }] = await Promise.all([
    loadBundledFont(bundledFace('noto-sans', 400)),
    hasCode(blocks) ? loadBundledFont(bundledFace('jetbrains-mono', 400)) : undefined,
    import('@cantoo/fontkit'),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const embed = async (data: Uint8Array): Promise<Face> => {
    const font = await doc.embedFont(data, { subset: true });
    return { font, supported: new Set(font.getCharacterSet()) };
  };
  const sans = await embed(sansBytes);
  const mono = monoBytes ? await embed(monoBytes) : undefined;

  const measureWidth = pageSize.width - 2 * TEXT_MARGIN;
  const top = pageSize.height - TEXT_MARGIN;
  let page: PDFPage = doc.addPage([pageSize.width, pageSize.height]);
  let y = top;
  /** The gap the next element wants above it; dropped at the top of a page. */
  let pending = 0;
  /** What the last block ended with: text lines, or a box edge (code box, quote bar, rule). */
  let prev: 'none' | 'text' | 'box' = 'none';
  /** Half the leading of a body line: the white inside a text line box above and below the ink. */
  const tuck = (TEXT_FONT_SIZE * TEXT_LINE_HEIGHT - TEXT_FONT_SIZE) / 2;
  /** Called when a page break happens inside a decorated block (the quote bar). */
  const breakListeners: ((bottom: number) => void)[] = [];

  const space = (gap: number) => {
    pending = Math.max(pending, gap);
  };
  const newPage = () => {
    for (const listener of breakListeners) listener(y);
    page = doc.addPage([pageSize.width, pageSize.height]);
    y = top;
    pending = 0;
  };
  /** Makes room for `height` more points (with the pending gap), starting a page if needed. */
  const reserve = (height: number) => {
    if (y < top && y - pending - height < TEXT_MARGIN - 1e-6) newPage();
    if (y < top) y -= pending;
    pending = 0;
  };

  const widthCache = new Map<PDFFont, Map<string, number>>();
  const advanceOf = (font: PDFFont, size: number) => {
    let bySize = widthCache.get(font);
    if (!bySize) {
      bySize = new Map<string, number>();
      widthCache.set(font, bySize);
    }
    return (char: string): number => {
      const key = `${size}|${char}`;
      let w = bySize.get(key);
      if (w === undefined) bySize.set(key, (w = font.widthOfTextAtSize(char, size)));
      return w;
    };
  };
  const safeText = (face: Face, value: string) =>
    Array.from(value, (c) =>
      c === '\n' || face.supported.has(c.codePointAt(0) ?? 0) ? c : '?',
    ).join('');

  const drawRun = (value: string, x: number, baseline: number, style: RunStyle) => {
    const size = style.size;
    page.drawText(value, {
      x,
      y: baseline,
      font: style.face.font,
      size,
      color: style.color,
      ...(style.bold
        ? {
            renderMode: TextRenderingMode.FillAndOutline,
            strokeWidth: size * SYNTHETIC_BOLD_STROKE,
            strokeColor: style.color,
          }
        : {}),
      // pdf-lib turns tan(ySkew) into the matrix entry that leans the glyphs right.
      ...(style.italic ? { ySkew: degrees(SYNTHETIC_ITALIC_DEGREES) } : {}),
    });
    const visible = value.replace(/\s+$/, '');
    if (style.href === undefined || visible === '') return;
    const width = style.face.font.widthOfTextAtSize(visible, size);
    page.drawLine({
      start: { x, y: baseline - 1.5 },
      end: { x: x + width, y: baseline - 1.5 },
      thickness: 0.5,
      color: style.color,
    });
    if (SAFE_LINK.test(style.href)) {
      const ref = doc.context.register(
        doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x, baseline - 0.25 * size, x + width, baseline + 0.85 * size],
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: PDFString.of(style.href) },
        }),
      );
      page.node.addAnnot(ref);
    }
  };

  /**
   * Breaks styled runs into lines between `left` and `right` (from the left margin). `size` is
   * the flow's size, `factor` its line height. Nothing is drawn; `drawLine` does that.
   */
  const typeset = (
    runs: readonly InlineRun[],
    opts: {
      readonly left: number;
      readonly right: number;
      readonly size: number;
      readonly factor: number;
      readonly bold: boolean;
      readonly grey: number | undefined;
      readonly align?: 'left' | 'center' | 'right';
    },
  ) => {
    const lineHeight = opts.size * opts.factor;
    const styles = new Map<string, RunStyle>();
    const hrefs: string[] = [];
    const layoutStyles: Record<
      string,
      { advances: Record<string, { spaced: number; plain: number }>; wordGap: number }
    > = {};
    let combined = '';
    const spans: { start: number; end: number; style: string }[] = [];
    for (const run of runs) {
      const face = run.code && mono ? mono : sans;
      const size = run.code ? Math.round(opts.size * 0.9 * 2) / 2 : opts.size;
      let link = -1;
      if (run.href !== undefined) {
        link = hrefs.indexOf(run.href);
        if (link < 0) link = hrefs.push(run.href) - 1;
      }
      const bold = opts.bold || run.bold;
      const id = `${run.code ? 'm' : 's'}|${size}|${bold ? 1 : 0}|${run.italic ? 1 : 0}|${link}`;
      if (!styles.has(id)) {
        styles.set(id, {
          face,
          size,
          bold,
          italic: run.italic,
          color: run.href !== undefined ? LINK_COLOR : grayscale(opts.grey ?? 0),
          ...(run.href !== undefined ? { href: run.href } : {}),
        });
        layoutStyles[id] = { advances: {}, wordGap: advanceOf(face.font, size)(' ') };
      }
      const value = safeText(face, run.text);
      const advance = advanceOf(face.font, size);
      const table = (
        layoutStyles[id] as { advances: Record<string, { spaced: number; plain: number }> }
      ).advances;
      for (const char of new Set(value)) {
        const w = char === '\n' ? 0 : advance(char);
        table[char] = { spaced: w, plain: w };
      }
      if (value === '') continue;
      spans.push({ start: combined.length, end: combined.length + value.length, style: id });
      combined += value;
    }
    if (combined.trim() === '' || spans.length === 0) return undefined;
    const first = spans[0] as { style: string };
    const layout = layoutParagraph(
      {
        text: '',
        spans: [],
        lines: [{ start: 0, y: 0 }],
        styles: layoutStyles,
        measure: { left: opts.left, right: opts.right },
        align: opts.align ?? 'left',
        leading: lineHeight,
      },
      { start: 0, end: 0, text: combined, style: first.style, spans },
    );
    return { lines: layout.lines, styles, lineHeight };
  };

  /** Draws the runs of one typeset line, its box top at `top`, `x0` from the page edge. */
  const drawLine = (
    set: NonNullable<ReturnType<typeof typeset>>,
    index: number,
    lineTop: number,
    size: number,
  ) => {
    const baseline = lineTop - (set.lineHeight + 0.7 * size) / 2;
    for (const run of set.lines[index]?.runs ?? []) {
      const style = set.styles.get(run.style);
      if (style && run.text !== '') drawRun(run.text, TEXT_MARGIN + run.x, baseline, style);
    }
    return baseline;
  };

  /**
   * Sets styled runs as wrapped lines with the content between `left` and the right margin.
   * `onFirstLine` gets the first baseline (list markers). `base` is the flow's size, `factor`
   * its line height.
   */
  const flow = (
    runs: readonly InlineRun[],
    opts: {
      readonly left: number;
      readonly size: number;
      readonly factor: number;
      readonly bold: boolean;
      readonly grey: number | undefined;
      readonly keepWith?: number;
      readonly onFirstLine?: (baseline: number) => void;
    },
  ) => {
    const set = typeset(runs, { ...opts, right: measureWidth });
    if (!set) return;
    if (prev === 'box' && pending <= BLOCK_GAP) pending = Math.max(0, pending - tuck);
    set.lines.forEach((_, index) => {
      reserve(set.lineHeight + (index === 0 ? (opts.keepWith ?? 0) : 0));
      const baseline = drawLine(set, index, y, opts.size);
      if (index === 0) opts.onFirstLine?.(baseline);
      y -= set.lineHeight;
    });
    prev = 'text';
  };

  const body = (
    runs: readonly InlineRun[],
    ctx: Context,
    left: number,
    extra: { readonly onFirstLine?: (baseline: number) => void } = {},
  ) =>
    flow(runs, {
      left,
      size: TEXT_FONT_SIZE,
      factor: TEXT_LINE_HEIGHT,
      bold: false,
      grey: ctx.color === 0 ? undefined : ctx.color,
      ...extra,
    });

  const renderList = (list: ListBlock, level: number, ctx: Context) => {
    const left = ctx.indent + LIST_STEP * (Math.min(level, 2) + 1);
    space(level === 0 ? 0 : ITEM_GAP);
    list.items.forEach((item, index) => {
      const marker = list.ordered ? `${list.start + index}.` : level === 0 ? '•' : '–';
      const markerRuns: InlineRun[] = [{ text: marker, bold: false, italic: false, code: false }];
      body(
        item.runs.length > 0 ? item.runs : [{ text: ' ', bold: false, italic: false, code: false }],
        ctx,
        left,
        {
          onFirstLine: (baseline: number) => {
            const style: RunStyle = {
              face: sans,
              size: TEXT_FONT_SIZE,
              bold: false,
              italic: false,
              color: grayscale(ctx.color),
            };
            const text = safeText(sans, (markerRuns[0] as InlineRun).text);
            const w = sans.font.widthOfTextAtSize(text, TEXT_FONT_SIZE);
            drawRun(text, TEXT_MARGIN + left - MARKER_GAP - w, baseline, style);
          },
        },
      );
      space(ITEM_GAP);
      for (const child of item.children) renderList(child, level + 1, ctx);
      space(ITEM_GAP);
    });
    if (level === 0) pending = BLOCK_GAP;
  };

  const renderCode = (lines: readonly string[], ctx: Context) => {
    if (lines.length === 0) return;
    if (prev === 'text') pending = Math.max(0, pending - tuck);
    const face = mono ?? sans;
    const size = Math.round(TEXT_FONT_SIZE * 0.9 * 2) / 2;
    const lineHeight = size * TEXT_LINE_HEIGHT;
    const x = TEXT_MARGIN + ctx.indent;
    const inner = measureWidth - ctx.indent - 2 * CODE_PADDING;
    const advance = face.font.widthOfTextAtSize('0', size);
    const columns = Math.max(1, Math.floor(inner / advance));
    const wrapped: string[] = [];
    for (const raw of lines) wrapped.push(...wrapCode(Array.from(safeText(face, raw)), columns));
    let done = 0;
    while (done < wrapped.length) {
      let available = Math.floor(
        (y - (y < top ? pending : 0) - 2 * CODE_PADDING - TEXT_MARGIN + 1e-6) / lineHeight,
      );
      if (available < 1 && y < top) {
        newPage();
        available = Math.floor((y - 2 * CODE_PADDING - TEXT_MARGIN) / lineHeight);
      }
      const count = Math.max(1, Math.min(available, wrapped.length - done));
      const height = count * lineHeight + 2 * CODE_PADDING;
      reserve(0);
      page.drawRectangle({
        x,
        y: y - height,
        width: measureWidth - ctx.indent,
        height,
        color: grayscale(0.95),
      });
      const style: RunStyle = {
        face,
        size,
        bold: false,
        italic: false,
        color: grayscale(ctx.color),
      };
      for (let k = 0; k < count; k++) {
        const line = wrapped[done + k] as string;
        const baseline = y - CODE_PADDING - k * lineHeight - (lineHeight + 0.7 * size) / 2;
        if (line.trim() !== '') drawRun(line, x + CODE_PADDING, baseline, style);
      }
      y -= height;
      done += count;
      if (done < wrapped.length) newPage();
    }
    pending = BLOCK_GAP;
    prev = 'box';
  };

  /**
   * The widest line and the longest unbreakable word of a cell (points, at the table size). A
   * word wider than `cap` counts only as its longest piece between `/ - _ .`, so a URL or a path
   * does not make its column (and every other) shrink below the short words (PRD-30).
   */
  const cellExtent = (runs: readonly InlineRun[], cap: number) => {
    let widest = 0;
    let line = 0;
    let longest = 0;
    let word = 0;
    let piece = 0;
    let longestPiece = 0;
    const endWord = () => {
      longest = Math.max(longest, word <= cap ? word : Math.max(longestPiece, piece));
      word = 0;
      piece = 0;
      longestPiece = 0;
    };
    for (const run of runs) {
      const face = run.code && mono ? mono : sans;
      const advance = advanceOf(
        face.font,
        run.code ? Math.round(TABLE_SIZE * 0.9 * 2) / 2 : TABLE_SIZE,
      );
      for (const char of safeText(face, run.text)) {
        if (char === '\n') {
          widest = Math.max(widest, line);
          line = 0;
          endWord();
          continue;
        }
        const w = advance(char);
        line += w;
        if (/\s/.test(char)) endWord();
        else {
          word += w;
          piece += w;
          if ('/-_.'.includes(char)) {
            longestPiece = Math.max(longestPiece, piece);
            piece = 0;
          }
        }
      }
    }
    endWord();
    return { widest: Math.max(widest, line), longest };
  };

  /**
   * A GFM table (PRD-30): columns take their natural width when the table fits (stretched to the
   * full measure from 70 % of it), else each keeps its longest word (a very long one counts as
   * its longest piece, capped at a third of the measure) and shares the rest by how much more it
   * wants; only a column whose word cannot fit breaks it. Cells wrap inside their column. The
   * header row is shaded and repeated on every page, and kept with the first body row. A row
   * taller than a page minus the header is cut with "…" on its last line.
   */
  const renderTable = (table: TableBlock, ctx: Context) => {
    const avail = measureWidth - ctx.indent;
    const cap = avail / 3;
    const all = [table.head, ...table.rows];
    const wants = table.head.map((_, c) => {
      let widest = 0;
      let longest = 0;
      for (const cells of all) {
        const e = cellExtent(cells[c] ?? [], cap);
        widest = Math.max(widest, e.widest);
        longest = Math.max(longest, e.longest);
      }
      widest += 2 * CELL_PAD_X;
      longest += 2 * CELL_PAD_X;
      return { widest, longest: Math.min(longest, widest) };
    });
    const sumWidest = wants.reduce((n, w) => n + w.widest, 0);
    const sumLongest = wants.reduce((n, w) => n + w.longest, 0);
    let widths: number[];
    if (sumWidest <= avail) {
      const stretch = sumWidest >= 0.7 * avail ? avail / sumWidest : 1;
      widths = wants.map((w) => w.widest * stretch);
    } else if (sumLongest >= avail) {
      // Water-fill: columns whose longest word is under the level keep it, the rest share.
      let level = avail / wants.length;
      for (const _ of wants) {
        let kept = 0;
        let rest = 0;
        for (const w of wants) {
          if (w.longest <= level) kept += w.longest;
          else rest++;
        }
        const next = rest === 0 ? level : (avail - kept) / rest;
        if (Math.abs(next - level) < 1e-6) break;
        level = next;
      }
      widths = wants.map((w) => Math.min(w.longest, level));
    } else {
      const spare = sumWidest - sumLongest;
      widths = wants.map(
        (w) => w.longest + ((avail - sumLongest) * (w.widest - w.longest)) / spare,
      );
    }
    const lefts = widths.map((_, c) => ctx.indent + widths.slice(0, c).reduce((n, w) => n + w, 0));
    const lineHeight = TABLE_SIZE * TABLE_LINE;
    const ellipsis = sans.supported.has(0x2026) ? '\u2026' : '...';

    const measure = (cells: readonly (readonly InlineRun[])[], head: boolean) => {
      const sets = widths.map((w, c) =>
        typeset(cells[c] ?? [], {
          left: (lefts[c] as number) + CELL_PAD_X,
          right: (lefts[c] as number) + w - CELL_PAD_X,
          size: TABLE_SIZE,
          factor: TABLE_LINE,
          bold: head,
          grey: ctx.color === 0 ? undefined : ctx.color,
          align: table.align[c] ?? 'left',
        }),
      );
      const count = Math.max(1, ...sets.map((set) => set?.lines.length ?? 0));
      return { sets, count, head };
    };
    const headRow = measure(table.head, true);
    const headHeight = headRow.count * lineHeight + 2 * CELL_PAD_Y;
    const maxLines = Math.max(
      1,
      Math.floor((top - TEXT_MARGIN - headHeight - 2 * CELL_PAD_Y) / lineHeight),
    );

    const draw = (row: ReturnType<typeof measure>) => {
      const cut = row.count > maxLines && !row.head;
      const count = cut ? maxLines : row.count;
      const height = count * lineHeight + 2 * CELL_PAD_Y;
      reserve(height);
      widths.forEach((w, c) => {
        page.drawRectangle({
          x: TEXT_MARGIN + (lefts[c] as number),
          y: y - height,
          width: w,
          height,
          color: grayscale(row.head ? 0.9 : 1),
          borderColor: TABLE_BORDER,
          borderWidth: 0.5,
        });
        const set = row.sets[c];
        if (!set) return;
        const shown = cut && set.lines.length > count ? count - 1 : count;
        for (let k = 0; k < Math.min(shown, set.lines.length); k++)
          drawLine(set, k, y - CELL_PAD_Y - k * lineHeight, TABLE_SIZE);
        if (cut && set.lines.length > count)
          drawRun(
            ellipsis,
            TEXT_MARGIN + (lefts[c] as number) + CELL_PAD_X,
            y - CELL_PAD_Y - shown * lineHeight - (lineHeight + 0.7 * TABLE_SIZE) / 2,
            {
              face: sans,
              size: TABLE_SIZE,
              bold: false,
              italic: false,
              color: grayscale(ctx.color),
            },
          );
      });
      y -= height;
    };

    const first = table.rows[0] ? measure(table.rows[0], false) : undefined;
    const firstHeight = first ? Math.min(first.count, maxLines) * lineHeight + 2 * CELL_PAD_Y : 0;
    reserve(headHeight + firstHeight);
    draw(headRow);
    if (first) draw(first);
    for (let i = 1; i < table.rows.length; i++) {
      const row = measure(table.rows[i] as readonly (readonly InlineRun[])[], false);
      const before = page;
      reserve(Math.min(row.count, maxLines) * lineHeight + 2 * CELL_PAD_Y);
      if (page !== before) draw(headRow);
      draw(row);
    }
    pending = BLOCK_GAP;
    prev = 'box';
  };

  const renderBlocks = (list: readonly MdBlock[], ctx: Context) => {
    for (const block of list) {
      switch (block.kind) {
        case 'heading': {
          const size = HEADING_SIZE[block.level - 1] as number;
          space(0.9 * size);
          flow(block.runs, {
            left: ctx.indent,
            size,
            factor: HEADING_LINE,
            bold: true,
            grey: block.level === 6 ? 0.35 : ctx.color === 0 ? undefined : ctx.color,
            keepWith: TEXT_FONT_SIZE * TEXT_LINE_HEIGHT,
          });
          pending = HEADING_AFTER;
          break;
        }
        case 'paragraph':
          body(block.runs, ctx, ctx.indent);
          space(BLOCK_GAP);
          break;
        case 'list':
          renderList(block, 0, ctx);
          break;
        case 'code':
          renderCode(block.lines, ctx);
          break;
        case 'table':
          renderTable(block, ctx);
          break;
        case 'quote': {
          if (prev === 'text') pending = Math.max(0, pending - tuck);
          let barTop = y < top ? y - pending : top;
          let started = false;
          const bar = (bottom: number) => {
            if (!started || bottom >= barTop) return;
            page.drawRectangle({
              x: TEXT_MARGIN + ctx.indent + 2,
              y: bottom,
              width: 2,
              height: barTop - bottom,
              color: grayscale(0.75),
            });
          };
          const listener = (bottom: number) => {
            bar(bottom);
            barTop = top;
          };
          breakListeners.push(listener);
          started = true;
          prev = 'none';
          renderBlocks(block.blocks, { indent: ctx.indent + QUOTE_INDENT, color: 0.3 });
          breakListeners.pop();
          bar(y);
          space(BLOCK_GAP);
          prev = 'box';
          break;
        }
        case 'rule':
          space(prev === 'text' ? BLOCK_GAP - tuck : BLOCK_GAP);
          reserve(0.75);
          page.drawLine({
            start: { x: TEXT_MARGIN + ctx.indent, y },
            end: { x: pageSize.width - TEXT_MARGIN, y },
            thickness: 0.75,
            color: grayscale(0.8),
          });
          pending = BLOCK_GAP;
          prev = 'box';
          break;
        case 'pagebreak':
          newPage();
          prev = 'none';
          break;
      }
    }
  };

  renderBlocks(blocks, { indent: 0, color: 0 });
  if (options.title !== undefined) doc.setTitle(options.title);
  return doc.save();
}
