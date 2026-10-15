/**
 * The adaptive scroll edge (DSN-40; the owner's choice DSN-37: "over a dark page the fade
 * follows the page, not the theme"): how dark the page is under the phone reader's top band,
 * written as `--edge-tone` (0 a light page, 1 a dark page) and `data-edge-tone` on the compact
 * root, where the split top's fade and title read it (and the glass may, research 23 §8 row 2).
 *
 * We render every page ourselves, so the page raster is ours to read: on scroll-settle, on a
 * page's render and on a resize (never per scrolled frame) the band's rows of the page canvas
 * under it are drawn into a 24 × 4 canvas and their mean relative luminance taken; with no page
 * under the band (above the first page, between pages) the canvas around the pages decides,
 * which follows the theme. Hysteresis keeps a mid-grey page from flickering: dark below 0.35,
 * light above 0.5. The CSS eases the change over 200 ms (none under reduced motion).
 */

/** Below this mean luminance the page is dark under the band; above `LIGHT_ABOVE`, light. */
export const DARK_BELOW = 0.35;
export const LIGHT_ABOVE = 0.5;
/** Scrolling has stopped this long: the band is read. */
const SETTLE_MS = 120;
const SAMPLE_W = 24;
const SAMPLE_H = 4;

export type EdgeTone = 0 | 1;

/** The tone for a luminance, with hysteresis around the last tone. */
export function toneFor(luminance: number, previous: EdgeTone): EdgeTone {
  if (luminance < DARK_BELOW) return 1;
  if (luminance > LIGHT_ABOVE) return 0;
  return previous;
}

const linear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** Mean relative luminance (WCAG) of RGBA pixels, transparent ones skipped; null when none. */
export function meanLuminance(data: ArrayLike<number>): number | null {
  let sum = 0;
  let count = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 128) continue;
    sum +=
      0.2126 * linear(data[i] ?? 0) +
      0.7152 * linear(data[i + 1] ?? 0) +
      0.0722 * linear(data[i + 2] ?? 0);
    count++;
  }
  return count === 0 ? null : sum / count;
}

let probe: HTMLCanvasElement | null = null;

/** The band's luminance over `canvas`, or null when it is not under the band or not drawn. */
function canvasLuminance(canvas: HTMLCanvasElement, band: DOMRect): number | null {
  if (canvas.width === 0 || canvas.dataset.state === 'placeholder') return null;
  const r = canvas.getBoundingClientRect();
  const left = Math.max(r.left, band.left);
  const right = Math.min(r.right, band.right);
  const top = Math.max(r.top, band.top);
  const bottom = Math.min(r.bottom, band.bottom);
  if (right - left < 8 || bottom - top < 2) return null;
  const sx = canvas.width / r.width;
  const sy = canvas.height / r.height;
  probe ??= document.createElement('canvas');
  probe.width = SAMPLE_W;
  probe.height = SAMPLE_H;
  const context = probe.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
  try {
    context.drawImage(
      canvas,
      (left - r.left) * sx,
      (top - r.top) * sy,
      (right - left) * sx,
      (bottom - top) * sy,
      0,
      0,
      SAMPLE_W,
      SAMPLE_H,
    );
    return meanLuminance(context.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data);
  } catch {
    return null;
  }
}

/** Parses `rgb(r, g, b)` / `rgba(…)` into its relative luminance, or null. */
export function colourLuminance(colour: string): number | null {
  const parts = colour.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return null;
  const [r, g, b] = parts.map(Number);
  return meanLuminance([r ?? 0, g ?? 0, b ?? 0, 255]);
}

/** The luminance under the band: the page canvases there, else the reader's own canvas. */
function bandLuminance(root: HTMLElement, scroller: HTMLElement, band: DOMRect): number | null {
  for (const canvas of scroller.querySelectorAll<HTMLCanvasElement>('[data-page-index] canvas')) {
    const value = canvasLuminance(canvas, band);
    if (value !== null) return value;
  }
  return colourLuminance(getComputedStyle(root).backgroundColor);
}

/**
 * Follows the page under `band()` (the top band's rect) in `scroller` and writes the tone on
 * `root`; returns the stop. The first reading is at once.
 */
export function watchEdgeTone(
  root: HTMLElement,
  scroller: HTMLElement,
  band: () => DOMRect,
): () => void {
  let tone: EdgeTone =
    root.dataset.edgeTone === '1' || root.style.getPropertyValue('--edge-tone') === '1' ? 1 : 0;
  let timer = 0;
  const read = () => {
    const value = bandLuminance(root, scroller, band());
    if (value === null) return;
    const next = toneFor(value, tone);
    if (next === tone && root.dataset.edgeTone !== undefined) return;
    tone = next;
    root.dataset.edgeTone = String(tone);
    root.style.setProperty('--edge-tone', String(tone));
  };
  const later = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(read, SETTLE_MS);
  };
  // A page's bitmap arriving under the band (`data-state` of its canvas).
  const renders = new MutationObserver(later);
  renders.observe(scroller, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
  scroller.addEventListener('scroll', later, { passive: true });
  window.addEventListener('resize', later);
  read();
  return () => {
    window.clearTimeout(timer);
    renders.disconnect();
    scroller.removeEventListener('scroll', later);
    window.removeEventListener('resize', later);
    delete root.dataset.edgeTone;
    root.style.removeProperty('--edge-tone');
  };
}
