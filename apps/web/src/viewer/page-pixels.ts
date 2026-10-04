/**
 * Page pixels under a point, for the colour panel's eyedropper (`10-ink.md` §4.1, §4.4).
 *
 * The eyedropper samples the rendered page bitmap, not the screen: the pixels the engine
 * drew for the page (PDFium's render, annotations included), so the colour picked is the
 * PDF's colour on every browser, whatever the glass, the selection marks or the display
 * profile do to what is on screen. The system `EyeDropper` is never used.
 *
 * Pages are canvases (`pages/PageCanvas.tsx`) inside an element with `data-page-id` (the
 * Read view's page, a Pages-panel thumbnail); at high zoom, sharper tiles cover the visible
 * part (`pages/TiledPage.tsx`) and are preferred where they are drawn. A canvas maps a
 * client point to its own pixels by its on-screen box, so a stretched preview bitmap and a
 * device-pixel exact one both sample correctly. Ink still on the wet or dry layers (drawn
 * this moment, not yet in the bitmap) is not sampled.
 */
import { rgbToHex } from '../ui/colour/colour-math';

/** A square of page pixels centred on a point. */
export interface PixelBlock {
  /** Side, in page pixels (odd). */
  readonly size: number;
  /** RGBA rows, `size × size`; alpha 0 where the square leaves the page. */
  readonly data: Uint8ClampedArray;
  /** The centre pixel as `#RRGGBB` (over paper white when translucent); null off the page. */
  readonly centre: string | null;
}

/** Samples a `size × size` square of page pixels at a client point; null off every page. */
export type PixelSampler = (clientX: number, clientY: number, size?: number) => PixelBlock | null;

const PAGE = '[data-page-id]';
const TILES = '[data-testid="page-tiles"]';
const BITMAP = 'canvas[data-state="rendered"], canvas[data-state="preview"]';

function covers(element: Element, x: number, y: number): boolean {
  const r = element.getBoundingClientRect();
  return x >= r.left && x < r.right && y >= r.top && y < r.bottom;
}

/** The page element under a client point (the topmost), if any. */
export function pageAt(clientX: number, clientY: number): HTMLElement | null {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    const page = element.closest<HTMLElement>(PAGE);
    if (page) return page;
  }
  // Pointer-transparent layers can hide the page from hit testing: fall back to boxes.
  for (const page of document.querySelectorAll<HTMLElement>(PAGE)) {
    if (covers(page, clientX, clientY)) return page;
  }
  return null;
}

/** The drawn bitmap of `page` that covers the point: a tile first, else the page canvas. */
export function bitmapAt(
  page: Element,
  clientX: number,
  clientY: number,
): HTMLCanvasElement | null {
  const usable = (canvas: HTMLCanvasElement) =>
    canvas.width > 0 && canvas.height > 0 && covers(canvas, clientX, clientY);
  for (const tile of page.querySelectorAll<HTMLCanvasElement>(
    `${TILES} canvas[data-state="rendered"]`,
  )) {
    if (usable(tile)) return tile;
  }
  for (const canvas of page.querySelectorAll<HTMLCanvasElement>(BITMAP)) {
    if (canvas.closest(TILES)) continue;
    if (usable(canvas)) return canvas;
  }
  return null;
}

/** `#RRGGBB` of an RGBA pixel over paper white; null when fully transparent. */
export function pixelHex(data: Uint8ClampedArray, index: number): string | null {
  const a = (data[index + 3] ?? 0) / 255;
  if (a === 0) return null;
  const over = (c: number) => c * a + 255 * (1 - a);
  return rgbToHex([over(data[index] ?? 0), over(data[index + 1] ?? 0), over(data[index + 2] ?? 0)]);
}

/** Samples a canvas's pixels around a client point. */
export function sampleCanvas(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  size = 11,
): PixelBlock | null {
  const r = canvas.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  const px = Math.floor(((clientX - r.left) * canvas.width) / r.width);
  const py = Math.floor(((clientY - r.top) * canvas.height) / r.height);
  const half = Math.floor(size / 2);
  const side = half * 2 + 1;
  const context = canvas.getContext('2d');
  if (!context) return null;
  let image: ImageData;
  try {
    // Pixels outside the canvas come back transparent: they read as "off the page".
    image = context.getImageData(px - half, py - half, side, side);
  } catch {
    // A tainted canvas (never one of ours) cannot be read.
    return null;
  }
  return {
    size: side,
    data: image.data,
    centre: pixelHex(image.data, (half * side + half) * 4),
  };
}

/** The eyedropper's source: the rendered page bitmap under a client point. */
export const samplePagePixels: PixelSampler = (clientX, clientY, size = 11) => {
  const page = pageAt(clientX, clientY);
  const canvas = page ? bitmapAt(page, clientX, clientY) : null;
  return canvas ? sampleCanvas(canvas, clientX, clientY, size) : null;
};
