/**
 * What every page of the sample shares (design.md §2): the edition and locale it is drawn
 * for, its place in the cut (folios and links are numbered from the cut's own pages, MOB-12),
 * and the page furniture: the running head, the footer and the try slip.
 */
import { type PDFDocument, PDFHexString, PDFName, type PDFPage, PDFString } from '@cantoo/pdf-lib';
import type { SampleCopy } from './copy.ts';
import {
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
  RIGHT,
  RULE,
  STYLE,
  type Style,
  type Writer,
  circlePath,
  disc,
  hairline,
  r2,
  rich,
  roundRect,
  roundedPath,
  raw,
} from './kit.ts';
import { FRAME_TIME, gs, hex, lampTab, mix, scale, sharedShading } from './light.ts';

const SLIP_GROUND = hex('#15171C');
/** The try slip's foot on a page, and the top of a two-line slip (design §2). */
export const SLIP_Y = 50;
export const SLIP_TOP = SLIP_Y + 40;

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
  w.art(...lampTab(w, id));
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
 * The try slip, v2's lower third (design §2; MOB-14, direction-v2.md §5.3): a dark band
 * across the measure with the lamp lit in it (a screened glow clipped to the band, round a lit
 * dot), TRY and one sentence of at most two lines. Read last on the page (it is drawn last).
 * `onDark` sets it on the cover's night, a shade lighter than the night. Returns its top.
 */
export function trySlip(
  ctx: PageCtx,
  sentence: string,
  opts: { onDark?: boolean; y?: number; raster?: (runs: readonly SlipRun[]) => void } = {},
) {
  const { w } = ctx;
  const style: Style = { ...STYLE.ui, color: COVER_TEXT };
  const textX = LEFT + 74;
  const width = RIGHT - 14 - textX;
  const lines = w.prettyLines(w.words([{ text: sentence, style }]), width, 0);
  if (lines.length > 2) throw new Error(`try slip over two lines: "${sentence}"`);
  const h = lines.length === 2 ? 40 : 28;
  const y0 = opts.y ?? SLIP_Y;
  w.art(...roundRect(LEFT, y0, MEASURE, h, 6, opts.onDark ? COVER_SLIP : SLIP_GROUND));
  const first = y0 + h / 2 + (lines.length === 2 ? 3.2 : -3.1);
  const dotY = first + 3.1;
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
  w.art(
    raw('q'),
    ...roundedPath(LEFT, y0, MEASURE, h, 6),
    raw(`W n /GsScr gs 15 0 0 15 ${r2(LEFT + 15)} ${r2(dotY)} cm /ShSlip sh Q`),
    ...disc(LEFT + 15, dotY, 2.6, mix(LIME, [1, 1, 1], 0.35)),
  );
  const labelStyle: Style = { ...STYLE.label, color: LIME };
  if (opts.raster) {
    opts.raster([
      { text: up(ctx, ctx.copy.tryLabel), style: labelStyle, x: LEFT + 25, y: first },
      ...lines.map((line, i) => ({
        text: line.map((word) => word.parts.map((p) => p.text).join('')).join(' '),
        style,
        x: textX,
        y: first - i * 12,
      })),
    ]);
    return y0 + h;
  }
  w.text(null, labelStyle, LEFT + 25, first, up(ctx, ctx.copy.tryLabel));
  const div = w.elem('Div');
  w.paragraph([{ text: sentence, style }], {
    x: textX,
    y: first,
    width,
    leading: 12,
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
  const ref = w.annotation({
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Text'),
    Rect: w.doc.context.obj([r2(x), r2(y), r2(x + 20), r2(y + 20)]),
    Name: PDFName.of('Comment'),
    T: PDFHexString.fromText(author),
    Contents: PDFHexString.fromText(text),
    M: PDFString.of('D:20261001090000Z'),
    CreationDate: PDFString.of('D:20261001090000Z'),
    C: w.doc.context.obj([0.996, 0.851, 0.4]),
    F: 4,
    Open: false,
  });
  w.tags.annot(w.elem('Annot', parent), ref, w.page);
}

export { circlePath, rich };
