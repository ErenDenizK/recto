/**
 * Sobel and Canny edges (plan bm-scan-plan §2 "Edge detection", step 2). The thresholds come from
 * the gradient histogram, so one frame's contrast sets its own limits.
 */

/** Gradient magnitude (|gx| + |gy|) and the direction bin: 0 horizontal, 1 diagonal, 2 vertical, 3 anti-diagonal. */
export interface Gradient {
  readonly mag: Uint16Array;
  readonly dir: Uint8Array;
}

/** Sobel over the interior; the 1 px frame border stays zero. */
export function sobel(luma: Uint8Array, width: number, height: number): Gradient {
  const mag = new Uint16Array(width * height);
  const dir = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const a = luma[i - width - 1] ?? 0;
      const b = luma[i - width] ?? 0;
      const c = luma[i - width + 1] ?? 0;
      const d = luma[i - 1] ?? 0;
      const f = luma[i + 1] ?? 0;
      const g = luma[i + width - 1] ?? 0;
      const h = luma[i + width] ?? 0;
      const k = luma[i + width + 1] ?? 0;
      const gx = c + 2 * f + k - a - 2 * d - g;
      const gy = g + 2 * h + k - a - 2 * b - c;
      const ax = Math.abs(gx);
      const ay = Math.abs(gy);
      mag[i] = ax + ay;
      if (ay <= ax * 0.4142) dir[i] = 0;
      else if (ay >= ax * 2.4142) dir[i] = 2;
      else dir[i] = gx > 0 === gy > 0 ? 1 : 3;
    }
  }
  return { mag, dir };
}

/**
 * High threshold: half the 99.5th percentile of the magnitudes (a page outline is under 1 % of
 * a frame, so the top half percent sits on it), never below `floor`, the noise level of a blurred
 * sensor. Low threshold: 0.4 of the high one.
 */
export function cannyThresholds(mag: Uint16Array, floor = 40): { low: number; high: number } {
  const hist = new Uint32Array(2048);
  for (const m of mag) {
    const bin = Math.min(2047, m);
    hist[bin] = (hist[bin] ?? 0) + 1;
  }
  const target = mag.length * 0.005;
  let seen = 0;
  let p = 2047;
  for (; p > 0; p--) {
    seen += hist[p] ?? 0;
    if (seen >= target) break;
  }
  const high = Math.max(floor, p * 0.5);
  return { low: high * 0.4, high };
}

const OFFSET = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
] as const;

/** Canny: non-maximum suppression, then hysteresis. Returns 1 on edge pixels. */
export function canny(luma: Uint8Array, width: number, height: number): Uint8Array {
  const { mag, dir } = sobel(luma, width, height);
  const { low, high } = cannyThresholds(mag);
  const state = new Uint8Array(width * height); // 0 none, 1 weak, 2 strong
  const stack: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const m = mag[i] ?? 0;
      if (m < low) continue;
      const [dx, dy] = OFFSET[dir[i] ?? 0] ?? OFFSET[0];
      const n = dy * width + dx;
      if (m < (mag[i + n] ?? 0) || m <= (mag[i - n] ?? 0)) continue;
      if (m >= high) {
        state[i] = 2;
        stack.push(i);
      } else state[i] = 1;
    }
  }
  const out = new Uint8Array(width * height);
  for (let i = stack.pop(); i !== undefined; i = stack.pop()) {
    out[i] = 1;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const j = i + dy * width + dx;
        if (state[j] === 1) {
          state[j] = 2;
          stack.push(j);
        }
      }
    }
  }
  return out;
}
