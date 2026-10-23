/**
 * `shift()`: an element whose resting place has just moved springs into it from where it was
 * drawn, with the velocity it already had (MOT-18; language.md §7.4; quality-bar Q-2, Q-7, Q-10).
 *
 * For a place the stylesheet owns (a state attribute that changes a `transform`, such as the page
 * pill's rise over a bar): the caller lets the new place apply at once, with the stylesheet's
 * transition off for it, then calls `shift()` with how far the element jumped. The spring runs on
 * the `translate` property, which composes with the stylesheet's `transform`, from minus that
 * jump to zero on the compositor (`animateStyle()`), so nothing is laid out per frame. A second
 * shift while one runs adds its jump to where the element is drawn and keeps the speed, so a turn
 * is a curve instead of a corner, where a CSS transition that reverses starts again from rest; it
 * starts on the present frame (`turn`), so the turn holds no frame. At
 * rest the inline `translate` goes (Q-2). Reduced motion: the jump stands (§7.5).
 */
import { animateStyle, type Motion, type Styled, stopStyle } from './animate';
import type { SpringName } from './springs';

/** Moves smaller than this (CSS px) are not animated. */
const STILL = 0.5;

/**
 * Springs `el` from `dx`, `dy` px away (where it was drawn before its place moved) into its
 * place on `spring`; returns the motion, or null when there is nothing to move.
 */
export function shift(
  el: Styled,
  dx: number,
  dy: number,
  spring: SpringName = 'quick',
): Motion<readonly number[]> | null {
  const running = stopStyle(el, 'translate');
  const [x = 0, y = 0] = running?.value ?? [];
  const [vx = 0, vy = 0] = running?.velocity ?? [];
  const from = [x + dx, y + dy];
  if (Math.hypot(from[0] ?? 0, from[1] ?? 0) < STILL && Math.hypot(vx, vy) < STILL) return null;
  // A shift in flight is a turn: the new segment starts on this frame, never a held one later.
  return animateStyle(el, 'translate', from, [0, 0], {
    spring,
    velocity: [vx, vy],
    turn: running !== undefined,
  });
}
