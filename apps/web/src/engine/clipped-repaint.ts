/**
 * The geometry of a clipped repaint (craft spec §5.3 item 9): where a change confined to a box
 * lands in a cached page bitmap. Pure functions, split from `EngineService` (which runs the
 * repaints); `engine-service.ts` re-exports `clippedRepaintBox` and `MAX_CLIPPED_REPAINTS`.
 */
import type { Rect, Rotation } from '@pdf-editor/document-model';

import { displayedSize, displayRectToUser, userRectToCss } from '../viewer/geometry';

/** What a clipped repaint needs of a page: its unrotated CropBox size, /Rotate and origin. */
export interface PageShape {
  readonly size: { readonly width: number; readonly height: number };
  readonly rotation: Rotation;
  readonly originX: number;
  readonly originY: number;
}

/** Whole-page bitmaps of one page a clipped repaint patches (the most recent); older go. */
export const MAX_CLIPPED_REPAINTS = 4;

/**
 * Where a clipped repaint of `rect` (user space) lands in a cached page bitmap of
 * `width` × `height` px rendered with `rotation` on top of the page's /Rotate: the box in
 * whole bitmap pixels that covers it, and the user-space clip that renders exactly that box.
 * Undefined when the rect misses the page.
 */
export function clippedRepaintBox(
  shape: PageShape,
  rotation: Rotation,
  rect: Rect,
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number; clip: Rect } | undefined {
  const frame = {
    size: shape.size,
    originX: shape.originX,
    originY: shape.originY,
    rotation: ((shape.rotation + rotation) % 360) as Rotation,
    scale: 1,
  };
  const shown = displayedSize(frame);
  if (!(shown.width > 0 && shown.height > 0 && width > 0 && height > 0)) return undefined;
  // The bitmap's own pixels per point on each axis (EmbedPDF rounds its size).
  const sx = width / shown.width;
  const sy = height / shown.height;
  const box = userRectToCss(frame, rect);
  const left = Math.max(0, Math.floor(box.left * sx));
  const top = Math.max(0, Math.floor(box.top * sy));
  const right = Math.min(width, Math.ceil((box.left + box.width) * sx));
  const bottom = Math.min(height, Math.ceil((box.top + box.height) * sy));
  if (right <= left || bottom <= top) return undefined;
  const clip = displayRectToUser(frame, {
    left: left / sx,
    top: top / sy,
    width: (right - left) / sx,
    height: (bottom - top) / sy,
  });
  return { left, top, width: right - left, height: bottom - top, clip };
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function unionRect(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}
