/**
 * Which document tabs the strip shows and which go into "N more ▾" (`components/01-frame.md`
 * F4 §2, spec 01.Q1): overflow starts when the visible tabs would fall under their minimum
 * width (112 px fine, 128 coarse); the active tab and its nearest neighbours stay, the rest
 * go into the overflow menu, in document order. The active tab never leaves the strip, so it
 * never truncates below its minimum (F2 §2's priority list).
 *
 * Pure, so the split is tested at every width class with English and Turkish titles
 * (`tab-overflow.test.ts`); `DocumentTabs` measures and calls it.
 */

/** Gap between tabs (F2 §2: 2 px fine; coarse uses 8 px, passed in). */
export const TAB_GAP_FINE = 2;

export interface TabSplit<T> {
  /** Shown in the strip, in document order. */
  readonly visible: readonly T[];
  /** In "N more ▾", in document order. */
  readonly overflow: readonly T[];
}

/**
 * How many tabs of `minWidth` fit in `room` px with `gap` between them; when not all `count`
 * fit, room is first given to the overflow chip (`chipWidth`). Never less than one: the
 * active tab always shows.
 */
export function tabCapacity(
  count: number,
  room: number,
  minWidth: number,
  gap: number,
  chipWidth: number,
): number {
  if (count <= 0) return 0;
  const fit = (width: number) => Math.floor((width + gap) / (minWidth + gap));
  if (fit(room) >= count) return count;
  return Math.max(1, Math.min(count - 1, fit(room - chipWidth - gap)));
}

/**
 * Splits `tabs` so `capacity` of them show: a run around `active` (its index, or -1 on the
 * Library, where the run starts at the first tab), centred on it where the ends allow, so its
 * neighbours on both sides stay in reach of Left and Right.
 */
export function splitTabs<T>(tabs: readonly T[], active: number, capacity: number): TabSplit<T> {
  const count = tabs.length;
  const shown = Math.max(Math.min(capacity, count), Math.min(1, count));
  if (shown >= count) return { visible: tabs, overflow: [] };
  const anchor = active >= 0 && active < count ? active : 0;
  const start = Math.min(Math.max(0, anchor - Math.floor((shown - 1) / 2)), count - shown);
  return {
    visible: tabs.slice(start, start + shown),
    overflow: [...tabs.slice(0, start), ...tabs.slice(start + shown)],
  };
}

/**
 * A name's distinguishing ending (owner feedback F4): a trailing parenthetical, "(extract)",
 * "(2)", or number, " 2", of at most 16 characters, which stays while the rest of the name
 * truncates (the strip draws the space between them). Null when the name has none, or when
 * nothing would be left before it.
 */
export function nameEnding(title: string): { head: string; tail: string } | null {
  const match = /^(.*?\S)(\s*\([^()]{1,14}\)|\s+\d{1,4})$/u.exec(title);
  if (!match) return null;
  const [, head = '', tail = ''] = match;
  return { head, tail: tail.trim() };
}
