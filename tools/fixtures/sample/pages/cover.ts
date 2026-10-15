/**
 * Page 1, the cover (design.md §4 page 1): the one dark page, the links lesson. A lighthouse
 * on a headland throws the aurora (mint → lime → yellow-lime, the mark's gradient, DSN-5) as a
 * beam across a graphite sea; the masthead spans the measure; three cover lines, each one Link
 * over its whole block (≥ 70 pt tall, so ≥ 46 px at a phone's fit width), open their pages.
 */
import {
  clip,
  endPath,
  lineTo,
  moveTo,
  closePath,
  popGraphicsState,
  pushGraphicsState,
} from '@cantoo/pdf-lib';
import { type PageCtx, footer, link, trySlip } from '../context.ts';
import type { SampleCopy } from '../copy.ts';
import {
  AURORA_LIME,
  AURORA_YELLOW,
  COVER,
  COVER_MUTED,
  COVER_SEA,
  COVER_TEXT,
  LEFT,
  LIME,
  MEASURE,
  MINT,
  PAGE_H,
  PAGE_W,
  type Style,
  disc,
  hairline,
  poly,
  r2,
  raw,
  rect,
} from '../kit.ts';

const HORIZON = 300;
const LAMP: readonly [number, number] = [452, 372];

/** "Go to page 3: …" / "3. sayfaya git: …" (a link's /Contents and Alt). */
export function goTo(copy: SampleCopy, n: number, title: string): string {
  return copy.lang === 'tr'
    ? `${n}. ${copy.cover.linkPrefix}: ${title}`
    : `${copy.cover.linkPrefix} ${n}: ${title}`;
}

export function coverPage(ctx: PageCtx): void {
  const { w, copy } = ctx;
  const c = copy.cover;
  const up = (v: string) => v.toLocaleUpperCase(copy.lang);

  // The ground, the art (one Figure), then the type over it.
  w.art(...rect(0, 0, PAGE_W, PAGE_H, COVER));
  const figure = w.elem('Figure', w.sect, c.alt);
  w.figure(figure, ...art(ctx));

  w.text(
    w.elem('P'),
    { face: 'sans', size: 8, color: COVER_MUTED, tracking: 0.4 },
    LEFT,
    790,
    c.tagline,
  );
  // The masthead spans the measure (a logo, not an edit target: tracked tight).
  const probe: Style = { face: 'bold', size: 100, color: COVER_TEXT, tracking: -3 };
  const size = Math.min(150, (100 * (MEASURE + 4)) / w.width(probe, c.masthead));
  const masthead: Style = {
    face: 'bold',
    size: r2(size),
    color: COVER_TEXT,
    tracking: r2(-0.03 * size),
  };
  w.text(w.elem('H1'), masthead, LEFT - 3, 664, c.masthead);
  w.text(
    w.elem('P'),
    { face: 'bold', size: 10, color: LIME, tracking: 1.2 },
    LEFT,
    636,
    up(c.issue),
  );

  // Cover lines: number, title, dek; each block one link (design R-14).
  const list = w.elem('L');
  const pitch = 72;
  c.lines.forEach((line, i) => {
    const n = ctx.pageOf(line.page);
    if (n === undefined) throw new Error(`cover: no page ${line.page} in this cut`);
    const b = 246 - i * pitch;
    const li = w.elem('LI', list);
    w.text(w.elem('Lbl', li), { face: 'bold', size: 26, color: LIME }, LEFT, b - 9, String(n));
    const body = w.elem('LBody', li);
    w.text(body, { face: 'bold', size: 15, color: COVER_TEXT }, LEFT + 36, b, line.title);
    w.text(body, { face: 'sans', size: 9.5, color: COVER_MUTED }, LEFT + 36, b - 16, line.dek);
    link(ctx, [LEFT - 6, b - 34, LEFT + 330, b + 38], line.page, goTo(copy, n, line.title), li);
  });

  trySlip(ctx, c.tryLine, { dark: true, y: 34 });
  footer(ctx, true);
}

/** The sea, the headland, the lighthouse and its beam. */
function art(ctx: PageCtx) {
  const { w } = ctx;
  const [lx, ly] = LAMP;
  // The beam's colour runs from the lamp (yellow-lime) through lime (59 %) to mint.
  const ramp = (C0: readonly number[], C1: readonly number[]) => ({
    FunctionType: 2,
    Domain: [0, 1],
    C0: [...C0].map(r2),
    C1: [...C1].map(r2),
    N: 1,
  });
  w.resource(
    'Shading',
    'ShBeam',
    w.doc.context.obj({
      ShadingType: 2,
      ColorSpace: 'DeviceRGB',
      Coords: [lx, ly, 0, ly + 32],
      Function: {
        FunctionType: 3,
        Domain: [0, 1],
        Functions: [ramp(AURORA_YELLOW, AURORA_LIME), ramp(AURORA_LIME, MINT)],
        Bounds: [0.41],
        Encode: [0, 1, 0, 1],
      },
      Extend: [true, true],
    }),
  );
  w.resource('ExtGState', 'GsBeam', w.doc.context.obj({ ca: 0.92 }));
  w.resource('ExtGState', 'GsGlow1', w.doc.context.obj({ ca: 0.07 }));
  w.resource('ExtGState', 'GsGlow2', w.doc.context.obj({ ca: 0.12 }));

  /** A wedge from the lamp to past the page's left edge, `half` either side of its axis. */
  const wedge = (half: number) => {
    const axis = Math.PI - (2.5 * Math.PI) / 180;
    const reach = lx * 1.25;
    const at = (a: number) => [r2(lx + Math.cos(a) * reach), r2(ly + Math.sin(a) * reach)] as const;
    const [x0, y0] = at(axis - half);
    const [x1, y1] = at(axis + half);
    return [moveTo(lx, ly), lineTo(x0, y0), lineTo(x1, y1), closePath()];
  };
  const ops = [];
  // The sea: hairlines closer together towards the horizon (perspective).
  for (let i = 0; i < 38; i++) {
    const t = i / 37;
    const y = HORIZON - 170 * t ** 1.55;
    ops.push(...hairline(0, y, PAGE_W, y, COVER_SEA, 0.5 + t * 0.4));
  }
  // The beam: a wide glow, then the beam itself, both shaded.
  for (const [deg, gs] of [
    [15, 'GsGlow1'],
    [9, 'GsGlow2'],
    [4.5, 'GsBeam'],
  ] as const) {
    ops.push(
      pushGraphicsState(),
      raw(`/${gs} gs`),
      ...wedge((deg * Math.PI) / 180),
      clip(),
      endPath(),
      raw('/ShBeam sh'),
      popGraphicsState(),
    );
  }
  // The headland, over the sea's right end.
  ops.push(
    ...poly(
      [
        [352, HORIZON - 10],
        [384, HORIZON + 2],
        [420, HORIZON + 10],
        [470, HORIZON + 13],
        [530, HORIZON + 6],
        [PAGE_W, HORIZON - 2],
        [PAGE_W, HORIZON - 42],
        [470, HORIZON - 30],
        [400, HORIZON - 18],
      ],
      [0.075, 0.08, 0.095],
    ),
  );
  // The lighthouse: a tapered tower, a gallery, the lamp room (lime) and a cap.
  const base = HORIZON + 10;
  const top = ly - 8;
  ops.push(
    ...poly(
      [
        [lx - 9, base],
        [lx + 9, base],
        [lx + 6, top],
        [lx - 6, top],
      ],
      COVER_TEXT,
    ),
    ...rect(lx - 6, base + 18, 12, 3, COVER_SEA),
    ...rect(lx - 5.5, base + 38, 11, 3, COVER_SEA),
    ...rect(lx - 9, top, 18, 2.2, COVER_TEXT),
    ...rect(lx - 5, top + 2.2, 10, 9, LIME),
    ...poly(
      [
        [lx - 7, top + 11.2],
        [lx + 7, top + 11.2],
        [lx, top + 18],
      ],
      COVER_TEXT,
    ),
    ...disc(lx, ly - 1.5, 2.6, [1, 1, 0.88]),
  );
  return ops;
}
