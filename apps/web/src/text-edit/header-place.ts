/**
 * Where the paragraph editor's header goes (components/05-canvas.md §17.3): beside the
 * paragraph (trailing, then leading) when the room outside its text, up to the free
 * rectangle's edge, takes the header; else above the paragraph, in the empty space between it
 * and the content above (`ParagraphLayoutAnalysis.gapAbove`, which counts graphics such as a
 * heading's rule); else below it, in the empty space down to the content below (`gapBelow`);
 * else docked at the foot of the free rectangle, just above the capsule, where the dock band's
 * chrome already is (the top of the free rectangle when that would cover the paragraph). It is
 * never over the paragraph or within 8 px of it, and it rests inside the free rectangle.
 *
 * The header is the solid twin of M4 (`ParagraphEditor.module.css`), so where only the docked
 * place is left the text it covers never shows through it.
 *
 * Everything is in the editor layer's CSS pixels; the spaces above and below are already
 * scaled from points. Pure, so the order is tested without a page (`header-place.test.ts`).
 */

/** Gap between the paragraph (or the content around it, or the frame) and the header. */
export const HEADER_GAP = 8;
/**
 * The narrowest header beside the paragraph. The spec's 240–360 px header assumes a 280 px
 * margin; a page at fit width on a laptop leaves its own margin of about 170 px, where a header
 * whose hint wraps to two lines is still clear of every line, which the places below are not.
 */
export const MIN_BESIDE_WIDTH = 160;
/** The widest header. */
export const MAX_HEADER_WIDTH = 340;

export interface Edges {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface HeaderPlace {
  readonly side: 'right' | 'left' | 'above' | 'below' | 'dock';
  /** The header's left edge, or its right edge for `left` (the CSS translates it back). */
  readonly left: number;
  readonly top: number;
  readonly maxWidth?: number;
}

export interface HeaderPlaceInput {
  /** The paragraph as it stands now (its original box joined with the draft's). */
  readonly text: Edges;
  /** The free rectangle (01-frame F1 §2): the window less the strip, sidebar and dock band. */
  readonly free: Edges;
  /** The header's size as laid out now. */
  readonly header: { readonly width: number; readonly height: number };
  /**
   * The empty space above and below the text, up to the content around it; undefined where
   * it is not known (the analysis is loading, or the text runs at an angle on screen).
   */
  readonly above?: number | undefined;
  readonly below?: number | undefined;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

function overlaps(a: Edges, b: Edges): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function placeHeader(input: HeaderPlaceInput): HeaderPlace {
  const { text, free, header } = input;
  const { width, height } = header;
  // Beside: the header's top with the paragraph's, kept under the strip while it shows.
  const besideTop = clamp(
    Math.max(text.top, free.top + HEADER_GAP),
    free.top + HEADER_GAP,
    free.bottom - HEADER_GAP - height,
  );
  const right = free.right - text.right - 2 * HEADER_GAP;
  if (right >= MIN_BESIDE_WIDTH) {
    return {
      side: 'right',
      left: text.right + HEADER_GAP,
      top: besideTop,
      maxWidth: Math.min(MAX_HEADER_WIDTH, right),
    };
  }
  const left = text.left - free.left - 2 * HEADER_GAP;
  if (left >= MIN_BESIDE_WIDTH) {
    return {
      side: 'left',
      left: text.left - HEADER_GAP,
      top: besideTop,
      maxWidth: Math.min(MAX_HEADER_WIDTH, left),
    };
  }
  // Above or below: aligned with the paragraph's start, kept inside the free rectangle.
  const start = clamp(text.left, free.left + HEADER_GAP, free.right - HEADER_GAP - width);
  const need = height + 2 * HEADER_GAP;
  const aboveTop = text.top - HEADER_GAP - height;
  if (input.above !== undefined && input.above >= need && aboveTop >= free.top + HEADER_GAP) {
    return { side: 'above', left: start, top: aboveTop };
  }
  const belowTop = text.bottom + HEADER_GAP;
  if (
    input.below !== undefined &&
    input.below >= need &&
    belowTop + height <= free.bottom - HEADER_GAP
  ) {
    return { side: 'below', left: start, top: belowTop };
  }
  // Docked: centred in the free rectangle, at its foot (above the capsule), else its head.
  const centre = clamp(
    (free.left + free.right - width) / 2,
    free.left + HEADER_GAP,
    free.right - HEADER_GAP - width,
  );
  const clear: Edges = {
    left: text.left - HEADER_GAP,
    top: text.top - HEADER_GAP,
    right: text.right + HEADER_GAP,
    bottom: text.bottom + HEADER_GAP,
  };
  for (const top of [free.bottom - HEADER_GAP - height, free.top + HEADER_GAP]) {
    const box = { left: centre, top, right: centre + width, bottom: top + height };
    if (!overlaps(box, clear)) return { side: 'dock', left: centre, top };
  }
  // A paragraph taller than the window: below it, where the reader is not typing.
  return { side: 'below', left: start, top: belowTop };
}
