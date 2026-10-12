/**
 * The trigger's *receive* pulse (motion-2026-10/platform.md §1, `container.ts`): when a popup
 * or a sheet has gone back into its control, the control's `scale` swells by `PULSE_PEAK` and
 * settles on the `pop` spring. Apart from `container.ts` so that a sheet's return
 * (`ui/sheet/sheet-motion.ts`) does not load the container transform itself.
 */
import { reducedMotion } from './reduced-motion';
import { energy, solve, springs } from './springs';

/** How much a trigger swells when a popup returns into it. */
export const PULSE_PEAK = 0.06;
/** Keyframe rate (as `container.ts`). */
const FPS = 120;
/** A segment ends when its energy has fallen to this fraction (as `animate.ts`). */
const PRECISION = 1e-6;

/** Running pulses, so a second one replaces the first. */
const pulses = new WeakMap<Element, Animation>();
/** The pulse's keyframes, sampled once. */
let pulseFrames: Keyframe[] | null = null;
/** When the pulse's first swing crests, ms (sampled with the frames). */
let crestMs = 0;

/** A unit kick on `pop`, scaled so its first swing peaks at `PULSE_PEAK`, as `scale` frames. */
function samplePulse(): Keyframe[] {
  const s = springs.pop;
  const xs: number[] = [];
  const settle = energy(s, 0, 1) * PRECISION;
  for (let i = 0; i < FPS * 2; i++) {
    const [x, v] = solve(s, 0, 1, i / FPS);
    if (i > 0 && energy(s, x, v) <= settle) break;
    xs.push(x);
  }
  const peak = Math.max(...xs, 1e-6);
  crestMs = (xs.indexOf(peak) * 1000) / FPS;
  const k = PULSE_PEAK / peak;
  return [
    ...xs.map((x) => ({ scale: String(Math.round((1 + x * k) * 1e4) / 1e4) })),
    { scale: '1' },
  ];
}

/**
 * The *receive* pulse: `el`'s `scale` swells by `PULSE_PEAK` and settles on `pop`, as if it took
 * the popup back in. `scale` composes with any transform the control has (its press). Nothing
 * under reduced motion; nothing is left at rest.
 *
 * Resolves when the swell crests (at once when nothing plays): an empty animation on the same
 * timeline marks it, so what follows the pulse waits on the animation, never on a timer.
 */
export function receivePulse(el: Element): Promise<void> {
  if (!(el instanceof HTMLElement) || typeof el.animate !== 'function' || reducedMotion()) {
    return Promise.resolve();
  }
  pulseFrames ??= samplePulse();
  pulses.get(el)?.cancel();
  const run = el.animate(pulseFrames, { duration: ((pulseFrames.length - 1) * 1000) / FPS });
  pulses.set(el, run);
  run.onfinish = () => {
    if (pulses.get(el) === run) pulses.delete(el);
    run.cancel();
  };
  const crest = el.animate(null, { duration: Math.max(1, crestMs) });
  return new Promise<void>((resolve) => {
    crest.onfinish = () => resolve();
    crest.oncancel = () => resolve();
  });
}
