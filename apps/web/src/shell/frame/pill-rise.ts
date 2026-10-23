/**
 * The page pill's rise over a bar that would touch it (01-frame F11 §2, spec 01.6), on a spring
 * that keeps its speed through a turn (MOT-18; language.md §7.3 *bar morph*; Q-7, Q-10).
 *
 * The rise follows the capsule's width, so a morph that widens the dock and then turns back (a
 * Markup opened and closed at once) raises and lowers the pill within one flight. As a CSS
 * transition each turn started again from rest, a corner in its path. Here the rise is the pill's
 * resting place (`bottom`, `PagePill.module.css`), which no transition touches: the new place
 * applies at once and `shift()` springs the pill into it by `translate` from where it was drawn,
 * on `quick` as before, carrying the velocity of a rise still in flight (a shift in flight is a
 * turn, started on the present frame). The Focus step keeps its own `transform` transition.
 *
 * One pass, one extra read: the place drawn is read while layout is still clean from the
 * caller's measures, then the rise and the bar's height (`--dock-h`, which sets how high a
 * raised pill sits) are written together and the new place read once, so a rise and a taller
 * palette arriving in the same pass are one move. The pill's first place is not animated: a pill
 * that mounts over a wide bar is simply raised.
 */
import { shift } from '../../motion/shift';

const placed = new WeakSet<HTMLElement>();

/**
 * Raises `pill` (or lowers it) to its place, with `dockH` (a CSS length, or null to leave it) as
 * the height of the bar it rises over, springing from where it was drawn.
 */
export function raisePill(pill: HTMLElement, rise: boolean, dockH: string | null = null): void {
  const first = !placed.has(pill);
  placed.add(pill);
  const sameRise = pill.hasAttribute('data-raised') === rise;
  const sameHeight = dockH === null || pill.style.getPropertyValue('--dock-h') === dockH;
  if (sameRise && sameHeight) return;
  // The place drawn, before anything is written (layout is clean from the caller's reads).
  const before = first ? 0 : pill.offsetTop;
  if (dockH !== null) pill.style.setProperty('--dock-h', dockH);
  pill.toggleAttribute('data-raised', rise);
  if (first) return;
  shift(pill, 0, before - pill.offsetTop, 'quick');
}
