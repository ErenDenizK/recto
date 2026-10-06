/**
 * Section operations (light-table spec §5; `components/07-sheets.md` S13–S18) bound to the
 * stores: split, combine, interleave, rename, copy to a new document, images as pages and page
 * resize. Each commits one history entry with a readable label and announces the outcome. The
 * sheets and commands call these; the math lives in `operation-plans.ts` (and the model's
 * resize.ts).
 *
 * Combine and Interleave have one outcome (INV-12, spec 07.13): a new document after its
 * sources, which stay open and untouched. M8's "Merge into…" and "Merge all", which consumed
 * their inputs, are gone; the Pages grid's All open moves pages between documents instead.
 */
import {
  type BlobId,
  type DocumentId,
  documentTitleFromName,
  duplicatePages,
  type InterleaveMode,
  insertImagePage,
  interleave,
  mergeDocuments,
  newEmptyDocument,
  type PageId,
  renameDocument,
  type ResizeRequest,
  resizePages,
  type Size,
  type SplitSpec,
  splitDocument,
  splitPartSizes,
  type Workspace,
} from '@pdf-editor/document-model';

import { targetPages } from '../commands/app-commands';
import { currentPlatform } from '../commands/shortcuts';
import { inDocumentOrder } from '../dnd/drop';
import {
  decodeImageFile,
  imagePageSize,
  type ImageSizing,
  shouldAskImageSizing,
} from '../files/images';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { openTitleMenu } from '../shell/frame/frame-store';
import { canChange } from '../state/guard';
import { lockOpened } from '../state/lock-store';
import { useSelectionStore } from '../state/selection-store';
import { stageView, useUiStore } from '../state/ui-store';
import {
  pagesPhrase,
  type ProtectionLease,
  type StoredBlob,
  useWorkspaceStore,
} from '../state/workspace-store';
import { shownInGridNow, showsAllDocuments } from './arrange-data';
import { askImageSizing } from './operation-dialogs-store';
import { type TitleProblem, validateTitle } from './operation-plans';

const model = () => useWorkspaceStore.getState();
const ui = () => useUiStore.getState();

/** Documents present after an operation that were not there before, in tab order. */
function createdDocuments(before: Workspace, after: Workspace): DocumentId[] {
  return after.documentOrder.filter((id) => before.documents[id] === undefined);
}

export function titleProblemMessage(problem: TitleProblem): string {
  switch (problem) {
    case 'empty':
      return m.title_error_empty();
    case 'too-long':
      return m.title_error_too_long({ max: 200 });
    case 'control':
      return m.title_error_control();
  }
}

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

/** Localized default part titles: "Report (1 of 3)". */
export function defaultPartTitles(title: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    m.split_part_title({ title, index: i + 1, count }),
  );
}

/**
 * Splits a document. `titles` name the parts (missing ones get "<title> (k of n)"). The
 * parts open as tabs (the first becomes active) in one history entry.
 */
export function splitSection(
  documentId: DocumentId,
  spec: SplitSpec,
  titles?: readonly (string | undefined)[],
): DocumentId[] {
  const before = model().workspace;
  const doc = before.documents[documentId];
  if (doc === undefined) return [];
  let created: DocumentId[] = [];
  const committed = model().applyOperation(
    (ws, ids) => {
      const count = splitPartSizes(ws, documentId, spec).length;
      const defaults = defaultPartTitles(doc.title, count);
      const named = defaults.map((fallback, i) => titles?.[i] ?? fallback);
      const next = splitDocument(ws, documentId, spec, ids, { titles: named });
      created = createdDocuments(ws, next);
      return next;
    },
    () => m.history_split({ title: doc.title, count: created.length }),
  );
  if (!committed) return [];
  announce(m.announce_split({ title: doc.title, count: created.length }));
  return created;
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Combine (the Library's selection bar, Combine with open documents…; INV-12, 02.10): a new
 * document titled `title` made of copies of `order`'s pages, in that order, after the last of
 * them; the sources stay open and untouched. One history entry, announced with its undo key.
 */
export function mergeAll(order: readonly DocumentId[], title: string): DocumentId | undefined {
  const checked = validateTitle(title);
  if (!checked.ok || order.length < 2) return undefined;
  let created: DocumentId | undefined;
  const committed = model().applyOperation(
    (ws, ids) => {
      const next = mergeDocuments(
        ws,
        { documentIds: order, title: checked.title, keepSources: true },
        ids,
      );
      created = next.activeDocument;
      return next;
    },
    m.history_combine({ count: order.length }),
  );
  if (!committed || created === undefined) return undefined;
  announce(
    m.announce_combined({ count: order.length, title: checked.title, shortcut: undoHint() }),
  );
  return created;
}

function undoHint(): string {
  return currentPlatform === 'mac' ? m.undo_hint_mac() : m.undo_hint_other();
}

// ---------------------------------------------------------------------------
// Interleave
// ---------------------------------------------------------------------------

/**
 * Interleave (S14, spec 07.13): a new document of `a`'s and `b`'s pages alternated (or `b`
 * reversed for a duplex scan), after the later of them; both sources stay open, untouched. One
 * history entry. Asks no guard: the sources are only read (X32).
 */
export function interleaveWith(
  a: DocumentId,
  b: DocumentId,
  mode: InterleaveMode,
): DocumentId | undefined {
  const ws = model().workspace;
  const first = ws.documents[a];
  const second = ws.documents[b];
  if (first === undefined || second === undefined || a === b) return undefined;
  let created: DocumentId | undefined;
  const committed = model().applyOperation(
    (current, ids) => {
      const next = interleave(current, { a, b, mode, keepSources: true }, ids);
      created = next.activeDocument;
      return next;
    },
    m.history_interleave({ a: first.title, b: second.title }),
  );
  if (!committed || created === undefined) return undefined;
  announce(
    m.announce_interleaved({
      a: first.title,
      b: second.title,
      pages: pagesPhrase(first.pages.length + second.pages.length),
    }),
  );
  return created;
}

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

/** Renames a document; returns the problem when the title is not acceptable. */
export function renameDocumentTo(
  documentId: DocumentId,
  raw: string,
):
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly problem: TitleProblem } {
  const checked = validateTitle(raw);
  if (!checked.ok) return checked;
  const doc = model().workspace.documents[documentId];
  if (doc === undefined) return { ok: true, changed: false };
  const changed = model().applyOperation(
    (ws) => renameDocument(ws, documentId, checked.title),
    m.history_rename({ title: checked.title }),
  );
  if (changed) announce(m.announce_renamed({ title: checked.title }));
  return { ok: true, changed };
}

/**
 * Starts renaming: in place in the section header in the Pages grid's All open (PG3 §6), else
 * in the title menu's name field (01-frame F5, spec 01.4). Rename is a `document` act at every
 * entry point (X31: the title menu, the section header, F2 and the menus all come here), so a
 * locked document does not start one (D1-4 opens the Unlock popover there).
 */
export function startRename(documentId: DocumentId, surface?: 'tab' | 'section'): void {
  if (!canChange(documentId, 'document')) return;
  const inSection =
    surface === 'section' ||
    (surface === undefined &&
      stageView(ui()) === 'grid' &&
      shownInGridNow(documentId) &&
      showsAllDocuments(model().workspace, ui().gridScope));
  if (inSection) {
    ui().setRenaming({ documentId, surface: 'section' });
    return;
  }
  if (model().workspace.activeDocument !== documentId) model().setActive(documentId);
  openTitleMenu('name');
}

// ---------------------------------------------------------------------------
// Resize pages
// ---------------------------------------------------------------------------

/**
 * "Resize pages…": resizes `pageIds` (resize.ts in the model; `undefined` returns them to
 * their original size) as one history entry and announces it with `sizeLabel` (e.g.
 * "A4 portrait" or "210 × 297 mm"). Resolves to whether anything changed.
 */
export function resizePagesTo(
  pageIds: readonly PageId[],
  request: ResizeRequest | undefined,
  sizeLabel: string,
): boolean {
  if (pageIds.length === 0) return false;
  const pages = pagesPhrase(pageIds.length);
  const committed = model().applyOperation(
    (ws) => resizePages(ws, pageIds, request),
    m.history_resize({ pages }),
  );
  if (committed) {
    announce(
      request === undefined
        ? m.announce_resize_cleared({ pages })
        : m.announce_resized({ pages, size: sizeLabel }),
    );
  }
  return committed;
}

// ---------------------------------------------------------------------------
// Copy to new document
// ---------------------------------------------------------------------------

/**
 * "Copy to new document": duplicates the target pages (fresh ids, originals untouched)
 * into a new document after the first page's tab, as one history entry.
 */
export function copyPagesToNewDocument(): boolean {
  const ws = model().workspace;
  const pageIds = inDocumentOrder(ws, targetPages());
  const first = pageIds[0];
  const sourceDoc =
    first === undefined
      ? undefined
      : ws.documentOrder
          .map((id) => ws.documents[id])
          .find((doc) => doc?.pages.some((p) => p.id === first));
  if (sourceDoc === undefined) return false;
  const title = m.copy_document_title({ title: sourceDoc.title });
  let created: DocumentId | undefined;
  const committed = model().applyOperation(
    (current, ids) => {
      const made = newEmptyDocument(current, ids, {
        title,
        index: current.documentOrder.indexOf(sourceDoc.id) + 1,
      });
      created = made.documentId;
      return duplicatePages(made.workspace, pageIds, ids, {
        target: { document: made.documentId, index: 0 },
      });
    },
    m.history_copy_to_new({ pages: pagesPhrase(pageIds.length) }),
  );
  if (!committed || created === undefined) return false;
  const copies = model().workspace.documents[created]?.pages.map((p) => p.id) ?? [];
  useSelectionStore.getState().apply({
    selected: new Set(copies),
    anchor: copies[0] ?? null,
    focused: copies[0] ?? null,
  });
  announce(m.announce_copied_to_new({ pages: pagesPhrase(pageIds.length), title }));
  return true;
}

// ---------------------------------------------------------------------------
// Images as pages
// ---------------------------------------------------------------------------

export interface PreparedImage {
  readonly file: File;
  readonly blob: BlobId;
  readonly size: Size;
}

export interface PreparedImages {
  readonly images: readonly PreparedImage[];
  /** Names of files the browser could not decode. */
  readonly failed: readonly string[];
}

/**
 * Decodes image files, asks "Fit to A4 width" vs "Original size" when that matters (several
 * images, or one larger than A4), and stores the bytes as blobs. Resolves to undefined when
 * the user cancels the question. Call it as (part of) an `applyComposed` prelude with that
 * operation's lease: the blobs are protected under it until the insertion commits.
 */
export async function prepareImagePages(
  files: readonly File[],
  lease: ProtectionLease,
  sizing?: ImageSizing,
): Promise<PreparedImages | undefined> {
  const decoded = await Promise.all(
    files.map(async (file) => {
      try {
        return { file, blob: await decodeImageFile(file) };
      } catch {
        return { file, blob: undefined };
      }
    }),
  );
  const ok = decoded.filter((d): d is { file: File; blob: StoredBlob } => d.blob !== undefined);
  const failed = decoded.filter((d) => d.blob === undefined).map((d) => d.file.name);
  if (ok.length === 0) return { images: [], failed };
  let choice: ImageSizing | undefined = sizing ?? 'fit-a4';
  if (sizing === undefined && shouldAskImageSizing(ok.map((d) => d.blob))) {
    const largest = ok.reduce(
      (best, d) =>
        d.blob.width * d.blob.height > best.width * best.height
          ? { width: d.blob.width, height: d.blob.height }
          : best,
      { width: 0, height: 0 },
    );
    choice = await askImageSizing(ok.length, largest);
    if (choice === undefined) return undefined;
  }
  const store = model();
  const sizingChoice = choice;
  const images = ok.map(({ file, blob }) => ({
    file,
    blob: store.addBlob(blob, lease),
    size: imagePageSize(blob.width, blob.height, sizingChoice),
  }));
  return { images, failed };
}

/** Inserts prepared images into `documentId` at `index`; returns the new workspace. */
export function insertPreparedImages(
  ws: Workspace,
  ids: Parameters<typeof insertImagePage>[2],
  documentId: DocumentId,
  index: number,
  images: readonly PreparedImage[],
): Workspace {
  let next = ws;
  images.forEach((image, offset) => {
    next = insertImagePage(
      next,
      { document: documentId, index: index + offset, blob: image.blob, size: image.size },
      ids,
    );
  });
  return next;
}

/** "N files" or the single file's name, for labels such as "Insert 4 pages from x.pdf". */
export function fromPhrase(names: readonly string[]): string {
  return names.length === 1 ? (names[0] ?? '') : m.files_count({ count: names.length });
}

function announceFailed(failed: readonly string[]): string {
  return failed.length > 0 ? m.announce_images_failed({ names: failed.join(', ') }) : '';
}

/** "Insert images…": appends image pages to a document (or inserts them at `index`). */
export async function insertImagesInto(
  documentId: DocumentId,
  files: readonly File[],
  index?: number,
): Promise<PageId[]> {
  if (files.length === 0) return [];
  let placed: PageId[] = [];
  let failed: readonly string[] = [];
  let at = 0;
  const committed = await model().applyComposed(
    async (lease) => {
      const prepared = await prepareImagePages(files, lease);
      failed = prepared?.failed ?? [];
      return prepared !== undefined && prepared.images.length > 0 ? prepared : undefined;
    },
    (ws, ids, prepared) => {
      const doc = ws.documents[documentId];
      if (doc === undefined) return ws;
      at = Math.min(index ?? doc.pages.length, doc.pages.length);
      const next = insertPreparedImages(ws, ids, documentId, at, prepared.images);
      placed =
        next.documents[documentId]?.pages.slice(at, at + prepared.images.length).map((p) => p.id) ??
        [];
      return next;
    },
    (prepared) =>
      m.history_insert_pages({
        count: prepared.images.length,
        from: fromPhrase(prepared.images.map((i) => i.file.name)),
      }),
  );
  const title = model().workspace.documents[documentId]?.title ?? '';
  if (!committed) {
    if (failed.length > 0) announce(announceFailed(failed));
    return [];
  }
  useSelectionStore.getState().apply({
    selected: new Set(placed),
    anchor: placed[0] ?? null,
    focused: placed[0] ?? null,
  });
  announce(
    [
      m.announce_inserted_pages({
        pages: pagesPhrase(placed.length),
        from: fromPhrase(files.filter((f) => !failed.includes(f.name)).map((f) => f.name)),
        position: at + 1,
        title,
      }),
      announceFailed(failed),
    ]
      .filter(Boolean)
      .join('. '),
  );
  return placed;
}

/** Title of a document made of images: the first image's name ("scan-1.png" → "scan-1"). */
export function imagesDocumentTitle(files: readonly File[]): string {
  return documentTitleFromName((files[0]?.name ?? '').replace(/\.(png|jpe?g|webp)$/i, '.pdf'));
}

/** Images opened on their own (picker, drop on the tab bar): one new document. */
export async function openImagesAsDocument(
  files: readonly File[],
): Promise<DocumentId | undefined> {
  if (files.length === 0) return undefined;
  const title = imagesDocumentTitle(files);
  let created: DocumentId | undefined;
  let failed: readonly string[] = [];
  const committed = await model().applyComposed(
    async (lease) => {
      const prepared = await prepareImagePages(files, lease);
      failed = prepared?.failed ?? [];
      return prepared !== undefined && prepared.images.length > 0 ? prepared : undefined;
    },
    (ws, ids, prepared) => {
      const made = newEmptyDocument(ws, ids, { title });
      created = made.documentId;
      return insertPreparedImages(made.workspace, ids, made.documentId, 0, prepared.images);
    },
    (prepared) =>
      m.history_open({
        name: fromPhrase(prepared.images.map((i) => i.file.name)),
      }),
  );
  if (!committed) {
    if (failed.length > 0) announce(announceFailed(failed));
    return undefined;
  }
  // Opened from files, like a PDF: "Open documents locked" applies (ADR-0029 §2.8).
  if (created !== undefined) lockOpened([created]);
  announce([m.announce_opened({ name: title }), announceFailed(failed)].filter(Boolean).join('. '));
  return created;
}
