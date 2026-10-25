/**
 * What the glass scroll bar knows about the reader (R29 study, GLS-26 amendment; `?scroll=glass`):
 * the page under a scroll position, the outline section it belongs to and the Find hits on it,
 * and where the sections lie along the track. Loaded by `ReadView` only when the flag is on
 * (`ui/scroll-glass-flag.ts`), with the outline rules of the margin map (DSN-72).
 *
 * A section lies at (page index + how far down the page its heading sits) / page count of the
 * track, and a page at (index + ½) / count as Find's ticks do (DSN-62): exact for pages of one
 * height, close otherwise. A page belongs to the last section whose heading is on it or above it.
 */
import {
  type PageId,
  pageDisplaySize,
  type VirtualDocument,
  type Workspace,
} from '@pdf-editor/document-model';

import { currentEntry, mapEntries } from '../shell/frame/margin/margin-map-model';
import type { ScrollMap } from '../ui/scroll-thumbs';
import { useSearchStore } from '../viewer/search';

/** The bubble's words: "4 / 8", and "4 / 8 | Roll three" under a heading. */
export function bubbleText(page: number, total: number, heading: string): string {
  const where = `${page + 1} / ${total}`;
  return heading === '' ? where : `${where} | ${heading}`;
}

/** How many of `hits` lie on the page. */
export function hitsOnPage(hits: readonly { readonly pageIndex: number }[], page: number): number {
  let count = 0;
  for (const hit of hits) if (hit.pageIndex === page) count += 1;
  return count;
}

/** The map for a document; `pageAt` is the reader's own page lookup (`PageColumn`'s rows). */
export function buildScrollMap(
  doc: VirtualDocument,
  ws: Workspace,
  pageAt: (scrollTop: number) => number | undefined,
): ScrollMap {
  const pages = doc.pages.length;
  const ids = new Map<PageId, number>(doc.pages.map((p, i) => [p.id, i]));
  const entries = mapEntries(
    doc.outline,
    (id) => ids.get(id) ?? -1,
    (i) => {
      const page = doc.pages[i];
      return page ? pageDisplaySize(ws, page).height : 0;
    },
  );
  return {
    pages,
    sections: entries.map((e) => ({ at: (e.pageIndex + e.frac) / pages, title: e.title })),
    at: (scrollTop) => {
      const page = pageAt(scrollTop);
      if (page === undefined) return undefined;
      const entry = currentEntry(entries, page, 1);
      return {
        page,
        section: entry ? entries.indexOf(entry) : -1,
        heading: entry?.title ?? '',
        hits: hitsOnPage(useSearchStore.getState().hits, page),
      };
    },
  };
}
