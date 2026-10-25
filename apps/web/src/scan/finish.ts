/**
 * Done (plan bm-scan-plan §3 "Done"): every page is warped and filtered through `Scanner`
 * (`encode.ts`) and the JPEGs become one new, unsaved document through `openImagesAsDocument`
 * (PRD-24), named "Scan 25 Oct 2026". OCR is a later lane.
 */
import { showOpened } from '../home/home-actions';
import { formatDay, m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import { openImagesAsDocument } from '../stage/section-operations';
import { Scanner } from './encode';
import { insetQuad, type ScanPage } from './scan-store';

/** Long side of a finished page, px (plan §2). */
export const PAGE_SIDE = 3000;

/** "Scan 25 Oct 2026". */
export function scanTitle(now: Date = new Date()): string {
  return m.scan_document_title({ date: formatDay(now, { year: true }) });
}

/** Warps and filters the pages and opens them as a document. Resolves when it is open. */
export async function finishScan(pages: readonly ScanPage[]): Promise<boolean> {
  const scanner = new Scanner();
  const title = scanTitle();
  try {
    const files: File[] = [];
    for (const [index, page] of pages.entries()) {
      const source = await createImageBitmap(page.source);
      try {
        const { blob } = await scanner.page(source, insetQuad(page.quad), {
          filter: page.filter,
          longSide: PAGE_SIDE,
        });
        // The first file's name is the one-page document's title (`imagesDocumentTitle`).
        const name = index === 0 ? `${title}.jpg` : `${title} ${index + 1}.jpg`;
        files.push(new File([blob], name, { type: 'image/jpeg' }));
      } finally {
        source.close();
      }
    }
    const wasEmpty = useWorkspaceStore.getState().workspace.documentOrder.length === 0;
    const id = await openImagesAsDocument(files, { sizing: 'fit-paper', manyTitle: title });
    if (id === undefined) return false;
    showOpened([id], { wasEmpty });
    return true;
  } finally {
    scanner.dispose();
  }
}
