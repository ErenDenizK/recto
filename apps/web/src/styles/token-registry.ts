/**
 * Every token `tokens.css` defines, by block and layer (components/09-primitives.md §25;
 * language.md §10.1). `tokens.test.ts` holds the file to this list both ways (nothing missing,
 * nothing unlisted), keeps raw layer-1 names out of every module, and checks that the light
 * theme (D3-7) redefines exactly the names of §1. A new token is added here first.
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
  '--accent-ring',
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
  '--rim-edge-strong',
  '--rim-top-menu',
  '--rim-bottom-menu',
  '--rim-inner-menu',
  '--rim-top-sheet',
  '--rim-bottom-sheet',
  '--rim-inner-sheet',
  '--rim-inner-docked',
  ...steps('--e', [0, 1, 2, 3, 4, 5]),
  // Tracking of the three small type steps, per theme (language.md §4.2, T-6).
  ...steps('--track-', ['caption', 'footnote', 'body']),
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
  '--control-knob-tint',
  '--control-knob-tint-held',
  '--control-knob-gloss',
  '--control-knob-edge',
  '--control-knob-rim',
  '--control-knob-drop',
  '--control-knob-drop-raised',
  '--control-knob-ring',
  '--control-knob-dot-drop',
  '--check-badge-rim',
  '--check-badge-scrim',
  '--check-badge-scrim-hover',
  '--check-badge-shadow',
  '--check-badge-fill',
  '--check-badge-ink',
  '--select-ring',
  '--aura-mint',
  '--aura-lime',
  '--aura-yellow',
  '--progress-fill',
  '--field-well',
  '--field-placeholder',
  '--scroll-thumb',
  '--scroll-thumb-hover',
  '--badge-fill',
  '--swatch-contrast',
  '--swatch-edge',
  '--focus-light',
  '--focus-dark',
];

/**
 * §3: theme-free type, shape, space, metrics, focus offsets and density. Motion is `motion.css`'s,
 * named in `motion/tokens.ts` (`MOTION_TOKENS`) and held to it by `motion.test.ts`.
 */
export const THEME_FREE_TOKENS: readonly string[] = [
  // Type (ADR-0027, language.md §4; spec D3-5): the face, three weights (Q-8), the scale with
  // a line height and a tracking per step.
  '--font-ui',
  ...steps('--weight-', ['regular', 'medium', 'semibold']),
  '--tracking-ui',
  '--tracking-label',
  '--tracking-display',
  ...['caption', 'footnote', 'body', 'callout', 'title3', 'title2', 'title1', 'display'].flatMap(
    (step) => [`--type-${step}`, `--type-${step}-lh`],
  ),
  // The larger steps track alike in both themes; caption, footnote and body are in §1 and §2.
  ...steps('--track-', ['callout', 'title3', 'title2', 'title1', 'display']),
  '--type-display-lg',
  '--type-display-lg-lh',
  '--leading-tight',
  '--leading-base',
  // Concentric radii, the 4 px grid and its half-step (system-audit-2026-10 §3.1, §3.2).
  ...steps('--radius-', ['page', 'xs', 'sm', 'control', 'md', 'lg', 'xl', '2xl', 'capsule']),
  ...steps('--space-', ['half', 1, '1h', 2, 3, 4, 5, 6, 8, 10, 12, 16]),
  '--focus-offset-out',
  '--focus-offset-in',
  '--focus-offset-gap',
  // The three control sizes, S · M · L (§3.3), and the pieces they sit in (G1).
  '--hit-min',
  '--control-h-sm',
  '--control-h',
  '--control-h-lg',
  '--bar-h',
  '--piece-h',
  '--piece-inset',
  '--piece-radius',
  '--piece-pad',
  '--piece-icon',
  '--piece-label',
  '--piece-label-lh',
  '--check',
  '--switch-w',
  '--switch-h',
  ...steps('--icon-', ['xs', 'sm', 'md', 'lg']),
  '--gap-target',
  '--control-text',
  '--control-lh',
  '--field-text',
  // The toast and tooltip heights, and the sheet's public metrics (§3.6, §3.6.1).
  '--toast-h',
  '--tooltip-h',
  '--sheet-radius',
  '--sheet-radius-bottom',
  '--sheet-pad',
  '--sheet-header-h',
  '--sheet-group-inset',
  '--sheet-row-h',
  '--sheet-row-pad',
];

/** Every name §1 defines; the light blocks (§2, D3-7) define exactly these. */
export const THEME_TOKENS: readonly string[] = [
  ...RAW_TOKENS,
  ...SEMANTIC_TOKENS,
  ...CONTROL_TOKENS,
];

/**
 * The names migration step 11 retired (09 §32; system-audit-2026-10 §3.3, §4): the M8 aliases
 * and the sizes S, M and L replaced. No module may read or define them again;
 * `tools/dev/token-aliases.js` rewrites each to its token.
 */
export const RETIRED_TOKENS: readonly string[] = [
  ...steps('--surface-', [0, 1, 2, 3]),
  '--accent-highlight',
  '--accent-highlight-strong',
  '--font-sans',
  ...steps('--text-', ['xs', 'sm', 'md', 'lg']),
  ...steps('--radius-', [1, 2, 3, 'round', 'pill']),
  '--icon-chrome',
  '--icon-toolbar',
  '--control-height',
  '--bar-button',
  '--chip-h',
];
