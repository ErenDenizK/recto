/**
 * What every page of the sample shares (design.md §2): the edition and locale it is drawn
 * for, its place in the cut (folios and links are numbered from the cut's own pages, MOB-12),
 * and the page furniture: the running head, the footer and the try slip.
 */
import { type PDFDocument, PDFHexString, PDFName, type PDFPage, PDFString } from '@cantoo/pdf-lib';
import type { SampleCopy } from './copy.ts';
import {
  CAP,
  COVER_MUTED,
  COVER_SLIP,
  COVER_TEXT,
  type Elem,
  FOOT_Y,
  HEAD_RULE_Y,
  HEAD_Y,
  LEFT,
  LIME,
  LIME_800,
  MEASURE,
  PT,
  RIGHT,
  RULE,
  STYLE,
  type Style,
  type Writer,
  breakProblems,
  caps,
  circlePath,
  disc,
  hairline,
  r2,
  rich,
  roundRect,
  roundedPath,
  raw,
} from './kit.ts';
import { FRAME_TIME, gs, hex, mix, scale, sharedShading } from './light.ts';

const SLIP_GROUND = hex('#15171C');
/** The sticky note's paper and its fold (B2). */
const NOTE = hex('#F6E27A');
const NOTE_EDGE = hex('#D2BA4E');
/** The try slip's foot on a page (design §2); `slipTop` gives its top. */
export const SLIP_Y = 50;

export type SampleLocale = 'en' | 'tr';
export type SampleEdition = 'full' | 'phone';

export interface PageCtx {
  readonly w: Writer;
  readonly doc: PDFDocument;
  readonly copy: SampleCopy;
  readonly locale: SampleLocale;
  readonly edition: SampleEdition;
  /** This page's 1-based number in the cut, and the cut's page count. */
  readonly n: number;
  readonly total: number;
  /** The cut's page ids in order. */
  readonly ids: readonly string[];
  /** The file name (seeds the scan's dust). */
  readonly file: string;
  /** 1-based number of page `id` in this cut, or undefined when the cut leaves it out. */
  pageOf(id: string): number | undefined;
  pageRef(id: string): PDFPage | undefined;
}

const up = (ctx: PageCtx, value: string) => value.toLocaleUpperCase(ctx.copy.lang);

/**
 * Running head (left the issue, right the slate: section and hour), the footer with its
 * folio, and the lamp tab on the fore-edge (MOB-14).
 */
export function furniture(ctx: PageCtx, section: string): void {
  const { w, copy } = ctx;
  const id = ctx.ids[ctx.n - 1] ?? '';
  w.text(null, STYLE.head, LEFT, HEAD_Y, copy.head);
  // The slate (direction-v2.md §7): the section, 9 pt, then the frame's hour in lime-800.
  const time = FRAME_TIME[id] ?? '';
  const tw = w.text(null, { ...STYLE.head, color: LIME_800 }, RIGHT, HEAD_Y, time, 'right');
  w.text(null, STYLE.head, RIGHT - tw - 9, HEAD_Y, up(ctx, section), 'right');
  w.art(...hairline(LEFT, HEAD_RULE_Y, RIGHT, HEAD_RULE_Y, RULE));
  footer(ctx);
}

export function footer(ctx: PageCtx, dark = false): void {
  const style: Style = { ...STYLE.folio, color: dark ? COVER_MUTED : STYLE.folio.color };
  const y = dark ? 18 : FOOT_Y;
  ctx.w.text(null, style, LEFT, y, ctx.copy.footer);
  ctx.w.text(null, style, RIGHT, y, `${ctx.n} / ${ctx.total}`, 'right');
}

/** The kicker: tracked capitals in lime-800 (the one accent on white, design §2). */
export function kicker(ctx: PageCtx, y: number, value: string): void {
  ctx.w.text(null, STYLE.kicker, LEFT, y, up(ctx, value));
}

/** A line of the slip's type, for a page that draws it without text (the scan). */
export interface SlipRun {
  readonly text: string;
  readonly style: Style;
  readonly x: number;
  readonly y: number;
}

/**
 * The slip's type by edition (MOB-15, A6): the phone reads its page at fit width, about 0.63
 * CSS px a point, so its slip is set at 13.5 (8.5 px), its label at 8, and it may take three
 * lines; the full cut's at 9.5, two lines at most. The sentence starts 12 pt after the label
 * (74 pt in from the slip's edge at least).
 */
function slipType(ctx: PageCtx) {
  const t =
    ctx.edition === 'phone'
      ? { size: PT.deck, leading: 17, label: PT.small, maxLines: 3, dot: 3.4 }
      : { size: PT.body, leading: 12, label: PT.label, maxLines: 2, dot: 2.6 };
  const label = ctx.w.width(
    { ...STYLE.label, size: t.label, tracking: caps(t.label) },
    up(ctx, ctx.copy.tryLabel),
  );
  return { ...t, textX: r2(Math.max(LEFT + 74, LEFT + 25 + label + 12)) };
}

/** The slip's sentence broken into its lines (no orphan, no forbidden break). */
function slipLines(ctx: PageCtx, sentence: string) {
  const t = slipType(ctx);
  const style: Style = { ...STYLE.ui, size: t.size, color: COVER_TEXT };
  const width = RIGHT - 14 - t.textX;
  const lines = ctx.w.prettyLines(ctx.w.words([{ text: sentence, style }]), width, 0);
  if (lines.length > t.maxLines)
    throw new Error(`try slip over ${t.maxLines} lines (${ctx.edition}): "${sentence}"`);
  const problems = breakProblems(lines, width, true);
  if (problems.length > 0) throw new Error(`try slip: ${problems.join('; ')}`);
  // Padding round the block of type (cap height to the last baseline), 10.5 / 12 pt.
  const pad = ctx.edition === 'phone' ? 12 : 10.55;
  const h = (lines.length - 1) * t.leading + t.size * CAP + 2 * pad;
  return { t, style, width, lines, h };
}

/** The top of a page's try slip, for a page that fills the space above it. */
export function slipTop(ctx: PageCtx, sentence: string): number {
  return SLIP_Y + slipLines(ctx, sentence).h;
}

/**
 * The try slip, v2's lower third (design §2; MOB-14, direction-v2.md §5.3): a dark band
 * across the measure with the lamp lit in it (a screened glow clipped to the band, round a lit
 * dot), TRY and one sentence (two lines at most, three on the phone). Read last on the page
 * (it is drawn last). `onDark` sets it on the cover's night, a shade lighter than the night.
 * Returns its top.
 */
export function trySlip(
  ctx: PageCtx,
  sentence: string,
  opts: { onDark?: boolean; y?: number; raster?: (runs: readonly SlipRun[]) => void } = {},
) {
  const { w } = ctx;
  const { t, style, width, lines, h } = slipLines(ctx, sentence);
  const y0 = opts.y ?? SLIP_Y;
  w.art(...roundRect(LEFT, y0, MEASURE, h, 6, opts.onDark ? COVER_SLIP : SLIP_GROUND));
  // The block of type centred in the band: cap height over the first line, the last baseline.
  const cap = t.size * CAP;
  const first =
    y0 + (h - (lines.length - 1) * t.leading - cap) / 2 + (lines.length - 1) * t.leading;
  const dotY = first + cap / 2;
  // The lamp: one shading object per file in the lamp's lime (the hour's colour lives in the
  // tab), screened and clipped to the slip, which PDFium blends against (§5.4).
  w.resource(
    'Shading',
    'ShSlip',
    sharedShading(w, 'slip', [
      [0, mix(LIME, [1, 1, 1], 0.5)],
      [0.2, scale(LIME, 0.75)],
      [0.55, scale(LIME, 0.12)],
      [1, [0, 0, 0]],
    ]),
  );
  gs(w, 'GsScr', { BM: 'Screen' });
  const glowR = t.dot * 5.8;
  w.art(
    raw('q'),
    ...roundedPath(LEFT, y0, MEASURE, h, 6),
    raw(`W n /GsScr gs ${r2(glowR)} 0 0 ${r2(glowR)} ${r2(LEFT + 15)} ${r2(dotY)} cm /ShSlip sh Q`),
    ...disc(LEFT + 15, dotY, t.dot, mix(LIME, [1, 1, 1], 0.35)),
  );
  const labelStyle: Style = {
    ...STYLE.label,
    size: t.label,
    tracking: caps(t.label),
    color: LIME,
  };
  const labelY = dotY - (t.label * CAP) / 2;
  if (opts.raster) {
    opts.raster([
      { text: up(ctx, ctx.copy.tryLabel), style: labelStyle, x: LEFT + 25, y: labelY },
      ...lines.map((line, i) => ({
        text: line.map((word) => word.parts.map((p) => p.text).join('')).join(' '),
        style,
        x: t.textX,
        y: first - i * t.leading,
      })),
    ]);
    return y0 + h;
  }
  w.text(null, labelStyle, LEFT + 25, labelY, up(ctx, ctx.copy.tryLabel));
  const div = w.elem('Div');
  w.paragraph([{ text: sentence, style }], {
    x: t.textX,
    y: first,
    width,
    leading: t.leading,
    parent: div,
    pretty: true,
  });
  return y0 + h;
}

/** A link annotation to page `id` of this cut over `rect` (x0, y0, x1, y1), tagged as a Link. */
export function link(
  ctx: PageCtx,
  rect: readonly [number, number, number, number],
  id: string,
  contents: string,
  parent: Elem,
): Elem | undefined {
  const target = ctx.pageRef(id);
  if (!target) return undefined;
  const { w } = ctx;
  const ref = w.annotation({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Link'),
    Rect: w.doc.context.obj(rect.map(r2)),
    Border: w.doc.context.obj([0, 0, 0]),
    Contents: PDFHexString.fromText(contents),
    Dest: w.doc.context.obj([target.ref, PDFName.of('XYZ'), null, r2(target.getHeight()), null]),
  });
  const elem = w.elem('Link', parent);
  elem.attrs.Alt = PDFHexString.fromText(contents);
  w.tags.annot(elem, ref, w.page);
  return elem;
}

/** A sticky note (Text annotation) present from the start (design §4 p2). */
export function note(
  ctx: PageCtx,
  x: number,
  y: number,
  author: string,
  text: string,
  parent: Elem,
): void {
  const { w } = ctx;
  // Its own appearance (B2): a 16 pt note in a soft note yellow, rounded, with three lines in
  // lime-800, instead of PDFium's default Comment icon in pure yellow.
  const S = 16;
  const lines = [11.2, 8, 4.8]
    .map((ly, i) => `3.4 ${ly} m ${i === 2 ? 9.2 : 12.6} ${ly} l`)
    .join(' ');
  const ap = w.doc.context.register(
    w.doc.context.formXObject(
      [
        raw(
          `${NOTE.map(r2).join(' ')} rg ${NOTE_EDGE.map(r2).join(' ')} RG 0.5 w 0.25 0.25 m 15.75 0.25 l 15.75 12.4 l 12.4 15.75 l 0.25 15.75 l h B ${NOTE_EDGE.map(r2).join(' ')} rg 12.4 15.75 m 12.4 12.4 l 15.75 12.4 l h f ${LIME_800.map(r2).join(' ')} RG 0.8 w 1 J ${lines} S`,
        ),
      ],
      { BBox: [0, 0, S, S] },
    ),
  );
  const ref = w.annotation({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Text'),
    Rect: w.doc.context.obj([r2(x), r2(y), r2(x + S), r2(y + S)]),
    Name: PDFName.of('Comment'),
    T: PDFHexString.fromText(author),
    Contents: PDFHexString.fromText(text),
    M: PDFString.of('D:20261001090000Z'),
    CreationDate: PDFString.of('D:20261001090000Z'),
    C: w.doc.context.obj(NOTE.map(r2)),
    AP: w.doc.context.obj({ N: ap }),
    F: 4,
    Open: false,
  });
  w.tags.annot(w.elem('Annot', parent), ref, w.page);
}

export { circlePath, rich };
