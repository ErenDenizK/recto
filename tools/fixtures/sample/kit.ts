/**
 * The sample's drawing kit (docs/design/sample-2026-10/design.md §2): the page system's
 * colours and grid, the four embedded faces, the structure tree, and a page writer that sets
 * text the way Recto's paragraph editor reads it (technical.md §3): one text object per line,
 * absolute `Tm`, justification as `TJ` offsets after real space glyphs (never `Tw`, which does
 * nothing on Identity-H), no tracking in edit targets, one tagged element per paragraph.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  PDFDict,
  type PDFDocument,
  type PDFFont,
  PDFHexString,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  type PDFRef,
  PDFString,
  appendBezierCurve,
  closePath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setFillingRgbColor,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
} from '@cantoo/pdf-lib';
import { A4, round2 } from '../lib/build.ts';
import { REPO_ROOT } from '../lib/common.ts';
import type { PathCommand } from '../lib/raster.ts';

export const [PAGE_W, PAGE_H] = A4;
export const r2 = round2;

// ---------------------------------------------------------------------------
// The page system (design §2)
// ---------------------------------------------------------------------------

/** Side margins and the measure. */
export const LEFT = 56;
export const RIGHT = PAGE_W - 56;
export const MEASURE = RIGHT - LEFT;
/** Two columns with a 16 pt gutter (TXT-12: straight, wider than 2 × the word space). */
export const GUTTER = 16;
export const COL_W = (MEASURE - GUTTER) / 2;
export const COL2 = LEFT + COL_W + GUTTER;

export const HEAD_Y = 806;
export const HEAD_RULE_Y = 797;
export const FOOT_Y = 34;

export type Rgb = readonly [number, number, number];
const hex = (value: string): Rgb => {
  const n = Number.parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Design §2 colours (DSN-3: graphite neutrals, lime the one accent; no blue in content). */
export const INK = hex('#17191E');
export const BODY = hex('#33373F');
export const MUTED = hex('#6B7079');
export const RULE = hex('#D6D9DE');
export const PALE = hex('#F3F4F6');
export const WHITE: Rgb = [1, 1, 1];
export const LIME = hex('#C8FB3D');
export const LIME_800 = hex('#446713');
export const COVER = hex('#0B0C0E');
export const COVER_SEA = hex('#2A2D35');
export const COVER_TEXT = hex('#F4F5F7');
export const COVER_MUTED = hex('#9AA0AA');
export const COVER_SLIP = hex('#16181D');
export const MINT = hex('#69EAA3');
export const AURORA_LIME = hex('#CBFF5F');
export const AURORA_YELLOW = hex('#EDFA6D');
/** Graphite steps for the photographs and miniatures (n3 … n9). */
export const N3 = hex('#C9CDD3');
export const N4 = hex('#A9AEB6');
export const N5 = hex('#878C95');
export const N6 = hex('#62666E');
export const N7 = hex('#45484F');
export const N8 = hex('#2C2E33');
export const N9 = hex('#1C1D21');

// ---------------------------------------------------------------------------
// Faces (bundled OFL fonts, packages/engine/assets/fonts/)
// ---------------------------------------------------------------------------

export type FaceId = 'sans' | 'bold' | 'serif';
interface FaceSpec {
  readonly file: string;
  readonly key: string;
  readonly tag: string;
  readonly extra: string;
  readonly features: Record<string, boolean>;
}

/**
 * Glyphs each subset gets up front, so Edit text finds what a person types in the page's own
 * font (tier 2) and glyph ids do not depend on which text comes first: printable ASCII but the
 * code-only symbols (<>[\]^_`{|}~), the Turkish letters and the copy's typography. A letter
 * outside it falls back to the bundled substitute face, labelled by the editor (design R-7).
 * The set is the byte budget's trade (technical.md §3): every glyph is in all four files.
 */
const CHARSET = `${Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i))
  .filter((ch) => !'<>[\\]^_`{|}~'.includes(ch))
  .join('')}çÇğĞıİöÖşŞüÜâÂîÎûÛ’‘“”–—…€₺`;
/** The accented letters names typed into the article most often need (José, Zoë, Søren). */
const LATIN1 = 'áéíóúàèñëäøåÉÁÑ';

/**
 * Three faces (technical.md §3: each more costs about 9.5 KB a file): Inter with tabular
 * figures (DSN-6) and no contextual alternates; ligatures off on every face, since an edit
 * cannot split a ligature glyph (design R-6).
 */
export const FACES: Record<FaceId, FaceSpec> = {
  sans: {
    file: 'Inter-Regular.ttf',
    key: 'F1',
    tag: 'RSMPAA',
    extra: '',
    features: { calt: false, liga: false, tnum: true },
  },
  bold: {
    file: 'Inter-Bold.ttf',
    key: 'F2',
    tag: 'RSMPAB',
    extra: '',
    features: { calt: false, liga: false, tnum: true },
  },
  serif: {
    file: 'NotoSerif-Regular.ttf',
    key: 'F3',
    tag: 'RSMPAC',
    extra: LATIN1,
    features: { calt: false, liga: false },
  },
};

export const FONT_DIR = join(REPO_ROOT, 'packages', 'engine', 'assets', 'fonts');

export interface FkGlyph {
  id: number;
  advanceWidth: number;
  codePoints: number[];
  path: { commands: PathCommand[] };
}
export interface FkFont {
  unitsPerEm: number;
  postscriptName: string;
  layout(
    text: string,
    features?: Record<string, boolean>,
  ): {
    glyphs: FkGlyph[];
    positions: { xAdvance: number; xOffset: number; yOffset: number }[];
  };
}
type Fontkit = Parameters<PDFDocument['registerFontkit']>[0];

/** @cantoo/fontkit, resolved from the engine package (as in demo-fixtures.ts). */
export function loadFontkit(): Fontkit {
  const require = createRequire(join(REPO_ROOT, 'packages', 'engine', 'package.json'));
  return require('@cantoo/fontkit') as Fontkit;
}

const opened = new Map<string, FkFont>();
export function openFont(file: string): FkFont {
  let font = opened.get(file);
  if (!font) {
    const fontkit = loadFontkit() as unknown as { create(bytes: Uint8Array): FkFont };
    font = fontkit.create(new Uint8Array(readFileSync(join(FONT_DIR, file))));
    opened.set(file, font);
  }
  return font;
}

export type Faces = Record<FaceId, PDFFont>;

export async function embedFaces(doc: PDFDocument): Promise<Faces> {
  doc.registerFontkit(loadFontkit());
  const faces = {} as Faces;
  for (const id of Object.keys(FACES) as FaceId[]) {
    const spec = FACES[id];
    const bytes = new Uint8Array(readFileSync(join(FONT_DIR, spec.file)));
    const font = await doc.embedFont(bytes, {
      subset: true,
      customName: `${spec.tag}+${openFont(spec.file).postscriptName}`,
      features: spec.features,
    });
    for (const ch of CHARSET + spec.extra) {
      const [glyph] = openFont(spec.file).layout(ch, spec.features).glyphs;
      if (glyph && glyph.id !== 0) font.encodeText(ch);
    }
    faces[id] = font;
  }
  return faces;
}

export interface Style {
  readonly face: FaceId;
  readonly size: number;
  readonly color: Rgb;
  /** Character spacing (Tc), labels only: never on an edit target (design §4 p3 rule 5). */
  readonly tracking?: number;
}

/**
 * The type scale (MOB-14; direction-v2.md §6): √2 every two steps, 9.5 · 2^(n/4) from the
 * body, set on quarter points. The page (1:√2), the body leading (9.5 × √2 ≈ 13.5) and the
 * sizes are one ratio. Every size on every page is one of these steps.
 */
export const PT = {
  /** −3: edge print on film. */
  edge: 5.65,
  /** −2: labels, running head, slate. */
  label: 6.75,
  /** −1: kicker, caption, footnote, byline, folio. */
  small: 8,
  /** 0: body, UI, the try slip. */
  body: 9.5,
  /** 1: letter body, intros, contents titles. */
  large: 11.25,
  /** 2: deck, card titles. */
  deck: 13.5,
  /** 3: H2, pull quote, cover lines, invoice total, contents numerals. */
  title: 16,
  /** 4: the printer's name. */
  display: 19,
  /** 6: cover numerals. */
  numeral: 27,
  /** 7: H1 (on a 36 pt leading). */
  h1: 32,
} as const;

/** Inter's cap height over its em (1490 / 2048): where a line's capitals stand. */
export const CAP = 1490 / 2048;

/** Tracking of tracked capitals: +12 % of the size (direction-v2.md §6). */
export const caps = (size: number) => Math.round(size * 0.12 * 100) / 100;

/** Design §2 styles on the type scale. */
export const STYLE = {
  head: { face: 'bold', size: PT.label, color: MUTED, tracking: caps(PT.label) },
  folio: { face: 'sans', size: PT.small, color: MUTED },
  kicker: { face: 'bold', size: PT.small, color: LIME_800, tracking: caps(PT.small) },
  h1: { face: 'bold', size: PT.h1, color: INK },
  h2: { face: 'bold', size: PT.title, color: INK },
  h3: { face: 'bold', size: PT.large, color: INK },
  deck: { face: 'serif', size: PT.deck, color: BODY },
  body: { face: 'serif', size: PT.body, color: BODY },
  /** The feature's lead-in: Inter Bold in the serif line (a style span, design §4 p3). */
  bodyBold: { face: 'bold', size: PT.body, color: INK },
  letter: { face: 'serif', size: PT.large, color: BODY },
  quote: { face: 'serif', size: PT.title, color: INK },
  ui: { face: 'sans', size: PT.body, color: INK },
  uiBold: { face: 'bold', size: PT.body, color: INK },
  caption: { face: 'sans', size: PT.small, color: MUTED },
  label: { face: 'bold', size: PT.label, color: MUTED, tracking: caps(PT.label) },
} satisfies Record<string, Style>;

// ---------------------------------------------------------------------------
// Structure (tagged PDF): Document > Sect per page > elements, annotations by OBJR
// ---------------------------------------------------------------------------

export interface Elem {
  readonly type: string;
  readonly page: PDFPage;
  readonly kids: (Elem | number | PDFDict)[];
  readonly attrs: Record<string, PDFObject>;
  ref?: PDFRef;
  parent?: Elem;
}

export class Structure {
  private readonly top: Elem[] = [];
  private readonly all: Elem[] = [];
  /** Per page index (StructParents): the element each MCID belongs to. */
  private readonly marked = new Map<number, Elem[]>();
  /** Annotations (StructParent keys after the pages'). */
  private readonly objects: { elem: Elem; annot: PDFRef; page: PDFPage }[] = [];
  private readonly doc: PDFDocument;

  constructor(doc: PDFDocument) {
    this.doc = doc;
  }

  /** A new element under `parent` (or the Document), with optional /Alt and attributes. */
  elem(type: string, page: PDFPage, parent?: Elem, alt?: string): Elem {
    const elem: Elem = { type, page, kids: [], attrs: {} };
    if (alt !== undefined) elem.attrs.Alt = PDFHexString.fromText(alt);
    if (parent) {
      elem.parent = parent;
      parent.kids.push(elem);
    } else this.top.push(elem);
    this.all.push(elem);
    return elem;
  }

  /** The next MCID on page `index` for `elem`. */
  mcid(index: number, elem: Elem): number {
    const list = this.marked.get(index) ?? [];
    list.push(elem);
    this.marked.set(index, list);
    const id = list.length - 1;
    elem.kids.push(id);
    return id;
  }

  /** An annotation (widget, link, note) as content of `elem` (ISO 32000-1 §14.7.4.3). */
  annot(elem: Elem, annot: PDFRef, page: PDFPage): void {
    this.objects.push({ elem, annot, page });
  }

  write(lang: string): void {
    const ctx = this.doc.context;
    const root = ctx.nextRef();
    const document = ctx.nextRef();
    for (const elem of this.all) elem.ref = ctx.nextRef();
    const pages = this.doc.getPages();
    const nums: PDFObject[] = [];
    pages.forEach((page, index) => {
      const marked = this.marked.get(index);
      if (!marked) return;
      page.node.set(PDFName.of('StructParents'), PDFNumber.of(index));
      nums.push(PDFNumber.of(index), ctx.obj(marked.map((e) => e.ref)));
    });
    this.objects.forEach(({ elem, annot, page }, i) => {
      const key = pages.length + i;
      ctx.lookup(annot, PDFDict).set(PDFName.of('StructParent'), PDFNumber.of(key));
      elem.kids.push(ctx.obj({ Type: 'OBJR', Obj: annot, Pg: page.ref }));
      nums.push(PDFNumber.of(key), elem.ref as PDFRef);
    });
    for (const elem of this.all) {
      const kids = elem.kids.map((k) =>
        typeof k === 'number' ? PDFNumber.of(k) : 'type' in k ? (k.ref as PDFRef) : k,
      );
      const dict = ctx.obj({
        Type: 'StructElem',
        S: elem.type,
        P: elem.parent?.ref ?? document,
        Pg: elem.page.ref,
      });
      if (kids.length === 1 && kids[0]) dict.set(PDFName.of('K'), kids[0]);
      else if (kids.length > 1) dict.set(PDFName.of('K'), ctx.obj(kids));
      for (const [key, value] of Object.entries(elem.attrs)) dict.set(PDFName.of(key), value);
      ctx.assign(elem.ref as PDFRef, dict);
    }
    ctx.assign(
      document,
      ctx.obj({
        Type: 'StructElem',
        S: 'Document',
        P: root,
        Lang: PDFString.of(lang),
        K: this.top.map((e) => e.ref),
      }),
    );
    ctx.assign(
      root,
      ctx.obj({
        Type: 'StructTreeRoot',
        K: document,
        ParentTree: ctx.register(ctx.obj({ Nums: nums })),
        ParentTreeNextKey: pages.length + this.objects.length,
      }),
    );
    this.doc.catalog.set(PDFName.of('StructTreeRoot'), root);
    this.doc.catalog.set(PDFName.of('MarkInfo'), ctx.obj({ Marked: true }));
  }
}

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

/**
 * `BDC` with an inline property list. pdf-lib's operator arguments are typed without
 * dictionaries, but an operator writes each argument with its own `toString`.
 */
const bdc = (tag: string, props: PDFDict) =>
  PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
    PDFName.of(tag),
    props as unknown as PDFName,
  ]);
const bmc = (tag: string) => PDFOperator.of(PDFOperatorNames.BeginMarkedContent, [PDFName.of(tag)]);
const emc = () => PDFOperator.of(PDFOperatorNames.EndMarkedContent);
/** A raw operator line (TJ arrays, shadings, ExtGStates), written as given. */
export const raw = (source: string) => PDFOperator.of(source as PDFOperatorNames);

export function rect(x: number, y: number, w: number, h: number, color: Rgb): PDFOperator[] {
  return [setFillingRgbColor(...color), rectangle(r2(x), r2(y), r2(w), r2(h)), fill()];
}

/** A rounded rectangle path (κ = 0.5523 quarter circles). */
export function roundedPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): PDFOperator[] {
  const k = radius * 0.5523;
  const [x1, y1] = [x + w, y + h];
  const c = (a: number, b: number, cc: number, d: number, e: number, f: number) =>
    appendBezierCurve(r2(a), r2(b), r2(cc), r2(d), r2(e), r2(f));
  return [
    moveTo(r2(x + radius), r2(y)),
    lineTo(r2(x1 - radius), r2(y)),
    c(x1 - radius + k, y, x1, y + radius - k, x1, y + radius),
    lineTo(r2(x1), r2(y1 - radius)),
    c(x1, y1 - radius + k, x1 - radius + k, y1, x1 - radius, y1),
    lineTo(r2(x + radius), r2(y1)),
    c(x + radius - k, y1, x, y1 - radius + k, x, y1 - radius),
    lineTo(r2(x), r2(y + radius)),
    c(x, y + radius - k, x + radius - k, y, x + radius, y),
    closePath(),
  ];
}

export function roundRect(x: number, y: number, w: number, h: number, radius: number, color: Rgb) {
  return [setFillingRgbColor(...color), ...roundedPath(x, y, w, h, radius), fill()];
}

export function hairline(x0: number, y0: number, x1: number, y1: number, color: Rgb, width = 0.5) {
  return [
    setStrokingRgbColor(...color),
    setLineWidth(width),
    moveTo(r2(x0), r2(y0)),
    lineTo(r2(x1), r2(y1)),
    stroke(),
  ];
}

/** A circle path (four Béziers). */
export function circlePath(cx: number, cy: number, radius: number): PDFOperator[] {
  const k = radius * 0.5523;
  const c = (a: number, b: number, cc: number, d: number, e: number, f: number) =>
    appendBezierCurve(r2(a), r2(b), r2(cc), r2(d), r2(e), r2(f));
  return [
    moveTo(r2(cx + radius), r2(cy)),
    c(cx + radius, cy + k, cx + k, cy + radius, cx, cy + radius),
    c(cx - k, cy + radius, cx - radius, cy + k, cx - radius, cy),
    c(cx - radius, cy - k, cx - k, cy - radius, cx, cy - radius),
    c(cx + k, cy - radius, cx + radius, cy - k, cx + radius, cy),
    closePath(),
  ];
}

export function disc(cx: number, cy: number, radius: number, color: Rgb): PDFOperator[] {
  return [setFillingRgbColor(...color), ...circlePath(cx, cy, radius), fill()];
}

export function ring(cx: number, cy: number, radius: number, color: Rgb, width: number) {
  return [
    setStrokingRgbColor(...color),
    setLineWidth(width),
    ...circlePath(cx, cy, radius),
    stroke(),
  ];
}

/** A filled polygon. */
export function poly(points: readonly (readonly [number, number])[], color: Rgb): PDFOperator[] {
  const [first, ...rest] = points;
  if (!first) return [];
  return [
    setFillingRgbColor(...color),
    moveTo(r2(first[0]), r2(first[1])),
    ...rest.map(([x, y]) => lineTo(r2(x), r2(y))),
    closePath(),
    fill(),
  ];
}

// ---------------------------------------------------------------------------
// Rich text: `**bold**` marks the bold face of a paragraph's pair of styles
// ---------------------------------------------------------------------------

export interface Glyphs {
  readonly text: string;
  readonly style: Style;
}

/** "Words **Defne Aras**" → runs in `regular` and `bold`. */
export function rich(value: string, regular: Style, bold: Style): Glyphs[] {
  return value
    .split('**')
    .map((text, i) => ({ text, style: i % 2 === 1 ? bold : regular }))
    .filter((g) => g.text !== '');
}

export interface Word {
  /** The word's characters by style (no spaces, but those inside a glued group). */
  readonly parts: Glyphs[];
  readonly width: number;
  /** The space after it (style and natural width), when one follows. */
  readonly space?: { readonly style: Style; readonly width: number };
  /**
   * Spaces inside a group of words a line may not break between (`mayBreakAt`), and their
   * natural width: justification stretches them with the others.
   */
  readonly inner?: { readonly count: number; readonly width: number };
}

export interface SetLine {
  readonly words: Word[];
  readonly x: number;
  readonly natural: number;
  /** Extra width after each space (justified lines), points. */
  readonly extra: number;
  /** Stretched gap over the natural gap (1 = natural). */
  readonly stretch: number;
}

// ---------------------------------------------------------------------------
// Page writer
// ---------------------------------------------------------------------------

export interface ParagraphSpec {
  readonly x: number;
  /** First baseline. */
  readonly y: number;
  readonly width: number;
  readonly leading: number;
  readonly align?: 'left' | 'justify';
  readonly indent?: number;
  /** Structure type (P, H1, LI …) and its parent. */
  readonly type?: string;
  readonly parent?: Elem;
  /** Lines may not stretch past this (justified; design §4 p3 rule 4). */
  readonly maxStretch?: number;
  /**
   * Ragged display copy only (never an edit target, whose width the editor reads back): set
   * the lines as narrow as keeps their count, until the last line is no orphan (MOB-14).
   */
  readonly pretty?: boolean;
}

export interface SetParagraph {
  readonly lines: SetLine[];
  /** The baseline after the last line (y − lines × leading). */
  readonly next: number;
  readonly last: number;
  readonly elem: Elem;
  readonly maxStretch: number;
}

/** A word's text as set (its parts joined). */
const wordText = (word: Word) => word.parts.map((p) => p.text).join('');

/** A line's spaces (between its words and inside glued groups): count and natural width. */
function spaces(line: readonly Word[]): { count: number; width: number } {
  let count = 0;
  let width = 0;
  line.forEach((w, k) => {
    count += w.inner?.count ?? 0;
    width += w.inner?.width ?? 0;
    if (k < line.length - 1) {
      count += 1;
      width += w.space?.width ?? 0;
    }
  });
  return { count, width };
}

/** The natural width of a paragraph's last line over `width`. */
function lastShare(lines: readonly (readonly Word[])[], width: number): number {
  const last = lines.at(-1) ?? [];
  const natural = last.reduce(
    (s, w, k) => s + w.width + (k < last.length - 1 ? (w.space?.width ?? 0) : 0),
    0,
  );
  return natural / width;
}

/**
 * Phrases a line never breaks inside (MOB-15): place names, the issue and its number, a shortcut's
 * "on a Mac", a verb in two words. Compared without punctuation or a Turkish suffix.
 */
export const NO_BREAK: readonly string[] = [
  'No. 07',
  'Sayı 07',
  'on a Mac',
  'basılı tutup',
  'iki parmağınızla',
  'Cape Ardıç',
  'Ardıç Burnu',
  'Saltmarsh Press',
];

/** A word without its surrounding punctuation or a Turkish suffix after an apostrophe. */
export const bare = (word: string) =>
  word.replace(/^[(“"‘'[]+|[)”"’'\].,;:!?…*]+$/gu, '').replace(/’\p{L}+$/u, '');

/**
 * Whether a line may break between `words[k - 1]` and `words[k]` (MOB-15). Never:
 * - inside a phrase of `NO_BREAK`;
 * - after a one-letter word ("a lamp", "o hâlâ");
 * - after a number of up to three digits, which keeps its unit or noun ("112 steps", "42 m",
 *   "1 January", "30 days", "3. sayfada"), or before one ("page 3", "Swap 4");
 * - between a month and its year ("January 2027", "Ocak 2027’den");
 * - after a sentence's first word of one or two letters ("…No. 07. We / may");
 * - between a shortcut and the platform it is for ("Cmd+S on a Mac", "Mac’te Cmd+S").
 */
export function mayBreakAt(words: readonly string[], k: number): boolean {
  const before = words[k - 2] ?? '';
  const prev = words[k - 1] ?? '';
  const next = words[k] ?? '';
  const p = bare(prev);
  const n = bare(next);
  if (/^\p{L}$/u.test(p)) return false;
  if (/^\d{1,3}$/.test(p) || /^\d{1,3}$/.test(n)) return false;
  if (/^\p{Lu}\p{Ll}+$/u.test(p) && /^\d{4}$/.test(n) && !/[.,;:]$/.test(prev)) return false;
  if (/^\p{Lu}\p{Ll}?$/u.test(p) && (k === 1 || /[.!?:]$/.test(before))) return false;
  if (prev.startsWith('Mac’') && /^(Cmd|Ctrl)\+/.test(next)) return false;
  if (/^\(?(Cmd|Ctrl)\+/.test(prev) && next === 'on') return false;
  // Inside a parenthesis of up to five words ("(Ctrl+S; Cmd+S on a Mac)").
  const open = words.slice(Math.max(0, k - 4), k).findLastIndex((x) => x.startsWith('('));
  if (open >= 0) {
    const from = Math.max(0, k - 4) + open;
    const close = words.slice(from, from + 5).findIndex((x) => /\)[.,;:]?$/.test(x));
    if (close >= 0 && from + close >= k && !words.slice(from, k).some((x) => x.endsWith(')')))
      return false;
  }
  for (const phrase of NO_BREAK) {
    const tokens = phrase.split(' ');
    for (let j = 0; j < tokens.length - 1; j++) {
      const start = k - 1 - j;
      if (start < 0 || start + tokens.length > words.length) continue;
      if (tokens.every((t, i) => bare(words[start + i] ?? '') === t)) return false;
    }
  }
  return true;
}

/** A line's words as set: glued groups split back into their words. */
const lineWords = (line: readonly Word[]) => line.flatMap((w) => wordText(w).split(' '));

/**
 * What is wrong with a paragraph's breaks (MOB-15): a break `mayBreakAt` forbids, and, in
 * ragged copy of two or more lines, a last line under 30 % of the measure (an orphan).
 */
export function breakProblems(
  lines: readonly (readonly Word[])[],
  width: number,
  ragged: boolean,
): string[] {
  return lineProblems(lines.map(lineWords), ragged ? lastShare(lines, width) : 1);
}

/** `breakProblems` over lines of words and the last line's share of the measure. */
export function lineProblems(texts: readonly (readonly string[])[], share: number): string[] {
  const problems: string[] = [];
  const flat = texts.flat();
  let k = 0;
  texts.forEach((line, i) => {
    k += line.length;
    if (i < texts.length - 1 && !mayBreakAt(flat, k))
      problems.push(`"${line.at(-1)} / ${texts[i + 1]?.[0]}"`);
  });
  if (texts.length > 1 && share < 0.3)
    problems.push(`short last line "${texts.at(-1)?.join(' ')}"`);
  return problems;
}

/** A paragraph as a file sets it (MOB-15: the fixture test re-checks every break). */
export interface SetText {
  /** 1-based page. */
  readonly page: number;
  readonly lines: readonly (readonly string[])[];
  /** The last line's natural width over the measure (1 for justified copy). */
  readonly share: number;
}
const setTexts = new WeakMap<PDFDocument, SetText[]>();
/** Every paragraph set in `doc` so far. */
export const textsOf = (doc: PDFDocument): readonly SetText[] => setTexts.get(doc) ?? [];

export class Writer {
  readonly page: PDFPage;
  readonly index: number;
  readonly doc: PDFDocument;
  readonly faces: Faces;
  readonly tags: Structure;
  /** The page's Sect element. */
  readonly sect: Elem;
  private readonly widths = new Map<string, number>();

  constructor(doc: PDFDocument, faces: Faces, tags: Structure, page: PDFPage, index: number) {
    this.doc = doc;
    this.faces = faces;
    this.tags = tags;
    this.page = page;
    this.index = index;
    for (const id of Object.keys(FACES) as FaceId[])
      page.node.setFontDictionary(PDFName.of(FACES[id].key), faces[id].ref);
    this.sect = tags.elem('Sect', page);
  }

  elem(type: string, parent: Elem = this.sect, alt?: string): Elem {
    return this.tags.elem(type, this.page, parent, alt);
  }

  /** Advance width of `value` (no kerning: the drawn advances are the font's widths). */
  width(style: Style, value: string): number {
    const key = `${style.face}|${style.size}|${value}`;
    let plain = this.widths.get(key);
    if (plain === undefined) {
      plain = this.faces[style.face].widthOfTextAtSize(value, style.size);
      this.widths.set(key, plain);
    }
    return plain + (style.tracking ?? 0) * Math.max(0, Array.from(value).length - 1);
  }

  private open(elem: Elem | null): PDFOperator {
    return elem
      ? bdc(elem.type, this.doc.context.obj({ MCID: this.tags.mcid(this.index, elem) }))
      : bdc('Artifact', this.doc.context.obj({ Type: 'Pagination' }));
  }

  /**
   * One line in one text object: runs of glyphs at an absolute Tm, `extra` points after each
   * space glyph as a TJ offset.
   */
  line(elem: Elem | null, runs: readonly Glyphs[], x: number, y: number, extra = 0): void {
    const ops: string[] = ['BT'];
    let face: string | undefined;
    let size: number | undefined;
    let color: string | undefined;
    let tracking = 0;
    ops.push(`1 0 0 1 ${r2(x)} ${r2(y)} Tm`);
    for (const run of runs) {
      const s = run.style;
      const rgb = s.color.map((c) => r2(c * 1000) / 1000).join(' ');
      if (rgb !== color) ops.push(`${rgb} rg`);
      color = rgb;
      if (FACES[s.face].key !== face || s.size !== size)
        ops.push(`/${FACES[s.face].key} ${s.size} Tf`);
      face = FACES[s.face].key;
      size = s.size;
      if ((s.tracking ?? 0) !== tracking) ops.push(`${s.tracking ?? 0} Tc`);
      tracking = s.tracking ?? 0;
      ops.push(this.tj(run.text, s, extra));
    }
    ops.push('ET');
    // Tc is text state that outlives ET: a tracked label resets it, so the lines after it
    // (the edit targets) carry no tracking (design §4 p3 rule 5).
    if (tracking !== 0) ops.push('0 Tc');
    this.page.pushOperators(this.open(elem), raw(ops.join('\n')), emc());
  }

  private tj(text: string, style: Style, extra: number): string {
    const font = this.faces[style.face];
    const spec = FACES[style.face];
    const missing = openFont(spec.file)
      .layout(text, spec.features)
      .glyphs.findIndex((g) => g.id === 0);
    if (missing >= 0)
      throw new Error(`${spec.file} has no glyph for "${Array.from(text)[missing]}" in "${text}"`);
    if (!extra || !text.includes(' ')) return `${font.encodeText(text).toString()} Tj`;
    const offset = Math.round((-extra * 1000 * 10) / style.size) / 10;
    const parts: string[] = [];
    const pieces = text.split(' ');
    pieces.forEach((piece, i) => {
      const last = i === pieces.length - 1;
      const chunk = last ? piece : `${piece} `;
      if (chunk) parts.push(font.encodeText(chunk).toString());
      if (!last) parts.push(String(offset));
    });
    return `[${parts.join(' ')}] TJ`;
  }

  /** A single line of plain text; `align` right ends it at `x`, centre centres it on `x`. */
  text(
    elem: Elem | null,
    style: Style,
    x: number,
    y: number,
    value: string,
    align: 'left' | 'right' | 'center' = 'left',
  ): number {
    const width = this.width(style, value);
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    this.line(elem, [{ text: value, style }], left, y);
    return width;
  }

  /**
   * Splits runs into words with their widths and following spaces; the words a line may not
   * break between are glued into one (`mayBreakAt`, MOB-15).
   */
  words(runs: readonly Glyphs[]): Word[] {
    const out: Word[] = [];
    let parts: Glyphs[] = [];
    let width = 0;
    const push = (space?: Style) => {
      if (parts.length === 0) return;
      out.push({
        parts,
        width,
        ...(space ? { space: { style: space, width: this.width(space, ' ') } } : {}),
      });
      parts = [];
      width = 0;
    };
    for (const run of runs) {
      const pieces = run.text.split(' ');
      pieces.forEach((piece, i) => {
        if (piece) {
          parts.push({ text: piece, style: run.style });
          width += this.width(run.style, piece);
        }
        if (i < pieces.length - 1) push(run.style);
      });
    }
    push();
    const texts = out.map(wordText);
    const glued: Word[] = [];
    out.forEach((word, k) => {
      const prev = glued.at(-1);
      if (k === 0 || !prev?.space || mayBreakAt(texts, k)) {
        glued.push(word);
        return;
      }
      glued[glued.length - 1] = {
        parts: [...prev.parts, { text: ' ', style: prev.space.style }, ...word.parts],
        width: prev.width + prev.space.width + word.width,
        ...(word.space ? { space: word.space } : {}),
        inner: {
          count: (prev.inner?.count ?? 0) + 1,
          width: (prev.inner?.width ?? 0) + prev.space.width,
        },
      };
    });
    return glued;
  }

  /**
   * One measure for a block of ragged paragraphs set one under another (MOB-15, A5): the
   * widest at or under `width` (2 pt steps, down to 60 %) at which none of its paragraphs of
   * two or more lines ends on a line under 40 % of it, so the block's right edge is one rag and
   * every paragraph ends on a full last line; `width` when none is (the copy must change).
   */
  blockMeasure(paragraphs: readonly (readonly Glyphs[])[], width: number): number {
    const words = paragraphs.map((runs) => this.words(runs));
    for (let m = width; m >= width * 0.6; m -= 2) {
      const ok = words.every((w) => {
        const lines = this.breakLines(w, m, 0, false);
        return lines.length < 2 || lastShare(lines, m) >= 0.4;
      });
      if (ok) return m;
    }
    return width;
  }

  /**
   * Ragged lines with no orphan: if the last line of a paragraph of two or more lines fills
   * less than 40 % of the measure, narrower measures are tried (2 pt steps, down to 55 %) and
   * the first that keeps the line count and lengthens the last line past that is kept.
   */
  prettyLines(words: Word[], width: number, indent: number): Word[][] {
    const base = this.breakLines(words, width, indent, false);
    if (base.length < 2 || lastShare(base, width) >= 0.4) return base;
    for (let w = width - 2; w >= width * 0.55; w -= 2) {
      const lines = this.breakLines(words, w, indent, false);
      if (lines.length > base.length) break;
      if (lastShare(lines, width) >= 0.4) return lines;
    }
    return base;
  }

  /**
   * Breaks `words` into lines: left-aligned paragraphs greedy first fit (as the editor's
   * rewrap), justified ones by least total stretch so no line stretches past `maxStretch`
   * where that can be avoided (design §4 p3 rule 4; the generator asserts it).
   */
  breakLines(words: Word[], width: number, indent: number, justify: boolean): Word[][] {
    const avail = (line: number) => width - (line === 0 ? indent : 0);
    const natural = (from: number, to: number) => {
      let w = 0;
      for (let k = from; k < to; k++) {
        const word = words[k] as Word;
        w += word.width + (k < to - 1 ? (word.space?.width ?? 0) : 0);
      }
      return w;
    };
    if (!justify) {
      const lines: Word[][] = [];
      let start = 0;
      for (let k = 1; k <= words.length; k++) {
        if (k < words.length && natural(start, k + 1) <= avail(lines.length)) continue;
        if (k === words.length) {
          lines.push(words.slice(start));
          break;
        }
        lines.push(words.slice(start, k));
        start = k;
      }
      return lines;
    }
    // Least-badness breaking over word indices (lines start at i, end before j).
    const n = words.length;
    const best: { cost: number; prev: number; lines: number }[] = [{ cost: 0, prev: -1, lines: 0 }];
    for (let j = 1; j <= n; j++) {
      best[j] = { cost: Number.POSITIVE_INFINITY, prev: -1, lines: 0 };
      for (let i = j - 1; i >= 0; i--) {
        const from = best[i];
        if (!from || !Number.isFinite(from.cost)) continue;
        const w = natural(i, j);
        const room = avail(from.lines);
        if (w > room && j - i > 1) break;
        let cost: number;
        if (j === n) {
          // The last line: natural spaces; a very short one (a widow) costs.
          cost = w < room * 0.2 ? 4 : 0;
        } else {
          const line = words.slice(i, j);
          const gaps = spaces(line).count;
          const gapWidth = spaces(line).width;
          const stretch = gaps === 0 ? 10 : (gapWidth + room - w) / gapWidth;
          cost = (stretch - 1) ** 2 + (stretch > 1.5 ? 100 * (stretch - 1.5) : 0);
        }
        const total = from.cost + cost;
        const cur = best[j] as { cost: number };
        if (total < cur.cost) best[j] = { cost: total, prev: i, lines: from.lines + 1 };
      }
    }
    const breaks: number[] = [];
    for (let j = n; j > 0; j = best[j]?.prev ?? 0) breaks.unshift(j);
    let start = 0;
    return breaks.map((end) => {
      const line = words.slice(start, end);
      start = end;
      return line;
    });
  }

  /** Sets a paragraph: one tagged element, one text object per line. */
  paragraph(runs: readonly Glyphs[], spec: ParagraphSpec): SetParagraph {
    const elem = this.elem(spec.type ?? 'P', spec.parent);
    const indent = spec.indent ?? 0;
    const justify = spec.align === 'justify';
    const words = this.words(runs);
    const broken =
      spec.pretty && !justify
        ? this.prettyLines(words, spec.width, indent)
        : this.breakLines(words, spec.width, indent, justify);
    const lines: SetLine[] = [];
    let maxStretch = 1;
    broken.forEach((line, li) => {
      const x = spec.x + (li === 0 ? indent : 0);
      const room = spec.width - (li === 0 ? indent : 0);
      const natural = line.reduce(
        (s, w, k) => s + w.width + (k < line.length - 1 ? (w.space?.width ?? 0) : 0),
        0,
      );
      const { count: gaps, width: gapWidth } = spaces(line);
      const isLast = li === broken.length - 1;
      const extra = justify && !isLast && gaps > 0 ? (room - natural) / gaps : 0;
      const stretch = gapWidth > 0 ? (gapWidth + extra * gaps) / gapWidth : 1;
      maxStretch = Math.max(maxStretch, stretch);
      lines.push({ words: line, x, natural, extra, stretch });
      this.line(elem, this.lineRuns(line), x, spec.y - li * spec.leading, extra);
    });
    // Copy fitting: `SAMPLE_FIT=1 pnpm … sample` prints every justified paragraph's lines with
    // their stretch and how much to add or cut to bring a line within the cap, and builds on
    // past an over-stretched line so the whole page can be read at once.
    const fitting = process.env.SAMPLE_FIT !== undefined;
    if (fitting && justify) console.log(fitReport(runs, lines, spec, indent));
    const share = justify ? 1 : lastShare(broken, spec.width);
    const list = setTexts.get(this.doc) ?? [];
    setTexts.set(this.doc, list);
    list.push({ page: this.index + 1, lines: broken.map(lineWords), share: r2(share) });
    const problems = breakProblems(broken, spec.width, !justify);
    if (problems.length > 0) {
      const message = `bad line breaks (MOB-15): ${problems.join('; ')}`;
      if (!fitting) throw new Error(message);
      console.log(`!! p${this.index + 1} ${message}`);
    }
    if (
      justify &&
      spec.maxStretch !== undefined &&
      maxStretch > spec.maxStretch + 1e-6 &&
      !fitting
    ) {
      const text = runs.map((r) => r.text).join('');
      throw new Error(
        `justified paragraph stretches ${maxStretch.toFixed(2)} × (cap ${spec.maxStretch}): "${text.slice(0, 50)}…"`,
      );
    }
    return {
      lines,
      next: spec.y - lines.length * spec.leading,
      last: spec.y - (lines.length - 1) * spec.leading,
      elem,
      maxStretch,
    };
  }

  /** A line's words as style runs, spaces kept between words. */
  private lineRuns(line: readonly Word[]): Glyphs[] {
    const out: Glyphs[] = [];
    const add = (text: string, style: Style) => {
      const prev = out.at(-1);
      if (prev?.style === style) out[out.length - 1] = { text: prev.text + text, style };
      else out.push({ text, style });
    };
    line.forEach((word, k) => {
      for (const part of word.parts) add(part.text, part.style);
      if (k < line.length - 1 && word.space) add(' ', word.space.style);
    });
    return out;
  }

  /** Decoration, marked as an artifact. */
  art(...ops: PDFOperator[]): void {
    this.page.pushOperators(
      bmc('Artifact'),
      pushGraphicsState(),
      ...ops,
      popGraphicsState(),
      emc(),
    );
  }

  /** Drawing that belongs to a Figure element. */
  figure(elem: Elem, ...ops: PDFOperator[]): void {
    this.page.pushOperators(
      this.open(elem),
      pushGraphicsState(),
      ...ops,
      popGraphicsState(),
      emc(),
    );
  }

  /** A page resource (ExtGState, Shading, XObject) under `name`. */
  resource(
    kind: 'ExtGState' | 'Shading' | 'Pattern' | 'XObject',
    name: string,
    value: PDFObject,
  ): void {
    const resources = this.page.node.normalizedEntries().Resources;
    let dict = resources.lookupMaybe(PDFName.of(kind), PDFDict);
    if (!dict) {
      dict = this.doc.context.obj({});
      resources.set(PDFName.of(kind), dict);
    }
    dict.set(PDFName.of(name), value);
  }

  /** An annotation on this page (registered, added to /Annots). */
  annotation(dict: Record<string, unknown>): PDFRef {
    const ref = this.doc.context.register(
      this.doc.context.obj({ ...(dict as Record<string, PDFObject>), P: this.page.ref }),
    );
    this.page.node.addAnnot(ref);
    return ref;
  }
}

/** The copy-fitting report of one justified paragraph (see `Writer.paragraph`). */
function fitReport(
  runs: readonly Glyphs[],
  lines: readonly SetLine[],
  spec: ParagraphSpec,
  indent: number,
): string {
  const head = runs
    .map((r) => r.text)
    .join('')
    .slice(0, 40);
  const rows = lines.map((l, li) => {
    const room = spec.width - (li === 0 ? indent : 0);
    const slack = room - l.natural;
    const space = l.words[0]?.space?.width ?? 2.5;
    const next = lines[li + 1]?.words[0];
    const pull = next ? next.width + space - slack : 0;
    const add = slack - (l.words.length - 1) * space * 0.5;
    const flag = l.stretch > 1.5 + 1e-6 ? '!!' : '  ';
    const text = l.words.map((w) => w.parts.map((p) => p.text).join('')).join(' ');
    return `  ${flag} ${l.stretch.toFixed(2)} add ${add.toFixed(1)} or cut ${pull.toFixed(1)} | ${text}`;
  });
  return `\n¶ ${head}\n${rows.join('\n')}`;
}
