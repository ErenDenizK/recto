/**
 * Fener's colours (DSN-88; `styles/fener.css`): every role × preset × theme against the floors
 * of `tokens.test.ts` (WCAG 2.2 for text 4.5 and graphics 3, APCA Lc 75 for primary text), the
 * neutrality of large glass and the neutrals, and the rule that with the flag off nothing
 * applies. Like `tokens.test.ts` it reads the real CSS files, resolves `var()` references and
 * models glass over a uniform backdrop as the translucency audit measured it: `a · tint + (1 − a)
 * · filter(backdrop)`, the filter chain applied per channel in order and clamped.
 */
import { describe, expect, it } from 'vitest';

import auraCss from '../home/Aura.module.css?raw';
import { apcaContrast } from './apca';
import fenerCss from './fener.css?raw';
import tokensCss from './tokens.css?raw';

type Rgb = readonly [number, number, number];

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];
const PRESETS = ['indigo', 'violet', 'blue'] as const;
type Preset = (typeof PRESETS)[number];

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = strip(tokensCss);
const fener = strip(fenerCss);

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

/** The body of the block whose selector is exactly `selector`. */
function block(css: string, selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
  const body = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^{}]*)\\}`).exec(css)?.[1];
  if (body === undefined) throw new Error(`no block for ${selector}`);
  return declarations(body);
}

const free = block(tokens, ':root');
const baseOf: Record<Theme, Map<string, string>> = {
  dark: new Map([...free, ...block(tokens, ":root,\n[data-theme='dark']")]),
  light: new Map([...free, ...block(tokens, "\n[data-theme='light']")]),
};

/** Every token at rest for a theme under Fener's `preset` (null: today's, Fener off). */
function scope(theme: Theme, preset: Preset | null): Map<string, string> {
  const out = new Map(baseOf[theme]);
  if (preset === null) return out;
  const shared = block(fener, `[data-fener]:where([data-theme='${theme}'])`);
  const own = block(fener, `[data-fener]:where([data-theme='${theme}'][data-accent='${preset}'])`);
  for (const [k, v] of [...shared, ...own]) out.set(k, v);
  return out;
}

function resolve(scoped: Map<string, string>, name: string, depth = 0): string {
  const value = scoped.get(name);
  if (value === undefined) throw new Error(`${name} is not defined`);
  if (depth > 8) throw new Error(`var() cycle at ${name}`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, inner: string) =>
    resolve(scoped, inner, depth + 1),
  );
}

function parse(value: string): { rgb: Rgb; alpha: number } {
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

const map3 = (c: Rgb, f: (v: number, i: number) => number): Rgb => [
  f(c[0], 0),
  f(c[1], 1),
  f(c[2], 2),
];
const clamp = (v: number) => Math.min(255, Math.max(0, v));
const round8 = (c: Rgb): Rgb => map3(c, (v) => Math.round(clamp(v)));
const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb =>
  map3(top, (v, i) => alpha * v + (1 - alpha) * bottom[i as 0 | 1 | 2]);
const linear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (c: Rgb) => {
  const [r, g, b] = map3(c, linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const lc = (text: Rgb, background: Rgb) => Math.abs(apcaContrast(text, background));

/** Filter Effects `saturate()` in sRGB, as Chromium applies it. */
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

/** OKLCH chroma of an 8-bit colour. */
function chroma(c: Rgb): number {
  const [r, g, b] = map3(c, linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
  return Math.hypot(a, bb);
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const TIERS = ['chip', 'bar', 'panel', 'menu', 'sheet', 'lit'] as const;

/** The alphas of the Glass setting the app starts in (Clear), whose values are the theme's. */
const alphaOf = (scoped: Map<string, string>, tier: (typeof TIERS)[number]) =>
  Number(resolve(scoped, `--glass-${tier}-alpha`));

/** A tier as rendered over a uniform backdrop. */
function glass(scoped: Map<string, string>, tier: (typeof TIERS)[number], backdrop: Rgb): Rgb {
  const tint = parse(
    resolve(scoped, `--glass-${tier}-tint`).replace(
      /var\((--[\w-]+)\)/g,
      (_, name: string) => scoped.get(name) ?? '1',
    ),
  );
  return round8(
    over(tint.rgb, tint.alpha, applyFilter(resolve(scoped, `--glass-${tier}-filter`), backdrop)),
  );
}

const colour = (scoped: Map<string, string>, name: string): Rgb => parse(resolve(scoped, name)).rgb;

/** The backdrop a tier is worst over: black under the light theme's ink, white under the dark's. */
const WORST: Record<Theme, Rgb> = { light: BLACK, dark: WHITE };
/** Lit glass is never over a page: its worst is the aurora's brightest pixel under it (lemon). */
const LEMON: Rgb = [0xc8, 0xbe, 0x34];
const worstOf = (theme: Theme, tier: (typeof TIERS)[number]): Rgb =>
  tier === 'lit' && theme === 'dark' ? LEMON : WORST[theme];

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;
/** language.md §1.2: ratios are quoted to two places, so a pair holds at its value − 0.005. */
const atLeast = (value: number, minimum: number, label: string) =>
  expect(value, label).toBeGreaterThanOrEqual(minimum - 0.005);

describe('fener.css (DSN-88)', () => {
  describe('with the flag off nothing applies', () => {
    it('keys every rule on [data-fener]: no name exists with the flag off', () => {
      const selectors = [...fener.matchAll(/([^{}@]+)\{/g)].map((m) =>
        (m[1] ?? '').replace(/\s+/g, ' ').trim(),
      );
      expect(selectors.length).toBeGreaterThan(20);
      for (const selector of selectors) {
        if (selector.startsWith('media ')) continue;
        expect(selector, selector).toMatch(/\[data-fener\]/);
      }
    });

    it('leaves today’s tokens at their values (Fener off resolves to tokens.css alone)', () => {
      for (const theme of THEMES) {
        const today = scope(theme, null);
        expect(resolve(today, '--accent-fill')).toBe(theme === 'dark' ? '#c8fb3d' : '#c8fb3d');
        expect(resolve(today, '--primary-fill')).toBe('#c8fb3d');
        expect(resolve(today, '--accent-hover')).toBe(theme === 'dark' ? '#ddff82' : '#ddff82');
      }
    });

    it('is a plain, solid fill: no gradient anywhere but the background glow’s lights', () => {
      expect(fener).not.toMatch(/gradient\(/);
    });
  });

  describe.each(THEMES)('the %s theme', (theme) => {
    it('shares what the presets share and gives each the same set of own names', () => {
      const names = (preset: Preset) =>
        [
          ...block(
            fener,
            `[data-fener]:where([data-theme='${theme}'][data-accent='${preset}'])`,
          ).keys(),
        ].sort();
      const [first, ...rest] = PRESETS.map(names);
      for (const other of rest) expect(other).toEqual(first);
      const shared = block(fener, `[data-fener]:where([data-theme='${theme}'])`);
      for (const name of first ?? [])
        expect(shared.has(name), `${name} is shared and own`).toBe(false);
    });

    it('keeps large glass and the neutrals neutral: the theme hue is at most C 0.004 light, 0.014 dark', () => {
      const ceiling = theme === 'light' ? 0.004 : 0.014;
      for (const preset of PRESETS) {
        const scoped = scope(theme, preset);
        for (const tier of TIERS) {
          const tint = parse(resolve(scoped, `--glass-${tier}-tint`).replace(/var\([^)]*\)/g, '1'));
          // 8-bit channels cannot hold C exactly: a hundredth of a step of slack.
          expect(chroma(tint.rgb), `${preset} ${tier} tint`).toBeLessThanOrEqual(ceiling + 0.002);
        }
        // The cool graphite of the neutrals and the canvas: one ramp for every preset (no theme
        // hue in it), its chroma at most 0.02 (n11 in the light theme, the largest measured).
        for (const name of [...Array.from({ length: 12 }, (_, i) => `--n${i + 1}`), '--canvas']) {
          expect(chroma(colour(scoped, name)), `${preset} ${name}`).toBeLessThanOrEqual(0.02);
          expect(colour(scoped, name), `${name} is the same in every preset`).toEqual(
            colour(scope(theme, 'indigo'), name),
          );
        }
      }
    });

    describe.each(PRESETS)('%s', (preset) => {
      const scoped = scope(theme, preset);
      const fill = () => colour(scoped, '--primary-fill');
      const canvas = () => colour(scoped, '--canvas');

      it('fills the primary button and Done with white type: AA and APCA Lc 75 (A-4)', () => {
        const ink = colour(scoped, '--primary-ink');
        expect(ink).toEqual(WHITE);
        atLeast(contrast(ink, fill()), AA_TEXT, 'white on the fill');
        expect(lc(ink, fill())).toBeGreaterThanOrEqual(75);
      });

      it('holds white type 4.5:1 on the fill as drawn: the 94 % mix over the lightest glass beneath', () => {
        const mix = Number.parseFloat(
          block(fener, ':root[data-fener]').get('--fener-fill-mix') ?? '',
        );
        expect(mix).toBe(94);
        // The button is drawn at 94 % over what is under it: the lightest of that is a glass tier
        // over a white page (and white itself, for a page-coloured capsule).
        const beneath: readonly (readonly [string, Rgb])[] = [
          // Only the light theme draws it on a bare light capsule; the dark theme's is on glass.
          ...(theme === 'light' ? ([['white', WHITE]] as const) : []),
          ...TIERS.map((tier) => [`${tier} over white`, glass(scoped, tier, WHITE)] as const),
        ];
        for (const [name, backdrop] of beneath) {
          const drawn = round8(over(fill(), mix / 100, backdrop));
          atLeast(contrast(WHITE, drawn), AA_TEXT, `white on the fill over ${name}`);
          expect(lc(WHITE, drawn), `Lc over ${name}`).toBeGreaterThanOrEqual(70);
        }
      });

      it('never lightens the fill on hover or press (white type would fall under 4.5:1)', () => {
        for (const name of [
          '--primary-fill-hover',
          '--primary-fill-pressed',
          '--accent-hover',
          '--accent-pressed',
        ]) {
          expect(colour(scoped, name), name).toEqual(fill());
        }
        expect(colour(scoped, '--accent-fill')).toEqual(fill());
        expect(colour(scoped, '--theme-fill')).toEqual(fill());
        expect(colour(scoped, '--accent-on-fill')).toEqual(WHITE);
      });

      it('holds the fill as a graphic against the canvas (3:1) and the slider fill', () => {
        atLeast(contrast(fill(), canvas()), AA_NON_TEXT, 'fill on the canvas');
        expect(colour(scoped, '--control-range')).toEqual(fill());
      });

      it('lights the rim off the fill: a lighter, hue-shifted edge', () => {
        const rim = colour(scoped, '--theme-rim');
        expect(luminance(rim)).toBeGreaterThan(luminance(fill()));
        const bloom = parse(resolve(scoped, '--theme-bloom'));
        expect(bloom.alpha).toBe(theme === 'light' ? 0.45 : 0.55);
        expect(bloom.rgb).toEqual(fill());
        const hover = parse(resolve(scoped, '--theme-bloom-hover'));
        expect(hover.alpha).toBeGreaterThan(bloom.alpha);
      });

      it('sets rare coloured type AA on the tinted glass over the canvas, and over the worst page in the dark', () => {
        const text = colour(scoped, '--accent-text');
        const tier = 'bar' as const;
        atLeast(contrast(text, glass(scoped, tier, canvas())), AA_TEXT, 'accent type on the bar');
        const worst = glass(scoped, tier, WORST[theme]);
        // Coloured type is 13 px at 500 and up in the dark theme (DSN-88): AA over the white page
        // too. In the light theme it is not used over glass at the worst; the graphic floor holds.
        atLeast(
          contrast(text, worst),
          theme === 'dark' ? AA_TEXT : AA_NON_TEXT,
          'accent type, worst page',
        );
        atLeast(contrast(text, colour(scoped, '--n3')), AA_TEXT, 'accent type on the frame');
      });

      it('keeps primary and secondary text AA on every tinted tier over its worst page', () => {
        for (const tier of TIERS) {
          const surface = glass(scoped, tier, worstOf(theme, tier));
          atLeast(contrast(colour(scoped, '--n12'), surface), AA_TEXT, `${tier}: primary`);
          atLeast(contrast(colour(scoped, '--n11'), surface), AA_TEXT, `${tier}: secondary`);
          expect(alphaOf(scoped, tier)).toBeGreaterThan(0.5);
        }
      });

      it('marks page selection in the theme colour: ≥ 4.5:1 on white, and the ring holds 3:1', () => {
        const select = colour(scoped, '--select');
        atLeast(contrast(select, WHITE), AA_TEXT, 'select on the page');
        const ring = colour(scoped, '--accent-ring');
        const line = colour(scoped, '--accent-line');
        expect(ring).toEqual(line);
        atLeast(contrast(ring, canvas()), AA_NON_TEXT, 'ring on the canvas');
        if (theme === 'light') expect(ring).toEqual(fill());
      });

      it('draws the focus ring ink · theme colour · ink: every adjacent pair 3:1 or more, over every surface', () => {
        const ink = colour(scoped, '--focus-dark');
        const mid = colour(scoped, '--focus-light');
        const onFill = colour(scoped, '--focus-on-fill');
        expect(ink).toEqual([0x08, 0x09, 0x0c]);
        // The theme colour: the fill in the light theme, the lighter ring colour in the dark.
        expect(mid).toEqual(theme === 'light' ? fill() : colour(scoped, '--accent-ring'));
        atLeast(contrast(ink, mid), AA_NON_TEXT, 'ink next to the theme colour');
        // On a control the theme colour fills the middle band is white (near-white in the dark).
        expect(onFill).toEqual(theme === 'light' ? WHITE : [0xf4, 0xf6, 0xff]);
        atLeast(contrast(ink, onFill), AA_NON_TEXT, 'ink next to the middle band on a fill');
        atLeast(contrast(ink, fill()), AA_NON_TEXT, 'the inner ink band beside a filled control');
        const surfaces: readonly (readonly [string, Rgb])[] = [
          ['white page', WHITE],
          ['black page', BLACK],
          ['canvas', canvas()],
          ['frame', colour(scoped, '--n3')],
          ['raised', colour(scoped, '--n4')],
          ['yellow tint', [0xf3, 0xd9, 0x33]],
          ['mid grey', [0x80, 0x80, 0x80]],
          ...TIERS.flatMap((tier) =>
            [WHITE, BLACK, canvas()].map(
              (under, i) =>
                [
                  `${tier} over ${['white', 'black', 'the canvas'][i]}`,
                  glass(scoped, tier, under),
                ] as const,
            ),
          ),
        ];
        for (const [name, surface] of surfaces) {
          // The outer band meets the surface: ink or, on the dark ones, the theme colour's
          // neighbour; either way one band of the ring clears 3:1 against it.
          atLeast(
            Math.max(contrast(ink, surface), contrast(mid, surface)),
            AA_NON_TEXT,
            `ring over ${name}`,
          );
          atLeast(
            Math.max(contrast(ink, surface), contrast(onFill, surface)),
            AA_NON_TEXT,
            `ring on a fill over ${name}`,
          );
        }
      });

      it('keeps the green spark for "on": ink on it 10:1 (7:1 on hover and press), in both themes', () => {
        const spark = colour(scoped, '--tool-active-fill');
        expect(spark).toEqual([0x3f, 0xdd, 0x62]);
        expect(colour(scoped, '--check-badge-fill')).toEqual(spark);
        const ink = colour(scoped, '--tool-active-ink');
        expect(ink).toEqual([0x07, 0x13, 0x0b]);
        expect(colour(scoped, '--check-badge-ink')).toEqual(ink);
        atLeast(contrast(ink, spark), 10, 'ink on the spark');
        for (const name of ['--tool-active-fill-hover', '--tool-active-fill-pressed']) {
          atLeast(contrast(ink, colour(scoped, name)), 7, name);
        }
        // Against the dark tiers over a white page the spark is a graphic ≥ 3:1; on the light
        // glass it needs its ink edge (--fener-spark-edge), asserted below.
        if (theme === 'dark') {
          for (const tier of TIERS) {
            atLeast(contrast(spark, glass(scoped, tier, worstOf(theme, tier))), AA_NON_TEXT, tier);
          }
        }
      });

      it('keeps the status colours AA beside their glyphs on every surface of the ladder', () => {
        // The pairs of tokens.test.ts: not on n5, the on-state fill, which carries no status line.
        for (const status of ['--danger', '--warning', '--success']) {
          for (const surface of [
            '--canvas',
            '--surface-frame',
            '--surface-raised',
            '--surface-sunken',
          ]) {
            atLeast(
              contrast(colour(scoped, status), colour(scoped, surface)),
              AA_TEXT,
              `${status} on ${surface}`,
            );
          }
        }
        // On the tinted bar over the canvas the glass steps hold too (light: the glass variants).
        for (const [name, glassName] of [
          ['--danger', '--glass-danger'],
          ['--warning', '--glass-warning'],
          ['--success', '--glass-success'],
        ] as const) {
          const token = theme === 'light' ? glassName : name;
          atLeast(
            contrast(colour(scoped, token), glass(scoped, 'bar', canvas())),
            AA_TEXT,
            `${token} on the bar over the canvas`,
          );
        }
      });

      it('draws the background glow from the theme colour, then sky, then green', () => {
        const hue = (c: Rgb) => {
          const [r, g, b] = c;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const d = max - min;
          if (d === 0) return 0;
          const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
          return (h * 60 + 360) % 360;
        };
        const theme1 = colour(scoped, '--aura-mint');
        const sky = colour(scoped, '--aura-lime');
        const green = colour(scoped, '--aura-yellow');
        // Theme colour: blue to violet; sky: cyan-blue; green: 110–150°.
        expect(hue(theme1)).toBeGreaterThanOrEqual(200);
        expect(hue(theme1)).toBeLessThanOrEqual(290);
        expect(hue(sky)).toBeGreaterThanOrEqual(185);
        expect(hue(sky)).toBeLessThanOrEqual(215);
        expect(hue(green)).toBeGreaterThanOrEqual(110);
        expect(hue(green)).toBeLessThanOrEqual(150);
        expect(colour(scoped, '--aurora-teal')).toEqual(theme1);
      });
    });
  });

  it('draws the inset and field forms with the outer ink band too (ink 2 · theme 2 · ink 2)', () => {
    expect(fener).toContain(
      '--focus-shadow-inset: inset 0 0 0 4px var(--focus-dark), 0 0 0 2px var(--focus-dark);',
    );
    expect(block(fener, ":root[data-fener][data-theme='light']").get('--focus-field-shadow')).toBe(
      'var(--focus-shadow-outset)',
    );
    expect(block(fener, ":root[data-fener][data-theme='dark']").get('--focus-field-shadow')).toBe(
      'var(--focus-shadow-inset)',
    );
    // focus.css reads the token itself: Fener restates no component's ring.
    expect(fener).not.toMatch(/:focus-visible \{\s*box-shadow/);
    expect(fener).toMatch(
      /\.btn-prominent, \[data-markup-done\]\)[^{]*:focus-visible \{\s*--focus-light: var\(--focus-on-fill\);/,
    );
  });

  it('deepens Mor and Mavi in the light theme so white type holds (#783cee, #0a6ab5)', () => {
    const light = (preset: Preset) => scope('light', preset);
    for (const [preset, hex] of [
      ['indigo', '#4650fb'],
      ['violet', '#783cee'],
      ['blue', '#0a6ab5'],
    ] as const) {
      // Çivit keeps its own selection blue (#4c5cf8); Mor and Mavi's selection is the fill.
      for (const name of [
        '--accent',
        '--accent-fill',
        '--primary-fill',
        '--theme-fill',
        '--control-range',
        ...(preset === 'indigo' ? [] : ['--select']),
      ]) {
        expect(resolve(light(preset), name), `${preset} ${name}`).toBe(hex);
      }
    }
    // The dark theme keeps the lab's fills.
    expect(resolve(scope('dark', 'violet'), '--primary-fill')).toBe('#844afb');
    expect(resolve(scope('dark', 'blue'), '--primary-fill')).toBe('#0d77ca');
  });

  it('keeps today’s scrim in the light theme', () => {
    expect(block(fener, "[data-fener]:where([data-theme='light'])").has('--scrim')).toBe(false);
    expect(block(fener, "[data-fener]:where([data-theme='dark'])").has('--scrim')).toBe(false);
  });

  it('lights the spark’s edge on the armed tool (the fill alone is 1.75:1 on light glass)', () => {
    expect(block(fener, ':root[data-fener]').get('--fener-spark-edge')).toMatch(
      /rgb\(7 19 11 \/ 0\.14\)/,
    );
  });

  it('lights the edge and the glow on hover, and presses with Recto’s sink (no lift)', () => {
    const root = block(fener, ':root[data-fener]');
    expect(root.get('--fener-fill-mix')).toBe('94%');
    expect(root.get('--fener-backdrop')).toMatch(/^blur\(12px\)/);
    expect(root.get('--fener-edge-hover')).toMatch(/--theme-bloom-hover/);
    expect(root.get('--fener-edge-pressed')).toMatch(/inset 0 2px 6px/);
    // The fill is the one declared background; hover and press never set another.
    const rules = [...fener.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter(([, selector]) =>
      (selector ?? '').includes('btn-prominent'),
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const [, selector, body] of rules) {
      if (/:hover|:active|data-popup-open/.test(selector ?? '')) {
        expect(body, selector).not.toMatch(/background|transform|scale\(/);
      }
    }
    expect(fener).not.toMatch(/1\.13/);
  });

  it('turns the tinted glass opaque, with no glow, under Solid, more contrast and forced colours', () => {
    expect(block(fener, ":root[data-fener][data-glass='solid']").get('--fener-fill-mix')).toBe(
      '100%',
    );
    expect(fener).toMatch(
      /@media \(prefers-reduced-transparency: reduce\)\s*\{\s*:root\[data-fener\]\s*\{\s*--fener-fill-mix: 100%/,
    );
    const contrastMore =
      /@media \(prefers-contrast: more\), \(forced-colors: active\)\s*\{([\s\S]*?)\n\}/.exec(
        fener,
      )?.[1] ?? '';
    for (const name of [
      '--fener-edge',
      '--fener-edge-hover',
      '--fener-edge-pressed',
      '--fener-spark-edge',
    ]) {
      expect(contrastMore, name).toContain(`${name}: 0 0 #0000`);
    }
    // The three media blocks that make glass solid are restated above Fener's tints.
    expect(fener).toMatch(
      /@media \(prefers-reduced-transparency: reduce\), \(prefers-contrast: more\)\s*\{\s*:root\[data-fener\]\s*\{\s*--glass-chip-tint: var\(--glass-chip-solid\)/,
    );
    expect(fener).toMatch(
      /@media \(forced-colors: active\)\s*\{\s*:root\[data-fener\]\s*\{\s*--glass-chip-tint: Canvas/,
    );
  });

  it('dims the glow behind the reader: 30 % in the light theme, 50 % in the dark, bold on the Library', () => {
    const aura = strip(auraCss);
    // The reader's opacities (Solid keeps its own).
    expect(aura).toMatch(
      /:root\[data-fener\]\[data-theme='light'\]:not\(\[data-glass='solid'\]\)\)\s*\.aura\[data-tone='reader'\]\s*\{\s*opacity: 0\.3;/,
    );
    expect(aura).toMatch(
      /:root\[data-fener\]\[data-theme='dark'\]:not\(\[data-glass='solid'\]\)\)\s*\.aura\[data-tone='reader'\]\s*\{\s*opacity: 0\.5;/,
    );
    const peaks = (theme: Theme) =>
      declarationsOf(aura, `:global(:root[data-fener][data-theme='${theme}']) .aura`);
    expect(Object.fromEntries(peaks('light'))).toEqual({
      '--aura-peak-mint': '0.62',
      '--aura-peak-lime': '0.42',
      '--aura-peak-yellow': '0.4',
      '--aura-peak-glint': '0.3',
      '--aura-peak-low': '0.45',
    });
    expect(Object.fromEntries(peaks('dark'))).toEqual({
      '--aura-peak-mint': '0.4',
      '--aura-peak-lime': '0.2',
      '--aura-peak-yellow': '0.14',
      '--aura-peak-glint': '0.12',
      '--aura-peak-low': '0.24',
    });
  });
});

/** The declarations of the rule whose selector is `selector`, verbatim. */
function declarationsOf(css: string, selector: string): Map<string, string> {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no rule for ${selector}`);
  const end = css.indexOf('}', at);
  return declarations(css.slice(css.indexOf('{', at) + 1, end));
}
