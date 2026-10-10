/**
 * The page view's jumps (motion-2026-10 viewer.md §1; language.md §7.3 *scroll-to*): Go to
 * page, an outline entry, a link, a find hit, a thumbnail, the undo reveal.
 *
 * - **Near** (up to `FAR_SCREENS` screens): the scroll position moves on an eased curve whose
 *   duration grows with the distance, `jumpDuration()`: about 200 ms for a short hop, never more
 *   than `MAX_JUMP_MS` (450 ms). The curve is `--ease-out`'s cubic shape, so the view leaves at
 *   once and lands softly.
 * - **Far**: travelling a long way blurs past dozens of pages, so the view *fades through*
 *   instead: the page column fades out on `--duration-fast` `--ease-exit`, the scroll lands
 *   half a screen short of the target, on the side it came from, and the last half screen glides
 *   in while the column fades back on `--duration-base` `--ease-out`. The direction of travel is
 *   still seen.
 * - **Interruption.** A new jump retargets from where the scroll is, carrying its velocity
 *   through the turn; a wheel, a touch, a press or an arrow key cancels it where it is
 *   (`cancelJump`), and a fade in flight snaps back to opaque.
 * - **Rest.** The loop runs only while a jump moves (Q-10); nothing is left on the column.
 *
 * Under reduced motion (§7.5) a jump lands at once.
 */
import { reducedMotion } from '../motion/reduced-motion';
import { duration, EASE } from '../motion/tokens';
import { jumpEnded, jumpStarted } from './jump-landed';

export { afterJump, whenJumpsLanded } from './jump-landed';

/** The longest eased jump (ms). */
export const MAX_JUMP_MS = 450;
/** The shortest one (ms). */
export const MIN_JUMP_MS = 200;
/** Beyond this many screens a jump fades through instead of travelling the whole way. */
export const FAR_SCREENS = 3;
/** A far jump lands this fraction of a screen short and glides the rest. */
export const FAR_GLIDE_SCREENS = 0.5;

/**
 * The duration of an eased jump over `distance` px in a view `screen` px tall: 200 ms, plus
 * 125 ms for each doubling of the distance in screens, at most 450 ms (about 3 screens).
 */
export function jumpDuration(distance: number, screen: number): number {
  const screens = Math.abs(distance) / Math.max(1, screen);
  return Math.min(MAX_JUMP_MS, MIN_JUMP_MS + 125 * Math.log2(1 + screens));
}

/** Whether a jump of `distance` px in a view `screen` px tall fades through (module header). */
export function isFarJump(distance: number, screen: number): boolean {
  return Math.abs(distance) > FAR_SCREENS * Math.max(1, screen);
}

/**
 * Position along a jump at `s` (0–1) from `from` to `to`, leaving with `v0` px per unit of `s`:
 * the ease-out cubic, plus a velocity term that fades to zero at both ends.
 */
export function jumpAt(from: number, to: number, v0: number, s: number): number {
  const k = Math.min(1, Math.max(0, s));
  const rest = 1 - k;
  return from + (to - from) * (1 - rest * rest * rest) + v0 * k * rest * rest;
}

/** The derivative of `jumpAt` in `s`. */
function slopeAt(from: number, to: number, v0: number, s: number): number {
  const k = Math.min(1, Math.max(0, s));
  const rest = 1 - k;
  return 3 * (to - from) * rest * rest + v0 * rest * (1 - 3 * k);
}

/** A scroll position on both axes. */
export interface ScrollPoint {
  readonly top: number;
  readonly left: number;
}

interface Axis {
  from: number;
  to: number;
  /** Velocity at the start, px per unit of progress. */
  v0: number;
}

interface Running {
  y: Axis;
  x: Axis;
  t0: number;
  ms: number;
  frame: number;
  /** The column fading through a far jump, or null. */
  fade: Animation | null;
  /** Waiting for the fade out: the scroll has not started yet. */
  waiting: boolean;
  readonly layer: HTMLElement | null;
  readonly landed: Set<(landed: boolean) => void>;
}

const running = new WeakMap<HTMLElement, Running>();

function finish(el: HTMLElement, run: Running, landed: boolean) {
  cancelAnimationFrame(run.frame);
  if (running.get(el) === run) running.delete(el);
  if (!landed) {
    run.fade?.cancel();
    run.fade = null;
  }
  jumpEnded(el, () => {
    for (const done of run.landed) done(landed);
  });
}

function clampTo(el: HTMLElement, to: ScrollPoint): ScrollPoint {
  return {
    top: Math.min(Math.max(0, to.top), Math.max(0, el.scrollHeight - el.clientHeight)),
    left: Math.min(Math.max(0, to.left), Math.max(0, el.scrollWidth - el.clientWidth)),
  };
}

function step(el: HTMLElement, run: Running) {
  run.frame = requestAnimationFrame(() => {
    if (running.get(el) !== run) return;
    const s = Math.min(1, (performance.now() - run.t0) / run.ms);
    el.scrollTop = jumpAt(run.y.from, run.y.to, run.y.v0, s);
    el.scrollLeft = jumpAt(run.x.from, run.x.to, run.x.v0, s);
    if (s >= 1) {
      el.scrollTop = run.y.to;
      el.scrollLeft = run.x.to;
      finish(el, run, true);
    } else step(el, run);
  });
}

/** Starts the eased travel of `run` from `from` (velocities in px per ms) toward its targets. */
function travel(el: HTMLElement, run: Running, from: ScrollPoint, velocity: ScrollPoint) {
  const distance = Math.hypot(run.y.to - from.top, run.x.to - from.left);
  run.ms = jumpDuration(distance, el.clientHeight);
  run.y = { from: from.top, to: run.y.to, v0: velocity.top * run.ms };
  run.x = { from: from.left, to: run.x.to, v0: velocity.left * run.ms };
  run.t0 = performance.now();
  run.waiting = false;
  cancelAnimationFrame(run.frame);
  step(el, run);
}

/** Where a running jump is and how fast it moves (px per ms). */
function stateOf(el: HTMLElement, run: Running | undefined): { at: ScrollPoint; v: ScrollPoint } {
  const at = { top: el.scrollTop, left: el.scrollLeft };
  if (!run || run.waiting) return { at, v: { top: 0, left: 0 } };
  const s = Math.min(1, (performance.now() - run.t0) / run.ms);
  return {
    at,
    v: {
      top: slopeAt(run.y.from, run.y.to, run.y.v0, s) / run.ms,
      left: slopeAt(run.x.from, run.x.to, run.x.v0, s) / run.ms,
    },
  };
}

/**
 * Scrolls `el` to `target` as a jump (module header); `layer` is the content that fades through
 * a far jump. Resolves true once it has landed, false when it was cancelled or replaced by a
 * jump to elsewhere (a retarget keeps the promise of the jump it continues).
 */
export function jumpScroll(
  el: HTMLElement,
  target: ScrollPoint,
  o: { readonly layer?: HTMLElement | null } = {},
): Promise<boolean> {
  const to = clampTo(el, target);
  const previous = running.get(el);
  const { at, v } = stateOf(el, previous);
  const distance = Math.hypot(to.top - at.top, to.left - at.left);
  if (reducedMotion() || distance < 1 || el.clientHeight === 0) {
    if (previous) finish(el, previous, false);
    el.scrollTop = to.top;
    el.scrollLeft = to.left;
    return Promise.resolve(true);
  }
  const screen = el.clientHeight;
  const layer = o.layer ?? null;
  const far =
    layer !== null && typeof layer.animate === 'function' && isFarJump(to.top - at.top, screen);
  let run = previous;
  if (!run || (far && !run.fade)) {
    if (run) finish(el, run, false);
    run = {
      y: { from: at.top, to: to.top, v0: 0 },
      x: { from: at.left, to: to.left, v0: 0 },
      t0: 0,
      ms: 0,
      frame: 0,
      fade: null,
      waiting: false,
      layer,
      landed: new Set(),
    };
    running.set(el, run);
    jumpStarted(el);
  }
  run.y.to = to.top;
  run.x.to = to.left;
  const current = run;
  const promise = new Promise<boolean>((resolve) => current.landed.add(resolve));
  if (current.waiting) return promise;
  if (!far) {
    travel(el, current, at, v);
    return promise;
  }
  if (current.fade) {
    // A far jump retargeted while its column fades back in: travel on from here.
    travel(el, current, at, v);
    return promise;
  }
  // Far: fade the column out, land short of the target, glide in while it fades back.
  cancelAnimationFrame(current.frame);
  current.waiting = true;
  const out = layer.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: duration('fast'),
    easing: EASE.exit,
    fill: 'forwards',
  });
  current.fade = out;
  out.onfinish = () => {
    if (running.get(el) !== current) return;
    const short = Math.sign(current.y.to - el.scrollTop) * FAR_GLIDE_SCREENS * screen;
    el.scrollTop = current.y.to - short;
    el.scrollLeft = current.x.to;
    const back = layer.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: duration('base'),
      easing: EASE.out,
    });
    out.cancel();
    current.fade = back;
    back.onfinish = back.oncancel = () => {
      if (current.fade === back) current.fade = null;
    };
    travel(el, current, { top: el.scrollTop, left: el.scrollLeft }, { top: 0, left: 0 });
  };
  return promise;
}

/** Stops the jump running on `el` where it is (the user took the scroll over). */
export function cancelJump(el: HTMLElement): void {
  const run = running.get(el);
  if (run) finish(el, run, false);
}

/** Where the jump running on `el` is heading, if one is. */
export function jumpTarget(el: HTMLElement): ScrollPoint | undefined {
  const run = running.get(el);
  return run ? { top: run.y.to, left: run.x.to } : undefined;
}

/** Whether a jump is running on `el`. */
export function isJumping(el: HTMLElement): boolean {
  return running.has(el);
}
