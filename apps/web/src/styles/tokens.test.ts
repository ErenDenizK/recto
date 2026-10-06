/**
 * Structure, contrast and colour pairs of the design tokens (language.md §1, §2.2, §2.6, §9.2,
 * §10.2; ADR-0023; components/09-primitives.md §2.2, §25, §27; redesign.md D0-1 for the coverage
 * registry, D3-2 for the colour language and D3-3 for the materials). The test reads the real
 * `tokens.css` and `materials.css`, resolves `var()` references and computes WCAG 2.2 ratios and APCA Lc, so a
 * token change that breaks a pair fails here rather than in a screenshot review.
 *
 * Glass is modelled as the translucency audit measured it (docs/design/audit/translucency.md §6;
 * research 16 §6.3: Chromium within ±1/255): over a uniform backdrop the blur changes nothing,
 * so the rendered glass is `a · tint + (1 − a) · filter(backdrop)`, the filter chain applied per
 * sRGB channel in order and clamped, rounded to 8 bits as the compositor writes it. Uniform
 * backdrops are the worst cases: a large white area stays white under any blur. The coverage
 * term (D0-1) keeps the rendered edges within that model.
 */
import { describe, expect, it } from 'vitest';

import { INK, TINT } from '../annotations/palette';
import { apcaContrast } from './apca';
import {
  COVERAGE_REGISTRY,
  compositionOf,
  entryClasses,
  type GlassSurfaceEntry,
  SIGMA_STEPS,
} from './coverage-registry';
import focusCss from './focus.css?raw';
import globalCss from './global.css?raw';
import materialsCss from './materials.css?raw';
import {
  CONTROL_TOKENS,
  GLASS_TIERS,
  type GlassTier,
  RAW_TOKENS,
  SEMANTIC_TOKENS,
  THEME_ALIASES,
  THEME_FREE_ALIASES,
  THEME_FREE_TOKENS,
  THEME_TOKENS,
} from './token-registry';
import tokensCss from './tokens.css?raw';

type Rgb = readonly [number, number, number];

interface Colour {
  readonly rgb: Rgb;
  readonly alpha: number;
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of body.split(';')) {
    const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
    if (match?.[1] !== undefined && match[2] !== undefined) {
      map.set(match[1], match[2].replace(/\s+/g, ' '));
    }
  }
  return map;
}

/** Splits a comma-separated list (box-shadow layers) at the top level, not inside functions. */
function splitLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      layers.push(value.slice(start, i));
      start = i + 1;
    }
  }
  layers.push(value.slice(start));
  return layers;
}

const tokensSource = stripComments(tokensCss);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** §1, the dark theme: `:root, [data-theme='dark'] { … }`. */
const theme = declarations(
  /:root,\s*\[data-theme='dark'\]\s*\{([^{}]*)\}/.exec(tokensSource)?.[1] ?? '',
);
/** §3, the theme-free block: the first plain `:root { … }` outside any at-rule. */
const free = declarations(/(?:^|\n):root\s*\{([^{}]*)\}/.exec(tokensSource)?.[1] ?? '');
/** Everything at rest: the theme over the theme-free block. */
const root = new Map([...free, ...theme]);

/** The `:root` overrides inside `@media (<query>)`. */
function mediaOverrides(query: string): Map<string, string> {
  const block = new RegExp(`@media \\(${escape(query)}\\)\\s*\\{\\s*:root\\s*\\{([^{}]*)\\}`).exec(
    tokensSource,
  )?.[1];
  return declarations(block ?? '');
}

function resolve(name: string, scope: Map<string, string> = root, depth = 0): string {
  const value = scope.get(name) ?? root.get(name);
  if (value === undefined) throw new Error(`tokens.css does not define ${name}`);
  if (depth > 8) throw new Error(`var() cycle at ${name}`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) =>
    resolve(inner, scope, depth + 1),
  );
}

function parseColour(value: string): Colour {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim())?.[1];
  if (hex !== undefined) {
    const n = Number.parseInt(hex, 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgb = /^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(
    value.trim(),
  );
  if (rgb) {
    return {
      rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])],
      alpha: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }
  throw new Error(`not a colour: ${value}`);
}

const colour = (name: string): Rgb => {
  const parsed = parseColour(resolve(name));
  if (parsed.alpha !== 1) throw new Error(`${name} is translucent; composite it first`);
  return parsed.rgb;
};
const wash = (name: string): Colour => parseColour(resolve(name));
const literal = (hex: string): Rgb => parseColour(hex.toLowerCase()).rgb;

const map3 = (c: Rgb, f: (v: number, i: number) => number): Rgb => [
  f(c[0], 0),
  f(c[1], 1),
  f(c[2], 2),
];
const clamp = (v: number) => Math.min(255, Math.max(0, v));

/** `top` at `alpha` over an opaque `bottom` (source-over, sRGB, unrounded). */
const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb =>
  map3(top, (v, i) => alpha * v + (1 - alpha) * bottom[i as 0 | 1 | 2]);

const round8 = (c: Rgb): Rgb => map3(c, (v) => Math.round(clamp(v)));

/** A translucent token laid on an opaque colour, rounded as the compositor writes it. */
const on = (token: string, under: Rgb): Rgb => {
  const top = wash(token);
  return round8(over(top.rgb, top.alpha, under));
};

const linear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function relativeLuminance(c: Rgb): number {
  const [r, g, b] = map3(c, linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 contrast ratio. */
function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** |APCA Lc| of `text` on `background`. */
const lc = (text: Rgb, background: Rgb) => Math.abs(apcaContrast(text, background));

/** CIE L* (D65), which shows dark steps better than the WCAG ratio. */
function lightness(c: Rgb): number {
  const y = relativeLuminance(c);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (y * 24389) / 27;
}

/** Filter Effects `saturate()` matrix, applied in sRGB as Chromium does for CSS filters. */
function saturate(c: Rgb, s: number): Rgb {
  const m = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ] as const;
  return map3(c, (_, i) => {
    const row = m[i as 0 | 1 | 2];
    return clamp(row[0] * c[0] + row[1] * c[1] + row[2] * c[2]);
  });
}

/**
 * A filter chain over a uniform backdrop, in order (language.md §1.2): `blur()` changes nothing
 * there; `saturate()`, `contrast()` (the light theme's floor) and `brightness()` per channel,
 * clamped after each.
 */
function applyFilter(filter: string, backdrop: Rgb): Rgb {
  let out = backdrop;
  for (const [, fn, amount] of filter.matchAll(/(saturate|brightness|contrast)\(([\d.]+)\)/g)) {
    const k = Number(amount);
    if (fn === 'saturate') out = saturate(out, k);
    else if (fn === 'brightness') out = map3(out, (v) => clamp(v * k));
    else out = map3(out, (v) => clamp((v - 127.5) * k + 127.5));
  }
  return out;
}

/** A tier's tokens (language.md §2.2). */
const tierTokens = (tier: GlassTier) => ({
  tint: `--glass-${tier}-tint`,
  filter: `--glass-${tier}-filter`,
  solid: `--glass-${tier}-solid`,
});

/** A glass surface from a tint token and a filter token, as rendered over a uniform backdrop. */
function glassFrom(tintToken: string, filterToken: string, backdrop: Rgb): Rgb {
  const tint = wash(tintToken);
  return round8(over(tint.rgb, tint.alpha, applyFilter(resolve(filterToken), backdrop)));
}

const tierOver = (tier: GlassTier, backdrop: Rgb): Rgb =>
  glassFrom(tierTokens(tier).tint, tierTokens(tier).filter, backdrop);

/** The floating bar (M2, `.mat-bar`) as rendered over a uniform backdrop. */
const glassOver = (backdrop: Rgb): Rgb => tierOver('bar', backdrop);

const SURFACES = ['--canvas', '--surface-frame', '--surface-raised', '--surface-on'] as const;
const canvas = () => colour('--canvas');
const WHITE = literal('#ffffff');
const BLACK = literal('#000000');
const scrim = () => wash('--scrim');

/** Uniform backdrops behind floating chrome; white is the worst case for light text. */
const BACKDROPS: readonly (readonly [string, () => Rgb])[] = [
  ['white page', () => WHITE],
  ['yellow figure', () => literal('#f3d933')],
  ['mid grey', () => literal('#808080')],
  ['saturated blue', () => literal('#2a6fd6')],
  ['black page', () => BLACK],
  ['app canvas', canvas],
  ['white page under the palette scrim', () => round8(over(scrim().rgb, scrim().alpha, WHITE))],
];

/** Text colours used on glass: the scoped remap in materials.css (`.mat`). */
const GLASS_TEXT = ['--text-primary', '--glass-text-secondary', '--glass-danger', '--warning'];

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
/** language.md §1.2: ratios are quoted to two places, so a pair holds at its value − 0.005. */
const atLeast = (value: number, minimum: number, label: string) =>
  expect(value, label).toBeGreaterThanOrEqual(minimum - 0.005);

/**
 * Custom properties the runtime sets on elements: Base UI's positioners and drawers, and the
 * layout values components write in `style`.
 */
const RUNTIME = /^--(anchor-|available-|transform-origin|drawer-|popup-|positioner-)/;

const modules = import.meta.glob<string>('../**/*.module.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('tokens.css', () => {
  describe('the registry: seven blocks, three layers, aliases (09 §25, language.md §10.1)', () => {
    it('defines exactly the registered names in §1 and §3', () => {
      expect([...theme.keys()].sort()).toEqual([...THEME_TOKENS].sort());
      expect([...free.keys()].sort()).toEqual(
        [...THEME_FREE_TOKENS, ...Object.keys(THEME_FREE_ALIASES)].sort(),
      );
      const all = [...THEME_TOKENS, ...THEME_FREE_TOKENS, ...Object.keys(THEME_FREE_ALIASES)];
      expect(new Set(all).size, 'a name registered twice').toBe(all.length);
      // Every role modules paint with resolves to a value at rest.
      for (const name of [...SEMANTIC_TOKENS, ...CONTROL_TOKENS]) {
        expect(() => resolve(name), name).not.toThrow();
      }
    });

    it('keeps the blocks in order: theme, light (D3-7), theme-free, coarse, settings, forced, P3', () => {
      const at = (pattern: RegExp) => tokensSource.search(pattern);
      const order = [
        at(/:root,\s*\[data-theme='dark'\]/),
        at(/(?:^|\n):root\s*\{/),
        at(/@media \(pointer: coarse\)/),
        at(/@media \(prefers-reduced-transparency: reduce\)/),
        at(/@media \(forced-colors: active\)/),
        at(/@media \(color-gamut: p3\)/),
      ];
      for (const index of order) expect(index).toBeGreaterThanOrEqual(0);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('points every alias at its semantic name', () => {
      for (const [alias, target] of Object.entries({ ...THEME_ALIASES, ...THEME_FREE_ALIASES })) {
        expect(root.get(alias), alias).toContain(`var(${target})`);
      }
      expect(resolve('--surface-0')).toBe(resolve('--canvas'));
      expect(resolve('--surface-1')).toBe(resolve('--surface-frame'));
      expect(resolve('--surface-2')).toBe(resolve('--surface-raised'));
      expect(resolve('--surface-3')).toBe(resolve('--surface-on'));
      expect(resolve('--radius-2')).toBe('6px');
    });

    it('defines every name tokens.css reads', () => {
      for (const [, name] of tokensSource.matchAll(/var\((--[\w-]+)\)/g)) {
        expect(root.has(name ?? ''), `${name} is read but not defined`).toBe(true);
      }
    });

    it('keeps the raw ramps (layer 1) inside tokens.css', () => {
      const sources = import.meta.glob<string>(['../**/*.{css,ts,tsx}', '!../**/*.test.{ts,tsx}'], {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      const raw = new RegExp(`var\\((${RAW_TOKENS.map(escape).join('|')})\\)`);
      for (const [file, source] of Object.entries(sources)) {
        if (file === './tokens.css' || file.endsWith('/styles/tokens.css')) continue;
        expect(raw.exec(stripComments(source))?.[1], `${file} reads a raw token`).toBeUndefined();
      }
    });

    it('lets D3-7 add the light theme with exactly the names of §1', () => {
      const light = /\[data-theme='light'\]\s*\{([^{}]*)\}/.exec(tokensSource)?.[1];
      const system =
        /@media \(prefers-color-scheme: light\)\s*\{\s*:root:not\(\[data-theme\]\)\s*\{([^{}]*)\}/.exec(
          tokensSource,
        )?.[1];
      // Both selectors or neither (language.md §10.1, 09 §25 block 2).
      expect(light === undefined).toBe(system === undefined);
      if (light === undefined || system === undefined) return;
      const names = [...THEME_TOKENS].sort();
      expect([...declarations(light).keys()].sort()).toEqual(names);
      expect([...declarations(system).entries()].sort()).toEqual(
        [...declarations(light).entries()].sort(),
      );
    });

    it('reads no undefined token in any module, unless it carries a fallback', () => {
      const sources = import.meta.glob<string>(
        ['../**/*.{css,ts,tsx}', '../../test/harness/**/*.{css,tsx}', '!../**/*.test.{ts,tsx}'],
        { query: '?raw', import: 'default', eager: true },
      );
      const defined = new Set(root.keys());
      for (const source of Object.values(sources)) {
        for (const [, name] of source.matchAll(/(--[\w-]+)\s*:/g)) defined.add(name ?? '');
        for (const [, name] of source.matchAll(/['"`](--[\w-]+)['"`]/g)) defined.add(name ?? '');
      }
      const missing: string[] = [];
      for (const [file, source] of Object.entries(sources)) {
        if (!file.endsWith('.css')) continue;
        for (const [, name] of stripComments(source).matchAll(/var\((--[\w-]+)\)/g)) {
          if (!defined.has(name ?? '') && !RUNTIME.test(name ?? ''))
            missing.push(`${file}: ${name}`);
        }
      }
      expect(missing).toEqual([]);
    });
  });

  describe('neutrals: cool graphite, hue 265 (language.md §1.3, ADR-0023 §2.6)', () => {
    it('holds the ramp of the language table', () => {
      const ramp = [
        '#08090c',
        '#101215',
        '#17191e',
        '#1f2227',
        '#272a30',
        '#303339',
        '#3f4249',
        '#55585f',
        '#91949a',
        '#a1a5ab',
        '#bbbec3',
        '#e8e9ec',
      ];
      ramp.forEach((hex, i) => expect(resolve(`--n${i + 1}`), `--n${i + 1}`).toBe(hex));
      for (let i = 1; i < ramp.length; i++) {
        expect(lightness(literal(ramp[i] ?? ''))).toBeGreaterThan(
          lightness(literal(ramp[i - 1] ?? '')),
        );
      }
    });

    it('maps the roles: canvas n1, wells n2, frame n3, raised n4, on n5; text n12 · n10 · n9 · n8', () => {
      const roles: Readonly<Record<string, string>> = {
        '--canvas': '--n1',
        '--surface-sunken': '--n2',
        '--surface-frame': '--n3',
        '--surface-raised': '--n4',
        '--surface-on': '--n5',
        '--border-opaque': '--n7',
        '--text-primary': '--n12',
        '--glass-text-secondary': '--n11',
        '--text-secondary': '--n10',
        '--text-tertiary': '--n9',
        '--text-disabled': '--n8',
      };
      for (const [role, step] of Object.entries(roles)) {
        expect(resolve(role), role).toBe(resolve(step));
      }
    });

    it('keeps the page the brightest thing (white page vs canvas ≥ 19.8:1)', () => {
      expect(resolve('--page-background')).toBe('#ffffff');
      expect(contrast(WHITE, canvas())).toBeGreaterThanOrEqual(19.8);
    });

    it('steps the docked frame visibly off the canvas (L* ≥ 6) and the raised surface off it', () => {
      const [s0, s1, s2, s3] = SURFACES.map(colour) as [Rgb, Rgb, Rgb, Rgb];
      expect(lightness(s1) - lightness(s0)).toBeGreaterThanOrEqual(6);
      expect(lightness(s0)).toBeLessThan(lightness(s1));
      expect(lightness(s1)).toBeLessThan(lightness(s2));
      expect(lightness(s2)).toBeLessThan(lightness(s3));
    });

    it('holds the text pairs of language.md §1.7 (WCAG and APCA, A-1, A-4)', () => {
      // [text, surface, WCAG, |Lc| or 0 when the table gives none]
      const pairs: readonly (readonly [string, string, number, number])[] = [
        ['--n12', '--n1', 16.4, 93],
        ['--n12', '--n3', 14.48, 92],
        ['--n12', '--n5', 11.85, 90],
        ['--n11', '--n1', 10.68, 67],
        ['--n11', '--n3', 9.43, 66],
        ['--n11', '--n5', 7.72, 64],
        ['--n10', '--n1', 8.05, 53],
        ['--n10', '--n3', 7.11, 52],
        ['--n10', '--n5', 5.81, 50],
        ['--n9', '--n1', 6.55, 44],
        ['--n9', '--n3', 5.78, 43],
        ['--n9', '--n5', 4.73, 41],
        ['--n8', '--n1', 2.79, 0],
        ['--n8', '--n3', 2.47, 0],
        ['--n8', '--n5', 2.02, 0],
      ];
      for (const [text, surface, ratio, apca] of pairs) {
        const t = colour(text);
        const s = colour(surface);
        expect(contrast(t, s), `${text} on ${surface}`).toBeCloseTo(ratio, 1);
        if (apca > 0) expect(lc(t, s), `Lc ${text} on ${surface}`).toBeCloseTo(apca, -0.5);
      }
    });

    it('keeps body text AA on every surface of the ladder, and tertiary off n6', () => {
      for (const text of ['--text-primary', '--text-secondary', '--text-tertiary']) {
        for (const surface of SURFACES) {
          atLeast(contrast(colour(text), colour(surface)), AA_TEXT, `${text} on ${surface}`);
        }
      }
      // 4.16:1: tertiary never sits on n6 (language.md §1.7).
      expect(contrast(colour('--text-tertiary'), colour('--n6'))).toBeLessThan(AA_TEXT);
      expect(resolve('--badge-fill')).toBe(resolve('--n6'));
    });

    it('gates primary text at APCA Lc 75 on every solid surface (A-4)', () => {
      for (const surface of [...SURFACES, '--surface-sunken']) {
        expect(lc(colour('--text-primary'), colour(surface)), surface).toBeGreaterThanOrEqual(75);
      }
    });

    it('keeps secondary and tertiary text AA on hovered and pressed rows of the frame', () => {
      const frame = colour('--surface-frame');
      for (const state of ['--surface-hover', '--surface-active']) {
        const row = on(state, frame);
        for (const text of ['--text-secondary', '--text-tertiary']) {
          atLeast(contrast(colour(text), row), AA_TEXT, `${text} on ${state}`);
        }
      }
    });
  });

  describe('interaction: one lime (language.md §1.4, ADR-0023 §2.2–§2.4, §2.9)', () => {
    it('is #c8fb3d, once: the accent, the focus band and the brand read --lime-300', () => {
      expect(resolve('--lime-300')).toBe('#c8fb3d');
      expect(resolve('--accent')).toBe('#c8fb3d');
      expect(resolve('--focus-light')).toBe(resolve('--accent'));
      // The channel triplet the alphas use is the same lime.
      expect(resolve('--lime-rgb').split(' ').map(Number)).toEqual([...colour('--lime-300')]);
      expect(resolve('--select-rgb').split(' ').map(Number)).toEqual([...colour('--select')]);
      for (const token of ['--accent-subtle', '--accent-muted', '--accent-line']) {
        expect(wash(token).rgb, token).toEqual(colour('--accent'));
      }
      expect(wash('--accent-subtle').alpha).toBe(0.08);
      expect(wash('--accent-muted').alpha).toBe(0.12);
      expect(wash('--accent-line').alpha).toBe(0.5);
      expect(resolve('--accent-hover')).toBe('#ddff82');
      expect(resolve('--accent-pressed')).toBe('#b2e93c');
    });

    it('keeps the ramp of the language table, 300 and 800 bold', () => {
      const ramp: Readonly<Record<number, string>> = {
        50: '#effed0',
        100: '#e1fea1',
        200: '#d2fe59',
        300: '#c8fb3d',
        400: '#bbef39',
        500: '#a5dd34',
        600: '#80b128',
        700: '#5f8a1b',
        800: '#446713',
        900: '#2f490a',
        950: '#1a2d04',
      };
      for (const [step, hex] of Object.entries(ramp)) expect(resolve(`--lime-${step}`)).toBe(hex);
      // Lime-800, the light theme's line: 6.57 on white, 5.35 on the light canvas (n4 #e6e8eb).
      atLeast(contrast(colour('--lime-800'), WHITE), 6.57, 'lime-800 on white');
      atLeast(contrast(colour('--lime-800'), literal('#e6e8eb')), 5.35, 'lime-800 on light canvas');
    });

    it('always touches ink: ink on lime 16.42 (Lc 93), on hover 17.73, pressed 13.86', () => {
      const ink = colour('--accent-ink');
      expect(resolve('--accent-ink')).toBe('#08090c');
      atLeast(contrast(ink, colour('--accent')), 16.42, 'ink on lime');
      expect(lc(ink, colour('--accent'))).toBeGreaterThanOrEqual(92.5);
      atLeast(contrast(ink, colour('--accent-hover')), 17.73, 'ink on hover');
      atLeast(contrast(ink, colour('--accent-pressed')), 13.86, 'ink on pressed');
    });

    it('fills the prominent button and the armed tool with lime and an ink label', () => {
      expect(resolve('--primary-fill')).toBe(resolve('--accent'));
      expect(resolve('--primary-fill-hover')).toBe(resolve('--accent-hover'));
      expect(resolve('--primary-fill-pressed')).toBe(resolve('--accent-pressed'));
      expect(resolve('--primary-ink')).toBe(resolve('--accent-ink'));
      expect(resolve('--tool-active-fill')).toBe(resolve('--accent'));
      expect(resolve('--tool-active-fill-hover')).toBe(resolve('--accent-hover'));
      expect(resolve('--tool-active-fill-pressed')).toBe(resolve('--accent-pressed'));
      expect(resolve('--tool-active-ink')).toBe(resolve('--accent-ink'));
    });

    it('gives current rows lime 0.12: on the frame primary 10.67, secondary 5.23, tertiary 4.26', () => {
      const row = on('--accent-muted', colour('--surface-frame'));
      atLeast(contrast(colour('--text-primary'), row), 10.67, 'primary');
      atLeast(contrast(colour('--text-secondary'), row), 5.23, 'secondary');
      // Tertiary steps up to secondary on a current row (language.md §1.7).
      expect(contrast(colour('--text-tertiary'), row)).toBeLessThan(AA_TEXT);
    });

    it('draws 1 px lines at lime 0.50: 4.56 on the canvas, 4.49 on the frame', () => {
      atLeast(contrast(on('--accent-line', canvas()), canvas()), 4.56, 'on the canvas');
      const frame = colour('--surface-frame');
      atLeast(contrast(on('--accent-line', frame), frame), 4.49, 'on the frame');
    });

    it('fills armed tools ≥ 3:1 against every dark tier over a white page (A-3: 7.79 to 9.99)', () => {
      const minima: Readonly<Record<GlassTier, number>> = {
        chip: 7.79,
        bar: 7.91,
        panel: 9.99,
        menu: 9.69,
        sheet: 9.97,
        lit: 5.85,
      };
      for (const tier of GLASS_TIERS) {
        atLeast(contrast(colour('--accent'), tierOver(tier, WHITE)), minima[tier], tier);
      }
      for (const [name, backdrop] of BACKDROPS) {
        atLeast(contrast(colour('--tool-active-fill'), glassOver(backdrop())), AA_NON_TEXT, name);
      }
      atLeast(
        contrast(colour('--tool-active-fill'), colour('--glass-bar-solid')),
        AA_NON_TEXT,
        'the opaque bar',
      );
    });
  });

  describe('content: the page, selection, redaction, crop (language.md §1.5)', () => {
    it('is #4e61ed, ≥ 3:1 on white and on the yellow and green highlighter tints', () => {
      expect(resolve('--select')).toBe('#4e61ed');
      const select = colour('--select');
      atLeast(contrast(select, WHITE), 4.93, 'white');
      atLeast(contrast(select, literal(TINT.yellow)), 4.0, 'yellow tint');
      atLeast(contrast(select, literal(TINT.green)), 3.53, 'green tint');
      // The check badge's glyph on it (06-navigation §2.2).
      atLeast(contrast(colour('--select-ink'), select), 4.93, 'glyph on select');
    });

    it('draws its washes in the same blue: 0.25 for selection and hits, 0.45 for the current hit', () => {
      for (const token of [
        '--select-subtle',
        '--select-muted',
        '--select-wash',
        '--select-wash-strong',
      ]) {
        expect(wash(token).rgb, token).toEqual(colour('--select'));
        expect(wash(token).alpha, token).toBeLessThan(0.5);
      }
      expect(wash('--select-wash').alpha).toBe(0.25);
      expect(wash('--select-wash-strong').alpha).toBe(0.45);
    });

    it('marks redactions on the page in #c21725 (6.10 on white), not the chrome danger', () => {
      expect(resolve('--redact-page')).toBe('#c21725');
      atLeast(contrast(colour('--redact-page'), WHITE), 6.1, 'redaction on white');
      expect(resolve('--redact-page')).not.toBe(resolve('--danger'));
      expect(wash('--crop-dim')).toEqual({ rgb: [21, 23, 28], alpha: 0.45 });
      const sources = import.meta.glob<string>('../redaction/RedactionLayer.module.css', {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      const css = stripComments(Object.values(sources)[0] ?? '');
      expect(css).toMatch(/var\(--redact-page\)/);
      expect(css).not.toMatch(/var\(--danger\)/);
    });
  });

  describe('status and tags (language.md §1.6, ADR-0023 §2.7–§2.8)', () => {
    it('holds danger, warning (hue 72) and success on the frame: 6.56, 10.18, 9.25', () => {
      expect(resolve('--danger')).toBe('#fd7273');
      expect(resolve('--warning')).toBe('#ffb756');
      expect(resolve('--success')).toBe('#56d1a3');
      const frame = colour('--surface-frame');
      atLeast(contrast(colour('--danger'), frame), 6.56, 'danger');
      atLeast(contrast(colour('--warning'), frame), 10.18, 'warning');
      atLeast(contrast(colour('--success'), frame), 9.25, 'success');
      for (const status of ['--danger', '--warning', '--success']) {
        for (const surface of SURFACES) {
          atLeast(contrast(colour(status), colour(surface)), AA_TEXT, `${status} on ${surface}`);
        }
      }
      expect(wash('--warning-line').rgb).toEqual(colour('--warning'));
    });

    it('steps danger up on glass (#ffa4a4) and keeps warning and success as they are', () => {
      expect(resolve('--glass-danger')).toBe('#ffa4a4');
      expect(resolve('--glass-warning')).toBe(resolve('--warning'));
      expect(resolve('--glass-success')).toBe(resolve('--success'));
      expect(contrast(colour('--danger'), glassOver(WHITE))).toBeLessThan(AA_TEXT);
      atLeast(contrast(colour('--glass-danger'), glassOver(WHITE)), 5.07, 'glass danger');
    });

    it('draws six tag dots ≥ 3:1 (all ≥ 4.43 on the wells), tag 4 lilac, none at the lime’s hue', () => {
      expect(resolve('--tag-4')).toBe('#b1a1d1');
      for (let i = 0; i < 6; i++) {
        const tag = colour(`--tag-${i}`);
        atLeast(contrast(tag, colour('--surface-sunken')), 4.43, `--tag-${i} on n2`);
        for (const surface of SURFACES) {
          atLeast(contrast(tag, colour(surface)), AA_NON_TEXT, `--tag-${i} on ${surface}`);
        }
        expect(Math.abs(okhue(tag) - okhue(colour('--accent'))), `--tag-${i} hue`).toBeGreaterThan(
          20,
        );
      }
    });
  });

  describe('colour vision (language.md §1.8, A-19)', () => {
    it('reproduces the pairs table under protanopia, deuteranopia and tritanopia', () => {
      // [a, b, normal, protan, deutan, tritan] in ΔE_OK × 100.
      const pairs: readonly (readonly [Rgb, Rgb, number, number, number, number])[] = [
        [colour('--accent'), literal(TINT.yellow), 7.6, 2.2, 2.2, 7.5],
        [colour('--accent'), literal(TINT.green), 7.4, 5.3, 6.9, 8.4],
        [colour('--accent'), colour('--warning'), 19.0, 15.2, 9.0, 17.9],
        [colour('--accent'), colour('--success'), 20.1, 18.3, 20.5, 18.0],
        [colour('--accent'), colour('--danger'), 35.9, 32.8, 21.3, 32.6],
        [colour('--success'), colour('--danger'), 29.1, 17.9, 7.0, 34.2],
        [colour('--select'), literal(INK.blue), 4.5, 0.7, 1.8, 0.3],
      ];
      for (const [a, b, ...expected] of pairs) {
        const got = CVD.map((matrix) => deltaE(a, b, matrix));
        got.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? Number.NaN, 0));
      }
    });

    it('keeps lime off the page: no --accent in any page layer outside its chrome', () => {
      // The pairs above say why (lime vs the yellow highlighter is ΔE 2.2 for protanopes and
      // deuteranopes); the scan is in the selection block below.
      expect(deltaE(colour('--accent'), literal(TINT.yellow), CVD[1] ?? null)).toBeLessThan(10);
    });
  });

  describe('materials: five tiers and lit glass (language.md §2.2, §2.6)', () => {
    /** Over white, the composite, then primary · glass-sec · danger · warning, APCA P / S. */
    const TABLE: Readonly<
      Record<GlassTier, readonly [string, number, number, number, number, number, number]>
    > = {
      chip: ['#454648', 7.78, 5.07, 4.99, 5.47, 82, 56],
      bar: ['#444548', 7.9, 5.14, 5.07, 5.55, 82, 56],
      panel: ['#34363a', 9.97, 6.49, 6.4, 7.01, 87, 61],
      menu: ['#36383c', 9.68, 6.3, 6.21, 6.8, 86, 60],
      sheet: ['#34363b', 9.96, 6.49, 6.39, 7.0, 87, 61],
      // Lit glass is never over a page: its worst is the field's brightest pixel.
      lit: ['#57585d', 7.38, 4.8, 4.73, 5.19, 81, 54],
    };
    const LEMON = literal('#c8be34');
    const worst = (tier: GlassTier) => (tier === 'lit' ? LEMON : WHITE);

    it.each(GLASS_TIERS)(
      '%s composites over white and its worst backdrop as the table says',
      (tier) => {
        const [hex, primary, secondary, danger, warning, apcaP, apcaS] = TABLE[tier];
        expect(tierOver(tier, WHITE)).toEqual(literal(hex));
        const glass = tierOver(tier, worst(tier));
        atLeast(contrast(colour('--text-primary'), glass), primary, 'primary');
        atLeast(contrast(colour('--glass-text-secondary'), glass), secondary, 'glass secondary');
        atLeast(contrast(colour('--glass-danger'), glass), danger, 'glass danger');
        atLeast(contrast(colour('--warning'), glass), warning, 'warning');
        expect(lc(colour('--text-primary'), glass)).toBeCloseTo(apcaP, -0.5);
        expect(lc(colour('--glass-text-secondary'), glass)).toBeCloseTo(apcaS, -0.5);
        // A-4: primary text holds APCA Lc 75 on every tier.
        expect(lc(colour('--text-primary'), glass)).toBeGreaterThanOrEqual(75);
      },
    );

    it('keeps every page tier dark over white (Y ≤ 0.062, G-4); lit glass is forbidden there', () => {
      for (const tier of GLASS_TIERS.filter((t) => t !== 'lit')) {
        expect(relativeLuminance(tierOver(tier, WHITE)), tier).toBeLessThanOrEqual(0.062);
      }
      expect(relativeLuminance(tierOver('lit', WHITE))).toBeGreaterThan(0.062);
      expect(Number(resolve('--light-cap-under-glass'))).toBeLessThanOrEqual(0.6);
    });

    it('composites the panel over the canvas to the frame (n3) exactly', () => {
      expect(tierOver('panel', canvas())).toEqual(colour('--surface-frame'));
      expect(tierOver('panel', canvas())).toEqual(colour('--glass-panel-solid'));
      // Chip and bar differ from the canvas by about 1.06–1.08:1: the rim carries their edge.
      expect(tierOver('bar', canvas())).toEqual(literal('#131418'));
      expect(tierOver('menu', canvas())).toEqual(literal('#1b1d22'));
    });

    it('keeps glass text AA over every backdrop of today’s floating glass', () => {
      for (const [name, backdrop] of BACKDROPS) {
        const glass = glassOver(backdrop());
        for (const text of GLASS_TEXT) {
          atLeast(contrast(colour(text), glass), AA_TEXT, `${text} over a ${name}`);
        }
      }
    });

    it('keeps glass text AA on each tier over white, the canvas, mid grey and black', () => {
      for (const tier of GLASS_TIERS.filter((t) => t !== 'lit')) {
        for (const backdrop of [WHITE, canvas(), literal('#808080'), BLACK]) {
          const glass = tierOver(tier, backdrop);
          for (const text of GLASS_TEXT) {
            atLeast(contrast(colour(text), glass), AA_TEXT, `${text} on ${tier}`);
          }
        }
      }
    });

    it('measures states inside glass over white as §2.6 does (the tier densities rest on it)', () => {
      // [tier, hover glass-sec, pressed glass-sec, current primary, current glass-sec]
      const rows: readonly (readonly [GlassTier, number, number, number, number])[] = [
        ['chip', 4.47, 4.07, 5.75, 3.75],
        ['bar', 4.53, 4.13, 5.84, 3.8],
        ['panel', 5.66, 5.15, 7.17, 4.67],
        ['menu', 5.49, 4.99, 7.03, 4.58],
        ['sheet', 5.65, 5.15, 7.17, 4.67],
      ];
      const secondary = colour('--glass-text-secondary');
      for (const [tier, hover, pressed, currentP, currentS] of rows) {
        const glass = tierOver(tier, WHITE);
        expect(contrast(secondary, on('--surface-hover', glass)), `${tier} hover`).toBeCloseTo(
          hover,
          1,
        );
        expect(contrast(secondary, on('--surface-active', glass)), `${tier} pressed`).toBeCloseTo(
          pressed,
          1,
        );
        const current = on('--accent-muted', glass);
        expect(contrast(colour('--text-primary'), current), `${tier} current`).toBeCloseTo(
          currentP,
          1,
        );
        expect(contrast(secondary, current), `${tier} current secondary`).toBeCloseTo(currentS, 1);
      }
    });

    it('lists the APCA warnings: secondary text under Lc 60 (A-4; a new one fails until listed)', () => {
      const warnings: string[] = [];
      const check = (label: string, text: string, under: Rgb) => {
        const value = lc(colour(text), under);
        if (value < 60) warnings.push(`${label}: ${text} Lc ${Math.round(value)}`);
      };
      for (const surface of SURFACES) check(surface, '--text-secondary', colour(surface));
      for (const tier of GLASS_TIERS) {
        check(`${tier} over its worst`, '--glass-text-secondary', tierOver(tier, worst(tier)));
      }
      expect(warnings).toEqual([
        '--canvas: --text-secondary Lc 53',
        '--surface-frame: --text-secondary Lc 52',
        '--surface-raised: --text-secondary Lc 51',
        '--surface-on: --text-secondary Lc 50',
        'chip over its worst: --glass-text-secondary Lc 56',
        'bar over its worst: --glass-text-secondary Lc 56',
        'lit over its worst: --glass-text-secondary Lc 54',
      ]);
    });

    it('keeps alphas as their own tokens, solids opaque, shadows from the elevation scale', () => {
      const shadows: Readonly<Record<GlassTier, string>> = {
        chip: '--e2',
        bar: '--e3',
        panel: '--e4',
        menu: '--e4',
        sheet: '--e5',
        lit: '--e3',
      };
      for (const tier of GLASS_TIERS) {
        expect(root.get(`--glass-${tier}-tint`), tier).toContain(`var(--glass-${tier}-alpha)`);
        expect(wash(`--glass-${tier}-tint`).alpha).toBe(Number(resolve(`--glass-${tier}-alpha`)));
        expect(wash(`--glass-${tier}-solid`).alpha).toBe(1);
        expect(resolve(`--glass-${tier}-filter`), tier).not.toMatch(/blur/);
        expect(root.get(`--glass-${tier}-shadow`)).toBe(`var(${shadows[tier]})`);
      }
    });

    it('defines the rims and e0–e5 of language.md §2.4 and §6.3', () => {
      expect(resolve('--rim-edge')).toBe('0 0 0 1px rgb(0 0 0 / 0.5)');
      expect(resolve('--rim-inner')).toBe('inset 0 1px 0 rgb(255 255 255 / 0.12)');
      expect(wash('--rim-top').alpha).toBe(0.34);
      expect(wash('--rim-bottom').alpha).toBe(0.14);
      expect(resolve('--e0')).toBe('none');
      expect(splitLayers(resolve('--e3'))).toHaveLength(2);
      for (const e of ['--e1', '--e2', '--e4', '--e5']) {
        expect(resolve(e)).toMatch(/^0 \d+px \d+px (-\d+px )?rgb\(0 0 0 \/ 0\.\d+\)$/);
      }
    });
  });

  describe('materials.css: the tiers on their tokens (09 §26; language.md §2.3, §2.4; D3-3)', () => {
    const materials = stripComments(materialsCss);
    /** The declarations of the first rule whose selector is exactly `selector`. */
    const ruleOf = (selector: string): Map<string, string> => {
      for (const match of materials.matchAll(/(?<=^|[{};])\s*([^{};@]+?)\s*\{([^{}]*)\}/g)) {
        if ((match[1] ?? '').replace(/\s+/g, ' ') === selector) {
          const map = new Map<string, string>();
          for (const part of (match[2] ?? '').split(';')) {
            const d = /^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
            if (d?.[1] && d[2]) map.set(d[1], d[2].replace(/\s+/g, ' '));
          }
          return map;
        }
      }
      return new Map();
    };

    it('points each tier at its tint, solid, shadow and the rim of §2.4', () => {
      const rims: Readonly<Record<GlassTier, readonly [string, string, string, string]>> = {
        chip: ['--rim-edge', '--rim-top', '--rim-bottom', '--rim-inner'],
        bar: ['--rim-edge', '--rim-top', '--rim-bottom', '--rim-inner'],
        panel: ['--rim-edge', '--rim-top-sheet', '--rim-bottom-sheet', '--rim-inner-sheet'],
        menu: ['--rim-edge-strong', '--rim-top-menu', '--rim-bottom-menu', '--rim-inner-menu'],
        sheet: ['--rim-edge-strong', '--rim-top-sheet', '--rim-bottom-sheet', '--rim-inner-sheet'],
        lit: ['--rim-edge', '--rim-top', '--rim-bottom', '--rim-inner'],
      };
      for (const tier of GLASS_TIERS) {
        const rule = ruleOf(`.mat-${tier}`);
        expect(rule.get('--mat-tint'), tier).toBe(`var(--glass-${tier}-tint)`);
        expect(rule.get('--mat-solid'), tier).toBe(`var(--glass-${tier}-solid)`);
        expect(rule.get('--mat-shadow'), tier).toBe(`var(--glass-${tier}-shadow)`);
        const [edge, top, bottom, inner] = rims[tier];
        expect(rule.get('--mat-edge'), tier).toBe(`var(${edge})`);
        expect(rule.get('--mat-rim-top'), tier).toBe(`var(${top})`);
        expect(rule.get('--mat-rim-bottom'), tier).toBe(`var(${bottom})`);
        expect(rule.get('--mat-inner'), tier).toBe(`var(${inner})`);
      }
      // §2.4's values: M4 a 0.60 edge and a 0.30 / 0.10 rim, M5 and floating M3 0.24 / 0.08,
      // docked M3 an inner light of 0.06.
      expect(resolve('--rim-edge-strong')).toBe('0 0 0 1px rgb(0 0 0 / 0.6)');
      expect(wash('--rim-top-menu').alpha).toBe(0.3);
      expect(wash('--rim-bottom-menu').alpha).toBe(0.1);
      expect(resolve('--rim-inner-menu')).toBe('inset 0 1px 0 rgb(255 255 255 / 0.1)');
      expect(wash('--rim-top-sheet').alpha).toBe(0.24);
      expect(wash('--rim-bottom-sheet').alpha).toBe(0.08);
      expect(resolve('--rim-inner-sheet')).toBe('inset 0 1px 0 rgb(255 255 255 / 0.08)');
      expect(resolve('--rim-inner-docked')).toBe('inset 0 1px 0 rgb(255 255 255 / 0.06)');
      // The bar over a white page and over the canvas (e2e/glass-pixels.spec.ts samples them).
      expect(glassOver(WHITE)).toEqual(literal('#444548'));
      expect(glassOver(canvas())).toEqual(literal('#131418'));
    });

    it('draws the base solid first, its rim lit from above, edge, inner light and shadow', () => {
      const base = ruleOf('.mat');
      expect(base.get('background')).toBe('var(--mat-solid)');
      expect(base.get('border')).toBe('1px solid var(--border-glass)');
      expect(base.get('border-top-color')).toBe('var(--mat-rim-top)');
      expect(base.get('border-bottom-color')).toBe('var(--mat-rim-bottom)');
      expect(base.get('--shadow-own')).toBe('var(--mat-edge), var(--mat-inner), var(--mat-shadow)');
      expect(base.get('box-shadow')).toBe('var(--shadow-own)');
      // Docked M3: no edge, no shadow, the module's hairline; lit glass: the masked rim.
      expect(ruleOf('.mat-docked').get('--mat-shadow')).toBe('0 0 #0000');
      expect(
        materials,
        'docked M3 draws no border of its own: the module draws the hairline on its free edge',
      ).toMatch(/\.mat-docked\s*\{\s*border:\s*0;\s*\}/);
      expect(ruleOf('.mat-lit::before').get('mask')).toMatch(/content-box exclude/);
      // The tint and the text steps only where glass renders and Glass is not Solid.
      const live = ruleOf(":where(:root:not([data-glass='solid'], [data-degrade='4'])) .mat");
      expect(live.get('background')).toBe('var(--mat-tint)');
      expect(live.get('--text-secondary')).toBe('var(--glass-text-secondary)');
      expect(live.get('--danger')).toBe('var(--glass-danger)');
      // Filters never animate (language.md §2.1 rule 5).
      expect(materials).not.toMatch(/transition|animation/);
    });

    it('uses no other drop shadow in component styles (rings, insets and e-tokens only)', () => {
      expect(Object.keys(modules).length).toBeGreaterThan(20);
      for (const [file, source] of Object.entries(modules)) {
        const css = stripComments(source);
        for (const match of css.matchAll(/box-shadow:\s*([^;}]+)/g)) {
          const value = (match[1] ?? '').trim();
          if (value === 'none') continue;
          for (const layer of splitLayers(value)) {
            const trimmed = layer.trim();
            if (/^var\(--[\w-]+(?:,[^)]*)?\)$/.test(trimmed)) continue;
            // `[inset] 0 0 <blur> <spread> colour`: no offset and no blur, only a ring.
            const lengths =
              /^(?:inset\s+)?(-?[\d.]+(?:px)?)\s+(-?[\d.]+(?:px)?)\s+(-?[\d.]+(?:px)?)/.exec(
                trimmed,
              );
            expect(lengths, `${file}: ${layer}`).not.toBeNull();
            expect(
              [lengths?.[1], lengths?.[2], lengths?.[3]].map((v) => Number.parseFloat(v ?? '1')),
              `${file}: ${layer}`,
            ).toEqual([0, 0, 0]);
          }
        }
      }
    });

    it('puts menus and popovers on M4, the docked frame on docked M3, and two solid twins', () => {
      const first = (source: string) =>
        /^\.[\w]+\s*\{([^{}]*)\}/m.exec(stripComments(source))?.[1] ?? '';
      const menus = import.meta.glob<string>('../ui/{Menu,Popover}.module.css', {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      expect(Object.keys(menus)).toHaveLength(2);
      for (const [file, source] of Object.entries(menus)) {
        expect(first(source), file).toMatch(/composes:\s*mat mat-menu s12\b[^;]* from global;/);
      }
      const docked = import.meta.glob<string>(
        '../shell/{frame/TopStrip,frame/CompactTopBar,sidebar/Sidebar,RightPanel}.module.css',
        { query: '?raw', import: 'default', eager: true },
      );
      expect(Object.keys(docked)).toHaveLength(4);
      for (const [file, source] of Object.entries(docked)) {
        const rule = first(source);
        expect(rule, file).toMatch(/composes:\s*mat mat-panel mat-docked s\d+[^;]* from global;/);
        expect(rule, file).not.toMatch(/background:/);
      }
      // The title menu and the pill menu open over the sidebar's dark edge and the white page
      // at once: M4's solid twin (01-frame F5, F11; quality bar Q-1, Q-3).
      const twins = import.meta.glob<string>('../shell/frame/{TitleMenu,PagePill}.module.css', {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      expect(Object.keys(twins)).toHaveLength(2);
      for (const [file, source] of Object.entries(twins)) {
        expect(stripComments(source), file).toMatch(/composes:\s*mat-opaque from global;/);
      }
      expect(ruleOf('.mat-opaque').get('--mat-tint')).toBe('var(--mat-solid)');
    });
  });

  describe('settings: Glass, reduced transparency, more contrast, forced colours (§5, §6)', () => {
    const block = (selector: RegExp) => declarations(selector.exec(tokensSource)?.[1] ?? '');
    const solid = block(/:root\[data-glass='solid'\]\s*\{([^{}]*)\}/);
    const tinted = block(/:root\[data-glass='tinted'\]\s*\{([^{}]*)\}/);
    const media = mediaOverrides('prefers-reduced-transparency: reduce');
    const more = mediaOverrides('prefers-contrast: more');
    const forced = mediaOverrides('forced-colors: active');
    const materials = stripComments(materialsCss);

    it('Glass: Solid sets exactly what the system’s reduced transparency sets (A-17)', () => {
      expect(solid.size).toBeGreaterThan(0);
      expect([...solid.entries()].sort()).toEqual([...media.entries()].sort());
    });

    it('Glass: Tinted lays every tier at alpha 0.90 and changes nothing else', () => {
      expect([...tinted.keys()].sort()).toEqual(
        GLASS_TIERS.map((t) => `--glass-${t}-alpha`).sort(),
      );
      for (const tier of GLASS_TIERS) {
        expect(tinted.get(`--glass-${tier}-alpha`)).toBe('0.9');
        expect(wash(`--glass-${tier}-tint`).alpha, tier).toBeLessThan(0.9);
        expect(parseColour(resolve(`--glass-${tier}-tint`, tinted)).alpha, tier).toBe(0.9);
        // At 0.90 even a backdrop that leaks unfiltered keeps text AA (language.md §2.8).
        const leaked = round8(
          over(parseColour(resolve(`--glass-${tier}-tint`, tinted)).rgb, 0.9, WHITE),
        );
        if (tier !== 'lit') {
          atLeast(contrast(colour('--text-primary'), leaked), 7, `${tier} primary`);
          atLeast(contrast(colour('--glass-text-secondary'), leaked), 4.5, `${tier} secondary`);
        }
      }
    });

    it('makes every tier solid with no filter, and keeps rims and shadows', () => {
      for (const scope of [solid, media, more]) {
        for (const tier of GLASS_TIERS) {
          const t = tierTokens(tier);
          expect(scope.get(t.tint), t.tint).toBe(`var(${t.solid})`);
          expect(scope.get(t.filter), t.filter).toBe('none');
        }
      }
      for (const scope of [solid, media]) {
        for (const name of ['--rim-edge', '--rim-inner', '--border-glass']) {
          expect(scope.has(name), name).toBe(false);
        }
      }
      // materials.css: every blur rule waits for a root that is not Solid; the OS preferences
      // and forced colours turn both lines off whatever a rule says.
      for (const match of materials.matchAll(/([^{};]+)\{[^{}]*backdrop-filter: blur/g)) {
        expect(match[1], 'a blur rule').toContain(":not([data-glass='solid']");
      }
      const unwelcome =
        /@media \(prefers-reduced-transparency: reduce\), \(prefers-contrast: more\), \(forced-colors: active\)\s*\{\s*\.mat\s*\{([^{}]*)\}/.exec(
          materials,
        )?.[1] ?? '';
      expect(unwelcome).toMatch(/-webkit-backdrop-filter:\s*none !important/);
      expect(unwelcome).toMatch(/(?:^|[^-])backdrop-filter:\s*none !important/);
      expect(unwelcome).toMatch(/--text-secondary:\s*inherit/);
    });

    it('trades rim and shadow for the strong border and lifts text under more contrast (A-18)', () => {
      for (const rim of ['--rim-edge', '--rim-edge-strong', '--rim-inner', '--rim-inner-menu']) {
        expect(more.get(rim), rim).toBe('0 0 #0000');
      }
      expect(parseColour(resolve('--border-strong', more)).alpha).toBe(0.36);
      expect(parseColour(resolve('--border-glass', more)).alpha).toBe(0.36);
      expect(resolve('--text-secondary', more)).toBe(resolve('--n11'));
      expect(resolve('--text-tertiary', more)).toBe(resolve('--n10'));
      const rule =
        /@media \(prefers-contrast: more\)\s*\{\s*\.mat\s*\{([^{}]*)\}/.exec(materials)?.[1] ?? '';
      expect(rule).toMatch(/border-color:\s*var\(--border-glass\)/);
      expect(rule).toMatch(/--shadow-own:\s*0 0 #0000/);
    });

    it('drops every tier to Canvas with its filter off under forced colours', () => {
      for (const tier of GLASS_TIERS) {
        const t = tierTokens(tier);
        expect(forced.get(t.tint), t.tint).toBe('Canvas');
        expect(forced.get(t.solid), t.solid).toBe('Canvas');
        expect(forced.get(t.filter), t.filter).toBe('none');
      }
      expect(forced.get('--rim-edge')).toBe('0 0 #0000');
      expect(forced.get('--border-glass')).toBe('CanvasText');
    });

    it('swaps in the aurora’s P3 stops on wide-gamut screens and never the lime', () => {
      const p3 = mediaOverrides('color-gamut: p3');
      expect([...p3.keys()].sort()).toEqual(
        ['--aurora-lemon', '--aurora-lime', '--aurora-mint', '--aurora-teal'].sort(),
      );
      for (const value of p3.values()) expect(value).toMatch(/^oklch\(/);
    });
  });

  describe('coverage registry and materials.css (D0-1, D3-3; language.md §2.9, A-2)', () => {
    /** Abramowitz and Stegun 7.1.26: |error| < 1.5e-7, ample for a 0.985 floor. */
    const erf = (x: number): number => {
      const t = 1 / (1 + 0.3275911 * Math.abs(x));
      const poly =
        t *
        (0.254829592 +
          t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
      return Math.sign(x) * (1 - poly * Math.exp(-x * x));
    };
    /** The share of a w × h surface's backdrop its blur covers at the centre (research 22 §3.2). */
    const coverage = (w: number, h: number, sigma: number): number =>
      erf(h / (2 * Math.SQRT2 * sigma)) * erf(w / (2 * Math.SQRT2 * sigma));
    const materials = stripComments(materialsCss);
    /** Every rule of materials.css with a backdrop filter: selector and the two lines. */
    const filterRules = [...materials.matchAll(/([^{};]+)\{([^{}]*backdrop-filter[^{}]*)\}/g)].map(
      (match) => ({
        selector: (match[1] ?? '').replace(/\s+/g, ' ').trim(),
        prefixed: /-webkit-backdrop-filter:\s*([^;]+);/.exec(match[2] ?? '')?.[1]?.trim(),
        unprefixed: /(?:^|[\s;])backdrop-filter:\s*([^;]+);/.exec(match[2] ?? '')?.[1]?.trim(),
      }),
    );
    /** The chain `materials.css` must write for a tier at σ: literal, the tier's tokens. */
    const chain = (tier: GlassTier, sigma: number) =>
      `blur(${sigma}px) ${resolve(`--glass-${tier}-filter`)}`;
    const rulesFor = (suffix: string) => filterRules.filter((r) => r.selector.endsWith(suffix));

    it('reproduces the language table (36 px bar at 7px 0.990, 64 px menu at 12px 0.992)', () => {
      expect(coverage(360, 36, 7)).toBeCloseTo(0.99, 3);
      expect(coverage(200, 64, 12)).toBeCloseTo(0.992, 3);
      expect(coverage(1440, 44, 8)).toBeCloseTo(0.994, 3);
      // The bar that shipped in M8, which research 22 measured leaking: 44 px at blur 28px.
      expect(coverage(436, 44, 28)).toBeLessThan(0.6);
    });

    it.each(COVERAGE_REGISTRY.map((entry) => [entry.id, entry] as const))(
      '%s meets c ≥ 0.985 at every size it names, with σ from the steps',
      (_, entry: GlassSurfaceEntry) => {
        const sizes: [string, number, number, number][] = [
          ['fine', entry.minWidth, entry.minHeight, entry.sigma],
        ];
        if (typeof entry.coarse === 'object') {
          const { minWidth, minHeight, sigma } = entry.coarse;
          sizes.push(['coarse', minWidth, minHeight, sigma]);
        }
        if (entry.short) {
          sizes.push(['short', entry.short.minWidth, entry.short.minHeight, entry.short.sigma]);
        }
        for (const [size, w, h, sigma] of sizes) {
          expect(SIGMA_STEPS, `${entry.id} ${size} σ`).toContain(sigma);
          expect(
            coverage(w, h, sigma),
            `${entry.surface} (${size}): ${w} × ${h} px at σ ${sigma}`,
          ).toBeGreaterThanOrEqual(0.985);
        }
        expect(GLASS_TIERS).toContain(entry.tier);
        if (entry.docked) expect(entry.tier).toBe('panel');
        if (entry.lens) expect(entry.tier).toBe('chip');
      },
    );

    it('registers each surface once', () => {
      const ids = COVERAGE_REGISTRY.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const entry of COVERAGE_REGISTRY) {
        expect(entry.minWidth, entry.id).toBeGreaterThan(0);
        expect(entry.minHeight, entry.id).toBeGreaterThan(0);
      }
    });

    it('holds one rule per tier × σ the registry uses, both lines literal and equal (G-22)', () => {
      for (const entry of COVERAGE_REGISTRY) {
        const want = chain(entry.tier, entry.sigma);
        const cls = entry.oneRow ? `r${entry.sigma}` : `s${entry.sigma}`;
        const rules = filterRules.filter((r) => r.selector.includes(`.mat-${entry.tier}.${cls}`));
        const own = rules.find((r) => !r.selector.endsWith('.lens') && !r.selector.endsWith('.cs'));
        expect(own, `${entry.id}: .mat-${entry.tier}.${cls}`).toBeDefined();
        expect(own?.prefixed, entry.id).toBe(want);
        expect(own?.unprefixed, entry.id).toBe(want);
        if (typeof entry.coarse === 'object') {
          const coarse = rulesFor(`.mat-${entry.tier}.c${entry.coarse.sigma}`)[0];
          expect(coarse?.prefixed, `${entry.id} coarse`).toBe(
            chain(entry.tier, entry.coarse.sigma),
          );
          expect(coarse?.unprefixed, `${entry.id} coarse`).toBe(coarse?.prefixed);
        }
        if (entry.short) {
          const short = rulesFor(`.mat-${entry.tier}.h${entry.short.sigma}`)[0];
          expect(short?.prefixed, `${entry.id} short`).toBe(chain(entry.tier, entry.short.sigma));
          expect(short?.unprefixed, `${entry.id} short`).toBe(short?.prefixed);
        }
      }
      // And nothing else: every blur rule belongs to a registered tier × σ, every prefixed line
      // equals its unprefixed one, and only the Chromium lens reads a var() (no -webkit- line).
      const used = new Set<string>();
      for (const entry of COVERAGE_REGISTRY) {
        used.add(`.mat-${entry.tier}.${entry.oneRow ? 'r' : 's'}${entry.sigma}`);
        if (typeof entry.coarse === 'object') used.add(`.mat-${entry.tier}.c${entry.coarse.sigma}`);
        if (entry.short) used.add(`.mat-${entry.tier}.h${entry.short.sigma}`);
      }
      for (const rule of filterRules) {
        if (rule.unprefixed === 'none !important' || rule.unprefixed === 'none') continue;
        const pair = /\.mat-\w+\.[schr]\d+/.exec(rule.selector)?.[0];
        expect(used.has(pair ?? ''), rule.selector).toBe(true);
        if (rule.selector.endsWith('.lens')) {
          expect(rule.prefixed, rule.selector).toBeUndefined();
          expect(rule.unprefixed).toMatch(/^var\(--lens\) blur\(/);
          continue;
        }
        expect(rule.prefixed, rule.selector).toBe(rule.unprefixed);
        expect(rule.prefixed, rule.selector).not.toMatch(/var\(/);
      }
    });

    it('holds every module rule that composes a blurred material, and no other', () => {
      // The Pages grid's bar is converted when D2-5 lands (its module is that package's): until
      // then it still composes M8's `glass`, which no longer exists.
      const AWAITING: Readonly<Record<string, string>> = {
        'stage/ArrangeView.module.css .contextBar': 'glass',
      };
      const found = new Map<string, string>();
      for (const [file, source] of Object.entries(modules)) {
        const css = stripComments(source);
        for (const match of css.matchAll(
          /(\.[\w-]+)\s*\{\s*composes:\s*([^;]*?)\s+from global;/g,
        )) {
          const classes = (match[2] ?? '').split(/\s+/);
          const key = `${file.replace(/^\.\.\//, '')} ${match[1]}`;
          if (key in AWAITING) {
            found.set(key, classes.join(' '));
            continue;
          }
          // A material with a σ: lit glass (no blur until D3-8) and the solid twin are not.
          if (!classes.includes('mat') || !classes.some((c) => /^s\d+$/.test(c))) continue;
          found.set(key, classes.join(' '));
        }
      }
      const registered = new Map<string, string>();
      for (const entry of COVERAGE_REGISTRY) {
        const key = `${entry.module} ${entry.selector}`;
        registered.set(key, AWAITING[key] ?? compositionOf(entry.module, entry.selector).join(' '));
      }
      expect([...found.entries()].sort()).toEqual([...registered.entries()].sort());
      // The spec row counted about nineteen modules on the M8 shell: seventeen compose glass
      // there (the TextLayer hint is solid: at 22 px it is under quality-bar Q-5's 32 px), and
      // the compact edition adds three, the toast stack (D0-5) one and the Sheet primitive one
      // (D0-4: one panel, an entry per presentation), the pinch detent chip one (D2-10) and the
      // Library selection bar one (D4-1). The frame (D2-1) trades the title and status bars for
      // the top strip, the compact bar and the page pill: one more. The capsule (D2-2) takes the
      // tool bar's glass into its own module; the Markup palette (D2-3) is content inside it, its
      // ink strip a row of the capsule's glass, so the bar's module and its options tier go.
      expect(new Set(COVERAGE_REGISTRY.map((entry) => entry.module)).size).toBe(25);
      expect(entryClasses(COVERAGE_REGISTRY[0] as GlassSurfaceEntry)).toEqual([
        'mat',
        'mat-bar',
        's9',
        'c10',
        'h8',
      ]);
    });

    it('gives a one-row menu σ 8 through its own class, applied while it holds one child', () => {
      expect(compositionOf('ui/Menu.module.css', '.popup')).toEqual([
        'mat',
        'mat-menu',
        's12',
        'r8',
      ]);
      const rule = rulesFor('.mat-menu.r8:not(:has(> :nth-child(2)))')[0];
      expect(rule?.unprefixed).toBe(chain('menu', 8));
    });
  });

  describe('the page layers keep to content colours (ADR-0023 §2.1, A-19)', () => {
    /**
     * The modules that draw on the page. A few also hold chrome (the controls of a popover or a
     * panel beside the page marks), which may use the lime as chrome does: those rules are
     * listed by selector, and no other rule may read an --accent token.
     */
    const PAGE_LAYERS: Readonly<Record<string, readonly string[]>> = {
      'viewer/LinkLayer.module.css': [],
      'viewer/SearchHighlights.module.css': [],
      'viewer/TextLayer.module.css': [],
      'annotations/AnnotationLayer.module.css': [],
      'annotations/lasso/Lasso.module.css': [],
      'forms/FormLayer.module.css': [],
      'forms/create/CreatedFields.module.css': [".segment[aria-checked='true']"],
      'image-objects/ImageObjects.module.css': [],
      'text-edit/TextEdit.module.css': [".choice[aria-pressed='true']"],
      'text-edit/ParagraphEditor.module.css': ['.action[data-default]'],
      'crop/Crop.module.css': [],
      'redaction/RedactionLayer.module.css': [],
      'stage/ReadView.module.css': [],
      'furniture/FurnitureLayer.module.css': [],
      'shell/compact/NoteLayer.module.css': [],
      'ocr/Ocr.module.css': [".rowButton[aria-current='true']"],
      'compare/CompareView.module.css': [
        '.dropZone[data-active]',
        ".stripCell[aria-current='true']",
        ".segment[aria-checked='true']",
      ],
    };

    it('leaves no lime, #7c8cff or --accent on the page', () => {
      for (const [file, chrome] of Object.entries(PAGE_LAYERS)) {
        const source = modules[`../${file}`];
        expect(source, file).toBeDefined();
        const css = stripComments(source ?? '');
        expect(css, file).not.toMatch(/#7c8cff|124\s+140\s+255|#c8fb3d|200\s+251\s+61/i);
        for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          if (!/--(accent|tool-active|primary-fill)/.test(match[2] ?? '')) continue;
          const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
          expect(chrome, `${file}: ${selector} uses the lime on the page`).toContain(selector);
        }
      }
    });

    it('paints the page-layer canvases (paragraph editor, compare heat map) in content colours', () => {
      const sources = import.meta.glob<string>(
        ['../text-edit/ParagraphEditor.tsx', '../compare/compare-runner.ts'],
        { query: '?raw', import: 'default', eager: true },
      );
      expect(Object.keys(sources)).toHaveLength(2);
      for (const [file, source] of Object.entries(sources)) {
        expect(source, file).not.toMatch(/#7c8cff|124,\s*140,\s*255|#c8fb3d|'--accent/i);
      }
    });
  });

  describe('the two-band focus ring (language.md §9.2, A-11, redesign D0-1)', () => {
    const light = () => colour('--focus-light');
    const dark = () => colour('--focus-dark');

    it('keeps its bands ≥ 9:1 apart (WCAG C40): lime on ink, 16.42:1', () => {
      expect(resolve('--focus-light')).toBe('#c8fb3d');
      expect(resolve('--focus-dark')).toBe('#08090c');
      atLeast(contrast(light(), dark()), 16.42, 'bands');
    });

    it('shows one band at ≥ 3:1 over every backdrop it meets (weakest: the select blue 4.07)', () => {
      const backdrops: readonly (readonly [string, Rgb])[] = [
        ['white page', WHITE],
        ['yellow tint', literal(TINT.yellow)],
        ['green tint', literal(TINT.green)],
        ['select blue', colour('--select')],
        ['blue ink', literal(INK.blue)],
        ['red ink', literal(INK.red)],
        ['mid grey', literal('#808080')],
        ['aurora lime at I 0.25', round8(over(literal('#bbed26'), 0.25, canvas()))],
        ['lime fill', colour('--accent')],
        ['danger', colour('--danger')],
        ...[...SURFACES, '--surface-sunken'].map((name) => [name, colour(name)] as const),
        ...GLASS_TIERS.map((tier) => [`${tier} over white`, tierOver(tier, WHITE)] as const),
        ['bar over the canvas', glassOver(canvas())],
      ];
      for (const [name, backdrop] of backdrops) {
        const best = Math.max(contrast(light(), backdrop), contrast(dark(), backdrop));
        atLeast(best, name === 'select blue' ? 4.07 : AA_NON_TEXT, name);
      }
    });

    it('sets the three offsets: outset 2px, inset -2px, gap 4px', () => {
      expect(resolve('--focus-offset-out')).toBe('2px');
      expect(resolve('--focus-offset-in')).toBe('-2px');
      expect(resolve('--focus-offset-gap')).toBe('4px');
    });

    it('draws the three forms in focus.css from the tokens; global.css imports it', () => {
      expect(stripComments(globalCss)).toMatch(/@import '\.\/focus\.css';/);
      expect(stripComments(globalCss)).toMatch(/@import '\.\/materials\.css';/);
      const css = stripComments(focusCss);
      /** Every declaration of the first rule matching `selector`, not only custom properties. */
      const rule = (selector: RegExp): Map<string, string> => {
        const body = new RegExp(`${selector.source}\\s*\\{([^{}]*)\\}`).exec(css)?.[1] ?? '';
        const found = new Map<string, string>();
        for (const part of body.split(';')) {
          const match = /^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part);
          if (match?.[1] && match[2]) found.set(match[1], match[2].replace(/\s+/g, ' '));
        }
        return found;
      };
      const outset = rule(/\}\s*:focus-visible/);
      expect(outset.get('outline')).toBe('2px solid var(--focus-light)');
      expect(outset.get('outline-offset')).toBe('var(--focus-offset-out)');
      expect(outset.get('box-shadow')).toBe(
        '0 0 0 6px var(--focus-dark), var(--shadow-own, 0 0 #0000)',
      );
      const inset = rule(
        /\.focus-inset:focus-visible,\s*\[data-focus='inset'\]:focus-visible,\s*\.mat :focus-visible/,
      );
      expect(inset.get('outline-offset')).toBe('var(--focus-offset-in)');
      expect(inset.get('box-shadow')).toBe(
        'inset 0 0 0 4px var(--focus-dark), var(--shadow-own, 0 0 #0000)',
      );
      const gap = rule(/\.focus-gap:focus-visible,\s*\[data-focus='gap'\]:focus-visible/);
      expect(gap.get('outline-offset')).toBe('var(--focus-offset-gap)');
      expect(gap.get('box-shadow')).toBe(
        '0 0 0 8px var(--focus-dark), var(--shadow-own, 0 0 #0000)',
      );
      // The ring appears with focus and never animates (language.md §9.2).
      expect(css).not.toMatch(/transition|animation/);
    });
  });

  describe('the control block and density (09-primitives §2.1–§2.2, §25)', () => {
    const coarse = mediaOverrides('pointer: coarse), (any-pointer: coarse');
    const M4 = () => tierOver('menu', WHITE);
    const M5 = () => tierOver('sheet', WHITE);
    const M2 = () => tierOver('bar', WHITE);

    it('defines the control tokens', () => {
      for (const name of CONTROL_TOKENS) expect(theme.has(name), name).toBe(true);
      expect(resolve('--radius-control')).toBe('10px');
    });

    it('keeps on-states, the range and progress neutral: n12 with an ink glyph (09 §34 #1)', () => {
      for (const token of ['--control-on', '--control-range', '--progress-fill']) {
        expect(resolve(token), token).toBe(resolve('--n12'));
        expect(resolve(token), token).not.toBe(resolve('--accent'));
      }
      expect(resolve('--control-on-ink')).toBe(resolve('--n1'));
      atLeast(contrast(colour('--control-on-ink'), colour('--control-on')), 16.4, 'glyph');
      atLeast(contrast(colour('--control-on'), M5()), 9.96, 'on-fill vs M5');
      atLeast(contrast(colour('--control-on'), M2()), 7.9, 'on-fill vs M2');
      for (const surface of SURFACES) {
        atLeast(contrast(colour('--control-on'), colour(surface)), 7, surface);
      }
    });

    it('holds 09 §2.2’s pairs: fills, border, thumb, well, scroll thumb, badge', () => {
      const primary = colour('--text-primary');
      atLeast(contrast(primary, on('--control-fill', M5())), 7.78, 'n12 on fill over M5');
      atLeast(contrast(primary, on('--control-fill-hover', M5())), 6.86, 'on hover fill');
      atLeast(contrast(primary, on('--control-fill-pressed', M5())), 6.06, 'on pressed fill');
      atLeast(contrast(primary, on('--control-fill', M4())), 7.55, 'n12 on fill over M4');
      atLeast(contrast(on('--control-border', M5()), M5()), 4.09, 'border vs M5');
      atLeast(contrast(on('--control-border', M4()), M4()), 4.06, 'border vs M4');
      const well = colour('--field-well');
      expect(resolve('--field-well')).toBe(resolve('--n2'));
      atLeast(contrast(on('--control-border', well), well), 5.01, 'border vs its well');
      atLeast(contrast(colour('--control-thumb-off'), M5()), 6.49, 'thumb off vs M5');
      atLeast(contrast(colour('--field-placeholder'), well), 7.58, 'placeholder');
      atLeast(contrast(primary, well), 15.45, 'text in the well');
      atLeast(
        contrast(on('--scroll-thumb', tierOver('panel', WHITE)), tierOver('panel', WHITE)),
        3.33,
        'scroll thumb vs M3',
      );
      atLeast(contrast(primary, colour('--badge-fill')), 10.43, 'badge');
    });

    it('draws the control border at ≥ 3:1 against every surface (A-3)', () => {
      for (const surface of [...SURFACES, '--surface-sunken']) {
        const under = colour(surface);
        atLeast(contrast(on('--control-border', under), under), AA_NON_TEXT, surface);
      }
    });

    it('sizes controls 32 px fine and 44 px coarse, in bars of 44 and 56 (Q-9)', () => {
      expect(free.get('--control-h')).toBe('32px');
      expect(free.get('--bar-button')).toBe('32px');
      expect(free.get('--bar-h')).toBe('44px');
      expect(coarse.get('--control-h')).toBe('44px');
      expect(coarse.get('--bar-button')).toBe('44px');
      expect(coarse.get('--bar-h')).toBe('56px');
      expect(coarse.get('--field-text')).toBe('16px');
      // Icons stay 16 and 20 at both densities (Q-9).
      expect(free.get('--icon-sm')).toBe('16px');
      expect(free.get('--icon-md')).toBe('20px');
      expect(coarse.has('--icon-sm')).toBe(false);
      expect(coarse.has('--icon-md')).toBe(false);
    });
  });

  // Motion (§7.5) is motion.css's, tested in motion.test.ts.

  describe('no colour literal outside the tokens (D3-2)', () => {
    /**
     * The colour literals CSS modules may keep, by file: content that is not chrome (the page's
     * own text and the inks of in-place editors, the PDF's form look, the hue spectrum and
     * transparency checkerboard of the colour panel, the hue ring of a custom colour), masks
     * (`#000` in a mask is coverage, not colour), and the light theme's values inside
     * `:global([data-theme='light'])` rules, which D3-7 moves into tokens.css. Everything else
     * paints with a token.
     */
    const ALLOWED: Readonly<Record<string, readonly string[]>> = {
      'text-edit/TextEdit.module.css': ['#000000'],
      'forms/create/CreatedFields.module.css': ['#000000', 'rgb(153 193 218)'],
      'forms/FormLayer.module.css': ['#111111'],
      'annotations/AnnotationLayer.module.css': ['rgb(255 255 255 / 0.85)'],
      'annotations/lasso/Lasso.module.css': ['#fff', '#000'],
      'signatures/NewSignatureSheet.module.css': ['rgb(26 35 126 / 0.45)'],
      'ui/colour/ColourSpectrum.module.css': [
        '#ffffff',
        '#000000',
        '#ff0000',
        '#ffff00',
        '#00ff00',
        '#00ffff',
        '#0000ff',
        '#ff00ff',
        'rgb(255 255 255 / 0)',
        'rgb(0 0 0 / 0)',
        'rgb(0 0 0 / 0.25)',
        'rgb(0 0 0 / 0.2)',
        'rgb(0 0 0 / 0.5)',
      ],
      'ui/colour/ColourWell.module.css': [
        '#ff3b30',
        '#ff9500',
        '#ffcc00',
        '#34c759',
        '#00c7be',
        '#007aff',
        '#5856d6',
        '#af52de',
        '#ff2d55',
        '#ffffff',
        '#d5d7dc',
      ],
      'ui/colour/Eyedropper.module.css': [
        'rgb(255 255 255 / 0.9)',
        'rgb(0 0 0 / 0.28)',
        'rgb(0 0 0 / 0.7)',
        '#ffffff',
      ],
      'ui/colour/ColourGrid.module.css': ['rgb(0 0 0 / 0.55)', '#ffffff'],
      'ui/colour/ColourPanel.module.css': ['#8a8d93'],
      // The knob's notch glyph sits on the white knob; the lens rim, the transparency checker
      // and the readout bubble's rim are the slider's own (10-ink §3.2).
      'ui/Slider.module.css': [
        '#ffffff',
        '#d5d7dc',
        '#4f535a',
        'rgb(0 0 0 / 0.18)',
        'rgb(0 0 0 / 0.12)',
        'rgb(0 0 0 / 0.2)',
        'rgb(255 255 255 / 0.35)',
        'rgb(255 255 255 / 0.7)',
        'rgb(255 255 255 / 0.3)',
        'rgb(255 255 255 / 0.12)',
      ],
      'ui/Swatch.module.css': ['#e5322d', '#ffffff', 'rgb(21 23 28 / 0.35)'],
    };
    const LITERAL = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi;
    /** The rules of a module outside any `:global([data-theme='light'])` selector. */
    const darkRules = (css: string) =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((m) => !(m[1] ?? '').includes("data-theme='light'"))
        .map((m) => m[2] ?? '');

    it('keeps every chrome colour in tokens.css', () => {
      const stray: string[] = [];
      const unused = new Set(
        Object.entries(ALLOWED).flatMap(([file, values]) => values.map((v) => `${file}: ${v}`)),
      );
      for (const [file, source] of Object.entries(modules)) {
        const name = file.replace(/^\.\.\//, '');
        const allowed = new Set((ALLOWED[name] ?? []).map((v) => v.toLowerCase()));
        for (const body of darkRules(stripComments(source))) {
          // Masks draw coverage, not colour.
          const painted = body.replace(/(?:-webkit-)?mask(?:-image)?\s*:[^;]*;?/g, '');
          for (const [found] of painted.matchAll(LITERAL)) {
            const value = found.toLowerCase().replace(/\s+/g, ' ');
            unused.delete(`${name}: ${value}`);
            // `0 0 #0000`: the empty shadow --shadow-own starts at.
            if (value !== '#0000' && !allowed.has(value)) stray.push(`${name}: ${found}`);
          }
        }
      }
      expect(stray).toEqual([]);
      // The list stays honest: every literal it allows is still there.
      expect([...unused]).toEqual([]);
    });
  });
});

/** OKLab of an 8-bit sRGB colour (Ottosson). */
function oklab(c: Rgb, matrix: readonly (readonly number[])[] | null = null): Rgb {
  let [r, g, b] = map3(c, linear);
  if (matrix) {
    const m = matrix as readonly [readonly number[], readonly number[], readonly number[]];
    const sim = m.map((row) =>
      Math.min(1, Math.max(0, (row[0] ?? 0) * r + (row[1] ?? 0) * g + (row[2] ?? 0) * b)),
    ) as [number, number, number];
    [r, g, b] = sim;
  }
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s,
  ];
}

/** OKLCH hue in degrees. */
function okhue(c: Rgb): number {
  const [, a, b] = oklab(c);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

/**
 * Machado, Oliveira and Fernandes (2009) at severity 1.0, in linear sRGB (language.md §1.2):
 * none, protanopia, deuteranopia, tritanopia.
 */
const CVD: readonly (readonly (readonly number[])[] | null)[] = [
  null,
  [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
];

/** ΔE_OK × 100 between two colours as seen under `matrix`. */
function deltaE(a: Rgb, b: Rgb, matrix: readonly (readonly number[])[] | null): number {
  const p = oklab(a, matrix);
  const q = oklab(b, matrix);
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
