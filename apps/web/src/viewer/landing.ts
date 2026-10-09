/**
 * The landing highlight (motion-2026-10 viewer.md §1): once a jump has landed, the page it went
 * to, or the region it revealed (an outline entry's or a link's destination, a review row),
 * takes a soft ring of the page's selection blue that comes in on `--duration-fast`, holds, and
 * fades on `--duration-slow`; then the element goes (Q-2, Q-10: nothing at rest). It is one Web
 * Animation on opacity. Under reduced motion the ring is shown still for the same time and then
 * removed, as the undo reveal's ring is (§7.5).
 *
 * A find hit carries its own ring (the *find step*), so the search asks for no landing. An undo
 * or redo flashes what it changed itself (`pdf-editor:history-applied`, frame.md §6): a landing on
 * screen gives way to it (`clearLandings`), so one step never shows two highlights.
 */
import { reducedMotion } from '../motion/reduced-motion';
import { DURATION_MS, EASE } from '../motion/tokens';
import type { Box } from './geometry';
import styles from './Landing.module.css';

/** Held at full strength between the fade in and the fade out (ms). */
export const LANDING_HOLD_MS = 260;
/** The whole highlight (ms): in, hold, out. */
export const LANDING_MS = DURATION_MS.fast + LANDING_HOLD_MS + DURATION_MS.slow;
/** A region's ring sits this far outside it (px). */
const REGION_PAD = 4;

const shown = new WeakMap<Element, HTMLElement>();

/**
 * Highlights `page` (a page sheet), or the `box` of it (CSS px from the sheet's top-left).
 * A new landing on the same page replaces the last. Returns the animation, if one ran.
 */
export function flashLanding(page: HTMLElement, box?: Box): Animation | undefined {
  shown.get(page)?.remove();
  const ring = page.ownerDocument.createElement('div');
  ring.className = styles.landing ?? '';
  ring.dataset.landing = '';
  ring.setAttribute('aria-hidden', 'true');
  if (box) {
    ring.dataset.region = '';
    Object.assign(ring.style, {
      left: `${box.left - REGION_PAD}px`,
      top: `${box.top - REGION_PAD}px`,
      width: `${box.width + REGION_PAD * 2}px`,
      height: `${box.height + REGION_PAD * 2}px`,
    });
  } else {
    ring.style.inset = '0';
  }
  page.append(ring);
  shown.set(page, ring);
  const remove = () => {
    ring.remove();
    if (shown.get(page) === ring) shown.delete(page);
  };
  if (typeof ring.animate !== 'function') {
    remove();
    return undefined;
  }
  const inAt = DURATION_MS.fast / LANDING_MS;
  const holdTo = (DURATION_MS.fast + LANDING_HOLD_MS) / LANDING_MS;
  const frames: Keyframe[] = reducedMotion()
    ? [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: 1 },
      ]
    : [
        { opacity: 0, offset: 0, easing: EASE.out },
        { opacity: 1, offset: inAt },
        { opacity: 1, offset: holdTo, easing: EASE.standard },
        { opacity: 0, offset: 1 },
      ];
  const flash = ring.animate(frames, { duration: LANDING_MS, easing: 'linear' });
  flash.onfinish = flash.oncancel = remove;
  return flash;
}

/** Removes every landing highlight inside `root` (an undo's own flash takes over). */
export function clearLandings(root: ParentNode): void {
  for (const ring of root.querySelectorAll<HTMLElement>('[data-landing]')) {
    for (const animation of ring.getAnimations()) animation.cancel();
    ring.remove();
  }
}
