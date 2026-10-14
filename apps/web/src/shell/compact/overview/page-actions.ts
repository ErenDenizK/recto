/**
 * What the phone overview does to pages (MOB-3; `docs/research/phone-2026-10/pages.md` §4.2):
 * every act is the full edition's operation, unforked, committed as one history step and
 * followed by the standard Undo toast (`toast.undo`, bound to that step).
 *
 * - **Rotate, Delete:** the workspace store's `rotatePages` / `deletePages` with the page
 *   menu's toasts (the rotate toast keyed, so turning again replaces it). A document keeps a
 *   page: deleting every page is refused with a line.
 * - **Duplicate, Move, a drag:** `transferPages` (`dnd/drop.ts`, the grid's own), which labels,
 *   announces and commits one step; a drag's gap is the gap before the move.
 * - **Add:** pages from files through `insertFilesAt` (PDFs and images, one step, bookmarks
 *   kept), a blank page through `insertBlankPage`, a recent document's file (its stored handle,
 *   else the picker) through `insertFilesAt`, all after the selection or the page the overview
 *   opened on.
 * - **Extract as file, Split here:** never change the open document (MOB-3, EDN-14). The
 *   chosen pages go into a document of a workspace of their own, made by the model's pure
 *   `newEmptyDocument` + `duplicatePages` and never put in the store, which `prepareExport`
 *   exports with the app's own steps (`defaultDependencies`, only the workspace swapped). The
 *   files go to the share sheet, or download where sharing files is not offered. A share sheet
 *   refused because the export took the tap's activation (iOS) asks for one more tap.
 */
import {
  createRandomIdGenerator,
  duplicatePages,
  findPageLocation,
  insertBlankPage,
  newEmptyDocument,
  type PageId,
  type VirtualDocument,
} from '@pdf-editor/document-model';

import { insertFilesAt, transferPages } from '../../../dnd/drop';
import { pickFiles } from '../../../files/open-files';
import {
  canReopenRecent,
  type RecentEntry,
  reopenRecent,
  useRecentsStore,
} from '../../../files/recents';
import { m } from '../../../i18n';
import { pagesPhrase, useWorkspaceStore } from '../../../state/workspace-store';
import { toast } from '../../../ui/Toast/toast';
import { announce } from '../../announcer';
import { canShareFiles, downloadFile, openDocument } from '../compact-actions';
import { insertionIndex, partName, splitRanges } from './page-plan';

const model = () => useWorkspaceStore.getState();

/** The full edition's key for the rotation's toast (`commands/app-commands.ts`). */
const ROTATE_TOAST_KEY = 'pages-rotated';

/** The open document's page indexes of `ids`, in page order. */
export function indexesOf(doc: VirtualDocument, ids: Iterable<PageId>): number[] {
  const wanted = new Set(ids);
  const indexes: number[] = [];
  doc.pages.forEach((page, i) => {
    if (wanted.has(page.id)) indexes.push(i);
  });
  return indexes;
}

/** Rotates `ids` a quarter turn (right for `90`), with the keyed Undo toast. */
export function rotate(ids: readonly PageId[], delta: 90 | -90 = 90): boolean {
  const [first] = ids;
  const location = first === undefined ? undefined : findPageLocation(model().workspace, first);
  if (location === undefined || !model().rotatePages(ids, delta)) return false;
  const page = location.index + 1;
  const text =
    ids.length === 1
      ? delta > 0
        ? m.toast_rotated_page_right({ page })
        : m.toast_rotated_page_left({ page })
      : delta > 0
        ? m.toast_rotated_pages_right({ count: ids.length, page })
        : m.toast_rotated_pages_left({ count: ids.length, page });
  toast.undo(text, { documentId: location.document, key: ROTATE_TOAST_KEY });
  return true;
}

/** Deletes `ids` with the Undo toast; a document keeps at least one page. */
export function remove(ids: readonly PageId[]): boolean {
  const doc = openDocument();
  if (!doc || ids.length === 0) return false;
  const indexes = indexesOf(doc, ids);
  if (indexes.length >= doc.pages.length) {
    toast.info(m.compact_overview_keep_one());
    return false;
  }
  if (!model().deletePages([...ids])) return false;
  toast.undo(m.toast_deleted_pages({ count: indexes.length, page: (indexes[0] ?? 0) + 1 }), {
    documentId: doc.id,
  });
  return true;
}

/** Moves `ids` into `gap` (a gap index before the move: 0 = the start). */
export function moveTo(ids: readonly PageId[], gap: number): boolean {
  const doc = openDocument();
  if (!doc || ids.length === 0) return false;
  const moved = transferPages({
    pageIds: ids,
    target: { document: doc.id, index: Math.min(Math.max(0, gap), doc.pages.length) },
    duplicate: false,
    select: false,
  });
  if (moved === undefined) return false;
  toast.undo(m.compact_overview_moved({ pages: pagesPhrase(ids.length) }), {
    documentId: doc.id,
    spoken: false,
  });
  return true;
}

/** Duplicates `ids` right after the last of them. */
export function duplicate(ids: readonly PageId[]): boolean {
  const doc = openDocument();
  if (!doc || ids.length === 0) return false;
  const last = Math.max(...indexesOf(doc, ids));
  const copied = transferPages({
    pageIds: ids,
    target: { document: doc.id, index: last + 1 },
    duplicate: true,
    select: false,
  });
  if (copied === undefined) return false;
  toast.undo(m.compact_overview_duplicated({ pages: pagesPhrase(ids.length) }), {
    documentId: doc.id,
    spoken: false,
  });
  return true;
}

/** Where Add puts pages: after the selection, else after the page `anchor`. */
function addTarget(selected: readonly PageId[], anchor: number) {
  const doc = openDocument();
  if (!doc) return undefined;
  const index = insertionIndex(doc.pages.length, indexesOf(doc, selected), anchor);
  return { document: doc.id, index };
}

/** Inserts `files` (PDFs, images) after the selection or the anchor; one step. */
export async function addFiles(
  files: readonly File[],
  selected: readonly PageId[],
  anchor: number,
): Promise<boolean> {
  const target = addTarget(selected, anchor);
  if (!target || files.length === 0) return false;
  const placed = await insertFilesAt(files, target);
  if (placed.length === 0) return false;
  toast.undo(m.compact_overview_added({ pages: pagesPhrase(placed.length) }), {
    documentId: target.document,
    spoken: false,
  });
  return true;
}

/** Pages from a file: the system picker (opened within the tap), then `addFiles`. */
export async function addFromPicker(selected: readonly PageId[], anchor: number): Promise<boolean> {
  const files = await pickFiles('openable');
  return addFiles(files, selected, anchor);
}

/** A blank page, the size of the page before it. */
export function addBlank(selected: readonly PageId[], anchor: number): boolean {
  const target = addTarget(selected, anchor);
  if (!target) return false;
  const committed = model().applyOperation(
    (ws, ids) => insertBlankPage(ws, target, ids),
    m.history_insert_blank(),
  );
  if (!committed) return false;
  const title = model().workspace.documents[target.document]?.title ?? '';
  announce(m.announce_inserted_blank({ position: target.index + 1, title }));
  toast.undo(m.compact_overview_added_blank(), { documentId: target.document, spoken: false });
  return true;
}

/**
 * A recent document's pages: its stored handle where this browser keeps one (asking for
 * permission within the tap), else the picker, opened at once so the tap's activation holds.
 */
export async function addRecent(
  entry: RecentEntry,
  selected: readonly PageId[],
  anchor: number,
): Promise<boolean> {
  const access = useRecentsStore.getState().access[entry.id];
  if (canReopenRecent(entry) && access !== 'unavailable') {
    const reopened = await reopenRecent(entry);
    if (reopened.ok) return addFiles([reopened.file], selected, anchor);
  }
  return addFromPicker(selected, anchor);
}

/** The pages `indexes` of `doc` as a PDF file named `name`; the open document is untouched. */
export async function exportPages(
  doc: VirtualDocument,
  indexes: readonly number[],
  name: string,
): Promise<File> {
  const ws = model().workspace;
  const ids = createRandomIdGenerator();
  const made = newEmptyDocument(ws, ids, { title: name.replace(/\.pdf$/i, '') });
  const pageIds = indexes.flatMap((i) => {
    const page = doc.pages[i];
    return page ? [page.id] : [];
  });
  const subset = duplicatePages(made.workspace, pageIds, ids, {
    target: { document: made.documentId, index: 0 },
  });
  const { defaultDependencies, prepareExport } = await import('../../../export/export-service');
  const result = await prepareExport(
    made.documentId,
    {},
    { ...defaultDependencies(), workspace: () => subset },
  );
  if (!result.ok) throw new Error(result.error.message);
  return new File([result.value.bytes], name, { type: 'application/pdf' });
}

function pagesLabel(start: number, end: number): string {
  return end - start === 1
    ? m.compact_overview_part_page({ number: start + 1 })
    : m.compact_overview_part_pages({ first: start + 1, last: end });
}

/** Extract as file: the selected pages as one file, to the share sheet. */
export async function extract(ids: readonly PageId[]): Promise<File[]> {
  const doc = openDocument();
  if (!doc || ids.length === 0) return [];
  const indexes = indexesOf(doc, ids);
  const first = indexes[0] ?? 0;
  const last = indexes[indexes.length - 1] ?? first;
  const contiguous = last - first + 1 === indexes.length;
  const label = contiguous ? pagesLabel(first, last + 1) : pagesPhrase(indexes.length);
  return [await exportPages(doc, indexes, partName(doc.title, label))];
}

/** Split here: a new file starts at each selected page; every part to the share sheet. */
export async function split(ids: readonly PageId[]): Promise<File[]> {
  const doc = openDocument();
  if (!doc) return [];
  const ranges = splitRanges(doc.pages.length, indexesOf(doc, ids));
  if (ranges.length < 2) return [];
  const files: File[] = [];
  // One at a time: a phone holds one export's bytes, not every part's at once.
  for (const [start, end] of ranges) {
    const indexes = Array.from({ length: end - start }, (_, i) => start + i);
    files.push(await exportPages(doc, indexes, partName(doc.title, pagesLabel(start, end))));
  }
  return files;
}

interface ShareNavigator {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[]; title?: string }) => Promise<void>;
}

/**
 * Hands `files` to the share sheet where the browser shares files (several at once), else
 * downloads each. A share refused for want of the tap's activation (the export ran first)
 * offers Share on a toast: one more tap, as EDN-14's saving path.
 */
export async function deliver(files: readonly File[]): Promise<void> {
  if (files.length === 0) return;
  const nav = navigator as Navigator & ShareNavigator;
  const list = [...files];
  const shareable = canShareFiles() && nav.share !== undefined && nav.canShare?.({ files: list });
  if (!shareable || !nav.share) {
    for (const file of list) downloadFile(file);
    return;
  }
  try {
    await nav.share({ files: list });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    toast.action(
      list.length === 1
        ? m.compact_overview_file_ready()
        : m.compact_overview_files_ready({ count: list.length }),
      {
        label: m.compact_share(),
        run: () => {
          nav.share?.({ files: list }).catch((reason: unknown) => {
            if (reason instanceof DOMException && reason.name === 'AbortError') return;
            for (const file of list) downloadFile(file);
          });
        },
      },
    );
  }
}
