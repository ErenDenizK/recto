/**
 * Real-world-like pages for the text-edit corpus (craft spec §4.1, §10):
 * `test/fixtures/text-edit-corpus/` next to the Chromium-printed pages of
 * `text-edit-corpus.ts`. Each page imitates how a family of producers writes paragraphs, the
 * shapes that most often break a paragraph editor:
 *
 * - `word-export.pdf`: Word / LibreOffice "Save as PDF": simple TrueType subsets (only the
 *   glyphs used), `TJ` arrays with per-pair kerning, justified lines with the extra width in
 *   `TJ` offsets after each space (one `BT`/`ET` per line) or by `Tw` (one `BT` with `Td`).
 * - `per-glyph.pdf`: Quartz / Skia: one `Tj` per glyph at an absolute `Tm`, a Type0 Identity-H
 *   subset; the Quartz paragraph has no space glyphs, the Skia one sits under a flipped `cm`.
 * - `cid-turkish.pdf`: Turkish paragraphs in Type0 Identity-H subsets with `/ToUnicode` (one hex
 *   `Tj` per line, as pdf-lib and many server-side generators write); the subsets lack letters
 *   a user may type (Ğ, Ö, digits), so editing needs font fallback.
 * - `spacing-ops.pdf`: `Tc`, `Tz`, `Tw` and `TL`/`T*`/`'` paragraphs.
 * - `rotated-paragraph.pdf`: a `/Rotate 90` page drawn in landscape through a page-level `cm`.
 * - `tight-columns.pdf`: two justified columns 6 pt apart.
 * - `type3-line.pdf`: a Type3 line between two Helvetica paragraphs.
 * - `ocr-layer.pdf`: a scanned paragraph (a greyscale image) under invisible (`3 Tr`) text.
 *
 * Every text is fictional; fonts come from `packages/engine/assets/fonts` (SIL OFL 1.1).
 * Content streams are written by hand, so every line and baseline is known; each paragraph is
 * recorded in `expect.paragraphs`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type PDFDocument, type PDFFont, type PDFRef, degrees } from '@cantoo/pdf-lib';

import {
  type Built,
  type FixtureDef,
  LETTER,
  box,
  name,
  newDoc,
  round2,
  save,
} from './lib/build.ts';
import type {
  CorpusParagraphExpectation,
  FontExpectation,
  ManifestEntry,
  PageExpectation,
} from './lib/common.ts';
import { Canvas } from './lib/raster.ts';
import {
  FONT_DIR,
  type FkFont,
  helvetica,
  loadFontkit,
  simpleTrueType,
  type3Font,
} from './m4-fixtures.ts';

const DIR = 'text-edit-corpus';
const LETTER_BOX = box(0, 0, 612, 792);
/** What an editor user may type: the alphabet checked for `missingGlyphs`. */
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789çğıöşüÇĞİÖŞÜ';
/** WinAnsiEncoding cannot encode these Turkish letters. */
const NOT_WIN_ANSI = 'ğışĞİŞ';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Number as written into content streams (at most 2 decimals). */
function f(n: number): string {
  return String(round2(n));
}

/** PDF literal string (ASCII). */
function lit(value: string): string {
  return `(${value.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

/** A font on the page: advances and kerning in 1000ths of an em, its string encoding. */
interface Face {
  readonly key: string;
  advance(ch: string): number;
  /** Pair kerning (1000ths of an em; negative tightens). */
  kern(a: string, b: string): number;
  /** One string operand (literal or hex) for `text`. */
  encode(text: string): string;
  readonly font: FontExpectation;
  /** The characters the font can show (subset: those it was built with). */
  readonly has: (ch: string) => boolean;
}

function missingOf(face: Face): string {
  return Array.from(ALPHABET)
    .filter((ch) => !face.has(ch))
    .join('');
}

function openFk(file: string): FkFont {
  return loadFontkit().open(new Uint8Array(readFileSync(join(FONT_DIR, file))));
}

/** Pair kerning from the font's own layout (GPOS or kern), cached. */
function kerner(fk: FkFont): (a: string, b: string) => number {
  const cache = new Map<string, number>();
  return (a, b) => {
    const key = a + b;
    let k = cache.get(key);
    if (k === undefined) {
      const run = fk.layout(key);
      const first = run.glyphs[0];
      k =
        run.glyphs.length === 2 && first
          ? Math.round(
              ((run.positions[0]?.xAdvance ?? 0) - first.advanceWidth) * (1000 / fk.unitsPerEm),
            )
          : 0;
      cache.set(key, k);
    }
    return k;
  };
}

/** A simple /TrueType WinAnsi subset of `file` holding the characters of `chars`. */
function trueTypeFace(
  doc: PDFDocument,
  file: string,
  chars: string,
  key: string,
  baseFont: string,
): { face: Face; ref: PDFRef } {
  const fk = openFk(file);
  const set = new Set(chars);
  const ref = simpleTrueType(doc, fk, [...set].join(''), baseFont);
  const k = 1000 / fk.unitsPerEm;
  return {
    ref,
    face: {
      key,
      advance: (ch) =>
        set.has(ch) ? Math.round(fk.glyphForCodePoint(ch.codePointAt(0) ?? 0).advanceWidth * k) : 0,
      kern: kerner(fk),
      encode: lit,
      has: (ch) => set.has(ch),
      font: {
        resource: key,
        subtype: 'TrueType',
        baseFont,
        encoding: 'WinAnsiEncoding',
        embedded: true,
        subset: true,
        toUnicode: false,
      },
    },
  };
}

/** A Type0 / Identity-H subset (pdf-lib, fontkit); glyphs are encoded one by one (no ligatures). */
async function type0Face(
  doc: PDFDocument,
  file: string,
  key: string,
  baseFont: string,
): Promise<{ face: Face; font: PDFFont }> {
  const fk = openFk(file);
  doc.registerFontkit(loadFontkit().fontkit);
  const font = await doc.embedFont(new Uint8Array(readFileSync(join(FONT_DIR, file))), {
    subset: true,
    customName: baseFont,
  });
  const used = new Set<string>();
  const k = 1000 / fk.unitsPerEm;
  return {
    font,
    face: {
      key,
      advance: (ch) => fk.glyphForCodePoint(ch.codePointAt(0) ?? 0).advanceWidth * k,
      kern: kerner(fk),
      encode: (text) => {
        let hex = '';
        for (const ch of Array.from(text)) {
          used.add(ch);
          hex += font.encodeText(ch).toString().slice(1, -1);
        }
        return `<${hex}>`;
      },
      has: (ch) => used.has(ch),
      font: {
        resource: key,
        subtype: 'Type0',
        baseFont,
        encoding: 'Identity-H',
        descendant: 'CIDFontType2',
        embedded: true,
        subset: true,
        toUnicode: true,
      },
    },
  };
}

/** Helvetica (standard 14, not embedded, WinAnsi). */
function helveticaFace(doc: PDFDocument, key: string): { face: Face; ref: PDFRef } {
  const { font, w } = helvetica(doc);
  return {
    ref: font.ref,
    face: {
      key,
      advance: (ch) => w(ch, 1000),
      kern: () => 0,
      encode: lit,
      has: (ch) => !NOT_WIN_ANSI.includes(ch),
      font: {
        resource: key,
        subtype: 'Type1',
        baseFont: 'Helvetica',
        encoding: 'WinAnsiEncoding',
        embedded: false,
        subset: false,
        toUnicode: false,
      },
    },
  };
}

/** How a line is spaced: character and word spacing (points) and horizontal scale (percent). */
interface Spacing {
  readonly tc?: number;
  readonly tw?: number;
  readonly tz?: number;
}

/** Width of `text` at `size` with kerning (when `kerned`) and spacing operators. */
function widthOf(face: Face, text: string, size: number, kerned: boolean, s: Spacing = {}): number {
  const chars = Array.from(text);
  let w = 0;
  chars.forEach((ch, i) => {
    w += (face.advance(ch) * size) / 1000 + (s.tc ?? 0) + (ch === ' ' ? (s.tw ?? 0) : 0);
    const next = chars[i + 1];
    if (kerned && next) w += (face.kern(ch, next) * size) / 1000;
  });
  return (w * (s.tz ?? 100)) / 100;
}

/** Greedy line breaking at spaces. */
function breakLines(text: string, measure: number, width: (line: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && width(candidate) > measure) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A `TJ` array for `text`: kerning pairs (when `kerned`) and `extraPerSpace` points after each
 * space glyph, as offsets.
 */
function tjArray(
  face: Face,
  text: string,
  size: number,
  kerned: boolean,
  extraPerSpace = 0,
): string {
  const parts: string[] = [];
  let run = '';
  const chars = Array.from(text);
  chars.forEach((ch, i) => {
    run += ch;
    const next = chars[i + 1];
    let adjust = kerned && next ? -face.kern(ch, next) : 0;
    if (ch === ' ' && extraPerSpace) adjust -= (extraPerSpace * 1000) / size;
    const rounded = Math.round(adjust * 10) / 10;
    if (next && rounded !== 0) {
      parts.push(face.encode(run), String(rounded));
      run = '';
    }
  });
  if (run) parts.push(face.encode(run));
  return `[${parts.join(' ')}] TJ`;
}

function paragraphOf(
  id: string,
  face: Face,
  lines: string[],
  baselines: number[],
  measure: [number, number],
  align: 'left' | 'justify',
  size: number,
  note: string,
  extra: Partial<CorpusParagraphExpectation> = {},
): CorpusParagraphExpectation {
  return {
    id,
    page: 1,
    lines,
    baselines: baselines.map(round2),
    measure: [round2(measure[0]), round2(measure[1])],
    align,
    fontSize: size,
    font: face.font,
    missingGlyphs: missingOf(face),
    editable: true,
    note,
    ...extra,
  };
}

function letterPage(markers: string[] = [], rotate = 0): PageExpectation {
  return {
    page: 1,
    mediaBox: LETTER_BOX,
    rotate,
    displayedSize: rotate % 180 ? [792, 612] : [612, 792],
    ...(markers.length ? { markers } : {}),
  };
}

function finish(
  bytes: Uint8Array,
  title: string,
  paragraphs: CorpusParagraphExpectation[],
  page: PageExpectation,
): Built {
  return {
    bytes,
    expect: {
      pdfLibLoad: 'ok',
      pageCount: 1,
      pages: [page],
      info: { Title: title },
      paragraphs,
      xref: 'table',
      fileIdDeterministic: true,
    },
  };
}

/** Sets the page's fonts (and XObjects) and its Flate-compressed content. */
function setPage(
  doc: PDFDocument,
  fonts: Record<string, PDFRef>,
  content: string[],
  xobjects: Record<string, PDFRef> = {},
  rotate = 0,
): void {
  const page = doc.addPage(LETTER);
  if (rotate) page.setRotation(degrees(rotate));
  page.node.set(
    name('Resources'),
    doc.context.obj({
      Font: fonts,
      ...(Object.keys(xobjects).length ? { XObject: xobjects } : {}),
    }),
  );
  page.node.set(
    name('Contents'),
    doc.context.register(doc.context.flateStream(content.join('\n'))),
  );
}

// ---------------------------------------------------------------------------
// word-export.pdf
// ---------------------------------------------------------------------------

const WORD_TITLE = 'Annual report of the village library';
const WORD_P1 =
  "The library opened its new reading room in early spring, after a long winter of building work. Volunteers painted the shelves, mended the old chairs and carried every crate of books up the narrow stairs by hand. On the first evening more than sixty readers came to see the room, and many of them stayed until the lights were turned off at nine o'clock.";
const WORD_P2 =
  "Borrowing rules have not changed. Each reader may take home four books at a time for three weeks, and the loan can be renewed once at the desk or by telephone. Children's books are kept on the low shelves near the window, where the light is best in the afternoon.";
const WORD_P3 = 'Thanks are due to the parish council and to all who gave their time.';

async function buildWordExport(): Promise<Built> {
  const file = `${DIR}/word-export.pdf`;
  const title = 'Text-edit corpus: word processor export';
  const doc = await newDoc(title);
  const body = trueTypeFace(
    doc,
    'NotoSerif-Regular.ttf',
    `${WORD_P1}${WORD_P2}${WORD_P3}`,
    'F1',
    'WDEXAA+NotoSerif-Regular',
  );
  const head = trueTypeFace(doc, 'Inter-Bold.ttf', WORD_TITLE, 'F2', 'WDEXAB+Inter-Bold');
  const size = 11;
  const lead = 15;
  const left = 72;
  const measure = 468;
  const content: string[] = [];
  content.push(
    `BT /F2 16 Tf 1 0 0 1 ${left} 720 Tm ${tjArray(head.face, WORD_TITLE, 16, true)} ET`,
  );
  const paragraphs: CorpusParagraphExpectation[] = [
    paragraphOf(
      'title',
      head.face,
      [WORD_TITLE],
      [720],
      [left, measure],
      'left',
      16,
      'Heading, Inter Bold simple TrueType subset, one kerned TJ.',
    ),
  ];
  const kernedWidth = (line: string) => widthOf(body.face, line, size, true);

  // Paragraph 1 (Word): one BT/ET per line, Tm, kerned TJ, justified by TJ offsets after spaces.
  const l1 = breakLines(WORD_P1, measure, kernedWidth);
  let y = 690;
  const b1: number[] = [];
  l1.forEach((line, i) => {
    const spaces = Array.from(line).filter((c) => c === ' ').length;
    const extra = i < l1.length - 1 && spaces ? (measure - kernedWidth(line)) / spaces : 0;
    content.push(
      `BT /F1 ${size} Tf 1 0 0 1 ${left} ${f(y)} Tm ${tjArray(body.face, line, size, true, extra)} ET`,
    );
    b1.push(y);
    y -= lead;
  });
  paragraphs.push(
    paragraphOf(
      'p1-tj-justified',
      body.face,
      l1,
      b1,
      [left, measure],
      'justify',
      size,
      'Word style: each line its own BT/ET with an absolute Tm; one TJ with kerning offsets between glyph pairs and the justification as a negative offset after every space glyph. Noto Serif simple TrueType WinAnsi subset (only the glyphs used, no /ToUnicode).',
    ),
  );

  // Paragraph 2 (LibreOffice): one BT, Td line moves, justified by Tw, kerned TJ.
  y -= 9;
  const l2 = breakLines(WORD_P2, measure, kernedWidth);
  const b2: number[] = [];
  const ops: string[] = [`BT /F1 ${size} Tf ${left} ${f(y)} Td`];
  l2.forEach((line, i) => {
    const spaces = Array.from(line).filter((c) => c === ' ').length;
    const tw = i < l2.length - 1 && spaces ? (measure - kernedWidth(line)) / spaces : 0;
    if (i > 0) ops.push(`0 ${-lead} Td`);
    ops.push(`${round2(tw)} Tw ${tjArray(body.face, line, size, true)}`);
    b2.push(y);
    y -= lead;
  });
  ops.push('0 Tw ET');
  content.push(ops.join('\n'));
  paragraphs.push(
    paragraphOf(
      'p2-tw-justified',
      body.face,
      l2,
      b2,
      [left, measure],
      'justify',
      size,
      'LibreOffice style: the whole paragraph in one BT, lines moved by `0 -15 Td`, justified by a `Tw` set before each line (0 on the last), kerned TJ.',
    ),
  );

  // Paragraph 3: one ragged line, kerned TJ.
  y -= 9;
  content.push(
    `BT /F1 ${size} Tf 1 0 0 1 ${left} ${f(y)} Tm ${tjArray(body.face, WORD_P3, size, true)} ET`,
  );
  paragraphs.push(
    paragraphOf(
      'p3-one-line',
      body.face,
      [WORD_P3],
      [y],
      [left, measure],
      'left',
      size,
      'A one-line paragraph, kerned TJ (the shortest paragraph a user empties and retypes).',
    ),
  );
  setPage(doc, { F1: body.ref, F2: head.ref }, content);
  return finish(await save(doc, file), title, paragraphs, letterPage());
}

// ---------------------------------------------------------------------------
// per-glyph.pdf
// ---------------------------------------------------------------------------

const GLYPH_P1 =
  'Every glyph of this paragraph is placed on its own, the way a printing system writes text it has already laid out: the words have no space characters between them, only gaps.';
const GLYPH_P2 =
  'This paragraph is printed upside down in a flipped coordinate system and flipped back by its text matrix, one glyph at a time, as a browser engine writes a page.';

async function buildPerGlyph(): Promise<Built> {
  const file = `${DIR}/per-glyph.pdf`;
  const title = 'Text-edit corpus: one glyph per show';
  const doc = await newDoc(title);
  const { face, font } = await type0Face(doc, 'Inter-Regular.ttf', 'F1', 'PGLYAA+Inter-Regular');
  const size = 11;
  const lead = 15;
  const left = 72;
  const measure = 440;
  const width = (line: string) => widthOf(face, line, size, false);
  const content: string[] = [];

  // Quartz: one BT per line, an absolute Tm per glyph, no space glyphs.
  const l1 = breakLines(GLYPH_P1, measure, width);
  let y = 720;
  const b1: number[] = [];
  for (const line of l1) {
    const ops = [`BT /F1 ${size} Tf`];
    let x = left;
    for (const ch of Array.from(line)) {
      if (ch !== ' ') ops.push(`1 0 0 1 ${f(x)} ${f(y)} Tm ${face.encode(ch)} Tj`);
      x += (face.advance(ch) * size) / 1000;
    }
    ops.push('ET');
    content.push(ops.join('\n'));
    b1.push(y);
    y -= lead;
  }

  // Skia: the page flipped by cm (y down), each glyph at its Tm flipped back, spaces drawn.
  y -= 12;
  const l2 = breakLines(GLYPH_P2, measure, width);
  const b2: number[] = [];
  const ops = ['q 1 0 0 -1 0 792 cm', `BT /F1 ${size} Tf`];
  for (const line of l2) {
    let x = left;
    for (const ch of Array.from(line)) {
      ops.push(`1 0 0 -1 ${f(x)} ${f(792 - y)} Tm ${face.encode(ch)} Tj`);
      x += (face.advance(ch) * size) / 1000;
    }
    b2.push(y);
    y -= lead;
  }
  ops.push('ET Q');
  content.push(ops.join('\n'));

  setPage(doc, { F1: font.ref }, content);
  const paragraphs = [
    paragraphOf(
      'p1-quartz-no-spaces',
      face,
      l1,
      b1,
      [left, measure],
      'left',
      size,
      'Quartz style: one BT per line, every glyph shown by its own Tj at an absolute `1 0 0 1 x y Tm`; no space glyphs at all (word gaps are only geometry). Inter Type0 Identity-H subset.',
    ),
    paragraphOf(
      'p2-skia-flipped',
      face,
      l2,
      b2,
      [left, measure],
      'left',
      size,
      'Skia style: `1 0 0 -1 0 792 cm` flips the page, every glyph (spaces too) is shown by its own Tj at `1 0 0 -1 x y Tm`, which flips the text back upright. Baselines listed in unflipped user space.',
    ),
  ];
  // Whatever the encoder used is in the subset; computed after the content is encoded.
  for (const p of paragraphs) p.missingGlyphs = missingOf(face);
  return finish(await save(doc, file), title, paragraphs, letterPage());
}

// ---------------------------------------------------------------------------
// cid-turkish.pdf
// ---------------------------------------------------------------------------

const TR_TITLE = 'Köy kütüphanesinin yıllık raporu';
const TR_P1 =
  'Kütüphane yeni okuma salonunu ilkbaharın başında, uzun bir kış boyunca süren inşaat işlerinin ardından açtı. Gönüllüler rafları boyadı, eski sandalyeleri onardı ve her kitap kolisini dar merdivenlerden elle yukarı taşıdı. İlk akşam salonu görmeye altmıştan fazla okur geldi.';
const TR_P2 =
  "Çocuk kitapları pencerenin yanındaki alçak raflarda duruyor; öğleden sonra ışık orada en güzel hâlini alıyor. Şubat ayında Üsküdar'dan gelen bağışlar da bu raflara yerleştirildi.";

async function buildCidTurkish(): Promise<Built> {
  const file = `${DIR}/cid-turkish.pdf`;
  const title = 'Text-edit corpus: Turkish in Identity-H subsets';
  const doc = await newDoc(title);
  const body = await type0Face(doc, 'Inter-Regular.ttf', 'F1', 'CIDTAA+Inter-Regular');
  const head = await type0Face(doc, 'Inter-Bold.ttf', 'F2', 'CIDTAB+Inter-Bold');
  const size = 11;
  const lead = 15;
  const left = 72;
  const measure = 460;
  const content = [`BT /F2 16 Tf ${left} 720 Td ${head.face.encode(TR_TITLE)} Tj ET`];
  const width = (line: string) => widthOf(body.face, line, size, false);
  const paragraphs: CorpusParagraphExpectation[] = [];
  let y = 690;
  for (const [id, text] of [
    ['p1-turkish', TR_P1],
    ['p2-turkish', TR_P2],
  ] as const) {
    const lines = breakLines(text, measure, width);
    const baselines: number[] = [];
    for (const line of lines) {
      content.push(`BT /F1 ${size} Tf ${left} ${f(y)} Td ${body.face.encode(line)} Tj ET`);
      baselines.push(y);
      y -= lead;
    }
    paragraphs.push(
      paragraphOf(
        id,
        body.face,
        lines,
        baselines,
        [left, measure],
        'left',
        size,
        'One BT/ET and one hex Tj per line (pdf-lib drawText style); Inter Regular Type0 Identity-H subset with /ToUnicode. The subset has none of Ğ, Ö, digits or q/w/x: typing them needs a fallback font.',
      ),
    );
    y -= 8;
  }
  paragraphs.unshift(
    paragraphOf(
      'title',
      head.face,
      [TR_TITLE],
      [720],
      [left, measure],
      'left',
      16,
      'Heading, Inter Bold Type0 Identity-H subset.',
    ),
  );
  setPage(doc, { F1: body.font.ref, F2: head.font.ref }, content);
  for (const p of paragraphs)
    p.missingGlyphs = missingOf(p.font.resource === 'F1' ? body.face : head.face);
  return finish(await save(doc, file), title, paragraphs, letterPage());
}

// ---------------------------------------------------------------------------
// spacing-ops.pdf
// ---------------------------------------------------------------------------

const SP_P1 =
  'This paragraph is set with extra letter spacing, the way a designer tracks out a short introduction so that it reads lighter on the page.';
const SP_P2 =
  'This paragraph is condensed by horizontal scaling to ninety per cent and tightened a little, as layout programs do to make a long text fit its frame.';
const SP_P3 =
  'This paragraph is justified by word spacing only: every line but the last carries its own Tw so that it ends exactly at the right edge of the column, the way a print driver sets a justified page.';
const SP_P4 =
  'This last paragraph uses a text leading and moves to the next line with the quote operator, so each line carries no coordinates of its own.';

async function buildSpacingOps(): Promise<Built> {
  const file = `${DIR}/spacing-ops.pdf`;
  const title = 'Text-edit corpus: Tc, Tz, Tw and TL';
  const doc = await newDoc(title);
  const { face, ref } = trueTypeFace(
    doc,
    'Inter-Regular.ttf',
    `${SP_P1}${SP_P2}${SP_P3}${SP_P4}`,
    'F1',
    'SPOPAA+Inter-Regular',
  );
  const size = 10.5;
  const lead = 14;
  const left = 72;
  const measure = 450;
  const content: string[] = [];
  const paragraphs: CorpusParagraphExpectation[] = [];
  let y = 720;
  const add = (
    id: string,
    lines: string[],
    baselines: number[],
    align: 'left' | 'justify',
    note: string,
  ) => paragraphs.push(paragraphOf(id, face, lines, baselines, [left, measure], align, size, note));

  // Tc: one BT, TL and T*.
  {
    const s = { tc: 0.6 };
    const lines = breakLines(SP_P1, measure, (l) => widthOf(face, l, size, false, s));
    const ops = [`BT /F1 ${size} Tf ${s.tc} Tc ${lead} TL ${left} ${f(y)} Td`];
    const baselines: number[] = [];
    lines.forEach((line, i) => {
      ops.push(`${i > 0 ? 'T* ' : ''}${lit(line)} Tj`);
      baselines.push(y);
      y -= lead;
    });
    ops.push('0 Tc ET');
    content.push(ops.join('\n'));
    add(
      'p1-tc',
      lines,
      baselines,
      'left',
      'Letter-spaced: `0.6 Tc` (on every glyph, spaces too), one BT, lines moved by TL/T*.',
    );
  }
  // Tz with a small negative Tc.
  y -= 10;
  {
    const s = { tz: 90, tc: -0.1 };
    const lines = breakLines(SP_P2, measure, (l) => widthOf(face, l, size, false, s));
    const baselines: number[] = [];
    lines.forEach((line) => {
      content.push(
        `BT /F1 ${size} Tf ${s.tz} Tz ${s.tc} Tc 1 0 0 1 ${left} ${f(y)} Tm ${lit(line)} Tj ET`,
      );
      baselines.push(y);
      y -= lead;
    });
    add(
      'p2-tz',
      lines,
      baselines,
      'left',
      "Condensed: `90 Tz -0.1 Tc` set again in each line's BT (text state persists across BT/ET, so it is repeated as producers do), absolute Tm.",
    );
  }
  // Tw per line.
  y -= 10;
  {
    const lines = breakLines(SP_P3, measure, (l) => widthOf(face, l, size, false));
    const baselines: number[] = [];
    lines.forEach((line, i) => {
      const spaces = Array.from(line).filter((c) => c === ' ').length;
      const tw =
        i < lines.length - 1 && spaces ? (measure - widthOf(face, line, size, false)) / spaces : 0;
      content.push(
        `BT /F1 ${size} Tf 1 0 0 1 ${left} ${f(y)} Tm ${round2(tw)} Tw ${lit(line)} Tj ET`,
      );
      baselines.push(y);
      y -= lead;
    });
    content.push('BT 0 Tw 100 Tz 0 Tc ET');
    add(
      'p3-tw',
      lines,
      baselines,
      'justify',
      'Justified by word spacing: each line its own BT with `Tw` for that line (0 on the last), plain Tj.',
    );
  }
  // TL and the ' operator.
  y -= 10;
  {
    const lines = breakLines(SP_P4, measure, (l) => widthOf(face, l, size, false));
    // `'` moves to the next line first: start one leading above the first baseline.
    const ops = [`BT /F1 ${size} Tf ${lead} TL ${left} ${f(y + lead)} Td`];
    const baselines: number[] = [];
    for (const line of lines) {
      ops.push(`${lit(line)} '`);
      baselines.push(y);
      y -= lead;
    }
    ops.push('ET');
    content.push(ops.join('\n'));
    add(
      'p4-quote',
      lines,
      baselines,
      'left',
      "Every line shown by the `'` operator (next line by TL, then show), one BT.",
    );
  }
  setPage(doc, { F1: ref }, content);
  return finish(await save(doc, file), title, paragraphs, letterPage());
}

// ---------------------------------------------------------------------------
// rotated-paragraph.pdf
// ---------------------------------------------------------------------------

const ROT_TITLE = 'Landscape notice';
const ROT_P1 =
  'This page is stored in portrait and shown in landscape: its /Rotate is ninety degrees and the whole page is drawn through a matrix that turns it back, so the paragraph reads upright on the screen. Editing it must keep every line on the same slant as before and grow downward on the screen, not across the page.';

async function buildRotated(): Promise<Built> {
  const file = `${DIR}/rotated-paragraph.pdf`;
  const title = 'Text-edit corpus: rotated page paragraph';
  const doc = await newDoc(title);
  const { face, ref } = trueTypeFace(
    doc,
    'NotoSerif-Regular.ttf',
    `${ROT_TITLE}${ROT_P1}`,
    'F1',
    'ROTPAA+NotoSerif-Regular',
  );
  const size = 12;
  const lead = 16;
  const left = 72;
  const measure = 620;
  const width = (line: string) => widthOf(face, line, size, true);
  const lines = breakLines(ROT_P1, measure, width);
  // Landscape frame (792 x 612, y up): user = (612 - Y, X).
  const content = [
    'q 0 1 -1 0 612 0 cm',
    `BT /F1 18 Tf 1 0 0 1 ${left} 530 Tm ${tjArray(face, ROT_TITLE, 18, true)} ET`,
  ];
  let y = 495;
  const baselines: number[] = [];
  for (const line of lines) {
    content.push(
      `BT /F1 ${size} Tf 1 0 0 1 ${left} ${f(y)} Tm ${tjArray(face, line, size, true)} ET`,
    );
    baselines.push(y);
    y -= lead;
  }
  content.push('Q');
  setPage(doc, { F1: ref }, content, {}, 90);
  const frame =
    'Landscape frame set by `0 1 -1 0 612 0 cm` on a /Rotate 90 Letter page (user x = 612 - Y, user y = X); baselines are Y in that frame.';
  const paragraphs = [
    paragraphOf(
      'title',
      face,
      [ROT_TITLE],
      [530],
      [left, measure],
      'left',
      18,
      `Heading. ${frame}`,
    ),
    paragraphOf(
      'p1-rotated',
      face,
      lines,
      baselines,
      [left, measure],
      'left',
      size,
      `One kerned TJ per line, each its own BT. ${frame}`,
    ),
  ];
  return finish(await save(doc, file), title, paragraphs, letterPage([], 90));
}

// ---------------------------------------------------------------------------
// tight-columns.pdf
// ---------------------------------------------------------------------------

const COL_TEXTS = [
  'The ferry timetable changes twice a year, in spring and in autumn, and the harbour office prints a new card for every season so that travellers can keep it in a pocket.',
  'On stormy days the first crossing may be cancelled without notice. The office then posts a handwritten sign on the gate and rings the bell on the quay three times.',
  'Bicycles travel free of charge on the upper deck, but they must be tied to the rail before the boat leaves and may not block the stairs or the doors of the cabin.',
  'Dogs are welcome on board when they are kept on a short lead, and the crew keeps a bowl of fresh water by the stern for them on warm summer afternoons.',
];

async function buildTightColumns(): Promise<Built> {
  const file = `${DIR}/tight-columns.pdf`;
  const title = 'Text-edit corpus: tight columns';
  const doc = await newDoc(title);
  const { face, ref } = trueTypeFace(
    doc,
    'NotoSerif-Regular.ttf',
    COL_TEXTS.join(''),
    'F1',
    'TCOLAA+NotoSerif-Regular',
  );
  const size = 9.5;
  const lead = 12;
  const gutter = 6;
  const colWidth = (468 - gutter) / 2;
  const width = (line: string) => widthOf(face, line, size, false);
  const content: string[] = [];
  const paragraphs: CorpusParagraphExpectation[] = [];
  COL_TEXTS.forEach((text, k) => {
    const col = k < 2 ? 0 : 1;
    const x = 72 + col * (colWidth + gutter);
    let y = k % 2 === 0 ? 720 : (paragraphs[k - 1]?.baselines.at(-1) ?? 720) - lead - 6;
    const lines = breakLines(text, colWidth, width);
    const baselines: number[] = [];
    lines.forEach((line, i) => {
      const spaces = Array.from(line).filter((c) => c === ' ').length;
      const extra = i < lines.length - 1 && spaces ? (colWidth - width(line)) / spaces : 0;
      content.push(
        `BT /F1 ${size} Tf 1 0 0 1 ${f(x)} ${f(y)} Tm ${tjArray(face, line, size, false, extra)} ET`,
      );
      baselines.push(y);
      y -= lead;
    });
    paragraphs.push(
      paragraphOf(
        `${col === 0 ? 'left' : 'right'}-${(k % 2) + 1}`,
        face,
        lines,
        baselines,
        [x, colWidth],
        'justify',
        size,
        `Column ${col + 1} of two, ${gutter} pt gutter (half a word gap wider than a justified space); justified by TJ offsets after spaces, one BT per line; the left column is written first.`,
      ),
    );
  });
  setPage(doc, { F1: ref }, content);
  return finish(await save(doc, file), title, paragraphs, letterPage());
}

// ---------------------------------------------------------------------------
// type3-line.pdf
// ---------------------------------------------------------------------------

const T3_P1 =
  'The paragraph above the stamp is set in plain Helvetica, and it must stay editable even though the line below it is drawn by a font made of procedures.';
const T3_LINE = 'ABBA BAAB';
const T3_P2 =
  'The paragraph below the stamp is set in the same font as the first one and has two lines on this page.';

async function buildType3Line(): Promise<Built> {
  const file = `${DIR}/type3-line.pdf`;
  const title = 'Text-edit corpus: a Type3 line between paragraphs';
  const doc = await newDoc(title);
  const helv = helveticaFace(doc, 'F1');
  const t3 = type3Font(doc);
  const size = 11;
  const lead = 14;
  const left = 72;
  const measure = 420;
  const width = (line: string) => widthOf(helv.face, line, size, false);
  const content: string[] = [];
  const paragraphs: CorpusParagraphExpectation[] = [];
  let y = 720;
  const para = (id: string, text: string) => {
    const lines = breakLines(text, measure, width);
    const baselines: number[] = [];
    for (const line of lines) {
      content.push(`BT /F1 ${size} Tf ${left} ${f(y)} Td ${lit(line)} Tj ET`);
      baselines.push(y);
      y -= lead;
    }
    paragraphs.push(
      paragraphOf(
        id,
        helv.face,
        lines,
        baselines,
        [left, measure],
        'left',
        size,
        'Helvetica (standard 14, not embedded), one Tj per line.',
      ),
    );
  };
  para('p1-above', T3_P1);
  y -= 14;
  // The Type3 font has glyphs A and B only; the word gap is a TJ offset.
  const [w1, w2] = T3_LINE.split(' ');
  content.push(`BT /F2 18 Tf ${left} ${f(y)} Td [${lit(w1 ?? '')} -600 ${lit(w2 ?? '')}] TJ ET`);
  paragraphs.push({
    ...paragraphOf(
      'type3',
      helv.face,
      [T3_LINE],
      [y],
      [left, measure],
      'left',
      18,
      'Type3 font /F2 (glyphs A and B drawn by procedures, /ToUnicode), the word gap a TJ offset. Not editable (spec §2.2).',
      { editable: false },
    ),
    font: {
      resource: 'F2',
      subtype: 'Type3',
      encoding: 'Differences',
      embedded: false,
      subset: false,
      toUnicode: true,
    },
    missingGlyphs: Array.from(ALPHABET)
      .filter((c) => c !== 'A' && c !== 'B')
      .join(''),
  });
  y -= 18 + 14;
  para('p2-below', T3_P2);
  setPage(doc, { F1: helv.ref, F2: t3 }, content);
  return finish(await save(doc, file), title, paragraphs, letterPage());
}

// ---------------------------------------------------------------------------
// ocr-layer.pdf
// ---------------------------------------------------------------------------

const OCR_P1 =
  'This paragraph was scanned from a printed letter and recognised by a text reader, which laid invisible words over the picture so that the page can be searched and copied.';
const OCR_DPI = 120;

async function buildOcrLayer(): Promise<Built> {
  const file = `${DIR}/ocr-layer.pdf`;
  const title = 'Text-edit corpus: scanned paragraph with an OCR layer';
  const doc = await newDoc(title);
  const helv = helveticaFace(doc, 'F1');
  const inter = openFk('Inter-Regular.ttf');
  const size = 12;
  const lead = 16;
  const left = 72;
  const measure = 440;
  const scale = size / inter.unitsPerEm;
  const interWidth = (line: string) =>
    Array.from(line).reduce(
      (n, ch) => n + inter.glyphForCodePoint(ch.codePointAt(0) ?? 0).advanceWidth,
      0,
    ) * scale;
  const lines = breakLines(OCR_P1, measure, interWidth);
  // The scanned area: the paragraph's lines plus a margin, rasterised in Inter.
  const top = 720;
  const area = {
    x: left - 12,
    y: top - lead * lines.length - 6,
    w: measure + 24,
    h: lead * lines.length + 24,
  };
  const px = OCR_DPI / 72;
  const W = Math.round(area.w * px);
  const H = Math.round(area.h * px);
  const canvas = new Canvas(W, H);
  const baselines: number[] = [];
  lines.forEach((line, i) => {
    const baseline = top - i * lead;
    baselines.push(baseline);
    let pen = left;
    for (const ch of Array.from(line)) {
      const glyph = inter.glyphForCodePoint(ch.codePointAt(0) ?? 0);
      const ox = pen;
      canvas.fillPath(glyph.path.commands, (gx, gy) => [
        (ox + gx * scale - area.x) * px,
        (area.y + area.h - (baseline + gy * scale)) * px,
      ]);
      pen += glyph.advanceWidth * scale;
    }
  });
  const image = doc.context.register(
    doc.context.flateStream(canvas.toGrey(), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: W,
      Height: H,
      ColorSpace: 'DeviceGray',
      BitsPerComponent: 8,
    }),
  );
  const content = [`q ${f(area.w)} 0 0 ${f(area.h)} ${f(area.x)} ${f(area.y)} cm /Im1 Do Q`];
  lines.forEach((line, i) => {
    const tz = round2((100 * interWidth(line)) / widthOf(helv.face, line, size, false));
    content.push(
      `BT /F1 ${size} Tf 3 Tr ${tz} Tz 1 0 0 1 ${left} ${f(baselines[i] ?? 0)} Tm ${lit(line)} Tj ET`,
    );
  });
  setPage(doc, { F1: helv.ref }, content, { Im1: image });
  const paragraphs = [
    paragraphOf(
      'ocr',
      helv.face,
      lines,
      baselines,
      [left, measure],
      'left',
      size,
      `OCR layer: the paragraph is a ${OCR_DPI} dpi greyscale image (Inter rasterised by lib/raster.ts) with invisible Helvetica text (3 Tr, a Tz per line so each line spans the scanned one) over it. Extractable; editing must not just re-show the invisible text.`,
      { editable: false },
    ),
  ];
  return finish(await save(doc, file), title, paragraphs, letterPage());
}

// ---------------------------------------------------------------------------
// Fixture table and README section
// ---------------------------------------------------------------------------

const HOW =
  'Hand-written content streams, fonts from packages/engine/assets/fonts (edit-corpus-fixtures.ts)';

export const EDIT_CORPUS_FIXTURES: FixtureDef[] = [
  {
    file: `${DIR}/word-export.pdf`,
    tags: ['text-editing', 'paragraphs', 'truetype', 'subset', 'kerning', 'justified'],
    summary:
      'Word / LibreOffice-like export: Noto Serif and Inter Bold simple TrueType subsets (only the glyphs used), kerned TJ arrays, one paragraph justified by TJ offsets (one BT per line), one by Tw (one BT, Td moves), a one-line paragraph.',
    behavior:
      'Each paragraph is detected with its lines; edits keep the kerning-free lines byte-identical, rewrap justified lines to the measure, and type letters the subset lacks (digits, q, x, z, Turkish) in a substitute font.',
    howGenerated: HOW,
    build: buildWordExport,
  },
  {
    file: `${DIR}/per-glyph.pdf`,
    tags: ['text-editing', 'paragraphs', 'type0', 'per-glyph', 'flipped-ctm'],
    summary:
      'Two paragraphs drawn one glyph per Tj at absolute text matrices (Inter Type0 subset): Quartz-like without space glyphs, Skia-like under a flipped cm.',
    behavior:
      'Paragraph detection must rebuild words from geometry (gaps, no spaces) and must see through the flipped CTM; an edit rewrites the lines it touches as ordinary runs.',
    howGenerated: HOW,
    build: buildPerGlyph,
  },
  {
    file: `${DIR}/cid-turkish.pdf`,
    tags: ['text-editing', 'paragraphs', 'type0', 'subset', 'turkish', 'fallback'],
    summary:
      'Turkish heading and two paragraphs in Inter Regular / Bold Type0 Identity-H subsets with /ToUnicode, one hex Tj per line; the subsets lack Ğ, Ö, digits and q/w/x.',
    behavior:
      'Turkish letters the subset has (ğ, ı, İ, ş, ç, ö, ü) are typed in the original font; the ones it lacks fall back to a bundled face; the text reads back unchanged.',
    howGenerated: HOW,
    build: buildCidTurkish,
  },
  {
    file: `${DIR}/spacing-ops.pdf`,
    tags: ['text-editing', 'paragraphs', 'tc', 'tz', 'tw', 'tl'],
    summary:
      'Four paragraphs in an Inter simple TrueType subset: letter-spaced (Tc, TL/T*), condensed (90 Tz, -0.1 Tc), justified by Tw per line, and shown with the quote operator.',
    behavior:
      "Edits keep each paragraph's character spacing, scaling and word spacing; rewritten lines line up with kept ones.",
    howGenerated: HOW,
    build: buildSpacingOps,
  },
  {
    file: `${DIR}/rotated-paragraph.pdf`,
    tags: ['text-editing', 'paragraphs', 'rotation'],
    summary:
      'A /Rotate 90 Letter page drawn in a landscape frame (0 1 -1 0 612 0 cm): a heading and a three-line paragraph that read upright on screen.',
    behavior:
      'The editor follows the display rotation; the paragraph grows downward on screen; coordinates stay in unrotated user space.',
    howGenerated: HOW,
    build: buildRotated,
  },
  {
    file: `${DIR}/tight-columns.pdf`,
    tags: ['text-editing', 'paragraphs', 'columns', 'justified'],
    summary:
      'Two justified columns with a 6 pt gutter, two paragraphs each, in a Noto Serif simple TrueType subset (justification as TJ offsets).',
    behavior:
      'Each column paragraph is detected on its own (the gutter does not merge the columns); an edit rewraps inside its column only.',
    howGenerated: HOW,
    build: buildTightColumns,
  },
  {
    file: `${DIR}/type3-line.pdf`,
    tags: ['text-editing', 'paragraphs', 'type3'],
    summary: 'A Type3 line ("ABBA BAAB") between two Helvetica paragraphs.',
    behavior: 'The Type3 line is not editable; the paragraphs around it are and do not swallow it.',
    howGenerated: HOW,
    build: buildType3Line,
  },
  {
    file: `${DIR}/ocr-layer.pdf`,
    tags: ['text-editing', 'paragraphs', 'ocr-layer', 'image'],
    summary:
      'A scanned paragraph: a 120 dpi greyscale image of three lines with invisible Helvetica (3 Tr, Tz per line) over it.',
    behavior:
      'Detected as an OCR layer; the editor must not re-show the invisible text as if it were the visible paragraph.',
    howGenerated: HOW,
    build: buildOcrLayer,
  },
];

/** README section listing every corpus paragraph. */
export function renderEditCorpusReadme(entries: ManifestEntry[]): string {
  const files = new Set(EDIT_CORPUS_FIXTURES.map((d) => d.file));
  const sections = entries
    .filter((e) => files.has(e.file))
    .map((e) => {
      const rows = (e.expect.paragraphs ?? []).map((p) => {
        const first = (p.lines[0] ?? '').replaceAll('|', '\\|');
        const font = `${p.font.subtype} /${p.font.resource}${p.font.baseFont ? ` ${p.font.baseFont}` : ''}`;
        return `| \`${p.id}\` | ${p.lines.length} | "${first.length > 40 ? `${first.slice(0, 40)}…` : first}" | ${font} | ${p.fontSize} | ${p.baselines[0]} | ${p.align}${p.editable ? '' : ', not editable'} | ${p.missingGlyphs || '-'} | ${p.note.replaceAll('|', '\\|')} |`;
      });
      return [
        `### \`${e.file}\``,
        '',
        '| id | lines | first line | font | size | first baseline | align | missing glyphs | notes |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...rows,
      ].join('\n');
    });
  return `## Text-edit corpus: real-world producer shapes

Generated by \`tools/fixtures/edit-corpus-fixtures.ts\` into \`text-edit-corpus/\` (next to
the Chromium-printed pages of \`tools/fixtures/text-edit-corpus.ts\`, which are not part of
this manifest). Each page imitates how a family of producers writes paragraphs (word
processors, Quartz/Skia, server-side generators, layout programs, scanners). Fonts are
subsets of Inter Regular, Inter Bold and Noto Serif Regular from
\`packages/engine/assets/fonts\` (SIL Open Font License 1.1, which permits embedding);
every text is fictional. Each paragraph's lines, baselines, measure and font are in
\`manifest.json\` (\`expect.paragraphs\`); "missing glyphs" lists the letters and digits a
user may type that the font program lacks (a fallback font must set them). The scripted
edits over these pages are \`packages/engine/src/text-edit/edit-matrix.test.ts\` and
\`apps/web/src/text-edit/edit-matrix.test.ts\`.

${sections.join('\n\n')}
`;
}
