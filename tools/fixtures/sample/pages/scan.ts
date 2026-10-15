/**
 * Page 6 of the full cut, a letter from the cape (design.md §4 page 6): the page is one
 * greyscale image and nothing else, so the facts chip reads "No text on 1 page" and Recognize
 * text picks exactly this page. An A5 typed letter lies on a scanner bed, turned 0.7°, folded
 * once, with a received stamp, a pen signature and a routing label clipped under it that
 * carries the try line; the footer is in the raster too.
 *
 * Drawn by lib/raster.ts from glyph outlines (JetBrains Mono for the typewriter, never
 * embedded; Inter for the stamp, label and footer) with a PRNG seeded from the file name, so
 * the pixels are the same on every machine. Written as 4-bit DeviceGray (MOB-12) through
 * Flate: the flat bed and paper compress to almost nothing; the type is the cost.
 */
import { PDFName } from '@cantoo/pdf-lib';
import { seededRandom } from '../../lib/common.ts';
import { Canvas } from '../../lib/raster.ts';
import type { PageCtx } from '../context.ts';
import { type FkFont, PAGE_H, PAGE_W, openFont, r2 } from '../kit.ts';

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
  const sans = openFont('Inter-Regular.ttf');
  const bold = openFont('Inter-Bold.ttf');
  const place = sheetToPx();
  const pagePx = (x: number, y: number): Pt => [x * PX, y * PX];

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

  // The routing label under the sheet (paper-clipped), carrying the try line.
  const tag = new Canvas(W, H);
  const lx = 64;
  const ltop = SHEET.top + SHEET.h + 18;
  const lwidth = 400;
  const lines = wrap(sans, 9, c.tryLine, lwidth - 112);
  const lh = 22 + lines.length * 12;
  // Its border; the dot; TRY; the sentence.
  tag.fillPolygons(rectOutline(lx * PX, ltop * PX, lwidth * PX, lh * PX, 0.9));
  const dot: Pt[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    dot.push(pagePx(lx + 16 + Math.cos(a) * 3, ltop + 16 + Math.sin(a) * 3));
  }
  tag.fillPolygons([dot]);
  glyphs(
    tag,
    bold,
    6.5,
    ctx.copy.tryLabel.toLocaleUpperCase(ctx.copy.lang),
    lx + 26,
    ltop + 18.4,
    pagePx,
  );
  lines.forEach((text, i) => glyphs(tag, sans, 9, text, lx + 66, ltop + 19 + i * 12, pagePx));
  // A paper clip over the label's top edge and the sheet's foot.
  const clipPts: Pt[] = [];
  const cxp = lx + lwidth - 28;
  const loop = [
    [0, 30],
    [0, -14],
    [10, -14],
    [10, 24],
    [4, 24],
    [4, -6],
  ] as const;
  for (const [x, yy] of loop) clipPts.push(pagePx(cxp + x, ltop + yy));
  const wire = new Canvas(W, H);
  wire.fillPolygons(strokePolys(clipPts, 1.4 * PX));

  // The footer, as on every page.
  const foot = new Canvas(W, H);
  const footY = PAGE_H - 34;
  glyphs(foot, sans, 7, ctx.copy.footer, 56, footY, pagePx);
  const folio = `${ctx.n} / ${ctx.total}`;
  glyphs(foot, sans, 7, folio, PAGE_W - 56 - glyphWidth(sans, 7, folio), footY, pagePx);

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
  const labelBox = [lx * PX, ltop * PX, (lx + lwidth) * PX, (ltop + lh) * PX];
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
      if (
        px >= (labelBox[0] as number) &&
        px <= (labelBox[2] as number) &&
        py >= (labelBox[1] as number) &&
        py <= (labelBox[3] as number)
      )
        tone = PAPER;
      const i = py * W + px;
      // A steep tone curve: edges resolve to paper or ink, as on a scanner's text mode, which
      // also keeps the 4-bit image small.
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
      v -= Math.min(1, tag.coverage[i] ?? 0) * (v - 60);
      v -= Math.min(1, wire.coverage[i] ?? 0) * (v - 150);
      v -= Math.min(1, foot.coverage[i] ?? 0) * (v - 110);
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
 * Four tones (paper, bed, a mid grey for stamp and edges, ink): a 4-bit image with little
 * entropy, which keeps the page near 26 KB (technical.md §3's budget for the scan).
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

function wrap(font: FkFont, size: number, text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && glyphWidth(font, size, candidate) > width) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * 8-bit grey → 4 bits a pixel, rows packed high nibble first. No predictor: on this page
 * (flat paper, a lot of type) plain Flate is the smallest (measured against Up, Sub and a
 * per-row best).
 */
export function pack4(image: ScanImage): Uint8Array {
  const rowBytes = Math.ceil(image.width / 2);
  const out = new Uint8Array(rowBytes * image.height);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const q = Math.round((image.grey[y * image.width + x] ?? 255) / 17);
      const k = y * rowBytes + (x >> 1);
      out[k] = (out[k] ?? 0) | (x % 2 === 0 ? q << 4 : q);
    }
  }
  return out;
}

/** The scan page: the image, full bleed, as a Figure with alt text. */
export function scanPage(ctx: PageCtx): void {
  const { w, doc, copy } = ctx;
  const image = scanLetter(ctx);
  // pdf-lib's own deflate (pako), so the bytes do not depend on Node's zlib.
  const stream = doc.context.flateStream(pack4(image), {
    Type: 'XObject',
    Subtype: 'Image',
    Width: image.width,
    Height: image.height,
    ColorSpace: 'DeviceGray',
    BitsPerComponent: 4,
  });
  const ref = doc.context.register(stream);
  w.page.node.set(PDFName.of('Resources'), doc.context.obj({ XObject: { Im1: ref } }));
  const figure = w.elem('Figure', w.sect, copy.scan.alt);
  const mcid = w.tags.mcid(w.index, figure);
  w.page.node.set(
    PDFName.of('Contents'),
    doc.context.register(
      doc.context.flateStream(
        `/Figure <</MCID ${mcid}>> BDC q ${r2(PAGE_W)} 0 0 ${r2(PAGE_H)} 0 0 cm /Im1 Do Q EMC`,
      ),
    ),
  );
}
