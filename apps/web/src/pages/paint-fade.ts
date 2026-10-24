/**
 * How page bitmaps arrive (motion-2026-10 viewer.md §3): never a cut from white to content, or
 * from soft to sharp.
 *
 * - `fadeIn`: a bitmap drawn over the bare white sheet (the first render of a page, a high-zoom
 *   tile over the capped bitmap) comes in on `--duration-base` `--ease-out`.
 * - `crossFadeFrom`: a sharper render replacing a stretched preview (after a zoom) is drawn at
 *   once underneath, while a copy of the preview fades out above it on `--duration-base`, so
 *   the page sharpens instead of blinking. Only for a change of scale: a bitmap with new content
 *   (fresh ink) swaps in the same frame, as the dry ink hand-over needs (craft spec §5.3 item 7).
 *
 * Both are one Web Animation on opacity: nothing is left on the canvas, and the copy is removed
 * when its fade ends (Q-2, Q-10). Under reduced motion the fades keep their reduced 150 ms
 * (§7.5, A-9).
 */
import { duration, EASE } from '../motion/tokens';
import { SOFT_OPACITY } from './placeholder';

/** Larger previews are swapped without a copy (it would cost a second large bitmap). */
const MAX_GHOST_PIXELS = 16 * 1024 * 1024;

/** Fades `el` in from transparent to `to` (module header; 1, or a soft bitmap's veil). */
export function fadeIn(el: HTMLElement, to = 1): Animation | undefined {
  if (typeof el.animate !== 'function') return undefined;
  return el.animate([{ opacity: 0 }, { opacity: to }], {
    duration: duration('base'),
    easing: EASE.out,
  });
}

/** Fades `el` from opacity `from` to nothing and removes it. */
function fadeAway(el: HTMLElement, from: number): Animation {
  const fade = el.animate([{ opacity: from }, { opacity: 0 }], {
    duration: duration('base'),
    easing: EASE.out,
    fill: 'forwards',
  });
  fade.onfinish = fade.oncancel = () => el.remove();
  return fade;
}

/**
 * Lays a copy of what `canvas` shows now above it and fades the copy out, so whatever is drawn
 * into `canvas` next shows through as it goes (module header). Returns the fade, if one ran.
 */
export function crossFadeFrom(canvas: HTMLCanvasElement): Animation | undefined {
  const { width, height } = canvas;
  if (width === 0 || height === 0 || width * height > MAX_GHOST_PIXELS) return undefined;
  if (!canvas.isConnected || typeof canvas.animate !== 'function') return undefined;
  const ghost = canvas.ownerDocument.createElement('canvas');
  ghost.width = width;
  ghost.height = height;
  const context = ghost.getContext('2d');
  if (!context) return undefined;
  try {
    context.drawImage(canvas, 0, 0);
  } catch {
    return undefined;
  }
  ghost.className = canvas.className;
  if ('soft' in canvas.dataset) ghost.dataset.soft = '';
  ghost.dataset.ghost = '';
  ghost.setAttribute('aria-hidden', 'true');
  canvas.after(ghost);
  // From what shows now: a soft bitmap's veil, not full strength.
  return fadeAway(ghost, 'soft' in canvas.dataset ? SOFT_OPACITY : 1);
}

/**
 * The first render over a bare sheet (nothing was shown): a copy of the paper tone lies over the
 * bitmap and fades out, so the page comes up out of the paper while the sheet itself already
 * has its exact colour (DSN-64: a rendered sheet is never tinted).
 */
export function paperFade(canvas: HTMLCanvasElement): Animation | undefined {
  if (!canvas.isConnected || typeof canvas.animate !== 'function') return undefined;
  const veil = canvas.ownerDocument.createElement('div');
  veil.dataset.ghost = '';
  veil.setAttribute('aria-hidden', 'true');
  Object.assign(veil.style, {
    position: 'absolute',
    inset: '0',
    background: 'var(--page-paper)',
    pointerEvents: 'none',
  });
  canvas.after(veil);
  return fadeAway(veil, 1);
}
