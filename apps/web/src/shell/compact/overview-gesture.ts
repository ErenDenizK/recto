/**
 * Pinch to overview on the phone (MOB-2; `docs/research/phone-2026-10/pinch-overview.md` §2.1,
 * §3.1), as pure functions: the static reader decides with these whether a pinch zooms or
 * opens the page overview, and the overview's own pinch steps its columns with them.
 *
 * - **Only from fit.** A pinch that starts at fit width (zoom ≤ 1.01) may open the overview;
 *   one that starts zoomed in clamps at fit as before (`rubberZoom`), so zooming out of a detail
 *   never overshoots into the grid.
 * - **Progress.** Below fit the finger ratio maps to the morph's progress p: 0 at fit, 1 once
 *   the fingers have closed to `OVERVIEW_FULL` of their distance (the page then sits in its
 *   tile). The page follows the fingers down; nothing past p = 1.
 * - **Arming.** More than 15 % below fit arms the overview, the tablet's number
 *   (`viewer/zoom-controller.ts` `GRID_THRESHOLD`), so both editions share one threshold. A
 *   fast pinch commits short of it: the ratio is projected with zoom's deceleration (r 0.99,
 *   research 18 §9), as the tablet projects a released zoom.
 * - **Columns.** Inside the overview a pinch steps 2 · 3 · 4 columns, one step per ×1.4 of
 *   finger distance (the full edition's `GRID_PINCH_STEP`); spreading past 2 columns by a
 *   further 15 % (`GRID_PINCH_OPEN`) arms the dive back into the page under the fingers.
 */
import { project } from '../../motion/velocity';

/** A pinch more than this far below fit arms the overview (`zoom-controller.ts`). */
export const OVERVIEW_ARM = 0.15;
/** The finger ratio at which the page has reached its tile (p = 1). */
export const OVERVIEW_FULL = 0.45;
/** A pinch may open the overview only when it starts at or below this zoom (fit width). */
export const OVERVIEW_FROM_ZOOM = 1.01;
/** Per-millisecond deceleration of a released pinch (research 18 §9: 0.99 for zoom). */
export const OVERVIEW_DECELERATION = 0.99;

/** The overview's column detents, from the largest tiles to the smallest. */
export const OVERVIEW_COLUMNS = [2, 3, 4] as const;
export type OverviewColumns = (typeof OVERVIEW_COLUMNS)[number];
/** The overview lands at three columns (MOB-2, MOB-7). */
export const DEFAULT_COLUMNS: OverviewColumns = 3;
/** A document this short lands at two columns instead (MOB-7). */
export const SHORT_DOCUMENT = 4;

/**
 * The columns the overview shows (MOB-7): the count the person pinched to this session, else
 * 2 for a document of `SHORT_DOCUMENT` pages or fewer (3 would leave a mostly empty screen of
 * small tiles), else 3.
 */
export function overviewColumns(chosen: OverviewColumns | null, pages: number): OverviewColumns {
  if (chosen !== null) return chosen;
  return pages <= SHORT_DOCUMENT ? 2 : DEFAULT_COLUMNS;
}
/** Finger scale per column step (the full edition's `GRID_PINCH_STEP`). */
export const COLUMN_STEP = 1.4;
/** Past the largest tiles by this much more, a release dives into the page (`GRID_PINCH_OPEN`). */
export const DIVE_PAST = 1.15;

/** Whether a pinch starting at `zoom` may open the overview. */
export function canOpenOverview(zoom: number): boolean {
  return zoom <= OVERVIEW_FROM_ZOOM;
}

/** The morph's progress for a finger ratio (relative to fit): 0 at fit, 1 at `OVERVIEW_FULL`. */
export function overviewProgress(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, (1 - ratio) / (1 - OVERVIEW_FULL)));
}

/** The progress at which the overview arms (ratio 1 − `OVERVIEW_ARM`). */
export const ARM_PROGRESS = OVERVIEW_ARM / (1 - OVERVIEW_FULL);

/** Whether a finger ratio is far enough below fit to arm the overview. */
export function overviewArmed(ratio: number): boolean {
  return ratio < 1 - OVERVIEW_ARM;
}

/**
 * Whether releasing at `ratio`, moving at `velocity` (ratio per second; negative while the
 * fingers close), opens the overview: armed where it is, or where its momentum would carry it.
 */
export function overviewCommits(ratio: number, velocity: number): boolean {
  return overviewArmed(ratio) || overviewArmed(ratio + project(velocity, OVERVIEW_DECELERATION));
}

/**
 * The release's velocity as the settle spring takes it (distances per second): the progress'
 * speed over the distance left to `target`, positive toward it, capped as the sheet's release
 * is (`sheet-release.ts`: up to 20 toward, 3 away).
 */
export function settleVelocity(ratioVelocity: number, progress: number, target: 0 | 1): number {
  const progressVelocity = -ratioVelocity / (1 - OVERVIEW_FULL);
  const distance = Math.abs(target - progress);
  if (distance < 1e-3) return 0;
  const toward = target === 1 ? progressVelocity : -progressVelocity;
  return Math.max(-3, Math.min(20, toward / distance));
}

/**
 * The columns a pinch of finger `scale` reaches from `start` columns (spreading, scale > 1,
 * gives fewer and larger tiles), and whether its release dives into the page under the
 * fingers.
 */
export function overviewPinch(
  start: OverviewColumns,
  scale: number,
): { readonly columns: OverviewColumns; readonly dives: boolean } {
  const safe = scale > 0 && Number.isFinite(scale) ? scale : 1;
  const steps = Math.log(safe) / Math.log(COLUMN_STEP);
  const startAt = OVERVIEW_COLUMNS.indexOf(start);
  const largest = 0;
  const at = startAt - Math.trunc(steps + (steps < 0 ? -1e-9 : 1e-9));
  const index = Math.min(OVERVIEW_COLUMNS.length - 1, Math.max(largest, at));
  const dives = safe >= COLUMN_STEP ** (startAt - largest) * DIVE_PAST;
  return { columns: OVERVIEW_COLUMNS[index] ?? start, dives };
}
