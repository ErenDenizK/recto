/**
 * Scan warp, the CPU path (big move 1, plan §2 "Perspective warp": bilinear, in a worker). It
 * takes over when WebGL2 is missing or its context is lost. Same maths as `gl.ts`: the
 * homography maps an output pixel centre to the source, texels sit on half pixels, edges clamp.
 * Run as a module worker by `../encode.ts`; the pure functions are also imported directly.
 */
import {
  BLACK_CEILING,
  BLACK_PERCENTILE,
  BW_THRESHOLD,
  BW_WINDOW_DIVISOR,
  LUMA,
  PAPER_FLOOR,
  PAPER_PERCENTILE,
  THUMB_WIDTH,
} from './shaders';

export type ScanFilter = 'photo' | 'colour' | 'greyscale' | 'bw';
export interface Point {
  x: number;
  y: number;
}
/** Source-pixel corners: top left, top right, bottom right, bottom left. */
export type Quad = readonly [Point, Point, Point, Point];
/** A row-major 3x3 matrix as nine numbers. */
export type Matrix9 = readonly number[];
export interface Raster {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}
/** What the colour filters take from the page: per-channel gain and a black point (0..1). */
export interface ColourParams {
  gain: [number, number, number];
  lo: number;
}

/** The homography taking output pixel coordinates (0..w, 0..h) to the quad in the source. */
export function homographyFor(quad: Quad, w: number, h: number): Matrix9 {
  const from = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ] as const;
  // Unknowns h0..h7 (h8 = 1); two rows per corner.
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i] as readonly [number, number];
    const { x: u, y: v } = quad[i] as Point;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) {
      if (Math.abs((a[r] as number[])[c] as number) > Math.abs((a[p] as number[])[c] as number))
        p = r;
    }
    const pivotRow = a[p] as number[];
    a[p] = a[c] as number[];
    a[c] = pivotRow;
    const pivot = pivotRow[c] as number;
    if (Math.abs(pivot) < 1e-12) throw new Error('degenerate quad');
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const row = a[r] as number[];
      const f = (row[c] as number) / pivot;
      for (let k = c; k < 9; k++) row[k] = (row[k] as number) - f * (pivotRow[k] as number);
    }
  }
  return [...a.map((row, i) => (row[8] as number) / (row[i] as number)), 1];
}

/** Bilinear warp of `src` through `H` into a `w` x `h` raster. */
export function warpCpu(src: Raster, H: Matrix9, w: number, h: number): Raster {
  const out = new Uint8ClampedArray(w * h * 4);
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = H as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const sw = src.width;
  const sh = src.height;
  const s = src.data;
  let o = 0;
  for (let y = 0; y < h; y++) {
    const py = y + 0.5;
    for (let x = 0; x < w; x++, o += 4) {
      const px = x + 0.5;
      const z = h6 * px + h7 * py + h8;
      const fx = Math.min(Math.max((h0 * px + h1 * py + h2) / z - 0.5, 0), sw - 1);
      const fy = Math.min(Math.max((h3 * px + h4 * py + h5) / z - 0.5, 0), sh - 1);
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const tx = fx - x0;
      const ty = fy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = (y0 * sw + x1) * 4;
      const i01 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      for (let k = 0; k < 3; k++) {
        const top = (s[i00 + k] as number) * (1 - tx) + (s[i10 + k] as number) * tx;
        const bottom = (s[i01 + k] as number) * (1 - tx) + (s[i11 + k] as number) * tx;
        out[o + k] = top * (1 - ty) + bottom * ty;
      }
      out[o + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

const luma = (r: number, g: number, b: number) => LUMA[0] * r + LUMA[1] * g + LUMA[2] * b;

function percentile(hist: Uint32Array, total: number, q: number): number {
  const target = q * total;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += hist[i] as number;
    if (sum >= target) return i;
  }
  return 255;
}

/** Paper white balance and levels from a small RGBA sample of the page (plan §2, Colour). */
export function colourParams(rgba: ArrayLike<number>): ColourParams {
  const n = rgba.length / 4;
  const channels = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const hist = channels[k] as Uint32Array;
      const v = rgba[i * 4 + k] as number;
      hist[v] = (hist[v] as number) + 1;
    }
  }
  const gain = channels.map(
    (hist) => 255 / Math.max(percentile(hist, n, PAPER_PERCENTILE), PAPER_FLOOR),
  ) as [number, number, number];
  const lumas = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const v = (k: number) => Math.min((rgba[i * 4 + k] as number) * (gain[k] as number), 255);
    const l = Math.round(luma(v(0), v(1), v(2)));
    lumas[l] = (lumas[l] as number) + 1;
  }
  const lo = Math.min(percentile(lumas, n, BLACK_PERCENTILE) / 255, BLACK_CEILING);
  return { gain, lo };
}

/** A stride-sampled copy of `r`, about `THUMB_WIDTH` px wide, for the statistics. */
function thumbnail(r: Raster): Uint8ClampedArray {
  const step = Math.max(1, Math.floor(r.width / THUMB_WIDTH));
  const out: number[] = [];
  for (let y = 0; y < r.height; y += step) {
    for (let x = 0; x < r.width; x += step) {
      const i = (y * r.width + x) * 4;
      out.push(r.data[i] as number, r.data[i + 1] as number, r.data[i + 2] as number, 255);
    }
  }
  return Uint8ClampedArray.from(out);
}

/** Applies the page filter to `r` in place. */
export function applyFilter(r: Raster, filter: ScanFilter): Raster {
  const d = r.data;
  const { width: w, height: h } = r;
  const n = w * h;
  if (filter === 'colour' || filter === 'greyscale') {
    const { gain, lo } = colourParams(thumbnail(r));
    const span = 1 - lo;
    for (let i = 0; i < n; i++) {
      const c = [0, 1, 2].map((k) => {
        const g = Math.min(((d[i * 4 + k] as number) * (gain[k] as number)) / 255, 1);
        return Math.min(Math.max((g - lo) / span, 0), 1) * 255;
      }) as [number, number, number];
      const grey = luma(...c);
      for (let k = 0; k < 3; k++) d[i * 4 + k] = filter === 'greyscale' ? grey : (c[k] as number);
    }
  } else if (filter === 'bw') {
    const radius = Math.max(2, Math.round(Math.max(w, h) / BW_WINDOW_DIVISOR));
    // Integral image of luma, one extra row and column of zeros.
    const stride = w + 1;
    const integral = new Float64Array(stride * (h + 1));
    const grey = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const l = luma(d[i * 4] as number, d[i * 4 + 1] as number, d[i * 4 + 2] as number);
        grey[i] = l;
        row += l;
        integral[(y + 1) * stride + x + 1] = (integral[y * stride + x + 1] as number) + row;
      }
    }
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(y - radius, 0);
      const y1 = Math.min(y + radius + 1, h);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(x - radius, 0);
        const x1 = Math.min(x + radius + 1, w);
        const sum =
          (integral[y1 * stride + x1] as number) -
          (integral[y0 * stride + x1] as number) -
          (integral[y1 * stride + x0] as number) +
          (integral[y0 * stride + x0] as number);
        const mean = sum / ((x1 - x0) * (y1 - y0));
        const v = (grey[y * w + x] as number) < mean * (1 - BW_THRESHOLD) ? 0 : 255;
        const i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
    }
  }
  return r;
}

/** The whole CPU job: warp, then filter. */
export function processCpu(
  src: Raster,
  quad: Quad,
  w: number,
  h: number,
  filter: ScanFilter,
): Raster {
  return applyFilter(warpCpu(src, homographyFor(quad, w, h), w, h), filter);
}

export interface CpuJob {
  src: Raster;
  quad: Quad;
  width: number;
  height: number;
  filter: ScanFilter;
}

// Worker entry: a job in, the finished raster back (its buffer transferred).
if (typeof document === 'undefined' && typeof self !== 'undefined') {
  const scope = self as unknown as {
    onmessage: ((e: MessageEvent<CpuJob>) => void) | null;
    postMessage(message: unknown, transfer: Transferable[]): void;
  };
  scope.onmessage = (e) => {
    const { src, quad, width, height, filter } = e.data;
    const out = processCpu(src, quad, width, height, filter);
    scope.postMessage(out, [out.data.buffer]);
  };
}
