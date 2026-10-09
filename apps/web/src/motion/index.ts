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
 * - `tokens.ts`: the motion tokens for script, the twins of `styles/motion.css` (D3-4): ease
 *   durations with their reduced values, press scales (02.5), the sheet push and the ring.
 * - `resize.ts`: `springWidth()`, a floating piece following its content's width on `smooth`
 *   (Q-6's own geometry, G6), and `restingWidth()` for whoever measures it mid-flight.
 * - `catalogue.ts`: the catalogue entries that run from script (§7.3): `sheetPush` (X8),
 *   `ringFlash` (*undo reveal*), `revealWhenShown` (*find step*, 05.2), `fold` (02.6).
 * - `feedback.ts`: `shake` (*refusal*), `receivePulse` (*receive*), `navPush` (the iOS
 *   navigation push) and `disclose` (a folded section's height spring), shared by forms, sheets and the compact edition (motion-2026-10).
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
export { fold, type RingColour, revealWhenShown, ringFlash, sheetPush } from './catalogue';
export { disclose, navPush, receivePulse, shake } from './feedback';
export { flip } from './flip';
export { reducedMotion, subscribeReducedMotion, systemReducedMotion } from './reduced-motion';
export {
  RESIZING,
  restingWidth,
  springWidth,
  type SpringWidthOptions,
  TARGET_WIDTH,
} from './resize';
export {
  type LinearEasing,
  type Spring,
  type SpringName,
  settleTime,
  solve,
  springs,
  springToLinear,
} from './springs';
export {
  DURATION_MS,
  type DurationName,
  duration,
  EASE,
  ENTER_SCALE,
  EXIT_SCALE,
  LARGE_SURFACE_PX,
  LOOP_MS,
  MOTION_TOKENS,
  PRESS_SCALE,
  type PressPointer,
  pressScale,
  REDUCED_DURATION_MS,
  RING_FLASH,
  RISE_PX,
  SHEET_PUSH_PX,
  SPRING_CSS_MS,
  TOOLTIP_SCALE,
  VT_MS,
  VT_REDUCED_MS,
} from './tokens';
export { project, rubberBand, type VelocityTracker, velocityTracker } from './velocity';
export { VIEW_TRANSITION_MS, viewTransition } from './view-transition';
