/**
 * Feedback and navigation choreography that runs from script (R14 motion sprint,
 * `docs/design/motion-2026-10/forms-compact.md`; language.md §7.3, §7.5): three entries the
 * forms, signature, sheet and compact surfaces share, so none of them writes its own copy.
 *
 * | Entry | What moves | Timing | Interruption | Reduced (§7.5) |
 * |---|---|---|---|---|
 * | `shake` (*refusal*) | `translateX`, a damped sine, 3 cycles, 8 px | 360 ms | A new refusal restarts it | A colour pulse of the danger tint, 150 ms |
 * | `receivePulse` (*receive*) | `scale` kicked from rest, `pop` | ≈ 400 ms | Retargets with the velocity it has | The chrome ring held still (A-10's 500 ms) |
 * | `navPush` (*navigation push*) | The child page from the trailing side; the parent shifts 30 % and dims | `smooth` | A new push ends the last one at its target first | The incoming page fades in, ≤ 150 ms |
 * | `disclose` (*disclosure*) | A folded section's height (with its padding) and its content's opacity | `smooth` | Reverses from where it is, with its velocity | A fade, ≤ 150 ms |
 *
 * Nothing here leaves a transform, a clip, an opacity or `will-change` on its element at rest
 * (Q-2), and nothing runs once it ends (Q-10).
 */
import { animateStyle } from './animate';
import { ringFlash } from './catalogue';
import { reducedMotion } from './reduced-motion';
import { solve, springs } from './springs';
import { duration, EASE } from './tokens';

/** `shake`'s numbers: amplitude (px), cycles and length (ms); A-10 asks ≤ 500 ms. */
export const SHAKE = { amplitudePx: 8, cycles: 3, ms: 360 } as const;

const shakes = new WeakMap<Element, Animation>();

/**
 * *Refusal* (a wrong password, a form that cannot be sent): `element` shakes sideways, a sine
 * of 3 cycles whose amplitude decays from 8 px to nothing, in 360 ms, so it reads as "no"
 * without travelling. Under reduced motion its background pulses the danger tint once, in
 * 150 ms (colour only, A-9). Returns the running animation.
 */
export function shake(element: Element | null): Animation | undefined {
  if (!(element instanceof HTMLElement) || typeof element.animate !== 'function') return undefined;
  shakes.get(element)?.cancel();
  let run: Animation;
  if (reducedMotion()) {
    const rest = getComputedStyle(element).backgroundColor || 'rgb(0 0 0 / 0)';
    const tint = `color-mix(in srgb, var(--danger) 22%, ${rest})`;
    run = element.animate(
      [{ backgroundColor: rest }, { backgroundColor: tint }, { backgroundColor: rest }],
      { duration: duration('base'), easing: 'ease-in-out' },
    );
  } else {
    const { amplitudePx, cycles, ms } = SHAKE;
    const steps = Math.round((ms / 1000) * 120);
    const frames: Keyframe[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Linear decay to zero: the last cycle is small but still seen, and it ends exactly at 0.
      const x = amplitudePx * (1 - t) * Math.sin(2 * Math.PI * cycles * t);
      frames.push({ transform: `translateX(${Math.round(x * 100) / 100}px)` });
    }
    run = element.animate(frames, { duration: ms, easing: 'linear' });
  }
  shakes.set(element, run);
  const done = () => {
    if (shakes.get(element) === run) shakes.delete(element);
  };
  run.onfinish = done;
  run.oncancel = done;
  return run;
}

/** `receivePulse`'s kick: scale velocity per second, on `pop` (about a 10 % peak). */
export const RECEIVE_KICK = 3.2;

/**
 * *Receive*: `element` has just been handed something (a signature shrinking into its chip).
 * Its scale is kicked from rest on `pop`, so it swells about 10 % and settles back with one
 * small overshoot, from where it is if a pulse is already running. Under reduced motion the
 * chrome's ring is held on it instead (`ringFlash`).
 */
export function receivePulse(element: Element | null): void {
  if (!(element instanceof HTMLElement) || typeof element.animate !== 'function') return;
  if (reducedMotion()) {
    ringFlash(element, 'chrome');
    return;
  }
  animateStyle(element, 'transform', [0, 0, 1, 1], [0, 0, 1, 1], {
    spring: 'pop',
    velocity: [0, 0, RECEIVE_KICK, RECEIVE_KICK],
  });
}

/** How far the parent page shifts under a pushed one, as a share of the width (iOS: 30 %). */
export const NAV_PARALLAX = 0.3;
/** The parent page's opacity once fully covered: it dims as the child slides over it. */
export const NAV_DIM = 0.45;

const navs = new WeakMap<Element, Animation[]>();

/**
 * *Navigation push* (iOS style): the child page slides over its parent from the trailing side.
 * `direction` 1 pushes (`incoming` is the child, `outgoing` the parent it covers); −1 pops
 * (`incoming` is the parent coming back, `outgoing` the child leaving to the trailing side).
 * The parent shifts 30 % of the width the other way and dims to 0.45, and is clipped at the
 * child's leading edge, so the two pages never draw over each other on a translucent sheet.
 * Both follow one `smooth` spring, so the edge and the parallax stay locked together.
 *
 * `outgoing` is a stand-in the caller has laid over `incoming` (a clone of the page that just
 * went); it is removed when the motion ends. Without one (or under reduced motion), the
 * incoming page fades in (the reduced form: opacity only, within 150 ms).
 */
export function navPush(
  incoming: HTMLElement | null,
  outgoing: HTMLElement | null,
  direction: 1 | -1,
): void {
  if (!incoming || typeof incoming.animate !== 'function') {
    outgoing?.remove();
    return;
  }
  for (const running of navs.get(incoming) ?? []) running.finish();
  const width = incoming.getBoundingClientRect().width;
  if (!outgoing || reducedMotion() || width <= 0) {
    outgoing?.remove();
    const fade = incoming.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: duration('base'),
      easing: EASE.out,
    });
    navs.set(incoming, [fade]);
    return;
  }
  const rtl = getComputedStyle(incoming).direction === 'rtl';
  const side = rtl ? -1 : 1;
  const child = direction === 1 ? incoming : outgoing;
  const parent = direction === 1 ? outgoing : incoming;
  // p: the child's leading edge as a share of the width, 1 (off) → 0 (shown) for a push and
  // the reverse for a pop, sampled from the analytic spring at 120 Hz.
  const from = direction === 1 ? 1 : 0;
  const to = 1 - from;
  const s = springs.smooth;
  const childFrames: Keyframe[] = [];
  const parentFrames: Keyframe[] = [];
  const round = (n: number) => Math.round(n * 100) / 100;
  for (let i = 0; ; i++) {
    const [x, v] = solve(s, from - to, 0, i / 120);
    const settled = Math.abs(x) < 1e-3 && Math.abs(v) < 1e-2;
    const p = settled ? to : to + x;
    const cover = round(width * (1 - NAV_PARALLAX) * (1 - p));
    childFrames.push({ transform: `translateX(${round(side * width * p)}px)` });
    parentFrames.push({
      transform: `translateX(${round(-side * width * NAV_PARALLAX * (1 - p))}px)`,
      opacity: round(NAV_DIM + (1 - NAV_DIM) * p),
      clipPath: rtl ? `inset(0 0 0 ${cover}px)` : `inset(0 ${cover}px 0 0)`,
    });
    if (settled) break;
  }
  const options: KeyframeAnimationOptions = {
    duration: ((childFrames.length - 1) * 1000) / 120,
    easing: 'linear',
  };
  const runs = [child.animate(childFrames, options), parent.animate(parentFrames, options)];
  navs.set(incoming, runs);
  void Promise.all(runs.map((r) => r.finished.catch(() => undefined))).then(() => {
    outgoing.remove();
    if (navs.get(incoming) === runs) navs.delete(incoming);
  });
}

/** A running disclosure: its spring segment (progress 0 folded → 1 open) and when it began. */
interface Disclosing {
  readonly run: Animation;
  readonly from: number;
  readonly to: number;
  readonly velocity: number;
  readonly start: number;
}

const disclosures = new WeakMap<Element, Disclosing>();

/**
 * *Disclosure*: a folded section opens (`open` true, just mounted at its natural size) or
 * closes (then `onClosed` unmounts it). Its height and block padding grow together from 0 on
 * the `smooth` spring, so the rows under it are carried down with no jump at either end, and
 * its content fades in over the first three quarters (out over the last on close). A toggle
 * mid-flight reverses from where the section is, with its velocity (Q-10). Height is layout,
 * not compositing: this is for one sheet row at a time, the one place the catalogue moves
 * size inside a sheet. Under reduced motion only the fade runs, within 150 ms. Nothing is
 * left inline at rest; a closed section keeps its last frame until it is unmounted.
 */
export function disclose(element: Element | null, open: boolean, onClosed?: () => void): void {
  if (!(element instanceof HTMLElement) || typeof element.animate !== 'function') {
    if (!open) onClosed?.();
    return;
  }
  const to = open ? 1 : 0;
  let from = open ? 0 : 1;
  let velocity = 0;
  const running = disclosures.get(element);
  if (running) {
    const t = (performance.now() - running.start) / 1000;
    const [x, v] = solve(springs.smooth, running.from - running.to, running.velocity, t);
    from = Math.min(1, Math.max(0, running.to + x));
    velocity = v;
    running.run.cancel();
  }
  const finish = (run: Animation) => {
    if (disclosures.get(element)?.run !== run) return;
    disclosures.delete(element);
    element.style.removeProperty('overflow');
    if (!open) onClosed?.();
  };
  if (reducedMotion()) {
    const run = element.animate([{ opacity: from }, { opacity: to }], {
      duration: duration('base'),
      easing: EASE.out,
      fill: open ? 'none' : 'forwards',
    });
    disclosures.set(element, { run, from, to, velocity: 0, start: performance.now() });
    run.onfinish = () => finish(run);
    return;
  }
  const style = getComputedStyle(element);
  const height = element.offsetHeight;
  const top = parseFloat(style.paddingTop) || 0;
  const bottom = parseFloat(style.paddingBottom) || 0;
  const frames: Keyframe[] = [];
  const px = (n: number) => `${Math.round(Math.max(0, n) * 100) / 100}px`;
  for (let i = 0; ; i++) {
    const [x, v] = solve(springs.smooth, from - to, velocity, i / 120);
    const settled = Math.abs(x) < 1e-3 && Math.abs(v) < 1e-2;
    const p = settled ? to : Math.min(1, Math.max(0, to + x));
    frames.push({
      height: px(height * p),
      minHeight: '0px',
      paddingTop: px(top * p),
      paddingBottom: px(bottom * p),
      opacity: Math.round(Math.min(1, Math.max(0, (p - 0.25) / 0.75)) * 1000) / 1000,
    });
    if (settled) break;
  }
  element.style.overflow = 'clip';
  const run = element.animate(frames, {
    duration: ((frames.length - 1) * 1000) / 120,
    easing: 'linear',
    fill: open ? 'none' : 'forwards',
  });
  disclosures.set(element, { run, from, to, velocity, start: performance.now() });
  run.onfinish = () => finish(run);
}
