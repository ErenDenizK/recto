/**
 * The page strip's arithmetic (R26 concept 1, DSN-63): which page a pointer is over, where the
 * track of thumbnails sits so that page is centred, and which items exist at all. Pure, so a
 * 500-page document costs the same as a 5-page one: only the items near the scrubbed page are
 * ever rendered (`visibleRange`), and only those near it draw a bitmap.
 *
 * One axis throughout: the strip lies along x on desktop and tablet and along y on the phone's
 * rail; `pitch` is an item's length along it plus the gap, `length` the strip's inner length.
 */

/** The page a pointer at `pos` is over, for a strip whose inner run starts at `start`. */
export function pageAtPointer(
  pos: number,
  start: number,
  length: number,
  count: number,
  pitch: number,
): number {
  if (count <= 0) return 0;
  const last = count - 1;
  // Everything fits: the item under the pointer, exactly.
  if (count * pitch <= length) {
    return Math.min(last, Math.max(0, Math.floor((pos - start) / pitch)));
  }
  // Else the strip is a scale of the whole document: the pointer's fraction of its length.
  const fraction = Math.min(1, Math.max(0, (pos - start) / length));
  return Math.round(fraction * last);
}

/** The track's offset (px, at most 0) that puts `index` mid-strip, held inside both ends. */
export function trackOffset(index: number, count: number, pitch: number, length: number): number {
  const content = count * pitch;
  if (content <= length) return 0;
  const centred = length / 2 - (index + 0.5) * pitch;
  return Math.min(0, Math.max(length - content, centred));
}

/** The items to keep in the DOM for a track at `offset`: `overscan` beyond each edge. */
export function visibleRange(
  offset: number,
  length: number,
  pitch: number,
  count: number,
  overscan = 2,
): { readonly first: number; readonly last: number } {
  if (count <= 0) return { first: 0, last: -1 };
  const first = Math.max(0, Math.floor(-offset / pitch) - overscan);
  const last = Math.min(count - 1, Math.ceil((-offset + length) / pitch) + overscan);
  return { first, last };
}

/** The page a key moves to from `index`, or null for a key the strip does not handle. */
export function keyTarget(key: string, index: number, count: number, page: number): number | null {
  const last = count - 1;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, index - 1);
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(last, index + 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageUp':
      return Math.max(0, index - page);
    case 'PageDown':
      return Math.min(last, index + page);
    default:
      return null;
  }
}
