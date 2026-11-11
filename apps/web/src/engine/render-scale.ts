/**
 * Render scales and page-sheet sizes (PF-19; `EngineService` renders at these scales and
 * `bitmap-cache.ts` names bitmaps by them). Pure functions, split from the service;
 * `engine-service.ts` re-exports all of it.
 */

/*
 * A render scale is device pixels per PDF point; it names a bitmap in the cache
 * (`bitmap-cache.ts`). Two kinds of scale are used:
 *
 * - Exact scales (`chooseScale`) for final Read-mode renders and tiles: the bitmap maps 1:1
 *   onto the page sheet's device pixels, so the browser never resamples PDFium's
 *   anti-aliased glyphs. Rounded to 4 decimals so equal zooms share one cache key.
 * - Quarter-octave buckets (`chooseBucket`, 2^(k/4)) for thumbnails, where a few shared
 *   variants matter more than 1:1 pixels (at most ~19% oversampling, downscaled by CSS).
 *
 * Previews (`EngineService.preview`) take any cached scale, whatever its kind.
 */
const STEPS_PER_OCTAVE = 4;
const MIN_BUCKET = 1 / 64;
const MAX_BUCKET = 16;
/** Largest bitmap we render in one piece (~64 MB). Beyond this, tiles (`TiledPage`) help. */
export const MAX_BITMAP_PIXELS = 4096 * 4096;
/**
 * Read mode's whole-page budget on every edition (4 MP, 16 MB a page; PF-19): a fit-width
 * page at 1440 × 900 and DPR 2 would otherwise be a 9.35 MP bitmap for every mounted page,
 * offscreen ones included, and on a DPR 3 phone a page at 2× is 6–16 MP, where browsers cap
 * the canvas memory of a tab. Above it the base bitmap is capped and the visible page is
 * covered by exact-scale tiles (`TiledPage`), so what is in view stays 1:1. A Letter or A4
 * page at 100% on a DPR 2 screen (3.5 MP) is under it and drawn whole, as before.
 */
export const READ_BITMAP_PIXELS = 2048 * 2048;

function roundScale(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Smallest bucket >= scale. */
export function scaleBucket(scale: number): number {
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const k = Math.ceil(Math.log2(safe) * STEPS_PER_OCTAVE - 1e-9);
  return roundScale(Math.min(MAX_BUCKET, Math.max(MIN_BUCKET, 2 ** (k / STEPS_PER_OCTAVE))));
}

/** Largest bucket <= scale. */
export function scaleBucketBelow(scale: number): number {
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const k = Math.floor(Math.log2(safe) * STEPS_PER_OCTAVE + 1e-9);
  return roundScale(Math.min(MAX_BUCKET, Math.max(MIN_BUCKET, 2 ** (k / STEPS_PER_OCTAVE))));
}

/** Largest scale at which a `widthPt` × `heightPt` page stays within `maxPixels`. */
function maxScaleFor(widthPt: number, heightPt: number, maxPixels = MAX_BITMAP_PIXELS): number {
  return Math.sqrt(Math.min(maxPixels, MAX_BITMAP_PIXELS) / Math.max(1, widthPt * heightPt));
}

/**
 * The bucket to render a thumbnail at: at least `scale` (device pixels per point), but
 * never more than `MAX_BITMAP_PIXELS` for a page of `widthPt` × `heightPt`.
 */
export function chooseBucket(scale: number, widthPt: number, heightPt: number): number {
  const wanted = scaleBucket(scale);
  const maxScale = maxScaleFor(widthPt, heightPt);
  return wanted <= maxScale ? wanted : scaleBucketBelow(maxScale);
}

/** Bounds of an exact scale (zoom 500% at DPR 3 is 20); the pixel cap bounds the rest. */
const MAX_EXACT_SCALE = 64;

/** `scale` made finite, clamped and rounded to 4 decimals (a stable cache key). */
export function exactScaleKey(scale: number): number {
  const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return roundScale(Math.min(MAX_EXACT_SCALE, Math.max(MIN_BUCKET, safe)));
}

/**
 * The scale to render a Read-mode page at: exactly `scale` (`exactScaleKey`) so the bitmap
 * is drawn 1:1, or, when that would exceed `maxPixels` (at most `MAX_BITMAP_PIXELS`), the
 * largest bucket below the cap (the page is then capped and `TiledPage` covers it with
 * exact-scale tiles). Read mode passes a smaller budget (`READ_BITMAP_PIXELS`).
 */
export function chooseScale(
  scale: number,
  widthPt: number,
  heightPt: number,
  maxPixels = MAX_BITMAP_PIXELS,
): number {
  const wanted = exactScaleKey(scale);
  const maxScale = maxScaleFor(widthPt, heightPt, maxPixels);
  return wanted <= maxScale ? wanted : scaleBucketBelow(maxScale);
}

/** True when `chooseScale` caps the page below `scale` (so tiles are needed). */
export function isCapped(
  scale: number,
  widthPt: number,
  heightPt: number,
  maxPixels = MAX_BITMAP_PIXELS,
): boolean {
  return chooseScale(scale, widthPt, heightPt, maxPixels) < exactScaleKey(scale);
}

/**
 * Device pixels per point that make a page `widthPt` wide fill `cssWidth` CSS pixels
 * exactly: the sheet's whole device-pixel width over its width in points.
 */
export function exactScale(cssWidth: number, widthPt: number, dpr: number): number {
  const device = Math.max(1, Math.round(cssWidth * dpr));
  return exactScaleKey(device / Math.max(1e-3, widthPt));
}

/** Side of a bitmap PDFium renders: EmbedPDF sizes it `max(1, round(side × scale))`. */
export function bitmapSide(sidePt: number, scale: number): number {
  return Math.max(1, Math.round(sidePt * scale));
}

/**
 * CSS size of a Read-mode page sheet at `cssScale` (CSS px per point), snapped to whole
 * device pixels and matched to the bitmap `chooseScale(exactScale(…))` renders: the width
 * is the nearest device pixel, the height is what EmbedPDF makes of the page height at
 * that exact scale (`bitmapSide`), so the canvas backing store and the sheet agree pixel
 * for pixel and the canvas is never resampled. The height may therefore be up to about a
 * device pixel off `heightPt × cssScale × dpr` (the aspect ratio follows the snapped width).
 *
 * Exactness limits: the 4-decimal scale moves `widthPt × scale` by at most
 * `widthPt × 5e-5` px (0.03 px for Letter), so widths agree for pages under ~10,000 pt;
 * PDFium reports page sizes as float32, which can flip a side lying on exactly .5 px by one
 * pixel. Either way the bitmap is then stretched by one pixel, as before this snapping.
 * At DPR 1.5 or 3 the browser stores the CSS size in 1/64 px layout units, so it lands
 * within 1/64 CSS px of the device-pixel size and painting snaps it to whole pixels.
 */
export function sheetSize(
  widthPt: number,
  heightPt: number,
  cssScale: number,
  dpr: number,
): { readonly width: number; readonly height: number } {
  const ratio = dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
  const width = Math.max(1, Math.round(widthPt * cssScale * ratio));
  const scale = exactScale(width / ratio, widthPt, ratio);
  return { width: width / ratio, height: bitmapSide(heightPt, scale) / ratio };
}
