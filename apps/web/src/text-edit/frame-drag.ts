/**
 * The pointer maths of the open paragraph's frame controls (TXT-24): moving it by its border
 * band or grip, changing its width by the side bars, and the keyboard nudge. Pure: no DOM, no
 * engine call. Positions are CSS pixels on the displayed page, moves are points of unrotated
 * user space (`ParagraphFrameChange`: `cssPointToUser` carries a /Rotate page's turn), widths
 * are text-space x along the writing direction (`ParagraphBlock.measure`).
 *
 * - A press becomes a drag only after the slop (`pastSlop`), so a tap on the band stays a tap.
 * - The paragraph never leaves the CropBox (`clampMove`).
 * - Its left edge snaps within `SNAP_PX` CSS px to where it was, to the left edges of the
 *   page's other paragraphs (the columns) and shows a guide there; Alt turns snapping off.
 * - A side bar stops at the room beside the paragraph (`roomLeft`/`roomRight`: the engine does
 *   not clamp) and at four times the font size (the engine's least width).
 */
import type { Rect } from '@pdf-editor/document-model';
import type { ParagraphBlock, ParagraphFrameChange } from '@pdf-editor/engine';

import { cssPointToUser, rectToCss, userToCss } from '../annotations/geometry';
import type { PageFrame } from '../viewer/geometry';
import { type Affine, apply, invert, type TextRect } from './glyph-canvas';

/** Movement before a press becomes a drag, CSS px (a finger wobbles more than a mouse). */
export const SLOP_PX = 4;
export const SLOP_TOUCH_PX = 8;
/** How close the left edge must come to snap, CSS px (TXT-24). */
export const SNAP_PX = 4;
/** The border band's thickness outside the ink, CSS px (TXT-24). */
export const BAND_PX = 6;
/** The least width of a paragraph, in font sizes (the engine throws `invalid-range` below). */
export const MIN_WIDTH_SIZES = 4;
/** Keyboard nudge, points (TXT-24): an Arrow, and Shift+Arrow. */
export const NUDGE_PT = 1;
export const NUDGE_SHIFT_PT = 10;

export interface Delta {
  readonly dx: number;
  readonly dy: number;
}

/** What the user has done to the open paragraph's frame: a move and the measure as it is now. */
export interface FrameDraft extends Delta {
  /** Text-space measure edges, before the move (`ParagraphFrameChange.measure`). */
  readonly left: number;
  readonly right: number;
}

export function initialFrame(block: Pick<ParagraphBlock, 'measure'>): FrameDraft {
  return { dx: 0, dy: 0, left: block.measure.left, right: block.measure.right };
}

const EPSILON = 1e-6;

/** The draft moves or resizes the paragraph. */
export function frameChanged(draft: FrameDraft, block: Pick<ParagraphBlock, 'measure'>): boolean {
  return (
    Math.abs(draft.dx) > EPSILON ||
    Math.abs(draft.dy) > EPSILON ||
    Math.abs(draft.left - block.measure.left) > EPSILON ||
    Math.abs(draft.right - block.measure.right) > EPSILON
  );
}

/** The engine's frame change for a draft; `measure` only when the width is not the original. */
export function frameChangeOf(
  draft: FrameDraft,
  block: Pick<ParagraphBlock, 'measure'>,
): ParagraphFrameChange {
  const resized =
    Math.abs(draft.left - block.measure.left) > EPSILON ||
    Math.abs(draft.right - block.measure.right) > EPSILON;
  return {
    dx: draft.dx,
    dy: draft.dy,
    ...(resized ? { measure: { left: draft.left, right: draft.right } } : {}),
  };
}

export function pastSlop(dx: number, dy: number, pointerType: string): boolean {
  return Math.hypot(dx, dy) >= (pointerType === 'mouse' ? SLOP_PX : SLOP_TOUCH_PX);
}

/** A CSS-pixel vector on the displayed page as a user-space vector (the page's rotation). */
export function userDelta(frame: PageFrame, cssDx: number, cssDy: number): Delta {
  const from = cssPointToUser(frame, { x: 0, y: 0 });
  const to = cssPointToUser(frame, { x: cssDx, y: cssDy });
  return { dx: to.x - from.x, dy: to.y - from.y };
}

/** A user-space vector as a CSS-pixel vector. */
export function cssDelta(frame: PageFrame, d: Delta): { readonly x: number; readonly y: number } {
  const from = userToCss(frame, { x: 0, y: 0 });
  const to = userToCss(frame, { x: d.dx, y: d.dy });
  return { x: to.x - from.x, y: to.y - from.y };
}

/** The page's visible box (CropBox) in user space. */
export function cropOf(frame: PageFrame): Rect {
  return { x: frame.originX, y: frame.originY, width: frame.size.width, height: frame.size.height };
}

function within(value: number, low: number, high: number): number {
  return low > high ? 0 : Math.min(high, Math.max(low, value));
}

/** The move cut so `box` stays inside `crop`. */
export function clampMove(box: Rect, crop: Rect, d: Delta): Delta {
  return {
    dx: within(d.dx, crop.x - box.x, crop.x + crop.width - box.x - box.width),
    dy: within(d.dy, crop.y - box.y, crop.y + crop.height - box.y - box.height),
  };
}

/** The anchor within `SNAP_PX` of `left` (the nearest), unless snapping is off. */
export function snapTo(left: number, anchors: readonly number[], off: boolean): number | undefined {
  if (off) return undefined;
  let best: number | undefined;
  for (const anchor of anchors) {
    if (Math.abs(anchor - left) > SNAP_PX) continue;
    if (best === undefined || Math.abs(anchor - left) < Math.abs(best - left)) best = anchor;
  }
  return best;
}

/**
 * The left edges (CSS px) a move snaps to: where the paragraph is now, and the other
 * paragraphs' left edges (a column's edge is the left edge of its paragraphs).
 */
export function snapAnchors(
  frame: PageFrame,
  own: ParagraphBlock,
  blocks: readonly ParagraphBlock[],
): number[] {
  const lefts = [rectToCss(frame, own.box).left];
  for (const block of blocks) {
    if (block.ref.index !== own.ref.index) lefts.push(rectToCss(frame, block.box).left);
  }
  return lefts;
}

export interface MoveInput {
  readonly frame: PageFrame;
  /** The paragraph's ink box in user space, in its original place. */
  readonly box: Rect;
  /** The move when the press began. */
  readonly base: Delta;
  /** The press and the pointer now, CSS px. */
  readonly start: { readonly x: number; readonly y: number };
  readonly now: { readonly x: number; readonly y: number };
  readonly anchors: readonly number[];
  /** Alt is held: no snapping. */
  readonly alt: boolean;
}

/** The move the pointer asks for: clamped to the CropBox, snapped; `guide` is the snap's x. */
export function moveBy(input: MoveInput): Delta & { readonly guide?: number } {
  const { frame, box, base } = input;
  const crop = cropOf(frame);
  const asked = userDelta(frame, input.now.x - input.start.x, input.now.y - input.start.y);
  let d = clampMove(box, crop, { dx: base.dx + asked.dx, dy: base.dy + asked.dy });
  const leftOf = (at: Delta) =>
    rectToCss(frame, { ...box, x: box.x + at.dx, y: box.y + at.dy }).left;
  const anchor = snapTo(leftOf(d), input.anchors, input.alt);
  if (anchor === undefined) return d;
  const pull = userDelta(frame, anchor - leftOf(d), 0);
  d = clampMove(box, crop, { dx: d.dx + pull.dx, dy: d.dy + pull.dy });
  return Math.abs(leftOf(d) - anchor) < 0.5 ? { ...d, guide: anchor } : d;
}

/** A CSS-pixel vector as a text-space vector (x along the writing direction). */
export function textDelta(cssOfText: Affine, cssDx: number, cssDy: number): Delta {
  const back = invert(cssOfText);
  const from = apply(back, { x: 0, y: 0 });
  const to = apply(back, { x: cssDx, y: cssDy });
  return { dx: to.x - from.x, dy: to.y - from.y };
}

export interface WidthInput {
  readonly side: 'left' | 'right';
  /** The measure when the press began. */
  readonly base: { readonly left: number; readonly right: number };
  /** The paragraph's own measure. */
  readonly original: { readonly left: number; readonly right: number };
  /** How far the pointer moved along the writing direction (text-space x). */
  readonly along: number;
  readonly roomLeft: number;
  readonly roomRight: number;
  /** The font size, points. */
  readonly size: number;
}

/** The measure a side bar asks for, kept to the room beside the paragraph and the least width. */
export function widthBy(input: WidthInput): { left: number; right: number } {
  const { base, original, size } = input;
  const minimum = MIN_WIDTH_SIZES * size;
  if (input.side === 'left') {
    const low = original.left - Math.max(0, input.roomLeft);
    const high = Math.max(low, base.right - minimum);
    return { left: Math.min(high, Math.max(low, base.left + input.along)), right: base.right };
  }
  const high = original.right + Math.max(0, input.roomRight);
  const low = Math.min(high, base.left + minimum);
  return { left: base.left, right: Math.min(high, Math.max(low, base.right + input.along)) };
}

/**
 * The frame's rectangle in text space: the measure across (the width the side bars set, where
 * a ragged paragraph's ink stops short of it) and the ink's own top and bottom, the bottom
 * moved by what the last baseline did (a narrower paragraph is taller). `ink` is the original
 * ink in text space.
 */
export function framedRect(
  ink: TextRect,
  measure: { readonly left: number; readonly right: number },
  lastBaselineShift: number,
): TextRect {
  return { x0: measure.left, x1: measure.right, y0: ink.y0 + lastBaselineShift, y1: ink.y1 };
}

/** The user-space move of an Arrow press on the screen: 1 pt, Shift+Arrow 10 pt (TXT-24). */
export function nudgeOf(frame: PageFrame, key: string, shift: boolean): Delta | null {
  const step = (shift ? NUDGE_SHIFT_PT : NUDGE_PT) * frame.scale;
  switch (key) {
    case 'ArrowLeft':
      return userDelta(frame, -step, 0);
    case 'ArrowRight':
      return userDelta(frame, step, 0);
    case 'ArrowUp':
      return userDelta(frame, 0, -step);
    case 'ArrowDown':
      return userDelta(frame, 0, step);
    default:
      return null;
  }
}
