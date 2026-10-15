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
import { PDFDict, PDFName, popGraphicsState, pushGraphicsState } from '@cantoo/pdf-lib';
import { type PageCtx, footer, link, trySlip } from '../context.ts';
import type { SampleCopy } from '../copy.ts';
import {
  CAP,
  COVER_MUTED,
  COVER_TEXT,
  FACES,
  LEFT,
  LIME,
  MEASURE,
  PAGE_H,
  PAGE_W,
  PT,
  RIGHT,
  type Rgb,
  STYLE,
  type Style,
  caps,
  hairline,
  openFont,
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
  shareCover,
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

  // The scene is one Form XObject (MOB-15): the flatplan's tile and the contact sheet's frame 9
  // paint the same object small, by `cm`, so the cover's light is the same light everywhere
  // and costs no bytes twice. Its shadings and states go into the form's own resources.
  const ops = scene(ctx);
  const resources = w.page.node.normalizedEntries().Resources;
  const own = Object.fromEntries(
    (['Shading', 'ExtGState'] as const).map((kind) => {
      const dict = resources.lookup(PDFName.of(kind), PDFDict);
      resources.set(PDFName.of(kind), w.doc.context.obj({}));
      return [kind, dict];
    }),
  );
  const sceneRef = w.doc.context.register(
    w.doc.context.formXObject(ops, { BBox: [0, 0, r2(PAGE_W), r2(PAGE_H)], Resources: own }),
  );
  w.resource('XObject', 'Scene', sceneRef);
  w.figure(w.elem('Figure', w.sect, c.alt), raw('/Scene Do'));
  // Film grain over the whole frame, outside the form so a miniature carries none.
  w.art(...grain(w, 0.26, [0, 0, PAGE_W, PAGE_H]));

  // Masthead (direction-v2.md §5.3): real text, so Find and the tags keep "Margin", set in Inter
  // Bold from the file's own subset in render mode 7 (clip) and filled with the lamp's light,
  // brighter towards the lamp: no outline bytes, no extra glyphs. Its first stem stands on the
  // left margin: the origin is pulled left by the first glyph's side bearing (A4).
  const typeRef = radialShading(w, 'ShType', LAMP[0], LAMP[1], 560, [
    [0, hex('#FFFFF4')],
    [0.42, hex('#F6F8F0')],
    [0.66, hex('#DDE0E4')],
    [1, hex('#B9BEC6')],
  ]);
  const { fs, x0 } = masthead(c.masthead);
  const hexText = w.faces.bold.encodeText(c.masthead).toString();
  const type = `BT /${FACES.bold.key} ${r2(fs)} Tf ${r2(-0.03 * fs)} Tc 7 Tr 1 0 0 1 ${r2(x0)} ${MAST_Y} Tm ${hexText} Tj ET 0 Tr 0 Tc`;
  w.figure(w.elem('H1', w.sect), raw(`${type} /ShType sh`));
  shareCover(w.doc, { scene: sceneRef, type: typeRef, masthead: type });

  w.text(
    w.elem('P'),
    { face: 'sans', size: PT.small, color: COVER_MUTED, tracking: 0.4 },
    LEFT,
    790,
    c.tagline,
  );
  // The light's characteristic as a chart prints it (C: single spaces, units set close).
  w.text(
    null,
    { face: 'serif', size: PT.small, color: COVER_MUTED },
    RIGHT,
    790,
    'Fl(3) G 10s 42m 22M',
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
  w.art(...hairline(LAMP[0] + 9, LAMP[1] + 4, LAMP[0] + 22, LAMP[1] + 17, COVER_MUTED, 0.5));
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
    // The numeral's cap top on the title's (B3): its baseline (27 − 16) × cap height lower.
    w.text(
      w.elem('Lbl', li),
      { face: 'bold', size: PT.numeral, color: LIME },
      LEFT,
      r2(b - (PT.numeral - PT.title) * CAP),
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

/** The masthead's baseline. */
const MAST_Y = 646;

/**
 * The masthead's size and origin (A4): as large as fits the measure (at most 150), its first
 * stem on the left margin and its last on the right: the origin is pulled left by the first
 * glyph's side bearing and the size counts ink, not advances (Inter Bold's own metrics).
 */
function masthead(text: string): { fs: number; x0: number } {
  const spec = FACES.bold;
  const font = openFont(spec.file);
  const glyphs = font.layout(text, spec.features).glyphs;
  const unit = 1 / font.unitsPerEm;
  const first = glyphs[0];
  const last = glyphs.at(-1);
  if (!first || !last) throw new Error('cover: an empty masthead');
  const bbox = (g: typeof first) => (g as unknown as { bbox: { minX: number; maxX: number } }).bbox;
  // Ink width at size 1: advances and tracking (−0.03 em a gap), less both side bearings.
  const ink =
    glyphs.reduce((s, g) => s + g.advanceWidth, 0) * unit -
    0.03 * (glyphs.length - 1) -
    bbox(first).minX * unit -
    (last.advanceWidth - bbox(last).maxX) * unit;
  const fs = Math.min(150, MEASURE / ink);
  return { fs, x0: LEFT - bbox(first).minX * unit * fs };
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

  // Sky and sea grounds (axial shadings; the grain over the frame masks their steps).
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
  // The column (B6) widens with perspective: dense short glints at the horizon, fewer and
  // longer towards us, each x jittered, fading out by y 260 so it never reaches the cover lines.
  const glints = new Strokes();
  for (let i = 0; i < 30; i++) {
    const t = i / 29;
    const y = HORIZON - 5 - 72 * t ** 1.35;
    const spread = 6 + 46 * t;
    const len = 1.5 + 13 * t * (0.6 + 0.8 * rnd());
    const x = lx - len / 2 + (rnd() - 0.5) * 2 * spread + (rnd() - 0.5) * 12;
    const col = scale(mix(LEMON, MINT, t), 0.5 * (1 - t) ** 2.2 + 0.02 * (1 - t));
    glints.add(x, y, x + len, y, col, 0.45 + t * 0.6, 24);
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
    ...streak(w, lx, ly),
  );
  return ops;
}

/**
 * The anamorphic streak through the lamp: a long arm west along the beam and a short one east
 * (to about x 560, C), so the eye follows the beam. Two halves of one profile: each a squashed
 * radial clipped to its side of the lamp, the right one shorter and correspondingly taller so
 * the two meet in the same vertical profile.
 */
function streak(w: PageCtx['w'], lx: number, ly: number) {
  const stops = [
    [0, hex('#E6FFF0')],
    [0.1, scale(MINT, 0.55)],
    [0.45, scale(MINT, 0.12)],
    [1, BLACK],
  ] as const;
  const half = 240 * 0.014;
  const arm = (name: string, r: number, x0: number, x1: number) => {
    radialShading(w, `Sh${name}`, 0, 0, r, stops, [true, false]);
    return raw(
      `q ${r2(x0)} ${r2(ly - half)} ${r2(x1 - x0)} ${r2(2 * half)} re W n /GsScr gs 1 0 0 ${r2(half / r)} ${r2(lx)} ${r2(ly)} cm /Sh${name} sh Q`,
    );
  };
  gs(w, 'GsScr', { BM: 'Screen' });
  return [arm('StreakW', 240, lx - 240, lx), arm('StreakE', 100, lx, lx + 100)];
}
