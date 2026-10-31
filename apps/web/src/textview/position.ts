/**
 * Where things are in the Text view (PRD-36, "Keeping the place"): the page's user space to
 * the display space the blocks live in and back, and a reader place (a page and an offset in
 * display points) to the block there and back. Pure; the one place the rotation is applied is
 * `viewer/geometry.ts`, used here at one unit per point (`scale: 1`).
 */
import type { Rect } from '@pdf-editor/document-model';
import type { TextViewBlock, TextViewPage } from '@pdf-editor/engine';

import { displayRectToUser, type PageFrame, userRectToCss } from '../viewer/geometry';
import type { TextViewPlace } from './contract';

/** A block, or one item of a list block, as a place can name it. */
export interface TextViewAnchor {
  readonly block: TextViewBlock;
  /** Index into a list block's items. */
  readonly item?: number;
}

/** A user-space rect (glyph boxes, search hits) in the page's display space, in points. */
export function userToDisplay(frame: PageFrame, rect: Rect): Rect {
  const box = userRectToCss({ ...frame, scale: 1 }, rect);
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

/** A display-space rect (a block's box) in the page's user space. */
export function displayToUser(frame: PageFrame, rect: Rect): Rect {
  return displayRectToUser(
    { ...frame, scale: 1 },
    { left: rect.x, top: rect.y, width: rect.width, height: rect.height },
  );
}

function boxOf(anchor: TextViewAnchor): Rect {
  const { block, item } = anchor;
  if (block.kind === 'list' && item !== undefined) return block.items[item]?.bbox ?? block.bbox;
  return block.bbox;
}

/**
 * The first block, or list item, on `page` whose bottom edge is below `y`: what a reader whose
 * top is at `y` is looking at. Past the last block it is the last one; a page with no blocks
 * has none.
 */
export function anchorAt(page: TextViewPage, y: number): TextViewAnchor | undefined {
  let last: TextViewAnchor | undefined;
  for (const block of page.blocks) {
    if (block.kind === 'list') {
      for (let item = 0; item < block.items.length; item++) {
        const anchor = { block, item };
        const box = boxOf(anchor);
        if (box.y + box.height > y) return anchor;
        last = anchor;
      }
      continue;
    }
    if (block.bbox.y + block.bbox.height > y) return { block };
    last = { block };
  }
  return last;
}

/** The reader place of a block or list item: its page and the top of its box. */
export function placeOf(anchor: TextViewAnchor): TextViewPlace {
  return { page: anchor.block.page, y: boxOf(anchor).y };
}
