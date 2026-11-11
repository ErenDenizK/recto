/**
 * The covers of the Library's Recent shelf (EDN-29, DSN-87): a lazy chunk of `CompactLibrary`
 * that reads the stored first-page and page-left images (`home/covers.ts`, IndexedDB only, no
 * engine) and hands the shelf a lookup. It stays out of the phone's first load (PF-23): the shelf
 * shows paper sheets of the same size until this arrives, so nothing moves when it does.
 */
import type { ReactNode } from 'react';

import type { RecentEntry } from '../../files/recents';
import { type Cover, useCovers } from '../../home/covers';
import { pickCover } from '../../home/desk-model';

/** The cover an entry shows, if one is stored. */
export type CoverOf = (entry: RecentEntry) => Cover | undefined;

export default function ShelfCovers({
  children,
}: {
  readonly children: (coverOf: CoverOf) => ReactNode;
}) {
  const covers = useCovers();
  return children((entry) => pickCover(entry, covers));
}
