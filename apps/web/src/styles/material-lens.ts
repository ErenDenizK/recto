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
 *   A map costs about 1–3 ms once per size; it is redrawn 150 ms after a size change. The map
 *   (`lens-map.ts`) and the bars' manager (`glass-runtime.ts`) load after the first paint.
 * - **Off** on a coarse pointer, under Glass Tinted or Solid, Reduce motion, any OS
 *   transparency or contrast preference, forced colours, from the cost ladder's first step,
 *   while the surface animates (its own transitions and animations), and past three lenses on
 *   screen: each costs the SVG filter's main-thread paint per scrolled frame (research 16 §5.3),
 *   measured in GLS-11.
 */
import { type RefObject, useEffect } from 'react';

import { reducedMotion } from '../motion/reduced-motion';
import { SOFTWARE_RENDERER, useRenderQualityStore, webglRenderer } from '../state/render-quality';

/** At most this many lenses at once (language.md §2.7, GLS-11). */
export const MAX_LENSES = 3;
/** How long after a size change a map is redrawn, ms. */
export const REGENERATE_MS = 150;

/** Lenses on screen, chips' and bars' together. */
export const lensCount = { mounted: 0 };

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

/** Takes the lens off `el`. */
export function lensOff(el: HTMLElement): void {
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
      if (allowed && !counted && lensCount.mounted >= MAX_LENSES) return;
      if (!allowed) {
        lensOff(el);
        if (counted) {
          counted = false;
          lensCount.mounted--;
        }
        return;
      }
      if (!counted) {
        counted = true;
        lensCount.mounted++;
      }
      // The map's code loads with the first lens (it is not in the first closures).
      void import('./lens-map').then(({ lensOn }) => {
        if (counted && el.isConnected) lensOn(el);
      });
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
      if (counted) lensCount.mounted--;
    };
  }, [ref, enabled, degrade]);
}
