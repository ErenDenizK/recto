/**
 * Page 3, the feature (design.md §4 page 3): the page people should want to edit. Real
 * editorial typography the paragraph editor reads as a typesetter made it: an H1, a ragged
 * deck, a one-line byline in two weights, four justified paragraphs in column 1 with free
 * lines under the last (the reflow demo), and in column 2 the lens plate, its caption, P5, a
 * pull quote and P6. Every rule of design §4 p3 "How the text must be written" holds here:
 * no drop cap, TJ justification, no Tc in edit targets, "*" at body size, Inter captions, one
 * text object per line, tags with an inner P.
 */
import {
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
} from '@cantoo/pdf-lib';
import { type PageCtx, furniture, kicker, trySlip } from '../context.ts';
import { cut } from '../copy.ts';
import {
  COL2,
  COL_W,
  INK,
  LEFT,
  LIME,
  LIME_800,
  MEASURE,
  MUTED,
  N4,
  N5,
  N6,
  N7,
  N8,
  PALE,
  RULE,
  STYLE,
  type Style,
  circlePath,
  disc,
  hairline,
  r2,
  rect,
  raw,
  rich,
  roundRect,
  roundedPath,
  type Writer,
} from '../kit.ts';

/** Body 9.5 / 13.5 (design §2): leading under 1.5 × size, so lines join even untagged. */
const LEADING = 13.5;
const INDENT = 9.5;
/** No line stretches its gaps past 1.5 × the natural space (design §4 p3 rule 4, TXT-15). */
const MAX_STRETCH = 1.5;
/** Free body lines under P4 before the footnote's rule (the reflow room, R-8). */
const FREE_LINES = 3;

const BYLINE: Style = { face: 'sans', size: 8.5, color: MUTED };
const BYLINE_NAME: Style = { face: 'bold', size: 8.5, color: INK };

export interface FeatureLayout {
  /** Lines per paragraph, for the manifest and the edit tests. */
  readonly paragraphs: Record<string, number>;
  readonly maxStretch: number;
}

export function featurePage(ctx: PageCtx): FeatureLayout {
  const { w, copy } = ctx;
  const c = copy.feature;
  const up = (v: string) => v.toLocaleUpperCase(copy.lang);
  furniture(ctx, c.section);
  kicker(ctx, 764, c.kicker);

  const h1 = w.elem('H1');
  c.title.forEach((line, i) => w.line(h1, [{ text: line, style: STYLE.h1 }], LEFT, 728 - i * 36));

  const deck = w.paragraph([{ text: c.deck, style: STYLE.deck }], {
    x: LEFT,
    y: 728 - (c.title.length - 1) * 36 - 36,
    width: MEASURE * 0.87,
    leading: 19,
  });
  const bylineY = deck.last - 26;
  w.paragraph(rich(c.byline, BYLINE, BYLINE_NAME), {
    x: LEFT,
    y: bylineY,
    width: MEASURE,
    leading: 12,
  });
  const ruleY = bylineY - 12;
  w.art(...hairline(LEFT, ruleY, LEFT + MEASURE, ruleY, RULE));
  const top = ruleY - 22;

  // The slip and the footnote sit at the foot; the columns fill the space above them.
  const slipTop = 50 + 40;
  const footBase = slipTop + 16;
  const footnoteLines = w.breakLines(
    w.words([{ text: c.footnote, style: STYLE.caption }]),
    COL_W,
    0,
    false,
  ).length;
  const footRule = footBase + (footnoteLines - 1) * 10 + 14;

  // Column 1: P1 to P4.
  const counts: Record<string, number> = {};
  let maxStretch = 1;
  let y = top;
  c.col1.forEach((text, i) => {
    const set = w.paragraph(rich(text, STYLE.body, STYLE.bodyBold), {
      x: LEFT,
      y,
      width: COL_W,
      leading: LEADING,
      align: 'justify',
      indent: i === 0 ? 0 : INDENT,
      maxStretch: MAX_STRETCH,
    });
    counts[`p${i + 1}`] = set.lines.length;
    maxStretch = Math.max(maxStretch, set.maxStretch);
    y = set.next;
  });
  const col1Last = y + LEADING;
  // The logbook aside hangs 3½ free lines under P4 (the reflow room, R-8: breathing room, not a
  // void) and holds as many of the logbook's entries as fit above the footnote.
  const logStyle: Style = { face: 'sans', size: 8.5, color: INK };
  const entryLines = c.log.map(
    (entry) =>
      w.breakLines(w.words([{ text: entry, style: logStyle }]), COL_W - 38, 0, false).length,
  );
  const boxTop = col1Last - LEADING * (1 + FREE_LINES + 0.5);
  let entries = 0;
  let boxH = 30;
  for (const lines of entryLines) {
    const next = boxH + (entries > 0 ? 6 : 0) + lines * 12;
    if (boxTop - next < footRule + 16) break;
    boxH = next;
    entries += 1;
  }
  if (entries === 0) throw new Error('feature: no room for the logbook aside');
  // The card runs down to the footnote, so the column ends on it rather than on white.
  const boxY = footRule + 16;
  boxH = boxTop - boxY;
  const free = (col1Last - boxTop) / LEADING - 1;
  if (free < FREE_LINES)
    throw new Error(`feature: ${free.toFixed(1)} free lines under P4, want ${FREE_LINES}`);
  const aside = w.elem('Aside');
  w.art(...roundRect(LEFT, boxY, COL_W, boxH, 6, PALE));
  w.art(...hairline(LEFT + 14, boxTop - 12, LEFT + 14, boxY + 12, LIME_800, 1.5));
  w.text(w.elem('P', aside), STYLE.label, LEFT + 24, boxTop - 19, up(c.logLabel));
  let ly = boxTop - 33;
  c.log.slice(0, entries).forEach((entry) => {
    ly =
      w.paragraph([{ text: entry, style: logStyle }], {
        x: LEFT + 24,
        y: ly,
        width: COL_W - 38,
        leading: 12,
        parent: aside,
      }).next - 6;
  });
  w.art(...hairline(LEFT, footRule, LEFT + 20, footRule, MUTED, 0.5));
  const note = w.elem('Note');
  w.paragraph([{ text: c.footnote, style: STYLE.caption }], {
    x: LEFT,
    y: footBase + (footnoteLines - 1) * 10,
    width: COL_W,
    leading: 10,
    parent: note,
  });

  // Column 2: measure what follows the plate, then give the plate the rest of the column so
  // P6 ends level with the footnote (design §4 p3).
  const after = columnTwoHeight(ctx);
  const plateTop = top + 9;
  const plateH = Math.max(110, Math.min(220, plateTop - footBase - after));
  const figure = w.elem('Figure', w.sect, c.alt);
  w.figure(figure, ...lensPlate(w, COL2, plateTop - plateH, COL_W, plateH));
  const caption = w.elem('Caption');
  let y2 = w.paragraph([{ text: c.caption, style: STYLE.caption }], {
    x: COL2,
    y: plateTop - plateH - 14,
    width: COL_W,
    leading: 10,
    parent: caption,
  }).next;
  y2 -= 10;
  const p5 = w.paragraph([{ text: c.p5, style: STYLE.body }], {
    x: COL2,
    y: y2,
    width: COL_W,
    leading: LEADING,
    align: 'justify',
    maxStretch: MAX_STRETCH,
  });
  counts.p5 = p5.lines.length;
  maxStretch = Math.max(maxStretch, p5.maxStretch);
  const quoteTop = p5.next - LEADING - 4;
  const quote = w.elem('BlockQuote');
  const q = w.paragraph([{ text: c.quote, style: STYLE.quote }], {
    x: COL2 + 14,
    y: quoteTop,
    width: COL_W - 14,
    leading: 20,
    parent: quote,
  });
  counts.quote = q.lines.length;
  w.art(...hairline(COL2 + 1, quoteTop + 14, COL2 + 1, q.last - 6, LIME_800, 2));
  const p6 = w.paragraph([{ text: c.p6, style: STYLE.body }], {
    x: COL2,
    y: q.next - LEADING + 6,
    width: COL_W,
    leading: LEADING,
    align: 'justify',
    maxStretch: MAX_STRETCH,
  });
  counts.p6 = p6.lines.length;
  maxStretch = Math.max(maxStretch, p6.maxStretch);
  if (p6.last < footBase - 0.01)
    throw new Error(`feature: P6 ends at ${r2(p6.last)}, below the footnote at ${footBase}`);

  trySlip(ctx, cut(c.tryLine, ctx.edition));
  return { paragraphs: counts, maxStretch };
}

/** Height from the plate's bottom to P6's last baseline (caption, P5, quote, P6). */
function columnTwoHeight(ctx: PageCtx): number {
  const { w, copy } = ctx;
  const c = copy.feature;
  const lines = (text: string, style: Style, width: number, justify = false) =>
    w.breakLines(w.words([{ text, style }]), width, 0, justify).length;
  const caption = lines(c.caption, STYLE.caption, COL_W);
  const p5 = lines(c.p5, STYLE.body, COL_W, true);
  const quote = lines(c.quote, STYLE.quote, COL_W - 14);
  const p6 = lines(c.p6, STYLE.body, COL_W, true);
  // Mirrors the drawing below: caption, 10, P5, a line and 4 above the quote, the quote,
  // a line less 6 above P6, P6 down to its last baseline.
  return (
    14 +
    caption * 10 +
    10 +
    p5 * LEADING +
    LEADING +
    4 +
    quote * 20 +
    LEADING -
    6 +
    (p6 - 1) * LEADING
  );
}

/**
 * The lens plate: a vector duotone of a first-order Fresnel lens seen from the front,
 * graphite on darker graphite: a soft glow behind the glass, the bull's-eye's rings inside the
 * lens's barrel, the brass cage's bars, and one lime flame (the only lime on the page's art).
 */
export function lensPlate(w: Writer, x: number, y: number, pw: number, ph: number) {
  const cx = x + pw * 0.5;
  const cy = y + ph * 0.5;
  const R = Math.max(pw, ph) * 0.62;
  w.resource(
    'Shading',
    'ShLens',
    w.doc.context.obj({
      ShadingType: 3,
      ColorSpace: 'DeviceRGB',
      Coords: [r2(cx), r2(cy), 0, r2(cx), r2(cy), r2(R)],
      Function: {
        FunctionType: 2,
        Domain: [0, 1],
        C0: [0.36, 0.37, 0.39],
        C1: [0.07, 0.075, 0.085],
        N: 1.2,
      },
      Extend: [true, true],
    }),
  );
  w.resource('ExtGState', 'GsGlow', w.doc.context.obj({ ca: 0.22 }));
  // The lens's barrel: a tall rounded body the rings are cut to.
  const lw = pw * 0.6;
  const lh = ph * 0.92;
  const lx = cx - lw / 2;
  const ly = cy - lh / 2;
  const ops = [
    rectangle(r2(x), r2(y), r2(pw), r2(ph)),
    clip(),
    endPath(),
    raw('/ShLens sh'),
    pushGraphicsState(),
    ...roundedPath(lx, ly, lw, lh, lw * 0.18),
    clip(),
    endPath(),
    ...rect(lx, ly, lw, lh, N8),
  ];
  for (let r = 6, i = 0; r < lh * 0.75; r += 4.2 + i * 0.32, i++) {
    ops.push(
      setStrokingRgbColor(...(i % 4 === 0 ? N4 : i % 2 === 0 ? N6 : N7)),
      setLineWidth(i % 4 === 0 ? 1.4 : 0.7),
      ...circlePath(cx, cy, r),
      stroke(),
    );
  }
  // The cage: vertical bars and the belt bars across the barrel.
  for (const k of [-1, 0, 1])
    ops.push(...hairline(cx + k * lw * 0.34, ly, cx + k * lw * 0.34, ly + lh, N5, 1.1));
  for (const k of [-0.32, 0.32])
    ops.push(...hairline(lx, cy + k * lh, lx + lw, cy + k * lh, N5, 1.1));
  ops.push(popGraphicsState());
  // The barrel's rim, then the flame and its glow.
  ops.push(
    setStrokingRgbColor(...N5),
    setLineWidth(1.2),
    ...roundedPath(lx, ly, lw, lh, lw * 0.18),
    stroke(),
    pushGraphicsState(),
    raw('/GsGlow gs'),
    ...disc(cx, cy, 16, LIME),
    ...disc(cx, cy, 10, LIME),
    popGraphicsState(),
    ...disc(cx, cy, 5, LIME),
    ...disc(cx, cy, 2, [1, 1, 0.86]),
  );
  return ops;
}
