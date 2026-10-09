/**
 * Free text with an embedded Unicode font (M2-a, docs/plan/v1/PLAN.md §3.2 and W1-g: "Turkish
 * free text round-trips in Acrobat, pdf.js, PDFium").
 *
 * PDFium writes a FreeText's appearance in a standard-14 font with WinAnsi encoding, which has
 * no ğ, ş, ı or İ: it leaves those characters out of the appearance (engine README, "free-text").
 * For text WinAnsi cannot encode, the adapter replaces that appearance with this one: a one-page
 * PDF of the annotation's size, its text set in the bundled family closest to the box's
 * standard font (Helvetica → Inter, Times → Noto Serif, Courier → JetBrains Mono; the
 * assembler's `substituteFont` rule) as an embedded subset with a ToUnicode map, which the
 * adapter turns into the annotation's /AP (`EPDFAnnot_SetAppearanceFromPage`).
 *
 * - The layout follows PDFium's own FreeText appearance: left-aligned from the box's left edge,
 *   first baseline one ascent below the top, lines one ascent-plus-descent apart, words wrapped
 *   at the box's width (a word wider than the box breaks between characters), `\n` starts a
 *   line. The font's own ascent and descent are used.
 * - The font is registered under the /DA font name (`/Helv`, …), so the /DA font is in the
 *   appearance resources, as readers and the conformance check expect.
 * - /Contents keeps the text (a UTF-16 text string, written by PDFium), so the text a reader
 *   lists and edits is the same text the appearance shows.
 *
 * Text WinAnsi encodes keeps PDFium's appearance, unchanged.
 */
import type { Font } from '@cantoo/fontkit';
import {
  beginText,
  drawObject,
  endText,
  type PDFFont,
  PDFDocument,
  PDFName,
  popGraphicsState,
  pushGraphicsState,
  setFillingRgbColor,
  setFontAndSize,
  setGraphicsState,
  showText,
  moveText,
} from '@cantoo/pdf-lib';

import { bundledFace, type BundledFace } from '../fonts/font-catalog';
import { isWinAnsi } from '../pdfium/annotation-mapping';

/** Whether PDFium's WinAnsi appearance can show `text` (else this module writes one). */
export function freeTextFitsWinAnsi(text: string): boolean {
  return Array.from(text).every((ch) => ch === '\n' || ch === '\r' || isWinAnsi(ch));
}

/** The bundled face a FreeText's standard font family is set in when WinAnsi is not enough. */
export function freeTextFace(fontFamily: string | undefined): BundledFace {
  const f = (fontFamily ?? '').toLowerCase();
  if (f.includes('courier') || f.includes('mono')) return bundledFace('jetbrains-mono', 400);
  if ((f.includes('times') || f.includes('serif')) && !f.includes('sans')) {
    return bundledFace('noto-serif', 400);
  }
  return bundledFace('inter', 400);
}

/** Characters of `text` the face has no glyph for (they would show as boxes). */
export function missingCharacters(font: Font, text: string): string[] {
  const missing = new Set<string>();
  for (const ch of text) {
    if (ch === '\n' || ch === '\r' || ch === '\t') continue;
    if (!font.hasGlyphForCodePoint(ch.codePointAt(0) as number)) missing.add(ch);
  }
  return [...missing];
}

export interface FreeTextAppearanceInput {
  readonly text: string;
  readonly fontSize: number;
  /** `#rrggbb`. */
  readonly color: string;
  /** The annotation's opacity (/CA), 0–1. */
  readonly opacity?: number;
  /** The annotation's /Rect size, in points. */
  readonly width: number;
  readonly height: number;
  /** The font name in /DA (`Helv`, `TiRo`, `Cour`, …). */
  readonly daFont: string;
}

function rgbOf(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!m) return [0, 0, 0];
  return [1, 2, 3].map((i) => Number.parseInt(m[i] as string, 16) / 255) as [
    number,
    number,
    number,
  ];
}

/** `text` broken into lines no wider than `width` (PDFium's FreeText rule, see above). */
export function wrapFreeText(
  text: string,
  width: number,
  measure: (s: string) => number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let line = '';
    // Words keep their trailing space, as PDFium's lines do (trimmed when measured).
    for (const word of paragraph.split(/(?<= )/)) {
      if (line === '' || measure((line + word).trimEnd()) <= width) {
        line += word;
      } else {
        lines.push(line.trimEnd());
        line = word;
      }
      // A word wider than the box breaks between characters (at least one per line).
      while (measure(line.trimEnd()) > width && Array.from(line.trimEnd()).length > 1) {
        const chars = Array.from(line);
        let take = 1;
        while (take < chars.length && measure(chars.slice(0, take + 1).join('')) <= width) {
          take++;
        }
        lines.push(chars.slice(0, take).join('').trimEnd());
        line = chars.slice(take).join('');
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/**
 * The name `EPDFAnnot_SetAppearanceFromPage` (EmbedPDF 2.15) gives the form it wraps the page
 * in. It writes the appearance as two levels: the annotation's /AP /N stream, holding a copy of
 * the page's content with only `/XObject << /EPDFWRAP … >>` as resources, and that wrapper,
 * holding the page's content and resources. (For a stamp, EmbedPDF then rewrites the outer
 * content to draw the wrapper, `EPDFAnnot_UpdateAppearanceToRect`, which refuses a FreeText.)
 * So the page's content only draws, under this same name, a form with the text and the font:
 * from the outer stream that name is the wrapper, inside the wrapper it is the text form, and
 * both reach the text. The free-text tests fail if a later EmbedPDF names it differently.
 */
export const APPEARANCE_WRAPPER = 'EPDFWRAP';

/**
 * The one-page PDF (page = the annotation's box) whose page becomes the FreeText's appearance.
 * `fontBytes` is the face's TTF (`freeTextFace`); `fontkit` is passed in so the module stays
 * importable without it.
 */
export async function freeTextAppearancePdf(
  input: FreeTextAppearanceInput,
  fontBytes: Uint8Array,
  fontkit: unknown,
): Promise<ArrayBuffer> {
  const width = Math.max(input.width, 1);
  const height = Math.max(input.height, 1);
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit as Parameters<PDFDocument['registerFontkit']>[0]);
  const page = doc.addPage([width, height]);
  const font: PDFFont = await doc.embedFont(fontBytes, { subset: true });
  const size = input.fontSize;
  const measure = (s: string) => font.widthOfTextAtSize(s, size);
  const metrics = (fontkit as { create(bytes: Uint8Array): Font }).create(fontBytes);
  const ascent = (metrics.ascent / metrics.unitsPerEm) * size;
  const descent = (metrics.descent / metrics.unitsPerEm) * size;
  const leading = ascent - descent;

  const ops = [pushGraphicsState()];
  const { context } = doc;
  const resources = context.obj({ Font: context.obj({ [input.daFont]: font.ref }) });
  const opacity = input.opacity ?? 1;
  if (opacity < 1) {
    const gs = context.obj({ Type: 'ExtGState', CA: opacity, ca: opacity });
    resources.set(PDFName.of('ExtGState'), context.obj({ GS: gs }));
    ops.push(setGraphicsState('GS'));
  }
  const [r, g, b] = rgbOf(input.color);
  ops.push(beginText(), setFillingRgbColor(r, g, b), setFontAndSize(input.daFont, size));
  const lines = wrapFreeText(input.text, width, measure);
  lines.forEach((line, index) => {
    ops.push(index === 0 ? moveText(0, height - ascent) : moveText(0, -leading));
    if (line !== '') ops.push(showText(font.encodeText(line)));
  });
  ops.push(endText(), popGraphicsState());
  // The text is a form of its own, drawn by the page under the wrapper's name (see
  // `APPEARANCE_WRAPPER`), so both levels of the appearance EmbedPDF builds reach it.
  const text = doc.context.formXObject(ops, {
    BBox: [0, 0, width, height],
    Resources: resources,
  });
  page.node.setXObject(PDFName.of(APPEARANCE_WRAPPER), doc.context.register(text));
  page.pushOperators(pushGraphicsState(), drawObject(APPEARANCE_WRAPPER), popGraphicsState());
  const bytes = await doc.save();
  return bytes.slice().buffer;
}
