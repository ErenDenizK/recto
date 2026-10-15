/**
 * The adaptive look (decisions GLS-7, GLS-9; research 23 §4 item 1, §5.2, §8 row 2): small
 * glass pieces (M1 chips and M2 bars that float, never docked M3 or a solid twin) turn light
 * glass over a light page and dark glass over a dark page or photo, in both themes, as iOS's
 * controls do.
 *
 * - **How a piece turns.** It takes the other theme's whole token block on itself:
 *   `data-theme="light"` (or `"dark"`) on the piece, which `tokens.css`'s theme selectors match,
 *   so its tint, filter chain, rims, text and controls are that theme's, proven there;
 *   `materials.css` has a rule per σ for a turned piece (the blur lines are literal, G-22). A
 *   piece in its theme's own look carries no attribute.
 * - **What it reads.** The page raster we already render under it, never the DOM's colours and
 *   never per frame: on scroll it samples at most every 250 ms and once 120 ms after the last
 *   scroll; also after a resize, a page render (`data-state` on a page canvas) or pieces
 *   mounting. The piece's box maps onto an 8 × 4 grid; the grid starts as the canvas colour, page
 *   boxes paint paper white, and each page or thumbnail raster under the piece is drawn into it
 *   (one `drawImage` on a GPU canvas, a 32-pixel read back). The median relative luminance
 *   decides, with hysteresis: light above 0.45, dark below 0.20, as it was in between. A piece
 *   over no page keeps (or returns to) its theme's look.
 * - **The top band.** Where the compact edition sets `--edge-tone` (0 light … 1 dark) for its
 *   scroll edge, a piece in the top 120 px reads that instead of sampling.
 * - **The turn** cross-fades its tint, text, rim and filter over 200 ms (Web Animations, so a
 *   module's own transitions are untouched); instant with Reduce motion.
 * - **Off** under Glass Solid, reduced transparency, more contrast and forced colours (every
 *   tier is solid there and the system's colours win): every piece returns to its theme.
 *
 * The contrast proofs (`tokens.test.ts`, "the adaptive look") hold each look over the backdrops
 * its hysteresis lets it sit on, and primary text AA over the opposite extreme for the moment
 * before a piece turns.
 */

export type Tone = 'light' | 'dark';

/** A dark-look piece turns light above this median luminance under it. */
export const TONE_LIGHT_ABOVE = 0.45;
/** A light-look piece turns dark below this. */
export const TONE_DARK_BELOW = 0.2;
/** The cross-fade, ms. */
export const TONE_FADE_MS = 200;

const SETTLE_MS = 120;
const THROTTLE_MS = 250;
const GRID_W = 8;
const GRID_H = 4;
const TOP_BAND_PX = 120;
const PIECES = '.mat-chip:not(.mat-opaque), .mat-bar:not(.mat-docked, .mat-opaque)';
const PAPERS = '[data-page-index]';
const SOURCES = '[data-page-index] canvas, [data-thumb] canvas, [data-thumb] img';

/** The look a piece over a median luminance `y` takes, from the look it has (hysteresis). */
export function nextTone(current: Tone, y: number): Tone {
  if (current === 'dark' && y > TONE_LIGHT_ABOVE) return 'light';
  if (current === 'light' && y < TONE_DARK_BELOW) return 'dark';
  return current;
}

/** WCAG relative luminance of 8-bit sRGB. */
export function luminance(r: number, g: number, b: number): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The median of RGBA pixels' luminance. */
export function medianLuminance(data: ArrayLike<number>): number {
  const values: number[] = [];
  for (let i = 0; i + 3 < data.length; i += 4) {
    values.push(luminance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0));
  }
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  if (values.length === 0) return 0;
  return values.length % 2 ? (values[mid] ?? 0) : ((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2;
}

const media = (query: string): boolean =>
  typeof matchMedia === 'function' && matchMedia(query).matches;

/** Whether the look may turn at all (see the module comment). */
export function toneAllowed(root: HTMLElement = document.documentElement): boolean {
  return (
    root.getAttribute('data-glass') !== 'solid' &&
    !media('(prefers-reduced-transparency: reduce)') &&
    !media('(prefers-contrast: more)') &&
    !media('(forced-colors: active)')
  );
}

interface Box {
  readonly el: Element;
  readonly rect: DOMRect;
}

const intersects = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

let scratch: CanvasRenderingContext2D | null | undefined;

function grid(): CanvasRenderingContext2D | null {
  if (scratch === undefined) {
    const canvas = document.createElement('canvas');
    canvas.width = GRID_W;
    canvas.height = GRID_H;
    scratch = canvas.getContext('2d');
  }
  return scratch;
}

/** The median luminance under `rect`, or undefined when no page lies under it. */
function sample(
  rect: DOMRect,
  papers: readonly Box[],
  sources: readonly Box[],
  canvasColour: string,
): number | undefined {
  const underPapers = papers.filter((p) => intersects(p.rect, rect));
  if (underPapers.length === 0) return undefined;
  const ctx = grid();
  if (!ctx) return undefined;
  const sx = GRID_W / rect.width;
  const sy = GRID_H / rect.height;
  const map = (r: DOMRect) =>
    [(r.left - rect.left) * sx, (r.top - rect.top) * sy, r.width * sx, r.height * sy] as const;
  ctx.globalCompositeOperation = 'copy';
  ctx.fillStyle = canvasColour || '#808080';
  ctx.fillRect(0, 0, GRID_W, GRID_H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff';
  for (const paper of underPapers) ctx.fillRect(...map(paper.rect));
  for (const source of sources) {
    if (!intersects(source.rect, rect)) continue;
    const el = source.el as HTMLCanvasElement | HTMLImageElement;
    const width = el instanceof HTMLImageElement ? el.naturalWidth : el.width;
    const height = el instanceof HTMLImageElement ? el.naturalHeight : el.height;
    if (width === 0 || height === 0 || source.rect.width === 0 || source.rect.height === 0) {
      continue;
    }
    // The part of the source under the piece, in the source's own pixels.
    const left = Math.max(rect.left, source.rect.left);
    const top = Math.max(rect.top, source.rect.top);
    const right = Math.min(rect.right, source.rect.right);
    const bottom = Math.min(rect.bottom, source.rect.bottom);
    const kx = width / source.rect.width;
    const ky = height / source.rect.height;
    try {
      ctx.drawImage(
        el,
        (left - source.rect.left) * kx,
        (top - source.rect.top) * ky,
        Math.max(1, (right - left) * kx),
        Math.max(1, (bottom - top) * ky),
        (left - rect.left) * sx,
        (top - rect.top) * sy,
        (right - left) * sx,
        (bottom - top) * sy,
      );
    } catch {
      // A source not ready (an image still decoding) leaves its paper.
    }
  }
  try {
    return medianLuminance(ctx.getImageData(0, 0, GRID_W, GRID_H).data);
  } catch {
    return undefined;
  }
}

const turned = new Set<HTMLElement>();
let tones = new WeakMap<HTMLElement, Tone>();

/** Sets a piece's look, cross-fading it unless motion is reduced. */
function apply(el: HTMLElement, tone: Tone, theme: Tone, fade: boolean): void {
  const want = tone === theme ? null : tone;
  if (el.getAttribute('data-theme') === want) return;
  const props = [
    'backgroundColor',
    'color',
    'borderTopColor',
    'borderBottomColor',
    'backdropFilter',
  ];
  let from: Record<string, string> | undefined;
  if (fade && typeof el.animate === 'function') {
    const style = getComputedStyle(el);
    from = Object.fromEntries(props.map((p) => [p, style.getPropertyValue(kebab(p))]));
  }
  if (want) {
    el.setAttribute('data-theme', want);
    turned.add(el);
  } else {
    el.removeAttribute('data-theme');
    turned.delete(el);
  }
  if (from) {
    const style = getComputedStyle(el);
    const to = Object.fromEntries(props.map((p) => [p, style.getPropertyValue(kebab(p))]));
    el.animate([from, to], { duration: TONE_FADE_MS, easing: 'ease-out' });
  }
}

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** One pass over every piece on screen. */
export function updateTones(fade = true): void {
  const root = document.documentElement;
  const theme: Tone = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const pieces = [...document.querySelectorAll<HTMLElement>(PIECES)];
  if (!toneAllowed(root)) {
    for (const el of turned) apply(el, theme, theme, false);
    return;
  }
  const animate =
    fade &&
    root.getAttribute('data-motion') !== 'reduced' &&
    !media('(prefers-reduced-motion: reduce)');
  const papers: Box[] = [...document.querySelectorAll(PAPERS)].map((el) => ({
    el,
    rect: el.getBoundingClientRect(),
  }));
  const sources: Box[] =
    papers.length === 0
      ? []
      : [...document.querySelectorAll(SOURCES)].map((el) => ({
          el,
          rect: el.getBoundingClientRect(),
        }));
  const canvasColour = getComputedStyle(root).getPropertyValue('--canvas').trim();
  for (const el of pieces) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const current = tones.get(el) ?? theme;
    let y: number | undefined;
    if (rect.top < TOP_BAND_PX) {
      const edge = Number.parseFloat(getComputedStyle(el).getPropertyValue('--edge-tone'));
      if (Number.isFinite(edge)) y = 1 - edge;
    }
    y ??= sample(rect, papers, sources, canvasColour);
    const tone = y === undefined ? theme : nextTone(current, y);
    tones.set(el, tone);
    apply(el, tone, theme, animate);
  }
  // Pieces that left the document.
  for (const el of turned) if (!el.isConnected) turned.delete(el);
}

/**
 * Starts the adaptive look for the document; returns its disposer. Nothing runs at rest: work
 * follows scroll (throttled), resize, page renders and pieces mounting, each debounced.
 */
export function startAdaptiveTone(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return idle;
  let settle: ReturnType<typeof setTimeout> | undefined;
  let last = 0;
  const run = () => {
    last = performance.now();
    updateTones();
  };
  const later = () => {
    clearTimeout(settle);
    settle = setTimeout(run, SETTLE_MS);
  };
  const onScroll = () => {
    if (performance.now() - last > THROTTLE_MS) run();
    later();
  };
  const options: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener('scroll', onScroll, options);
  window.addEventListener('resize', later, options);
  const observer = new MutationObserver(later);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-state'],
  });
  const rootObserver = new MutationObserver(() => {
    // A new theme: every piece starts from it again.
    tones = new WeakMap();
    later();
  });
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-glass'],
  });
  const queries = [
    '(prefers-reduced-transparency: reduce)',
    '(prefers-contrast: more)',
    '(forced-colors: active)',
  ].map((q) => (typeof matchMedia === 'function' ? matchMedia(q) : undefined));
  for (const q of queries) q?.addEventListener('change', later);
  later();
  return () => {
    clearTimeout(settle);
    window.removeEventListener('scroll', onScroll, options);
    window.removeEventListener('resize', later, options);
    observer.disconnect();
    rootObserver.disconnect();
    for (const q of queries) q?.removeEventListener('change', later);
    const theme: Tone =
      document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    for (const el of [...turned]) apply(el, theme, theme, false);
  };
}

/** A disposer with nothing to dispose. */
function idle(): void {
  // Nothing started.
}
