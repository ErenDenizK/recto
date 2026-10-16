/**
 * The liquid menu (DSN-39; owner's choice DSN-37, research 23 §4 item 4 and §8 row 3): the split
 * top's ⋯ menu and file menu come out of their button as one glass body. While the menu opens
 * (about 450 ms) its own glass is masked by the smooth union of the button's shape and a blob
 * that leaves the button, swells and squares into the menu (`liquid-mask.ts`, GLS-3, GLS-4: a
 * mask, never `clip-path`), so a neck of glass joins the two until the menu swallows the button;
 * closing runs back into it. The menu lies over its button (DSN-36), so the union never leaves
 * the menu's box, and the mask shapes the menu's one backdrop-filtered layer: no second glass.
 *
 * - The content never scales (MOT-5): it only fades in after the blob has left the button, and
 *   out first on the way back.
 * - Choreography after Liquid DOM's showcase menu (MIT, research 23 §2.1), the button kept in
 *   place: the blob's centre on a spring (144 / 14 open, 130 / 18 back), its size on
 *   cubic-bezier(0.8, 0.3, 0.5, 0.8) over 300 ms, its corners over the run.
 * - The body keeps a rim while it moves (DSN-42): the mask cuts the material's border and
 *   shadows to the box's corners, so the union's outline is stroked in the rim's top-lit
 *   gradient (`outlineRim`) on a layer over the glass (`--liquid-rim`, `.menu[data-liquid]`).
 * - Ends clean: at rest no mask, no rim, no attribute, no inline style (Q-2). Base UI waits for the
 *   popup's Web Animations before it unmounts it, so the close holds one (an opacity that ends
 *   at 0, where the button takes over).
 * - At once (no motion) for a keyboard or dismissal close (`data-instant`) and the menu → sheet
 *   hand-off (`ui/menu-handoff.ts`, Q-7). Reduced motion: a fade, 150 ms in, 100 ms out (A-9).
 *
 * These menus do not carry `ct-popup`: the container transform (DSN-36) serves the capsule
 * top's ⋯ and every other popup. This module and `liquid-mask.ts` load lazily, once the browser
 * is idle (`liquid-ref.ts`), outside the compact chunk.
 */
import { reducedMotion } from '../../motion/reduced-motion';
import {
  cubicBezier,
  type LiquidRect,
  outlineMask,
  outlineRim,
  rimColorsOf,
  type RimColors,
  springProgress,
  unionOutline,
} from './liquid-mask';

/** The fillet between the button and the blob, CSS px. */
export const LIQUID_NECK = 24;
/** One run's length, ms: the spring has settled within a pixel by then. */
export const LIQUID_OPEN_MS = 460;
export const LIQUID_CLOSE_MS = 360;
const SIZE_MS = 300;
const OPEN = { stiffness: 144, damping: 14 };
const CLOSE = { stiffness: 130, damping: 18 };
const sizeEase = cubicBezier(0.8, 0.3, 0.5, 0.8);
const easeOut = cubicBezier(0.2, 0, 0, 1);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** An element's top-left corner radius in px for its box (a capsule is half its height). */
function radiusOf(el: Element, rect: DOMRect): number {
  const value = getComputedStyle(el).borderTopLeftRadius;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  const px = value.endsWith('%') ? (Math.min(rect.width, rect.height) * n) / 100 : n;
  return Math.min(px, rect.width / 2, rect.height / 2);
}

const rectOf = (r: DOMRect, radius: number): LiquidRect => ({
  x: r.x,
  y: r.y,
  width: r.width,
  height: r.height,
  radius,
});

/**
 * The blob between `from` and `to` at time `t` of a run: its centre on the spring, its size on
 * the slow-start ease (so it leaves the button before it grows), its corners eased.
 */
export function blobAt(
  from: LiquidRect,
  to: LiquidRect,
  t: number,
  spring: { readonly stiffness: number; readonly damping: number },
  total: number,
): LiquidRect {
  const c = springProgress(spring.stiffness, spring.damping, t / 1000);
  const s = sizeEase(clamp01(t / SIZE_MS));
  const r = easeOut(clamp01(t / total));
  const width = lerp(from.width, to.width, s);
  const height = lerp(from.height, to.height, s);
  const cx = lerp(from.x + from.width / 2, to.x + to.width / 2, c);
  const cy = lerp(from.y + from.height / 2, to.y + to.height / 2, c);
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    radius: lerp(from.radius, to.radius, r),
  };
}

/** The content's opacity at `t` ms: after the blob has left the button, never while it shrinks. */
export function contentOpacity(opening: boolean, t: number): number {
  return opening ? clamp01((t - 110) / 240) : 1 - clamp01(t / 120);
}

const HIDDEN_MASK = 'linear-gradient(transparent, transparent)';

/**
 * Serves one menu popup from mount to unmount; returns the cleanup. `trigger` is read when the
 * popup has been placed (its control may name it only in the same commit).
 */
export function liquidPopup(popup: HTMLElement, trigger: () => HTMLElement | null): () => void {
  const root = document.documentElement;
  const positioner = popup.parentElement ?? popup;
  let frame = 0;
  let hold: Animation | null = null;
  /** The blob as last drawn, in viewport px; a turn mid-run starts from it. */
  let blob: LiquidRect | null = null;
  let opener: HTMLElement | null = null;

  const setMask = (value: string) => {
    popup.style.setProperty('-webkit-mask-image', value);
    popup.style.setProperty('mask-image', value);
  };
  /** The union's mask and, over the glass, its rim (DSN-42): one outline for both. */
  let rim: RimColors | null = null;
  const setShape = (shapes: readonly LiquidRect[], box: DOMRect, k: number) => {
    const outline = unionOutline(box, shapes, k);
    setMask(outlineMask(outline));
    rim ??= rimColorsOf(popup);
    popup.style.setProperty('--liquid-rim', outlineRim(outline, rim));
  };
  const clean = () => {
    cancelAnimationFrame(frame);
    for (const name of ['-webkit-mask-image', 'mask-image', 'mask-repeat', '-webkit-mask-repeat']) {
      popup.style.removeProperty(name);
    }
    popup.style.removeProperty('--liquid-content');
    popup.style.removeProperty('--liquid-rim');
    delete popup.dataset.liquid;
  };
  const atOnce = () => popup.hasAttribute('data-instant') || root.hasAttribute('data-menu-handoff');

  if (reducedMotion()) {
    // §7.5: the fade alone.
    popup.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
    const watch = new MutationObserver(() => {
      if (!popup.hasAttribute('data-ending-style') || hold) return;
      hold = popup.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: atOnce() ? 1 : 100,
        easing: 'ease-in',
        fill: 'forwards',
      });
    });
    watch.observe(popup, { attributes: true, attributeFilter: ['data-ending-style'] });
    return () => watch.disconnect();
  }

  popup.dataset.liquid = '';
  popup.style.setProperty('mask-repeat', 'no-repeat');
  popup.style.setProperty('-webkit-mask-repeat', 'no-repeat');
  popup.style.setProperty('--liquid-content', '0');
  setMask(HIDDEN_MASK);

  const run = (opening: boolean) => {
    cancelAnimationFrame(frame);
    const total = opening ? LIQUID_OPEN_MS : LIQUID_CLOSE_MS;
    const spring = opening ? OPEN : CLOSE;
    // Read once: Base UI drops the trigger's `aria-controls` as the menu closes.
    opener ??= trigger();
    const control = opener;
    if (!control) {
      clean();
      return;
    }
    const box = popup.getBoundingClientRect();
    const button = control.getBoundingClientRect();
    const buttonShape = rectOf(button, radiusOf(control, button));
    const menuShape = rectOf(box, radiusOf(popup, box));
    const from = blob ?? buttonShape;
    const to = opening ? menuShape : buttonShape;
    hold?.cancel();
    hold = opening
      ? null
      : popup.animate([{ opacity: 1 }, { opacity: 1, offset: 0.97 }, { opacity: 0 }], {
          duration: total,
          fill: 'forwards',
        });
    const start = performance.now();
    const step = (now: number) => {
      if (!popup.isConnected) return;
      const t = now - start;
      if (atOnce()) {
        hold?.finish();
        clean();
        return;
      }
      if (t >= total) {
        blob = to;
        if (opening) clean();
        else setShape([buttonShape], box, 0);
        return;
      }
      blob = blobAt(from, to, t, spring, total);
      // The trigger may have moved (a rotation); the menu's box is its own, unscaled.
      setShape([buttonShape, blob], box, LIQUID_NECK);
      popup.style.setProperty('--liquid-content', contentOpacity(opening, t).toFixed(3));
      frame = requestAnimationFrame(step);
    };
    step(start);
  };

  const begin = () => {
    if (!popup.isConnected) return;
    if (popup.hasAttribute('data-ending-style') || popup.hasAttribute('data-instant')) {
      clean();
      return;
    }
    run(true);
  };

  // Base UI's positioner rests at opacity 0 until it has placed the popup.
  let placed: MutationObserver | null = null;
  if (positioner.style.opacity === '0') {
    placed = new MutationObserver(() => {
      if (positioner.style.opacity === '0') return;
      placed?.disconnect();
      placed = null;
      begin();
    });
    placed.observe(positioner, { attributes: true, attributeFilter: ['style'] });
  } else {
    frame = requestAnimationFrame(begin);
  }

  const ending = new MutationObserver(() => {
    const closing = popup.hasAttribute('data-ending-style');
    if (closing) {
      if (atOnce() || popup.hasAttribute('data-instant')) {
        clean();
        hold = popup.animate([{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' });
        return;
      }
      popup.dataset.liquid = '';
      popup.style.setProperty('mask-repeat', 'no-repeat');
      popup.style.setProperty('-webkit-mask-repeat', 'no-repeat');
      run(false);
    } else if (hold) {
      // Reopened while it closed: back out from where it is.
      run(true);
    }
  });
  ending.observe(popup, { attributes: true, attributeFilter: ['data-ending-style'] });

  return () => {
    placed?.disconnect();
    ending.disconnect();
    cancelAnimationFrame(frame);
  };
}

/** The control that opened `popup`: Base UI's trigger names it in `aria-controls`. */
function triggerOf(popup: HTMLElement): HTMLElement | null {
  if (!popup.id) return null;
  return document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(popup.id)}"]`);
}

/** Serves `popup` grown out of the control that opened it (`liquid-ref.ts` attaches it). */
export function liquidPopupFor(popup: HTMLElement): () => void {
  return liquidPopup(popup, () => triggerOf(popup));
}
