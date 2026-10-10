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
 *
 * `navPush` lives in `nav-push.ts` and `disclose` in `disclose.ts`: they serve sheets that load
 * on demand, while `shake` and `receivePulse` are part of the first load of both editions
 * (PLAN.md §2.3 V1-P2).
 */
import { animateStyle } from './animate';
import { ringFlash } from './catalogue';
import { reducedMotion } from './reduced-motion';
import { duration } from './tokens';

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
