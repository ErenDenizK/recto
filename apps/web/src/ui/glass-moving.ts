/**
 * Glass that grows out of a control is solid while it moves (MOT-12; R22 brief C-5): a popup,
 * a sheet or a phone menu coming out of its trigger by a transform draws its tier's solid twin
 * with an unblurred rim (`data-glass-moving`, `materials.css`), so no frame of the growth re-blurs
 * the backdrop under a scaling layer or repaints a soft shadow. Once it rests, the filter comes
 * back under the still opaque fill and the tint and the shadow fade in over `--duration-fast`
 * (`data-glass-settle`): the glass clears where it stands. At rest neither attribute is left
 * (Q-2). Callers skip it under reduced motion, where nothing grows (§7.5).
 */
import { duration } from '../motion/tokens';

const MOVING = 'data-glass-moving';
const SETTLE = 'data-glass-settle';
const settling = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** `el` draws its solid twin from now until `glassSettle()`. */
export function glassMoving(el: Element): void {
  clearTimeout(settling.get(el));
  el.removeAttribute(SETTLE);
  el.setAttribute(MOVING, '');
}

/**
 * `el` has come to rest: its glass fades back in (from its solid twin, or from whatever it drew
 * while it stepped aside); nothing is left once it has.
 */
export function glassSettle(el: Element): void {
  el.setAttribute(SETTLE, '');
  el.removeAttribute(MOVING);
  clearTimeout(settling.get(el));
  // A frame past the fade, so the transition runs out on the attribute that carries it.
  settling.set(
    el,
    setTimeout(() => el.removeAttribute(SETTLE), duration('fast') + 40),
  );
}
