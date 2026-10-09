/**
 * *Container transform* (motion-2026-10/platform.md §1; language.md §7.3 *popup*; Material's
 * container transform, Apple's zoom from the source): a popup grows out of the control that
 * opened it and goes back into it.
 *
 * The popup is laid out at its final place and size and never scaled, so its text is never
 * squashed. What moves is its visible region: a `clip-path: inset(… round r)` that starts as the
 * trigger's own rounded rect and opens to the popup's (plus a bleed for its shadow), while a
 * `translate` carries that region from over the trigger to the popup's place (the popup sits
 * `sideOffset` away from its trigger, so a clip alone could not reach it). One number moves on
 * a spring, the progress `p` from 0 (the trigger's rect) to 1 (the popup's); clip, translate
 * and opacity are functions of it, so an open reversed mid-way closes from exactly where it is,
 * with its velocity (Q-10), and a close reopened mid-way turns the same way.
 *
 * - Open on `quick`, close on `press` (the quicker close, MC-16). Opacity is 0 → 1 over the
 *   first `FADE_SPAN` of the progress, so the glass is whole while it grows and the last part
 *   of a close fades into the trigger.
 * - It runs on Web Animations, keyframes sampled from the analytic spring at 120 Hz (as
 *   `animateStyle()`), so Base UI, which waits for a popup's animations before it unmounts it,
 *   waits for the close. Opened, nothing is left: no clip, transform, opacity or `will-change`
 *   (Q-2); closed, the last frame holds until the popup unmounts.
 * - Reduced motion (§7.5, A-9): opacity only, 150 ms in, 100 ms out, nothing spatial.
 *
 * `receivePulse()` is the trigger's answer when a popup has gone back into it: its `scale` swells
 * by `PULSE_PEAK` and settles on the `pop` spring (one small control, never a surface).
 */
import { reducedMotion } from './reduced-motion';
import { energy, solve, springs } from './springs';
import { EASE, REDUCED_DURATION_MS } from './tokens';

/** A rect in viewport pixels. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where the popup's visible region starts: insets of its own box, a radius and a shift. */
export interface ContainerStart {
  /** Insets from the popup's top, right, bottom and left edges, px. */
  readonly inset: readonly [number, number, number, number];
  /** The trigger's corner radius, px (at most half its shorter side). */
  readonly radius: number;
  /** The translate that carries that region over the trigger, px. */
  readonly shift: readonly [number, number];
}

/** How far past its box the region opens at rest, so the popup's shadow is never cut. */
export const CONTAINER_BLEED = 40;
/** The share of the progress over which the popup fades in (and, closing, out). */
export const FADE_SPAN = 0.3;
/** How much a trigger swells when a popup returns into it. */
export const PULSE_PEAK = 0.06;
/** Keyframe rate. */
const FPS = 120;
/** A segment ends when its energy has fallen to this fraction (as `animate.ts`). */
const PRECISION = 1e-6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The start of a container transform from `trigger` into `popup` (both viewport rects; the
 * popup's untransformed): a trigger-sized region inside the popup, as near the trigger as the
 * popup allows, and the shift that lays it over the trigger.
 */
export function containerStart(trigger: Box, popup: Box, triggerRadius: number): ContainerStart {
  const w = Math.min(trigger.width, popup.width);
  const h = Math.min(trigger.height, popup.height);
  const left = clamp(trigger.x - popup.x, 0, popup.width - w);
  const top = clamp(trigger.y - popup.y, 0, popup.height - h);
  return {
    inset: [top, popup.width - left - w, popup.height - top - h, left],
    radius: Math.max(0, Math.min(triggerRadius, w / 2, h / 2)),
    shift: [
      trigger.x + trigger.width / 2 - (popup.x + left + w / 2),
      trigger.y + trigger.height / 2 - (popup.y + top + h / 2),
    ],
  };
}

/** The keyframe at progress `p` (0 the trigger, 1 the popup at rest). */
export function containerFrame(start: ContainerStart, endRadius: number, p: number): Keyframe {
  const q = 1 - p;
  const inset = start.inset.map((v) => `${r2(v * q - CONTAINER_BLEED * p)}px`);
  const radius = r2(start.radius * q + (endRadius + CONTAINER_BLEED) * p);
  const [x, y] = start.shift;
  return {
    clipPath: `inset(${inset.join(' ')} round ${radius}px)`,
    transform: `translate(${r2(x * q)}px, ${r2(y * q)}px)`,
    opacity: String(r2(clamp(p / FADE_SPAN, 0, 1))),
  };
}

/** An element's corner radius as px for a box of `w` × `h` (a capsule is half the shorter side). */
export function radiusOf(el: Element, w: number, h: number): number {
  const value = getComputedStyle(el).borderTopLeftRadius;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  const px = value.endsWith('%') ? (Math.min(w, h) * n) / 100 : n;
  return Math.min(px, w / 2, h / 2);
}

/** One container transform. */
export interface ContainerMotion {
  /** Heads for open (1) or closed (0) from where it is; `start` replaces the geometry. */
  to(target: 0 | 1, start?: ContainerStart): void;
  /** Ends the run at once where it is headed. */
  finish(): void;
  /** Progress now, 0–1. */
  readonly progress: number;
  /** Resolves when the current run ends (finished, or replaced by a later `to()`). */
  readonly finished: Promise<void>;
}

/**
 * Drives `el`'s container transform, resting at the trigger's rect (progress 0) until the first
 * `to(1)`. `endRadius` is the popup's own corner radius. Each `to()` starts from the present
 * progress and velocity; under reduced motion it only fades.
 */
export function containerMotion(
  el: HTMLElement,
  start: ContainerStart,
  endRadius: number,
): ContainerMotion {
  let geometry = start;
  let anim: Animation | null = null;
  /** The running segment: its spring, target, start displacement and velocity, start progress. */
  let seg = { s: springs.quick, target: 0, x0: 0, v0: 0, reduced: false, from: 0 };
  let finished = Promise.resolve();

  /** Progress and velocity now. */
  const state = (): [number, number] => {
    if (!anim) return [seg.target, 0];
    const ms = Number(anim.currentTime ?? 0);
    if (seg.reduced) {
      const total = Math.max(1, Number(anim.effect?.getTiming().duration ?? 1));
      const k = clamp(ms / total, 0, 1);
      return [seg.from + (seg.target - seg.from) * k, 0];
    }
    const [x, v] = solve(seg.s, seg.x0, seg.v0, ms / 1000);
    return [seg.target + x, v];
  };

  return {
    get progress() {
      return clamp(state()[0], 0, 1);
    },
    get finished() {
      return finished;
    },
    to(next, nextStart) {
      const [p, v] = state();
      if (nextStart) geometry = nextStart;
      const last = anim;
      let run: Animation;
      if (reducedMotion()) {
        // §7.5: the fade alone, from the opacity it has, within 150 ms (A-9). Its progress is
        // kept on the fade's own scale (opacity = p / FADE_SPAN), so a turn starts where it is.
        const from = clamp(p / FADE_SPAN, 0, 1);
        const ms = next === 1 ? REDUCED_DURATION_MS.base : REDUCED_DURATION_MS.fast;
        seg = {
          s: springs.quick,
          target: next,
          x0: 0,
          v0: 0,
          reduced: true,
          from: from * FADE_SPAN,
        };
        if (next === 1) seg.target = FADE_SPAN;
        run = el.animate([{ opacity: String(r2(from)) }, { opacity: String(next) }], {
          duration: Math.max(1, ms * Math.abs(next - from)),
          easing: next === 1 ? EASE.out : EASE.exit,
          fill: 'forwards',
        });
      } else {
        const s = next === 1 ? springs.quick : springs.press;
        seg = { s, target: next, x0: p - next, v0: v, reduced: false, from: p };
        const settle = energy(s, seg.x0, v) * PRECISION;
        const frames: Keyframe[] = [];
        for (let i = 0; i < FPS * 2; i++) {
          const [x, vx] = solve(s, seg.x0, v, i / FPS);
          if (i > 0 && energy(s, x, vx) <= settle) break;
          frames.push(containerFrame(geometry, endRadius, next + x));
        }
        frames.push(containerFrame(geometry, endRadius, next));
        run = el.animate(frames, {
          duration: Math.max(1, ((frames.length - 1) * 1000) / FPS),
          fill: 'forwards',
        });
      }
      anim = run;
      // Cancelled after the new run has its first frame, so no frame shows the stylesheet.
      last?.cancel();
      finished = new Promise<void>((resolve) => {
        run.onfinish = () => {
          if (anim === run && next === 1) {
            // Open and at rest: nothing inline (Q-2).
            anim = null;
            seg.target = 1;
            run.cancel();
          }
          resolve();
        };
        run.oncancel = () => {
          if (anim === run) anim = null;
          resolve();
        };
      });
    },
    finish() {
      anim?.finish();
    },
  };
}

/** Running pulses, so a second one replaces the first. */
const pulses = new WeakMap<Element, Animation>();
/** The pulse's keyframes, sampled once. */
let pulseFrames: Keyframe[] | null = null;

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
  const k = PULSE_PEAK / Math.max(...xs, 1e-6);
  return [
    ...xs.map((x) => ({ scale: String(Math.round((1 + x * k) * 1e4) / 1e4) })),
    { scale: '1' },
  ];
}

/**
 * The *receive* pulse: `el`'s `scale` swells by `PULSE_PEAK` and settles on `pop`, as if it took
 * the popup back in. `scale` composes with any transform the control has (its press). Nothing
 * under reduced motion; nothing is left at rest.
 */
export function receivePulse(el: Element): void {
  if (!(el instanceof HTMLElement) || typeof el.animate !== 'function' || reducedMotion()) return;
  pulseFrames ??= samplePulse();
  pulses.get(el)?.cancel();
  const run = el.animate(pulseFrames, { duration: ((pulseFrames.length - 1) * 1000) / FPS });
  pulses.set(el, run);
  run.onfinish = () => {
    if (pulses.get(el) === run) pulses.delete(el);
    run.cancel();
  };
}
