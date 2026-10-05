/**
 * The toast stack's motion (`08-feedback` FB4 §7; language.md §7.3 *toast*; quality-bar Q-2,
 * Q-3, Q-6, Q-10): the pieces `ToastRegion.tsx` composes so that two pills never meet and a
 * leaving toast never leaves an empty pill behind.
 *
 * - `reflow()` is the stack's FLIP, by translation only. A toast's width is its own (FB4 §2,
 *   360–480 px from its own content), so a neighbour arriving or leaving never changes it; a
 *   toast whose own size changes (its text did) snaps to it, since a glass surface never
 *   scales (Q-6) and its width never tweens (Q-10). Every toast moves from where it is on
 *   screen, from rest, on one spring: toasts moving together then keep their order and their
 *   gaps, where a carried velocity (a toast still rising in) could overtake the one above.
 * - `entranceDelay()` holds a new toast back until the toast above it, moving up by `reflow()`,
 *   is far enough ahead that the newcomer's 16 px rise never reaches it: the stack makes room
 *   first, then the toast comes in. Solved on the spring itself (`solve()`).
 * - `after()` waits on the animation timeline, the clock the Web Animations above run on, so a
 *   held entrance stays in step with them when that clock is slowed (DevTools, the reviewer's
 *   frame captures) as well as in real time.
 * - `fadeBackdrop()` carries the glass's backdrop filter along with the toast's opacity, and
 *   takes it away while the toast is nearly transparent: Chromium draws a backdrop-filtered
 *   surface at a few per cent opacity darker than the page under it, which read as an empty
 *   dark pill once a leaving toast's text had faded.
 */
import { reducedMotion, type Spring, solve, springs } from '../../motion';
import { animateStyle, stopTransform } from '../../motion/animate';

/** *toast* (§7.3): the stack re-flows on the toast's own spring. */
export const STACK_SPRING = springs.quick;
/** *toast* (§7.3): a toast rises 16 px as it fades in. */
export const RISE_PX = 16;
/** The least gap between two pills while they move, in px. */
const CLEARANCE_PX = 2;
/** Below this a move is no move (px). */
const STILL = 1e-3;
/** Sampling step and horizon of `entranceDelay()`, in seconds. */
const STEP_S = 1 / 120;
const HORIZON_S = 0.6;

/** Where `reflow()` started an element from, and where it landed. */
export interface Move {
  readonly dx: number;
  readonly dy: number;
  /** The element's box after the change, untransformed. */
  readonly last: DOMRect;
}

/**
 * Applies `mutate` (synchronously: wrap a React update in `flushSync`) and slides each of
 * `elements` from where it was on screen (a move already running included) to where the change
 * put it, by `transform` on the stack's spring. An element that changed size snaps; one not
 * connected before or after does not move. Returns the moves it started.
 */
export function reflow(
  elements: Iterable<HTMLElement>,
  mutate: () => void,
): Map<HTMLElement, Move> {
  const els = [...elements].filter((el) => el.isConnected);
  const first = els.map((el) => el.getBoundingClientRect());
  for (const el of els) stopTransform(el);
  mutate();
  const moves = new Map<HTMLElement, Move>();
  if (reducedMotion()) return moves;
  // Every read before the first write, so the new layout is computed once.
  const last = els.map((el) => el.getBoundingClientRect());
  els.forEach((el, i) => {
    const f = first[i] as DOMRect;
    const l = last[i] as DOMRect;
    if (!el.isConnected || l.width === 0 || l.height === 0) return;
    // Its own size changed (its text did): it snaps, glass never scales (Q-6).
    if (Math.abs(f.width - l.width) > 0.5 || Math.abs(f.height - l.height) > 0.5) return;
    const move = { dx: f.left - l.left, dy: f.top - l.top, last: l };
    if (Math.abs(move.dx) <= STILL && Math.abs(move.dy) <= STILL) return;
    moves.set(el, move);
    animateStyle(el, 'transform', [move.dx, move.dy], [0, 0], { spring: STACK_SPRING });
  });
  return moves;
}

/** The offset of a spring move from rest at `from`, `t` seconds in (held at `from` before). */
function at(from: number, t: number): number {
  return t <= 0 ? from : solve(STACK_SPRING, from, 0, t)[0];
}

/**
 * Milliseconds to hold a toast's entrance so that, rising `RISE_PX` on the stack's spring, its
 * top stays at least `CLEARANCE_PX` below the bottom of the toast above it, which is moving by
 * `above` (its `reflow()` move) towards its new place. `slotTop` is the entering toast's top at
 * rest. No move above, or one that is already clear: 0.
 */
export function entranceDelay(slotTop: number, above: Move | undefined): number {
  if (!above || reducedMotion()) return 0;
  const bottom = above.last.bottom;
  const clear = (hold: number) => {
    for (let t = hold; t <= hold + HORIZON_S; t += STEP_S) {
      const top = slotTop + at(RISE_PX, t - hold);
      if (top - (bottom + at(above.dy, t)) < CLEARANCE_PX) return false;
    }
    return true;
  };
  for (let hold = 0; hold <= HORIZON_S; hold += STEP_S) {
    if (clear(hold)) return Math.round(hold * 1000);
  }
  return Math.round(HORIZON_S * 1000);
}

/** The animation timeline's time in ms (where there is none, the page clock). */
function timeline(): number {
  const now = document.timeline?.currentTime;
  return typeof now === 'number' ? now : performance.now();
}

/**
 * Calls `run` once `ms` have passed on the animation timeline, on the first frame after; at 0
 * at once. Returns a cancel. Frames run only while it waits, so nothing ticks at rest (A-23).
 */
export function after(ms: number, run: () => void): () => void {
  if (ms <= 0) {
    run();
    return () => undefined;
  }
  const start = timeline();
  let frame = requestAnimationFrame(function step() {
    if (timeline() - start >= ms) run();
    else frame = requestAnimationFrame(step);
  });
  return () => cancelAnimationFrame(frame);
}

/**
 * Below this opacity a toast has no backdrop filter at all. Chromium draws any backdrop-filtered
 * surface, an identity filter included, a step or two darker than the page under it while the
 * surface is nearly transparent: on a dark page a fading glass toast read as an empty dark pill
 * after its text had gone. At 10 % the tint outweighs that, and a filter's weight that low
 * changes nothing visible, so the filter goes (and comes) there. `none` must be the computed
 * value, not an interpolation towards it (which computes as an identity list), so the ends are
 * written inline.
 */
const LIT = 0.1;

/** Seconds until a zero-velocity spring move from `from` to `to` passes `level`. */
function crossing(s: Spring, from: number, to: number, level: number): number {
  for (let t = 0; t < 2; t += 1 / 1000) {
    const value = to + solve(s, from - to, 0, t)[0];
    if (to > from ? value >= level : value <= level) return t;
  }
  return 2;
}

/** What `fadeBackdrop()` has running on an element: a wait or an animation, to cancel. */
const backdrops = new WeakMap<HTMLElement, () => void>();

function backdropOff(el: HTMLElement): void {
  el.style.setProperty('-webkit-backdrop-filter', 'none');
  el.style.setProperty('backdrop-filter', 'none');
}

function backdropOn(el: HTMLElement): void {
  el.style.removeProperty('-webkit-backdrop-filter');
  el.style.removeProperty('backdrop-filter');
}

/**
 * Fades the backdrop filter of the glass element `el` with its opacity (FB4 §7), on the
 * zero-bounce spring curve the opacity takes (`--ease-spring`, which every zero-bounce token
 * shares). In: none until the opacity passes `LIT` on `quick` (`track` under reduced motion),
 * then up to the stylesheet's filter, which it leaves in place. Out: from where it is now
 * (mid-entrance as the entrance has it) to none by the moment the `track` fade from `opacity`
 * passes `LIT`, then none until the element goes. Nothing to do without a filter (Reduce
 * transparency, Solid, forced colours).
 */
export function fadeBackdrop(el: HTMLElement, direction: 'in' | 'out', opacity = 1): void {
  const now = getComputedStyle(el).backdropFilter;
  backdrops.get(el)?.();
  backdrops.delete(el);
  backdropOn(el);
  const filter = getComputedStyle(el).backdropFilter;
  if (!filter || filter === 'none' || typeof el.animate !== 'function') return;
  const easing =
    getComputedStyle(document.documentElement).getPropertyValue('--ease-spring').trim() ||
    'ease-out';
  if (direction === 'in') {
    const s = reducedMotion() ? springs.track : springs.quick;
    let run: Animation | null = null;
    backdropOff(el);
    const wait = after(crossing(s, 0, 1, LIT) * 1000, () => {
      backdropOn(el);
      run = el.animate(
        { backdropFilter: ['none', filter] },
        { duration: crossing(s, 0, 1, 0.999) * 1000, easing },
      );
    });
    backdrops.set(el, () => {
      wait();
      run?.cancel();
    });
    return;
  }
  const until = opacity > LIT ? crossing(springs.track, opacity, 0, LIT) * 1000 : 0;
  if (now === 'none' || until <= 0) {
    backdropOff(el);
    return;
  }
  const run = el.animate(
    { backdropFilter: [now, 'none'] },
    { duration: until, easing, fill: 'forwards' },
  );
  run.onfinish = () => {
    backdropOff(el);
    run.cancel();
  };
  backdrops.set(el, () => run.cancel());
}
