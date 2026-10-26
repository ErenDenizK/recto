/**
 * Done (plan bm-scan-plan §3 "Done"): every page is warped and filtered (`render-files.ts`) and
 * the JPEGs become one new, unsaved document through `openImagesAsDocument` (PRD-24), named
 * "Scan 25 Oct 2026". OCR is a later lane. The phone does its own opening (EDN-23).
 */
import { showOpened } from '../home/home-actions';
import { useWorkspaceStore } from '../state/workspace-store';
import { openImagesAsDocument } from '../stage/section-operations';
import { renderScanFiles, scanTitle } from './render-files';
import type { ScanPage } from './scan-store';

/** Warps and filters the pages and opens them as a document. Resolves when it is open. */
export async function finishScan(pages: readonly ScanPage[]): Promise<boolean> {
  const files = await renderScanFiles(pages);
  const wasEmpty = useWorkspaceStore.getState().workspace.documentOrder.length === 0;
  const id = await openImagesAsDocument(files, { sizing: 'fit-paper', manyTitle: scanTitle() });
  if (id === undefined) return false;
  showOpened([id], { wasEmpty });
  return true;
}
