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
 * The gradient, sampled from the source (RMS error 0.3 of 255): linear at 46.75° from bottom
 * left to top right in user space, mint through lime to a yellow lime, with the knee at 59 %.
 */
export const MARK_GRADIENT = {
  x1: 135.6,
  y1: 912.1,
  x2: 835.8,
  y2: 167.8,
  stops: [
    { offset: 0, color: '#69EAA3' },
    { offset: 0.5944, color: '#CBFF5F' },
    { offset: 1, color: '#EDFA6D' },
  ],
} as const;

/** The mono treatments (the brand's near-black on light, white on dark). */
export const MARK_INK = { black: '#0B0C0E', white: '#FFFFFF' } as const;
