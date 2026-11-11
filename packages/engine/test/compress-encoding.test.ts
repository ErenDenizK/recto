/**
 * Which encoding the image pass picks (R33 review): a 17 to 256 colour image gets a lossless
 * candidate (palette + Flate) that competes by size with the downsampled JPEG, and with the
 * original, so its Flate bytes must be fflate's level 9, as they always were. A native
 * `CompressionStream` can be far larger on some data (996 KB against 418 KB on noisy
 * indices), which flipped the choice to the JPEG and smeared the edges of charts and
 * screenshots. The picks below are the develop ones.
 */
import {
  concatTransformationMatrix,
  drawObject,
  PDFDocument,
  PDFName,
  popGraphicsState,
  pushGraphicsState,
} from '@cantoo/pdf-lib';
import { zlibSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import qpdfWasmUrl from '../qpdf/dist/qpdf.wasm?url';
import { compressPdf, type CompressionDependencies } from '../src/compress/compress';
import { canvasEncoder, encodeGray, encodeIndexed, palette } from '../src/compress/encode';
import { PdfiumImageDecoder } from '../src/compress/pdfium-decoder';
import { presetSettings } from '../src/compress/presets';
import { QpdfPlumber } from '../src/plumber/qpdf-plumber';
import { toBuffer, wasmUrl } from './helpers';

const SIDE = 600;

/** A repeatable pseudo-random byte stream. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
    return state >>> 16;
  };
}

/** `colours` distinct RGB values; `flat`: bands of colour (a chart), else one at random per pixel. */
function paletteImage(colours: number, flat: boolean): Uint8ClampedArray {
  const next = lcg(colours * 7 + (flat ? 1 : 2));
  const table = Array.from({ length: colours }, (_, i) => [
    (i * 6) & 255,
    (i * 37 + 3) & 255,
    (i * 91 + 7) & 255,
  ]);
  const out = new Uint8ClampedArray(SIDE * SIDE * 4);
  for (let p = 0; p < SIDE * SIDE; p++) {
    const x = p % SIDE;
    const y = Math.floor(p / SIDE);
    const pick = flat ? (Math.floor(x / 40) + Math.floor(y / 40) * 15) % colours : next() % colours;
    out.set([...(table[pick] as number[]), 255], p * 4);
  }
  return out;
}

async function pdfWith(rgba: Uint8ClampedArray): Promise<ArrayBuffer> {
  const rgb = new Uint8Array(SIDE * SIDE * 3);
  for (let p = 0; p < SIDE * SIDE; p++) rgb.set(rgba.subarray(p * 4, p * 4 + 3), p * 3);
  const doc = await PDFDocument.create({ updateMetadata: false });
  const stream = doc.context.flateStream(rgb, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: SIDE,
    Height: SIDE,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
  });
  const ref = doc.context.register(stream);
  const page = doc.addPage([612, 792]);
  page.node.setXObject(PDFName.of('Chart'), ref);
  // 2 inches wide: 300 dpi, so the ebook preset downsamples the JPEG candidate.
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(144, 0, 0, 144, 36, 600),
    drawObject('Chart'),
    popGraphicsState(),
  );
  return toBuffer(await doc.save());
}

let deps: CompressionDependencies;
beforeAll(() => {
  deps = {
    plumber: new QpdfPlumber({ wasmUrl: qpdfWasmUrl }),
    decoder: new PdfiumImageDecoder(wasmUrl),
    encoder: canvasEncoder,
  };
});
afterAll(() => undefined);

/** Byte equality as a boolean: a failed `toEqual` on hundreds of KB spends minutes on its diff. */
const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((value, at) => value === b[at]);

describe('the lossless candidate keeps fflate level 9 sizes', () => {
  it('encodeIndexed is the level-9 zlib of the palette indices, byte for byte', () => {
    for (const flat of [true, false]) {
      const rgba = paletteImage(40, flat);
      const colours = palette(rgba) as number[];
      expect(colours.length).toBe(40);
      const encoded = encodeIndexed(rgba, colours);
      const index = new Map(colours.map((rgb, i) => [rgb, i]));
      const indices = new Uint8Array(SIDE * SIDE);
      for (let p = 0; p < indices.length; p++) {
        const rgb =
          ((rgba[p * 4] as number) << 16) |
          ((rgba[p * 4 + 1] as number) << 8) |
          (rgba[p * 4 + 2] as number);
        indices[p] = index.get(rgb) ?? 0;
      }
      expect(same(encoded.data, zlibSync(indices, { level: 9 }))).toBe(true);
    }
  });

  it('encodeGray is the level-9 zlib of the samples, byte for byte', () => {
    const rgba = new Uint8ClampedArray(SIDE * SIDE * 4);
    const next = lcg(3);
    const samples = new Uint8Array(SIDE * SIDE);
    for (let p = 0; p < samples.length; p++) {
      const v = (next() % 24) * 10;
      samples[p] = v;
      rgba.set([v, v, v, 255], p * 4);
    }
    expect(same(encodeGray(rgba), zlibSync(samples, { level: 9 }))).toBe(true);
  });
});

describe('the pick between the palette and the JPEG, as on develop', () => {
  it('a chart of 40 flat colours stays a lossless palette', async () => {
    const result = await compressPdf(
      await pdfWith(paletteImage(40, true)),
      presetSettings('ebook'),
      deps,
    );
    expect(result.images[0]).toMatchObject({ encoding: 'flate-indexed' });
  });

  it('a noisy 40-colour image (indices that do not compress) goes to the JPEG', async () => {
    const result = await compressPdf(
      await pdfWith(paletteImage(40, false)),
      presetSettings('ebook'),
      deps,
    );
    expect(result.images[0]).toMatchObject({ encoding: 'jpeg' });
  });
});
