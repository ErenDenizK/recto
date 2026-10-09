/**
 * Signature flights (motion-2026-10 forms-compact §2; 03-markup MK-12 §6, MK-13 §6): the
 * signature is one thing that travels, never a new thing that pops up somewhere else.
 *
 * - **Placing** a saved signature: as the one-shot signature tool places it, the signature's
 *   image flies from its chip (or the Sign button) to where it lands on the page on `smooth`,
 *   arriving at 106 % and settling to 100 % on `quick`, a stamp's press; it then fades onto
 *   the page's own drawing of it (`--duration-fast`).
 * - **Use** in New signature: the pad's ink shrinks into the chip the signature now has (or
 *   the Sign button), fading as it arrives, and the chip takes a receive pulse.
 *
 * A flight is a fixed image over everything, moved by `transform` and `opacity` only, removed
 * when it ends (Q-2). Under reduced motion there is no flight: the placed signature is just
 * there, and the chip's pulse is the chrome's ring held still (`receivePulse`).
 */
import { animateStyle, duration, EASE, reducedMotion, settleTime, springs } from '../motion';
import { receivePulse } from '../motion/feedback';

/** The `smooth` spring's 99 % settle, which the Use flight's fade rides on (ms). */
const SMOOTH_MS = Math.round(settleTime(springs.smooth) * 1000);

/** A press that places arrives this much larger, then settles (a stamp). */
export const STAMP_SCALE = 1.06;

/** The image of a flight, at `to` on screen, over everything. */
function flyer(src: string, to: DOMRect): HTMLImageElement {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.dataset.signatureFlight = '';
  Object.assign(img.style, {
    position: 'fixed',
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    zIndex: '1000',
    pointerEvents: 'none',
    objectFit: 'contain',
  });
  document.body.append(img);
  return img;
}

/** The translation and scale that put `to`'s box on `from`'s, centre on centre, aspect kept. */
function inverse(from: DOMRect, to: DOMRect): [number, number, number] {
  const scale = Math.min(from.width / to.width, from.height / to.height) || 1;
  return [
    from.left + from.width / 2 - (to.left + to.width / 2),
    from.top + from.height / 2 - (to.top + to.height / 2),
    scale,
  ];
}

const fadeOut = (img: HTMLImageElement, url: string) => {
  const out = img.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: duration('fast'),
    easing: EASE.exit,
    fill: 'forwards',
  });
  out.onfinish = out.oncancel = () => {
    img.remove();
    URL.revokeObjectURL(url);
  };
};

/**
 * A still of the page as it was before the stamp was drawn into it, cut to `to`: laid over the
 * page's new drawing of the stamp while the flight is on its way, so the signature is never on
 * screen twice. `page` is a copy of the page canvas taken before the placement (`snapshot`).
 */
export function pageMask(page: { canvas: HTMLCanvasElement; rect: DOMRect }, to: DOMRect) {
  const { canvas, rect } = page;
  const mask = document.createElement('canvas');
  const ratio = canvas.width / rect.width || 1;
  mask.width = Math.max(1, Math.round(to.width * ratio));
  mask.height = Math.max(1, Math.round(to.height * ratio));
  mask.setAttribute('aria-hidden', 'true');
  Object.assign(mask.style, {
    position: 'fixed',
    left: `${to.left}px`,
    top: `${to.top}px`,
    width: `${to.width}px`,
    height: `${to.height}px`,
    zIndex: '999',
    pointerEvents: 'none',
  });
  mask
    .getContext('2d')
    ?.drawImage(
      canvas,
      (to.left - rect.left) * ratio,
      (to.top - rect.top) * ratio,
      mask.width,
      mask.height,
      0,
      0,
      mask.width,
      mask.height,
    );
  document.body.append(mask);
  return mask;
}

/** A copy of each rendered page canvas on screen now, with where it is. */
export function snapshotPages(): { canvas: HTMLCanvasElement; rect: DOMRect }[] {
  const out: { canvas: HTMLCanvasElement; rect: DOMRect }[] = [];
  for (const page of document.querySelectorAll<HTMLCanvasElement>(
    'canvas[data-state="rendered"]',
  )) {
    const rect = page.getBoundingClientRect();
    if (rect.width <= 0 || rect.bottom < 0 || rect.top > innerHeight) continue;
    const copy = document.createElement('canvas');
    copy.width = page.width;
    copy.height = page.height;
    copy.getContext('2d')?.drawImage(page, 0, 0);
    out.push({ canvas: copy, rect });
  }
  return out;
}

/**
 * The placing flight: `blob` (the armed signature's image) from `from` (its chip) to `to` (the
 * placed annotation's box on screen), then the stamp's settle and the fade onto the page.
 */
export function flyToPage(
  blob: Blob,
  from: DOMRect,
  to: DOMRect,
  mask: HTMLElement | null = null,
): void {
  if (reducedMotion() || to.width <= 0 || to.height <= 0) {
    mask?.remove();
    return;
  }
  const url = URL.createObjectURL(blob);
  const img = flyer(url, to);
  const [dx, dy, s] = inverse(from, to);
  animateStyle(img, 'transform', [dx, dy, s, s], [0, 0, STAMP_SCALE, STAMP_SCALE], {
    spring: 'smooth',
    keep: true,
    onComplete: () => {
      // Arrived, a little larger than the page's own drawing: the page may show it now.
      mask?.remove();
      animateStyle(img, 'transform', [0, 0, STAMP_SCALE, STAMP_SCALE], [0, 0, 1, 1], {
        spring: 'quick',
        onComplete: () => fadeOut(img, url),
      });
    },
  });
}

/**
 * The Use flight: `blob` (the new signature) from `from` (the pad) into `chip`, shrinking and
 * fading as it arrives; then the chip's receive pulse.
 */
export function flyIntoChip(blob: Blob, from: DOMRect, chip: Element): void {
  if (reducedMotion() || from.width <= 0 || from.height <= 0) {
    receivePulse(chip);
    return;
  }
  const url = URL.createObjectURL(blob);
  const img = flyer(url, from);
  const [dx, dy, s] = inverse(chip.getBoundingClientRect(), from);
  animateStyle(img, 'transform', [0, 0, 1, 1], [dx, dy, s, s], {
    spring: 'smooth',
    keep: true,
    onComplete: () => {
      img.remove();
      URL.revokeObjectURL(url);
      receivePulse(chip);
    },
  });
  // The ink thins out over the last part of the way, so it is inside the chip as it lands.
  img.animate([{ opacity: 1 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], {
    duration: SMOOTH_MS,
    easing: 'linear',
    fill: 'forwards',
  });
}
