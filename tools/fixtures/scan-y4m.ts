/**
 * A fake camera feed for the scan's e2e (plan bm-scan-plan §4 "e2e setup"): a white page, tilted
 * about 8 degrees, with grey text lines on a dark desk. The output is a YUV4MPEG2 file (a text
 * header, then raw I420 frames), the format Chromium's `--use-file-for-fake-video-capture` reads,
 * so no tool is needed. Deterministic: the same bytes every run, no real document.
 *
 *   node --experimental-strip-types tools/fixtures/scan-y4m.ts <out.y4m>
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SCAN_Y4M = { width: 640, height: 480, frames: 10, fps: 10 } as const;

const DESK = 40;
const PAPER = 235;
const INK = 70;
/** The page's size and tilt, as a share of the frame; the corners are known to the tests. */
const PAGE = { halfWidth: 150, halfHeight: 200, tilt: (8 * Math.PI) / 180 };

/** The page's corners in pixels, top left first, clockwise. */
export function scanPageCorners(): readonly { x: number; y: number }[] {
  const { width, height } = SCAN_Y4M;
  const { halfWidth: hw, halfHeight: hh, tilt } = PAGE;
  const [cos, sin] = [Math.cos(tilt), Math.sin(tilt)];
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x = 0, y = 0]) => ({
    x: width / 2 + x * cos - y * sin,
    y: height / 2 + x * sin + y * cos,
  }));
}

/** One luma plane: desk with a faint grain, the page, and ruled text lines on it. */
function luma(): Uint8Array {
  const { width, height } = SCAN_Y4M;
  const { halfWidth: hw, halfHeight: hh, tilt } = PAGE;
  const [cos, sin] = [Math.cos(tilt), Math.sin(tilt)];
  const plane = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // The pixel in the page's own frame (rotate back by the tilt).
      const dx = x - width / 2;
      const dy = y - height / 2;
      const u = dx * cos + dy * sin;
      const v = -dx * sin + dy * cos;
      let value = DESK + ((x * 7 + y * 13) % 5);
      if (Math.abs(u) <= hw && Math.abs(v) <= hh) {
        value = PAPER;
        const line = Math.floor((v + hh - 24) / 16);
        const onLine = line >= 0 && line < 20 && (v + hh - 24) % 16 < 4;
        if (onLine && Math.abs(u) < hw - 20 && !(line % 5 === 4 && u > 0)) value = INK;
      }
      plane[y * width + x] = value;
    }
  }
  return plane;
}

/** The whole file as bytes. */
export function scanPageY4m(): Buffer {
  const { width, height, frames, fps } = SCAN_Y4M;
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F${fps}:1 Ip A1:1 C420jpeg\n`);
  const y = luma();
  const chroma = new Uint8Array((width / 2) * (height / 2)).fill(128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), y, chroma, chroma]);
  return Buffer.concat([header, ...Array.from({ length: frames }, () => frame)]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) throw new Error('usage: scan-y4m.ts <out.y4m>');
  writeFileSync(out, scanPageY4m());
}
