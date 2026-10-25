/**
 * The sample's light (MOB-14; docs/design/sample-2026-10/direction-v2.md §4, §5): the
 * constructs that carry one night at Cape Ardıç, each a PDF object a page names in its
 * resources. Two PDFium facts shape every recipe (§5.4): a blended object composites against
 * a transparent page, so it must lie on a ground the page paints and be clipped to it; and it
 * costs an offscreen group the size of its bounds, so large light is composited here, in the
 * generator, and painted Normal.
 *
 * - `grain`: one 2-bit DeviceGray noise tile (96 px, seeded), shared by every page through one
 *   coloured tiling pattern, painted Normal at a low alpha (§4). Only on dark grounds.
 * - `ramp`: a stitched Type 3 function of Type 2 segments (exact stops, few bytes).
 * - `glow`: a radial shading painted with Screen (black is "no light"), clipped to its box; a
 *   y-squash turns it into the anamorphic streak (§5.2).
 * - `beamMesh` / `latticeShading`: Gouraud lattices (ShadingType 5) whose vertices carry light
 *   already screened onto the ground beneath (§5.1, §5.3).
 * - `FRAME_TIME` and the night ramps: each page id is an hour, its light and ground sampled
 *   from §3.2.
 */
import {
  type PDFDocument,
  type PDFOperator,
  type PDFRef,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
} from '@cantoo/pdf-lib';
import { seededRandom } from '../lib/common.ts';
import { type Rgb, type Writer, r2, raw } from './kit.ts';

export type Stop = readonly [number, Rgb];

const c3 = (rgb: Rgb) => rgb.map((v) => Math.round(v * 1000) / 1000);

/** A stitched function over `stops` (t ascending, first 0, last 1). */
export function ramp(stops: readonly Stop[]) {
  const segs = stops.slice(1).map(([, rgb], i) => ({
    FunctionType: 2,
    Domain: [0, 1],
    C0: c3((stops[i] as Stop)[1]),
    C1: c3(rgb),
    N: 1,
  }));
  if (segs.length === 1) return segs[0];
  return {
    FunctionType: 3,
    Domain: [0, 1],
    Functions: segs,
    Bounds: stops.slice(1, -1).map(([t]) => Math.round(t * 1000) / 1000),
    Encode: segs.flatMap(() => [0, 1]),
  };
}

export const hex = (value: string): Rgb => {
  const n = Number.parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const mix = (a: Rgb, b: Rgb, t: number): Rgb =>
  [0, 1, 2].map((i) => (a[i] as number) * (1 - t) + (b[i] as number) * t) as unknown as Rgb;
export const scale = (a: Rgb, k: number): Rgb => a.map((v) => Math.min(1, v * k)) as unknown as Rgb;

// ---------------------------------------------------------------------------
// Document-wide objects
// ---------------------------------------------------------------------------

const shared = new WeakMap<PDFDocument, { grain?: PDFRef; pattern?: Map<number, PDFRef> }>();

/** The grain tile: 96 × 96, 2 bits, binomial(3, ½) levels (a soft bell, not white noise). */
export function grainTile(doc: PDFDocument): PDFRef {
  const s = shared.get(doc) ?? {};
  shared.set(doc, s);
  if (s.grain) return s.grain;
  const N = 96;
  const rnd = seededRandom('recto-sample-grain');
  const rowBytes = N / 4;
  const data = new Uint8Array(rowBytes * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.5 ? 1 : 0) + (rnd() < 0.5 ? 1 : 0);
      const i = y * rowBytes + (x >> 2);
      data[i] = (data[i] ?? 0) | (v << (6 - 2 * (x & 3)));
    }
  const stream = doc.context.flateStream(data, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: N,
    Height: N,
    ColorSpace: 'DeviceGray',
    BitsPerComponent: 2,
    // Levels 0..3 land on 0.5 ± 0.375, a bell round mid-grey.
    Decode: [0.125, 0.875],
    Interpolate: true,
  });
  s.grain = doc.context.register(stream);
  return s.grain;
}

/** The grain as a tiling pattern whose cell is `cell` pt (96 px → 2.67 px/pt at 36 pt). */
export function grainPattern(doc: PDFDocument, cell = 36): PDFRef {
  const s = shared.get(doc) ?? {};
  shared.set(doc, s);
  s.pattern ??= new Map();
  const have = s.pattern.get(cell);
  if (have) return have;
  const tile = grainTile(doc);
  const ref = doc.context.register(
    doc.context.stream('/G Do', {
      Type: 'Pattern',
      PatternType: 1,
      PaintType: 1,
      TilingType: 1,
      BBox: [0, 0, 1, 1],
      XStep: 1,
      YStep: 1,
      Matrix: [cell, 0, 0, cell, 0, 0],
      Resources: { XObject: { G: tile } },
    }),
  );
  s.pattern.set(cell, ref);
  return ref;
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

const sharedGs = new WeakMap<PDFDocument, Map<string, PDFRef>>();
/** An ExtGState on the page; equal states share one object per file. */
export function gs(w: Writer, name: string, opts: { ca?: number; CA?: number; BM?: string }) {
  const map = sharedGs.get(w.doc) ?? new Map<string, PDFRef>();
  sharedGs.set(w.doc, map);
  const key = JSON.stringify(opts);
  let ref = map.get(key);
  if (!ref) {
    ref = w.doc.context.register(w.doc.context.obj({ ...opts }));
    map.set(key, ref);
  }
  w.resource('ExtGState', name, ref);
}

/**
 * Grain over `area` at `amount` (the direction's Overlay strength; 0.1 to 0.3 reads as film),
 * painted Normal at 0.22 × `amount`: PDFium composites a Normal alpha fill directly, where an
 * Overlay goes through an offscreen group and costs 2 to 4 times as much (§4, §5.4). Grounds
 * under grain are set a few levels darker for the lift it gives.
 */
export function grain(
  w: Writer,
  amount: number,
  area: readonly [number, number, number, number],
  name = 'Gr',
  cell = 36,
): PDFOperator[] {
  w.resource('Pattern', 'PGrain', grainPattern(w.doc, cell));
  gs(w, name, { ca: Math.round(amount * 0.22 * 1000) / 1000 });
  const [x, y, ww, hh] = area;
  return [
    pushGraphicsState(),
    raw(`/${name} gs /Pattern cs /PGrain scn ${r2(x)} ${r2(y)} ${r2(ww)} ${r2(hh)} re f`),
    popGraphicsState(),
  ];
}

/** A radial shading resource (always registered: an inline shading stays outside object streams). */
export function radialShading(
  w: Writer,
  name: string,
  cx: number,
  cy: number,
  r: number,
  stops: readonly Stop[],
  extend: readonly [boolean, boolean] = [true, false],
  r0 = 0,
): PDFRef {
  const ref = w.doc.context.register(
    w.doc.context.obj({
      ShadingType: 3,
      ColorSpace: 'DeviceRGB',
      Coords: [r2(cx), r2(cy), r2(r0), r2(cx), r2(cy), r2(r)],
      Function: ramp(stops),
      Extend: [...extend],
    }),
  );
  w.resource('Shading', name, ref);
  return ref;
}

/** An axial shading resource. */
export function axialShading(
  w: Writer,
  name: string,
  from: readonly [number, number],
  to: readonly [number, number],
  stops: readonly Stop[],
  extend: readonly [boolean, boolean] = [true, true],
): PDFRef {
  const ref = w.doc.context.register(
    w.doc.context.obj({
      ShadingType: 2,
      ColorSpace: 'DeviceRGB',
      Coords: [r2(from[0]), r2(from[1]), r2(to[0]), r2(to[1])],
      Function: ramp(stops),
      Extend: [...extend],
    }),
  );
  w.resource('Shading', name, ref);
  return ref;
}

/**
 * A screened glow: radial `stops` (centre to rim, ending in black) around (cx, cy), radius r;
 * `squash` < 1 flattens it into a horizontal streak (anamorphic flare).
 */
export function glow(
  w: Writer,
  name: string,
  cx: number,
  cy: number,
  r: number,
  stops: readonly Stop[],
  opts: { squash?: number; ca?: number } = {},
): PDFOperator[] {
  const squash = opts.squash ?? 1;
  radialShading(w, `Sh${name}`, 0, 0, r, stops, [true, false]);
  gs(w, `Gs${name}`, { BM: 'Screen', ...(opts.ca !== undefined ? { ca: opts.ca } : {}) });
  // Clipped to its own box: PDFium composites a blended object through an offscreen bitmap
  // the size of its bounds, and an unclipped `sh` is bounded only by the page.
  return [
    pushGraphicsState(),
    raw(
      `${r2(cx - r)} ${r2(cy - r * squash)} ${r2(2 * r)} ${r2(2 * r * squash)} re W n /Gs${name} gs 1 0 0 ${r2(squash)} ${r2(cx)} ${r2(cy)} cm /Sh${name} sh`,
    ),
    popGraphicsState(),
  ];
}

/** Fills the current path's clip with shading `sh` under ExtGState `g`. */
export function shadeIn(path: PDFOperator[], sh: string, g?: string): PDFOperator[] {
  return [
    pushGraphicsState(),
    ...(g ? [raw(`/${g} gs`)] : []),
    ...path,
    clip(),
    endPath(),
    raw(`/${sh} sh`),
    popGraphicsState(),
  ];
}

// ---------------------------------------------------------------------------
// The night: one clock for the issue (direction-v2.md §1, §3.2)
// ---------------------------------------------------------------------------

/** Each page is a frame of one night at the cape, 18:52 (lamp on) to 07:04 (lamp off). */
export const FRAME_TIME: Record<string, string> = {
  cover: '18:52',
  letter: '19:40',
  feature: '21:15',
  contact: '23:30',
  agreement: '01:10',
  scan: '03:20',
  invoice: '05:05',
  flatplan: '06:41',
  'flatplan-phone': '06:41',
};
/** The lamp goes off after the last frame: the flatplan's closing slate. */
export const LAMP_OFF = '07:04';
const minutes = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return (h < 12 ? h + 24 : h) * 60 + m - (18 * 60 + 52);
};
/** 0 at lamp-on, 1 at lamp-off. */
export const nightOf = (id: string) => minutes(FRAME_TIME[id] ?? '18:52') / 732;

const LIGHT_RAMP: readonly Stop[] = [
  [0, hex('#EDFA6D')],
  [0.3, hex('#C8FB3D')],
  [0.72, hex('#69EAA3')],
  [1, hex('#1F9996')],
];
const GROUND_RAMP: readonly Stop[] = [
  [0, hex('#151A21')],
  [0.45, hex('#08090C')],
  [1, hex('#18222A')],
];
export function sample(stops: readonly Stop[], t: number): Rgb {
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i] as Stop;
    const [t0, c0] = stops[i - 1] as Stop;
    if (t <= t1) return mix(c0, c1, (t - t0) / (t1 - t0));
  }
  return (stops[stops.length - 1] as Stop)[1];
}
export const lightAt = (id: string) => sample(LIGHT_RAMP, nightOf(id));
export const groundAt = (id: string) => sample(GROUND_RAMP, nightOf(id));

// ---------------------------------------------------------------------------
// The beam as a Gouraud lattice (ShadingType 5)
// ---------------------------------------------------------------------------

/**
 * A volumetric beam: a lattice-form Gouraud mesh (ISO 32000-1 §8.7.4.5.6) fanned from the
 * lamp. Columns are angles across the beam, rows distances along it; each vertex carries
 * the light there: a sum of Gaussians across (core, body, haze) times the ramp and falloff
 * along. Gouraud interpolation is exact between samples, so there are no wedge steps, and
 * the mesh is a few hundred bytes. Painted with `sh` under Screen.
 */
export function beamMesh(
  w: Writer,
  name: string,
  lamp: readonly [number, number],
  axis: number,
  reach: number,
  opts: {
    /** Angles (deg) of the columns, symmetric. */
    readonly angles?: readonly number[];
    /** Distances along (0..1) of the rows. */
    readonly rows?: readonly number[];
    /** Profile across: [weight, sigma deg] terms. */
    readonly profile?: readonly (readonly [number, number])[];
    /** Colour along (0..1), before intensity. */
    readonly along: readonly Stop[];
    /** Intensity along (0..1). */
    readonly falloff: (t: number) => number;
    /**
     * The ground under the beam at a point, when known: the light is screened onto it here,
     * in the generator, and the mesh is painted with the Normal blend mode (no offscreen
     * group in the renderer, and no dependence on its page backdrop).
     */
    readonly backdrop?: (x: number, y: number) => Rgb;
  },
): PDFRef {
  const angles = opts.angles ?? [
    -20, -15.5, -12, -9, -7, -5.5, -4.2, -3.2, -2.4, -1.7, -1.1, -0.6, -0.25, 0, 0.25, 0.6, 1.1,
    1.7, 2.4, 3.2, 4.2, 5.5, 7, 9, 12, 15.5, 20,
  ];
  const rows = opts.rows ?? [0, 0.015, 0.05, 0.12, 0.22, 0.36, 0.52, 0.7, 0.86, 1];
  const profile = opts.profile ?? [
    [1, 0.35],
    [0.34, 1.6],
    [0.1, 5.5],
  ];
  const [lx, ly] = lamp;
  const pts: { x: number; y: number; c: Rgb }[] = [];
  let xmin = Infinity;
  let xmax = -Infinity;
  let ymin = Infinity;
  let ymax = -Infinity;
  const edge = Math.max(...angles.map(Math.abs));
  for (const t of rows) {
    for (const deg of angles) {
      const a = ((axis + deg) * Math.PI) / 180;
      const x = lx + Math.cos(a) * reach * t;
      const y = ly + Math.sin(a) * reach * t;
      // Near the lamp the beam has not spread yet: the profile narrows towards it.
      const window = (1 - (deg / edge) ** 2) ** 2;
      const across =
        window * profile.reduce((s, [wgt, sig]) => s + wgt * Math.exp(-((deg / sig) ** 2)), 0);
      const k = Math.min(1, across * opts.falloff(t));
      const lit = scale(sample(opts.along, t), k);
      const g = opts.backdrop?.(x, y);
      const c = g
        ? (lit.map((v, j) => 1 - (1 - v) * (1 - (g[j] as number))) as unknown as Rgb)
        : lit;
      pts.push({ x, y, c });
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
  }
  [xmin, xmax, ymin, ymax] = [
    Math.floor(xmin) - 1,
    Math.ceil(xmax) + 1,
    Math.floor(ymin) - 1,
    Math.ceil(ymax) + 1,
  ];
  const data = new Uint8Array(pts.length * 7);
  pts.forEach((p, i) => {
    const qx = Math.round(((p.x - xmin) / (xmax - xmin)) * 65535);
    const qy = Math.round(((p.y - ymin) / (ymax - ymin)) * 65535);
    const o = i * 7;
    data[o] = qx >> 8;
    data[o + 1] = qx & 255;
    data[o + 2] = qy >> 8;
    data[o + 3] = qy & 255;
    data[o + 4] = Math.round(Math.min(1, p.c[0]) * 255);
    data[o + 5] = Math.round(Math.min(1, p.c[1]) * 255);
    data[o + 6] = Math.round(Math.min(1, p.c[2]) * 255);
  });
  const ref = w.doc.context.register(
    w.doc.context.flateStream(data, {
      ShadingType: 5,
      ColorSpace: 'DeviceRGB',
      BitsPerCoordinate: 16,
      BitsPerComponent: 8,
      VerticesPerRow: angles.length,
      Decode: [xmin, xmax, ymin, ymax, 0, 1, 0, 1, 0, 1],
    }),
  );
  w.resource('Shading', name, ref);
  return ref;
}

/**
 * The cover as the pages that show it small draw it (the flatplan's tile, the contact sheet's
 * frame 9; MOB-15): its scene (a Form XObject of sky, dusk, sea, headland, tower, beam and
 * glows, painted by `cm` at any scale with no new bytes), the masthead's fill and the
 * masthead's outline as a path in the cover's own space.
 */
export interface CoverShare {
  readonly scene: PDFRef;
  readonly type: PDFRef;
  readonly masthead: string;
}
const covers = new WeakMap<PDFDocument, CoverShare>();
export const shareCover = (doc: PDFDocument, share: CoverShare) => void covers.set(doc, share);
export function coverOf(doc: PDFDocument): CoverShare {
  const share = covers.get(doc);
  if (!share) throw new Error('the cover is drawn before any page that shows it small');
  return share;
}

// ---------------------------------------------------------------------------
// Compact strokes (bytes: one colour and width per bucket, one decimal per coordinate)
// ---------------------------------------------------------------------------

const d1 = (v: number) => String(Math.round(v * 10) / 10);
/** Horizontal or straight segments bucketed by (colour, width): one `S` per bucket. */
export class Strokes {
  private readonly buckets = new Map<string, string[]>();
  add(x0: number, y0: number, x1: number, y1: number, color: Rgb, width: number, levels = 12) {
    const q = (v: number) => Math.round(v * levels) / levels;
    const key = `${color.map((c) => q(c).toFixed(3)).join(' ')} RG ${(Math.round(width * 4) / 4).toString()} w`;
    const list = this.buckets.get(key) ?? [];
    list.push(`${d1(x0)} ${d1(y0)} m ${d1(x1)} ${d1(y1)} l`);
    this.buckets.set(key, list);
  }
  /** Any path string (from `circle1` / `arc1`) under (colour, width). */
  path(d: string, color: Rgb, width: number, levels = 12) {
    const q = (v: number) => Math.round(v * levels) / levels;
    const key = `${color.map((c) => q(c).toFixed(3)).join(' ')} RG ${(Math.round(width * 4) / 4).toString()} w`;
    const list = this.buckets.get(key) ?? [];
    list.push(d);
    this.buckets.set(key, list);
  }
  ops(gsName?: string): PDFOperator[] {
    const body = [...this.buckets].map(([k, segs]) => `${k}\n${segs.join('\n')}\nS`).join('\n');
    return [raw(`q ${gsName ? `/${gsName} gs ` : ''}\n${body}\nQ`)];
  }
}

/** A circle as a path string, one decimal. */
export function circle1(cx: number, cy: number, r: number): string {
  const k = r * 0.5523;
  const p = (x: number, y: number) => `${d1(x)} ${d1(y)}`;
  return [
    `${p(cx + r, cy)} m`,
    `${p(cx + r, cy + k)} ${p(cx + k, cy + r)} ${p(cx, cy + r)} c`,
    `${p(cx - k, cy + r)} ${p(cx - r, cy + k)} ${p(cx - r, cy)} c`,
    `${p(cx - r, cy - k)} ${p(cx - k, cy - r)} ${p(cx, cy - r)} c`,
    `${p(cx + k, cy - r)} ${p(cx + r, cy - k)} ${p(cx + r, cy)} c h`,
  ].join(' ');
}
/** An arc (≤ 90°) as a path string, one decimal. */
export function arc1(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const k = (4 / 3) * Math.tan(rad(a1 - a0) / 4) * r;
  const [x0, y0] = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))];
  const [x3, y3] = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))];
  const c1 = [x0 - k * Math.sin(rad(a0)), y0 + k * Math.cos(rad(a0))];
  const c2 = [x3 + k * Math.sin(rad(a1)), y3 - k * Math.cos(rad(a1))];
  return `${d1(x0)} ${d1(y0)} m ${d1(c1[0] as number)} ${d1(c1[1] as number)} ${d1(c2[0] as number)} ${d1(c2[1] as number)} ${d1(x3)} ${d1(y3)} c`;
}

const sharedSh = new WeakMap<PDFDocument, Map<string, PDFRef>>();
/** A unit radial shading registered once per file under `key` (pages place it with `cm`). */
export function sharedShading(w: Writer, key: string, stops: readonly Stop[]): PDFRef {
  const map = sharedSh.get(w.doc) ?? new Map<string, PDFRef>();
  sharedSh.set(w.doc, map);
  let ref = map.get(key);
  if (!ref) {
    ref = w.doc.context.register(
      w.doc.context.obj({
        ShadingType: 3,
        ColorSpace: 'DeviceRGB',
        Coords: [0, 0, 0, 0, 0, 1],
        Function: ramp(stops),
        Extend: [true, false],
      }),
    );
    map.set(key, ref);
  }
  return ref;
}

/**
 * A rectangular Gouraud lattice (ShadingType 5) over (x, y, w, h), `cols` × `rows` vertices,
 * each coloured by `color(x, y)`: a ground the generator composites itself (sky screened with
 * dusk), painted Normal. Linear between vertices, so keep cells under ~50 pt on soft fields.
 */
export function latticeShading(
  w: Writer,
  name: string,
  box: readonly [number, number, number, number],
  cols: number,
  rows: number,
  color: (x: number, y: number) => Rgb,
): PDFRef {
  const [x0, y0, bw, bh] = box;
  const data = new Uint8Array(cols * rows * 7);
  let o = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const qx = Math.round((c / (cols - 1)) * 65535);
      const qy = Math.round((r / (rows - 1)) * 65535);
      const col = color(x0 + (c / (cols - 1)) * bw, y0 + (r / (rows - 1)) * bh);
      data.set(
        [qx >> 8, qx & 255, qy >> 8, qy & 255, ...col.map((v) => Math.round(Math.min(1, v) * 255))],
        o,
      );
      o += 7;
    }
  const ref = w.doc.context.register(
    w.doc.context.flateStream(data, {
      ShadingType: 5,
      ColorSpace: 'DeviceRGB',
      BitsPerCoordinate: 16,
      BitsPerComponent: 8,
      VerticesPerRow: cols,
      Decode: [x0, x0 + bw, y0, y0 + bh, 0, 1, 0, 1, 0, 1],
    }),
  );
  w.resource('Shading', name, ref);
  return ref;
}
