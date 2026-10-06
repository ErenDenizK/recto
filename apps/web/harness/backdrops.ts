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
