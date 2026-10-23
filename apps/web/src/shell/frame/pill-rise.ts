/**
 * The page pill's rise over a bar that would touch it (01-frame F11 §2, spec 01.6), on a spring
 * that keeps its speed through a turn (MOT-18; language.md §7.3 *bar morph*; Q-10).
 *
 * The rise follows the capsule's width, so a morph that widens the dock and then turns back (a
 * Markup opened and closed at once) raises and lowers the pill within one flight. As a CSS
 * transition each turn started again from rest, a corner in its path; here the new place applies
 * at once (`data-raised`, with the transform's transition off for that one change) and
 * `shift()` springs the pill into it from where it was drawn, on `quick` as before, carrying the
 * velocity of a rise still in flight. The pill's first place is not animated: a pill that mounts
 * over a wide bar is simply raised.
 */
import { shift } from '../../motion/shift';

const placed = new WeakSet<HTMLElement>();

/** The vertical offset the stylesheet's `transform` gives `el` now (px). */
function offsetY(el: HTMLElement): number {
  const transform = getComputedStyle(el).transform;
  if (!transform || transform === 'none') return 0;
  try {
    return new DOMMatrixReadOnly(transform).m42;
  } catch {
    return 0;
  }
}

/** Raises `pill` (or lowers it) to its place, springing from where it was drawn. */
export function raisePill(pill: HTMLElement, rise: boolean): void {
  const first = !placed.has(pill);
  placed.add(pill);
  if (pill.hasAttribute('data-raised') === rise) return;
  if (first) {
    pill.toggleAttribute('data-raised', rise);
    return;
  }
  const before = offsetY(pill);
  // The new place applies at once: no transition of `transform` for this one change (the fade
  // and the press keep theirs). Read back while it is off, so the change is already styled.
  pill.style.transitionProperty = 'opacity, scale';
  pill.toggleAttribute('data-raised', rise);
  const after = offsetY(pill);
  pill.style.removeProperty('transition-property');
  shift(pill, 0, before - after, 'quick');
}
