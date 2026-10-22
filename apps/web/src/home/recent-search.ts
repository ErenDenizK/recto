/**
 * The pure side of Recents search and sort (Epic 3, 3d, `?home=search`): kept apart from
 * `home-model.ts` so it loads with the search tools' chunk, not with the default card.
 */

export type RecentSort = 'recent' | 'name' | 'size';

/**
 * A name as the search compares it: Turkish case folding (`İ` to `i`, `I` to `ı`) on the
 * composed form, so a typed "İZMİR" finds "izmir.pdf".
 */
export function foldName(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('tr');
}

/** Whether `name` contains the typed `query` (folded); an empty query matches everything. */
export function nameMatches(name: string, query: string): boolean {
  const needle = foldName(query.trim());
  return needle === '' || foldName(name).includes(needle);
}

/**
 * Recents for the Library's search and sort (Epic 3, 3d): entries whose name matches, then
 * ordered by `recent` (newest first), `name` (Turkish collation, digits by value) or `size`
 * (largest first). Equal keys keep the incoming order, so a re-sort never shuffles ties.
 */
export function searchSortRecents<
  T extends { readonly name: string; readonly size: number; readonly openedAt: number },
>(entries: readonly T[], query: string, sort: RecentSort): T[] {
  const collator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });
  const compare = (a: T, b: T): number => {
    if (sort === 'name') return collator.compare(a.name, b.name);
    if (sort === 'size') return b.size - a.size;
    return b.openedAt - a.openedAt;
  };
  return entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => nameMatches(entry.name, query))
    .sort((a, b) => compare(a.entry, b.entry) || a.index - b.index)
    .map(({ entry }) => entry);
}
