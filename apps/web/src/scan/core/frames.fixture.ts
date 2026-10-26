/**
 * Synthetic camera frames for the scan detector tests (plan bm-scan-plan §4, lane L1): a page quad
 * drawn on a noisy desk, with a few ruled lines on the page. Deterministic (seeded), pure
 * computation, no real documents. `detect.test.ts` renders these in memory, so there is nothing
 * to commit. It lives beside the tests, not under `tools/fixtures/scan/`, because the fixtures
 * tool's tsconfig lists its folders and ESLint would not parse a new one.
 */
import { at } from './contour';

export interface Point {
  x: number;
  y: number;
}

export interface SceneSpec {
  width: number;
  height: number;
  /** The page corners in pixels, clockwise from the top-left; may lie outside the frame (a cropped page). */
  corners: [Point, Point, Point, Point];
  /** Grey levels, 0..255. */
  pageTone: number;
  deskTone: number;
  /** Standard deviation of the per-pixel sensor noise, in grey levels. */
  noise: number;
  seed: number;
}

export interface SceneFrame {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/** mulberry32: a small seeded generator, so a frame is the same on every run. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inside(c: readonly Point[], x: number, y: number): boolean {
  for (let i = 0; i < c.length; i++) {
    const a = at(c, i);
    const b = at(c, (i + 1) % c.length);
    if ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) < 0) return false;
  }
  return true;
}

/** Page coverage of a pixel, from a 3 × 3 grid of samples (soft edges, as a lens gives). */
function coverage(c: readonly Point[], x: number, y: number): number {
  let n = 0;
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      if (inside(c, x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) n++;
    }
  }
  return n / 9;
}

export function renderScene(spec: SceneSpec): SceneFrame {
  const { width, height, corners, pageTone, deskTone, noise, seed } = spec;
  const rand = random(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const data = new Uint8ClampedArray(width * height * 4);
  // Ruled lines run along the page's top edge direction, so they tilt with it.
  const [top, right, , left] = corners;
  const ux = right.x - top.x;
  const uy = right.y - top.y;
  const vx = left.x - top.x;
  const vy = left.y - top.y;
  const det = ux * vy - uy * vx;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cov = coverage(corners, x, y);
      let tone = deskTone + (pageTone - deskTone) * cov;
      if (cov === 1) {
        // Page coordinates (s along the top edge, t down the left edge), 0..1.
        const s = ((x - top.x) * vy - (y - top.y) * vx) / det;
        const t = (ux * (y - top.y) - uy * (x - top.x)) / det;
        const line = (t * 14) % 1;
        if (s > 0.1 && s < 0.9 && t > 0.1 && t < 0.9 && line < 0.12)
          tone -= (pageTone - deskTone) * 0.5;
      }
      const i = (y * width + x) * 4;
      for (let ch = 0; ch < 3; ch++) data[i + ch] = tone + gauss() * noise;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

/** A page tilted by `degrees` about `center`, `w` × `h` px, corners clockwise from the top-left. */
export function tiltedPage(
  center: Point,
  w: number,
  h: number,
  degrees: number,
): SceneSpec['corners'] {
  const r = (degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const at = (dx: number, dy: number): Point => ({
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  });
  return [at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)];
}

/** Sutherland-Hodgman clip of a convex polygon to the frame: what a cropped page leaves visible. */
export function clipToFrame(poly: readonly Point[], width: number, height: number): Point[] {
  const planes: ((p: Point) => number)[] = [
    (p) => p.x,
    (p) => width - p.x,
    (p) => p.y,
    (p) => height - p.y,
  ];
  let out = [...poly];
  for (const d of planes) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = at(input, i);
      const b = at(input, (i + 1) % input.length);
      const da = d(a);
      const db = d(b);
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) {
        const k = da / (da - db);
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
      }
    }
  }
  return out;
}
