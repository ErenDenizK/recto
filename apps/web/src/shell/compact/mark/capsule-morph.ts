/**
 * The phone capsule's morph between reading and the edit island (`design/phone-2026-10/
 * README.md` §2; quality bar Q-6, the full edition's capsule signature): one glass element
 * whose own width springs from the box it had to the box its new content gives it, on
 * `smooth` with no bounce, while the new content fades in once the moving edge has made room
 * for it. The capsule sits centred in its dock row, so its position follows the width; the edit
 * button folds or unfolds beside it on the same spring (`CompactChrome.module.css`). Nothing is
 * left inline at rest (Q-2). Reduced motion: the width jumps, the content fades in 150 ms.
 */
import { animateStyle } from '../../../motion/animate';
import { reducedMotion } from '../../../motion/reduced-motion';
import { REDUCED_DURATION_MS } from '../../../motion/tokens';

/** The new content fades in after this, once the moving edge has started to make room. */
const CONTENT_DELAY_MS = 90;
const CONTENT_FADE_MS = 200;

/**
 * Morphs `capsule` from `from` (its box before the content changed) to its box now; with
 * `content: false` (a reshape within one content) the pieces stay as they are.
 */
export function morphCapsule(
  capsule: HTMLElement,
  from: DOMRect,
  { content = true }: { readonly content?: boolean } = {},
): void {
  const to = capsule.getBoundingClientRect();
  const reduced = reducedMotion();
  for (const child of content ? capsule.children : []) {
    child.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: reduced ? REDUCED_DURATION_MS.base : CONTENT_FADE_MS,
      delay: reduced ? 0 : CONTENT_DELAY_MS,
      easing: 'ease-out',
      fill: 'backwards',
    });
  }
  if (reduced || Math.abs(to.width - from.width) < 1) return;
  // The new content is laid out at its own width; until the edge has passed it, it is clipped
  // to the moving shape rather than spilling over the glass's rim.
  capsule.style.overflow = 'clip';
  const motion = animateStyle(capsule, 'width', from.width, to.width, { spring: 'smooth' });
  void motion.finished.then(() => {
    capsule.style.overflow = '';
  });
}
