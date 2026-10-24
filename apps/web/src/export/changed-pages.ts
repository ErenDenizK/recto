/**
 * What changed on which page, for the save receipt (DSN-67): the pages of a document that
 * differ from the file it was opened from, each with the kinds of change it carries, plus how
 * many pages were taken out. Read from the document model and the workspace's edit log, so it
 * is exact and needs no engine.
 *
 * A signature is a stamp annotation (the placed image); other annotations and redaction marks
 * are marks. Form values and OCR are not listed: they change no page's look.
 */
import type {
  EngineEdit,
  VirtualDocument,
  VirtualPage,
  Workspace,
} from '@pdf-editor/document-model';

export type ChangeKind = 'text' | 'marks' | 'signature' | 'added' | 'rotated';

export interface ChangedPage {
  readonly page: VirtualPage;
  /** 1-based position in the document. */
  readonly position: number;
  readonly kinds: readonly ChangeKind[];
}

export interface ChangedPages {
  readonly pages: readonly ChangedPage[];
  /** Pages of the opened file that the document no longer holds. */
  readonly deleted: number;
}

const ORDER: readonly ChangeKind[] = ['text', 'marks', 'signature', 'added', 'rotated'];

type Payload = { annotation?: { id?: unknown; kind?: unknown }; annotationId?: unknown } | null;

/** The kind of change an edit makes to its page, or null for none worth listing. */
function kindOf(edit: EngineEdit): ChangeKind | null {
  switch (edit.kind) {
    case 'text.edit':
    case 'text.editParagraph':
      return 'text';
    case 'annotation.create':
      return (edit.payload as Payload)?.annotation?.kind === 'stamp' ? 'signature' : 'marks';
    case 'redaction.mark':
    case 'redaction.apply':
    case 'image.remove':
    case 'image.replace':
    case 'image.transform':
      return 'marks';
    default:
      return null;
  }
}

export function changedPages(ws: Workspace, doc: VirtualDocument): ChangedPages {
  // An annotation made and then deleted leaves nothing on its page.
  const deletedIds = new Set<unknown>();
  for (const edit of ws.engineEdits) {
    if (edit.kind === 'annotation.delete') deletedIds.add((edit.payload as Payload)?.annotationId);
  }
  const byPage = new Map<string, Set<ChangeKind>>();
  for (const edit of ws.engineEdits) {
    const kind = kindOf(edit);
    if (kind === null) continue;
    if (
      edit.kind === 'annotation.create' &&
      deletedIds.has((edit.payload as Payload)?.annotation?.id)
    ) {
      continue;
    }
    const key = `${edit.source}:${edit.pageIndex}`;
    byPage.set(key, (byPage.get(key) ?? new Set<ChangeKind>()).add(kind));
  }

  const pages: ChangedPage[] = [];
  const kept = new Map<string, Set<number>>();
  doc.pages.forEach((page, i) => {
    const kinds = new Set<ChangeKind>();
    if (page.ref.kind === 'source') {
      for (const kind of byPage.get(`${page.ref.source}:${page.ref.index}`) ?? []) kinds.add(kind);
      kept.set(
        page.ref.source,
        (kept.get(page.ref.source) ?? new Set<number>()).add(page.ref.index),
      );
    } else {
      kinds.add('added');
    }
    if (page.rotation !== 0) kinds.add('rotated');
    if (kinds.size > 0) {
      pages.push({ page, position: i + 1, kinds: ORDER.filter((kind) => kinds.has(kind)) });
    }
  });

  // Deleted pages are only told for a document made from one file: in a combine, a source's
  // other pages may simply live in another document.
  let deleted = 0;
  const only = kept.size === 1 ? [...kept][0] : undefined;
  if (only) {
    const source = ws.sources[only[0] as keyof Workspace['sources']];
    if (source) deleted = Math.max(0, source.pageCount - only[1].size);
  }
  return { pages, deleted };
}
