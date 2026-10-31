/**
 * What a page shows before its own render lands (R26 concept 2 "opening in light", DSN-64;
 * epics-r25 Epic 1 lane 2): never bare white. The best bitmap the cache holds is drawn
 * stretched (`BitmapCache.best`, the grid's thumbnail among them); a page with none asks for a
 * soft render at a quarter of its scale first, which costs a sixteenth of the pixels and is
 * cached with the rest (the same byte budget, so the iPad's cache stays bounded, B17); and
 * until anything arrives the sheet is the paper tone (`--page-paper`). The sharp render then
 * cross-fades over it (`paint-fade.ts`).
 *
 * **The seed (DSN-87, `masa.md` §2.7 step 4)** is the first rung of that ladder, above the best
 * cached bitmap: opening a document from the desk, the cover the lifted tile shows is registered
 * for the page the reader will land on (by source id and page index), so the arriving page shows
 * the same pixels the travelling cover shows and the dissolve is not seen. It is not motion, so
 * it applies under reduced motion too. A seed is dropped when a real render lands (or the open
 * ends), at most `SEED_LIMIT` are held, and the page canvas it is drawn on keeps `data-state`
 * `preview` (the sharp render cross-fades over it, `PageCanvas`).
 */

/** The scale of the soft render, as a fraction of the page's exact scale. */
export const SOFT_FRACTION = 0.25;

/** The veil over a soft bitmap (`PageCanvas.module.css` `.canvas[data-soft]`, kept in step). */
export const SOFT_OPACITY = 0.88;

/** A bitmap below half the asked scale is a placeholder, shown under a veil until it sharpens. */
export function isSoft(shown: number, asked: number): boolean {
  return shown < asked * 0.5;
}

/** The most seeds held at once (one open is the usual; a second press before the first lands). */
export const SEED_LIMIT = 4;

/** What a seed is drawn from: the cover's pixels, already decoded. */
export type SeedImage = HTMLCanvasElement | ImageBitmap | OffscreenCanvas;

const seeds = new Map<string, SeedImage>();

const seedKey = (sourceId: string, index: number): string => `${sourceId}:${index}`;

/** Registers the cover for page `index` of source `sourceId` (replacing an earlier one). */
export function seedPage(sourceId: string, index: number, image: SeedImage): void {
  const key = seedKey(sourceId, index);
  seeds.delete(key);
  seeds.set(key, image);
  for (const old of seeds.keys()) {
    if (seeds.size <= SEED_LIMIT) break;
    seeds.delete(old);
  }
}

/** The seed of a page, if one is registered. */
export function seedOf(sourceId: string, index: number): SeedImage | undefined {
  return seeds.get(seedKey(sourceId, index));
}

/** Drops a page's seed (a real render landed, or the open ended). */
export function dropSeed(sourceId: string, index: number): void {
  seeds.delete(seedKey(sourceId, index));
}

/** Drops every seed. */
export function dropSeeds(): void {
  seeds.clear();
}

/**
 * Whether `canvas` may take a seed now: `PageCanvas` has set it up (it stamps `data-revision`
 * in its first effect, which would otherwise clear what is drawn) and it still shows nothing.
 * A page with a bitmap of its own, a preview or the render, keeps it.
 */
export function canTakeSeed(canvas: Pick<HTMLElement, 'dataset'>): boolean {
  return canvas.dataset.state === 'placeholder' && canvas.dataset.revision !== undefined;
}

/**
 * Draws `image` onto a page canvas that shows nothing yet, as a `preview` (the sharp render
 * cross-fades over it, `PageCanvas`). Returns whether it drew.
 */
export function paintSeed(canvas: HTMLCanvasElement, image: SeedImage): boolean {
  if (!canTakeSeed(canvas) || image.width === 0 || image.height === 0) return false;
  const context = canvas.getContext('2d');
  if (!context) return false;
  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0);
  canvas.dataset.state = 'preview';
  canvas.dataset.bucket = '0';
  return true;
}
