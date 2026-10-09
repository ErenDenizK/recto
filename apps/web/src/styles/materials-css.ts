/**
 * Writes `materials.css` (components/09-primitives.md §26; language.md §2.3, §2.4, §2.8,
 * §10.1; ADR-0024; spec D3-3) from the coverage registry and the tier tokens of `tokens.css`.
 * Pure: `tooling/materials.ts` writes its output to the file and `materials.test.ts` fails when
 * the committed file differs, so the CSS, the registry and the test cannot drift.
 *
 * What the file holds, in cascade order:
 *
 * 1. **Tiers.** `.mat-chip` … `.mat-lit` point the material's variables at the tier's tokens:
 *    tint, solid, shadow, outer edge, lit rim top and bottom, inner light (§2.4).
 *    `.mat-docked` is docked M3 (an inner light, no edge, no shadow; the module draws the
 *    hairline on its free edge), `.mat-opaque` the solid twin of a tier for a panel that opens
 *    across a hard dark/white edge (the title menu over the sidebar and the page).
 * 2. **The base,** `.mat`, at zero specificity (`:where`) so a module's own border, radius or
 *    shadow wins as it did over `.glass`: the solid token, a 1 px rim lit from above (the top
 *    and bottom edges carry the tier's rim, the sides the glass hairline; a border, not a
 *    pseudo-element, so it follows any radius, never scrolls with a menu's rows and keeps every
 *    surface's box as `.glass` drew it), the edge, the inner light and the shadow as
 *    `--shadow-own` (the focus ring adds its bands to it). Lit glass (§2.5) has no border: its
 *    rim is the masked `::before` gradient that its cards had. The light is a hairline specular
 *    edge, never a band (owner feedback 2026-10-09, G4): the inner light is half a pixel
 *    (`--rim-inner*`, one device pixel on a 2× screen), and lit glass turns its rim from the lit
 *    top to the hairline within 8 px of each end instead of over a third of its height.
 * 3. **The tint and the text,** where `backdrop-filter` exists and the Glass setting is not
 *    Solid: the tint, and secondary, tertiary, disabled and danger text on their glass steps.
 * 4. **σ,** one rule per tier × σ the registry uses: `-webkit-backdrop-filter` and
 *    `backdrop-filter` with the same literal values (G-22: Safari may ignore `var()` there),
 *    guarded by the root's `data-glass` (Solid) and `data-degrade` (the cost ladder's steps 3,
 *    M3 solid, and 4, everything solid; `state/render-quality.ts`). Coarse pointers (`c<σ>`, or
 *    `cs` for solid), compact-height (`h<σ>`) and one-row menus (`r<σ>`) follow, each later and
 *    at least as specific, and the backdrop lens of the M1 chips last (`.lens`, Chromium only:
 *    the one rule that reads a `var()`, the map `material-lens.ts` draws at the chip's size).
 * 5. **Resets.** Docked M3 under a modal sheet's scrim (`data-scrim`), the solid twin, reduced
 *    transparency, more contrast and forced colours turn every filter off
 *    and bring the normal text ladder back; more contrast draws the strong border instead of rim
 *    and shadow (A-18).
 */
import type { GlassSurfaceEntry } from './coverage-registry';
import type { GlassTier } from './token-registry';

const TIERS: readonly GlassTier[] = ['chip', 'bar', 'panel', 'menu', 'sheet', 'lit'];

/** The chain after `blur(σ)` per tier, as a theme block of `tokens.css` writes it. */
export type TierFilters = Readonly<Record<GlassTier, string>>;

/** Each tier's rim tokens (language.md §2.4): edge, lit rim top and bottom, inner light. */
const RIMS: Readonly<Record<GlassTier, readonly [string, string, string, string]>> = {
  chip: ['--rim-edge', '--rim-top', '--rim-bottom', '--rim-inner'],
  bar: ['--rim-edge', '--rim-top', '--rim-bottom', '--rim-inner'],
  panel: ['--rim-edge', '--rim-top-sheet', '--rim-bottom-sheet', '--rim-inner-sheet'],
  menu: ['--rim-edge-strong', '--rim-top-menu', '--rim-bottom-menu', '--rim-inner-menu'],
  sheet: ['--rim-edge-strong', '--rim-top-sheet', '--rim-bottom-sheet', '--rim-inner-sheet'],
  lit: ['--rim-edge', '--rim-top', '--rim-bottom', '--rim-inner'],
};

const SUPPORTS = '@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))';
const COARSE = '@media (pointer: coarse), (any-pointer: coarse)';
const UNWELCOME =
  '@media (prefers-reduced-transparency: reduce), (prefers-contrast: more), (forced-colors: active)';

/** The root while a tier may blur: not Solid, and not past the ladder's step for it. */
function live(tier: GlassTier, extra = ''): string {
  const off =
    tier === 'panel'
      ? "[data-glass='solid'], [data-degrade='3'], [data-degrade='4']"
      : "[data-glass='solid'], [data-degrade='4']";
  return `:where(:root${extra}:not(${off}))`;
}

/** One declaration pair, prefixed and unprefixed, with equal literal values. */
function filterLines(value: string, indent: string): string {
  return `${indent}-webkit-backdrop-filter: ${value};\n${indent}backdrop-filter: ${value};\n`;
}

/** The text steps on glass (language.md §2.3), and their reset to the normal ladder. */
const TEXT_ON_GLASS = [
  '--text-secondary: var(--glass-text-secondary);',
  '--text-tertiary: var(--glass-text-secondary);',
  '--text-disabled: var(--glass-text-disabled);',
  '--danger: var(--glass-danger);',
];
const TEXT_RESET = [
  '--text-secondary: inherit;',
  '--text-tertiary: inherit;',
  '--text-disabled: inherit;',
  '--danger: inherit;',
];

const block = (selector: string, lines: readonly string[], indent = ''): string =>
  `${indent}${selector} {\n${lines.map((line) => `${indent}  ${line}\n`).join('')}${indent}}\n`;

/** The tier × σ pairs the registry uses, in tier order and σ ascending. */
function pairs(
  entries: readonly GlassSurfaceEntry[],
  pick: (entry: GlassSurfaceEntry) => number | undefined,
): [GlassTier, number][] {
  const seen = new Map<string, [GlassTier, number]>();
  for (const entry of entries) {
    const sigma = pick(entry);
    if (sigma === undefined) continue;
    seen.set(`${entry.tier}:${sigma}`, [entry.tier, sigma]);
  }
  return [...seen.values()].sort(
    (a, b) => TIERS.indexOf(a[0]) - TIERS.indexOf(b[0]) || a[1] - b[1],
  );
}

export interface MaterialsInputs {
  readonly entries: readonly GlassSurfaceEntry[];
  /** The dark theme's chains (tokens.css §1). */
  readonly filters: TierFilters;
  /** The light theme's chains (tokens.css §2, D3-7): every σ rule again under `[data-theme='light']`. */
  readonly lightFilters?: TierFilters;
}

export function renderMaterialsCss({ entries, filters, lightFilters }: MaterialsInputs): string {
  const out: string[] = [];
  out.push(`/*
 * Materials (components/09-primitives.md §26; language.md §2.3, §2.4, §2.8; ADR-0024; D3-3).
 * GENERATED from styles/coverage-registry.ts and the tier tokens of tokens.css by
 * \`pnpm --filter @pdf-editor/web materials\` (tooling/materials.ts, styles/materials-css.ts):
 * do not edit. materials.test.ts fails when this file differs from what the generator writes.
 *
 * A surface composes \`mat mat-<tier> s<σ>\` (and \`c<σ>\`, \`cs\`, \`h<σ>\`, \`r<σ>\`,
 * \`mat-docked\` as its registry entry says), from a CSS module or through ui/Surface.
 */
`);

  // 1. Tiers.
  out.push('/* Tiers: the variables the base reads (language.md §2.2, §2.4). */\n');
  for (const tier of TIERS) {
    const [edge, top, bottom, inner] = RIMS[tier];
    out.push(
      block(`.mat-${tier}`, [
        `--mat-tint: var(--glass-${tier}-tint);`,
        `--mat-solid: var(--glass-${tier}-solid);`,
        `--mat-shadow: var(--glass-${tier}-shadow);`,
        `--mat-edge: var(${edge});`,
        `--mat-rim-top: var(${top});`,
        `--mat-rim-bottom: var(${bottom});`,
        `--mat-inner: var(${inner});`,
      ]),
    );
  }
  out.push(
    block('.mat-docked', [
      '--mat-edge: 0 0 #0000;',
      '--mat-inner: var(--rim-inner-docked);',
      '--mat-shadow: 0 0 #0000;',
    ]),
  );
  out.push(block('.mat-opaque', ['--mat-tint: var(--mat-solid);']));

  // 2. The base.
  out.push('\n/* The base: solid first, the lit rim, edge, inner light and shadow. */\n');
  out.push(
    block('.mat', [
      '--shadow-own: var(--mat-edge), var(--mat-inner), var(--mat-shadow);',
      'border: 1px solid var(--border-glass);',
      'border-top-color: var(--mat-rim-top);',
      'border-bottom-color: var(--mat-rim-bottom);',
      'background: var(--mat-solid);',
      'box-shadow: var(--shadow-own);',
    ]),
  );
  out.push(block('.mat-docked', ['border: 0;']));
  out.push(
    block('.mat-lit', [
      '--shadow-own: var(--mat-edge), var(--mat-inner);',
      'position: relative;',
      'border: 0;',
    ]),
  );
  out.push(
    block('.mat-lit::before', [
      "content: '';",
      'position: absolute;',
      'inset: 0;',
      'padding: 1px;',
      'border-radius: inherit;',
      'background: linear-gradient(180deg, var(--rim-top), var(--border-hairline) 8px, var(--border-hairline) calc(100% - 8px), var(--rim-bottom));',
      '-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
      '-webkit-mask-composite: xor;',
      'mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);',
      'pointer-events: none;',
    ]),
  );

  // 3. Tint and text.
  out.push(`\n/* The tint and the glass text steps, where glass renders and the setting is not Solid. */
${SUPPORTS} {
`);
  out.push(
    block(
      ":where(:root:not([data-glass='solid'], [data-degrade='4'])) .mat",
      [...TEXT_ON_GLASS, 'background: var(--mat-tint);'],
      '  ',
    ),
  );
  out.push(
    block(
      ":where(:root[data-degrade='3']) .mat.mat-panel",
      [...TEXT_RESET, 'background: var(--mat-solid);'],
      '  ',
    ),
  );
  out.push('}\n');

  // 4. σ.
  const chain = (tier: GlassTier, sigma: number, theme: TierFilters) =>
    `blur(${sigma}px) ${theme[tier]}`;
  const themes: [string, TierFilters][] = [['', filters]];
  if (lightFilters) themes.push(["[data-theme='light']", lightFilters]);

  out.push(`\n/* σ: one rule per tier × σ in the coverage registry, literal on both lines (G-22). */
${SUPPORTS} {
`);
  for (const [theme, chains] of themes) {
    for (const [tier, sigma] of pairs(entries, (e) => (e.oneRow ? undefined : e.sigma))) {
      out.push(
        `  ${live(tier, theme)} .mat-${tier}.s${sigma} {\n${filterLines(chain(tier, sigma, chains), '    ')}  }\n`,
      );
    }
  }
  const coarse = pairs(entries, (e) =>
    typeof e.coarse === 'object' && !e.oneRow ? e.coarse.sigma : undefined,
  );
  const coarseSolid = entries.filter((e) => e.coarse === 'solid');
  if (coarse.length > 0 || coarseSolid.length > 0) {
    out.push(`\n  /* Coarse pointers. */\n  ${COARSE} {\n`);
    for (const [theme, chains] of themes) {
      for (const [tier, sigma] of coarse) {
        out.push(
          `    ${live(tier, theme)} .mat-${tier}.c${sigma} {\n${filterLines(chain(tier, sigma, chains), '      ')}    }\n`,
        );
      }
    }
    for (const [tier, sigma] of pairs(coarseSolid, (e) => e.sigma)) {
      out.push(
        `    ${live(tier)} .mat-${tier}.s${sigma}.cs {\n${filterLines('none', '      ')}      ${TEXT_RESET.join('\n      ')}\n      background: var(--mat-solid);\n    }\n`,
      );
    }
    out.push('  }\n');
  }
  const short = pairs(entries, (e) => e.short?.sigma);
  if (short.length > 0) {
    out.push('\n  /* Compact-height (`:root[data-short]`). */\n');
    for (const [theme, chains] of themes) {
      for (const [tier, sigma] of short) {
        out.push(
          `  ${live(tier, `[data-short]${theme}`)} .mat-${tier}.h${sigma} {\n${filterLines(chain(tier, sigma, chains), '    ')}  }\n`,
        );
      }
    }
  }
  const oneRow = pairs(entries, (e) => (e.oneRow ? e.sigma : undefined));
  if (oneRow.length > 0) {
    out.push('\n  /* One-row menus: too short for the menus’ σ. */\n');
    for (const [theme, chains] of themes) {
      for (const [tier, sigma] of oneRow) {
        out.push(
          `  ${live(tier, theme)} .mat-${tier}.r${sigma}:not(:has(> :nth-child(2))) {\n${filterLines(chain(tier, sigma, chains), '    ')}  }\n`,
        );
      }
    }
  }
  const lensed = pairs(
    entries.filter((e) => e.lens),
    (e) => e.sigma,
  );
  if (lensed.length > 0) {
    out.push(`
  /* The backdrop lens (language.md §2.7, X20): fixed-size M1 chips, Chromium only, added by
     script after detection (material-lens.ts) and never under Tinted, Solid or a ladder step;
     the map is drawn at the chip's size, so its url() is the one var() here. */
`);
    for (const [theme, chains] of themes) {
      for (const [tier, sigma] of lensed) {
        out.push(
          `  :where(:root${theme}:not([data-glass='solid'], [data-glass='tinted'], [data-degrade])) .mat-${tier}.s${sigma}.lens {\n    backdrop-filter: var(--lens) ${chain(tier, sigma, chains)};\n  }\n`,
        );
      }
    }
  }
  out.push('}\n');

  // 5. Resets.
  out.push(
    `
/* Under a modal scrim (dim only, G-31) the docked frame needs no blur: the backdrop is
   still and dimmed, and its solid token is what it composites to over the canvas. It keeps the
   budget of four blurred surfaces at rest (Q-11) with the sheet and a toast over the dock. */
${block(':where(:root:has([data-scrim]:not([data-ending-style]))) .mat.mat-docked', [...TEXT_RESET, '-webkit-backdrop-filter: none !important;', 'backdrop-filter: none !important;', 'background: var(--mat-solid);'])}`,
  );
  out.push(
    `\n/* The solid twin: no filter, whatever σ its tier's surface composes. */\n${block('.mat-opaque', ['-webkit-backdrop-filter: none !important;', 'backdrop-filter: none !important;'])}`,
  );
  out.push(`\n/* Transparency unwelcome, more contrast, forced colours: solid, no filter, the normal ladder. */
${UNWELCOME} {
${block('.mat', [...TEXT_RESET, '-webkit-backdrop-filter: none !important;', 'backdrop-filter: none !important;'], '  ')}}

/* More contrast: the strong border instead of the rim, no shadow (language.md §2.4, A-18). */
@media (prefers-contrast: more) {
${block('.mat', ['--shadow-own: 0 0 #0000;', 'border-color: var(--border-glass);'], '  ')}${block('.mat.mat-lit', ['border: 1px solid var(--border-glass);'], '  ')}${block('.mat-lit::before', ['content: none;'], '  ')}}

/* Forced colours: Canvas with a CanvasText edge (tokens.css §6). */
@media (forced-colors: active) {
${block('.mat', ['border-color: CanvasText;'], '  ')}${block('.mat-lit::before', ['content: none;'], '  ')}}
`);
  return out.join('');
}

/**
 * The tier chains of one theme block of `tokens.css`: the `--glass-<tier>-filter` values of the
 * first rule whose selector is `selector` (whitespace folded).
 */
export function tierFiltersOf(tokensCss: string, selector: string): TierFilters | undefined {
  const source = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '');
  // The boundary is looked behind, not consumed, so a rule that follows another's `}` directly
  // (the light block after the dark one) is found too.
  for (const match of source.matchAll(/(^|(?<=[{};]))\s*([^{};@]+?)\s*\{([^{}]*)\}/g)) {
    if ((match[2] ?? '').replace(/\s+/g, ' ') !== selector) continue;
    const body = match[3] ?? '';
    const result: Partial<Record<GlassTier, string>> = {};
    for (const tier of TIERS) {
      const value = new RegExp(`--glass-${tier}-filter\\s*:\\s*([^;]+);`).exec(body)?.[1];
      if (value === undefined) return undefined;
      result[tier] = value.trim().replace(/\s+/g, ' ');
    }
    return result as TierFilters;
  }
  return undefined;
}

/** The dark theme block's selector, and the light one (D3-7). */
export const DARK_BLOCK = ":root, [data-theme='dark']";
export const LIGHT_BLOCK = "[data-theme='light']";

/** The whole file from the two sources. */
export function materialsFrom(entries: readonly GlassSurfaceEntry[], tokensCss: string): string {
  const filters = tierFiltersOf(tokensCss, DARK_BLOCK);
  if (!filters) throw new Error(`tokens.css has no ${DARK_BLOCK} block with every tier filter`);
  const lightFilters = tierFiltersOf(tokensCss, LIGHT_BLOCK);
  return renderMaterialsCss({ entries, filters, ...(lightFilters ? { lightFilters } : {}) });
}
