/**
 * The thumbnail list's geometry (`components/06-navigation.md` N2 §2): the box a thumbnail
 * fits in, each row's offset, and where a drag lands. Pure, so the drop gap and the row
 * heights are unit-tested apart from the DOM.
 *
 *   row: padding 8 · thumbnail (page aspect, centred) · gap 8 · label 16 · padding 8
 *   rows sit 2 px apart, so two hover washes never touch; the gap bar sits in that space
 */

/** Vertical parts of a row (CSS px), as `ThumbnailList.module.css` lays them out. */
export const ROW = {
  padTop: 8,
  labelGap: 8,
  label: 16,
  padBottom: 8,
  /** Between rows. */
  gap: 2,
  /** Before the first row and after the last. */
  listStart: 4,
  listEnd: 16,
} as const;

/** A row's height without the space after it. */
export function rowHeight(boxHeight: number): number {
  return ROW.padTop + boxHeight + ROW.labelGap + ROW.label + ROW.padBottom;
}

/**
 * The box a thumbnail fits in for a list `width` px wide: about half the width, so it reads
 * as Preview's at the default 280 px (128 × 166, 06 N2 §2) and grows a little with a wider
 * sidebar; portrait at 1 : 1.3.
 */
export function thumbnailBox(width: number): { readonly width: number; readonly height: number } {
  const w = Math.round(Math.min(168, Math.max(88, (width - 32) * 0.52)));
  return { width: w, height: Math.round(w * 1.3) };
}

export interface RowOffsets {
  readonly rows: readonly { readonly start: number; readonly size: number }[];
  readonly paddingStart: number;
  readonly paddingEnd: number;
  readonly total: number;
}

/** Each row's start and size (the size includes the space after it), from the box heights. */
export function rowOffsets(boxHeights: readonly number[]): RowOffsets {
  let at = ROW.listStart;
  const rows = boxHeights.map((height) => {
    const size = rowHeight(height) + ROW.gap;
    const row = { start: at, size };
    at += size;
    return row;
  });
  return { rows, paddingStart: ROW.listStart, paddingEnd: ROW.listEnd, total: at + ROW.listEnd };
}

/**
 * The gap a drag at `y` (list coordinates) lands in: before row `i` while above its middle,
 * else after the last row. Gaps count before the moved pages are removed, as `movePages`
 * takes them.
 */
export function dropIndexAt(offsets: RowOffsets, y: number): number {
  const index = offsets.rows.findIndex((row) => y < row.start + row.size / 2);
  return index < 0 ? offsets.rows.length : index;
}

/** Where the gap bar for gap `index` sits (its top, list coordinates; the bar is 2 px). */
export function gapOffset(offsets: RowOffsets, index: number): number {
  const { rows } = offsets;
  if (rows.length === 0) return offsets.paddingStart;
  if (index <= 0) return (rows[0]?.start ?? 0) - ROW.gap;
  const before = rows[Math.min(index, rows.length) - 1];
  return before ? before.start + before.size - ROW.gap : 0;
}
