/**
 * The toast stack's motion (`08-feedback` FB4 §7; language.md §7.3 *toast*; quality-bar Q-2,
 * Q-3, Q-6, Q-10): the pieces `ToastRegion.tsx` composes so that two pills never meet and a
 * leaving toast never leaves an empty pill behind.
 *
 * - `reflow()` is the stack's FLIP, by translation only. A toast's width is its own (FB4 §2,
 *   360–480 px from its own content), so a neighbour arriving or leaving never changes it; a
 *   toast whose own size changes (its text did) snaps to it, since a glass surface never
 *   scales (Q-6) and its width never tweens (Q-10). A toast the change moves starts from where
 *   it is on screen, from rest, on one spring: toasts moving together then keep their order
 *   and their gaps, where a carried velocity (a toast still rising in) could overtake the one
 *   above. A toast the change does not move (a timer tick, a neighbour's text) keeps its
 *   motion, velocity and all, so its course is exactly the one already planned around.
 * - `entranceDelay()` holds a new toast back until the toast above it, moving up by `reflow()`,
 *   is far enough ahead that the newcomer's 16 px rise never reaches it: the stack makes room
 *   first, then the toast comes in. Solved on the spring itself (`solve()`).
 * - `after()` waits on the animation timeline, the clock the Web Animations above run on, so a
 *   held entrance stays in step with them when that clock is slowed (DevTools, the reviewer's
 *   frame captures) as well as in real time.
 * - `fadeBackdrop()` keeps the glass's backdrop filter off while the toast is nearly
 *   transparent and whole while it shows: Chromium draws a backdrop-filtered surface at a few
 *   per cent opacity darker than the page under it, which read as an empty dark pill once a
 *   leaving toast's text had faded. The filter itself never animates (language.md §2.1
 *   rule 5, §2.9).
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

/** Where `reflow()` started an element from (px, px/s), and where it landed. */
export interface Move {
  readonly dx: number;
  readonly dy: number;
  readonly vy: number;
  /** The element's box after the change, untransformed. */
  readonly last: DOMRect;
  /** The Web Animation playing the move, whose own clock an entrance below it waits on. */
  readonly animation: Animation | null;
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
  const prior = els.map((el) => stopTransform(el));
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
    const dx = f.left - l.left;
    const dy = f.top - l.top;
    // Unmoved by the change: the motion it had goes on as it was.
    const [px = 0, py = 0] = prior[i]?.value ?? [];
    const [vx = 0, vy = 0] = prior[i]?.velocity ?? [];
    const kept = Math.abs(dx - px) <= 0.5 && Math.abs(dy - py) <= 0.5;
    if (Math.abs(dx) <= STILL && Math.abs(dy) <= STILL && !(kept && vy !== 0)) return;
    animateStyle(el, 'transform', [dx, dy], [0, 0], {
      spring: STACK_SPRING,
      velocity: [kept ? vx : 0, kept ? vy : 0],
    });
    const animation =
      el
        .getAnimations()
        .findLast((a) =>
          ((a.effect as KeyframeEffect | null)?.getKeyframes() ?? []).some((k) => 'transform' in k),
        ) ?? null;
    moves.set(el, { dx, dy, vy: kept ? vy : 0, last: l, animation });
  });
  return moves;
}

/** The offset of a spring move from `from` at `velocity`, `t` seconds in (held before). */
function at(from: number, t: number, velocity = 0): number {
  return t <= 0 ? from : solve(STACK_SPRING, from, velocity, t)[0];
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
      if (top - (bottom + at(above.dy, t, above.vy)) < CLEARANCE_PX) return false;
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
 * Calls `run` once `ms` have passed, on the first frame after; at 0 at once. With `pace`, the
 * time is that animation's own: a Web Animation started in this task gets its start time at a
 * later frame (a frame or several on a busy main thread), and an entrance timed against a
 * neighbour's move must count from where that move really is. Once `pace` has finished the
 * wait is over; once it is cancelled the count goes on, on the animation timeline (which a
 * DevTools slow-down slows with every animation). Returns a cancel. Frames run only while it
 * waits, so nothing ticks at rest (A-23).
 */
export function after(ms: number, run: () => void, pace?: Animation | null): () => void {
  if (ms <= 0) {
    run();
    return () => undefined;
  }
  let start: number | null = null;
  const elapsed = (): number => {
    if (pace?.playState === 'finished') return Number.POSITIVE_INFINITY;
    if (pace?.playState === 'running') return Number(pace.currentTime ?? 0);
    start ??= timeline();
    return timeline() - start;
  };
  let frame = requestAnimationFrame(function step() {
    if (elapsed() >= ms) run();
    else frame = requestAnimationFrame(step);
  });
  return () => cancelAnimationFrame(frame);
}

/**
 * Chromium draws any backdrop-filtered surface, an identity filter included, a step or two
 * darker than the page under it while the surface is nearly transparent: on a dark page a
 * fading glass toast read as an empty dark pill after its text had gone. The filter never
 * animates (language.md §2.1 rule 5: glass fades on its opacity, never its filter), so it is
 * switched, not faded: off below `LIT` of opacity, where the tint already outweighs what it
 * blurs and a tenth of a toast hides the switch, and at the stylesheet's full value above it.
 * Below `GONE` the toast is not drawn at all (5 % of a toast is nothing anyone sees go). The
 * exit ends on `visibility: hidden`, a discrete step on the opacity's own timeline: no frame
 * shows the toast nearly transparent and still filtered.
 */
const LIT = 0.1;
const GONE = 0.05;

/** Seconds until a zero-velocity spring move from `from` to `to` passes `level`. */
function crossing(s: Spring, from: number, to: number, level: number): number {
  for (let t = 0; t < 2; t += 1 / 1000) {
    const value = to + solve(s, from - to, 0, t)[0];
    if (to > from ? value >= level : value <= level) return t;
  }
  return 2;
}

/** What `fadeBackdrop()` has pending on an element: its wait and its hiding, to cancel. */
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
 * Keeps the backdrop filter of the glass element `el` in step with its opacity fade (FB4 §7)
 * without ever animating it. In: off until the opacity passes `LIT` on `quick` (`track` under
 * reduced motion), then the stylesheet's filter, whole, for as long as the toast shows. Out,
 * as the `track` fade from `opacity` runs: the filter stays whole until the opacity falls to
 * `LIT`, then goes off, and the toast is hidden from `GONE` until the element goes. Without a
 * filter (reduced transparency, Glass Solid, forced colours) only the exit's hiding applies.
 */
export function fadeBackdrop(el: HTMLElement, direction: 'in' | 'out', opacity = 1): void {
  backdrops.get(el)?.();
  backdrops.delete(el);
  backdropOn(el);
  if (typeof el.animate !== 'function') return;
  const filter = getComputedStyle(el).backdropFilter;
  const filtered = Boolean(filter) && filter !== 'none';
  if (direction === 'in') {
    if (!filtered) return;
    const s = reducedMotion() ? springs.track : springs.quick;
    backdropOff(el);
    backdrops.set(
      el,
      after(crossing(s, 0, 1, LIT) * 1000, () => backdropOn(el)),
    );
    return;
  }
  const until = (level: number) =>
    opacity > level ? crossing(springs.track, opacity, 0, level) * 1000 : 0;
  const hide = el.animate(
    { visibility: ['visible', 'hidden'] },
    { duration: until(GONE), fill: 'forwards' },
  );
  // Already at or under a tenth (a toast that barely began): off at once.
  const wait = filtered ? after(until(LIT), () => backdropOff(el)) : () => undefined;
  backdrops.set(el, () => {
    hide.cancel();
    wait();
  });
}
