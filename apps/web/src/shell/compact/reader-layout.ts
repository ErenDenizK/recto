/**
 * The compact reader's geometry (ADR-0033 §2.3 "Reading"), as pure functions: pages in one
 * continuous column at fit width, the rows a viewport needs, the current page, and the
 * anchors that keep a point under the fingers when the zoom changes.
 *
 * - **Zoom** is relative to fit width: 1 fits the widest page between the side margins
 *   (8 px, or the safe area where it is larger), 2 is the double-tap zoom, 5 the most.
 * - **Gaps scale with the zoom**, so a zoomed layout is the fitted one scaled about any
 *   point: the transform a pinch shows while the fingers move (`pinchTransform`) and the
 *   layout committed when they lift agree page for page, and nothing jumps at the commit.
 * - **Sheets are snapped** to device pixels (`sheetSize`), as Read mode's, so the exact-scale
 *   bitmap draws 1:1.
 */
import type { Size } from '@pdf-editor/document-model';

import { sheetSize } from '../../engine/engine-service';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
/** Double tap toggles between fit and this. */
export const DOUBLE_TAP_ZOOM = 2;
/** Space between pages at fit width (scaled with the zoom), CSS px. */
export const PAGE_GAP = 8;
/** The page column's side margin at fit width (01-frame F1 §2: 8 px on compact). */
export const PAGE_MARGIN = 8;

export interface ReaderFrame {
  /** The scroller's client size, CSS px. */
  readonly width: number;
  readonly height: number;
  /** Safe-area side insets (landscape notches), CSS px. */
  readonly insetLeft: number;
  readonly insetRight: number;
  /** Room above the first page and below the last: the bars' bands, CSS px. */
  readonly padTop: number;
  readonly padBottom: number;
}

export interface PageBox {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface ReaderLayout {
  /** CSS px per PDF point. */
  readonly scale: number;
  readonly zoom: number;
  readonly boxes: readonly PageBox[];
  /** The column's (scroll content's) size, CSS px. */
  readonly width: number;
  readonly height: number;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** CSS px per point that fits the widest page between the margins. */
export function fitScale(sizes: readonly Size[], frame: ReaderFrame): number {
  let widest = 1;
  for (const size of sizes) widest = Math.max(widest, size.width);
  const side = Math.max(PAGE_MARGIN, frame.insetLeft) + Math.max(PAGE_MARGIN, frame.insetRight);
  return Math.max(0.01, (frame.width - side) / widest);
}

/** Lays the pages out at `zoom` (relative to fit width) for a device pixel ratio. */
export function layoutPages(
  sizes: readonly Size[],
  frame: ReaderFrame,
  zoom: number,
  dpr: number,
): ReaderLayout {
  const z = clampZoom(zoom);
  const scale = fitScale(sizes, frame) * z;
  const gap = PAGE_GAP * z;
  const left = Math.max(PAGE_MARGIN, frame.insetLeft);
  const right = Math.max(PAGE_MARGIN, frame.insetRight);
  const sheets = sizes.map((size) => sheetSize(size.width, size.height, scale, dpr));
  let widest = 0;
  for (const sheet of sheets) widest = Math.max(widest, sheet.width);
  const width = Math.max(frame.width, left + widest + right);
  const centre = left + (width - left - right) / 2;
  const boxes: PageBox[] = [];
  let top = frame.padTop;
  for (const sheet of sheets) {
    // Whole device pixels, so a page's edge never falls between two.
    const x = Math.round((centre - sheet.width / 2) * dpr) / dpr;
    boxes.push({ top, left: x, width: sheet.width, height: sheet.height });
    top += sheet.height + gap;
  }
  const height = (boxes.length > 0 ? top - gap : frame.padTop) + frame.padBottom;
  return { scale, zoom: z, boxes, width, height: Math.max(height, frame.height) };
}

/** The first and last page index within `overscan` px of the viewport (inclusive). */
export function visibleRange(
  boxes: readonly PageBox[],
  scrollTop: number,
  viewportHeight: number,
  overscan = 0,
): { readonly first: number; readonly last: number } {
  if (boxes.length === 0) return { first: 0, last: -1 };
  const top = scrollTop - overscan;
  const bottom = scrollTop + viewportHeight + overscan;
  // First page whose bottom reaches the top edge.
  let lo = 0;
  let hi = boxes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const box = boxes[mid] as PageBox;
    if (box.top + box.height < top) lo = mid + 1;
    else hi = mid;
  }
  const first = lo;
  let last = first;
  while (last + 1 < boxes.length && (boxes[last + 1] as PageBox).top <= bottom) last += 1;
  return { first, last };
}

/**
 * The page most visible between `top` and `bottom` (content px: the area the bars leave
 * free); the first on ties, so short pages read 1, 2, ….
 */
export function mostVisiblePage(
  boxes: readonly PageBox[],
  range: { readonly first: number; readonly last: number },
  top: number,
  bottom: number,
): number {
  let best = range.first;
  let bestVisible = -1;
  for (let i = range.first; i <= range.last; i++) {
    const box = boxes[i];
    if (!box) continue;
    const visible = Math.min(box.top + box.height, bottom) - Math.max(box.top, top);
    if (visible > bestVisible + 0.5) {
      best = i;
      bestVisible = visible;
    }
  }
  return Math.max(0, best);
}

/** A point of the document that a zoom change keeps under a viewport position. */
export interface ZoomAnchor {
  readonly page: number;
  /** Position in the page box: 0 = left / top edge, 1 = right / bottom (may lie outside). */
  readonly fx: number;
  readonly fy: number;
}

/** The anchor for viewport point (vx, vy), given the scroll position. */
export function anchorAt(
  layout: ReaderLayout,
  scrollLeft: number,
  scrollTop: number,
  vx: number,
  vy: number,
): ZoomAnchor | null {
  const { boxes } = layout;
  if (boxes.length === 0) return null;
  const x = scrollLeft + vx;
  const y = scrollTop + vy;
  // The page whose band (with the gap below it) holds the point; the nearest at the ends.
  let page = boxes.length - 1;
  for (let i = 0; i < boxes.length - 1; i++) {
    if (y < (boxes[i + 1] as PageBox).top) {
      page = i;
      break;
    }
  }
  const box = boxes[page] as PageBox;
  return {
    page,
    fx: (x - box.left) / Math.max(1, box.width),
    fy: (y - box.top) / Math.max(1, box.height),
  };
}

/** The scroll position that puts `anchor` at viewport point (vx, vy) in `layout`, clamped. */
export function scrollForAnchor(
  layout: ReaderLayout,
  frame: Pick<ReaderFrame, 'width' | 'height'>,
  anchor: ZoomAnchor,
  vx: number,
  vy: number,
): { readonly left: number; readonly top: number } {
  const box = layout.boxes[anchor.page];
  if (!box) return { left: 0, top: 0 };
  const left = box.left + anchor.fx * box.width - vx;
  const top = box.top + anchor.fy * box.height - vy;
  return {
    left: clamp(left, 0, Math.max(0, layout.width - frame.width)),
    top: clamp(top, 0, Math.max(0, layout.height - frame.height)),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A transform of the page stage (origin at its top-left): translate, then scale. */
export interface StageTransform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const IDENTITY: StageTransform = { x: 0, y: 0, scale: 1 };

export function transformCss(t: StageTransform): string {
  return `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
}

/**
 * The stage transform of a pinch: the content point that was under the fingers' centre
 * `start` (viewport px) when they landed shows under their centre `now`, scaled by `ratio`.
 * `scroll` is the scroll position, unchanged during the gesture.
 */
export function pinchTransform(
  scroll: { readonly left: number; readonly top: number },
  start: { readonly x: number; readonly y: number },
  now: { readonly x: number; readonly y: number },
  ratio: number,
): StageTransform {
  return {
    x: now.x + scroll.left - ratio * (scroll.left + start.x),
    y: now.y + scroll.top - ratio * (scroll.top + start.y),
    scale: ratio,
  };
}

/**
 * The stage transform that shows the current layout exactly where `next` will show it once
 * committed with the scroll position `nextScroll`: the anchor page lands on its new box. A
 * settle animates to it, then the commit swaps the layout in with nothing moving.
 */
export function settleTransform(
  current: ReaderLayout,
  scroll: { readonly left: number; readonly top: number },
  next: ReaderLayout,
  nextScroll: { readonly left: number; readonly top: number },
  page: number,
): StageTransform {
  const from = current.boxes[page];
  const to = next.boxes[page];
  if (!from || !to) return IDENTITY;
  const scale = to.width / Math.max(1, from.width);
  return {
    x: to.left - nextScroll.left + scroll.left - scale * from.left,
    y: to.top - nextScroll.top + scroll.top - scale * from.top,
    scale,
  };
}

/** Whether two transforms differ by less than half a pixel on screen. */
export function nearlySame(a: StageTransform, b: StageTransform): boolean {
  return (
    Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.scale - b.scale) < 1e-3
  );
}

/** Double tap: back to fit from any zoom, else the double-tap zoom. */
export function doubleTapZoom(zoom: number): number {
  return zoom > MIN_ZOOM + 0.01 ? MIN_ZOOM : DOUBLE_TAP_ZOOM;
}

/**
 * The zoom a pinch shows for a finger ratio: free inside the range, resisting past it (a
 * quarter of the overshoot shows), so the fingers feel the limit before the settle.
 */
export function rubberZoom(zoom: number): number {
  if (zoom > MAX_ZOOM) return MAX_ZOOM + (zoom - MAX_ZOOM) * 0.25;
  if (zoom < MIN_ZOOM) return MIN_ZOOM - (MIN_ZOOM - zoom) * 0.25;
  return zoom;
}
