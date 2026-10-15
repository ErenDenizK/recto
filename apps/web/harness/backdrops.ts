/**
 * The rendered-pixel harness's query and backdrops (components/09-primitives.md §28, spec 09.11;
 * docs/specs/redesign.md D3-1). Shared by the harness page (`harness/main.tsx`) and
 * `e2e/glass-pixels.spec.ts`, so what the page paints and what the spec expects come from one
 * table.
 *
 * `?entry=<coverage registry id>&backdrop=<name>&glass=clear|tinted|solid&theme=dark|light`
 * renders one glass surface of `styles/coverage-registry.ts` at its smallest registered size,
 * centred on whole CSS pixels over a backdrop that fills the viewport, with the material classes
 * its entry gives (09 §26's `.mat-<tier>.s<σ>`, `materials.css`).
 *
 * Backdrops are uniform except `edge`, and every colour is known, so a 4 × 4 median anywhere
 * inside the surface has one right answer: the token model of `e2e/support/pixels.ts`.
 */

export type GlassMode = 'clear' | 'tinted' | 'solid';
export type Theme = 'dark' | 'light';

/** What sits under the surface, CSS-px exact. */
export interface Backdrop {
  readonly name: string;
  /** What a person would call it. */
  readonly label: string;
  /**
   * Under the surface: an sRGB colour, or a token of `tokens.css` (resolved in the theme under
   * test, so the canvas follows D3's colour work).
   */
  readonly under: readonly [number, number, number] | `--${string}`;
  /**
   * Beyond a band around the surface, when it differs from `under` (the sharp edge). The band
   * reaches three σ of the surface's own blur on every side (`harness/main.tsx`), as far as a
   * Gaussian kernel reads.
   */
  readonly beyond?: readonly [number, number, number];
}

/**
 * The white page, the extremes, mid grey and the bare canvas (the worst cases of `language.md`
 * §2.2: dark glass is floored over white, light glass over black), plus a sharp edge: white under
 * the surface and a 3σ band around it, black beyond. Within the band the model holds whatever
 * the engine does at the surface's border; a blur that reads past it (a radius other than the
 * token's) darkens the surface's edges first, which the uniform backdrops cannot show.
 */
export const BACKDROPS: readonly Backdrop[] = [
  { name: 'white', label: 'a white page', under: [255, 255, 255] },
  { name: 'black', label: 'black', under: [0, 0, 0] },
  { name: 'grey', label: 'mid grey', under: [128, 128, 128] },
  { name: 'canvas', label: 'the bare canvas', under: '--canvas' },
  {
    name: 'edge',
    label: 'a white page with a sharp edge',
    under: [255, 255, 255],
    beyond: [0, 0, 0],
  },
];

/** The harness viewport: room for the largest registry entry and the sharp edge's band. */
export const HARNESS_VIEWPORT = { width: 960, height: 640 } as const;

export interface HarnessQuery {
  readonly entry: string;
  readonly backdrop: string;
  readonly glass: GlassMode;
  readonly theme: Theme;
}

/**
 * The adaptive look (decisions GLS-9, `src/styles/adaptive-tone.ts`, whose test keeps these in
 * step): chips and bars turn light glass over a backdrop brighter than Y 0.45 and dark below
 * 0.20, never under Solid. The harness lays the look on the surface as the app's runtime would,
 * and the spec models that look.
 */
export const ADAPTIVE_LOOK = { tiers: ['chip', 'bar'], lightAbove: 0.45, darkBelow: 0.2 } as const;

/** WCAG relative luminance of 8-bit sRGB. */
function luminanceOf(rgb: readonly [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** The look a surface of `tier` takes over `under` in `theme` (its own unless it turns). */
export function lookOver(
  tier: string,
  theme: Theme,
  glass: GlassMode,
  under: readonly [number, number, number],
): Theme {
  if (glass === 'solid' || !(ADAPTIVE_LOOK.tiers as readonly string[]).includes(tier)) return theme;
  const y = luminanceOf(under);
  if (theme === 'dark' && y > ADAPTIVE_LOOK.lightAbove) return 'light';
  if (theme === 'light' && y < ADAPTIVE_LOOK.darkBelow) return 'dark';
  return theme;
}

/** The harness URL's search part for one surface. */
export function harnessSearch(query: HarnessQuery): string {
  const params = new URLSearchParams({
    entry: query.entry,
    backdrop: query.backdrop,
    glass: query.glass,
    theme: query.theme,
  });
  return `?${params.toString()}`;
}

/** The top-left corner of a `width` × `height` surface centred in the viewport, whole px. */
export function surfaceOrigin(
  width: number,
  height: number,
  viewport: { readonly width: number; readonly height: number } = HARNESS_VIEWPORT,
): { readonly x: number; readonly y: number } {
  return {
    x: Math.round((viewport.width - width) / 2),
    y: Math.round((viewport.height - height) / 2),
  };
}
