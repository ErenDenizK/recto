/**
 * The Recto mark's geometry (docs/brand/README.md "The mark: files and usage"): the owner's R,
 * traced from `docs/brand/logo/recto-mark-source.png` (1024 × 1024) into two flat polygons, the
 * top piece's bowl one smooth pair of cubics. Coordinates are the source's pixels, so the SVG
 * files overlay the PNG exactly; the trace is within 1.5 px of it on every edge.
 *
 * The one source for every drawing of the mark: `BrandMark.tsx` in the app, and
 * `tools/media/lib/app-icons.ts`, which writes the SVG files in `docs/brand/logo/` and
 * `public/icons/` and renders the favicon, touch and install icons from them. No imports: Node
 * strips the types and runs this file as it is.
 */

/** The two pieces: the top (stem head and bowl) and the bottom (stem foot and leg). */
export const MARK_PATHS = [
  'M296.9 112.7H653.9C776.4 112.7 900.4 158.1 900.4 328.2C900.4 472 812.8 552.9 730.7 552.9H481.3L645.2 378.9H368.6L143.4 604.2V266.3Z',
  'M368.6 501.8V634.9H553L839.7 921.6H563.3L368.6 727V921.6H143.4V727Z',
] as const;

/** The source's square frame, with its clear space. */
export const MARK_FRAME = '0 0 1024 1024';

/** A square tight around the mark (809 × 809, centred on its bounding box), for UI sizes. */
export const MARK_BOX = { x: 117.4, y: 112.7, size: 809 } as const;
export const MARK_VIEWBOX = `${String(MARK_BOX.x)} ${String(MARK_BOX.y)} ${String(MARK_BOX.size)} ${String(MARK_BOX.size)}`;

/**
 * The gradient (DSN-11 amendment, logo a2): the source's geometry, angle and knee kept, retoned
 * to the lighthouse beam, teal through mint to the accent lime. Linear at 46.75° from bottom
 * left to top right in user space, with the knee at 59 %.
 */
export const MARK_GRADIENT = {
  x1: 135.6,
  y1: 912.1,
  x2: 835.8,
  y2: 167.8,
  stops: [
    { offset: 0, color: '#2FB3A8' },
    { offset: 0.5944, color: '#6EEDBB' },
    { offset: 1, color: '#C8FB3D' },
  ],
} as const;

/**
 * The gradient on a light ground (system-audit-2026-10 §3.9: the mark keeps its gradient in
 * both themes): the same teal → mint → lime ramp at the same angle and knee, taken down
 * in lightness until every stop holds 3.3:1 against the light theme's glass (`#eceef1`) and
 * 3.9:1 against white (WCAG 1.4.11's 3:1 for a graphic). The dark ground's stops fall under 1.3:1
 * there, which is why the light theme drew the mark in ink until now.
 */
export const MARK_GRADIENT_LIGHT = {
  ...MARK_GRADIENT,
  stops: [
    { offset: 0, color: '#0D5E57' },
    { offset: 0.5944, color: '#136D5B' },
    { offset: 1, color: '#3F8A2A' },
  ],
} as const;

/**
 * Fener's mark (DSN-88; Labs flag `fener`, `state/fener.ts`): the same geometry, angle and knee,
 * the gradient taken from indigo to sky to green, the ramp the background glow draws. The brand
 * mark is fixed: it does not follow the theme colour preset (Çivit, Mor, Mavi).
 * On a light ground the hand-tuned stops, indigo `#3A42D9` (OKLCH 0.480 0.225 272), cerulean
 * `#0096C3` (0.629 0.123 228) and green `#3BCA60` (0.741 0.190 148), measured against white at
 * 7.1:1 (stem), 3.4:1 (knee) and 2.1:1 (tip).
 */
export const MARK_GRADIENT_FENER_LIGHT = {
  ...MARK_GRADIENT,
  stops: [
    { offset: 0, color: '#3A42D9' },
    { offset: 0.5944, color: '#0096C3' },
    { offset: 1, color: '#3BCA60' },
  ],
} as const;

/**
 * Fener's mark on a dark ground: the same three hues (272, 228, 148) lifted to L 0.66, 0.76 and
 * 0.86 at the light ramp's chroma, so the brand's dark look, a bright ramp that glows on the
 * graphite, stays recognisable. Against the dark tile (`#17191e` at its lightest) the stem holds
 * 5.4:1 (WCAG 1.4.11 asks 3:1 of a graphic), the knee 8.4:1 and the tip 12.3:1.
 */
export const MARK_GRADIENT_FENER_DARK = {
  ...MARK_GRADIENT,
  stops: [
    { offset: 0, color: '#6E86FD' },
    { offset: 0.5944, color: '#3FC0F2' },
    { offset: 1, color: '#6AF286' },
  ],
} as const;

/** The mono treatments (the brand's near-black on light, white on dark). */
export const MARK_INK = { black: '#0B0C0E', white: '#FFFFFF' } as const;
