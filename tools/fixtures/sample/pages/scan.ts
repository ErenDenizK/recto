/**
 * Page 6 of the full cut, a letter from the cape (design.md §4 page 6): the page is one
 * greyscale image and nothing else, so the facts chip reads "No text on 1 page" and Recognize
 * text picks exactly this page. An A5 typed letter lies on a scanner bed, turned 0.7°, folded
 * once, with a received stamp, a pen signature and a paper clip. Over it, the footer (in every
 * page's grey, B7), the page's dark try slip and lamp tab (MOB-14) are drawn as paths and
 * stencil masks, so there is still no text layer.
 *
 * Drawn by lib/raster.ts from glyph outlines (JetBrains Mono for the typewriter, never
 * embedded; Inter for the stamp and the stencils) with a PRNG seeded from the file name, so
 * the pixels are the same on every machine. Written as a 2-bit Indexed image of its four tones
 * (MOB-14; direction-v2.md §8 page 6) through Flate: the flat bed and paper compress to almost
 * nothing; the type is the cost.
 */
import { PDFHexString, PDFName, setFillingRgbColor } from '@cantoo/pdf-lib';
import { seededRandom } from '../../lib/common.ts';
import { Canvas } from '../../lib/raster.ts';
import { type PageCtx, type SlipRun, trySlip } from '../context.ts';
import {
  type Elem,
  FACES,
  FOOT_Y,
  type FkFont,
  LEFT,
  PAGE_H,
  PAGE_W,
  RIGHT,
  STYLE,
  openFont,
  r2,
  raw,
} from '../kit.ts';

const DPI = 150;
const PX = DPI / 72;
const W = Math.round(PAGE_W * PX);
const H = Math.round(PAGE_H * PX);

/** Tones (0 black … 255 white). */
const BED = 236;
const PAPER = 255;
const SHADOW = 196;
const INK = 46;

/** The sheet: A5 portrait at (x, top) in points from the page's top left, turned. */
const SHEET = { x: 52, top: 46, w: 420, h: 595, degrees: 0.7 };
const MARGIN = 40;
const TYPE_SIZE = 11;
const TYPE_LEADING = 14;

type Pt = [number, number];

function sheetToPx(): (x: number, y: number) => Pt {
  const t = (SHEET.degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(t), Math.sin(t)];
  const cx = SHEET.x + SHEET.w / 2;
  const cy = SHEET.top + SHEET.h / 2;
  // (x, y) in points from the sheet's top left, y down → pixels.
  return (x, y) => {
    const px = SHEET.x + x - cx;
    const py = SHEET.top + y - cy;
    return [(cx + px * cos - py * sin) * PX, (cy + px * sin + py * cos) * PX];
  };
}

function glyphs(
  canvas: Canvas,
  font: FkFont,
  size: number,
  text: string,
  x: number,
  baseline: number,
  place: (x: number, y: number) => Pt,
  jitter: () => number = () => 0,
): number {
  const scale = size / font.unitsPerEm;
  const run = font.layout(text);
  let pen = 0;
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const ox = x + (pen + (pos?.xOffset ?? 0)) * scale;
    const dy = jitter();
    if (!glyph.codePoints.includes(32))
      canvas.fillPath(glyph.path.commands, (gx, gy) =>
        place(ox + gx * scale, baseline + dy - gy * scale),
      );
    pen += pos?.xAdvance ?? glyph.advanceWidth;
  });
  return pen * scale;
}

/** A stroke as quads of width `width` along a polyline, filled together (non-zero). */
function strokePolys(points: readonly Pt[], width: number): Pt[][] {
  const out: Pt[][] = [];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1] as Pt, points[i] as Pt];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-(b[1] - a[1]) / len) * (width / 2);
    const ny = ((b[0] - a[0]) / len) * (width / 2);
    out.push([
      [a[0] + nx, a[1] + ny],
      [b[0] + nx, b[1] + ny],
      [b[0] - nx, b[1] - ny],
      [a[0] - nx, a[1] - ny],
    ]);
  }
  return out;
}

function rectOutline(x: number, y: number, w: number, h: number, width: number): Pt[][] {
  const p: Pt[] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ];
  return strokePolys(p, width);
}

export interface ScanImage {
  readonly grey: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export function scanLetter(ctx: PageCtx): ScanImage {
  const c = ctx.copy.scan;
  const random = seededRandom(`${ctx.file}#scan`);
  const mono = openFont('JetBrainsMono-Regular.ttf');
  const bold = openFont('Inter-Bold.ttf');
  const place = sheetToPx();

  // Typewriter ink in three strikes (an uneven hand on the keys).
  const strikes = [new Canvas(W, H), new Canvas(W, H), new Canvas(W, H)];
  const strikeOf = () => strikes[Math.floor(random() * 3)] as Canvas;
  let y = MARGIN + 18;
  let signatureY = 0;
  for (const line of c.letter) {
    if (line === '#signature') {
      signatureY = y;
      y += TYPE_LEADING * 2.2;
      continue;
    }
    if (line) {
      // Glyph by glyph, each with its own strike and a baseline jitter of ±0.3 px.
      let x = MARGIN;
      for (const ch of Array.from(line)) {
        x += glyphs(
          strikeOf(),
          mono,
          TYPE_SIZE,
          ch,
          x,
          y,
          place,
          () => ((random() - 0.5) * 0.6) / PX,
        );
      }
    }
    y += TYPE_LEADING;
  }

  // The signature: one pen stroke over the space left for it.
  const sig = new Canvas(W, H);
  const pts: Pt[] = [];
  const sx = MARGIN + 4;
  const sy = signatureY + 12;
  for (let i = 0; i <= 120; i++) {
    const s = i / 120;
    const x = sx + s * 120;
    const yy = sy - Math.sin(s * Math.PI * 5.2) * (7 - s * 4) - Math.sin(s * Math.PI * 1.3) * 5;
    pts.push(place(x + Math.sin(s * 31) * 2.2, yy));
  }
  pts.push(place(sx + 112, sy + 4), place(sx + 140, sy - 3));
  sig.fillPolygons(strokePolys(pts, 1.25 * PX));

  // The received stamp: a box and a date, turned −5°, top right of the sheet.
  const stamp = new Canvas(W, H);
  const st = (-5 * Math.PI) / 180;
  const [sc, ss] = [Math.cos(st), Math.sin(st)];
  const stampAt = (x: number, yy: number): Pt => {
    const ox = SHEET.w - MARGIN - 120;
    const oy = MARGIN - 6;
    return place(ox + x * sc - yy * ss, oy + x * ss + yy * sc);
  };
  const box = rectOutline(0, 0, 124, 26, 1.1).map((poly) => poly.map(([x, yy]) => stampAt(x, yy)));
  stamp.fillPolygons(box);
  const label = c.stamp;
  const lw = glyphWidth(bold, 9, label);
  glyphs(stamp, bold, 9, label, 62 - lw / 2, 16.5, stampAt);

  // A paper clip on the letter's top edge.
  const clipPts: Pt[] = [];
  const loop = [
    [0, 34],
    [0, -12],
    [10, -12],
    [10, 26],
    [4, 26],
    [4, -4],
  ] as const;
  for (const [x, yy] of loop) clipPts.push(place(196 + x, yy));
  const wire = new Canvas(W, H);
  wire.fillPolygons(strokePolys(clipPts, 1.4 * PX));

  // Compose: bed, the sheet's shadow, the sheet with its fold, then inks.
  const inverse = (px: number, py: number): Pt => {
    const t = (-SHEET.degrees * Math.PI) / 180;
    const cx = (SHEET.x + SHEET.w / 2) * PX;
    const cy = (SHEET.top + SHEET.h / 2) * PX;
    const dx = px - cx;
    const dy = py - cy;
    return [
      (cx + dx * Math.cos(t) - dy * Math.sin(t)) / PX - SHEET.x,
      (cy + dx * Math.sin(t) + dy * Math.cos(t)) / PX - SHEET.top,
    ];
  };
  const out = new Uint8Array(W * H);
  const fold = SHEET.h / 2;
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const [sx0, sy0] = inverse(px + 0.5, py + 0.5);
      let tone = BED;
      if (sx0 >= 0 && sx0 <= SHEET.w && sy0 >= 0 && sy0 <= SHEET.h) {
        tone = PAPER;
        const d = Math.abs(sy0 - fold);
        if (d < 2.2) tone = d < 0.5 ? PAPER : 240;
      } else if (sx0 > SHEET.w && sx0 < SHEET.w + 2 && sy0 > 3 && sy0 < SHEET.h + 2) tone = SHADOW;
      else if (sy0 > SHEET.h && sy0 < SHEET.h + 2 && sx0 > 3 && sx0 < SHEET.w + 2) tone = SHADOW;
      const i = py * W + px;
      // A steep tone curve: edges resolve to paper or ink, as on a scanner's text mode, which
      // also keeps the four-tone image small.
      const ink = (k: Canvas, amount: number) => sharpen(k.coverage[i] ?? 0) * amount;
      const cover = Math.min(
        1,
        ink(strikes[0] as Canvas, 0.8) +
          ink(strikes[1] as Canvas, 0.9) +
          ink(strikes[2] as Canvas, 1) +
          ink(sig, 0.92),
      );
      let v = tone - cover * (tone - INK);
      v -= Math.min(1, stamp.coverage[i] ?? 0) * (v - 120) * 0.75;
      v -= Math.min(1, wire.coverage[i] ?? 0) * (v - 150);
      out[i] = posterize(v);
    }
  }
  // Dust.
  for (let n = 0; n < 40; n++) {
    const x = Math.floor(random() * W);
    const yy = Math.floor(random() * H);
    const i = yy * W + x;
    out[i] = posterize((out[i] ?? 255) - 60 - Math.floor(random() * 60));
  }
  return { grey: out, width: W, height: H };
}

/**
 * Four tones (paper, bed, a mid grey for stamp and edges, ink): an image with little entropy,
 * stored at 2 bits a pixel, which keeps the page near 20 KB.
 */
const TONES = [255, 238, 153, 51];
function posterize(v: number): number {
  let best = 255;
  for (const t of TONES) if (Math.abs(t - v) < Math.abs(best - v)) best = t;
  return best;
}

const sharpen = (c: number) => Math.max(0, Math.min(1, (c - 0.22) / 0.56));

function glyphWidth(font: FkFont, size: number, text: string): number {
  const run = font.layout(text);
  return (
    run.glyphs.reduce((n, g, i) => n + (run.positions[i]?.xAdvance ?? g.advanceWidth), 0) *
    (size / font.unitsPerEm)
  );
}

/** The palette of the Indexed image: `TONES` from dark to light, one byte each. */
const PALETTE = [...TONES].reverse();

/**
 * Four-tone grey → 2-bit palette indices, rows packed high bits first. No predictor: on this
 * page (flat paper, a lot of type) plain Flate is the smallest (measured against Up, Sub and
 * a per-row best).
 */
export function pack2(image: ScanImage): Uint8Array {
  const index = new Map(PALETTE.map((tone, i) => [tone, i]));
  const rowBytes = Math.ceil(image.width / 4);
  const out = new Uint8Array(rowBytes * image.height);
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const tone = image.grey[y * image.width + x] ?? 255;
      const q = index.get(tone);
      if (q === undefined) throw new Error(`scan: tone ${tone} is not in the palette`);
      const k = y * rowBytes + (x >> 2);
      out[k] = (out[k] ?? 0) | (q << (6 - 2 * (x & 3)));
    }
  return out;
}

/**
 * The scan page: the image, full bleed, as a Figure with alt text; then the standard try slip
 * over it (every page's slip, design §2), its shapes as paths and its type as stencil masks
 * (1-bit images painted in the slip's colours), so the page still has no text layer: the facts
 * chip and Recognize text's default scope keep finding it.
 */
export function scanPage(ctx: PageCtx): void {
  const { w, doc, copy } = ctx;
  const image = scanLetter(ctx);
  // pdf-lib's own deflate (pako), so the bytes do not depend on Node's zlib. The four tones
  // as a 2-bit Indexed image: the same pixels as 4-bit DeviceGray in about 20 % fewer bytes.
  const stream = doc.context.flateStream(pack2(image), {
    Type: 'XObject',
    Subtype: 'Image',
    Width: image.width,
    Height: image.height,
    ColorSpace: doc.context.obj([
      PDFName.of('Indexed'),
      PDFName.of('DeviceGray'),
      3,
      PDFHexString.of(
        PALETTE.map((tone) => tone.toString(16).padStart(2, '0'))
          .join('')
          .toUpperCase(),
      ),
    ]),
    BitsPerComponent: 2,
  });
  const ref = doc.context.register(stream);
  // The page's own resources (the tab and the slip add theirs after this).
  w.page.node.set(
    PDFName.of('Resources'),
    doc.context.obj({ XObject: { Im1: ref }, Font: {}, ExtGState: {} }),
  );
  const figure = w.elem('Figure', w.sect, copy.scan.alt);
  const mcid = w.tags.mcid(w.index, figure);
  w.page.node.set(
    PDFName.of('Contents'),
    doc.context.obj([
      doc.context.register(
        doc.context.flateStream(
          `/Figure <</MCID ${mcid}>> BDC q ${r2(PAGE_W)} 0 0 ${r2(PAGE_H)} 0 0 cm /Im1 Do Q EMC`,
        ),
      ),
    ]),
  );
  // The footer as every page sets it (B7): its type as stencil masks in the folio's grey, on
  // the page rather than in the scan's four tones (where it came out #999, 2.4:1 on the bed).
  const folio = `${ctx.n} / ${ctx.total}`;
  stencils(ctx, 'Ft', null, [
    { text: copy.footer, style: STYLE.folio, x: LEFT, y: FOOT_Y },
    { text: folio, style: STYLE.folio, x: RIGHT - w.width(STYLE.folio, folio), y: FOOT_Y },
  ]);
  trySlip(ctx, copy.scan.tryLine, {
    raster: (runs) => stencils(ctx, 'Mk', w.elem('Figure', w.elem('Div'), copy.scan.tryLine), runs),
  });
}

/** Lines of type as 1-bit stencil masks filled in their colour: as a Figure, or artifacts. */
function stencils(ctx: PageCtx, prefix: string, figure: Elem | null, runs: readonly SlipRun[]) {
  const { w, doc } = ctx;
  runs.forEach((run, i) => {
    const mask = stencil(run);
    const name = `${prefix}${i + 1}`;
    w.resource(
      'XObject',
      name,
      doc.context.register(
        doc.context.flateStream(mask.bits, {
          Type: 'XObject',
          Subtype: 'Image',
          Width: mask.width,
          Height: mask.height,
          ImageMask: true,
          BitsPerComponent: 1,
          Decode: [1, 0],
        }),
      ),
    );
    const ops = [
      setFillingRgbColor(...run.style.color),
      raw(`${r2(mask.w)} 0 0 ${r2(mask.h)} ${r2(mask.x)} ${r2(mask.y)} cm /${name} Do`),
    ];
    if (figure) w.figure(figure, ...ops);
    else w.art(...ops);
  });
}

/**
 * Stencil resolution of the slip's and the footer's type: 200 dpi, a third over the scan's
 * own 150, which keeps the four files inside their cap (the scan is a scan).
 */
const MASK_DPI = 200;

/** One line of the slip's type as a 1-bit mask (1 = ink), with where it goes on the page. */
function stencil(run: SlipRun): {
  bits: Uint8Array;
  width: number;
  height: number;
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const spec = FACES[run.style.face];
  const font = openFont(spec.file);
  const scale = run.style.size / font.unitsPerEm;
  const glyphRun = font.layout(run.text, spec.features);
  const tracking = run.style.tracking ?? 0;
  const advance = glyphRun.glyphs.reduce((n, g) => n + g.advanceWidth * scale + tracking, 0);
  const x = run.x - 1;
  const y = run.y - run.style.size * 0.3;
  const wPt = advance + 2;
  const hPt = run.style.size * 1.3;
  const px = MASK_DPI / 72;
  const width = Math.ceil(wPt * px);
  const height = Math.ceil(hPt * px);
  const canvas = new Canvas(width, height);
  let pen = 1;
  for (const glyph of glyphRun.glyphs) {
    const ox = pen;
    canvas.fillPath(glyph.path.commands, (gx, gy) => [
      (ox + gx * scale) * px,
      (hPt - run.style.size * 0.3 - gy * scale) * px,
    ]);
    pen += glyph.advanceWidth * scale + tracking;
  }
  const rowBytes = Math.ceil(width / 8);
  const bits = new Uint8Array(rowBytes * height);
  for (let r = 0; r < height; r++)
    for (let c = 0; c < width; c++)
      if ((canvas.coverage[r * width + c] ?? 0) >= 0.5) {
        const k = r * rowBytes + (c >> 3);
        bits[k] = (bits[k] ?? 0) | (0x80 >> (c & 7));
      }
  return { bits, width, height, x, y, w: wPt, h: hPt };
}
