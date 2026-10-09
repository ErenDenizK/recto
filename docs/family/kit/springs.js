/**
 * Kept light: one spring grammar, each product's tempo (family kit, motion.md).
 *
 * One formula: a damped spring of mass 1, x″ + c·x′ + k·x = 0, solved in closed form. A spring is
 * named either by its stiffness k and damping c (the portfolio's habit) or by a perceptual
 * duration d and bounce b (Recto's and SwiftUI's habit), which map onto each other exactly:
 *
 *   k = (2π / d)²        c = 4π(1 − b) / d   for b ≥ 0      c = 4π / (d(1 + b))   for b < 0
 *
 * so `Spring(duration: d, bounce: b)` in SwiftUI (springs.swift) and `spring({ duration: d,
 * bounce: b })` here are the same physical spring. CSS gets it as a `linear()` curve plus the
 * duration it is written for: the time to settle within 0.1 % of the target, rounded up to 10 ms.
 * The solver and the reduction are Recto's (apps/web/src/motion/springs.ts), ported unchanged, so
 * for Recto's tokens this file prints Recto's own strings.
 *
 * Four roles, the grammar (family.md F1): press answers the finger, settle ends every move, glide
 * carries you between places, pop is rare and small. Each product sets its own tempo in TEMPOS.
 * Springs carry position, size and scale; opacity and colour stay on short eases.
 *
 * No dependencies, no build step; an ES module for browsers and Node 18+.
 *
 * CLI:  node springs.js                 the tempo table of every product
 *       node springs.js recto           CSS custom properties for one tempo (with reduced motion)
 *       node springs.js k=300 c=30      one spring's linear() and duration
 *       node springs.js d=0.36 b=0      the same, by duration and bounce
 */

/** The four roles of the grammar. */
export const ROLES = Object.freeze(['press', 'settle', 'glide', 'pop']);

/**
 * A spring of mass 1 from any of its names:
 *   { stiffness, damping }      { duration, bounce }      { response, dampingFraction }
 * (`response`/`dampingFraction` are SwiftUI's older spring(response:dampingFraction:) pair:
 * k = (2π / response)², ζ = dampingFraction.)
 */
export function spring(def) {
  if (def.stiffness !== undefined) return { stiffness: def.stiffness, damping: def.damping };
  if (def.duration !== undefined) {
    const w = (2 * Math.PI) / def.duration;
    const b = def.bounce ?? 0;
    return { stiffness: w * w, damping: 2 * w * (b < 0 ? 1 / (1 + b) : 1 - b) };
  }
  if (def.response !== undefined) {
    const w = (2 * Math.PI) / def.response;
    return { stiffness: w * w, damping: 2 * w * (def.dampingFraction ?? 1) };
  }
  throw new TypeError('a spring needs {stiffness, damping}, {duration, bounce} or {response, dampingFraction}');
}

/** Damping ratio ζ (1 = critical, no overshoot; below 1 overshoots). */
export const dampingRatio = (s) => s.damping / (2 * Math.sqrt(s.stiffness));

/** The inverse map: perceptual duration and bounce of a spring (for SwiftUI and the tables). */
export function durationBounce(s) {
  const w = Math.sqrt(s.stiffness);
  const z = dampingRatio(s);
  return { duration: (2 * Math.PI) / w, bounce: z <= 1 ? 1 - z : 1 / z - 1 };
}

/**
 * Closed-form displacement and velocity at `t` seconds for a spring released at displacement
 * `x0` with velocity `v0`. Under-, critically and over-damped springs each have their own form.
 */
export function solve(s, x0, v0, t) {
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

/** Energy over stiffness, x² + v²/k: damping only removes it, so once inside a band it stays. */
const energy = (s, x, v) => x * x + (v * v) / s.stiffness;

/** Seconds until the spring stays within `eps` of its target (default 1 %, from rest, unit move). */
export function settleTime(s, eps = 0.01, x0 = 1, v0 = 0) {
  const step = 0.0025 / Math.sqrt(s.stiffness);
  let last = 0;
  for (let i = 0; i < 2e4; i++) {
    const [x, v] = solve(s, x0, v0, i * step);
    if (Math.abs(x) > eps) last = (i + 1) * step;
    else if (energy(s, x, v) <= eps * eps) break;
  }
  return last;
}

/** Peak overshoot of a unit move from rest, as a fraction (0 for ζ ≥ 1). */
export function overshoot(s) {
  const z = dampingRatio(s);
  return z >= 1 ? 0 : Math.exp((-Math.PI * z) / Math.sqrt(1 - z * z));
}

const round = (n, places) => +n.toFixed(places);

/**
 * The spring as a CSS easing: `{ easing: 'linear(0, …, 1)', duration: ms }`. Sampled from the
 * closed form up to the 0.1 % settle time, reduced with Ramer–Douglas–Peucker to within
 * `tolerance` of the distance (0.25 %: about twenty stops for a zero-bounce spring). A critically
 * damped spring from rest has one shape, so every zero-bounce spring gives the same string and
 * only the duration differs. `velocity` is an initial velocity in distances per second.
 */
export function toLinear(def, { velocity = 0, tolerance = 0.0025, samples = 1000 } = {}) {
  const s = spring(def);
  const end = settleTime(s, 0.001, -1, velocity);
  const at = (i) => 1 + solve(s, -1, velocity, (i * end) / samples)[0];
  const stops = ['0'];
  const reduce = (a, b) => {
    let worst = tolerance;
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
      stops.push(`${round(at(split), 3)} ${round((split / samples) * 100, 1)}%`);
      reduce(split, b);
    }
  };
  reduce(0, samples);
  stops.push('1');
  return { easing: `linear(${stops.join(', ')})`, duration: Math.ceil(end * 100) * 10 };
}

/**
 * Each product's tempo: the spring each role plays, with where the number comes from. `null`
 * means the product does not use that role. `status` says whether the product already runs these
 * springs ('shipped'), runs something else today ('equivalent': the springs reproduce today's
 * durations and are offered, not imposed), or the values are estimated ('estimated').
 */
export const TEMPOS = Object.freeze({
  recto: {
    status: 'shipped',
    source: 'recto apps/web/src/motion/springs.ts (language.md §7.1)',
    character: 'zero bounce on every surface; idle frames = 0',
    press: { duration: 0.2, bounce: 0, note: 'Recto press: release after scale .97 mouse / .94 touch' },
    settle: { duration: 0.36, bounce: 0, note: 'Recto smooth: bar morphs, panels, reflow' },
    glide: { duration: 0.46, bounce: 0, note: 'Recto glide: phone sheets, large moves' },
    pop: { duration: 0.32, bounce: 0.25, note: 'Recto pop: one small glyph, never a surface' },
  },
  'english-prep': {
    status: 'equivalent',
    source: 'english-prep css/editorial.css, css/interactions.css (v0.75): eases today',
    character: 'tactile press and a long, continuous release; no bounce',
    today: {
      ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
      press: '100 ms compression (--d-press)',
      settle: '380 ms release (--d-release)',
      glide: '360 ms route over 12 px (--d-route)',
      pop: '220 ms answer confirm / retry (--d-reveal)',
    },
    // Zero-bounce springs fitted to today's curve: for each duration T, the d whose spring stays
    // closest to cubic-bezier(0.22, 1, 0.36, 1) over T (max difference 7.6 % of the distance,
    // motion.md §3.2). They settle sooner than T because that ease is already 98 % there at 0.6 T.
    press: { duration: 0.048, bounce: 0, note: 'fits the 100 ms press compression' },
    settle: { duration: 0.182, bounce: 0, note: 'fits the 380 ms release' },
    glide: { duration: 0.172, bounce: 0, note: 'fits the 360 ms route' },
    pop: { duration: 0.105, bounce: 0, note: 'fits the 220 ms answer confirm / retry' },
  },
  'eat-map': {
    status: 'estimated',
    source: 'iOS system springs (SwiftUI Spring presets); confirm in the Xcode project',
    character: 'the platform\'s own springs; native feel over house style',
    press: null,
    settle: { duration: 0.5, bounce: 0, note: 'SwiftUI .smooth' },
    glide: null,
    pop: { duration: 0.5, bounce: 0.3, note: 'SwiftUI .bouncy, compose only' },
  },
  portfolio: {
    status: 'equivalent',
    source: 'Portfolio src/styles/global.css (--spring-ui, --spring-object); family.md §2.2 proposes press and glide',
    character: 'calm UI, one overshoot reserved for objects',
    press: { stiffness: 600, damping: 49, note: 'proposed (family.md §2.2); today --d-1 120 ms ease' },
    settle: { stiffness: 300, damping: 30, note: '--spring-ui: nav indicator, sheet release, object lean' },
    glide: { stiffness: 170, damping: 26, note: 'proposed: sheet open, room change; today --d-4 480 ms ease' },
    pop: { stiffness: 180, damping: 16, note: '--spring-object: objects only (one ~9 % overshoot)' },
  },
});

/** Durations under reduced motion (motion.md §4): spatial springs jump, fades stay perceptible. */
export const REDUCED = Object.freeze({ spring: 0, fadeMax: 150 });

/**
 * CSS custom properties for a tempo:
 *   --kl-press: 300ms; --kl-press-ease: linear(…);   (and settle, glide, pop)
 * plus the reduced-motion twin, under the media query and under [data-motion='reduced'].
 */
export function tempoCSS(tempo, { prefix = '--kl', selector = ':root' } = {}) {
  const t = typeof tempo === 'string' ? TEMPOS[tempo] : tempo;
  if (!t) throw new Error(`unknown tempo ${tempo}`);
  const on = [];
  const off = [];
  for (const role of ROLES) {
    if (!t[role]) continue;
    const { easing, duration } = toLinear(t[role]);
    on.push(`  ${prefix}-${role}: ${duration}ms;`, `  ${prefix}-${role}-ease: ${easing};`);
    off.push(`  ${prefix}-${role}: ${REDUCED.spring}ms;`);
  }
  return [
    `${selector} {`,
    ...on,
    '}',
    `@media (prefers-reduced-motion: reduce) {`,
    `  ${selector} {`,
    ...off.map((l) => '  ' + l),
    '  }',
    '}',
    `${selector}[data-motion='reduced'] {`,
    ...off,
    '}',
  ].join('\n');
}

/** One row per role: the numbers motion.md's table prints. */
export function describeTempo(tempo) {
  const t = typeof tempo === 'string' ? TEMPOS[tempo] : tempo;
  return ROLES.map((role) => {
    if (!t[role]) return { role, used: false };
    const s = spring(t[role]);
    const { duration, bounce } = durationBounce(s);
    return {
      role,
      used: true,
      k: round(s.stiffness, 1),
      c: round(s.damping, 1),
      zeta: round(dampingRatio(s), 2),
      d: round(duration, 3),
      bounce: round(bounce, 2),
      settle99: Math.round(settleTime(s) * 1000),
      css: toLinear(t[role]).duration,
      overshoot: round(overshoot(s) * 100, 1),
      note: t[role].note,
    };
  });
}

/* ── CLI ───────────────────────────────────────────────────────────────────────────────── */

const argv = globalThis.process?.argv;
if (argv?.[1] && import.meta.url === new URL(`file://${argv[1]}`).href) {
  const args = argv.slice(2);
  if (args.length && args.every((a) => a.includes('='))) {
    const o = Object.fromEntries(args.map((a) => a.split('=')).map(([k, v]) => [k, +v]));
    const def = o.k !== undefined ? { stiffness: o.k, damping: o.c } : { duration: o.d, bounce: o.b ?? 0 };
    const s = spring(def);
    console.log(JSON.stringify({ ...def, k: s.stiffness, c: s.damping, zeta: dampingRatio(s), ...durationBounce(s) }));
    console.log(toLinear(def));
  } else if (args[0]) {
    console.log(tempoCSS(args[0]));
  } else {
    for (const [name, t] of Object.entries(TEMPOS)) {
      console.log(`\n${name} (${t.status}): ${t.character}`);
      for (const r of describeTempo(t)) {
        if (!r.used) {
          console.log(`  ${r.role.padEnd(7)} not used`);
          continue;
        }
        console.log(
          `  ${r.role.padEnd(7)} k ${String(r.k).padStart(6)}  c ${String(r.c).padStart(5)}  ζ ${r.zeta.toFixed(2)}  ` +
            `d ${r.d.toFixed(3)} b ${r.bounce.toFixed(2)}  99% ${String(r.settle99).padStart(4)} ms  css ${String(r.css).padStart(4)} ms  ` +
            `over ${r.overshoot}%  ${r.note ?? ''}`,
        );
      }
    }
  }
}
