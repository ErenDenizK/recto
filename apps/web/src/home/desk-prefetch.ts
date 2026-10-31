/**
 * The desk's one early read (DSN-87, `masa.md` §4 rule 2): imported by `LibraryView`'s module, so
 * it runs when the app chunk evaluates, before React renders. It starts the Recents load and the
 * covers read (`getAll` on the store: at most 24 small records) in parallel, so the first paint
 * finds both under way. Nothing here starts the PDF engine, and nothing is added to `main.tsx`
 * or the first-paint closure (PRC-20).
 */
import { loadRecents } from '../files/recents';
import { prefetchCovers, watchCoverSweep } from './covers';

let started = false;

/** Starts both reads once; later calls do nothing. */
export function prefetchDesk(): void {
  if (started) return;
  started = true;
  void prefetchCovers();
  // The sweep waits for the list to load before it deletes anything.
  watchCoverSweep();
  void loadRecents();
}

prefetchDesk();
