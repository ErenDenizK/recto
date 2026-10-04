/**
 * The motion core (09-primitives §31; language.md §7; ADR-0026; spec D0-12): the in-house route
 * for what CSS transitions cannot do, under 3 KB gzip and with no animation library.
 *
 * - `springs.ts`: the seven spring tokens, the analytic solver, settle times (A-10) and
 *   `springToLinear()` for the CSS curves (§7.1–§7.2).
 * - `animate.ts`: `animate()` for script values on one requestAnimationFrame loop that stops at
 *   rest, and `animateStyle()` for elements on Web Animations; both retarget with velocity
 *   (Q-10) and leave no transform or `will-change` at rest (Q-2).
 * - `flip.ts`: FLIP with scale, interruption and retarget (§7.3 *reflow*).
 * - `velocity.ts`: `velocityTracker()`, `project()`, `rubberBand()` (research 18 §9).
 * - `reduced-motion.ts`: `reducedMotion()` from the OS query or `data-motion`, the only source
 *   script asks (§7.5–§7.6, A-9).
 * - `view-transition.ts`: `viewTransition()` at 240 ms (§7.4).
 *
 * CSS transitions with `linear()` springs and Base UI's starting and ending styles remain the
 * first route for popups, bars, press and feedback (§7.4); gestures live in `motion/gesture/`.
 */
export {
  type AnimateOptions,
  animate,
  animateStyle,
  type Motion,
  type MotionValue,
  type StyleOptions,
  type StyleProperty,
  type Styled,
} from './animate';
export { flip } from './flip';
export { reducedMotion, subscribeReducedMotion } from './reduced-motion';
export {
  type LinearEasing,
  type Spring,
  type SpringName,
  settleTime,
  solve,
  springs,
  springToLinear,
} from './springs';
export { project, rubberBand, type VelocityTracker, velocityTracker } from './velocity';
export { VIEW_TRANSITION_MS, viewTransition } from './view-transition';
