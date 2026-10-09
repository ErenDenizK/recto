/**
 * Kept light: the family's shared light, as portable code (family kit, light.md).
 *
 * Two halves, one file, no dependencies, no build step; an ES module for browsers and Node 18+:
 *
 *   1. Colour maths and the ground ladder: OKLCH in and out, WCAG 2 contrast, a near-black ground
 *      ladder at a product's own temperature, and inks solved against it (charter rule 2: contrast
 *      is solved, not chosen). Pure functions; they run in Node and in CI.
 *   2. The light field: `checkField()` holds a field spec to the family's rules (light.md §3), and
 *      `mountField()` draws it with light.css (DOM built node by node, never innerHTML), pauses it
 *      when the page or the field is hidden, and gives it a still twin under reduced motion.
 *
 * Nothing here changes a product's values: light.md §4 records each product's current numbers, and
 * `describe()` measures them. A product adopts a piece only by choosing to (README "Adopting").
 *
 * CLI:  node light.js                 measures every product's current ground and ink
 *       node light.js ladder 265 0.007 a ladder for hue 265, chroma 0.007 (Recto's temperature)
 */

/* ── 1. Colour ─────────────────────────────────────────────────────────────────────────── */

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** `#rrggbb` to linear sRGB [0..1]. */
export function hexToLinear(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => toLinear(v / 255));
}

/** `#rrggbb` to OKLCH [L 0..1, C, h degrees] (Ottosson 2020). */
export function hexToOklch(hex) {
  const [r, g, b] = hexToLinear(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, Math.hypot(A, B), h];
}

function oklchToLinear([L, C, h]) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

/** OKLCH to `#rrggbb`. Out-of-gamut colours keep L and h and lose chroma until they fit. */
export function oklchToHex([L, C, h]) {
  let lo = 0;
  let hi = C;
  let rgb = oklchToLinear([L, C, h]);
  if (!inGamut(rgb)) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear([L, mid, h]))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinear([L, lo, h]);
  }
  const byte = (v) => Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255);
  return '#' + rgb.map((v) => byte(v).toString(16).padStart(2, '0')).join('');
}

/** WCAG 2 relative luminance of `#rrggbb`. */
export function luminance(hex) {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio of two `#rrggbb` colours (1..21). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ── 1b. The ground ladder (light.md §2) ───────────────────────────────────────────────── */

/** V1 (family.md §2.1): a ground is near-black, never pure black, never a mid-tone. */
export const GROUND = Object.freeze({ minL: 0.12, maxL: 0.2, maxChroma: 0.03 });

/** Default steps above the ground, in OKLCH L (between Recto's and English Prep's own spacing). */
export const LADDER_STEPS = Object.freeze({ ground: 0, frame: 0.04, raised: 0.08, hairline: 0.14 });

/** Default ink targets, WCAG 2 against the ground: prose 7:1 is the charter's floor for reading. */
export const INK_TARGETS = Object.freeze({ ink: 14, ink2: 7, ink3: 4.5 });

/**
 * Contrast solved, not chosen: the quietest colour of hue `hue`, chroma `chroma` that still reaches
 * `target` (WCAG 2) against `ground`. On a dark ground that is the darkest ink that passes; on a
 * light ground the lightest. Out-of-gamut chroma is reduced at that lightness (oklchToHex).
 */
export function solveInk(ground, { hue, chroma = 0.01, target }) {
  const gL = hexToOklch(ground)[0];
  const dark = luminance(ground) < 0.18; // which side of the ground the ink lives on
  const passes = (L) => contrast(oklchToHex([L, chroma, hue]), ground) >= target;
  let near = gL; // fails (the ground itself)
  let far = dark ? 1 : 0; // the extreme
  if (!passes(far)) throw new RangeError(`no ink of hue ${hue} reaches ${target}:1 on ${ground}`);
  for (let i = 0; i < 30; i++) {
    const mid = (near + far) / 2;
    if (passes(mid)) far = mid;
    else near = mid;
  }
  // hex rounding can land a hair under the target: step outward until it holds
  let L = far;
  const step = dark ? 0.001 : -0.001;
  while (!passes(L) && L > 0 && L < 1) L += step;
  return oklchToHex([L, chroma, hue]);
}

/**
 * A near-black ground ladder at a product's own temperature.
 *
 *   groundLadder({ hue: 265, chroma: 0.007, L: 0.14 })            // Recto-like graphite
 *   groundLadder({ hue: 308, chroma: 0.009, L: 0.186 })           // English Prep-like plum
 *
 * `hue` and `chroma` are the temperature (chroma ≤ 0.03: a tint, not a colour). `L` is the
 * ground's lightness, inside GROUND. Steps keep the hue; their chroma grows a little with L, as
 * both products' own ladders do. Inks are solved against the ground at `inkHue`/`inkChroma`
 * (defaults: the ground's hue, a quieter chroma) to INK_TARGETS. Returns hex values and the
 * measured contrast of every ink, so a CI check can print it.
 */
export function groundLadder({
  hue,
  chroma = 0.008,
  L = 0.15,
  steps = LADDER_STEPS,
  inkHue = hue,
  inkChroma = Math.min(chroma, 0.012),
  targets = INK_TARGETS,
} = {}) {
  if (typeof hue !== 'number') throw new TypeError('groundLadder needs a hue (degrees)');
  if (L < GROUND.minL || L > GROUND.maxL) {
    throw new RangeError(`ground L ${L} is outside ${GROUND.minL}..${GROUND.maxL} (family.md V1)`);
  }
  if (chroma > GROUND.maxChroma) throw new RangeError(`ground chroma ${chroma} > ${GROUND.maxChroma}`);
  const out = {};
  for (const [name, dL] of Object.entries(steps)) {
    out[name] = oklchToHex([L + dL, chroma * (1 + dL * 6), hue]);
  }
  const ground = out.ground;
  for (const [name, target] of Object.entries(targets)) {
    out[name] = solveInk(ground, { hue: inkHue, chroma: inkChroma, target });
  }
  out.contrast = Object.fromEntries(Object.keys(targets).map((k) => [k, +contrast(out[k], ground).toFixed(2)]));
  return out;
}

/** CSS custom properties for a ladder: `--kl-ground: #…;` and so on. */
export function ladderCSS(ladder, prefix = '--kl') {
  return Object.entries(ladder)
    .filter(([, v]) => typeof v === 'string')
    .map(([k, v]) => `${prefix}-${k}: ${v};`)
    .join('\n');
}

/** Measure an existing palette against V1 without changing it: OKLCH, contrast, verdicts. */
export function describe({ ground, inks = {} }) {
  const [L, C, h] = hexToOklch(ground);
  const notes = [];
  if (L > GROUND.maxL) notes.push(`ground L ${L.toFixed(3)} > ${GROUND.maxL}: lighter than V1's near-black`);
  if (L < GROUND.minL) notes.push(`ground L ${L.toFixed(3)} < ${GROUND.minL}: close to pure black`);
  if (C > GROUND.maxChroma) notes.push(`ground chroma ${C.toFixed(3)} > ${GROUND.maxChroma}: a colour, not a tint`);
  return {
    ground: { hex: ground, L: +L.toFixed(3), C: +C.toFixed(4), h: Math.round(h) },
    inks: Object.fromEntries(Object.entries(inks).map(([k, v]) => [k, { hex: v, contrast: +contrast(v, ground).toFixed(2) }])),
    notes,
  };
}

/* ── 2. The light field (light.md §3) ──────────────────────────────────────────────────── */

/** The rules a field is held to. Numbers come from English Prep's and Recto's shipped fields. */
export const FIELD_RULES = Object.freeze({
  maxSources: 3, // light sources (English Prep's clusters: 3)
  maxPigments: 3, // colours one source cycles through
  maxLayers: 9, // painted gradients in all
  capDark: 0.42, // one parent opacity, dark theme (English Prep: .42)
  capLight: 0.12, // one parent opacity, light theme (English Prep: .09)
  minDrift: 9, // seconds per drift cycle (English Prep's shortest: 9.75)
  minCycle: 9, // seconds per colour cycle
  maxSettle: 5, // seconds for an event to settle back to rest (Recto: ≤ 5 s)
  behaviours: ['still', 'event', 'drift'],
});

/**
 * Check a field spec against FIELD_RULES. Returns a list of problems (empty = passes).
 *
 * A spec (the `light` block of world.json uses the same shape, presentation.md §2):
 *   {
 *     behaviour: 'still' | 'event' | 'drift',   // rest is still unless 'drift'
 *     theme: 'dark' | 'light',
 *     cap: 0.42,                                 // one opacity for the whole field
 *     sources: [{
 *       pigments: ['#a04278', '#6350a5', '#28798a'],
 *       at: [20, 15],          // centre, % of the field
 *       size: [72, 78],        // % of the field
 *       drift: { period: 9.75, phase: -2.5, travel: [12, 12], turn: 15, breathe: 0.07 },
 *       cycle: { period: 13.5, phase: -2.25 },
 *     }],
 *     event: { boost: 1.25, settle: 4 },        // 'event' only
 *   }
 */
export function checkField(spec) {
  const R = FIELD_RULES;
  const errors = [];
  const sources = spec?.sources ?? [];
  if (!R.behaviours.includes(spec?.behaviour)) errors.push(`behaviour must be one of ${R.behaviours.join(', ')}`);
  const cap = spec?.cap;
  const capMax = spec?.theme === 'light' ? R.capLight : R.capDark;
  if (!(cap > 0 && cap <= capMax)) errors.push(`cap ${cap} must be in (0, ${capMax}] for a ${spec?.theme ?? 'dark'} ground`);
  if (sources.length < 1 || sources.length > R.maxSources) errors.push(`1..${R.maxSources} sources, got ${sources.length}`);
  let layers = 0;
  const periods = [];
  sources.forEach((s, i) => {
    const n = s.pigments?.length ?? 0;
    layers += n;
    if (n < 1 || n > R.maxPigments) errors.push(`source ${i}: 1..${R.maxPigments} pigments, got ${n}`);
    for (const p of s.pigments ?? []) if (!/^#[0-9a-f]{6}$/i.test(p)) errors.push(`source ${i}: pigment ${p} is not #rrggbb`);
    if (spec.behaviour === 'drift') {
      if (!(s.drift?.period >= R.minDrift)) errors.push(`source ${i}: drift period ${s.drift?.period} s < ${R.minDrift} s`);
      if (n > 1 && !(s.cycle?.period >= R.minCycle)) errors.push(`source ${i}: colour cycle ${s.cycle?.period} s < ${R.minCycle} s`);
      if (s.drift?.period) periods.push(s.drift.period);
    } else if (s.drift || s.cycle) {
      errors.push(`source ${i}: drift and colour cycles belong to behaviour 'drift' only`);
    } else if (n > 1) {
      errors.push(`source ${i}: a light that does not drift has one pigment; use one source per colour`);
    }
  });
  if (layers > R.maxLayers) errors.push(`${layers} painted layers > ${R.maxLayers}`);
  if (new Set(periods).size !== periods.length) errors.push('drift periods must differ, so sources never move in lockstep');
  if (spec?.behaviour === 'event' && !(spec.event?.settle > 0 && spec.event.settle <= R.maxSettle)) {
    errors.push(`event.settle ${spec?.event?.settle} must be in (0, ${R.maxSettle}] s`);
  }
  return errors;
}

/**
 * Draw a field into `host` (the element it lights; `document.body` for a page-wide field) with
 * light.css. Returns { el, pulse(), stop() }.
 *
 * - The field sits behind content (z-index −1, no pointer events) and never paints on it.
 * - It runs only while the page is visible, the field intersects the viewport and motion is
 *   allowed; otherwise every animation is paused where it is (data-kl-running).
 * - Reduced motion (the media query, or `motion: 'reduced'`): the still twin, each source at
 *   rest at `at` in its first pigment; `pulse()` does nothing.
 * - Forced colours: light.css hides the field.
 */
export function mountField(host, spec, { position = 'fixed', motion } = {}) {
  const errors = checkField(spec);
  if (errors.length) throw new Error('light field: ' + errors.join('; '));
  const doc = host.ownerDocument;
  const win = doc.defaultView;
  const field = doc.createElement('div');
  field.className = 'kl-field';
  field.setAttribute('aria-hidden', 'true');
  field.dataset.klBehaviour = spec.behaviour;
  field.dataset.klPosition = position;
  field.style.setProperty('--kl-cap', String(spec.cap));
  for (const s of spec.sources) {
    const src = doc.createElement('div');
    src.className = 'kl-source';
    const [x, y] = s.at ?? [50, 50];
    const [w, h] = s.size ?? [70, 70];
    src.style.setProperty('--kl-x', `${x}%`);
    src.style.setProperty('--kl-y', `${y}%`);
    src.style.setProperty('--kl-w', `${w}%`);
    src.style.setProperty('--kl-h', `${h}%`);
    if (s.drift) {
      const d = s.drift;
      src.style.setProperty('--kl-drift', `${d.period}s`);
      src.style.setProperty('--kl-drift-phase', `${d.phase ?? 0}s`);
      src.style.setProperty('--kl-tx', `${(d.travel ?? [10, 10])[0]}%`);
      src.style.setProperty('--kl-ty', `${(d.travel ?? [10, 10])[1]}%`);
      src.style.setProperty('--kl-turn', `${d.turn ?? 12}deg`);
      src.style.setProperty('--kl-breathe', String(d.breathe ?? 0.06));
    }
    const n = s.pigments.length;
    s.pigments.forEach((color, i) => {
      const p = doc.createElement('div');
      p.className = 'kl-pigment';
      p.style.setProperty('--kl-color', color);
      if (n > 1 && s.cycle) {
        p.dataset.klPigments = String(n);
        // pigment i leads pigment 0 by i/n of the cycle (light.css, @keyframes kl-pigment-n)
        const delay = (s.cycle.phase ?? 0) - ((n - i) % n) * (s.cycle.period / n);
        p.style.setProperty('--kl-cycle', `${s.cycle.period}s`);
        p.style.setProperty('--kl-cycle-phase', `${delay}s`);
      }
      if (i === 0) p.dataset.klFirst = '';
      src.append(p);
    });
    field.append(src);
  }
  host.prepend(field);

  const reducedQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced = () => motion === 'reduced' || (motion !== 'on' && !!reducedQuery?.matches);
  let onScreen = true;
  const update = () => {
    field.dataset.klStill = String(reduced());
    field.dataset.klRunning = String(spec.behaviour === 'drift' && !reduced() && onScreen && doc.visibilityState === 'visible');
  };
  const io = win.IntersectionObserver
    ? new win.IntersectionObserver((entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        update();
      })
    : null;
  io?.observe(position === 'fixed' ? host : field);
  doc.addEventListener('visibilitychange', update);
  reducedQuery?.addEventListener?.('change', update);
  update();

  return {
    el: field,
    /** An event (arrival, drop, success): the field brightens and settles back to rest. */
    pulse() {
      if (spec.behaviour !== 'event' || reduced() || !field.animate) return;
      const { boost = 1.25, settle = 4 } = spec.event;
      field.animate(
        [{ opacity: Math.min(1, spec.cap * boost) }, { opacity: spec.cap }],
        { duration: settle * 1000, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      );
    },
    stop() {
      io?.disconnect();
      doc.removeEventListener('visibilitychange', update);
      reducedQuery?.removeEventListener?.('change', update);
      field.remove();
    },
  };
}

/* ── 3. The products as they are today (light.md §4; measured, not changed) ────────────── */

export const PRODUCTS = Object.freeze({
  recto: {
    source: 'recto apps/web/src/styles/tokens.css (n1, n3, n4, n12, n10); aurora: WebGL, ADR-0025',
    ground: '#08090c',
    inks: { ink: '#e8e9ec', ink2: '#a1a5ab' },
    light: {
      behaviour: 'event', theme: 'dark', cap: 0.42, // the cap is the kit's ceiling; Recto's renderer has its own intensity model
      // positions are illustrative: Recto's WebGL aurora places its own lights (ADR-0025)
      sources: [
        { pigments: ['#1f9996'], at: [28, 92], size: [70, 55] },
        { pigments: ['#58da98'], at: [55, 88], size: [55, 45] },
        { pigments: ['#bbed26'], at: [78, 96], size: [40, 32] },
      ],
      event: { boost: 1.25, settle: 5 },
    },
  },
  'english-prep': {
    source: 'english-prep css/editorial.css (--page, --aurora-*, .ambient__field--*)',
    ground: '#141216',
    inks: { ink: '#eee9ed', ink2: '#d2c9d3' },
    light: {
      behaviour: 'drift', theme: 'dark', cap: 0.42,
      sources: [
        { pigments: ['#a04278', '#6350a5', '#28798a'], at: [6, 5], size: [72, 78], drift: { period: 9.75, phase: -2.5 }, cycle: { period: 13.5, phase: -2.25 } },
        { pigments: ['#6350a5', '#28798a', '#a04278'], at: [94, 41], size: [72, 78], drift: { period: 11.75, phase: -6.25 }, cycle: { period: 15.75, phase: -7.875 } },
        { pigments: ['#28798a', '#a04278', '#6350a5'], at: [24, 100], size: [72, 78], drift: { period: 13.75, phase: -8.75 }, cycle: { period: 18, phase: -13.5 } },
      ],
    },
  },
  'eat-map': {
    source: 'estimated from one simulator photo (family audit §1.3); read the real values from Xcode',
    ground: '#4a1626',
    inks: { ink: '#ffffff' },
    light: { behaviour: 'still', theme: 'dark', cap: 0.13, sources: [{ pigments: ['#ec5794'], at: [66, 72], size: [76, 76] }] },
  },
  portfolio: {
    source: 'Portfolio src/styles/global.css (--ground, --ink…, .media .m-glow)',
    ground: '#0a0a0b',
    inks: { ink: '#e9e5de', ink2: '#b6b1a8', ink3: '#8c877f' },
    light: { behaviour: 'still', theme: 'dark', cap: 0.11, sources: [{ pigments: ['#c9d4ff'], at: [50, 50], size: [168, 168] }] },
  },
});

/* ── CLI ───────────────────────────────────────────────────────────────────────────────── */

const argv = globalThis.process?.argv;
if (argv?.[1] && import.meta.url === new URL(`file://${argv[1]}`).href) {
  const [cmd, a, b, c] = argv.slice(2);
  if (cmd === 'ladder') {
    const ladder = groundLadder({ hue: +a, chroma: b === undefined ? undefined : +b, L: c === undefined ? undefined : +c });
    console.log(ladderCSS(ladder));
    console.log('/* contrast on the ground:', JSON.stringify(ladder.contrast), '*/');
  } else {
    for (const [name, p] of Object.entries(PRODUCTS)) {
      const d = describe(p);
      const inks = Object.entries(d.inks).map(([k, v]) => `${k} ${v.hex} ${v.contrast}:1`).join(' · ');
      const field = checkField(p.light);
      console.log(`${name.padEnd(13)} ground ${d.ground.hex} L ${d.ground.L} C ${d.ground.C} h ${d.ground.h} · ${inks}`);
      for (const n of d.notes) console.log(`${''.padEnd(13)} note: ${n}`);
      console.log(`${''.padEnd(13)} light: ${p.light.behaviour}, ${p.light.sources.length} source(s), ${field.length ? 'FAILS ' + field.join('; ') : 'passes FIELD_RULES'}`);
    }
  }
}
