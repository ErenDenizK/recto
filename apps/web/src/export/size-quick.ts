/**
 * The first size of a copy, before any engine has read it (the save receipt, DSN-67; Save a
 * copy's Size, components/07-sheets.md §4.4, INV-18): the opened files' bytes shared by their
 * pages, plus what each edit adds. It appears with the sheet, is labelled approximate, and is
 * replaced by the exact size of the assembled copy (`useSizeAnalysis`) as soon as that is known.
 *
 * Deliberately rough: a page is its source's average page, so a long text document with one
 * image-heavy page is off by that page, and an edit costs a flat amount. It is never used for
 * a decision, only to say "about" while the real number is on its way.
 */
import type { VirtualDocument, Workspace } from '@pdf-editor/document-model';

/** A blank page's content stream and page object. */
export const BLANK_PAGE_BYTES = 400;
/** An image page whose bytes are unknown here (the blob is not in the workspace). */
export const IMAGE_PAGE_BYTES = 60_000;
/** One piece of page furniture (page number, watermark, header). */
export const OVERLAY_BYTES = 700;
/** A text edit rewrites a content stream and may embed a font subset. */
export const TEXT_EDIT_BYTES = 3_000;
/** An annotation: its dictionary and appearance stream. */
export const MARK_BYTES = 500;

/** Bytes an edit adds, by its kind (`EngineEdit.kind`). */
function editBytes(kind: string): number {
  if (kind === 'text.edit' || kind === 'text.editParagraph') return TEXT_EDIT_BYTES;
  if (kind === 'annotation.create' || kind === 'redaction.mark') return MARK_BYTES;
  return 0;
}

/** About how many bytes the copy of `doc` will be, or null when it has no pages. */
export function quickSize(ws: Workspace, doc: VirtualDocument): number | null {
  if (doc.pages.length === 0) return null;
  let total = 0;
  const sources = new Set<string>();
  for (const page of doc.pages) {
    total += page.overlays.length * OVERLAY_BYTES;
    if (page.ref.kind === 'blank') total += BLANK_PAGE_BYTES;
    else if (page.ref.kind === 'image') total += IMAGE_PAGE_BYTES;
    else {
      const source = ws.sources[page.ref.source];
      if (source && source.pageCount > 0) total += source.byteLength / source.pageCount;
      sources.add(page.ref.source);
    }
  }
  for (const edit of ws.engineEdits) {
    if (sources.has(edit.source)) total += editBytes(edit.kind);
  }
  return Math.max(1, Math.round(total));
}
