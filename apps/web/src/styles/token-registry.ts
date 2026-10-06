/**
 * Every token `tokens.css` defines, by block and layer (components/09-primitives.md §25;
 * language.md §10.1). `tokens.test.ts` holds the file to this list both ways (nothing missing,
 * nothing unlisted), keeps raw layer-1 names out of every module, and, once D3-7 adds the light
 * theme, checks that it redefines exactly the names of §1. A new token is added here first.
 */

const steps = (prefix: string, values: readonly (number | string)[]): string[] =>
  values.map((value) => `${prefix}${value}`);

/** §1, layer 1: the raw ramps and channel triplets. Only `tokens.css` reads them. */
export const RAW_TOKENS: readonly string[] = [
  ...steps('--n', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  ...steps('--lime-', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
  '--lime-rgb',
  '--white-rgb',
  '--ink-rgb',
  '--select-rgb',
  ...steps('--aurora-', ['teal', 'mint', 'lime', 'lemon']),
];

const TIERS = ['chip', 'bar', 'panel', 'menu', 'sheet', 'lit'] as const;
/** The material tiers of language.md §2.2, M1 to M5 and lit glass. */
export type GlassTier = (typeof TIERS)[number];
export const GLASS_TIERS: readonly GlassTier[] = TIERS;

/**
 * §1, layer 2: the semantic roles modules paint with. Tags sit here rather than in layer 1 (09
 * §25 lists them raw): `ui/Tag` and `ui/Avatar` read the six slots directly.
 */
export const SEMANTIC_TOKENS: readonly string[] = [
  // Surfaces and borders.
  '--canvas',
  '--surface-sunken',
  '--surface-frame',
  '--surface-raised',
  '--surface-on',
  '--surface-hover',
  '--surface-active',
  '--scrim',
  '--border-hairline',
  '--border-strong',
  '--border-glass',
  '--border-swatch',
  '--border-opaque',
  // Text.
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--text-disabled',
  '--glass-text-secondary',
  '--glass-text-disabled',
  // Interaction: the lime.
  '--accent',
  '--accent-hover',
  '--accent-pressed',
  '--accent-ink',
  '--accent-subtle',
  '--accent-muted',
  '--accent-line',
  '--primary-fill',
  '--primary-fill-hover',
  '--primary-fill-pressed',
  '--primary-ink',
  '--tool-active-fill',
  '--tool-active-fill-hover',
  '--tool-active-fill-pressed',
  '--tool-active-ink',
  // Content.
  '--page-background',
  '--page-shadow',
  '--page-under',
  '--plate-edge',
  '--plate-ring',
  '--select',
  '--select-ink',
  '--select-subtle',
  '--select-muted',
  '--select-wash',
  '--select-wash-strong',
  '--redact-page',
  '--crop-dim',
  // Status.
  '--danger',
  '--warning',
  '--success',
  '--glass-danger',
  '--glass-warning',
  '--glass-success',
  '--warning-line',
  // Tags and atmosphere.
  ...steps('--tag-', [0, 1, 2, 3, 4, 5]),
  '--light-cap-under-glass',
  // Materials.
  ...TIERS.flatMap((tier) =>
    ['alpha', 'tint', 'filter', 'solid', 'shadow'].map((part) => `--glass-${tier}-${part}`),
  ),
  '--rim-edge',
  '--rim-top',
  '--rim-bottom',
  '--rim-inner',
  ...steps('--e', [0, 1, 2, 3, 4, 5]),
];

/** §1, layer 3: the control block of `ui/` (09 §2.2) and the focus bands. */
export const CONTROL_TOKENS: readonly string[] = [
  '--control-fill',
  '--control-fill-hover',
  '--control-fill-pressed',
  '--control-border',
  '--control-border-hover',
  '--control-on',
  '--control-on-ink',
  '--control-thumb-off',
  '--control-thumb',
  '--control-knob',
  '--control-track',
  '--control-range',
  '--control-disabled-fill',
  '--progress-fill',
  '--field-well',
  '--field-placeholder',
  '--scroll-thumb',
  '--scroll-thumb-hover',
  '--badge-fill',
  '--swatch-contrast',
  '--focus-light',
  '--focus-dark',
];

/**
 * §1's aliases (09 §25 block 8), deleted at migration step 11: each M8 name and the token it
 * reads. The σ-carrying glass filters are today's `.glass*` classes: a blur, then a tier's chain.
 */
export const THEME_ALIASES: Readonly<Record<string, string>> = {
  '--surface-0': '--canvas',
  '--surface-1': '--surface-frame',
  '--surface-2': '--surface-raised',
  '--surface-3': '--surface-on',
  '--accent-highlight': '--select-wash',
  '--accent-highlight-strong': '--select-wash-strong',
  '--glass': '--glass-bar-tint',
  '--glass-filter': '--glass-bar-filter',
  '--glass-solid': '--glass-bar-solid',
  '--glass-frame': '--glass-panel-tint',
  '--glass-frame-filter': '--glass-panel-filter',
  '--glass-frame-solid': '--glass-panel-solid',
  '--glass-frame-highlight': '--white-rgb',
  '--glass-menu': '--glass-menu-tint',
  '--glass-menu-backdrop': '--glass-menu-filter',
  '--glass-menu-short-backdrop': '--glass-menu-filter',
  '--elevation-float': '--glass-bar-shadow',
};

/** §3: theme-free type, shape, space, metrics, focus offsets, density and motion. */
export const THEME_FREE_TOKENS: readonly string[] = [
  '--font-ui',
  '--font-mono',
  '--tracking-ui',
  '--tracking-label',
  '--tracking-display',
  ...['caption', 'footnote', 'body', 'callout'].flatMap((step) => [
    `--type-${step}`,
    `--type-${step}-lh`,
  ]),
  '--leading-tight',
  '--leading-base',
  ...steps('--radius-', ['page', 'xs', 'sm', 'md', 'capsule', 'pill', 'control']),
  ...steps('--space-', [1, 2, 3, 4, 5, 6, 8, 12]),
  '--titlebar-height',
  '--statusbar-height',
  '--rail-width',
  '--control-height',
  '--focus-offset-out',
  '--focus-offset-in',
  '--focus-offset-gap',
  '--hit-min',
  '--control-h',
  '--control-h-lg',
  '--bar-button',
  '--bar-h',
  '--chip-h',
  '--check',
  '--switch-w',
  '--switch-h',
  '--icon-sm',
  '--icon-md',
  '--gap-target',
  '--control-text',
  '--control-lh',
  '--field-text',
  '--press-scale',
  '--duration-instant',
  '--duration-fast',
  '--duration-base',
  '--ease-out',
  '--enter-scale',
  '--rise-distance',
  '--motion-rise',
  '--ease-spring',
  '--ease-spring-pop',
  '--spring-press',
  '--spring-quick',
  '--spring-pop',
  '--spring-track',
  '--ease-standard',
];

/** §3's aliases, deleted at migration step 11. */
export const THEME_FREE_ALIASES: Readonly<Record<string, string>> = {
  '--font-sans': '--font-ui',
  '--text-xs': '--type-caption',
  '--text-sm': '--type-footnote',
  '--text-md': '--type-body',
  '--text-lg': '--type-callout',
  '--radius-1': '--radius-xs',
  '--radius-2': '--radius-sm',
  '--radius-3': '--radius-md',
  '--radius-round': '--radius-capsule',
  '--icon-chrome': '--icon-sm',
  '--icon-toolbar': '--icon-md',
};

/** Every name §1 defines; D3-7's light blocks must define exactly these. */
export const THEME_TOKENS: readonly string[] = [
  ...RAW_TOKENS,
  ...SEMANTIC_TOKENS,
  ...CONTROL_TOKENS,
  ...Object.keys(THEME_ALIASES),
];
