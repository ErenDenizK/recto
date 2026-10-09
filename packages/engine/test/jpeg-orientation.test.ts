/**
 * M1-b: a camera JPEG inserted as a page shows upright, as the browser shows the file, for every
 * EXIF orientation (1–8), and its bytes go into the PDF as they are (no re-encode). The
 * reference is the browser's own decode (`createImageBitmap`, which applies EXIF); the page is
 * rendered by PDFium. Images without an orientation are drawn exactly as before.
 */
import { PDFDocument, PDFRawStream } from '@cantoo/pdf-lib';
import type { BlobId } from '@pdf-editor/document-model';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  type ExifOrientation,
  jpegInfo,
  orientedImageMatrix,
  uprightSize,
} from '../src/images/jpeg-orientation';
import { PdfiumAdapter } from '../src/pdfium/pdfium-adapter';
import { PdfLibAssembler } from '../src/pdflib/pdflib-assembler';
import { makePdf, sid, vdoc, vpage, wasmUrl } from './helpers';

const W = 120;
const H = 80;

/**
 * A W × H JPEG, white with a red block in the stored top-left corner and a blue one in the
 * stored bottom-left, carrying `orientation` in an EXIF APP1 segment (big-endian TIFF).
 */
async function cameraJpeg(orientation: ExifOrientation): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(W, H);
  const g = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ff0000';
  g.fillRect(0, 0, W / 3, H / 3);
  g.fillStyle = '#0000ff';
  g.fillRect(0, (2 * H) / 3, W / 3, H / 3);
  const plain = new Uint8Array(
    await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 })).arrayBuffer(),
  );
  // APP1: "Exif\0\0", TIFF "MM" 42, IFD0 at 8 with one entry (0x0112 SHORT 1 = orientation).
  const tiff = [
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08,
    0x00,
    0x01,
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
    0x00,
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = payload.length + 2;
  const app1 = [0xff, 0xe1, length >> 8, length & 0xff, ...payload];
  const out = new Uint8Array(plain.length + app1.length);
  out.set(plain.subarray(0, 2), 0);
  out.set(app1, 2);
  out.set(plain.subarray(2), 2 + app1.length);
  return out;
}

type Colour = 'red' | 'blue' | 'white';

function classify(r: number, g: number, b: number): Colour {
  if (r > 180 && g < 90 && b < 90) return 'red';
  if (b > 180 && r < 90 && g < 90) return 'blue';
  return 'white';
}

/** The colour at the centres of a 3 × 3 grid over an RGBA image, row by row. */
function grid(data: Uint8ClampedArray, width: number, height: number): Colour[] {
  const out: Colour[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = Math.floor(((col + 0.5) * width) / 3);
      const y = Math.floor(((row + 0.5) * height) / 3);
      const at = (y * width + x) * 4;
      out.push(classify(data[at] as number, data[at + 1] as number, data[at + 2] as number));
    }
  }
  return out;
}

/** How the browser shows the file (EXIF applied). */
async function browserView(bytes: Uint8Array): Promise<Colour[]> {
  const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: 'image/jpeg' }), {
    imageOrientation: 'from-image',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const g = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  return grid(g.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}

let adapter: PdfiumAdapter;
beforeAll(() => {
  adapter = new PdfiumAdapter({ wasmUrl });
});
afterAll(async () => {
  await adapter.destroy();
});

/** Assembles one image page of the upright size and renders it with PDFium. */
async function pageView(bytes: Uint8Array): Promise<{ colours: Colour[]; pdf: ArrayBuffer }> {
  const info = jpegInfo(bytes);
  if (!info) throw new Error('not a JPEG');
  const size = uprightSize(info);
  const blob = 'photo' as BlobId;
  const { bytes: pdf } = await new PdfLibAssembler().assemble({
    document: vdoc([vpage({ kind: 'image', blob, size })]),
    sources: new Map(),
    blobs: new Map([[blob, bytes.slice().buffer]]),
  });
  const id = sid(`photo-${info.orientation}`);
  await adapter.open(id, pdf.slice(0));
  const render = await adapter.renderPage(id, 0, { scale: 1 });
  await adapter.close(id);
  const canvas = new OffscreenCanvas(render.width, render.height);
  const g = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  g.drawImage(render.bitmap, 0, 0);
  render.bitmap.close();
  return {
    colours: grid(
      g.getImageData(0, 0, render.width, render.height).data,
      render.width,
      render.height,
    ),
    pdf,
  };
}

/** Places the JPEG as an image stamp filling a page of its upright size; renders the page. */
async function stampView(bytes: Uint8Array): Promise<Colour[]> {
  const info = jpegInfo(bytes);
  if (!info) throw new Error('not a JPEG');
  const { width, height } = uprightSize(info);
  const id = sid(`stamp-${info.orientation}`);
  await adapter.open(id, await makePdf([{ size: [width, height] }]));
  await adapter.createAnnotation(id, {
    kind: 'stamp',
    pageIndex: 0,
    rect: { x: 0, y: 0, width, height },
    imageBlob: new Blob([bytes.slice()], { type: 'image/jpeg' }),
  });
  const render = await adapter.renderPage(id, 0, { scale: 1 });
  await adapter.close(id);
  const canvas = new OffscreenCanvas(render.width, render.height);
  const g = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  g.drawImage(render.bitmap, 0, 0);
  render.bitmap.close();
  return grid(g.getImageData(0, 0, render.width, render.height).data, render.width, render.height);
}

describe('EXIF orientation (M1-b)', () => {
  test('jpegInfo reads the stored size and the orientation', async () => {
    for (const orientation of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      const info = jpegInfo(await cameraJpeg(orientation));
      expect(info).toEqual({ width: W, height: H, orientation });
      expect(uprightSize(info!)).toEqual(
        orientation >= 5 ? { width: H, height: W } : { width: W, height: H },
      );
    }
    expect(jpegInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeUndefined();
    expect(orientedImageMatrix(1, 10, 20, 30, 40)).toEqual([30, 0, 0, 40, 10, 20]);
  });

  test.each([1, 2, 3, 4, 5, 6, 7, 8] as const)(
    'orientation %i: the page shows what the browser shows, from the same JPEG bytes',
    async (orientation) => {
      const jpeg = await cameraJpeg(orientation);
      const expected = await browserView(jpeg);
      // The browser really turned it (the test is not vacuous): red is where EXIF puts it.
      expect(expected.filter((c) => c === 'red')).toHaveLength(1);
      const { colours, pdf } = await pageView(jpeg);
      expect(colours).toEqual(expected);
      // The JPEG went in as it is: its stream holds the file's bytes, EXIF and all.
      const doc = await PDFDocument.load(pdf, { updateMetadata: false });
      const streams = doc.context
        .enumerateIndirectObjects()
        .map(([, object]) => object)
        .filter((object): object is PDFRawStream => object instanceof PDFRawStream);
      expect(
        streams.some(
          (s) => s.contents.length === jpeg.length && s.contents.every((b, i) => b === jpeg[i]),
        ),
      ).toBe(true);
    },
  );

  test.each([1, 3, 6, 8, 5] as const)(
    'orientation %i: an image stamp shows what the browser shows',
    async (orientation) => {
      const jpeg = await cameraJpeg(orientation);
      expect(await stampView(jpeg)).toEqual(await browserView(jpeg));
    },
  );
});
