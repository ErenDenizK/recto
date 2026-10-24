/**
 * What each Library card shows (`02-library` L5–L7): one card per open document, in tab order,
 * with the progress fields the Continue flag adds (DSN-66). Apart from `home-model.ts` so the
 * phone, which reads that file's sizes and times, does not carry the full edition's cards.
 */
import type { DocumentId, SourceId, VirtualPage, Workspace } from '@pdf-editor/document-model';

import type { SourceFileInfo } from '../state/workspace-store';

export interface HomeCardData {
  readonly id: DocumentId;
  readonly title: string;
  readonly pageCount: number;
  readonly colorIndex: number;
  /** Size of the file as opened; undefined when the pages come from several files or none. */
  readonly size: number | undefined;
  /** The file's modification time (ms) when the document is one file. */
  readonly modified: number | undefined;
  readonly firstPage: VirtualPage | undefined;
  /**
   * Behind `?home=continue` (DSN-66): how far the document was read, 0..1, and the page the
   * card shows instead of the cover once the reader got past the first page.
   */
  readonly progress?: number;
  readonly reachedPage?: number;
  readonly leftPage?: VirtualPage;
}

/** One card per open document, in tab order. */
export function homeCards(
  ws: Workspace,
  files: Readonly<Record<SourceId, SourceFileInfo>>,
  colors: Readonly<Record<DocumentId, number>>,
  reached: Readonly<Record<string, { readonly page: number }>> = {},
): HomeCardData[] {
  return ws.documentOrder.flatMap((id): HomeCardData[] => {
    const doc = ws.documents[id];
    if (doc === undefined) return [];
    const sources = new Set<SourceId>();
    let images = false;
    for (const page of doc.pages) {
      if (page.ref.kind === 'source') sources.add(page.ref.source);
      else images = true;
    }
    const [only] = sources;
    const file = sources.size === 1 && !images && only !== undefined ? files[only] : undefined;
    return [
      {
        id,
        title: doc.title,
        pageCount: doc.pages.length,
        colorIndex: colors[id] ?? 0,
        size: file?.size,
        modified: file !== undefined && file.lastModified > 0 ? file.lastModified : undefined,
        firstPage: doc.pages[0],
        ...progressFields(doc.pages, reached[id]?.page),
      },
    ];
  });
}

/** The progress fields of a card whose reader got to page index `page` (0-based). */
function progressFields(
  pages: readonly VirtualPage[],
  page: number | undefined,
): Pick<HomeCardData, 'progress' | 'reachedPage' | 'leftPage'> {
  if (page === undefined || pages.length === 0) return {};
  const index = Math.min(page, pages.length - 1);
  const left = pages[index];
  return {
    progress: (index + 1) / pages.length,
    reachedPage: index + 1,
    // The cover stays while the reader is still on page 1 (progress > 1 page, DSN-66).
    ...(index > 0 && left !== undefined ? { leftPage: left } : {}),
  };
}
