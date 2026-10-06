/**
 * The backdrop lens (language.md §2.7; ADR-0024 §2.6, amended by spec X20; quality-bar Q-5):
 * refraction on fixed-size M1 chips only (the page pill, and the facts chip when D4-3 brings
 * it), never the capsule, a bar, a panel, a menu, a sheet or a toast.
 *
 * - **Chromium on the GPU only.** Safari and Firefox drop a whole `backdrop-filter` declaration that holds
 *   `url()` (blur included, research 16 §4.2), so the lens is never in a base declaration: this
 *   module adds the class `lens` after detecting Chromium (`navigator.userAgentData.brands`),
 *   and `materials.css`'s `.mat-chip.s<σ>.lens` rule prepends `var(--lens)`, the `url()` of a
 *   filter drawn here at the chip's exact size.
 * - **The map** is code, not a bitmap (Q-12): an SVG of two gradients, red across for x and
 *   green down for y, neutral (128) inside a 10 px bezel and rising convexly (t^2.2) towards
 *   each edge, so the backdrop at the rim is drawn from up to 6 px further in (pull ≤ 6 px), no
 *   chromatic split. It is regenerated 150 ms after a size change.
 * - **Off** on a coarse pointer, under Glass Tinted or Solid, Reduce motion, any OS
 *   transparency or contrast preference, forced colours, from the cost ladder's first step,
 *   while the surface animates (its own transitions and animations), and past three lenses on
 *   screen (+9 % GPU and four times the main-thread work per scrolled frame each, 16 §5.3).
 */
import { type RefObject, useEffect } from 'react';

import { reducedMotion } from '../motion/reduced-motion';
import { SOFTWARE_RENDERER, useRenderQualityStore, webglRenderer } from '../state/render-quality';

/** The bezel the map bends, CSS px, and the largest pull at the rim. */
export const LENS_BEZEL = 10;
export const LENS_PULL = 6;
/** At most this many lenses at once (language.md §2.7). */
export const MAX_LENSES = 3;
const REGENERATE_MS = 150;
const SVG_NS = 'http://www.w3.org/2000/svg';

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

/** The map's colour channel at distance `d` from an edge: 128 inside, up to 128 ± 127. */
function bend(d: number): number {
  if (d >= LENS_BEZEL) return 0;
  const t = 1 - d / LENS_BEZEL;
  return t ** 2.2;
}

/** Gradient stops along one axis of `length` px: rising towards the start, falling at the end. */
function stops(length: number, channel: 'r' | 'g'): string {
  const out: string[] = [];
  const colour = (value: number) => {
    const v = Math.round(128 + 127 * value);
    return channel === 'r' ? `rgb(${v},0,0)` : `rgb(0,${v},0)`;
  };
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const d = (LENS_BEZEL * i) / steps;
    out.push(`<stop offset="${(d / length).toFixed(4)}" stop-color="${colour(bend(d))}"/>`);
  }
  for (let i = steps; i >= 0; i--) {
    const d = (LENS_BEZEL * i) / steps;
    out.push(`<stop offset="${(1 - d / length).toFixed(4)}" stop-color="${colour(-bend(d))}"/>`);
  }
  return out.join('');
}

/** The displacement map of a `width` × `height` chip, as an SVG data URL. */
export function lensMap(width: number, height: number): string {
  const svg =
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}">` +
    `<defs><linearGradient id="x" x2="1" y2="0">${stops(width, 'r')}</linearGradient>` +
    `<linearGradient id="y" x2="0" y2="1">${stops(height, 'g')}</linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="#000"/>` +
    `<rect width="${width}" height="${height}" fill="url(#x)"/>` +
    `<rect width="${width}" height="${height}" fill="url(#y)" style="mix-blend-mode:screen"/>` +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
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

/** The filter id for a size, drawn once per size. */
export function lensFilter(width: number, height: number): string {
  const id = `lens-${width}x${height}`;
  if (document.getElementById(id)) return id;
  // The region and the map are in the chip's own box (objectBoundingBox): the map is drawn at
  // the chip's size and stretched over exactly that box, wherever the engine puts its origin.
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.id = id;
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '1');
  filter.setAttribute('height', '1');
  filter.setAttribute('primitiveUnits', 'objectBoundingBox');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  const image = document.createElementNS(SVG_NS, 'feImage');
  image.setAttribute('href', lensMap(width, height));
  image.setAttribute('x', '0');
  image.setAttribute('y', '0');
  image.setAttribute('width', '1');
  image.setAttribute('height', '1');
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'map');
  const displace = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displace.setAttribute('in', 'SourceGraphic');
  displace.setAttribute('in2', 'map');
  // A channel at 128 ± 127 moves a pixel by scale × (c / 255 − 0.5): ±LENS_PULL at the rim,
  // the scale a fraction of the box's width in objectBoundingBox units.
  displace.setAttribute('scale', String((2 * LENS_PULL) / width));
  displace.setAttribute('xChannelSelector', 'R');
  displace.setAttribute('yChannelSelector', 'G');
  filter.append(image, displace);
  lensDefs().append(filter);
  return id;
}

let mounted = 0;

/**
 * Gives the element a backdrop lens while everything allows one (see the module comment), at
 * its rendered size, and takes it away otherwise. The element composes `mat mat-chip s<σ>`.
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
        el.classList.remove('lens');
        el.style.removeProperty('--lens');
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
      const width = Math.round(el.offsetWidth);
      const height = Math.round(el.offsetHeight);
      if (width === 0 || height === 0) return;
      el.style.setProperty('--lens', `url(#${lensFilter(width, height)})`);
      el.classList.add('lens');
    };
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(update, REGENERATE_MS);
    };
    // While the chip itself moves or fades, no lens (it would be drawn at every frame).
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
      el.classList.remove('lens');
      el.style.removeProperty('--lens');
      if (counted) mounted--;
    };
  }, [ref, enabled, degrade]);
}
