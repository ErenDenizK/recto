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
import { type PageCtx, furniture, kicker, slipTop as slipTopOf, trySlip } from '../context.ts';
import { cut } from '../copy.ts';
import {
  COL2,
  COL_W,
  INK,
  LEFT,
  LIME_800,
  MEASURE,
  MUTED,
  PALE,
  PT,
  RULE,
  STYLE,
  type Style,
  disc,
  hairline,
  r2,
  rect,
  raw,
  rich,
  roundRect,
  roundedPath,
  type Rgb,
  type Writer,
} from '../kit.ts';
import {
  type Stop,
  Strokes,
  arc1,
  circle1,
  gs,
  grain,
  hex,
  lightAt,
  mix,
  radialShading,
  sample,
  scale,
} from '../light.ts';

/** Body 9.5 / 13.5 (design §2): leading under 1.5 × size, so lines join even untagged. */
const LEADING = 13.5;
const INDENT = 9.5;
/** No line stretches its gaps past 1.5 × the natural space (design §4 p3 rule 4, TXT-15). */
const MAX_STRETCH = 1.5;
/** Free body lines under P4 before the footnote's rule (the reflow room, R-8). */
const FREE_LINES = 3;

const BYLINE: Style = { face: 'sans', size: PT.small, color: MUTED };
const BYLINE_NAME: Style = { face: 'bold', size: PT.small, color: INK };

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
    pretty: true,
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
  const slipTop = slipTopOf(ctx, cut(c.tryLine, ctx.edition));
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
  const logStyle: Style = { face: 'sans', size: PT.small, color: INK };
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
  if (entries === 0) throw new Error(`feature (${ctx.file}): no room for the logbook aside`);
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
 * The lens plate (MOB-14; direction-v2.md §8 page 3): a night photograph of the first-order lens, front on.
 * The flame, magnified by the bull's-eye, fills the centre panel with light; the rings
 * catch it (screened strokes, brighter towards the centre); the brass cage stands dark in
 * front of the glow; halation spills past the barrel; grain over all. The light is the
 * frame's own hour (21:15, between lemon and lime).
 */
export function lensPlate(w: Writer, x: number, y: number, pw: number, ph: number) {
  const cx = x + pw * 0.5;
  const cy = y + ph * 0.52;
  const light = lightAt('feature');
  const white: Rgb = [1, 1, 1];
  radialShading(w, 'ShPlate', cx, cy, Math.max(pw, ph) * 0.75, [
    [0, hex('#1C2126')],
    [0.45, hex('#0E1013')],
    [1, hex('#060708')],
  ]);
  const lw = Math.min(pw * 0.56, ph * 0.74);
  const lh = ph * 0.9;
  const lx = cx - lw / 2;
  const ly = y + (ph - lh) / 2;
  const R = lw * 0.5;
  // The centre panel glows: the flame seen through the bull's-eye.
  // Composited here, painted Normal (no offscreen group per object in the renderer): the
  // eye's light screened onto the barrel's glass, then each ring's light onto the eye's.
  const BARREL = hex('#0B0D10');
  const screen = (a: Rgb, b: Rgb) =>
    a.map((v, j) => 1 - (1 - v) * (1 - (b[j] as number))) as unknown as Rgb;
  const EYE: readonly Stop[] = [
    [0, mix(light, white, 0.9)],
    [0.1, mix(light, white, 0.45)],
    [0.34, scale(light, 0.7)],
    [0.62, scale(light, 0.14)],
    [1, [0, 0, 0]],
  ];
  const eyeR = R * 0.95;
  const eyeAt = (r: number) => screen(BARREL, sample(EYE, Math.min(1, r / eyeR)));
  radialShading(
    w,
    'ShEye',
    0,
    0,
    1,
    EYE.map(([t, c]) => [t, screen(BARREL, c)] as const),
    [true, true],
  );
  radialShading(w, 'ShHalo', 0, 0, 1, [
    [0, scale(light, 0.5)],
    [0.3, scale(light, 0.16)],
    [0.7, scale(light, 0.04)],
    [1, [0, 0, 0]],
  ]);
  gs(w, 'GsScr', { BM: 'Screen' });
  const ops = [
    rectangle(r2(x), r2(y), r2(pw), r2(ph)),
    clip(),
    endPath(),
    raw('/ShPlate sh'),
    // The barrel, dark glass.
    ...roundRect(lx, ly, lw, lh, lw * 0.16, hex('#0B0D10')),
    pushGraphicsState(),
    ...roundedPath(lx, ly, lw, lh, lw * 0.16),
    clip(),
    endPath(),
    raw(`q ${r2(eyeR)} 0 0 ${r2(eyeR)} ${r2(cx)} ${r2(cy)} cm /ShEye sh Q`),
  ];
  // The bull's-eye's dioptric rings, then the prism rings beyond it (screened strokes):
  // each ring is lit by its distance from the flame, and the prisms flash at top and bottom.
  const R0 = lw * 0.31;
  const rings = new Strokes();
  const ring = (r: number, k: number, width: number, tint: number) =>
    rings.path(
      circle1(cx, cy, r),
      screen(eyeAt(r), mix(scale(light, k), scale(hex('#C7D0D9'), k), tint)),
      width,
      32,
    );
  for (let i = 1; i <= 6; i++)
    ring(R0 * Math.sqrt(i / 6), 0.55 - i * 0.05, i === 6 ? 1.1 : 0.6, 0.1);
  for (let i = 1, r = R0 + 3; r < lh * 0.62; i++, r += 2.8 + i * 0.25) {
    const t = (r - R0) / (lh * 0.62 - R0);
    ring(r, 0.2 * (1 - t) + 0.05, 0.5, 0.65);
    // The flash: a short bright arc where the prism turns the flame towards the camera.
    const span = (30 - 18 * t) * (0.8 + 0.4 * Math.abs(Math.sin(i * 2.3)));
    const glint = 0.15 + 0.85 * Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.05)) ** 0.8;
    for (const mid of [90, 270])
      rings.path(
        arc1(cx, cy, r, mid - span / 2, mid + span / 2),
        screen(eyeAt(r), scale(mix(light, white, 0.35), glint * 0.8)),
        0.8,
        16,
      );
  }
  ops.push(...rings.ops());
  // The cage: brass bars in front of the glow (silhouettes), with a lit edge. They stand at the
  // panel's seams, clear of the bull's-eye (B1), so no bar crosses the flame.
  for (const k of [-1, 1]) {
    const bx = cx + k * lw * 0.34;
    ops.push(...rect(bx - 1.1, ly, 2.2, lh, hex('#07080A')));
    ops.push(...hairline(bx - 1.1, ly, bx - 1.1, ly + lh, scale(light, 0.22), 0.35));
  }
  for (const k of [-0.33, 0.33]) {
    const by = cy + k * lh;
    ops.push(...rect(lx, by - 1.1, lw, 2.2, hex('#07080A')));
    ops.push(...hairline(lx, by + 1.1, lx + lw, by + 1.1, scale(light, 0.22), 0.35));
  }
  ops.push(popGraphicsState());
  ops.push(
    setStrokingRgbColor(...hex('#2A2F36')),
    setLineWidth(0.8),
    ...roundedPath(lx, ly, lw, lh, lw * 0.16),
    stroke(),
    // Halation past the barrel, then the streak and the flame's core.
    raw(
      `q ${r2(x)} ${r2(y)} ${r2(pw)} ${r2(ph)} re W n /GsScr gs ${r2(lw * 1.1)} 0 0 ${r2(lw * 1.1)} ${r2(cx)} ${r2(cy)} cm /ShHalo sh Q`,
    ),
    raw(
      `q ${r2(x)} ${r2(cy - 2)} ${r2(pw)} 4 re W n /GsScr gs ${r2(pw * 0.62)} 0 0 1.6 ${r2(cx)} ${r2(cy)} cm /ShHalo sh Q`,
    ),
    ...disc(cx, cy, 2.4, mix(light, white, 0.9)),
    ...grain(w, 0.32, [x, y, pw, ph]),
  );
  return ops;
}
