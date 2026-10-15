/**
 * The backdrop lens (language.md §2.7; ADR-0024 §2.6, amended by spec X20 and decision GLS-11;
 * quality-bar Q-5; research 23 §5.3, §8 row 5): refraction at the rim of fixed-size M1 chips
 * (the page pill) and, since GLS-11, of floating M2 bars and capsules (the dock capsule, the top
 * strip's pieces, the floating bars), never a panel, a menu, a sheet or a toast.
 *
 * - **Chromium on the GPU, a fine pointer only.** Safari and Firefox drop a whole
 *   `backdrop-filter` declaration that holds `url()` (blur included, research 16 §4.2), so the
 *   lens is never in a base declaration: this module adds the class `lens` after detecting
 *   Chromium (`navigator.userAgentData.brands`), and `materials.css`'s `.mat-<tier>.s<σ>.lens`
 *   rules prepend `var(--lens)`, the `url()` of a filter drawn here at the surface's size.
 * - **The map** is drawn per size and radius (Q-12: generated, never shipped): for each pixel
 *   the rounded rectangle's signed distance gives the way to the rim, the convex-squircle bezel
 *   h(x) = √(1 − (1 − x)⁴) its slope and Snell's law (ior 1.5) the pull, so the backdrop at the
 *   rim is drawn from further in, exact in corners and on a capsule's round ends (GLS-3; the
 *   formulas after Liquid DOM, MIT, and Inigo Quilez's SDF, restated). Red and green carry x and
 *   y around 128. Chips bend a 10 px bezel by at most 6 px, bars a 14 px bezel by at most 10.
 *   A map costs about 1–3 ms once per size; it is redrawn 150 ms after a size change.
 * - **Off** on a coarse pointer, under Glass Tinted or Solid, Reduce motion, any OS
 *   transparency or contrast preference, forced colours, from the cost ladder's first step,
 *   while the surface animates (its own transitions and animations), and past three lenses on
 *   screen: each costs the SVG filter's main-thread paint per scrolled frame (research 16 §5.3),
 *   measured in GLS-11.
 */
import { type RefObject, useEffect } from 'react';

import { reducedMotion } from '../motion/reduced-motion';
import { SOFTWARE_RENDERER, useRenderQualityStore, webglRenderer } from '../state/render-quality';

/** A lens's bezel and largest pull, CSS px. */
export interface LensShape {
  readonly bezel: number;
  readonly pull: number;
}
export const CHIP_LENS: LensShape = { bezel: 10, pull: 6 };
export const BAR_LENS: LensShape = { bezel: 14, pull: 10 };
/** At most this many lenses at once (language.md §2.7, GLS-11). */
export const MAX_LENSES = 3;
const REGENERATE_MS = 150;
const SVG_NS = 'http://www.w3.org/2000/svg';
const IOR = 1.5;
/** The bars the document-level manager lenses (GLS-11): floating M2, never docked or solid. */
const BARS = '.mat-bar:not(.mat-docked, .mat-opaque)';

let compositedOnGpu: boolean | undefined;

/**
 * Whether this engine draws a backdrop `url()` filter as the lens needs: Chromium (G-8), on
 * the GPU (language.md §2.8's L3 asks for GPU compositing; the software compositor was seen
 * dropping the filtered backdrop at part of the chip, so a software rasteriser gets no lens).
 */
export function chromiumBackdropLens(): boolean {
  if (typeof navigator === 'undefined') return false;
  const brands = (navigator as { userAgentData?: { brands?: { brand: string }[] } }).userAgentData
    ?.brands;
  if (!Array.isArray(brands) || !brands.some((entry) => /chromium/i.test(entry.brand))) {
    return false;
  }
  compositedOnGpu ??= !SOFTWARE_RENDERER.test(webglRenderer());
  return compositedOnGpu;
}

const media = (query: string): boolean =>
  typeof matchMedia === 'function' && matchMedia(query).matches;

/** Everything but the engine and the count: pointer, setting, preferences, the ladder. */
export function lensAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return (
    chromiumBackdropLens() &&
    media('(pointer: fine)') &&
    !media('(any-pointer: coarse)') &&
    root.getAttribute('data-glass') === 'clear' &&
    !root.hasAttribute('data-degrade') &&
    useRenderQualityStore.getState().degrade === 0 &&
    !reducedMotion() &&
    !media('(prefers-reduced-transparency: reduce)') &&
    !media('(prefers-contrast: more)') &&
    !media('(forced-colors: active)')
  );
}

/** Signed distance from (x, y) to a w × h rounded rectangle of radius r at the origin. */
export function roundRectDistance(x: number, y: number, w: number, h: number, r: number): number {
  const radius = Math.min(r, w / 2, h / 2);
  const qx = Math.abs(x - w / 2) - w / 2 + radius;
  const qy = Math.abs(y - h / 2) - h / 2 + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/**
 * The pull at `inward` px inside the rim: the slope of h(x) = √(1 − (1 − x)⁴) over the bezel,
 * a ray straight down refracted through it (Snell, ior 1.5) and travelling the bezel's depth,
 * capped at `pull`.
 */
export function snellPull(inward: number, shape: LensShape): number {
  if (inward <= 0 || inward >= shape.bezel) return 0;
  const u = 1 - inward / shape.bezel;
  const slope = Math.min((2 * u ** 3) / Math.sqrt(Math.max(1 - u ** 4, 1e-4)), 11.43);
  const len = Math.hypot(slope, 1);
  const cos = 1 / len;
  const eta = 1 / IOR;
  const k = 1 - eta * eta * (1 - cos * cos);
  if (k < 0) return 0;
  const a = eta * cos - Math.sqrt(k);
  const rx = (a * slope) / len;
  const rz = -eta + a * cos;
  return Math.min(Math.abs((rx / rz) * shape.bezel * 4), shape.pull);
}

/** The displacement map of a w × h box of radius r as a PNG data URL, and its scale (px). */
export function lensMap(
  w: number,
  h: number,
  r: number,
  shape: LensShape,
): { readonly url: string; readonly scale: number } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx || w === 0 || h === 0) return { url: '', scale: 0 };
  const image = ctx.createImageData(w, h);
  const data = image.data;
  const largest = Math.max(0.5, shape.pull);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      data[o + 2] = 128;
      data[o + 3] = 255;
      const px = x + 0.5;
      const py = y + 0.5;
      const inward = -roundRectDistance(px, py, w, h, r);
      const amount = snellPull(inward, shape);
      let dx = 0;
      let dy = 0;
      if (amount > 0) {
        const gx =
          roundRectDistance(px + 0.5, py, w, h, r) - roundRectDistance(px - 0.5, py, w, h, r);
        const gy =
          roundRectDistance(px, py + 0.5, w, h, r) - roundRectDistance(px, py - 0.5, w, h, r);
        const len = Math.hypot(gx, gy) || 1;
        // Inward: against the outward gradient, so the rim shows what lies further in.
        dx = (-gx / len) * amount;
        dy = (-gy / len) * amount;
      }
      data[o] = Math.round(128 + (127 * dx) / largest);
      data[o + 1] = Math.round(128 + (127 * dy) / largest);
    }
  }
  ctx.putImageData(image, 0, 0);
  // feDisplacementMap moves by scale × (c / 255 − 0.5): ±largest at c = 128 ± 127.
  return { url: canvas.toDataURL(), scale: (2 * largest * 255) / 254 };
}

/** The hidden `<svg>` that holds every lens filter, made on first use. */
function lensDefs(): SVGDefsElement {
  const existing = document.getElementById('recto-lenses');
  if (existing?.firstElementChild instanceof SVGDefsElement) return existing.firstElementChild;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = 'recto-lenses';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.pointerEvents = 'none';
  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.append(defs);
  document.body.append(svg);
  return defs;
}

const attrs = (node: Element, values: Record<string, string | number>) => {
  for (const [key, value] of Object.entries(values)) node.setAttribute(key, String(value));
  return node;
};

/** The filter id for a size, radius and shape, drawn once per key. */
export function lensFilter(w: number, h: number, r: number, shape: LensShape = CHIP_LENS): string {
  const id = `lens-${w}x${h}r${Math.round(r)}b${shape.bezel}`;
  if (document.getElementById(id)) return id;
  const { url, scale } = lensMap(w, h, r, shape);
  // The element's border box, origin at its top left, CSS px (research 23 §5.3).
  const filter = attrs(document.createElementNS(SVG_NS, 'filter'), {
    id,
    x: 0,
    y: 0,
    width: w,
    height: h,
    filterUnits: 'userSpaceOnUse',
    primitiveUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB',
  });
  filter.append(
    attrs(document.createElementNS(SVG_NS, 'feImage'), {
      href: url,
      x: 0,
      y: 0,
      width: w,
      height: h,
      preserveAspectRatio: 'none',
      result: 'map',
    }),
    attrs(document.createElementNS(SVG_NS, 'feDisplacementMap'), {
      in: 'SourceGraphic',
      in2: 'map',
      scale: scale.toFixed(2),
      xChannelSelector: 'R',
      yChannelSelector: 'G',
    }),
  );
  lensDefs().append(filter);
  return id;
}

let mounted = 0;

/** The lens's shape for a surface: bars bend wider than chips. */
const shapeOf = (el: HTMLElement): LensShape => (el.matches('.mat-bar') ? BAR_LENS : CHIP_LENS);

/** Draws the lens onto `el` at its size and radius; false where it has no size yet. */
function lensOn(el: HTMLElement): boolean {
  const width = Math.round(el.offsetWidth);
  const height = Math.round(el.offsetHeight);
  if (width === 0 || height === 0) return false;
  const radius = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  el.style.setProperty('--lens', `url(#${lensFilter(width, height, radius, shapeOf(el))})`);
  el.classList.add('lens');
  return true;
}

function lensOff(el: HTMLElement): void {
  el.classList.remove('lens');
  el.style.removeProperty('--lens');
}

/**
 * Gives the element a backdrop lens while everything allows one (see the module comment), at
 * its rendered size, and takes it away otherwise. The element composes `mat mat-chip s<σ>` or
 * `mat mat-bar s<σ>`.
 */
export function useBackdropLens(ref: RefObject<HTMLElement | null>, enabled = true): void {
  const degrade = useRenderQualityStore((s) => s.degrade);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !chromiumBackdropLens()) return;
    let animating = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let counted = false;
    const update = () => {
      const allowed = lensAllowed() && animating === 0;
      if (allowed && !counted && mounted >= MAX_LENSES) return;
      if (!allowed) {
        lensOff(el);
        if (counted) {
          counted = false;
          mounted--;
        }
        return;
      }
      if (!counted) {
        counted = true;
        mounted++;
      }
      lensOn(el);
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(update, REGENERATE_MS);
    };
    // While the surface itself moves or fades, no lens (it would be drawn at every frame).
    const start = () => {
      animating++;
      update();
    };
    const end = () => {
      animating = Math.max(0, animating - 1);
      later();
    };
    const resize = new ResizeObserver(later);
    resize.observe(el);
    const settings = new MutationObserver(update);
    settings.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-glass', 'data-degrade', 'data-motion'],
    });
    el.addEventListener('transitionrun', start);
    el.addEventListener('transitionend', end);
    el.addEventListener('transitioncancel', end);
    el.addEventListener('animationstart', start);
    el.addEventListener('animationend', end);
    el.addEventListener('animationcancel', end);
    update();
    return () => {
      clearTimeout(timer);
      resize.disconnect();
      settings.disconnect();
      el.removeEventListener('transitionrun', start);
      el.removeEventListener('transitionend', end);
      el.removeEventListener('transitioncancel', end);
      el.removeEventListener('animationstart', start);
      el.removeEventListener('animationend', end);
      el.removeEventListener('animationcancel', end);
      lensOff(el);
      if (counted) mounted--;
    };
  }, [ref, enabled, degrade]);
}

/** Whether a bar is on screen and at rest (no transition or animation of its own running). */
function barReady(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) {
    return false;
  }
  if (getComputedStyle(el).opacity === '0') return false;
  return typeof el.getAnimations !== 'function' || el.getAnimations().length === 0;
}

/**
 * The lens on floating bars and capsules (GLS-11): one document-level manager, since bars
 * compose their material in CSS modules. On Chromium with a GPU only; it gives the lens to the
 * largest bars at rest on screen while the count (shared with the chips' hook) allows, takes it
 * from any that starts to move, and redraws a map after a size change. Returns its disposer.
 */
export function startBarLenses(): () => void {
  if (typeof document === 'undefined' || !chromiumBackdropLens()) return idle;
  const held = new Set<HTMLElement>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = (el: HTMLElement) => {
    lensOff(el);
    if (held.delete(el)) mounted--;
  };
  const update = () => {
    const allowed = lensAllowed();
    for (const el of [...held]) {
      if (!allowed || !el.isConnected || !barReady(el)) release(el);
    }
    if (!allowed) return;
    const candidates = [...document.querySelectorAll<HTMLElement>(BARS)]
      .filter((el) => !held.has(el) && !el.classList.contains('lens') && barReady(el))
      .sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight);
    for (const el of candidates) {
      if (mounted >= MAX_LENSES) break;
      if (!lensOn(el)) continue;
      held.add(el);
      mounted++;
      resize.observe(el);
    }
    for (const el of held) lensOn(el);
  };
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(update, REGENERATE_MS);
  };
  const resize = new ResizeObserver(later);
  const tree = new MutationObserver(later);
  tree.observe(document.body, { subtree: true, childList: true });
  const settings = new MutationObserver(update);
  settings.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-glass', 'data-degrade', 'data-motion'],
  });
  // A bar that starts to move loses its lens at once; it may take it back once at rest.
  const moving = (event: Event) => {
    const el = event.target as HTMLElement;
    if (held.has(el) && (event.type === 'transitionrun' || event.type === 'animationstart')) {
      release(el);
    }
    later();
  };
  const kinds = ['transitionrun', 'animationstart', 'transitionend', 'animationend'] as const;
  for (const kind of kinds) document.addEventListener(kind, moving, true);
  window.addEventListener('resize', later);
  later();
  return () => {
    clearTimeout(timer);
    resize.disconnect();
    tree.disconnect();
    settings.disconnect();
    for (const kind of kinds) document.removeEventListener(kind, moving, true);
    window.removeEventListener('resize', later);
    for (const el of [...held]) release(el);
  };
}

/** A disposer with nothing to dispose. */
function idle(): void {
  // Nothing started.
}
