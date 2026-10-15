/**
 * Page 4, roll three (design.md §4 page 4): the markup page. A photographer's contact sheet is
 * the one document whose purpose is to be circled and scribbled on: three strips of 35 mm film,
 * four frames each, sprocket holes and edge numbers, every frame a small vector photograph in
 * graphite with at most one lime element (the light). Free paper under the strips for notes.
 *
 * v2 (MOB-14; direction-v2.md §8 page 4), 23:30: the frames are night photographs (graded
 * low-key, their light sources glowing in the hour's light), the film base carries grain, and
 * the edge printing is exposed in that light.
 */
import type { PDFOperator } from '@cantoo/pdf-lib';
import {
  closePath,
  endPath,
  clip,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  appendBezierCurve,
  setFillingRgbColor,
  fill,
  setDashPattern,
  setLineCap,
} from '@cantoo/pdf-lib';
import { type PageCtx, furniture, kicker, trySlip } from '../context.ts';
import { cut } from '../copy.ts';
import {
  LEFT,
  LIME,
  MEASURE,
  MUTED,
  N3,
  N4,
  N5,
  N6,
  N7,
  N8,
  N9,
  PT,
  RIGHT,
  RULE,
  type Rgb,
  STYLE,
  type Style,
  caps,
  circlePath,
  disc,
  hairline,
  poly,
  r2,
  rect,
  ring,
  roundRect,
  raw,
} from '../kit.ts';
import { grain, gs, hex, lightAt, mix, radialShading, scale } from '../light.ts';

const FILM: Rgb = [0.09, 0.098, 0.118];
const PAD = 7;
const GAP = 7;
const EDGE = 17;
const FRAME_W = (MEASURE - 2 * PAD - 3 * GAP) / 4;
const FRAME_H = FRAME_W * (2 / 3);
const STRIP_H = FRAME_H + 2 * EDGE;
const ROW_GAP = 30;

export function contactPage(ctx: PageCtx): void {
  const { w, copy } = ctx;
  const light = lightAt('contact');
  radialShading(w, 'ShCt', 0, 0, 1, [
    [0, mix(light, [1, 1, 1], 0.5)],
    [0.15, scale(light, 0.85)],
    [0.45, scale(light, 0.22)],
    [1, [0, 0, 0]],
  ]);
  gs(w, 'GsScr', { BM: 'Screen' });
  const c = copy.contact;
  furniture(ctx, c.section);
  kicker(ctx, 764, c.kicker);
  w.text(w.elem('H1'), STYLE.h1, LEFT, 728, c.title);
  w.paragraph([{ text: c.intro, style: STYLE.letter }], {
    x: LEFT,
    y: 698,
    width: 330,
    leading: 16.5,
    pretty: true,
  });

  const figure = w.elem('Figure', w.sect, c.alt);
  const ops: PDFOperator[] = [];
  const top = 646;
  for (let row = 0; row < 3; row++) {
    const y = top - STRIP_H - row * (STRIP_H + ROW_GAP);
    ops.push(...strip(y));
    for (let k = 0; k < 4; k++) {
      const fx = LEFT + PAD + k * (FRAME_W + GAP);
      const fy = y + EDGE;
      ops.push(
        pushGraphicsState(),
        rectangle(r2(fx), r2(fy), r2(FRAME_W), r2(FRAME_H)),
        clip(),
        endPath(),
        ...graded((FRAMES[row * 4 + k] as Frame)(fx, fy, FRAME_W, FRAME_H)),
        ...frameLights(row * 4 + k, fx, fy, FRAME_W, FRAME_H),
        popGraphicsState(),
      );
    }
  }
  // Film grain over the strips, clipped to them (grain lives in the dark, direction-v2.md §4).
  const strips = [0, 1, 2].map((row) => top - STRIP_H - row * (STRIP_H + ROW_GAP));
  ops.push(
    pushGraphicsState(),
    ...strips.flatMap((y) => [rectangle(LEFT, r2(y), MEASURE, r2(STRIP_H))]),
    clip(),
    endPath(),
    ...grain(w, 0.24, [LEFT, strips[2] as number, MEASURE, top - (strips[2] as number)]),
    popGraphicsState(),
  );
  w.figure(figure, ...ops);
  // Edge printing: the roll on the first strip, frame numbers under each frame.
  for (let row = 0; row < 3; row++) {
    const y = top - STRIP_H - row * (STRIP_H + ROW_GAP);
    const edge: Style = {
      face: 'bold',
      size: PT.edge,
      color: scale(lightAt('contact'), 0.78),
      tracking: caps(PT.edge),
    };
    for (let k = 0; k < 4; k++) {
      const fx = LEFT + PAD + k * (FRAME_W + GAP);
      const code = `3/${String(row * 4 + k + 1).padStart(2, '0')}`;
      w.text(null, { face: 'sans', size: PT.small, color: MUTED }, fx, y - 11, code);
      w.text(null, edge, fx + FRAME_W / 2, y + 8.6, `${row * 4 + k + 1}A`, 'center');
    }
    w.text(null, edge, LEFT + PAD + 2, y + STRIP_H - 12.6, c.roll);
  }
  const bottom = top - 3 * STRIP_H - 2 * ROW_GAP;
  w.text(
    w.elem('P'),
    { face: 'sans', size: PT.body, color: MUTED },
    RIGHT,
    bottom - 34,
    c.instruction,
    'right',
  );
  // Ruled space for notes, as the letter's margin is: the page invites the pen and a note.
  const notesTop = bottom - 70;
  w.text(w.elem('P'), STYLE.label, LEFT, notesTop, c.notes.toLocaleUpperCase(copy.lang));
  for (let ly = notesTop - 24; ly >= 116; ly -= 24)
    w.art(setDashPattern([0.1, 3], 0), setLineCap(1), ...hairline(LEFT, ly, RIGHT, ly, RULE, 0.9));
  trySlip(ctx, cut(c.tryLine, ctx.edition));
}

/**
 * The night grade (direction-v2.md §3.1, §8 page 4): every colour a frame sets is multiplied
 * by the blue-graphite `#666B78` here, in the generator, which pulls the frame down to low key
 * without a Multiply group per frame in the renderer (§5.4).
 */
const GRADE = hex('#666B78');
const r3 = (v: number) => Math.round(v * 1000) / 1000;
function graded(ops: PDFOperator[]): PDFOperator[] {
  return ops.map((op) => {
    const m = /^(\S+) (\S+) (\S+) (rg|RG)$/.exec(op.toString());
    if (!m) return op;
    const rgb = [m[1], m[2], m[3]].map((v, i) => r3(Number(v) * (GRADE[i] as number)));
    return raw(`${rgb.join(' ')} ${m[4]}`);
  });
}

/**
 * The graded frames' light sources, put back as screened glows in the hour's light (one unit
 * radial shading, placed by `cm`, clipped to the frame), so lime reads as light.
 */
const LIGHTS: Record<number, readonly (readonly [number, number, number, number, number])[]> = {
  // frame: [x, y (fractions of the frame), rx, ry (fractions of w), strength]
  0: [[0.5, 0.5, 0.42, 0.42, 1]],
  3: [[0.5, 0.25, 0.34, 0.16, 1]],
  5: [[0.5, 0.55, 0.5, 0.5, 0.85]],
  6: [[0.7 - 8 / 112, 0.75 - 8 / 75, 0.14, 0.14, 0.8]],
  8: [
    [0.86, 0.56, 0.2, 0.2, 1],
    [0.4, 0.67, 0.6, 0.05, 0.7],
  ],
  10: [[0.36 + 8 / 112, 0.55, 0.12, 0.42, 0.9]],
};
function frameLights(i: number, x: number, y: number, w: number, h: number): PDFOperator[] {
  const ops: PDFOperator[] = [];
  for (const [fx, fy, rx, ry, k] of LIGHTS[i] ?? []) {
    ops.push(
      raw(
        `q /GsScr gs ${r2(rx * w * k)} 0 0 ${r2(ry * w * k)} ${r2(x + fx * w)} ${r2(y + fy * h)} cm /ShCt sh Q`,
      ),
    );
  }
  return ops;
}

/** A strip of film: the base, sprocket holes along both edges (one fill for all of them). */
function strip(y: number): PDFOperator[] {
  const ops = [...rect(LEFT, y, MEASURE, STRIP_H, FILM), setFillingRgbColor(1, 1, 1)];
  const holeW = 3.4;
  const holeH = 4.2;
  for (let x = LEFT + 5; x < RIGHT - holeW - 3; x += 9.4) {
    ops.push(rectangle(r2(x), r2(y + 2.2), holeW, holeH));
    ops.push(rectangle(r2(x), r2(y + STRIP_H - 2.2 - holeH), holeW, holeH));
  }
  ops.push(fill());
  return ops;
}

type Frame = (x: number, y: number, w: number, h: number) => PDFOperator[];

const curve = (a: number, b: number, c: number, d: number, e: number, f: number) =>
  appendBezierCurve(r2(a), r2(b), r2(c), r2(d), r2(e), r2(f));

/** The twelve frames of roll three (design §4 page 4). */
const FRAMES: Frame[] = [
  // 1 The lens: rings around a flame.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N9)];
    for (let r = 4, i = 0; r < w * 0.7; r += 3.2 + i * 0.25, i++)
      ops.push(
        ...ring(x + w * 0.5, y + h * 0.5, r, i % 3 === 0 ? N5 : N7, i % 3 === 0 ? 0.9 : 0.5),
      );
    ops.push(...disc(x + w * 0.5, y + h * 0.5, 3.2, LIME));
    return ops;
  },
  // 2 The spiral stair from below: steps as wedges around the well.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N7)];
    const cx = x + w * 0.52;
    const cy = y + h * 0.5;
    for (let i = 0; i < 16; i++) {
      const a0 = (i / 16) * Math.PI * 2;
      const a1 = a0 + Math.PI / 16;
      const r0 = 8 + i * 0.9;
      const r1 = w * 0.75;
      ops.push(
        ...poly(
          [
            [cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0],
            [cx + Math.cos(a0) * r1, cy + Math.sin(a0) * r1],
            [cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1],
            [cx + Math.cos(a1) * r0, cy + Math.sin(a1) * r0],
          ],
          i % 2 ? N8 : N6,
        ),
      );
    }
    ops.push(...disc(cx, cy, 7, N3), ...disc(cx, cy, 3.5, [0.97, 0.97, 0.95]));
    return ops;
  },
  // 3 The logbook, open: two pages of ruled lines.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N8)];
    const bx = x + w * 0.12;
    const by = y + h * 0.16;
    const bw = w * 0.76;
    const bh = h * 0.7;
    ops.push(
      ...poly(
        [
          [bx, by],
          [bx + bw / 2, by - 2],
          [bx + bw / 2, by + bh - 2],
          [bx, by + bh],
        ],
        N3,
      ),
    );
    ops.push(
      ...poly(
        [
          [bx + bw / 2, by - 2],
          [bx + bw, by],
          [bx + bw, by + bh],
          [bx + bw / 2, by + bh - 2],
        ],
        [0.86, 0.86, 0.84],
      ),
    );
    for (let i = 1; i < 9; i++) {
      const ly = by + bh - i * (bh / 9.5);
      ops.push(...hairline(bx + 5, ly, bx + bw / 2 - 5, ly - 0.5, N5, 0.6));
      if (i < 6)
        ops.push(...hairline(bx + bw / 2 + 5, ly - 0.5, bx + bw - 5 - (i % 2) * 12, ly, N5, 0.6));
    }
    return ops;
  },
  // 4 A kettle on the stove, a lime gas flame under it.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N7), ...rect(x, y, w, h * 0.3, N8)];
    const cx = x + w * 0.5;
    const by = y + h * 0.34;
    ops.push(
      setFillingRgbColor(...N4),
      moveTo(r2(cx - 22), r2(by)),
      curve(cx - 26, by + 26, cx + 26, by + 26, cx + 22, by),
      closePath(),
      fill(),
      ...poly(
        [
          [cx + 18, by + 10],
          [cx + 34, by + 22],
          [cx + 33, by + 25],
          [cx + 15, by + 15],
        ],
        N4,
      ),
      setStrokingRgbColor(...N3),
      setLineWidth(2),
      moveTo(r2(cx - 12), r2(by + 19)),
      curve(cx - 10, by + 34, cx + 10, by + 34, cx + 12, by + 19),
      stroke(),
      ...rect(cx - 30, by - 4, 60, 3, N9),
    );
    for (let k = -3; k <= 3; k++)
      ops.push(
        ...poly(
          [
            [cx + k * 6 - 2, by - 4],
            [cx + k * 6, by - 11],
            [cx + k * 6 + 2, by - 4],
          ],
          LIME,
        ),
      );
    return ops;
  },
  // 5 The window and the sea.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N8)];
    const wx = x + w * 0.22;
    const wy = y + h * 0.14;
    const ww = w * 0.56;
    const wh = h * 0.74;
    ops.push(...rect(wx, wy, ww, wh, N4), ...rect(wx, wy, ww, wh * 0.42, N6));
    for (let i = 1; i < 6; i++) ops.push(...hairline(wx, wy + i * 5, wx + ww, wy + i * 5, N5, 0.5));
    ops.push(...rect(wx + ww / 2 - 1.5, wy, 3, wh, N8), ...rect(wx, wy + wh * 0.55, ww, 3, N8));
    return ops;
  },
  // 6 The lamp, lit.
  (x, y, w, h) => {
    const cx = x + w * 0.5;
    const cy = y + h * 0.55;
    const ops = [...rect(x, y, w, h, N9)];
    ops.push(...disc(cx, cy, 26, [0.2, 0.24, 0.12]), ...disc(cx, cy, 16, [0.38, 0.47, 0.16]));
    ops.push(...disc(cx, cy, 9, LIME));
    ops.push(
      ...rect(cx - 14, y + h * 0.12, 28, 6, N6),
      ...rect(cx - 3, y + h * 0.12, 6, h * 0.3, N6),
    );
    return ops;
  },
  // 7 The grey box on the wall, a lime LED.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N6)];
    for (let i = 0; i < 6; i++)
      ops.push(...hairline(x, y + 8 + i * 12, x + w, y + 8 + i * 12, N5, 0.5));
    const bx = x + w * 0.3;
    const by = y + h * 0.25;
    ops.push(
      ...roundRect(bx + 2, by - 2, w * 0.4, h * 0.5, 3, N7),
      ...roundRect(bx, by, w * 0.4, h * 0.5, 3, N4),
    );
    ops.push(...hairline(bx + 6, by + 8, bx + w * 0.4 - 6, by + 8, N5, 0.8));
    ops.push(...disc(bx + w * 0.4 - 8, by + h * 0.5 - 8, 2.2, LIME));
    return ops;
  },
  // 8 The keeper's coat on its hook by the door.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N5)];
    for (let i = 0; i < 9; i++) ops.push(...rect(x + i * 13, y, 1, h, N6));
    const cx = x + w * 0.46;
    const top = y + h * 0.8;
    ops.push(...disc(cx, top + 4, 2.4, N8));
    ops.push(
      ...poly(
        [
          [cx - 4, top],
          [cx + 4, top],
          [cx + 15, top - 8],
          [cx + 19, y + h * 0.1],
          [cx - 19, y + h * 0.1],
          [cx - 15, top - 8],
        ],
        N8,
      ),
      ...hairline(cx, top - 2, cx, y + h * 0.12, N7, 0.8),
      ...poly(
        [
          [cx - 4, top],
          [cx, top - 14],
          [cx + 4, top],
        ],
        N6,
      ),
    );
    return ops;
  },
  // 9 The beam over the water.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N9)];
    for (let i = 0; i < 9; i++) {
      const ly = y + h * 0.42 - i ** 1.4 * 2.4;
      ops.push(...hairline(x, ly, x + w, ly, N7, 0.6));
    }
    ops.push(
      ...poly(
        [
          [x + w * 0.86, y + h * 0.56],
          [x - 4, y + h * 0.78],
          [x - 4, y + h * 0.6],
        ],
        LIME,
      ),
    );
    ops.push(...rect(x + w * 0.84, y + h * 0.42, 4, h * 0.14, N4));
    return ops;
  },
  // 10 Pusula's bowl on the floorboards.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N6)];
    for (let i = 0; i < 5; i++)
      ops.push(...hairline(x, y + i * 16 + 4, x + w, y + i * 16 + 10, N7, 0.8));
    const cx = x + w * 0.5;
    const cy = y + h * 0.42;
    ops.push(
      setFillingRgbColor(...N8),
      moveTo(r2(cx - 24), r2(cy)),
      curve(cx - 20, cy - 14, cx + 20, cy - 14, cx + 24, cy),
      closePath(),
      fill(),
      setFillingRgbColor(...N4),
      ...circlePath(cx, cy, 1),
    );
    ops.push(...ellipse(cx, cy, 24, 6, N3), ...ellipse(cx, cy, 19, 4, N7));
    return ops;
  },
  // 11 The door at dusk, light from inside.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N7), ...rect(x, y, w, h * 0.22, N8)];
    const dx = x + w * 0.36;
    const dy = y + h * 0.22;
    ops.push(...rect(dx, dy, w * 0.3, h * 0.66, N9));
    ops.push(
      ...poly(
        [
          [dx + 4, dy],
          [dx + 12, dy],
          [dx + 12, dy + h * 0.66],
          [dx + 4, dy + h * 0.66],
        ],
        LIME,
      ),
    );
    ops.push(
      ...poly(
        [
          [dx + 4, dy],
          [dx + 12, dy],
          [dx + 40, y],
          [dx - 10, y],
        ],
        [0.42, 0.5, 0.2],
      ),
    );
    return ops;
  },
  // 12 The empty stair.
  (x, y, w, h) => {
    const ops = [...rect(x, y, w, h, N4)];
    const steps: [number, number][] = [[x, y]];
    for (let i = 0; i < 8; i++) {
      const sx = x + i * (w / 8);
      const sy = y + (i + 1) * (h / 9);
      steps.push([sx, sy], [sx + w / 8, sy]);
    }
    steps.push([x + w, y]);
    ops.push(...poly(steps, N7));
    for (let i = 0; i < 8; i++) {
      const sx = x + i * (w / 8);
      const sy = y + (i + 1) * (h / 9);
      ops.push(...hairline(sx, sy, sx + w / 8, sy, N3, 0.8));
    }
    ops.push(...hairline(x + w * 0.1, y + h * 0.4, x + w * 0.9, y + h * 0.98, N8, 1.4));
    return ops;
  },
];

function ellipse(cx: number, cy: number, rx: number, ry: number, color: Rgb): PDFOperator[] {
  const kx = rx * 0.5523;
  const ky = ry * 0.5523;
  return [
    setFillingRgbColor(...color),
    moveTo(r2(cx + rx), r2(cy)),
    curve(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry),
    curve(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy),
    curve(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry),
    curve(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy),
    closePath(),
    fill(),
  ];
}
