/**
 * Scan page output (big move 1, plan §2 "Perspective warp" output size, "Filters and encoding"
 * and "Memory on iPhone"): sizes the page, runs the warp on the GPU or, when that is missing,
 * lost or throws, on the CPU worker, and encodes a JPEG.
 *
 * Connecting it (L3): pass the corners `scan/core` finds, as source-pixel points ordered top
 * left, top right, bottom right, bottom left (`Quad`), and the frame as an `ImageBitmap`:
 * `await scanPage(bitmap, quad, { filter: 'colour' })`. The matrix `scan/core/homography`
 * solves is not needed; the warp solves its own (`homographyFor`, row-major `number[9]`, output
 * pixels to source pixels). The `blob` is a JPEG for `openImagesAsDocument`.
 */
import { GlWarp } from './warp/gl';
import type { CpuJob, Point, Quad, Raster, ScanFilter } from './warp/cpu';

export type { Point, Quad, ScanFilter };

/** One canvas holds at most this many pixels on iOS Safari (plan §2, "Memory on iPhone"). */
export const MAX_PIXELS = 16_777_216;
/** Long side of a page, px: 3,000 (2,400 on phones, passed by the caller). */
export const LONG_SIDE = 3000;
/** A quad's aspect snaps to A4 or Letter when it is within this share (plan §2). */
const SNAP = 0.03;
const PAPERS = [210 / 297, 8.5 / 11] as const;

export interface ScanOptions {
  filter: ScanFilter;
  /** Long side of the output, px. Default `LONG_SIDE`. */
  longSide?: number;
  /** JPEG quality, 0..1. Default 0.9. */
  quality?: number;
}
export interface ScanResult {
  blob: Blob;
  width: number;
  height: number;
  engine: 'gpu' | 'cpu';
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Scales `w` x `h` down, keeping the aspect, until it has at most `MAX_PIXELS` pixels. */
export function fitOutput(w: number, h: number): { width: number; height: number } {
  const k = w * h > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / (w * h)) : 1;
  return { width: Math.max(1, Math.floor(w * k)), height: Math.max(1, Math.floor(h * k)) };
}

/** The output size for a quad: its aspect, snapped to A4 or Letter, at `longSide`, capped. */
export function pageSize(quad: Quad, longSide = LONG_SIDE): { width: number; height: number } {
  const [tl, tr, br, bl] = quad;
  let aspect = (dist(tl, tr) + dist(bl, br)) / (dist(tl, bl) + dist(tr, br));
  const portrait = aspect < 1;
  const ratio = portrait ? aspect : 1 / aspect;
  const paper = PAPERS.find((p) => Math.abs(ratio - p) / p <= SNAP);
  if (paper) aspect = portrait ? paper : 1 / paper;
  const width = aspect >= 1 ? longSide : longSide * aspect;
  const height = aspect >= 1 ? longSide / aspect : longSide;
  return fitOutput(Math.round(width), Math.round(height));
}

/** JPEG bytes of a canvas. */
export async function encodeJpeg(canvas: OffscreenCanvas, quality = 0.9): Promise<Blob> {
  return canvas.convertToBlob({ type: 'image/jpeg', quality });
}

function rasterOf(source: ImageBitmap): Raster {
  const canvas = new OffscreenCanvas(source.width, source.height);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  ctx.drawImage(source, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
  canvas.width = 0;
  return { data, width, height };
}

/** One warp job at a time per scanner; the GPU is dropped for good once it fails. */
export class Scanner {
  private gl: GlWarp | null;
  private worker: Worker | null = null;

  constructor(gl: GlWarp | null = GlWarp.create()) {
    this.gl = gl;
  }

  async page(source: ImageBitmap, quad: Quad, options: ScanOptions): Promise<ScanResult> {
    const { width, height } = pageSize(quad, options.longSide);
    const quality = options.quality ?? 0.9;
    if (this.gl) {
      try {
        const canvas = this.gl.render(source, quad, width, height, options.filter);
        const blob = await encodeJpeg(canvas, quality);
        return { blob, width, height, engine: 'gpu' };
      } catch {
        // Lost context, unsupported size, GL error: the CPU path takes over for the session.
        this.gl = null;
      }
    }
    const raster = await this.runCpu(rasterOf(source), quad, width, height, options.filter);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.putImageData(new ImageData(raster.data, width, height), 0, 0);
    const blob = await encodeJpeg(canvas, quality);
    canvas.width = 0;
    return { blob, width, height, engine: 'cpu' };
  }

  private runCpu(
    src: Raster,
    quad: Quad,
    width: number,
    height: number,
    filter: ScanFilter,
  ): Promise<Raster> {
    this.worker ??= new Worker(new URL('./warp/cpu.ts', import.meta.url), {
      type: 'module',
      name: 'scan-warp',
    });
    const worker = this.worker;
    return new Promise((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<Raster>) => resolve(e.data);
      worker.onerror = (e) => reject(new Error(e.message));
      const job: CpuJob = { src, quad, width, height, filter };
      worker.postMessage(job, [src.data.buffer]);
    });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.gl = null;
  }
}
