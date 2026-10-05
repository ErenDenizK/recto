/**
 * What the compact edition's Library and ⋯ menu do (ADR-0033 §2.3), on the shared file
 * intake, workspace store, Recents and engine: open one PDF, reopen a recent one, and hand
 * out a copy (Share where the browser can share files, else Download a copy).
 *
 * - **One document at a time.** Opening another file replaces the open one: the workspace
 *   is reset first (its engine sources close, so a phone keeps one PDF in memory), then the
 *   file opens. A file that does not open leaves the Library with one line saying why;
 *   the previous file is the first of the Recents.
 * - **Recents** records each open as the full edition does (name, size, pages, and the
 *   handle where the browser gave one), so a Recents row reopens with no picker in
 *   Chromium and through the file dialog elsewhere ("Open again…").
 * - **A copy** is the opened file's own bytes while the document is as it was opened (the
 *   compact edition changes nothing); a document with changes (a restored snapshot, D0-7)
 *   goes through the export, loaded only then.
 */
import type { SourceId, VirtualDocument } from '@pdf-editor/document-model';

import { getEngineService } from '../../engine/engine-service';
import { failureReason, presentError } from '../../errors/present';
import { fileHandleOf, pickFiles, rememberFileHandle } from '../../files/open-files';
import {
  canReopenRecent,
  type RecentEntry,
  recordRecent,
  reopenRecent,
  setRecentNote,
  useRecentsStore,
} from '../../files/recents';
import { m } from '../../i18n';
import { flushSession, isDocumentChanged, reopenFromSnapshot } from '../../session/session';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { useViewStore } from '../../state/view-store';
import { clearSearch } from '../../viewer/search';
import { announce } from '../announcer';
import { showReader, useCompactStore } from './compact-store';

const set = (patch: Partial<ReturnType<typeof useCompactStore.getState>>) =>
  useCompactStore.setState(patch);

/** The copy being prepared for the open document (the ⋯ menu starts it on open). */
let prepared: { doc: VirtualDocument; promise: Promise<File>; file?: File } | null = null;

/** The open document, if any. */
export function openDocument(): VirtualDocument | undefined {
  const { workspace } = useWorkspaceStore.getState();
  const id = workspace.activeDocument;
  return id === undefined ? undefined : workspace.documents[id];
}

/**
 * Closes the open document before the next one opens (one document at a time). Its snapshot
 * is written first, while the engine still has its bytes: a document opened a moment ago is
 * not stored yet, and once the reset closes its source in the engine its kept record could
 * not be written (ADR-0032 §2.6, closed documents stay in Recents).
 */
async function closeOpenDocument(): Promise<void> {
  if (useWorkspaceStore.getState().workspace.documentOrder.length === 0) return;
  await flushSession();
  clearSearch();
  prepared = null;
  resetWorkspace();
}

/**
 * Opens `file` as the one document and shows it. `replaces` names the Recents entry a
 * reopen came from, so the entry moves rather than doubles. Resolves true when it opened.
 */
export async function openPdf(file: File, replaces?: string): Promise<boolean> {
  if (useCompactStore.getState().opening) return false;
  set({ opening: true, openError: null });
  try {
    await closeOpenDocument();
    useViewStore.setState({ currentPage: 0, visibleRange: { first: 0, last: 0 }, navTarget: null });
    const { opened, skipped } = await useWorkspaceStore.getState().openFiles([file]);
    const first = opened[0];
    const doc =
      first === undefined
        ? undefined
        : useWorkspaceStore.getState().workspace.documents[first.documentId];
    if (first === undefined || doc === undefined) {
      const failure = skipped[0];
      set({
        openError: m.compact_open_failed({
          name: file.name,
          reason: failure ? failureReason(failure.error) : m.failure_engine(),
        }),
      });
      return false;
    }
    const handle = fileHandleOf(file);
    void recordRecent({
      name: file.name,
      size: file.size,
      pages: doc.pages.length,
      ...(handle === undefined ? {} : { handle }),
      ...(replaces === undefined ? {} : { replaces }),
    });
    set({ openedDocument: doc, zoom: 1, findOpen: false, sheet: null });
    showReader();
    announce(m.announce_opened({ name: file.name }));
    return true;
  } finally {
    set({ opening: false });
  }
}

/** The Library's Open PDF: the file dialog (or the Chromium picker), then the first PDF. */
export async function pickAndOpen(): Promise<void> {
  const [file] = await pickFiles('pdf');
  if (file !== undefined) await openPdf(file);
}

/**
 * A Recents row: back to the reader when it is the open document; else reopen through the
 * stored handle (asking for permission within the tap where needed), else the file dialog
 * with one line saying why. Call it straight from the tap, with no await before it.
 */
export async function openRecentEntry(entry: RecentEntry): Promise<void> {
  if (isOpenEntry(entry)) {
    showReader();
    return;
  }
  // A kept snapshot reopens with no picker on every browser (ADR-0032 §2.6), one document at
  // a time as every open here.
  // Only a snapshot that is gone falls back to the file; one that did not open now (a
  // skipped password prompt, an engine failure) stays on its row for another try.
  if (entry.kept !== undefined && (await openKept(entry.kept.snapshotId, entry)) !== 'gone') {
    return;
  }
  const access = useRecentsStore.getState().access[entry.id];
  if (canReopenRecent(entry) && access !== 'unavailable') {
    const result = await reopenRecent(entry);
    if (result.ok) {
      setRecentNote(null);
      rememberFileHandle(result.file, result.handle);
      await openPdf(result.file, entry.id);
      return;
    }
    setRecentNote({ id: entry.id, name: entry.name, kind: 'unavailable' });
    announce(m.recents_note_unavailable({ name: entry.name }));
    return;
  }
  // The dialog opens first, within the tap's user activation; the note follows at once.
  const picking = pickFiles('pdf');
  const note = { id: entry.id, name: entry.name, kind: 'open-again' } as const;
  setRecentNote(note);
  announce(m.recents_note_open_again({ name: entry.name }));
  const [file] = await picking;
  if (file === undefined) return;
  if (await openPdf(file, file.name === entry.name ? entry.id : undefined)) {
    if (useRecentsStore.getState().note === note) setRecentNote(null);
  }
}

/**
 * Reopens a kept snapshot as the one document: `opened`; `failed` when it did not open now
 * and stays kept (or another open is running); `gone` when the snapshot is missing or
 * unreadable (then the file).
 */
async function openKept(
  snapshotId: string,
  entry: RecentEntry,
): Promise<'opened' | 'failed' | 'gone'> {
  if (useCompactStore.getState().opening) return 'failed';
  set({ opening: true, openError: null });
  try {
    await closeOpenDocument();
    useViewStore.setState({ currentPage: 0, visibleRange: { first: 0, last: 0 }, navTarget: null });
    const result = await reopenFromSnapshot(snapshotId);
    if (result?.ok === false && result.reason === 'failed') {
      set({ openError: m.session_reopen_failed({ name: result.title ?? entry.name }) });
      return 'failed';
    }
    if (!result?.ok) return 'gone';
    const doc = useWorkspaceStore.getState().workspace.documents[result.documentId];
    if (doc === undefined) return 'gone';
    setRecentNote(null);
    // A document with changes is not the file as opened: its copy goes through the export.
    set({
      openedDocument: isDocumentChanged(doc.id) ? null : doc,
      zoom: 1,
      findOpen: false,
      sheet: null,
    });
    showReader();
    announce(m.announce_opened({ name: result.record.title }));
    return 'opened';
  } finally {
    set({ opening: false });
  }
}

/** Whether a Recents entry is the document open now (same name and size). */
export function isOpenEntry(entry: Pick<RecentEntry, 'name' | 'size'>): boolean {
  const doc = openDocument();
  if (!doc) return false;
  const { files } = useWorkspaceStore.getState();
  const source = firstSource(doc);
  const info = source === undefined ? undefined : files[source];
  return info?.name === entry.name && info.size === entry.size;
}

function firstSource(doc: VirtualDocument): SourceId | undefined {
  for (const page of doc.pages) if (page.ref.kind === 'source') return page.ref.source;
  return undefined;
}

/**
 * The single source whose own bytes are the document, when the document is exactly that
 * file as opened: the same object the open produced and no engine edits on its source.
 */
function pristineSource(doc: VirtualDocument): SourceId | undefined {
  if (doc !== useCompactStore.getState().openedDocument) return undefined;
  const source = firstSource(doc);
  if (source === undefined) return undefined;
  const { workspace, dirtySources } = useWorkspaceStore.getState();
  if (dirtySources.has(source)) return undefined;
  if (workspace.engineEdits.some((edit) => edit.source === source)) return undefined;
  const ok = doc.pages.every(
    (page, index) =>
      page.ref.kind === 'source' &&
      page.ref.source === source &&
      page.ref.index === index &&
      page.rotation === 0 &&
      page.resize === undefined &&
      page.cropBox === undefined &&
      page.overlays.length === 0,
  );
  return ok && workspace.sources[source]?.pageCount === doc.pages.length ? source : undefined;
}

/** The file name a copy is offered under: the opened file's, else the title as a PDF. */
export function copyName(doc: VirtualDocument): string {
  const source = pristineSource(doc);
  const name = source === undefined ? undefined : useWorkspaceStore.getState().files[source]?.name;
  if (name) return name;
  const title = doc.title.trim() || 'document';
  return /\.pdf$/i.test(title) ? title : `${title}.pdf`;
}

/** The document's bytes as a PDF file. Throws with a short reason. */
export async function documentFile(doc: VirtualDocument): Promise<File> {
  const source = pristineSource(doc);
  let bytes: ArrayBuffer;
  if (source !== undefined) {
    const result = await getEngineService().sourceBytes(source);
    if (!result.ok) throw new Error(result.error.message);
    bytes = result.value;
  } else {
    const { prepareExport } = await import('../../export/export-service');
    const result = await prepareExport(doc.id);
    if (!result.ok) throw new Error(result.error.message);
    bytes = result.value.bytes;
  }
  return new File([bytes], copyName(doc), { type: 'application/pdf' });
}

interface ShareNavigator {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[]; title?: string }) => Promise<void>;
}

/** Whether this browser can share a PDF file (Web Share level 2), checked without bytes. */
export function canShareFiles(nav: Navigator = navigator): boolean {
  const share = nav as Navigator & ShareNavigator;
  if (typeof share.canShare !== 'function' || typeof share.share !== 'function') return false;
  try {
    return share.canShare({
      files: [new File([], 'document.pdf', { type: 'application/pdf' })],
    });
  } catch {
    return false;
  }
}

/** Saves `file` through a download link (every browser). */
function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Long enough for the browser to start reading the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Starts preparing the document's copy, so Share can open the system sheet straight from the
 * tap (Safari wants the share call within the tap's activation, before any await). Cached
 * per document object.
 */
export function prepareCopy(doc: VirtualDocument): Promise<File> {
  if (prepared?.doc === doc) return prepared.promise;
  const promise = documentFile(doc);
  const entry: { doc: VirtualDocument; promise: Promise<File>; file?: File } = { doc, promise };
  prepared = entry;
  promise.then(
    (file) => {
      entry.file = file;
    },
    () => {
      if (prepared === entry) prepared = null;
    },
  );
  return promise;
}

/**
 * Share (the system sheet with the file) where the browser can share files, else Download a
 * copy. A dismissed share sheet is not an error.
 */
export async function shareOrDownload(): Promise<void> {
  const doc = openDocument();
  if (!doc) return;
  let file = prepared?.doc === doc ? prepared.file : undefined;
  if (file === undefined) {
    try {
      file = await prepareCopy(doc);
    } catch (error) {
      const reason = error instanceof Error && error.message ? error.message : m.failure_engine();
      // A failure toast above the capsule (FB8), not a line of its own.
      presentError({ kind: 'message', text: m.compact_copy_failed({ reason }) });
      return;
    }
  }
  const share = navigator as Navigator & ShareNavigator;
  if (canShareFiles() && share.share) {
    try {
      await share.share({ files: [file], title: doc.title });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Sharing refused (the tap's activation spent while the copy was prepared): download.
    }
  }
  download(file);
}
