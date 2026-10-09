/**
 * The motion tokens for script (language.md §7.1–§7.3, §7.5; ADR-0026 §2 items 1, 2, 8; spec
 * redesign D3-4): the same values `styles/motion.css` gives CSS, so a component that animates
 * from script picks from the same list as one that transitions in CSS. `motion.test.ts` holds
 * the two files to each other and to `springs.ts`.
 *
 * - Springs move position, size and scale: `springs` (physics, for `animate()` and
 *   `animateStyle()`) and `SPRING_CSS_MS` (the CSS durations of `--spring-*`).
 * - Eases move opacity and colour: `duration()` answers the reduced value when motion is
 *   reduced (0 · 100 · 150 · 150 ms), and `EASE` holds the cubic curves.
 * - The catalogue's numbers: the press scales with 02.5's large surfaces (`pressScale()`), the
 *   entrance distances, X8's sheet push, and the undo reveal's ring timing (A-10's 500 ms).
 *
 * Reduced motion has one source, `reducedMotion()`; every function here asks it at call time.
 */
import { reducedMotion } from './reduced-motion';
import type { SpringName } from './springs';

/** The four ease durations (§7.1), ms. */
export type DurationName = 'instant' | 'fast' | 'base' | 'slow';

/** `--duration-*`: hover · exits, tooltips, icon replace · entry fades, scrims · cross-fades. */
export const DURATION_MS: Readonly<Record<DurationName, number>> = {
  instant: 60,
  fast: 120,
  base: 180,
  slow: 280,
};

/** `--duration-*` under reduced motion (§7.5): fades kept, never longer than 150 ms (A-9). */
export const REDUCED_DURATION_MS: Readonly<Record<DurationName, number>> = {
  instant: 0,
  fast: 100,
  base: 150,
  slow: 150,
};

/** The ease duration `name` now, reduced when motion is (ms). */
export function duration(name: DurationName): number {
  return (reducedMotion() ? REDUCED_DURATION_MS : DURATION_MS)[name];
}

/** `--ease-out`, `--ease-exit`, `--ease-standard` (§7.1). */
export const EASE = {
  /** Entering fades. */
  out: 'cubic-bezier(0.2, 0, 0, 1)',
  /** Leaving fades and scales. */
  exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  /** Progress fills. */
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

/**
 * `--spring-*`: each spring's CSS duration, the time to within 0.1 % of the target (§7.1). The
 * curve for all five zero-bounce tokens is `--ease-spring`; fling and pop have their own. Under
 * reduced motion every one is 0 (spatial change instant).
 */
export const SPRING_CSS_MS: Readonly<Record<SpringName, number>> = {
  press: 300,
  quick: 420,
  smooth: 530,
  glide: 680,
  fling: 560,
  pop: 410,
  track: 150,
};

/** `--vt-duration` (§7.4) and its reduced root cross-fade (§7.5). */
export const VT_MS = 240;
export const VT_REDUCED_MS = 150;

/** What presses (§7.3 *press*): a finger or pen presses deeper than a mouse. */
export type PressPointer = 'mouse' | 'touch' | 'pen';

/** `--press-scale-*` (§7.3; spec 02.5 for surfaces of 120 px or more). */
export const PRESS_SCALE = {
  mouse: 0.97,
  touch: 0.94,
  largeMouse: 0.98,
  largeTouch: 0.96,
} as const;

/** From this size (the smaller side, CSS px) a surface presses with the large scale (02.5). */
export const LARGE_SURFACE_PX = 120;

/**
 * The scale a press takes on a surface of `size` px (its smaller side), by `pointer`: 0.97 /
 * 0.94, or 0.98 / 0.96 at 120 px and up (02.5); 1 under reduced motion (colour change only).
 */
export function pressScale(pointer: PressPointer, size = 0): number {
  if (reducedMotion()) return 1;
  const large = size >= LARGE_SURFACE_PX;
  if (pointer === 'mouse') return large ? PRESS_SCALE.largeMouse : PRESS_SCALE.mouse;
  return large ? PRESS_SCALE.largeTouch : PRESS_SCALE.touch;
}

/**
 * `--enter-scale`, `--exit-scale` (a popup's quicker close, MC-16), `--tooltip-scale`,
 * `--rise-distance` (px) and X8's `--sheet-push-distance`.
 */
export const ENTER_SCALE = 0.96;
export const EXIT_SCALE = 0.98;
export const TOOLTIP_SCALE = 0.98;
export const RISE_PX = 4;
export const SHEET_PUSH_PX = 24;

/**
 * The undo reveal's ring flash (§7.3, MC-32; A-10's 500 ms on glass): 80 ms in, 160 held,
 * 260 out. Under reduced motion the ring is shown still for the same 500 ms, then removed.
 */
export const RING_FLASH = { inMs: 80, holdMs: 160, outMs: 260, totalMs: 500 } as const;

/**
 * Every custom property `motion.css` defines (§1), so `motion.test.ts` can hold the file to this
 * list and the token registry need not name them twice.
 */
export const MOTION_TOKENS: readonly string[] = [
  '--ease-spring',
  '--ease-spring-fling',
  '--ease-spring-pop',
  ...Object.keys(SPRING_CSS_MS).map((name) => `--spring-${name}`),
  ...Object.keys(DURATION_MS).map((name) => `--duration-${name}`),
  '--ease-out',
  '--ease-exit',
  '--ease-standard',
  '--vt-duration',
  '--press-scale-mouse',
  '--press-scale-touch',
  '--press-scale-large-mouse',
  '--press-scale-large-touch',
  '--press-scale',
  '--press-scale-large',
  '--enter-scale',
  '--exit-scale',
  '--tooltip-scale',
  '--rise-distance',
  '--motion-rise',
  '--sheet-push-distance',
];
