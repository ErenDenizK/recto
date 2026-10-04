/**
 * Contrast and structure of the design tokens (docs/specs/experience-redesign.md §7.1–§7.3, §11;
 * docs/specs/craft.md §7 for the three glass tiers; DESIGN.md §3; docs/specs/redesign.md D0-1 for
 * the coverage registry, the page's selection blue and the focus bands). The test reads the real `tokens.css` and `global.css`, resolves `var()`
 * references and computes WCAG 2.2 contrast ratios, so a token change that breaks a ratio fails
 * here rather than in a screenshot review.
 *
 * Glass is modelled the way the translucency audit measured it (docs/design/audit/
 * translucency.md §6): over a uniform backdrop the blur changes nothing, so the rendered glass
 * is `tint · a + clamp(brightness · saturate(backdrop)) · (1 − a)` per sRGB channel, rounded to
 * 8 bits as the compositor writes it. Uniform backdrops are the worst cases: a large white area
 * stays white under any blur.
 */
import { describe, expect, it } from 'vitest';

import { TINT } from '../annotations/palette';
import { COVERAGE_REGISTRY, type GlassComposition } from './coverage-registry';
import focusCss from './focus.css?raw';
import globalCss from './global.css?raw';
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

/** The dark theme: `:root, [data-theme='dark'] { … }`. */
const rootBlock = /:root,\s*\[data-theme='dark'\]\s*\{([^{}]*)\}/.exec(tokensSource)?.[1] ?? '';
const root = declarations(rootBlock);

/** The `:root` overrides inside `@media (<query>)`. */
function mediaOverrides(query: string): Map<string, string> {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = new RegExp(`@media \\(${escaped}\\)\\s*\\{\\s*:root\\s*\\{([^{}]*)\\}`).exec(
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

const literal = (hex: string): Rgb => parseColour(hex).rgb;

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

function relativeLuminance(c: Rgb): number {
  const [r, g, b] = map3(c, (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
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

/** CIE L* (D65), which shows dark steps better than the WCAG ratio. */
function lightness(c: Rgb): number {
  const y = relativeLuminance(c);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (y * 24389) / 27;
}

/** The filter functions of a tier's filter token that change a uniform backdrop. */
function glassFilter(token = '--glass-filter'): { saturate: number; brightness: number } {
  const filter = resolve(token);
  const amount = (fn: string) => {
    const match = new RegExp(`${fn}\\(([\\d.]+)\\)`).exec(filter);
    return match?.[1] === undefined ? 1 : Number(match[1]);
  };
  return { saturate: amount('saturate'), brightness: amount('brightness') };
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

/** A glass tier: its tint, filter and opaque fallback tokens. */
interface Tier {
  readonly tint: string;
  readonly filter: string;
  readonly solid: string;
}

const TIER_1: Tier = { tint: '--glass', filter: '--glass-filter', solid: '--glass-solid' };
const TIER_2: Tier = {
  tint: '--glass-frame',
  filter: '--glass-frame-filter',
  solid: '--glass-frame-solid',
};
const TIER_3: Tier = {
  tint: '--glass-menu',
  filter: '--glass-menu-filter',
  solid: '--glass-menu-solid',
};

/** A tier as rendered over a uniform backdrop. */
function tierOver(tier: Tier, backdrop: Rgb): Rgb {
  const tint = parseColour(resolve(tier.tint));
  const { saturate: s, brightness: k } = glassFilter(tier.filter);
  const filtered = map3(saturate(backdrop, s), (v) => clamp(v * k));
  return round8(over(tint.rgb, tint.alpha, filtered));
}

/** The floating glass (tier 1) as rendered over a uniform backdrop. */
const glassOver = (backdrop: Rgb): Rgb => tierOver(TIER_1, backdrop);

const SURFACES = ['--surface-0', '--surface-1', '--surface-2', '--surface-3'] as const;
const BODY_TEXT = [
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--accent',
  '--danger',
  '--success',
  '--warning',
] as const;
/** Text colours used on glass: the scoped remap in global.css (.glass). */
const GLASS_TEXT = [
  '--text-primary',
  '--glass-text-secondary',
  '--glass-danger',
  '--warning',
] as const;

const canvas = () => colour('--surface-0');
const scrim = () => parseColour(resolve('--scrim'));

/** Uniform backdrops behind floating chrome; white is the worst case for light text. */
const BACKDROPS: readonly (readonly [string, () => Rgb])[] = [
  ['white page', () => literal('#ffffff')],
  ['yellow figure', () => literal('#f3d933')],
  ['mid grey', () => literal('#808080')],
  ['saturated blue', () => literal('#2a6fd6')],
  ['black page', () => literal('#000000')],
  ['app canvas', canvas],
  [
    'white page under the palette scrim',
    () => round8(over(scrim().rgb, scrim().alpha, literal('#ffffff'))),
  ],
];

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe('tokens.css', () => {
  it('parses the dark theme', () => {
    expect(root.size).toBeGreaterThan(60);
  });

  it('keeps every token name and adds the M6 ones', () => {
    const names = [
      // The ladder and glass of the refinement pass (names never change).
      ...SURFACES,
      '--surface-hover',
      '--surface-active',
      '--glass',
      '--glass-filter',
      '--glass-solid',
      '--scrim',
      '--border-hairline',
      '--border-strong',
      '--border-glass',
      '--border-swatch',
      '--text-primary',
      '--text-secondary',
      '--text-tertiary',
      '--text-disabled',
      '--glass-text-secondary',
      '--glass-text-disabled',
      '--glass-danger',
      '--accent',
      '--accent-hover',
      '--accent-pressed',
      '--accent-subtle',
      '--accent-muted',
      '--accent-line',
      '--accent-highlight',
      '--accent-highlight-strong',
      '--page-shadow',
      '--radius-page',
      '--radius-1',
      '--radius-2',
      '--radius-3',
      '--radius-round',
      '--duration-instant',
      '--duration-fast',
      '--duration-base',
      '--ease-out',
      '--enter-scale',
      // M6 (experience-redesign §7.2–§7.5).
      '--elevation-float',
      '--tool-active-fill',
      '--tool-active-ink',
      '--radius-capsule',
      '--rise-distance',
      '--motion-rise',
      // M8 (craft §7): tiers 2 and 3.
      '--glass-frame',
      '--glass-frame-filter',
      '--glass-frame-solid',
      '--glass-frame-highlight',
      '--glass-menu',
      '--glass-menu-filter',
      '--glass-menu-solid',
      // M9 D0-1 (redesign §11.1): the one-row menu's blur, the selection blue, the focus bands.
      '--glass-menu-short-filter',
      '--select',
      '--select-subtle',
      '--select-muted',
      '--select-wash',
      '--select-wash-strong',
      '--focus-light',
      '--focus-dark',
      '--focus-offset-out',
      '--focus-offset-in',
      '--focus-offset-gap',
    ];
    for (const name of names) expect(root.has(name), name).toBe(true);
  });

  describe('surface ladder (§7.1)', () => {
    it('steps up from the canvas, with the canvas-to-panel step visible (≥ 1.14:1, L* ≥ 6)', () => {
      const [s0, s1, s2, s3] = SURFACES.map(colour) as [Rgb, Rgb, Rgb, Rgb];
      expect(contrast(s0, s1)).toBeGreaterThanOrEqual(1.14);
      expect(lightness(s1) - lightness(s0)).toBeGreaterThanOrEqual(6);
      expect(contrast(s1, s2)).toBeGreaterThanOrEqual(1.085);
      expect(contrast(s2, s3)).toBeGreaterThanOrEqual(1.105);
      expect(lightness(s0)).toBeLessThan(lightness(s1));
      expect(lightness(s1)).toBeLessThan(lightness(s2));
      expect(lightness(s2)).toBeLessThan(lightness(s3));
    });

    it('keeps the page the brightest thing (white page vs canvas ≥ 19.9:1)', () => {
      expect(contrast(colour('--page-background'), canvas())).toBeGreaterThanOrEqual(19.895);
    });

    it.each(BODY_TEXT)('%s is AA body text on every surface', (text) => {
      for (const surface of SURFACES) {
        expect(
          contrast(colour(text), colour(surface)),
          `${text} on ${surface}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it('meets the minima the spec lists (primary 11.6, secondary 5.35, tertiary 4.71, accent 4.83, danger 5.18)', () => {
      const minimum = (text: string) =>
        Math.min(...SURFACES.map((surface) => contrast(colour(text), colour(surface))));
      expect(minimum('--text-primary')).toBeGreaterThanOrEqual(11.595);
      expect(minimum('--text-secondary')).toBeGreaterThanOrEqual(5.345);
      expect(minimum('--text-tertiary')).toBeGreaterThanOrEqual(4.705);
      expect(minimum('--accent')).toBeGreaterThanOrEqual(4.825);
      expect(minimum('--danger')).toBeGreaterThanOrEqual(5.175);
    });

    it('keeps secondary and tertiary text AA on hovered and current rows of a panel', () => {
      const panel = colour('--surface-1');
      for (const wash of ['--surface-hover', '--surface-active']) {
        const fill = parseColour(resolve(wash));
        const row = round8(over(fill.rgb, fill.alpha, panel));
        for (const text of ['--text-secondary', '--text-tertiary']) {
          expect(contrast(colour(text), row), `${text} on ${wash}`).toBeGreaterThanOrEqual(AA_TEXT);
        }
      }
    });

    it('keeps the accent (focus ring, UI) at ≥ 3:1 on every surface', () => {
      for (const surface of SURFACES) {
        expect(contrast(colour('--accent'), colour(surface))).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    });

    it('keeps the primary button label AA in all three states', () => {
      for (const fill of ['--accent', '--accent-hover', '--accent-pressed']) {
        expect(contrast(colour('--surface-0'), colour(fill)), fill).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  });

  describe('glass and elevation (§7.2)', () => {
    // M6 review (A4): the backdrop is darkened less (0.36 -> 0.45), so the bar over a white page
    // reads as glass (#47494d, was #3f4145) rather than a slab; over the canvas nothing changes.
    it('models the composites: #47494d over a white page, #212328 over the canvas', () => {
      expect(glassOver(literal('#ffffff'))).toEqual(literal('#47494d'));
      expect(glassOver(canvas())).toEqual(literal('#212328'));
    });

    it('lets the bar read over the canvas (≥ 1.27:1, against 1.03:1 before M6)', () => {
      expect(contrast(glassOver(canvas()), canvas())).toBeGreaterThanOrEqual(1.265);
    });

    it.each(BACKDROPS)('keeps glass text AA over a %s', (_, backdrop) => {
      const glass = glassOver(backdrop());
      for (const text of GLASS_TEXT) {
        expect(contrast(colour(text), glass), text).toBeGreaterThanOrEqual(AA_TEXT);
      }
      expect(contrast(colour('--accent'), glass), 'focus ring').toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it('meets the white-page numbers (primary 7.30, secondary 4.94, danger 4.63, warning 5.54)', () => {
      const glass = glassOver(literal('#ffffff'));
      expect(contrast(colour('--text-primary'), glass)).toBeGreaterThanOrEqual(7.29);
      expect(contrast(colour('--glass-text-secondary'), glass)).toBeGreaterThanOrEqual(4.93);
      expect(contrast(colour('--glass-danger'), glass)).toBeGreaterThanOrEqual(4.63);
      expect(contrast(colour('--warning'), glass)).toBeGreaterThanOrEqual(5.535);
    });

    it('lifts the bar over a white page (9.0:1 to the page, against 10.2:1 at brightness 0.36)', () => {
      expect(glassFilter().brightness).toBe(0.45);
      expect(contrast(glassOver(literal('#ffffff')), literal('#ffffff'))).toBeLessThan(9.05);
    });

    it('keeps the opaque fallback on the raised surface', () => {
      expect(resolve('--glass-solid')).toBe(resolve('--surface-2'));
      for (const text of GLASS_TEXT) {
        expect(contrast(colour(text), colour('--glass-solid')), text).toBeGreaterThanOrEqual(
          AA_TEXT,
        );
      }
    });

    it('defines one elevation: inner top highlight, hairline ring, one soft shadow', () => {
      const layers = splitLayers(resolve('--elevation-float'));
      expect(layers).toHaveLength(3);
      expect(layers[0]?.trim()).toMatch(/^inset 0 1px 0 /);
      expect(layers[1]?.trim()).toMatch(/^0 0 0 1px /);
      expect(layers[2]?.trim()).toMatch(/^0 \d+px \d+px -?\d+px /);
    });

    it('drops the elevation for more contrast and forced colours, keeps it for reduced transparency', () => {
      expect(mediaOverrides('prefers-contrast: more').get('--elevation-float')).toBe('none');
      expect(mediaOverrides('forced-colors: active').get('--elevation-float')).toBe('none');
      expect(mediaOverrides('prefers-reduced-transparency: reduce').has('--elevation-float')).toBe(
        false,
      );
    });

    it('applies the elevation through the one global .glass rule', () => {
      const css = stripComments(globalCss);
      expect(css.match(/var\(--elevation-float\)/g)).toHaveLength(1);
      const glassRule = /\.glass\s*\{([^{}]*)\}/.exec(css)?.[1] ?? '';
      expect(glassRule).toMatch(/box-shadow:\s*var\(--elevation-float\)/);
    });

    it('uses no other drop shadow in component styles (rings and insets only)', () => {
      const modules = import.meta.glob<string>('../**/*.module.css', {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      expect(Object.keys(modules).length).toBeGreaterThan(20);
      for (const [file, source] of Object.entries(modules)) {
        const css = stripComments(source);
        expect(css.includes('--elevation-float'), `${file} reads --elevation-float`).toBe(false);
        for (const match of css.matchAll(/box-shadow:\s*([^;}]+)/g)) {
          const value = (match[1] ?? '').trim();
          if (value === 'none' || /^var\(--[\w-]+\)$/.test(value)) continue;
          for (const layer of splitLayers(value)) {
            // `[inset] 0 0 <blur> <spread> colour`: no offset and no blur, only a ring.
            const lengths =
              /^(?:inset\s+)?(-?[\d.]+(?:px)?)\s+(-?[\d.]+(?:px)?)\s+(-?[\d.]+(?:px)?)/.exec(
                layer.trim(),
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
  });

  describe('three glass tiers (craft §7)', () => {
    const TIERS: readonly (readonly [string, Tier])[] = [
      ['1 floating', TIER_1],
      ['2 docked frame', TIER_2],
      ['3 menus and popovers', TIER_3],
    ];
    /** The four backdrops the spec names: white, the canvas, mid grey and black. */
    const FOUR: readonly (readonly [string, () => Rgb])[] = [
      ['white', () => literal('#ffffff')],
      ['the canvas', canvas],
      ['#808080', () => literal('#808080')],
      ['black', () => literal('#000000')],
    ];
    const cases = TIERS.flatMap(([name, tier]) =>
      FOUR.map(([backdrop, rgb]) => [name, backdrop, tier, rgb] as const),
    );

    it.each(cases)(
      'tier %s over %s keeps glass text AA and the accent at 3:1',
      (_, __, tier, rgb) => {
        const glass = tierOver(tier, rgb());
        for (const text of [
          '--text-primary',
          '--glass-text-secondary',
          '--glass-danger',
          '--warning',
        ]) {
          expect(contrast(colour(text), glass), text).toBeGreaterThanOrEqual(AA_TEXT);
        }
        expect(contrast(colour('--accent'), glass), 'accent').toBeGreaterThanOrEqual(AA_NON_TEXT);
      },
    );

    it('composites tier 2 to --surface-1 over the canvas (#181a1f) and to #36373c over white', () => {
      expect(tierOver(TIER_2, canvas())).toEqual(colour('--surface-1'));
      expect(tierOver(TIER_2, canvas())).toEqual(literal('#181a1f'));
      expect(tierOver(TIER_2, canvas())).toEqual(colour('--glass-frame-solid'));
      expect(tierOver(TIER_2, literal('#ffffff'))).toEqual(literal('#36373c'));
    });

    it('composites tier 3 to #212329 over the canvas and #393c42 over white', () => {
      expect(tierOver(TIER_3, canvas())).toEqual(literal('#212329'));
      expect(tierOver(TIER_3, literal('#ffffff'))).toEqual(literal('#393c42'));
    });

    it('meets the worst-case numbers over white (tiers 1 / 2 / 3)', () => {
      const minima: readonly (readonly [string, readonly [number, number, number]])[] = [
        ['--text-primary', [7.29, 9.6, 8.94]],
        ['--glass-text-secondary', [4.93, 6.495, 6.05]],
        ['--glass-danger', [4.63, 6.095, 5.68]],
        ['--accent', [3.025, 3.985, 3.71]],
      ];
      const white = literal('#ffffff');
      for (const [text, perTier] of minima) {
        TIERS.forEach(([name, tier], i) => {
          expect(
            contrast(colour(text), tierOver(tier, white)),
            `${text} on tier ${name}`,
          ).toBeGreaterThanOrEqual(perTier[i] ?? Number.POSITIVE_INFINITY);
        });
      }
    });

    it('keeps tier 2 dense (alpha ≥ 0.78) and its fallback on --surface-1, tier 3 on the menu surface', () => {
      expect(parseColour(resolve('--glass-frame')).alpha).toBeGreaterThanOrEqual(0.78);
      expect(resolve('--glass-frame-solid')).toBe(resolve('--surface-1'));
      expect(resolve('--glass-menu-solid')).toBe(resolve('--glass-solid'));
      for (const tier of [TIER_2, TIER_3]) {
        for (const text of GLASS_TEXT) {
          expect(
            contrast(colour(text), colour(tier.solid)),
            `${text} on ${tier.solid}`,
          ).toBeGreaterThanOrEqual(AA_TEXT);
        }
      }
    });

    it('gives the docked frame no shadow: one inset 1px top highlight', () => {
      const layers = splitLayers(resolve('--glass-frame-highlight'));
      expect(layers).toHaveLength(1);
      expect(layers[0]?.trim()).toMatch(/^inset 0 1px 0 rgb\(/);
    });

    it('allows only the floating elevation and the frame highlight as shadows in global.css', () => {
      const css = stripComments(globalCss);
      const shadows = [...css.matchAll(/box-shadow:\s*([^;}]+)/g)].map((m) => (m[1] ?? '').trim());
      expect(shadows.sort()).toEqual(['var(--elevation-float)', 'var(--glass-frame-highlight)']);
      expect(css.match(/var\(--glass-frame-highlight\)/g)).toHaveLength(1);
      const frameRule =
        /:root\[data-glass-panels\] \.glass-frame\s*\{([^{}]*)\}/.exec(css)?.[1] ?? '';
      expect(frameRule).toMatch(/box-shadow:\s*var\(--glass-frame-highlight\)/);
    });

    it('paints the frame solid unless Glass panels is on, and maps its text then', () => {
      const css = stripComments(globalCss);
      const base = /(?:^|\})\s*\.glass-frame\s*\{([^{}]*)\}/.exec(css)?.[1] ?? '';
      expect(base).toMatch(/background:\s*var\(--glass-frame-solid\)/);
      expect(base).not.toMatch(/backdrop-filter/);
      const on = /:root\[data-glass-panels\] \.glass-frame\s*\{([^{}]*)\}/.exec(css)?.[1] ?? '';
      expect(on).toMatch(/--text-secondary:\s*var\(--glass-text-secondary\)/);
      expect(on).toMatch(/--text-tertiary:\s*var\(--glass-text-secondary\)/);
      expect(on).toMatch(/--danger:\s*var\(--glass-danger\)/);
      // Every frame surface blurs while the setting is on (no geometry gate, review F7), behind
      // the support check.
      const live =
        /@supports[^{]*\{\s*:root\[data-glass-panels\] \.glass-frame\s*\{([^{}]*)\}/.exec(css);
      expect(live?.[1]).toMatch(/backdrop-filter:\s*var\(--glass-frame-filter\)/);
      expect(live?.[1]).toMatch(/background:\s*var\(--glass-frame\)/);
      expect(css).not.toMatch(/data-glass-near/);
      // Filters never animate.
      expect(css).not.toMatch(/transition[^;]*(?:backdrop-filter|filter)/);
    });

    it('points menus and popovers at tier 3 through the one .glass rule', () => {
      const css = stripComments(globalCss);
      const menu = declarations(/\.glass-menu\s*\{([^{}]*)\}/.exec(css)?.[1] ?? '');
      expect(menu.get('--glass')).toBe('var(--glass-menu)');
      expect(menu.get('--glass-filter')).toBe('var(--glass-menu-filter)');
      expect(menu.get('--glass-solid')).toBe('var(--glass-menu-solid)');
      const modules = import.meta.glob<string>('../ui/{Menu,Popover}.module.css', {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      expect(Object.keys(modules)).toHaveLength(2);
      for (const [file, source] of Object.entries(modules)) {
        expect(source, file).toMatch(/composes:\s*glass glass-menu from global;/);
      }
    });

    it('makes the docked surfaces compose the frame and paint no background of their own', () => {
      const modules = import.meta.glob<string>(
        '../shell/{TabBar,LeftRail,RightPanel,StatusBar}.module.css',
        { query: '?raw', import: 'default', eager: true },
      );
      expect(Object.keys(modules)).toHaveLength(4);
      for (const [file, source] of Object.entries(modules)) {
        const css = stripComments(source);
        const root = /^\.[\w]+\s*\{([^{}]*)\}/m.exec(css)?.[1] ?? '';
        expect(root, file).toMatch(/composes:\s*glass-frame from global;/);
        expect(root, file).not.toMatch(/background:/);
      }
    });

    describe('Reduce transparency', () => {
      const attribute = declarations(
        /:root\[data-transparency='reduced'\]\s*\{([^{}]*)\}/.exec(tokensSource)?.[1] ?? '',
      );
      const media = mediaOverrides('prefers-reduced-transparency: reduce');

      it('the in-app switch sets exactly what the media query sets', () => {
        expect(attribute.size).toBeGreaterThan(0);
        expect([...attribute.entries()].sort()).toEqual([...media.entries()].sort());
      });

      it('makes every tier solid and keeps rings, shadows and the highlight', () => {
        for (const scope of [attribute, media]) {
          for (const tier of [TIER_1, TIER_2, TIER_3]) {
            expect(scope.get(tier.tint), tier.tint).toBe(`var(${tier.solid})`);
            expect(scope.get(tier.filter), tier.filter).toBe('none');
          }
          expect(scope.get('--glass-menu-short-filter')).toBe('none');
          expect(scope.has('--elevation-float')).toBe(false);
          expect(scope.has('--glass-frame-highlight')).toBe(false);
          expect(scope.has('--border-glass')).toBe(false);
        }
      });

      it('flattens every tier for more contrast and forced colours, without the highlight', () => {
        const more = mediaOverrides('prefers-contrast: more');
        for (const tier of [TIER_1, TIER_2, TIER_3]) {
          expect(more.get(tier.tint), tier.tint).toBe(`var(${tier.solid})`);
          expect(more.get(tier.filter), tier.filter).toBe('none');
        }
        expect(more.get('--glass-frame-highlight')).toBe('none');
        expect(more.get('--glass-menu-short-filter')).toBe('none');
        const forced = mediaOverrides('forced-colors: active');
        expect(forced.get('--glass-menu-short-filter')).toBe('none');
        expect(forced.get('--glass-frame')).toBe('Canvas');
        expect(forced.get('--glass-menu')).toBe('Canvas');
        expect(forced.get('--glass-frame-highlight')).toBe('none');
      });

      it('falls back to the opaque surfaces in global.css under the switch too', () => {
        const css = stripComments(globalCss);
        const glass =
          /:root\[data-transparency='reduced'\] \.glass\s*\{([^{}]*)\}/.exec(css)?.[1] ?? '';
        expect(glass).toMatch(/background:\s*var\(--glass-solid\)/);
        expect(glass).toMatch(/(?:^|[^-])backdrop-filter:\s*none/);
        expect(glass).toMatch(/--text-secondary:\s*inherit/);
        const frame =
          /:root\[data-glass-panels\]\[data-transparency='reduced'\] \.glass-frame\s*\{([^{}]*)\}/.exec(
            css,
          )?.[1] ?? '';
        expect(frame).toMatch(/background:\s*var\(--glass-frame-solid\)/);
        expect(frame).toMatch(/(?:^|[^-])backdrop-filter:\s*none/);
      });
    });
  });

  describe('capsule bar and active state (§7.3)', () => {
    it('makes the floating bar a capsule', () => {
      expect(resolve('--radius-capsule')).toBe(resolve('--radius-round'));
    });

    it('fills the armed tool with the accent and a canvas-dark icon (≥ 6.69:1)', () => {
      expect(resolve('--tool-active-fill')).toBe(resolve('--accent'));
      expect(resolve('--tool-active-ink')).toBe(resolve('--surface-0'));
      const ink = colour('--tool-active-ink');
      expect(contrast(ink, colour('--tool-active-fill'))).toBeGreaterThanOrEqual(6.685);
      for (const fill of ['--accent-hover', '--accent-pressed']) {
        expect(contrast(ink, colour(fill)), fill).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });

    it('keeps the fill ≥ 3:1 against the bar (5.28:1 over the canvas, 3.03:1 over a white page)', () => {
      const fill = colour('--tool-active-fill');
      expect(contrast(fill, glassOver(canvas()))).toBeGreaterThanOrEqual(5.275);
      expect(contrast(fill, glassOver(literal('#ffffff')))).toBeGreaterThanOrEqual(3.025);
      for (const [name, backdrop] of BACKDROPS) {
        expect(contrast(fill, glassOver(backdrop())), name).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
      expect(contrast(fill, colour('--glass-solid')), 'opaque bar').toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    });
  });

  describe('coverage registry (redesign D0-1, language.md §2.9, A-2)', () => {
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
    const blurOf = (token: string): number => {
      const match = /blur\(([\d.]+)px\)/.exec(resolve(token));
      if (!match?.[1]) throw new Error(`${token} has no blur()`);
      return Number(match[1]);
    };

    it('lowers the three blurs as the spec row says: bars 7px, menus 12px (one row 7px), frame 5px', () => {
      expect(blurOf('--glass-filter')).toBe(7);
      expect(blurOf('--glass-menu-filter')).toBe(12);
      expect(blurOf('--glass-menu-short-filter')).toBe(7);
      expect(blurOf('--glass-frame-filter')).toBe(5);
      // The rest of each chain is unchanged, so every composite above still holds.
      expect(resolve('--glass-filter')).toBe('blur(7px) saturate(1.8) brightness(0.45)');
      expect(resolve('--glass-menu-filter')).toBe('blur(12px) saturate(1.6) brightness(0.5)');
      expect(resolve('--glass-menu-short-filter')).toBe('blur(7px) saturate(1.6) brightness(0.5)');
      expect(resolve('--glass-frame-filter')).toBe('blur(5px) saturate(1.4) brightness(0.6)');
    });

    it('reproduces the language table (36 px bar at 7px 0.990, 64 px menu at 12px 0.992)', () => {
      expect(coverage(360, 36, 7)).toBeCloseTo(0.99, 3);
      expect(coverage(200, 64, 12)).toBeCloseTo(0.992, 3);
      expect(coverage(1440, 44, 8)).toBeCloseTo(0.994, 3);
      // The bar that shipped in M8, which research 22 measured leaking: 44 px at blur 28px.
      expect(coverage(436, 44, 28)).toBeLessThan(0.6);
    });

    it.each(COVERAGE_REGISTRY.map((entry) => [entry.id, entry] as const))(
      '%s meets c ≥ 0.985 at its smallest size',
      (_, entry) => {
        const sigma = blurOf(entry.filter);
        const c = coverage(entry.minWidth, entry.minHeight, sigma);
        expect(
          c,
          `${entry.surface}: ${entry.minWidth} × ${entry.minHeight} px at σ ${sigma}`,
        ).toBeGreaterThanOrEqual(0.985);
      },
    );

    it('registers each surface once, with its tier’s filter', () => {
      const ids = COVERAGE_REGISTRY.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      const filters: Record<GlassComposition, readonly string[]> = {
        glass: ['--glass-filter'],
        'glass glass-menu': ['--glass-menu-filter', '--glass-menu-short-filter'],
        'glass-frame': ['--glass-frame-filter'],
      };
      for (const entry of COVERAGE_REGISTRY) {
        expect(filters[entry.composes], entry.id).toContain(entry.filter);
        expect(entry.minWidth, entry.id).toBeGreaterThan(0);
        expect(entry.minHeight, entry.id).toBeGreaterThan(0);
      }
    });

    it('holds every module rule that composes .glass, .glass-menu or .glass-frame, and no other', () => {
      const modules = import.meta.glob<string>('../**/*.module.css', {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      const found = new Set<string>();
      for (const [file, source] of Object.entries(modules)) {
        const css = stripComments(source);
        for (const match of css.matchAll(
          /(\.[\w-]+)\s*\{\s*composes:\s*([^;]*?)\s+from global;/g,
        )) {
          const classes = (match[2] ?? '').split(/\s+/).filter((c) => c.startsWith('glass'));
          if (classes.length === 0) continue;
          found.add(`${file.replace(/^\.\.\//, '')} ${match[1]} ${classes.join(' ')}`);
        }
      }
      const registered = new Set(
        COVERAGE_REGISTRY.map((entry) => `${entry.module} ${entry.selector} ${entry.composes}`),
      );
      expect([...found].sort()).toEqual([...registered].sort());
      // The spec row counted about nineteen modules: eighteen composed glass, seventeen do now
      // (the TextLayer hint is solid: at 22 px it is under quality-bar Q-5's 32 px).
      expect(new Set(COVERAGE_REGISTRY.map((entry) => entry.module)).size).toBe(17);
    });

    it('gives a one-row menu the short blur in ui/Menu', () => {
      const modules = import.meta.glob<string>('../ui/Menu.module.css', {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      const css = stripComments(Object.values(modules)[0] ?? '');
      const rule = /\.popup:not\(:has\(> :nth-child\(2\)\)\)\s*\{([^{}]*)\}/.exec(css)?.[1] ?? '';
      expect(declarations(rule).get('--glass-filter')).toBe('var(--glass-menu-short-filter)');
    });
  });

  describe('the selection blue on the page (language.md §1.5, redesign D0-1)', () => {
    const tint = (hex: string): Rgb => literal(hex.toLowerCase());

    it('is #4e61ed, ≥ 3:1 on white and on the yellow and green highlighter tints', () => {
      expect(resolve('--select')).toBe('#4e61ed');
      const select = colour('--select');
      // language.md §1.5: 4.93 on white, 4.00 on the yellow tint, 3.53 on the green one.
      expect(contrast(select, literal('#ffffff'))).toBeGreaterThanOrEqual(4.93);
      expect(contrast(select, tint(TINT.yellow))).toBeGreaterThanOrEqual(3.995);
      expect(contrast(select, tint(TINT.green))).toBeGreaterThanOrEqual(3.525);
      for (const backdrop of [literal('#ffffff'), tint(TINT.yellow), tint(TINT.green)]) {
        expect(contrast(select, backdrop)).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    });

    it('draws its washes in the same blue', () => {
      for (const token of [
        '--select-subtle',
        '--select-muted',
        '--select-wash',
        '--select-wash-strong',
      ]) {
        const wash = parseColour(resolve(token));
        expect(wash.rgb, token).toEqual(colour('--select'));
        expect(wash.alpha, token).toBeLessThan(0.5);
      }
      expect(parseColour(resolve('--select-wash')).alpha).toBe(0.25);
      expect(parseColour(resolve('--select-wash-strong')).alpha).toBe(0.45);
    });

    /**
     * The modules that draw on the page. A few also hold chrome (the controls of a popover or a
     * panel beside the page marks), which keeps the accent until the colour step (D3): those
     * rules are listed by selector, and no other rule may use the accent.
     */
    const PAGE_LAYERS: Readonly<Record<string, readonly string[]>> = {
      'viewer/LinkLayer.module.css': [],
      'viewer/SearchHighlights.module.css': [],
      'viewer/TextLayer.module.css': [],
      'annotations/AnnotationLayer.module.css': [],
      'annotations/lasso/Lasso.module.css': [],
      'forms/FormLayer.module.css': [],
      'forms/create/CreatedFields.module.css': [
        '.check input',
        ".segment[aria-checked='true']",
        ".swatch[aria-checked='true']",
      ],
      'image-objects/ImageObjects.module.css': [],
      'text-edit/TextEdit.module.css': [".choice[aria-pressed='true']"],
      'text-edit/ParagraphEditor.module.css': ['.action[data-default]'],
      'crop/Crop.module.css': [],
      'stage/ReadView.module.css': [],
      'furniture/FurnitureLayer.module.css': [],
      'ocr/Ocr.module.css': ['.language input', '.switch input', ".rowButton[aria-current='true']"],
      'compare/CompareView.module.css': [
        '.dropZone[data-active]',
        ".stripCell[aria-current='true']",
        ".segment[aria-checked='true']",
      ],
    };

    it('leaves no #7c8cff or --accent in the page layers', () => {
      const modules = import.meta.glob<string>('../**/*.module.css', {
        query: '?raw',
        import: 'default',
        eager: true,
      });
      for (const [file, chrome] of Object.entries(PAGE_LAYERS)) {
        const source = modules[`../${file}`];
        expect(source, file).toBeDefined();
        const css = stripComments(source ?? '');
        expect(css, file).not.toMatch(/#7c8cff|124\s+140\s+255/i);
        for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
          if (!(match[2] ?? '').includes('--accent')) continue;
          const selector = (match[1] ?? '').trim().replace(/\s+/g, ' ');
          expect(chrome, `${file}: ${selector} uses the accent on the page`).toContain(selector);
        }
      }
    });

    it('paints the page-layer canvases (paragraph editor, compare heat map) in it too', () => {
      const sources = import.meta.glob<string>(
        ['../text-edit/ParagraphEditor.tsx', '../compare/compare-runner.ts'],
        { query: '?raw', import: 'default', eager: true },
      );
      expect(Object.keys(sources)).toHaveLength(2);
      for (const [file, source] of Object.entries(sources)) {
        expect(source, file).not.toMatch(/#7c8cff|124,\s*140,\s*255|'--accent/i);
      }
    });
  });

  describe('the two-band focus ring (language.md §9.2, A-11, redesign D0-1)', () => {
    const light = () => colour('--focus-light');
    const dark = () => colour('--focus-dark');

    it('keeps its bands ≥ 9:1 apart (WCAG C40): lime on ink, 16.42:1', () => {
      expect(resolve('--focus-light')).toBe('#c8fb3d');
      expect(resolve('--focus-dark')).toBe('#08090c');
      expect(contrast(light(), dark())).toBeGreaterThanOrEqual(9);
      expect(contrast(light(), dark())).toBeGreaterThanOrEqual(16.42);
    });

    it('shows one band at ≥ 3:1 over every backdrop it meets', () => {
      const backdrops: readonly (readonly [string, Rgb])[] = [
        ['white page', literal('#ffffff')],
        ['yellow tint', literal(TINT.yellow.toLowerCase())],
        ['green tint', literal(TINT.green.toLowerCase())],
        ['select blue', colour('--select')],
        ['blue ink', literal('#1760ee')],
        ['red ink', literal('#db1c22')],
        ['mid grey', literal('#808080')],
        ['accent fill', colour('--accent')],
        ...SURFACES.map((name) => [name, colour(name)] as const),
        ['glass over white', glassOver(literal('#ffffff'))],
        ['glass over the canvas', glassOver(canvas())],
        ['menu glass over white', tierOver(TIER_3, literal('#ffffff'))],
      ];
      for (const [name, backdrop] of backdrops) {
        const best = Math.max(contrast(light(), backdrop), contrast(dark(), backdrop));
        expect(best, name).toBeGreaterThanOrEqual(AA_NON_TEXT);
      }
    });

    it('sets the three offsets: outset 2px, inset -2px, gap 4px', () => {
      expect(resolve('--focus-offset-out')).toBe('2px');
      expect(resolve('--focus-offset-in')).toBe('-2px');
      expect(resolve('--focus-offset-gap')).toBe('4px');
    });

    it('draws the three forms in focus.css from the tokens; global.css imports it', () => {
      expect(stripComments(globalCss)).toMatch(/@import '\.\/focus\.css';/);
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
        /\.focus-inset:focus-visible,\s*\[data-focus='inset'\]:focus-visible,\s*\.glass :focus-visible/,
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

  describe('motion (§7.5)', () => {
    it('rises 4px and stands still under reduced motion', () => {
      expect(resolve('--rise-distance')).toBe('4px');
      expect(resolve('--motion-rise')).toBe('translateY(4px)');
      const reduced = mediaOverrides('prefers-reduced-motion: reduce');
      expect(reduced.get('--rise-distance')).toBe('0px');
      expect(reduced.get('--duration-fast')).toBe('0ms');
      expect(resolve('--motion-rise', reduced)).toBe('translateY(0px)');
    });
  });
});
