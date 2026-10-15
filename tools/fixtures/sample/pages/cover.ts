/**
 * Page 1, the cover, the night's key frame (MOB-14; direction-v2.md §8 page 1): 18:52, the
 * lamp has just come on. Dusk leaves by the west (a teal glow low on the left horizon); the
 * beam leaves the lamp yellow-lime, turns lime, and reaches the spine mint (the mark's own
 * ramp, laid along the light's path). All light is additive (black = no light): the beam and
 * the dusk are composited onto the sky here and painted Normal, the small glows are screened
 * and clipped. The type is lit by the lamp (the masthead's fill falls off with distance from
 * it), and the whole frame carries grain. The chart line, Fl(3) G 10s, is the light's
 * characteristic: three green flashes every ten seconds.
 */
import { popGraphicsState, pushGraphicsState } from '@cantoo/pdf-lib';
import { type PageCtx, footer, link, trySlip } from '../context.ts';
import type { SampleCopy } from '../copy.ts';
import {
  COVER_MUTED,
  COVER_TEXT,
  FACES,
  LEFT,
  LIME,
  PAGE_H,
  PAGE_W,
  PT,
  RIGHT,
  type Rgb,
  STYLE,
  type Style,
  caps,
  hairline,
  poly,
  r2,
  raw,
  rect,
} from '../kit.ts';
import {
  axialShading,
  beamMesh,
  glow,
  grain,
  gs,
  hex,
  lampTab,
  latticeShading,
  mix,
  radialShading,
  sample,
  scale,
  shadeIn,
  Strokes,
} from '../light.ts';

export const HORIZON = 336;
export const LAMP: readonly [number, number] = [462, 393];
/** The beam rises 3.2° to the left: it leaves the cover by the spine, into the issue. */
const AXIS = 175.2;

const SKY_TOP = hex('#040507');
const SKY_MID = hex('#080A0E');
const SKY_LOW = hex('#10151C');
const SEA_NEAR = hex('#030405');
const SEA_FAR = hex('#0A0D11');
const DUSK = hex('#1F9996'); // the aurora's teal: the last of the day
const LEMON = hex('#EDFA6D');
const AURORA_LIME = hex('#CBFF5F');
const MINT = hex('#69EAA3');
const BLACK: Rgb = [0, 0, 0];

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

  const figure = w.elem('Figure', w.sect, c.alt);
  w.figure(figure, ...scene(ctx));

  // Masthead (direction-v2.md §5.3): real text, so Find and the tags keep "Margin", set in Inter
  // Bold from the file's own subset in render mode 7 (clip) and filled with the lamp's light,
  // brighter towards the lamp: no outline bytes, no extra glyphs.
  radialShading(w, 'ShType', LAMP[0], LAMP[1], 640, [
    [0, hex('#FFFFF4')],
    [0.42, hex('#F6F8F0')],
    [0.62, hex('#E1E4E8')],
    [1, hex('#A7ADB6')],
  ]);
  const style: Style = { face: 'bold', size: 150, color: COVER_TEXT, tracking: -4.5 };
  const tw = w.width(style, c.masthead);
  const fs = Math.min(150, (150 * (RIGHT - LEFT + 4)) / tw);
  const hexText = w.faces.bold.encodeText(c.masthead).toString();
  w.figure(
    w.elem('H1', w.sect),
    raw(
      `BT /${FACES.bold.key} ${r2(fs)} Tf ${r2(-0.03 * fs)} Tc 7 Tr 1 0 0 1 ${r2(LEFT - 3)} 646 Tm ${hexText} Tj ET 0 Tr 0 Tc /ShType sh`,
    ),
  );

  w.text(
    w.elem('P'),
    { face: 'sans', size: PT.small, color: COVER_MUTED, tracking: 0.4 },
    LEFT,
    790,
    c.tagline,
  );
  w.text(
    null,
    { face: 'serif', size: PT.small, color: COVER_MUTED },
    RIGHT,
    790,
    'Fl(3) G 10s  42 m  22 M',
    'right',
  );
  w.text(
    w.elem('P'),
    { face: 'bold', size: PT.body, color: LIME, tracking: caps(PT.body) },
    LEFT,
    614,
    up(c.issue),
  );
  // The slate: the frame's timecode beside the lamp.
  const slate: Style = { ...STYLE.label, color: LIME };
  w.art(...hairline(LAMP[0] + 9, LAMP[1] + 4, LAMP[0] + 22, LAMP[1] + 17, scale(LIME, 0.55), 0.4));
  w.text(null, slate, LAMP[0] + 25, LAMP[1] + 16, '18:52');
  w.text(null, { ...slate, color: COVER_MUTED }, LAMP[0] + 25, LAMP[1] + 7.5, up(c.lampOn));

  // Cover lines: number, title, dek; each block one link (design R-14).
  const list = w.elem('L');
  const pitch = 72;
  c.lines.forEach((line, i) => {
    const n = ctx.pageOf(line.page);
    if (n === undefined) throw new Error(`cover: no page ${line.page} in this cut`);
    const b = 258 - i * pitch;
    const li = w.elem('LI', list);
    w.text(
      w.elem('Lbl', li),
      { face: 'bold', size: PT.numeral, color: LIME },
      LEFT,
      b - 10,
      String(n),
    );
    const body = w.elem('LBody', li);
    w.text(body, { face: 'bold', size: PT.title, color: COVER_TEXT }, LEFT + 38, b, line.title);
    w.text(body, { face: 'sans', size: PT.body, color: COVER_MUTED }, LEFT + 38, b - 16, line.dek);
    link(ctx, [LEFT - 6, b - 34, LEFT + 330, b + 38], line.page, goTo(copy, n, line.title), li);
  });

  trySlip(ctx, c.tryLine, { onDark: true, y: 34 });
  footer(ctx, true);
  w.art(...lampTab(w, 'cover'));
}

const SKY_STOPS = [
  [0, SKY_TOP],
  [0.55, SKY_MID],
  [1, SKY_LOW],
] as const;
const DUSK_STOPS = [
  [0, scale(DUSK, 0.26)],
  [0.35, scale(DUSK, 0.11)],
  [0.7, scale(DUSK, 0.03)],
  [1, BLACK],
] as const;
/** The ground the beam lies on, as the page paints it: the sky screened with the dusk. */
function skyAt(x: number, y: number): Rgb {
  const sky =
    y >= HORIZON
      ? sample(SKY_STOPS, Math.min(1, (PAGE_H - y) / (PAGE_H - HORIZON)))
      : sample(
          [
            [0, SEA_FAR],
            [1, SEA_NEAR],
          ],
          Math.min(1, (HORIZON - y) / HORIZON),
        );
  if (y < HORIZON) return sky;
  const d = Math.hypot((x + 60) / 520, (y - HORIZON) / 190);
  const dusk = d >= 1 ? BLACK : sample(DUSK_STOPS, d);
  return sky.map((v, j) => 1 - (1 - v) * (1 - (dusk[j] as number))) as unknown as Rgb;
}

/** Sky, dusk, sea, headland, lighthouse, beam, halation, glitter, grain. */
function scene(ctx: PageCtx) {
  const { w } = ctx;
  const [lx, ly] = LAMP;
  const ops = [];

  // Sky and sea grounds (axial shadings; grain dithers their gradients).
  axialShading(w, 'ShSky', [0, PAGE_H], [0, HORIZON], SKY_STOPS);
  axialShading(
    w,
    'ShSea',
    [0, HORIZON],
    [0, 0],
    [
      [0, SEA_FAR],
      [1, SEA_NEAR],
    ],
  );
  ops.push(
    ...shadeIn([raw(`0 ${HORIZON} ${r2(PAGE_W)} ${r2(PAGE_H - HORIZON)} re`)], 'ShSky'),
    ...shadeIn([raw(`0 0 ${r2(PAGE_W)} ${HORIZON} re`)], 'ShSea'),
  );
  // Dusk: the day leaving by the west, low on the left horizon (screened, clipped to the sky).
  radialShading(w, 'ShDusk', 0, 0, 1, DUSK_STOPS);
  gs(w, 'GsScr', { BM: 'Screen' });
  // Painted as a lattice the generator composites (sky screened with dusk): no blend group.
  latticeShading(w, 'ShDuskSky', [0, HORIZON, 470, 200], 11, 6, skyAt);
  ops.push(pushGraphicsState(), raw('/ShDuskSky sh'), popGraphicsState());

  // The beam: one Gouraud lattice, Gaussian across, the mark's ramp along, screened.
  const reach = lx * 1.12;
  beamMesh(w, 'ShBeam', LAMP, AXIS, reach, {
    along: [
      [0, hex('#FBFFE0')],
      [0.05, LEMON],
      [0.3, AURORA_LIME],
      [0.75, MINT],
      [1, MINT],
    ],
    profile: [
      [1, 0.42],
      [0.62, 2.4],
      [0.3, 5.2],
      [0.12, 10],
    ],
    falloff: (t) => (t < 0.02 ? 1.5 : 1.15 * (1 - 0.66 * t ** 0.8)),
    backdrop: skyAt,
  });
  // Clipped to the sky and painted right after it: the mesh carries the sky it lies on.
  ops.push(
    pushGraphicsState(),
    raw(`0 ${HORIZON} ${r2(PAGE_W)} ${r2(PAGE_H - HORIZON)} re W n /ShBeam sh`),
    popGraphicsState(),
  );

  // The sea: perspective lines, denser towards the horizon, catching a little of the dusk.
  const sea = new Strokes();
  for (let i = 0; i < 34; i++) {
    const t = i / 33;
    const y = HORIZON - 4 - 316 * t ** 1.7;
    sea.add(0, y, PAGE_W, y, mix(hex('#1C232C'), hex('#0B0D11'), t ** 0.7), 0.35 + t * 0.45, 64);
  }
  ops.push(...sea.ops());
  // Horizon: a hairline that is brighter where the dusk is.
  axialShading(
    w,
    'ShHz',
    [0, 0],
    [PAGE_W, 0],
    [
      [0, mix(hex('#2C4A4A'), BLACK, 0.1)],
      [0.5, hex('#1A2028')],
      [1, hex('#161A21')],
    ],
  );
  ops.push(...shadeIn([raw(`0 ${HORIZON - 0.3} ${r2(PAGE_W)} 0.6 re`)], 'ShHz'));

  // Headland: a far ridge, then the near rock the tower stands on (two planes of haze).
  ops.push(
    ...poly(
      [
        [300, HORIZON],
        [360, HORIZON + 5],
        [430, HORIZON + 11],
        [520, HORIZON + 14],
        [PAGE_W, HORIZON + 10],
        [PAGE_W, HORIZON],
      ],
      hex('#0C0F14'),
    ),
    ...poly(
      [
        [392, HORIZON],
        [420, HORIZON + 8],
        [452, HORIZON + 17],
        [470, HORIZON + 21],
        [492, HORIZON + 21],
        [520, HORIZON + 15],
        [560, HORIZON + 9],
        [PAGE_W, HORIZON + 6],
        [PAGE_W, HORIZON - 6],
        [520, HORIZON - 4],
        [440, HORIZON - 2],
      ],
      hex('#050608'),
    ),
  );

  // The tower: a dark silhouette rim-lit on the west by the dusk.
  const base = HORIZON + 20;
  const top = ly - 7;
  axialShading(
    w,
    'ShTower',
    [lx - 7, 0],
    [lx + 7, 0],
    [
      [0, hex('#4A5A5E')],
      [0.3, hex('#20262D')],
      [1, hex('#13161B')],
    ],
  );
  ops.push(
    ...shadeIn(
      [
        raw(
          `${r2(lx - 7.5)} ${base} m ${r2(lx + 7.5)} ${base} l ${r2(lx + 5)} ${r2(top)} l ${r2(lx - 5)} ${r2(top)} l h`,
        ),
      ],
      'ShTower',
    ),
    ...rect(lx - 8, top, 16, 1.4, hex('#2A3038')),
    ...rect(lx - 4.2, top + 1.4, 8.4, 7.6, hex('#2A3320')),
    ...rect(lx - 2.6, top + 2.6, 5.2, 5.2, hex('#F4FBD0')),
    ...poly(
      [
        [lx - 5.6, top + 9],
        [lx + 5.6, top + 9],
        [lx, top + 14.5],
      ],
      hex('#151920'),
    ),
  );

  // Glitter: the lamp's reflection, a column of glints from the rock towards us; and the
  // beam's light on the water to the west, faint glints along the far lines. Screened.
  const rnd = (() => {
    let seed = 7;
    return () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
  })();
  const glints = new Strokes();
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const y = HORIZON - 7 - 280 * t ** 1.5;
    const len = 2 + 22 * t * (0.5 + rnd());
    const x = lx - 4 + (rnd() - 0.5) * (8 + 60 * t);
    const col = scale(mix(LEMON, MINT, t), 0.5 * (1 - t) ** 2 + 0.025);
    glints.add(x, y, x + len, y, col, 0.5 + t * 0.9, 24);
  }
  for (let i = 0; i < 40; i++) {
    const x = lx - 30 - (lx - 10) * (i / 39) ** 0.9;
    const y = HORIZON - 3 - rnd() * 14;
    const k = 0.35 * (1 - i / 45);
    glints.add(x, y, x + 3 + rnd() * 9, y, scale(mix(AURORA_LIME, MINT, i / 39), k), 0.4, 24);
  }
  // Clipped to the sea they lie on (direction-v2.md §5.4).
  ops.push(
    pushGraphicsState(),
    raw(`0 0 ${r2(PAGE_W)} ${HORIZON} re W n`),
    ...glints.ops('GsScr'),
    popGraphicsState(),
  );

  // Halation and bloom round the lamp, then the anamorphic streak through it.
  ops.push(
    ...glow(w, 'Bloom', lx, ly, 150, [
      [0, hex('#2B3A0E')],
      [0.35, hex('#111906')],
      [1, BLACK],
    ]),
    ...glow(w, 'Halo', lx, ly, 46, [
      [0, hex('#FFFFFF')],
      [0.07, hex('#F6FCC4')],
      [0.24, hex('#6E8A1E')],
      [0.6, hex('#16200A')],
      [1, BLACK],
    ]),
    ...glow(
      w,
      'Streak',
      lx,
      ly,
      240,
      [
        [0, hex('#E6FFF0')],
        [0.1, scale(MINT, 0.55)],
        [0.45, scale(MINT, 0.12)],
        [1, BLACK],
      ],
      { squash: 0.014 },
    ),
  );

  // Film grain over the whole frame (dithers every gradient above).
  ops.push(...grain(w, 0.26, [0, 0, PAGE_W, PAGE_H]));
  return ops;
}
