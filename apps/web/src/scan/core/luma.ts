/**
 * Luma, blur and sharpness for the scan detector (plan bm-scan-plan §2 "Edge detection", step 1).
 * Pure typed-array code with no DOM, so it runs in the scan worker and in unit tests alike.
 */

/** The pixels of a frame, shaped like the DOM `ImageData` (RGBA, row-major). */
export interface Frame {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

/** Rec. 601 luma of an RGBA frame, one byte per pixel. */
export function toLuma(frame: Frame): Uint8Array {
  const { data, width, height } = frame;
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = ((data[p] ?? 0) * 77 + (data[p + 1] ?? 0) * 150 + (data[p + 2] ?? 0) * 29) >> 8;
  }
  return out;
}

/** One 1 4 6 4 1 pass over `count` samples `stride` apart, edges clamped. */
function blurLine(
  src: Uint8Array,
  dst: Uint8Array,
  start: number,
  stride: number,
  count: number,
): void {
  const last = start + (count - 1) * stride;
  const at = (i: number) => src[Math.min(last, Math.max(start, i))] ?? 0;
  for (let k = 0; k < count; k++) {
    const i = start + k * stride;
    dst[i] =
      k >= 2 && k < count - 2
        ? ((src[i - 2 * stride] ?? 0) +
            4 * (src[i - stride] ?? 0) +
            6 * (src[i] ?? 0) +
            4 * (src[i + stride] ?? 0) +
            (src[i + 2 * stride] ?? 0) +
            8) >>
          4
        : (at(i - 2 * stride) +
            4 * at(i - stride) +
            6 * at(i) +
            4 * at(i + stride) +
            at(i + 2 * stride) +
            8) >>
          4;
  }
}

/** A 5-tap separable Gaussian (1 4 6 4 1 / 16) with clamped edges; sigma is about 1. */
export function gaussianBlur(src: Uint8Array, width: number, height: number): Uint8Array {
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  for (let y = 0; y < height; y++) blurLine(src, tmp, y * width, 1, width);
  for (let x = 0; x < width; x++) blurLine(tmp, out, x, width, height);
  return out;
}

/**
 * Variance of the 4-neighbour Laplacian: high on a sharp frame, near zero on a blurred one.
 * The auto-capture gate (plan §2 "sharpness passes") reads it.
 */
export function sharpness(luma: Uint8Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const l =
        4 * (luma[i] ?? 0) -
        (luma[i - 1] ?? 0) -
        (luma[i + 1] ?? 0) -
        (luma[i - width] ?? 0) -
        (luma[i + width] ?? 0);
      sum += l;
      sumSq += l * l;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}
