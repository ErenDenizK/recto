/**
 * Find's hit ticks on the reader's scroll bar (R25 Epic 6; DSN-62, GLS-26): while the active
 * document has hits, one tick per hit page along the bar and a distinct one for the current hit;
 * cleared with the search. A page sits at (index + ½) / page count of the track, which is exact
 * for pages of one height and close otherwise. The drawing is `ui/scroll-thumbs.ts`.
 *
 * With `?findmap=1` (R26 concept 3; DSN-65) the ticks are also a map: the current tick slides on a
 * spring, the phone reader gets the ticks on a rail, and `find-map.ts` (loaded here, only with
 * hits) answers a hover or a tap with a card and a jump.
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import { setScrollTicks } from '../ui/scroll-thumbs';
import { useWorkspaceStore } from '../state/workspace-store';
import type * as FindMap from './find-map';
import { FIND_MAP as MAP } from './find-map-flag';
import { useSearchStore } from './search';

let mapped: typeof FindMap | undefined;

/** The ticks for the store's hits, or `null` when there is nothing to show. */
export function ticksOf(
  hits: readonly { readonly pageIndex: number }[],
  current: number,
  pages: number,
) {
  if (hits.length === 0 || pages < 1) return null;
  const at: number[] = [];
  let last = -1;
  for (const { pageIndex } of hits) {
    if (pageIndex === last) continue;
    last = pageIndex;
    at.push((pageIndex + 0.5) / pages);
  }
  const page = hits[current]?.pageIndex;
  return { at, current: page === undefined ? null : (page + 0.5) / pages };
}

function sync(): void {
  const state = useSearchStore.getState();
  const workspace = useWorkspaceStore.getState().workspace;
  const doc = getActiveDocument(workspace);
  const ours = doc && state.documentId === workspace.activeDocument ? doc : undefined;
  const next = ours ? ticksOf(state.hits, state.current, ours.pages.length) : null;
  setScrollTicks(next && MAP ? { ...next, map: true } : next);
  if (!MAP) return;
  if (mapped) mapped.setTickPages(next ? state.hits : [], ours?.pages.length ?? 0);
  else if (next)
    void import('./find-map').then((module) => {
      mapped = module;
      sync();
    });
}

useSearchStore.subscribe((state, previous) => {
  if (
    state.hits !== previous.hits ||
    state.current !== previous.current ||
    state.documentId !== previous.documentId
  )
    sync();
});
// A tab switch leaves the old document's ticks behind otherwise.
useWorkspaceStore.subscribe((state, previous) => {
  if (state.workspace.activeDocument !== previous.workspace.activeDocument) sync();
});
