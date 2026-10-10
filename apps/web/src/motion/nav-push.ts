/**
 * *Navigation push* (`feedback.ts`'s table; motion-2026-10 forms-compact §5): the settings
 * sheet's pages push and pop iOS style. Apart from `feedback.ts` so that it loads with the
 * sheet, not with the editor (PLAN.md §2.3 V1-P2).
 */
import { reducedMotion } from './reduced-motion';
import { solve, springs } from './springs';
import { duration, EASE } from './tokens';

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
