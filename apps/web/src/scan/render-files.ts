/**
 * The pages of a scan as finished JPEG files (plan bm-scan-plan §3 "Done"): each page is warped
 * and filtered through `Scanner` (`encode.ts`), one bitmap alive at a time. The full edition
 * opens them through `finish.ts`, the phone through `shell/compact/scan/` (EDN-23); both share
 * this, so the warp and the names are one.
 */
import { formatDay, m } from '../i18n';
import { Scanner } from './encode';
import { insetQuad, type ScanPage } from './scan-store';

/** Long side of a finished page, px (plan §2). */
export const PAGE_SIDE = 3000;

/** "Scan 25 Oct 2026". */
export function scanTitle(now: Date = new Date()): string {
  return m.scan_document_title({ date: formatDay(now, { year: true }) });
}

/** Warps and filters the pages; the first file's name is the one-page document's title. */
export async function renderScanFiles(
  pages: readonly ScanPage[],
  longSide: number = PAGE_SIDE,
): Promise<File[]> {
  const scanner = new Scanner();
  const title = scanTitle();
  try {
    const files: File[] = [];
    for (const [index, page] of pages.entries()) {
      const source = await createImageBitmap(page.source);
      try {
        const { blob } = await scanner.page(source, insetQuad(page.quad), {
          filter: page.filter,
          longSide,
        });
        const name = index === 0 ? `${title}.jpg` : `${title} ${index + 1}.jpg`;
        files.push(new File([blob], name, { type: 'image/jpeg' }));
      } finally {
        source.close();
      }
    }
    return files;
  } finally {
    scanner.dispose();
  }
}
