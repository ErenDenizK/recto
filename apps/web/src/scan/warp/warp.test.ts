/**
 * The scan warp in a real browser (Vitest's Chromium, WebGL2 on SwiftShader): the GPU and CPU
 * paths agree on a checkerboard, the filters shape the histogram the way the plan says
 * (§2 "Filters and encoding"), and the page comes out upright.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  applyFilter,
  homographyFor,
  processCpu,
  type Quad,
  type Raster,
  type ScanFilter,
  warpCpu,
} from './cpu';
import { GlWarp } from './gl';

const W = 800;
const H = 600;
const CHECK = 100;

/** An 8 x 6 board of 100 px checks, 40 and 220, with the top left check dark. */
function board(): Raster {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = (Math.floor(x / CHECK) + Math.floor(y / CHECK)) % 2 === 0 ? 40 : 220;
      data.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return { data, width: W, height: H };
}

/** A warm sheet with dark text lines and uneven light, for the filters. */
function sheet(): Raster {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ink = y % 30 < 6 && x > 60 && x < 740;
      const shade = 1 - 0.1 * (x / W);
      const [r, g, b]: readonly [number, number, number] = ink ? [50, 45, 40] : [210, 190, 150];
      data.set([r * shade, g * shade, b * shade, 255], (y * W + x) * 4);
    }
  }
  return { data, width: W, height: H };
}

const bitmapOf = (r: Raster) => createImageBitmap(new ImageData(r.data, r.width, r.height));

function pixelsOf(canvas: OffscreenCanvas): Raster {
  const copy = new OffscreenCanvas(canvas.width, canvas.height);
  const ctx = copy.getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(canvas, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}

const histogram = (r: Raster) => {
  const h = new Uint32Array(256);
  for (let i = 0; i < r.data.length; i += 4) {
    const v = Math.round(r.data[i] as number);
    h[v] = (h[v] as number) + 1;
  }
  return h;
};

/** A tilted, foreshortened region of the board, out at 600 x 400. */
const QUAD: Quad = [
  { x: 110, y: 90 },
  { x: 690, y: 130 },
  { x: 650, y: 520 },
  { x: 90, y: 480 },
];
const OUT_W = 600;
const OUT_H = 400;

let gl: GlWarp | null;
const glOrThrow = (): GlWarp => {
  if (!gl) throw new Error('WebGL2 is not available');
  return gl;
};

beforeAll(() => {
  gl = GlWarp.create();
});

describe('perspective warp', () => {
  it('the homography lands the corners on the quad', () => {
    const m = homographyFor(QUAD, OUT_W, OUT_H);
    const at = (x: number, y: number) => {
      const z = (m[6] as number) * x + (m[7] as number) * y + (m[8] as number);
      return [
        ((m[0] as number) * x + (m[1] as number) * y + (m[2] as number)) / z,
        ((m[3] as number) * x + (m[4] as number) * y + (m[5] as number)) / z,
      ];
    };
    expect(at(0, 0)).toEqual([expect.closeTo(110, 3), expect.closeTo(90, 3)]);
    expect(at(OUT_W, OUT_H)).toEqual([expect.closeTo(650, 3), expect.closeTo(520, 3)]);
  });

  it('puts the top left of the page at the top left of the output', () => {
    const square: Quad = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ];
    const out = warpCpu(board(), homographyFor(square, 100, 100), 100, 100);
    const px = (x: number, y: number) => out.data[(y * 100 + x) * 4] as number;
    expect(px(10, 10)).toBeLessThan(80); // dark check
    expect(px(90, 10)).toBeGreaterThan(180); // light check to its right
    expect(px(10, 90)).toBeGreaterThan(180); // light check below
  });

  it('GPU and CPU agree on a checkerboard', async () => {
    expect(gl).not.toBeNull();
    const source = board();
    const cpu = processCpu(source, QUAD, OUT_W, OUT_H, 'photo');
    const gpu = pixelsOf(glOrThrow().render(await bitmapOf(source), QUAD, OUT_W, OUT_H, 'photo'));
    let sum = 0;
    let far = 0;
    for (let i = 0; i < cpu.data.length; i += 4) {
      const d = Math.abs((cpu.data[i] as number) - (gpu.data[i] as number));
      sum += d;
      if (d > 24) far++;
    }
    const pixels = OUT_W * OUT_H;
    expect(sum / pixels).toBeLessThan(2); // mean absolute error, of 255
    expect(far / pixels).toBeLessThan(0.01); // only the check edges may differ
  });
});

describe.each(['cpu', 'gpu'] as const)('filters (%s)', (engine) => {
  const run = async (filter: ScanFilter): Promise<Raster> => {
    const source = sheet();
    if (engine === 'cpu') return processCpu(source, QUAD, OUT_W, OUT_H, filter);
    expect(gl).not.toBeNull();
    return pixelsOf(glOrThrow().render(await bitmapOf(source), QUAD, OUT_W, OUT_H, filter));
  };
  const PAPER_AT = (200 * OUT_W + 300) * 4; // between text lines

  it('Photo keeps the colours', async () => {
    const out = await run('photo');
    const i = PAPER_AT;
    expect(out.data[i] as number).toBeGreaterThan(out.data[i + 1] as number);
    expect(out.data[i + 1] as number).toBeGreaterThan(out.data[i + 2] as number);
  });

  it('Colour whitens the paper and keeps the ink dark', async () => {
    const out = await run('colour');
    const h = histogram(out);
    const total = OUT_W * OUT_H;
    let light = 0;
    for (let v = 215; v < 256; v++) light += h[v] as number;
    expect(light / total).toBeGreaterThan(0.6);
    let dark = 0;
    for (let v = 0; v < 90; v++) dark += h[v] as number;
    expect(dark / total).toBeGreaterThan(0.05);
    const i = PAPER_AT;
    expect(Math.abs((out.data[i] as number) - (out.data[i + 2] as number))).toBeLessThan(12); // tint gone
  });

  it('Greyscale has equal channels', async () => {
    const out = await run('greyscale');
    for (let i = 0; i < out.data.length; i += 4 * 97) {
      expect(Math.abs((out.data[i] as number) - (out.data[i + 1] as number))).toBeLessThanOrEqual(
        2,
      );
      expect(
        Math.abs((out.data[i + 1] as number) - (out.data[i + 2] as number)),
      ).toBeLessThanOrEqual(2);
    }
  });

  it('B/W is two-valued, mostly paper, with ink', async () => {
    const h = histogram(await run('bw'));
    const total = OUT_W * OUT_H;
    expect(((h[0] as number) + (h[255] as number)) / total).toBeGreaterThan(0.99);
    expect((h[255] as number) / total).toBeGreaterThan(0.6);
    expect((h[0] as number) / total).toBeGreaterThan(0.05);
  });
});

describe('applyFilter', () => {
  it('leaves Photo untouched', () => {
    const r = sheet();
    const before = r.data.slice();
    applyFilter(r, 'photo');
    expect(r.data).toEqual(before);
  });
});
