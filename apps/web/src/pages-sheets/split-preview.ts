/**
 * Where a Split would cut, while its sheet is open (`components/07-sheets.md` S13 §2): the grid
 * draws a `--select` cut line before each part's first page and labels it "2 of 3"
 * (`stage/PageCell.tsx`), so the parts are seen on the pages before they are made.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { create } from 'zustand';

export interface SplitPreview {
  readonly documentId: DocumentId;
  /** Indices of the pages that start a part, past the first, ascending. */
  readonly cuts: readonly number[];
  /** How many parts the split makes. */
  readonly parts: number;
}

export const useSplitPreview = create<{ preview: SplitPreview | null }>()(() => ({
  preview: null,
}));

export function setSplitPreview(preview: SplitPreview | null): void {
  const current = useSplitPreview.getState().preview;
  if (
    current === preview ||
    (preview !== null &&
      current?.documentId === preview.documentId &&
      current.parts === preview.parts &&
      current.cuts.length === preview.cuts.length &&
      current.cuts.every((cut, i) => cut === preview.cuts[i]))
  ) {
    return;
  }
  useSplitPreview.setState({ preview });
}

/** The part a page at `index` starts (2-based: part 1 needs no line), if it starts one. */
export function cutPartAt(preview: SplitPreview | null, documentId: DocumentId, index: number) {
  if (preview?.documentId !== documentId) return undefined;
  const at = preview.cuts.indexOf(index);
  return at < 0 ? undefined : at + 2;
}
