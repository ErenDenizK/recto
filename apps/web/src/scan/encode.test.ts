/**
 * Scan page output: sizing under the canvas cap (plan §2 "Memory on iPhone"), JPEG encoding,
 * and the CPU worker taking over when the WebGL2 context is lost.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { fitOutput, MAX_PIXELS, pageSize, type Quad, Scanner } from './encode';
import { GlWarp } from './warp/gl';

const rect = (w: number, h: number): Quad => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: h },
  { x: 0, y: h },
];

async function frame(): Promise<ImageBitmap> {
  const canvas = new OffscreenCanvas(400, 300);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(0, 0, 400, 300);
  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, 200, 150);
  return createImageBitmap(canvas);
}

async function topLeftLuma(blob: Blob): Promise<number> {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(20, 20, 1, 1).data[0] as number;
}

const scanners: Scanner[] = [];
afterEach(() => {
  for (const s of scanners.splice(0)) s.dispose();
});

describe('output size', () => {
  it('snaps a near-A4 quad to A4 at the long side', () => {
    const { width, height } = pageSize(rect(1000, 1450));
    expect(height).toBe(3000);
    expect(width).toBe(Math.round(3000 / Math.SQRT2));
  });

  it('snaps a near-Letter landscape quad to Letter', () => {
    const { width, height } = pageSize(rect(1100, 850), 2400);
    expect(width).toBe(2400);
    expect(height).toBe(Math.round((2400 * 8.5) / 11));
  });

  it('keeps an odd aspect as it is', () => {
    expect(pageSize(rect(1000, 1000)).width).toBe(3000);
  });

  it('never exceeds 16.7 Mpx', () => {
    for (const [w, h] of [
      [5000, 4000],
      [9000, 100],
      [4096, 4096],
    ] as const) {
      const out = fitOutput(w, h);
      expect(out.width * out.height).toBeLessThanOrEqual(MAX_PIXELS);
    }
    const huge = pageSize(rect(1000, 1000), 9000);
    expect(huge.width * huge.height).toBeLessThanOrEqual(MAX_PIXELS);
  });
});

describe('Scanner', () => {
  it('encodes a JPEG on the GPU', async () => {
    const gl = GlWarp.create();
    expect(gl).not.toBeNull();
    const scanner = new Scanner(gl);
    scanners.push(scanner);
    const result = await scanner.page(await frame(), rect(400, 300), {
      filter: 'photo',
      longSide: 400,
    });
    expect(result.engine).toBe('gpu');
    expect(result.blob.type).toBe('image/jpeg');
    expect(result.width * result.height).toBeLessThanOrEqual(MAX_PIXELS);
    expect(await topLeftLuma(result.blob)).toBeLessThan(80);
  });

  it('falls to the CPU worker on a lost context, and stays there', async () => {
    const gl = GlWarp.create();
    if (!gl) throw new Error('WebGL2 is not available');
    const scanner = new Scanner(gl);
    scanners.push(scanner);
    gl.loseContext();
    const first = await scanner.page(await frame(), rect(400, 300), {
      filter: 'photo',
      longSide: 400,
    });
    expect(first.engine).toBe('cpu');
    expect(first.blob.type).toBe('image/jpeg');
    expect(await topLeftLuma(first.blob)).toBeLessThan(80);
    const second = await scanner.page(await frame(), rect(400, 300), {
      filter: 'bw',
      longSide: 400,
    });
    expect(second.engine).toBe('cpu');
  });

  it('uses the CPU worker when WebGL2 is missing', async () => {
    const scanner = new Scanner(null);
    scanners.push(scanner);
    const result = await scanner.page(await frame(), rect(400, 300), {
      filter: 'greyscale',
      longSide: 400,
    });
    expect(result.engine).toBe('cpu');
  });
});
