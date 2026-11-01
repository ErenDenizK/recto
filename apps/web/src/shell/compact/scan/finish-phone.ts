/**
 * Done on the phone (EDN-23; plan bm-scan-plan §3 "Done"): the pages are warped at the phone's
 * size (`phone-caps.ts`) and the JPEGs become one new, unsaved document (`openImagesAsDocument`,
 * PRD-24) that the compact reader shows on page 1. The document open before it closes only
 * once the new one is open (one document at a time, as every open in this edition); a failure
 * before that leaves it, and the scanned pages, as they were. It is not in Recents, and changed from the
 * start, so a copy goes through the export (`openedDocument` null).
 */
import { openRowMorph } from '../../../home/library-morph';
import { announce } from '../../announcer';
import { m } from '../../../i18n';
import { createHistory, type DocumentId } from '@pdf-editor/document-model';
import { renderScanFiles, scanTitle } from '../../../scan/render-files';
import type { ScanPage } from '../../../scan/scan-store';
import { useViewStore } from '../../../state/view-store';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { flushSession } from '../../../session/session';
import { clearSearch } from '../../../viewer/search';
import { showReader, useCompactStore } from '../compact-store';
import { PHONE_PAGE_SIDE } from './phone-caps';

/**
 * Closes every document but `keep`. Closing leaves history entries an undo would bring the old
 * document back from, so the history starts again from what is open.
 */
function closeOtherDocuments(keep: DocumentId): void {
  const { workspace, closeDocument } = useWorkspaceStore.getState();
  clearSearch();
  for (const id of workspace.documentOrder) if (id !== keep) closeDocument(id);
  useWorkspaceStore.setState((state) => ({
    history: createHistory(state.workspace, m.history_start(), Date.now()),
  }));
}

/** Warps the pages and opens them in the reader. Resolves false when nothing opened. */
export async function finishPhoneScan(pages: readonly ScanPage[]): Promise<boolean> {
  const files = await renderScanFiles(pages, PHONE_PAGE_SIDE);
  // The open document's snapshot is written while its bytes are still in the engine; it closes
  // only once the new one is open, so a failure leaves it and the scanned pages as they were.
  await flushSession();
  // Loaded here, not statically, so the sheet's chunk shares no new module with the first load (PF-23).
  const { openImagesAsDocument } = await import('../../../stage/section-operations');
  const id = await openImagesAsDocument(files, { sizing: 'fit-paper', manyTitle: scanTitle() });
  const doc = id === undefined ? undefined : useWorkspaceStore.getState().workspace.documents[id];
  if (doc === undefined || id === undefined) return false;
  closeOtherDocuments(id);
  useViewStore.setState({ currentPage: 0, visibleRange: { first: 0, last: 0 }, navTarget: null });
  useCompactStore.setState({ openedDocument: null, zoom: 1, findOpen: false, sheet: null });
  openRowMorph(null, showReader);
  announce(m.announce_opened({ name: doc.title }));
  return true;
}
