/**
 * What the thumbnail list does to pages (`components/06-navigation.md` N2 §6, §2.4): the
 * thumbnail menu's items, Alt+Up / Alt+Down and a drop, each on explicit pages, each one
 * `pages` act through `commit()` and one undo step.
 *
 * The list navigates without selecting (S10), and moving pages must not select them either:
 * a drag "moves the page under the pointer without selecting it" (RA-7). `transferPages`
 * (`dnd/drop.ts`, shared with the grid) leaves the moved pages selected, so the list puts the
 * selection back as it was (`keepSelection`).
 */
import { findPageLocation, insertBlankPage, type PageId } from '@pdf-editor/document-model';

import { inDocumentOrder, transferPages } from '../../dnd/drop';
import { m } from '../../i18n';
import { extractPages } from '../../stage/arrange-actions';
import { cropPage, deletePage, rotatePage } from '../../stage/PageContextMenu';
import { openOperationDialog } from '../../stage/operation-dialogs-store';
import { enterPagesGrid } from '../../stage/pages-grid-door';
import { pruneSelection, selectionSnapshot, useSelectionStore } from '../../state/selection-store';
import { pagesPhrase, useWorkspaceStore } from '../../state/workspace-store';
import { toast } from '../../ui/Toast/toast';
import { announce } from '../announcer';

const model = () => useWorkspaceStore.getState();

/**
 * The pages an item acts on: the selection when it holds `pageId` (the selection the list
 * shows, in page order), else `pageId` alone (06 N2 §6, "for the selection when it contains
 * the page").
 */
export function pagesFor(pageId: PageId, order: readonly PageId[]): PageId[] {
  const { selected } = useSelectionStore.getState();
  if (!selected.has(pageId)) return [pageId];
  return order.filter((id) => selected.has(id));
}

/** Runs `change` and restores the selection it had before, minus pages that went away. */
function keepSelection<T>(change: () => T): T {
  const before = selectionSnapshot();
  const result = change();
  const ws = model().workspace;
  useSelectionStore
    .getState()
    .apply(pruneSelection(before, (id) => findPageLocation(ws, id) !== undefined));
  return result;
}

/** Rotates `ids` by 90° (one page says which page turned). */
export function rotatePages(ids: readonly PageId[], delta: 90 | -90): boolean {
  const [only] = ids;
  if (ids.length === 1 && only !== undefined) return rotatePage(only, delta);
  if (!model().rotatePages(ids, delta)) return false;
  announce(
    delta > 0
      ? m.announce_rotated_right({ count: ids.length })
      : m.announce_rotated_left({ count: ids.length }),
  );
  return true;
}

/** Deletes `ids` with an Undo toast; never every page of a document (a document keeps one). */
export function deletePages(ids: readonly PageId[]): boolean {
  const [first] = ids;
  if (first === undefined) return false;
  if (ids.length === 1) return deletePage(first);
  const ws = model().workspace;
  const location = findPageLocation(ws, first);
  const doc = location === undefined ? undefined : ws.documents[location.document];
  if (!doc) return false;
  const gone = new Set(ids);
  const firstNumber = doc.pages.findIndex((p) => gone.has(p.id)) + 1;
  if (!model().deletePages([...ids])) return false;
  useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
  toast.undo(m.toast_deleted_pages({ count: ids.length, page: firstNumber }), {
    documentId: doc.id,
  });
  return true;
}

/** Whether deleting `ids` would leave their document without a page (dimmed, 06 N2 §6). */
export function deletesEveryPage(ids: readonly PageId[], pageCount: number): boolean {
  return ids.length >= pageCount;
}

/** "Crop page…": the crop sheet for `ids`. */
export function cropPages(ids: readonly PageId[]): void {
  const [first] = ids;
  if (first === undefined) return;
  if (ids.length === 1) {
    cropPage(first);
    return;
  }
  const location = findPageLocation(model().workspace, first);
  if (location === undefined) return;
  openOperationDialog({ kind: 'crop', documentId: location.document, pageIds: [...ids] });
}

/** "Insert blank page after": one blank page after `pageId`. */
export function insertBlankAfterPage(pageId: PageId): boolean {
  const location = findPageLocation(model().workspace, pageId);
  if (location === undefined) return false;
  const target = { document: location.document, index: location.index + 1 };
  const committed = model().applyOperation(
    (ws, ids) => insertBlankPage(ws, target, ids),
    m.history_insert_blank(),
  );
  if (!committed) return false;
  const title = model().workspace.documents[target.document]?.title ?? '';
  announce(m.announce_inserted_blank({ position: target.index + 1, title }));
  return true;
}

/** "Extract page…": the pages move to a new document after this one (`extractPages`). */
export function extractPagesOf(ids: readonly PageId[]): boolean {
  const first = ids[0] ?? null;
  // The shared action reads the selection; this is an explicit command, so it may write it.
  useSelectionStore.getState().apply({ selected: new Set(ids), anchor: first, focused: first });
  return extractPages();
}

/** "Copy page": the in-app page clipboard (`selection-store`), as the grid's Mod+C. */
export function copyPagesOf(ids: readonly PageId[]): void {
  useSelectionStore.getState().setClipboard({ pageIds: [...ids], mode: 'copy' });
  announce(m.announce_copied({ pages: pagesPhrase(ids.length) }));
}

/** "Paste pages after": the clipboard's pages after `pageId` (copies, or moves after a cut). */
export function pasteAfterPage(pageId: PageId): boolean {
  const { clipboard } = useSelectionStore.getState();
  const location = findPageLocation(model().workspace, pageId);
  if (clipboard === null || location === undefined) return false;
  const result = keepSelection(() =>
    transferPages({
      pageIds: clipboard.pageIds,
      target: { document: location.document, index: location.index + 1 },
      duplicate: clipboard.mode === 'copy',
    }),
  );
  if (result !== undefined && clipboard.mode === 'cut') {
    useSelectionStore.getState().setClipboard(null);
  }
  return result !== undefined;
}

/** "Show in Pages grid": the grid opens at this page (PG1). */
export function showInGrid(pageId: PageId): void {
  enterPagesGrid(pageId);
}

/**
 * A drop (or Alt+arrow) inside the list: `ids` move to the gap `index` of their document
 * (a gap before removal, as the drop shows it), or are copied there with Alt. The selection
 * stays as it was. Returns the moved (or copied) pages, or undefined for a no-op.
 */
export function movePagesTo(
  ids: readonly PageId[],
  documentId: Parameters<typeof transferPages>[0]['target']['document'],
  index: number,
  options: { readonly duplicate?: boolean; readonly coalesceKey?: string } = {},
): readonly PageId[] | undefined {
  const pageIds = inDocumentOrder(model().workspace, ids);
  if (pageIds.length === 0) return undefined;
  const result = keepSelection(() =>
    transferPages({
      pageIds,
      target: { document: documentId, index },
      duplicate: options.duplicate === true,
      ...(options.coalesceKey === undefined ? {} : { coalesceKey: options.coalesceKey }),
    }),
  );
  return result?.pageIds;
}

/**
 * Alt+Up / Alt+Down (06 N2 §6): `ids` (one block) move by one place in `order`. The gap is
 * before removal: one place up is the gap before the page above the block, one place down the
 * gap after the page below it. Undefined at the ends.
 */
export function stepTarget(
  order: readonly PageId[],
  ids: readonly PageId[],
  direction: 1 | -1,
): number | undefined {
  const indices = ids.map((id) => order.indexOf(id)).filter((i) => i >= 0);
  if (indices.length === 0) return undefined;
  const first = Math.min(...indices);
  const last = Math.max(...indices);
  if (direction < 0) return first === 0 ? undefined : first - 1;
  return last >= order.length - 1 ? undefined : last + 2;
}
