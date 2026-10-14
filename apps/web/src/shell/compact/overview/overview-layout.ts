/**
 * The phone's page overview geometry (MOB-2; `docs/research/phone-2026-10/pinch-overview.md`
 * §3.2), as pure functions: tiles in rows of 2, 3 or 4 columns across the screen, each page
 * fitted into its slot, the rows a viewport needs (virtualisation), and the scroll position
 * that puts a page's tile under a point (the morph's anchor and the column steps' anchor).
 *
 * Coordinates are the grid's content CSS px (the scroll content); a viewport point is a content
 * point less the scroll position.
 */
import type { Size } from '@pdf-editor/document-model';

/** Space between columns and rows, CSS px. */
export const TILE_GAP = 12;
/** The grid's least side margin, CSS px (or the safe area where it is larger). */
export const GRID_MARGIN = 12;
/** A slot is this many times as tall as it is wide (portrait pages fill it, as the sheet did). */
export const SLOT_ASPECT = 1.35;
/** The page number under each tile, CSS px. */
export const LABEL_HEIGHT = 24;

export interface GridFrame {
  /** The scroller's client size, CSS px. */
  readonly width: number;
  readonly height: number;
  readonly insetLeft: number;
  readonly insetRight: number;
  /** Room above the first row (the safe area and a margin) and below the last (the bar). */
  readonly padTop: number;
  readonly padBottom: number;
}

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface GridLayout {
  readonly columns: number;
  /** A slot's width and its thumbnail area's height, CSS px. */
  readonly slotWidth: number;
  readonly slotHeight: number;
  /** One row: the slot, its label and the gap below. */
  readonly rowHeight: number;
  readonly rows: number;
  readonly left: number;
  readonly padTop: number;
  /** The scroll content's height. */
  readonly height: number;
  readonly count: number;
}

/** The width the column detents are named for: a phone held upright, CSS px. */
export const DETENT_WIDTH = 390;

/**
 * The columns a detent (2 · 3 · 4, named for a phone held upright) gives at `width`: as many
 * more as keep the tiles about that size, so a phone on its side shows more pages, not larger.
 */
export function columnsFor(detent: number, width: number): number {
  return Math.max(detent, Math.round((detent * width) / DETENT_WIDTH));
}

/** Lays `count` pages out in `columns` columns for `frame`. */
export function gridLayout(count: number, frame: GridFrame, columns: number): GridLayout {
  const cols = Math.max(1, Math.round(columns));
  const left = Math.max(GRID_MARGIN, frame.insetLeft);
  const right = Math.max(GRID_MARGIN, frame.insetRight);
  const inner = Math.max(cols, frame.width - left - right);
  const slotWidth = Math.max(1, (inner - (cols - 1) * TILE_GAP) / cols);
  const slotHeight = Math.round(slotWidth * SLOT_ASPECT);
  const rowHeight = slotHeight + LABEL_HEIGHT + TILE_GAP;
  const rows = Math.ceil(count / cols);
  const height = frame.padTop + Math.max(0, rows * rowHeight - TILE_GAP) + frame.padBottom;
  return {
    columns: cols,
    slotWidth,
    slotHeight,
    rowHeight,
    rows,
    left,
    padTop: frame.padTop,
    height: Math.max(height, frame.height),
    count,
  };
}

/** The slot of page `index` (its thumbnail area, without the label). */
export function slotBox(layout: GridLayout, index: number): Box {
  const row = Math.floor(index / layout.columns);
  const column = index % layout.columns;
  return {
    left: layout.left + column * (layout.slotWidth + TILE_GAP),
    top: layout.padTop + row * layout.rowHeight,
    width: layout.slotWidth,
    height: layout.slotHeight,
  };
}

/**
 * The page's own box in its slot: fitted, centred across and resting on the slot's foot, so
 * the labels of one row line up under pages of any shape. The morph lands the page here.
 */
export function tileBox(layout: GridLayout, index: number, size: Size): Box {
  const slot = slotBox(layout, index);
  const scale = Math.min(
    slot.width / Math.max(1, size.width),
    slot.height / Math.max(1, size.height),
  );
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  return {
    left: slot.left + (slot.width - width) / 2,
    top: slot.top + slot.height - height,
    width,
    height,
  };
}

/** The first and last row within `overscan` px of the viewport (inclusive; -1 when none). */
export function rowsInView(
  layout: GridLayout,
  scrollTop: number,
  viewportHeight: number,
  overscan = 0,
): { readonly first: number; readonly last: number } {
  if (layout.rows === 0) return { first: 0, last: -1 };
  const top = scrollTop - overscan - layout.padTop;
  const bottom = scrollTop + viewportHeight + overscan - layout.padTop;
  const first = Math.max(0, Math.floor(top / layout.rowHeight));
  const last = Math.min(layout.rows - 1, Math.floor(bottom / layout.rowHeight));
  return { first: Math.min(first, layout.rows - 1), last: Math.max(last, first) };
}

/** The scroll position's range for `layout` in a viewport `viewportHeight` tall. */
export function maxScroll(layout: GridLayout, viewportHeight: number): number {
  return Math.max(0, layout.height - viewportHeight);
}

/**
 * The scroll position that puts the centre of page `index`'s slot at viewport height `y`, as
 * near as the content allows.
 */
export function scrollToCentre(
  layout: GridLayout,
  index: number,
  y: number,
  viewportHeight: number,
): number {
  const slot = slotBox(layout, index);
  const top = slot.top + slot.height / 2 - y;
  return Math.min(maxScroll(layout, viewportHeight), Math.max(0, top));
}

/** The page whose slot (with its label and the gaps around it) holds content point (x, y). */
export function pageAtPoint(layout: GridLayout, x: number, y: number): number {
  if (layout.count === 0) return -1;
  const row = Math.min(
    layout.rows - 1,
    Math.max(0, Math.floor((y - layout.padTop) / layout.rowHeight)),
  );
  const pitch = layout.slotWidth + TILE_GAP;
  const column = Math.min(
    layout.columns - 1,
    Math.max(0, Math.floor((x - layout.left + TILE_GAP / 2) / pitch)),
  );
  return Math.min(layout.count - 1, row * layout.columns + column);
}
