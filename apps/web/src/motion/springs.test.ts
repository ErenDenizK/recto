/**
 * The spring tokens, the analytic solver, settle times and the `linear()` curves (language.md
 * §7.1–§7.2, A-10; research 18 §2–§3; spec D0-12).
 */
import { describe, expect, it } from 'vitest';

import { type Spring, settleTime, solve, spring, springs, springToLinear } from './springs';

/** language.md §7.1: d, bounce, k / c, 90 % and 99 % (ms), CSS duration (ms). */
const TABLE = {
  press: [0.2, 0, 987, 62.8, 124, 212, 300],
  quick: [0.28, 0, 504, 44.9, 174, 296, 420],
  smooth: [0.36, 0, 305, 34.9, 223, 381, 530],
  glide: [0.46, 0, 187, 27.3, 285, 487, 680],
  fling: [0.4, 0.15, 247, 26.7, 203, 285, 560],
  pop: [0.32, 0.25, 386, 29.5, 143, null, 410],
  track: [0.1, 0, 3948, 125.7, 62, 106, 150],
} as const;

const ratio = (s: Spring) => s.damping / (2 * Math.sqrt(s.stiffness));

/** A fourth-order Runge–Kutta integration of x″ = −k·x − c·x′, as an independent check. */
function integrate(s: Spring, x0: number, v0: number, t: number): [number, number] {
  const n = 20000;
  const h = t / n;
  let x = x0;
  let v = v0;
  const a = (px: number, pv: number) => -s.stiffness * px - s.damping * pv;
  for (let i = 0; i < n; i++) {
    const k1x = v;
    const k1v = a(x, v);
    const k2x = v + (h / 2) * k1v;
    const k2v = a(x + (h / 2) * k1x, v + (h / 2) * k1v);
    const k3x = v + (h / 2) * k2v;
    const k3v = a(x + (h / 2) * k2x, v + (h / 2) * k2v);
    const k4x = v + h * k3v;
    const k4v = a(x + h * k3x, v + h * k3v);
    x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
  return [x, v];
}

/** Evaluates a CSS `linear()` easing at input progress `f` (0–1). */
function evaluate(easing: string, f: number): number {
  const parts = easing
    .replace(/^linear\(|\)$/g, '')
    .split(',')
    .map((part) => part.trim().split(/\s+/));
  const stops = parts.map(([value, at], i): [number, number] => [
    at ? Number(at.replace('%', '')) / 100 : i === 0 ? 0 : 1,
    Number(value),
  ]);
  for (let i = 1; i < stops.length; i++) {
    const [a, va] = stops[i - 1]!;
    const [b, vb] = stops[i]!;
    if (f <= b) return b === a ? vb : va + ((vb - va) * (f - a)) / (b - a);
  }
  return 1;
}

describe('the seven tokens (language.md §7.1)', () => {
  it.each(Object.entries(TABLE))('%s has the table’s stiffness and damping', (name, row) => {
    const [d, bounce, k, c] = row;
    const s = springs[name as keyof typeof springs];
    expect(s.stiffness).toBeCloseTo(k, -0.5);
    expect(Math.abs(s.damping - c)).toBeLessThan(0.051);
    expect(s).toEqual(spring(d, bounce));
    // k = (2π / d)², c = 4π(1 − b) / d.
    expect(s.stiffness).toBeCloseTo(((2 * Math.PI) / d) ** 2, 9);
    expect(s.damping).toBeCloseTo((4 * Math.PI * (1 - bounce)) / d, 9);
  });

  it('zero bounce is critically damped; fling and pop keep A-10’s damping floors', () => {
    for (const name of ['press', 'quick', 'smooth', 'glide', 'track'] as const) {
      expect(ratio(springs[name])).toBeCloseTo(1, 9);
    }
    expect(ratio(springs.fling)).toBeCloseTo(0.85, 9);
    expect(ratio(springs.pop)).toBeCloseTo(0.75, 9);
    expect(ratio(springs.pop)).toBeGreaterThanOrEqual(0.7);
  });

  it('a negative bounce gives an over-damped spring (research 18 §2: ζ = 1 / (1 + b))', () => {
    expect(ratio(spring(0.3, -0.2))).toBeCloseTo(1.25, 9);
  });
});

describe('solve: the analytic solution', () => {
  it('matches closed forms in all three damping regimes', () => {
    // Critically damped, ω = 1: x = (1 + t) e^−t, v = −t e^−t.
    const [xc, vc] = solve({ stiffness: 1, damping: 2 }, 1, 0, 1);
    expect(xc).toBeCloseTo(2 / Math.E, 12);
    expect(vc).toBeCloseTo(-1 / Math.E, 12);
    // Under-damped, ω = 2, ζ = 0.5, ωd = √3: x = e^−t (cos √3t + sin √3t / √3).
    const t = 0.7;
    const r3 = Math.sqrt(3);
    const [xu, vu] = solve({ stiffness: 4, damping: 2 }, 1, 0, t);
    expect(xu).toBeCloseTo(Math.exp(-t) * (Math.cos(r3 * t) + Math.sin(r3 * t) / r3), 12);
    expect(vu).toBeCloseTo(Math.exp(-t) * (-(4 / r3) * Math.sin(r3 * t)), 12);
    // Undamped: x = cos t, v = −sin t.
    const [xn, vn] = solve({ stiffness: 1, damping: 0 }, 1, 0, Math.PI / 2);
    expect(xn).toBeCloseTo(0, 12);
    expect(vn).toBeCloseTo(-1, 12);
    // Over-damped, ω = 1, ζ = 1.25: roots −0.5 and −2, x = 4/3 e^−t/2 − 1/3 e^−2t.
    const [xo, vo] = solve({ stiffness: 1, damping: 2.5 }, 1, 0, 1);
    expect(xo).toBeCloseTo((4 / 3) * Math.exp(-0.5) - (1 / 3) * Math.exp(-2), 12);
    expect(vo).toBeCloseTo((-2 / 3) * Math.exp(-0.5) + (2 / 3) * Math.exp(-2), 12);
  });

  it('agrees with a numerical integration, with an initial velocity, in each regime', () => {
    const cases: [Spring, number, number][] = [
      [springs.quick, 120, -900],
      [springs.fling, -40, 1500],
      [springs.pop, 1, 0],
      [spring(0.3, -0.4), 60, 300],
    ];
    for (const [s, x0, v0] of cases) {
      for (const t of [0, 0.03, 0.12, 0.35]) {
        const [x, v] = solve(s, x0, v0, t);
        const [ix, iv] = integrate(s, x0, v0, t);
        expect(Math.abs(x - ix)).toBeLessThan(1e-6 * (Math.abs(x0) + Math.abs(v0)));
        expect(Math.abs(v - iv)).toBeLessThan(1e-5 * (Math.abs(x0) + Math.abs(v0)));
      }
    }
  });

  it('starts at the given displacement and velocity', () => {
    for (const s of Object.values(springs)) {
      expect(solve(s, 42, -7, 0)).toEqual([42, -7]);
    }
  });
});

describe('settleTime (A-10 reads the 99 % settle)', () => {
  it.each(Object.entries(TABLE))('%s reaches 90 % and 99 % when the table says', (name, row) => {
    const s = springs[name as keyof typeof springs];
    const [, , , , p90, p99] = row;
    expect(Math.ceil(settleTime(s, 0.1) * 1000)).toBe(p90);
    if (p99 !== null) expect(Math.ceil(settleTime(s) * 1000)).toBe(p99);
  });

  it('keeps every token inside A-10: any transition settles within 500 ms', () => {
    for (const s of Object.values(springs)) expect(settleTime(s)).toBeLessThanOrEqual(0.5);
    // The tokens under a pressed control or a pointer would pass even the input-blocking 250 ms.
    for (const name of ['press', 'track'] as const) {
      expect(settleTime(springs[name])).toBeLessThanOrEqual(0.25);
    }
  });

  it('is the last time the spring is outside the band, overshoot included', () => {
    const s = springs.pop;
    const t = settleTime(s, 0.001);
    expect(Math.abs(solve(s, 1, 0, t - 0.002)[0])).toBeGreaterThan(0.001);
    for (let ms = 0; ms < 400; ms++) {
      expect(Math.abs(solve(s, 1, 0, t + ms / 1000)[0])).toBeLessThanOrEqual(0.001);
    }
  });

  it('is zero for a spring already at rest, and grows with an initial velocity', () => {
    expect(settleTime(springs.quick, 0.01, 0, 0)).toBe(0);
    expect(settleTime(springs.quick, 0.01, 1, 20)).toBeGreaterThan(settleTime(springs.quick));
  });
});

describe('springToLinear (language.md §7.2, MO-2)', () => {
  /** language.md §7.2's `--ease-spring`. */
  const EASE_SPRING =
    'linear(0, 0.005 1.2%, 0.02 2.3%, 0.046 3.7%, 0.084 5.2%, 0.159 7.7%, 0.366 13.8%, ' +
    '0.461 16.8%, 0.556 20.2%, 0.639 23.5%, 0.709 26.8%, 0.767 30.2%, 0.817 33.7%, 0.861 37.5%, ' +
    '0.9 42%, 0.93 46.8%, 0.954 52.3%, 0.971 58.5%, 0.983 65.3%, 0.991 73.7%, 1)';

  it.each(Object.entries(TABLE))('%s has the table’s CSS duration', (name, row) => {
    expect(springToLinear(name as keyof typeof springs).duration).toBe(row[6]);
  });

  it('writes a small, well-formed linear() with increasing stops', () => {
    for (const name of Object.keys(springs) as (keyof typeof springs)[]) {
      const { easing } = springToLinear(name);
      expect(easing).toMatch(/^linear\(0, .+, 1\)$/);
      const stops = easing.slice(7, -1).split(', ');
      expect(stops.length).toBeGreaterThanOrEqual(10);
      expect(stops.length).toBeLessThanOrEqual(24);
      const at = stops.slice(1, -1).map((stop) => {
        expect(stop).toMatch(/^-?\d+(\.\d{1,3})? \d+(\.\d)?%$/);
        return Number(stop.split(' ')[1]?.replace('%', ''));
      });
      for (let i = 1; i < at.length; i++) expect(at[i]).toBeGreaterThan(at[i - 1]!);
    }
  });

  it('is deterministic, and one string serves every zero-bounce token', () => {
    expect(springToLinear('quick')).toEqual(springToLinear('quick'));
    const shared = springToLinear('smooth').easing;
    for (const name of ['press', 'quick', 'glide', 'track'] as const) {
      expect(springToLinear(name).easing).toBe(shared);
    }
    expect(springToLinear('fling').easing).not.toBe(shared);
    expect(springToLinear('pop').easing).not.toBe(shared);
  });

  it('stays within 0.25 % of the analytic spring, and fling and pop keep their overshoot', () => {
    for (const name of Object.keys(springs) as (keyof typeof springs)[]) {
      const s = springs[name];
      const end = settleTime(s, 0.001, -1);
      const { easing } = springToLinear(name);
      for (let i = 0; i <= 500; i++) {
        const exact = 1 + solve(s, -1, 0, (i / 500) * end)[0];
        // Stops are rounded to 0.001 and 0.1 %, which adds at most a little to the tolerance.
        expect(Math.abs(evaluate(easing, i / 500) - exact)).toBeLessThan(0.0045);
      }
    }
    expect(springToLinear('fling').easing).toMatch(/1\.00\d/);
    expect(springToLinear('pop').easing).toMatch(/1\.02\d/);
  });

  it('reproduces language.md §7.2’s --ease-spring', () => {
    const { easing } = springToLinear('quick');
    for (let i = 0; i <= 1000; i++) {
      expect(Math.abs(evaluate(easing, i / 1000) - evaluate(EASE_SPRING, i / 1000))).toBeLessThan(
        0.005,
      );
    }
  });

  it('takes an initial velocity', () => {
    const still = springToLinear('quick');
    const thrown = springToLinear('quick', 6);
    expect(thrown.easing).not.toBe(still.easing);
    expect(evaluate(thrown.easing, 0.05)).toBeGreaterThan(evaluate(still.easing, 0.05));
  });
});
