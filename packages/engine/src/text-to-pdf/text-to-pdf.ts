/**
 * Plain text to a PDF (conversion memo step 2, PRD-19): real, extractable text set in the
 * bundled Noto Sans, 11 pt, line height 1.4, 72 pt margins, A4 by default.
 *
 * - Each source line is a paragraph, wrapped by the paragraph line-breaker (`layoutParagraph`:
 *   UAX #14 opportunities, greedy first fit, a word wider than the measure breaks by
 *   character) measured with the embedded font's own advances. Blank lines are kept.
 * - A form feed starts a new page. An empty file is one blank page.
 * - Characters Noto Sans lacks are set as "?"; control characters are dropped.
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import { DEFAULT_PAGE_SIZE } from '@pdf-editor/document-model';

import { bundledFace, loadBundledFont } from '../fonts';
import { type LayoutInput, layoutParagraph } from '../text-edit/linebreak';
import { decodeTextBytes, normalizeText } from './decode';

export const TEXT_FONT_SIZE = 11;
export const TEXT_LINE_HEIGHT = 1.4;
export const TEXT_MARGIN = 72;
/** The page size every new document has (A4). */
export const TEXT_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export interface TextToPdfOptions {
  readonly pageSize?: { readonly width: number; readonly height: number };
  /** Title for the document information dictionary. */
  readonly title?: string;
}

/** Controls except LF and FF, C1, zero-width marks, line and paragraph separators, BOM. */
function isDropped(code: number): boolean {
  if (code === 0x0a || code === 0x0c) return false;
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0xfeff
  );
}

function wrapParagraph(line: string, advance: (char: string) => number, measure: number): string[] {
  if (line.trim() === '') return [''];
  const advances: Record<string, { spaced: number; plain: number }> = {};
  for (const char of new Set(line)) {
    const width = advance(char);
    advances[char] = { spaced: width, plain: width };
  }
  const input: LayoutInput = {
    text: '',
    spans: [],
    lines: [{ start: 0, y: 0 }],
    styles: { t: { advances, wordGap: advance(' ') } },
    measure: { left: 0, right: measure },
    align: 'left',
    leading: TEXT_FONT_SIZE * TEXT_LINE_HEIGHT,
  };
  return layoutParagraph(input, { start: 0, end: 0, text: line }).lines.map((l) => l.text);
}

/** The wrapped lines of each page for `text` (decoded, normalised, characters supported). */
export function paginate(
  text: string,
  advance: (char: string) => number,
  size: { readonly width: number; readonly height: number },
): string[][] {
  const measure = size.width - 2 * TEXT_MARGIN;
  const perPage = Math.max(
    1,
    Math.floor((size.height - 2 * TEXT_MARGIN) / (TEXT_FONT_SIZE * TEXT_LINE_HEIGHT)),
  );
  const sections = text.split('\f');
  if (sections.length > 1 && sections[sections.length - 1] === '') sections.pop();
  const pages: string[][] = [];
  for (const section of sections) {
    const body = section.endsWith('\n') ? section.slice(0, -1) : section;
    const lines =
      body === '' ? [] : body.split('\n').flatMap((l) => wrapParagraph(l, advance, measure));
    for (let i = 0; i === 0 || i < lines.length; i += perPage) {
      pages.push(lines.slice(i, i + perPage));
    }
  }
  return pages;
}

/** Converts the bytes of a text file to PDF bytes. */
export async function textToPdf(
  bytes: Uint8Array,
  options: TextToPdfOptions = {},
): Promise<Uint8Array> {
  const size = options.pageSize ?? TEXT_PAGE_SIZE;
  const text = Array.from(normalizeText(decodeTextBytes(bytes)))
    .filter((c) => !isDropped(c.codePointAt(0) ?? 0))
    .join('');
  const [fontBytes, { default: fontkit }] = await Promise.all([
    loadBundledFont(bundledFace('noto-sans', 400)),
    import('@cantoo/fontkit'),
  ]);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const safe = Array.from(text, (c) =>
    c === '\f' || c === '\n' || supported.has(c.codePointAt(0) ?? 0) ? c : '?',
  ).join('');
  const widths = new Map<string, number>();
  const advance = (char: string) => {
    let w = widths.get(char);
    if (w === undefined) {
      w = font.widthOfTextAtSize(char, TEXT_FONT_SIZE);
      widths.set(char, w);
    }
    return w;
  };
  const lineHeight = TEXT_FONT_SIZE * TEXT_LINE_HEIGHT;
  for (const lines of paginate(safe, advance, size)) {
    const page = doc.addPage([size.width, size.height]);
    let y = size.height - TEXT_MARGIN - (lineHeight + TEXT_FONT_SIZE * 0.7) / 2;
    for (const line of lines) {
      if (line !== '') page.drawText(line, { x: TEXT_MARGIN, y, font, size: TEXT_FONT_SIZE });
      y -= lineHeight;
    }
  }
  if (options.title !== undefined) doc.setTitle(options.title);
  return doc.save();
}
