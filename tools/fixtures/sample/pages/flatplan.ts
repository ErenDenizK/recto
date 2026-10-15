/**
 * The flatplan (design.md §4 page 8, and the phone cut's page 6): every page of this cut as a
 * miniature drawn from the pages' own layout (the cover dark, the scan grey), the editor's
 * note "swap 4 and 5?" (a real reorder to try), then how changes are kept and saved. The full
 * cut points to the Pages grid and ⌘K's commands; the phone cut to the overview's pinch,
 * press and hold, Select, Add and Share (MOB-2, MOB-3, MOB-9) and its own tiles are larger.
 */
import type { PDFOperator } from '@cantoo/pdf-lib';
import { setLineWidth, setStrokingRgbColor, stroke, rectangle } from '@cantoo/pdf-lib';
import { type PageCtx, furniture, kicker, trySlip } from '../context.ts';
import { cut } from '../copy.ts';
import {
  BODY,
  COL2,
  COVER,
  COVER_SEA,
  COVER_TEXT,
  INK,
  LEFT,
  LIME,
  LIME_800,
  MEASURE,
  MUTED,
  N4,
  N8,
  PAGE_H,
  PAGE_W,
  PALE,
  RIGHT,
  RULE,
  type Rgb,
  STYLE,
  type Style,
  WHITE,
  hairline,
  poly,
  r2,
  rect,
  rich,
  roundRect,
} from '../kit.ts';

const TEXT: Rgb = [0.78, 0.8, 0.83];
const HEAD: Rgb = [0.36, 0.38, 0.42];

export function flatplanPage(ctx: PageCtx): void {
  const { w, copy, edition } = ctx;
  const c = copy.flatplan;
  furniture(ctx, c.section);
  kicker(ctx, 764, c.kicker);
  w.text(w.elem('H1'), STYLE.h1, LEFT, 728, cut(c.title, edition));

  const phone = edition === 'phone';
  const cols = phone ? 3 : 4;
  const tileW = phone ? 104 : 106;
  const tileH = tileW * (PAGE_H / PAGE_W);
  const gap = (MEASURE - cols * tileW) / (cols - 1);
  const rowGap = phone ? 26 : 28;
  const top = 690;
  const figure = w.elem('Figure', w.sect, cut(c.alt, edition));
  const ops: PDFOperator[] = [];
  ctx.ids.forEach((id, i) => {
    const x = LEFT + (i % cols) * (tileW + gap);
    const y = top - tileH - Math.floor(i / cols) * (tileH + rowGap);
    ops.push(...miniature(id, x, y, tileW, tileH));
  });
  w.figure(figure, ...ops);
  ctx.ids.forEach((id, i) => {
    const x = LEFT + (i % cols) * (tileW + gap);
    const y = top - tileH - Math.floor(i / cols) * (tileH + rowGap);
    w.text(null, { face: 'bold', size: 8, color: LIME_800 }, x, y - 13, String(i + 1));
    w.text(null, { face: 'sans', size: 8, color: MUTED }, x + 12, y - 13, c.labels[id] ?? id);
  });
  const rows = Math.ceil(ctx.ids.length / cols);
  let y = top - rows * (tileH + rowGap) - 4;

  // The editor's note.
  const noteStyle: Style = { face: 'sans', size: 9.5, color: INK };
  const noteBold: Style = { face: 'bold', size: 9.5, color: INK };
  w.art(...roundRect(LEFT, y - 30, MEASURE, 32, 6, PALE));
  w.paragraph(rich(`**${c.noteName}** ${cut(c.note, edition)}`, noteStyle, noteBold), {
    x: LEFT + 14,
    y: y - 18,
    width: MEASURE - 28,
    leading: 12,
  });
  y -= 64;

  // Kept, then saved (and, on the phone, the overview's acts).
  const lineStyle: Style = { face: 'sans', size: phone ? 10 : 10.5, color: BODY };
  if (!phone) {
    w.text(w.elem('H2'), { face: 'bold', size: 13, color: INK }, LEFT, y, c.keptTitle);
    y -= 22;
  }
  for (const line of cut(c.lines, edition)) {
    y =
      w.paragraph([{ text: line, style: lineStyle }], {
        x: LEFT,
        y,
        width: MEASURE,
        leading: phone ? 14 : 15,
      }).next - (phone ? 5 : 4);
  }
  w.art(...hairline(LEFT, y - 6, RIGHT, y - 6, RULE));
  w.text(w.elem('P'), { face: 'sans', size: 9.5, color: MUTED }, LEFT, y - 24, c.end);
  if (y - 24 < 104)
    throw new Error(`flatplan (${edition}): the text runs into the slip (${r2(y - 24)})`);

  trySlip(ctx, cut(c.tryLine, edition));
}

/** A page of the sample drawn small from its own layout, at (x, y) bottom left. */
export function miniature(id: string, x: number, y: number, w: number, h: number): PDFOperator[] {
  const s = w / PAGE_W;
  const bar = (bx: number, by: number, bw: number, bh: number, color: Rgb) =>
    rect(x + bx * s, y + by * s, bw * s, bh * s, color);
  const lines = (
    bx: number,
    top: number,
    width: number,
    count: number,
    pitch: number,
    color = TEXT,
  ) => {
    const out: PDFOperator[] = [];
    for (let i = 0; i < count; i++)
      out.push(
        ...bar(bx, top - i * pitch, i === count - 1 ? width * 0.62 : width, pitch * 0.42, color),
      );
    return out;
  };
  const frame = (fill: Rgb) => [
    ...rect(x + 1.2, y - 1.6, w, h, [0.9, 0.91, 0.92]),
    ...rect(x, y, w, h, fill),
    setStrokingRgbColor(...RULE),
    setLineWidth(0.5),
    rectangle(r2(x), r2(y), r2(w), r2(h)),
    stroke(),
  ];
  const head = () => [...bar(LEFT, 803, 120, 6, RULE), ...bar(LEFT, 796, MEASURE, 1, RULE)];
  const slip = () => bar(LEFT, 50, MEASURE, 40, PALE);
  const h1 = (width: number, y1 = 722) => [
    ...bar(LEFT, 760, 90, 6, LIME_800),
    ...bar(LEFT, y1, width, 26, HEAD),
  ];
  switch (id) {
    case 'cover':
      return [
        ...frame(COVER),
        ...bar(LEFT, 664, 420, 76, COVER_TEXT),
        ...bar(LEFT, 632, 170, 8, LIME),
        ...poly(
          [
            [x + 452 * s, y + 372 * s],
            [x, y + 420 * s],
            [x, y + 360 * s],
          ],
          LIME,
        ),
        ...bar(445, 310, 14, 62, COVER_TEXT),
        ...Array.from({ length: 8 }, (_, i) => bar(0, 290 - i * 22, PAGE_W, 1.2, COVER_SEA)).flat(),
        ...[0, 1, 2].flatMap((i) => [
          ...bar(LEFT, 238 - i * 72, 18, 20, LIME),
          ...bar(LEFT + 36, 240 - i * 72, 200, 12, COVER_TEXT),
        ]),
      ];
    case 'letter':
      return [
        ...frame(WHITE),
        ...head(),
        ...h1(330),
        ...lines(LEFT, 680, 320, 12, 17.5),
        ...lines(400, 664, 140, 9, 20, RULE),
        ...bar(LEFT, 352, MEASURE, 1.5, INK),
        ...lines(LEFT + 30, 300, 180, 5, 40, HEAD),
        ...lines(COL2 + 30, 300, 180, 3, 40, HEAD),
        ...slip(),
      ];
    case 'feature':
      return [
        ...frame(WHITE),
        ...head(),
        ...h1(330, 692),
        ...bar(LEFT, 728, 280, 26, HEAD),
        ...lines(LEFT, 655, 420, 3, 19),
        ...lines(LEFT, 568, 233, 22, 13.5),
        ...bar(LEFT, 140, 233, 50, PALE),
        ...bar(COL2, 360, 233, 210, N8),
        ...bar(COL2 + 112, 460, 10, 10, LIME),
        ...lines(COL2, 330, 233, 5, 13.5),
        ...bar(COL2, 200, 3, 50, LIME_800),
        ...lines(COL2, 175, 233, 5, 13.5),
        ...slip(),
      ];
    case 'contact':
      return [
        ...frame(WHITE),
        ...head(),
        ...h1(380),
        ...[0, 1, 2].flatMap((r) => {
          const by = 650 - 105 - r * 129;
          return [
            ...bar(LEFT, by, MEASURE, 105, COVER),
            ...[0, 1, 2, 3].flatMap((k) =>
              bar(LEFT + 7 + k * 119, by + 17, 112, 71, k % 2 ? N4 : [0.3, 0.31, 0.34]),
            ),
          ];
        }),
        ...slip(),
      ];
    case 'agreement':
      return [
        ...frame(WHITE),
        ...head(),
        ...h1(400),
        ...lines(LEFT, 690, 420, 4, 15),
        ...bar(LEFT, 112, MEASURE, 470, PALE),
        ...bar(LEFT + 22, 500, 250, 26, WHITE),
        ...bar(LEFT + 292, 500, 150, 26, WHITE),
        ...bar(LEFT + 22, 428, 250, 26, WHITE),
        ...bar(LEFT + 22, 330, 14, 14, WHITE),
        ...bar(LEFT + 22, 298, 14, 14, WHITE),
        ...bar(LEFT + 22, 230, 14, 14, WHITE),
        ...bar(LEFT + 22, 150, 250, 1.5, INK),
        ...slip(),
      ];
    case 'scan':
      return [
        ...frame([0.925, 0.925, 0.925]),
        ...bar(52, 200, 420, 595, WHITE),
        ...lines(92, 740, 300, 18, 14, [0.6, 0.6, 0.6]),
        ...bar(LEFT, 50, MEASURE, 40, PALE),
      ];
    case 'invoice':
      return [
        ...frame(WHITE),
        ...head(),
        ...bar(LEFT, 724, 30, 30, N8),
        ...bar(LEFT + 42, 734, 160, 16, HEAD),
        ...bar(RIGHT_EDGE - 150, 734, 150, 13, HEAD),
        ...Array.from({ length: 5 }, (_, i) => [
          ...bar(LEFT, 610 - i * 24, 300, 7, TEXT),
          ...bar(RIGHT_EDGE - 60, 610 - i * 24, 60, 7, TEXT),
        ]).flat(),
        ...bar(RIGHT_EDGE - 180, 440, 180, 40, TEXT),
        ...bar(LEFT, 250, MEASURE, 140, PALE),
        ...slip(),
      ];
    default: {
      // The flatplan itself: its own tiles, four across (full) or three (phone).
      const phone = id === 'flatplan-phone';
      const cols = phone ? 3 : 4;
      const tw = phone ? 104 : 98;
      const th = tw * (PAGE_H / PAGE_W);
      const gx = (MEASURE - cols * tw) / (cols - 1);
      return [
        ...frame(WHITE),
        ...head(),
        ...h1(360),
        ...Array.from({ length: phone ? 6 : 8 }, (_, i) =>
          bar(
            LEFT + (i % cols) * (tw + gx),
            690 - th - Math.floor(i / cols) * (th + 28),
            tw,
            th,
            i === 0 ? COVER : PALE,
          ),
        ).flat(),
        ...lines(LEFT, phone ? 250 : 270, 440, phone ? 6 : 4, 16),
        ...slip(),
      ];
    }
  }
}

const RIGHT_EDGE = PAGE_W - 56;
