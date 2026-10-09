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

/** Larger previews are swapped without a copy (it would cost a second large bitmap). */
const MAX_GHOST_PIXELS = 16 * 1024 * 1024;

/** Fades `el` in from transparent (module header). */
export function fadeIn(el: HTMLElement): Animation | undefined {
  if (typeof el.animate !== 'function') return undefined;
  return el.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: duration('base'),
    easing: EASE.out,
  });
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
  ghost.dataset.ghost = '';
  ghost.setAttribute('aria-hidden', 'true');
  canvas.after(ghost);
  const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: duration('base'),
    easing: EASE.out,
    fill: 'forwards',
  });
  fade.onfinish = fade.oncancel = () => ghost.remove();
  return fade;
}
