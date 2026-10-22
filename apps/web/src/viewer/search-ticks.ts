/**
 * Find's hit ticks on the reader's scroll bar (R25 Epic 6; DSN-62, GLS-26): while the active
 * document has hits, one tick per hit page along the bar and a distinct one for the current hit;
 * cleared with the search. A page sits at (index + ½) / page count of the track, which is exact
 * for pages of one height and close otherwise. The drawing is `ui/scroll-thumbs.ts`.
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import { setScrollTicks } from '../ui/scroll-thumbs';
import { useWorkspaceStore } from '../state/workspace-store';
import { useSearchStore } from './search';

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
  setScrollTicks(
    doc && state.documentId === workspace.activeDocument
      ? ticksOf(state.hits, state.current, doc.pages.length)
      : null,
  );
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
