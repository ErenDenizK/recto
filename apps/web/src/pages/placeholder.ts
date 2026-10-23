/**
 * What a page shows before its own render lands (R26 concept 2 "opening in light", DSN-64;
 * epics-r25 Epic 1 lane 2): never bare white. The best bitmap the cache holds is drawn
 * stretched (`BitmapCache.best`, the grid's thumbnail among them); a page with none asks for a
 * soft render at a quarter of its scale first, which costs a sixteenth of the pixels and is
 * cached with the rest (the same byte budget, so the iPad's cache stays bounded, B17); and
 * until anything arrives the sheet is the paper tone (`--page-paper`). The sharp render then
 * cross-fades over it (`paint-fade.ts`).
 */

/** The scale of the soft render, as a fraction of the page's exact scale. */
export const SOFT_FRACTION = 0.25;

/** A bitmap below half the asked scale is a placeholder, shown under a veil until it sharpens. */
export function isSoft(shown: number, asked: number): boolean {
  return shown < asked * 0.5;
}
