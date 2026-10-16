/**
 * Writes `materials.css` (components/09-primitives.md §26; language.md §2.3, §2.4, §2.8,
 * §10.1; ADR-0024; spec D3-3; decisions GLS-7 … GLS-11) from the coverage registry and the tier
 * tokens of `tokens.css`. Pure: `tooling/materials.ts` writes its output to the file and
 * `materials.test.ts` fails when the committed file differs, so the CSS, the registry and the
 * test cannot drift.
 *
 * The material is CSS+ (GLS-7, GLS-8): a CSS imitation of the GPU glass, never flat outside the
 * Solid setting. What the file holds, in cascade order:
 *
 * 1. **Tiers.** `.mat-chip` … `.mat-lit` point the material's variables at the tier's tokens:
 *    tint, solid, shadow, outer edge, lit rim top and bottom, inner light (§2.4).
 *    `.mat-docked` is docked M3 (an inner light, no edge, no shadow; the module draws the
 *    hairline on its free edge), `.mat-opaque` the solid twin of a tier for a panel that opens
 *    across a hard dark/white edge (the title menu over the sidebar and the page).
 * 2. **The base,** `.mat`, at zero specificity (`:where`) so a module's own border, radius or
 *    shadow wins as it did over `.glass`: the solid token, a 1 px rim lit from the top left (the
 *    top and the leading side carry the tier's rim, the bottom its weaker lobe, the trailing
 *    side the glass hairline: research 23 §5.2's two lobes as a border, not a pseudo-element, so
 *    it follows any radius, never scrolls with a menu's rows and keeps every surface's box), the
 *    edge, the inner light (the top-left specular hairline, the weaker bottom-right one and a
 *    soft inner top light, `--rim-inner*`) and the shadow as `--shadow-own` (the focus ring adds
 *    its bands to it). Lit glass (§2.5) has no border: its rim is the masked `::before`
 *    gradient. The light stays a hairline, never a band (owner feedback 2026-10-09, G4).
 * 3. **The tint and the text,** where `backdrop-filter` exists and the Glass setting is not
 *    Solid: the tint, and secondary, tertiary, disabled and danger text on their glass steps.
 *    The cost ladder never turns a surface solid (GLS-7, GLS-10).
 * 4. **σ,** one rule per tier × σ the registry uses: `-webkit-backdrop-filter` and
 *    `backdrop-filter` with the same literal values (G-22: Safari may ignore `var()` there),
 *    guarded by the root's `data-glass` (Solid) and `data-degrade` (the ladder's steps 3 and 4
 *    have rules of their own, 6). Chips and bars blur at three quarters of their registered σ
 *    (`renderedSigma`: small pieces show the page, iOS's "nearly clear" controls, GLS-8; their
 *    coverage only grows). The tone is the root theme's on every piece (GLS-20). Coarse pointers (`c<σ>`, or `cs` for solid), compact-height (`h<σ>`) and
 *    one-row menus (`r<σ>`) follow, each later and at least as specific, and the backdrop lens
 *    last (`.lens`, Chromium only: the one rule that reads a `var()`, the map
 *    `material-lens.ts` draws at the surface's size; chips and, since GLS-11, bars).
 * 5. **The ring** (GLS-8): on M1 chips and on round buttons that compose `mat-ring`, a band
 *    inside the rim lays a white light over the glass in soft light, which brightens and
 *    deepens what the glass shows there, masked to the band: the thick edge catching light
 *    (research 23 §5.2's bezel band). A blend, not a second backdrop pass: a backdrop filter
 *    nested in the glass would break Q-3 and count as a surface of its own (Q-11), and the lab
 *    measured that pass as the bezel band's whole cost. Off where the lens bends the rim
 *    instead, under Tinted and Solid, and from ladder step 3.
 * 6. **The cost ladder's glass steps** (GLS-10): step 3 one reduced σ per tier and no ring;
 *    step 4 the floor, after the owner's Glass UI nav preset: one layer at 12 px (8 px on a
 *    coarse pointer, and never more than step 3's σ, so small pieces keep their coverage), the
 *    tier's tint and its chain without saturate, a 1 px white hairline at 0.30, the rims kept.
 * 7. **Resets.** Docked M3 under a modal sheet's scrim (`data-scrim`), the solid twin, reduced
 *    transparency, more contrast and forced colours turn every filter off and bring the normal
 *    text ladder back; more contrast draws the strong border instead of rim and shadow (A-18).
 */
import type { GlassSurfaceEntry } from './coverage-registry';
import type { GlassTier } from './token-registry';

const TIERS: readonly GlassTier[] = ['chip', 'bar', 'panel', 'menu', 'sheet', 'lit'];

/** The small pieces floating over pages (GLS-8): chips and bars, the tiers that may take a lens. */
export const SMALL_TIERS: readonly GlassTier[] = ['chip', 'bar'];

/** Chips and bars blur at this share of their registered σ (GLS-8). */
export const SMALL_PIECE_SIGMA = 0.75;

/** The blur a tier renders for a registered σ: smaller on the small pieces (GLS-8). */
export function renderedSigma(tier: GlassTier, sigma: number): number {
  return SMALL_TIERS.includes(tier) ? Math.max(1, Math.round(sigma * SMALL_PIECE_SIGMA)) : sigma;
}

/** Ladder step 3 (GLS-10): one reduced σ per tier, whatever its surfaces register. */
export const STEP3_SIGMA: Readonly<Record<GlassTier, number>> = {
  chip: 4,
  bar: 5,
  panel: 12,
  menu: 8,
  sheet: 12,
  lit: 0,
};

/** Ladder step 4 (GLS-10), after the owner's Glass UI nav preset: 12 px, 8 on a coarse pointer. */
export const FLOOR_SIGMA = { fine: 12, coarse: 8 } as const;

/**
 * The floor's σ for a tier: the preset's, but never above step 3's, so a small piece never
 * blurs more at the floor than above it (its coverage term, D0-1, would fail: a 36 px chip at
 * 12 px lets the page in at its edges).
 */
export function floorSigma(tier: GlassTier, coarse: boolean): number {
  return Math.min(STEP3_SIGMA[tier], coarse ? FLOOR_SIGMA.coarse : FLOOR_SIGMA.fine);
}

/** The nav preset's hairline, kept at the floor. */
export const FLOOR_BORDER = 'rgb(255 255 255 / 0.3)';

/** The ring's band (GLS-8): its width, CSS px, and how its light meets the glass beneath. */
export const RING_WIDTH = 3;
export const RING_BLEND = 'soft-light';

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
const SOLID = "[data-glass='solid']";

/** The root while a σ rule applies: not Solid, and below the ladder's glass steps (3, 4). */
function live(extra = ''): string {
  return `:where(:root${extra}:not(${SOLID}, [data-degrade='3'], [data-degrade='4']))`;
}

/** The root at one of the ladder's glass steps. */
function step(n: 3 | 4, extra = ''): string {
  return `:where(:root[data-degrade='${n}']${extra}:not(${SOLID}))`;
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

/** The chain without saturate, for the ladder's floor (GLS-10). */
function floorChain(chain: string): string {
  return chain.replace(/saturate\([^)]*\)\s*/g, '').trim();
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
 * Materials (components/09-primitives.md §26; language.md §2.3, §2.4, §2.8; ADR-0024; D3-3;
 * GLS-7 … GLS-11). GENERATED from styles/coverage-registry.ts and the tier tokens of tokens.css
 * by \`pnpm --filter @pdf-editor/web materials\` (tooling/materials.ts, styles/materials-css.ts):
 * do not edit. materials.test.ts fails when this file differs from what the generator writes.
 *
 * A surface composes \`mat mat-<tier> s<σ>\` (and \`c<σ>\`, \`cs\`, \`h<σ>\`, \`r<σ>\`,
 * \`mat-docked\`, \`mat-ring\` as its registry entry says), from a CSS module or through
 * ui/Surface.
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
  out.push(
    '\n/* The base: solid first, the rim lit from the top left, edge, inner light, shadow. */\n',
  );
  out.push(
    block('.mat', [
      '--shadow-own: var(--mat-edge), var(--mat-inner), var(--mat-shadow);',
      'border: 1px solid var(--border-glass);',
      'border-top-color: var(--mat-rim-top);',
      'border-inline-start-color: color-mix(in srgb, var(--mat-rim-top) 60%, var(--border-glass));',
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
      `:where(:root:not(${SOLID})) .mat`,
      [...TEXT_ON_GLASS, 'background: var(--mat-tint);'],
      '  ',
    ),
  );
  out.push('}\n');

  // 4. σ.
  const themes: [string, TierFilters][] = [['', filters]];
  if (lightFilters) themes.push(["[data-theme='light']", lightFilters]);
  const chainOf = (tier: GlassTier, sigma: number, theme: TierFilters) =>
    `blur(${renderedSigma(tier, sigma)}px) ${theme[tier]}`;
  /** The rules of one class kind, per root theme. */
  const kind = (
    list: readonly [GlassTier, number][],
    cls: (sigma: number) => string,
    root: string,
    indent: string,
  ) => {
    for (const [theme, chains] of themes) {
      for (const [tier, sigma] of list) {
        out.push(
          `${indent}${live(`${root}${theme}`)} .mat-${tier}.${cls(sigma)} {\n${filterLines(chainOf(tier, sigma, chains), `${indent}  `)}${indent}}\n`,
        );
      }
    }
  };

  out.push(`\n/* σ: one rule per tier × σ in the coverage registry, literal on both lines (G-22); chips and
   bars at three quarters (GLS-8). */
${SUPPORTS} {
`);
  kind(
    pairs(entries, (e) => (e.oneRow ? undefined : e.sigma)),
    (s) => `s${s}`,
    '',
    '  ',
  );
  const coarse = pairs(entries, (e) =>
    typeof e.coarse === 'object' && !e.oneRow ? e.coarse.sigma : undefined,
  );
  const coarseSolid = entries.filter((e) => e.coarse === 'solid');
  if (coarse.length > 0 || coarseSolid.length > 0) {
    out.push(`\n  /* Coarse pointers. */\n  ${COARSE} {\n`);
    kind(coarse, (s) => `c${s}`, '', '    ');
    for (const [tier, sigma] of pairs(coarseSolid, (e) => e.sigma)) {
      out.push(
        `    :where(:root:not(${SOLID})) .mat-${tier}.s${sigma}.cs {\n${filterLines('none', '      ')}      ${TEXT_RESET.join('\n      ')}\n      background: var(--mat-solid);\n    }\n`,
      );
    }
    out.push('  }\n');
  }
  const short = pairs(entries, (e) => e.short?.sigma);
  if (short.length > 0) {
    out.push('\n  /* Compact-height (`:root[data-short]`). */\n');
    kind(short, (s) => `h${s}`, '[data-short]', '  ');
  }
  const oneRow = pairs(entries, (e) => (e.oneRow ? e.sigma : undefined));
  if (oneRow.length > 0) {
    out.push('\n  /* One-row menus: too short for the menus’ σ. */\n');
    kind(oneRow, (s) => `r${s}:not(:has(> :nth-child(2)))`, '', '  ');
  }
  // The lens: every fine σ of the tiers that may take one (chips, and bars since GLS-11).
  const lensed = pairs(
    entries.filter((e) => SMALL_TIERS.includes(e.tier) && !e.oneRow),
    (e) => e.sigma,
  );
  if (lensed.length > 0) {
    out.push(`
  /* The backdrop lens (language.md §2.7, X20, GLS-11): chips and bars, Chromium on a GPU with a
     fine pointer only, added by script after detection (material-lens.ts) and never under
     Tinted, Solid or a ladder step; the map is drawn at the surface's size, so its url() is the
     one var() here. */
`);
    const off = `${SOLID}, [data-glass='tinted'], [data-degrade]`;
    for (const [theme, chains] of themes) {
      for (const [tier, sigma] of lensed) {
        out.push(
          `  :where(:root${theme}:not(${off})) .mat-${tier}.s${sigma}.lens {\n    backdrop-filter: var(--lens) ${chainOf(tier, sigma, chains)};\n  }\n`,
        );
      }
    }
  }
  out.push('}\n');

  // 5. The ring.
  out.push(`
/* The ring (GLS-8): a band inside the rim of M1 chips and round buttons (\`mat-ring\`) whose
   light meets the glass beneath in soft light, masked to the band and laid under the content;
   no backdrop pass of its own (Q-3, Q-11). Not under the lens (the lens bends the rim instead),
   Tinted, Solid or ladder step 3 and 4. */
${block(':where(.mat-chip, .mat-ring)', ['position: relative;'])}${SUPPORTS} {
${block(
  `:where(:root:not(${SOLID}, [data-glass='tinted'], [data-degrade='3'], [data-degrade='4'])) :is(.mat-chip, .mat-ring):not(.lens, .mat-opaque)::before`,
  [
    "content: '';",
    'position: absolute;',
    'inset: 0;',
    'z-index: -1;',
    `padding: ${RING_WIDTH}px;`,
    'border-radius: inherit;',
    'background: linear-gradient(135deg, rgb(255 255 255 / 0.5), rgb(255 255 255 / 0.08) 40%, rgb(255 255 255 / 0.08) 60%, rgb(255 255 255 / 0.3));',
    `mix-blend-mode: ${RING_BLEND};`,
    '-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
    '-webkit-mask-composite: xor;',
    'mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);',
    'pointer-events: none;',
  ],
  '  ',
)}}
`);

  // 6. The ladder's glass steps.
  const used = [...new Set(entries.map((e) => e.tier))].sort(
    (a, b) => TIERS.indexOf(a) - TIERS.indexOf(b),
  );
  const stepRules = (
    n: 3 | 4,
    sigmaOf: (tier: GlassTier) => number,
    chainFor: (chain: string) => string,
    indent: string,
  ) => {
    for (const [theme, chains] of themes) {
      for (const tier of used) {
        out.push(
          `${indent}${step(n, theme)} .mat-${tier} {\n${filterLines(`blur(${sigmaOf(tier)}px) ${chainFor(chains[tier])}`, `${indent}  `)}${indent}}\n`,
        );
      }
    }
  };
  out.push(`
/* The cost ladder's glass steps (GLS-10): never solid. Step 3 lowers every σ to one per tier and
   drops the ring; step 4, the floor, is the owner's Glass UI nav preset: one layer at 12 px (8 on
   a coarse pointer, at most step 3's σ), the tier's tint, its chain without saturate, a white
   hairline at 0.30. */
${SUPPORTS} {
`);
  stepRules(
    3,
    (tier) => STEP3_SIGMA[tier],
    (chain) => chain,
    '  ',
  );
  stepRules(4, (tier) => floorSigma(tier, false), floorChain, '  ');
  out.push(`  ${COARSE} {\n`);
  stepRules(4, (tier) => floorSigma(tier, true), floorChain, '    ');
  out.push('  }\n');
  out.push(block(`${step(4)} .mat`, [`border-color: ${FLOOR_BORDER};`], '  '));
  out.push('}\n');

  // 7. Resets.
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
${block('.mat', [...TEXT_RESET, '-webkit-backdrop-filter: none !important;', 'backdrop-filter: none !important;'], '  ')}${block(':is(.mat-chip, .mat-ring)::before', ['content: none;'], '  ')}}

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
