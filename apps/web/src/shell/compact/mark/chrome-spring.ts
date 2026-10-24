/**
 * The phone chrome's spring when a scroll hides it or brings it back (MOT-16; R22 brief C-6, the
 * owner: "a fast scroll can go off with a quick boing, a slow one can settle slowly"). The top's
 * pieces, the capsule and ✎ move by their CSS transitions of `transform` and `opacity` (the
 * compositor's, A-23: a scroll starts nothing that costs layout or paint). As a scroll flips
 * them, its speed picks one of four springs for that move (`data-chrome-spring` on the root, read
 * by `CompactChrome.module.css`), each a `linear()` curve that starts at its step's speed, as a
 * sheet's release does (`sheet-release.ts`):
 *
 * - a slow scroll (under 300 px/s) eases away on a long spring with no bounce, about 0.9 s;
 * - a fling (1 800 px/s or more) leaves fast on a shorter spring with a small overshoot, bounce
 *   0.2, which coming back reads as a "boing" past the rest; the steps between blend the two.
 *
 * Interruptible as CSS transitions are: a turn starts from where the piece is. The glass fades on
 * itself, late on the way out (the slide is what you see) and early on the way back. The step
 * goes a second after the move, so a tap or a sheet moves the chrome on its tokens. Reduced motion
 * keeps the tokens (the stylesheet's rules stand down): the move is instant and the fade 150 ms.
 *
 * Four steps rather than the speed itself: the curves are the stylesheet's, so the page carries a
 * comparison, not a spring solver (`chromeCurve` writes them; `chrome-spring.test.ts` holds the
 * stylesheet to it). This rides in the editing chunk, which the reader prefetches when idle
 * (`markLoaded`), to keep the static compact path under its gate (PRC-11); a scroll before it
 * has arrived moves the chrome on its tokens.
 */
import { spring, springEasing } from '../../../motion/springs';

/** The speeds that start each step above the first, px/s. */
export const SPRING_STEPS = [300, 900, 1800] as const;
/** The speed each step's curve is drawn for, px/s. */
export const STEP_SPEEDS = [150, 600, 1300, 2500] as const;
/** How far a piece travels, px (a 56 px capsule, its 12 px to the edge and a safe area). */
const TRAVEL_PX = 100;
/** The start speed carried, in travels per second (a fling past this would only clip). */
const MAX_SPEED = 12;

/** The step of a scroll at `speed` px/s. */
export const springStep = (speed: number): number => SPRING_STEPS.filter((s) => speed >= s).length;

/** The move's curve for a scroll at `speed` px/s: no bounce and long when slow, 0.2 when fast. */
export function chromeCurve(speed: number): { readonly easing: string; readonly ms: number } {
  const k = Math.min(1, Math.max(0, (speed - SPRING_STEPS[0]) / (2500 - SPRING_STEPS[0])));
  const curve = springEasing(
    spring(0.62 - 0.2 * k, 0.2 * k),
    Math.min(MAX_SPEED, speed / TRAVEL_PX),
  );
  return { easing: curve.easing, ms: curve.duration };
}

let clear: ReturnType<typeof setTimeout> | undefined;

/** Picks the spring of the move a scroll at `velocity` px/s starts now. */
export function springChrome(velocity: number): void {
  const root = document.documentElement;
  root.dataset.chromeSpring = String(springStep(Math.abs(velocity)));
  clearTimeout(clear);
  clear = setTimeout(() => delete root.dataset.chromeSpring, 1000);
}
