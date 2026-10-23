/**
 * The find map's ticks as data (R26 concept 3; DSN-65, DSN-62): hits grouped per page, one entry
 * per hit page at its place on the scroll bar's track, and the hit-test that tells which page a
 * pointer on the track means. Pure, so grouping and hit-testing are unit-tested
 * (`tick-hit.test.ts`); there is no node per tick, the pointer is tested against this list.
 */

/** One hit page along the track. */
export interface TickPage {
  readonly pageIndex: number;
  /** Where the page sits on the track, 0..1: (index + ½) / page count (DSN-62). */
  readonly at: number;
  /** Index of the page's first hit in the sorted hit list. */
  readonly first: number;
  /** How many hits the page has. */
  readonly count: number;
}

/** Groups sorted hits per page; `pages` is the document's page count. */
export function tickPages(
  hits: readonly { readonly pageIndex: number }[],
  pages: number,
): TickPage[] {
  const out: TickPage[] = [];
  if (pages < 1) return out;
  hits.forEach(({ pageIndex }, first) => {
    const last = out[out.length - 1];
    if (last?.pageIndex === pageIndex) out[out.length - 1] = { ...last, count: last.count + 1 };
    else out.push({ pageIndex, at: (pageIndex + 0.5) / pages, first, count: 1 });
  });
  return out;
}

/**
 * The hit page nearest to `fraction` of the track within `tolerance` (a fraction too), or null.
 * Ticks that crowd inside the tolerance answer for the nearest one. Binary search, so any number
 * of hit pages costs a few steps per pointer move.
 */
export function tickAt(
  pages: readonly TickPage[],
  fraction: number,
  tolerance: number,
): TickPage | null {
  let low = 0;
  let high = pages.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if ((pages[mid] as TickPage).at < fraction) low = mid + 1;
    else high = mid;
  }
  const before = pages[low - 1];
  const after = pages[low];
  const near = before && (!after || fraction - before.at <= after.at - fraction) ? before : after;
  return near && Math.abs(near.at - fraction) <= tolerance ? near : null;
}
