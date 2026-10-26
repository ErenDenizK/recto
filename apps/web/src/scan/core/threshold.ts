/**
 * Bradley adaptive threshold (plan bm-scan-plan §2 "Filters and encoding", the B/W filter): a pixel
 * turns black when it is `t` (a fraction) darker than the mean of its window, taken from an
 * integral image so the cost does not grow with the window. Returns 0 (ink) or 255 (paper).
 */
export function bradleyThreshold(
  luma: Uint8Array,
  width: number,
  height: number,
  windowSize = Math.max(8, width >> 3),
  t = 0.15,
): Uint8Array {
  const w1 = width + 1;
  const integral = new Float64Array(w1 * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += luma[y * width + x] ?? 0;
      integral[(y + 1) * w1 + x + 1] = (integral[y * w1 + x + 1] ?? 0) + row;
    }
  }
  const half = windowSize >> 1;
  const out = new Uint8Array(luma.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const sum =
        (integral[y1 * w1 + x1] ?? 0) -
        (integral[y0 * w1 + x1] ?? 0) -
        (integral[y1 * w1 + x0] ?? 0) +
        (integral[y0 * w1 + x0] ?? 0);
      const count = (x1 - x0) * (y1 - y0);
      out[y * width + x] = (luma[y * width + x] ?? 0) * count <= sum * (1 - t) ? 0 : 255;
    }
  }
  return out;
}
