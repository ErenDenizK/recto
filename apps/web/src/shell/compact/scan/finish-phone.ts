/**
 * Done on the phone (EDN-23; plan bm-scan-plan §3 "Done"): the pages are warped at the phone's
 * size (`phone-caps.ts`), the document open before it closes (one document at a time, as every
 * open in this edition), and the JPEGs become one new, unsaved document (`openImagesAsDocument`,
 * PRD-24) that the compact reader shows on page 1. It is not in Recents, and changed from the
 * start, so a copy goes through the export (`openedDocument` null).
 */
import { openRowMorph } from '../../../home/library-morph';
import { announce } from '../../announcer';
import { m } from '../../../i18n';
import { renderScanFiles, scanTitle } from '../../../scan/render-files';
import type { ScanPage } from '../../../scan/scan-store';
import { useViewStore } from '../../../state/view-store';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { openImagesAsDocument } from '../../../stage/section-operations';
import { closeOpenDocument } from '../compact-actions';
import { showReader, useCompactStore } from '../compact-store';
import { PHONE_PAGE_SIDE } from './phone-caps';

/** Warps the pages and opens them in the reader. Resolves false when nothing opened. */
export async function finishPhoneScan(pages: readonly ScanPage[]): Promise<boolean> {
  const files = await renderScanFiles(pages, PHONE_PAGE_SIDE);
  await closeOpenDocument();
  const id = await openImagesAsDocument(files, { sizing: 'fit-paper', manyTitle: scanTitle() });
  const doc = id === undefined ? undefined : useWorkspaceStore.getState().workspace.documents[id];
  if (doc === undefined) return false;
  useViewStore.setState({ currentPage: 0, visibleRange: { first: 0, last: 0 }, navTarget: null });
  useCompactStore.setState({ openedDocument: null, zoom: 1, findOpen: false, sheet: null });
  openRowMorph(null, showReader);
  announce(m.announce_opened({ name: doc.title }));
  return true;
}
