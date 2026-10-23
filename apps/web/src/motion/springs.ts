/**
 * Springs: the seven tokens, the analytic solver, settle times and `linear()` curves
 * (language.md §7.1–§7.2; ADR-0026 §2 items 1–2; research 18 §2, §3.1–§3.4; 09-primitives §31).
 *
 * Springs carry position, size and scale; eases carry opacity and colour and live in CSS only.
 * Mass is 1 for every token (`preset()` publishes k, c, m and ζ; MOT-18). A token is named by its perceptual duration d and bounce b: stiffness
 * k = (2π / d)², damping c = 2ζ√k with ζ = 1 − b (b ≥ 0) or 1 / (1 + b) (b < 0), which for
 * b ≥ 0 is §7.1's c = 4π(1 − b) / d. Script springs are physics-defined so they take an initial
 * velocity (MO-3); CSS uses the same springs as `linear()` curves (MO-2), which
 * `springToLinear()` generates from the analytic solution.
 */

/**
 * A damped spring (language.md §7.1): m·x″ + c·x′ + k·x = 0. `mass` defaults to 1, and the tokens
 * keep it there; only the ratios k / m and c / m shape a move, so a heavier preset is the same
 * curve with a slower, larger-momentum response to the same push (MOT-18).
 */
export interface Spring {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass?: number;
}

/** The seven tokens of language.md §7.1; components pick from these names only (Q-10). */
export type SpringName = 'press' | 'quick' | 'smooth' | 'glide' | 'fling' | 'pop' | 'track';

/** A CSS easing with the duration it is written for (language.md §7.2). */
export interface LinearEasing {
  /** `linear(0, … , 1)`. */
  readonly easing: string;
  /** Milliseconds: the time to within 0.1 % of the target, rounded up to 10 ms. */
  readonly duration: number;
}

/** The spring of perceptual duration `duration` (seconds) and `bounce` (research 18 §2). */
export function spring(duration: number, bounce = 0): Spring {
  const w = (2 * Math.PI) / duration;
  return { stiffness: w * w, damping: 2 * w * (bounce < 0 ? 1 / (1 + bounce) : 1 - bounce) };
}

/**
 * The seven tokens (language.md §7.1). Zero bounce for anything a click, tap or key starts;
 * bounce only where a gesture hands over momentum (`fling`) and on one small glyph (`pop`).
 *
 * | Token  | d      | Bounce | k / c        | 99 % at | Use                                    |
 * |--------|--------|--------|--------------|---------|----------------------------------------|
 * | press  | 0.20 s | 0      | 987 / 62.8   | 212 ms  | Press release, switch thumbs           |
 * | quick  | 0.28 s | 0      | 504 / 44.9   | 296 ms  | Menus, popovers, bars, toasts, zoom    |
 * | smooth | 0.36 s | 0      | 305 / 34.9   | 381 ms  | Bar morphs, panels, reflow (FLIP)      |
 * | glide  | 0.46 s | 0      | 187 / 27.3   | 487 ms  | Phone sheets, smart zoom, large moves  |
 * | fling  | 0.40 s | 0.15   | 247 / 26.7   | 285 ms  | Releases faster than 300 px/s          |
 * | pop    | 0.32 s | 0.25   | 386 / 29.5   | —       | One small glyph; never a surface       |
 * | track  | 0.10 s | 0      | 3948 / 125.7 | 106 ms  | Things that follow the pointer         |
 */
export const springs: Readonly<Record<SpringName, Spring>> = {
  press: spring(0.2),
  quick: spring(0.28),
  smooth: spring(0.36),
  glide: spring(0.46),
  fling: spring(0.4, 0.15),
  pop: spring(0.32, 0.25),
  track: spring(0.1),
};

/** A token name or a spring, as every helper of the module accepts. */
export const springOf = (s: SpringName | Spring): Spring =>
  typeof s === 'string' ? springs[s] : s;

/** The spring per unit mass: what the solver integrates (k / m, c / m). */
const unit = (s: Spring): Spring => {
  const m = s.mass ?? 1;
  return m === 1 ? s : { stiffness: s.stiffness / m, damping: s.damping / m };
};

/** A token's physical parameters, as the motion tokens publish them (MOT-18). */
export interface SpringPreset {
  readonly stiffness: number;
  readonly damping: number;
  readonly mass: number;
  /** The damping ratio ζ = c / (2√(k·m)): 1 is critical (no overshoot), under 1 bounces. */
  readonly ratio: number;
}

/** Stiffness, damping, mass and damping ratio of a token or spring, rounded for reading. */
export function preset(token: SpringName | Spring): SpringPreset {
  const s = springOf(token);
  const mass = s.mass ?? 1;
  const r = (n: number) => Math.round(n * 10) / 10;
  return {
    stiffness: r(s.stiffness),
    damping: r(s.damping),
    mass,
    ratio: Math.round((s.damping / (2 * Math.sqrt(s.stiffness * mass))) * 1000) / 1000,
  };
}
/**
 * The closed-form solution of x″ + c·x′ + k·x = 0: displacement from the target and velocity
 * at `t` seconds for a spring released at displacement `x0` with velocity `v0` (units per
 * second). Under-, critically and over-damped springs each have their own form; the tokens
 * with zero bounce are exactly critical (ζ = 1).
 */
export function solve(spec: Spring, x0: number, v0: number, t: number): [x: number, v: number] {
  const s = unit(spec);
  const k = s.stiffness;
  const w = Math.sqrt(k);
  const z = s.damping / (2 * w);
  if (Math.abs(z - 1) < 1e-6) {
    const b = v0 + w * x0;
    const e = Math.exp(-w * t);
    return [(x0 + b * t) * e, (v0 - w * b * t) * e];
  }
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    const e = Math.exp(-z * w * t);
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    return [
      e * (x0 * cos + ((v0 + z * w * x0) / wd) * sin),
      e * (v0 * cos - ((k * x0 + z * w * v0) / wd) * sin),
    ];
  }
  const root = w * Math.sqrt(z * z - 1);
  const r1 = -z * w + root;
  const r2 = -z * w - root;
  const a = (v0 - r2 * x0) / (r1 - r2);
  const e1 = a * Math.exp(r1 * t);
  const e2 = (x0 - a) * Math.exp(r2 * t);
  return [e1 + e2, r1 * e1 + r2 * e2];
}

/**
 * The spring's energy over its stiffness, x² + v² / k. Damping only ever removes energy, so a
 * spring whose energy is inside a band can never leave it: the settle test of the module.
 */
export const energy = (s: Spring, x: number, v: number) =>
  x * x + (v * v * (s.mass ?? 1)) / s.stiffness;

/**
 * Scan step of `settleTime()` as a fraction of the spring's natural time 1 / ω: about 0.1 ms
 * for the tokens, and the same in shape for every spring of the same damping ratio.
 */
const STEP = 0.0025;

/**
 * Seconds after which the spring stays within `eps` of its target, for a move released at
 * displacement `x0` with velocity `v0`. The defaults give the 99 % settle time of a unit move
 * from rest, the time A-10's limits are read on (language.md §7.1: input-blocking ≤ 250 ms, any
 * transition ≤ 500 ms). The scan stops once the spring's `energy()` is inside the band, which
 * it can never leave again.
 */
export function settleTime(s: Spring, eps = 0.01, x0 = 1, v0 = 0): number {
  const step = STEP / Math.sqrt(unit(s).stiffness);
  let last = 0;
  for (let i = 0; i < 2e4; i++) {
    const [x, v] = solve(s, x0, v0, i * step);
    if (Math.abs(x) > eps) last = (i + 1) * step;
    else if (energy(s, x, v) <= eps * eps) break;
  }
  return last;
}

/** Reduction tolerance of `springToLinear()`: 0.25 % of the distance (research 18 §3.3). */
const TOLERANCE = 0.0025;
/** Samples taken before the reduction. */
const SAMPLES = 1000;

const round = (n: number, places: number) => +n.toFixed(places);

/**
 * The spring as a CSS `linear()` easing from 0 to 1 and its duration (language.md §7.2, MO-2):
 * sampled from the analytic solution up to the time it is within 0.1 % of the target, and
 * reduced with Ramer–Douglas–Peucker to within 0.25 % of the distance, so a zero-bounce token
 * comes out at about twenty stops. The stops are placed on that exact 0.1 % time and the duration
 * is it rounded up to 10 ms, as the tokens are: a critically damped spring from rest has one
 * shape, so press, quick, smooth, glide and track all give the same string (`--ease-spring`).
 * `velocity` is an initial velocity in distances per second. The output is deterministic
 * (D3-4 writes the tokens from it).
 */
export function springToLinear(token: SpringName | Spring, velocity = 0): LinearEasing {
  const s = springOf(token);
  const end = settleTime(s, 0.001, -1, velocity);
  const at = (i: number) => 1 + solve(s, -1, velocity, (i * end) / SAMPLES)[0];
  // Ramer–Douglas–Peucker, walked in order so the stops come out sorted.
  const stops = ['0'];
  const reduce = (a: number, b: number) => {
    let worst = TOLERANCE;
    let split = 0;
    for (let i = a + 1; i < b; i++) {
      const off = Math.abs(at(i) - at(a) - ((at(b) - at(a)) * (i - a)) / (b - a));
      if (off > worst) {
        worst = off;
        split = i;
      }
    }
    if (split) {
      reduce(a, split);
      stops.push(`${round(at(split), 3)} ${round((split / SAMPLES) * 100, 1)}%`);
      reduce(split, b);
    }
  };
  reduce(0, SAMPLES);
  stops.push('1');
  return { easing: `linear(${stops.join(', ')})`, duration: Math.ceil(end * 100) * 10 };
}

/**
 * The `cubic-bezier()` stand-ins for engines without `linear()` (Safari before 17.2, Chrome before
 * 113, Firefox before 112): fitted to the zero-bounce, fling and pop curves over their CSS
 * durations to within 3 % of the distance, the zero-bounce one held at 1 so it never overshoots.
 * `styles/motion.css` §5 sets the same three under `@supports not`.
 */
export const BEZIER_FALLBACK = {
  spring: 'cubic-bezier(0.29, 0.486, 0.03, 1)',
  fling: 'cubic-bezier(0.262, 0.373, 0.046, 1.166)',
  pop: 'cubic-bezier(0.295, 0.423, 0.055, 1.218)',
} as const;

let linearSupport: boolean | undefined;

/** Whether this engine takes `linear()` easings (asked once). */
export function supportsLinearEasing(): boolean {
  linearSupport ??=
    typeof CSS === 'undefined' ||
    typeof CSS.supports !== 'function' ||
    CSS.supports('transition-timing-function', 'linear(0, 1)');
  return linearSupport;
}

/**
 * `springToLinear()` where `linear()` works, else the token's `cubic-bezier()` stand-in for the
 * same duration (MOT-18): for Web Animations and inline transitions, which would throw on or
 * drop an easing the engine cannot parse. A release velocity bends the stand-in's first control
 * point to the same initial slope (v · duration), so a hand-off still starts at the finger's
 * speed, approximately.
 */
export function springEasing(
  token: SpringName | Spring,
  velocity = 0,
  linear = supportsLinearEasing(),
): LinearEasing {
  const curve = springToLinear(token, velocity);
  if (linear) return curve;
  const s = springOf(token);
  const ratio = s.damping / (2 * Math.sqrt(s.stiffness * (s.mass ?? 1)));
  const base =
    ratio > 0.95
      ? BEZIER_FALLBACK.spring
      : ratio > 0.8
        ? BEZIER_FALLBACK.fling
        : BEZIER_FALLBACK.pop;
  if (!velocity) return { easing: base, duration: curve.duration };
  const [x1 = 0.3, , x2 = 0.05, y2 = 1] = base
    .replace(/^cubic-bezier\(|\)$/g, '')
    .split(',')
    .map(Number);
  const y1 = Math.max(-2, Math.min(4, x1 * velocity * (curve.duration / 1000)));
  return { easing: `cubic-bezier(${x1}, ${round(y1, 3)}, ${x2}, ${y2})`, duration: curve.duration };
}
