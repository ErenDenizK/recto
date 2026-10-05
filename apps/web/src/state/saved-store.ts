/**
 * The saved mark (spec redesign X13; ADR-0032 §2.1, §5.2; ADR-0030 §5.2): which state of each
 * document is in its file, kept beside the model and never in it.
 *
 * `VirtualDocument.clean` and `markDocumentClean` stay unused: writing a flag into
 * `documents[id]` would make a save look like a change to the document (and trip the Lock check
 * of ADR-0030 once it lands in `commit()`). Instead this store keeps, per document, the mark of
 * what was last written: the `at` of the history entry present then (`entryAt`, X13's shape),
 * the document object itself and the ids of its sources' engine edits. Since history entries
 * share structure, a document is in its file exactly while the workspace still holds those same
 * parts (`sameFileContent`: every field but the title, which a rename changes and Save does not
 * write) and those same edits; an undo past the save, or a redo back to it, moves the mark's
 * answer with it, with no bookkeeping.
 *
 * A document seen for the first time as a pristine copy of its file (as opened, or restored
 * without changes) is in its file: its first mark is that state, with `handleKept: false`. One
 * that appears changed (a combine, a split part, images, a restored document with changes) has
 * no mark and reads as not in a file until it is saved. The tab's ● (01-frame §4, "changes not
 * yet in the file") and Save's dimmed "Saved" both read `isInFile`.
 *
 * The store also remembers each document's origin (the source it was opened from), so "Revert
 * to the opened version…" knows which bytes to reopen (ADR-0032 §2.2). After a revert the new
 * source is pushed; undoing the revert brings the old one back into the workspace, and the
 * newest origin the workspace still holds wins.
 *
 * Session memory only: after a reload a restored document with changes since opening shows ●
 * until it is saved again, even when an earlier save had written them (keeping the mark in the
 * snapshot is a question for the session format, D0-7).
 */
import type { DocumentId, SourceId, VirtualDocument, Workspace } from '@pdf-editor/document-model';
import { create } from 'zustand';

import { isPristineDocument } from '../session/snapshot';
import { documentSources, useWorkspaceStore } from './workspace-store';

export interface SavedMark {
  /** `at` of the history entry that was present when this state was written (or seen as opened). */
  readonly entryAt: number;
  /** The document object as written. */
  readonly document: VirtualDocument;
  /** The ids of its sources' engine edits as written, in order (`editSignature`). */
  readonly edits: string;
  /** Written through a file handle this session keeps (in place, or the save picker). */
  readonly handleKept: boolean;
}

interface SavedState {
  readonly marks: Readonly<Record<DocumentId, SavedMark>>;
  /** Sources each document was opened from, oldest first (Revert to the opened version). */
  readonly origins: Readonly<Record<DocumentId, readonly SourceId[]>>;
}

export const useSavedStore = create<SavedState>()(() => ({ marks: {}, origins: {} }));

/** The engine edits of a document's sources, by id, in order: what the file holds of them. */
export function editSignature(ws: Workspace, doc: VirtualDocument): string {
  const sources = new Set<string>(documentSources(doc));
  if (sources.size === 0) return '';
  return ws.engineEdits
    .filter((edit) => sources.has(edit.source))
    .map((edit) => edit.id)
    .join(',');
}

/**
 * Whether two states of one document write the same file: every field but the tab's title
 * (a rename changes no byte Save writes; `clean` is unused, X13) is the same object or value.
 * Operations share what they do not change, so this is a handful of reference checks.
 */
export function sameFileContent(a: VirtualDocument, b: VirtualDocument): boolean {
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (key === 'title' || key === 'clean') continue;
    if (a[key as keyof VirtualDocument] !== b[key as keyof VirtualDocument]) return false;
  }
  return true;
}

/** Whether the document's present state is the one `mark` says was written. */
export function matchesMark(ws: Workspace, id: DocumentId, mark: SavedMark | undefined): boolean {
  const doc = ws.documents[id];
  if (doc === undefined || mark === undefined) return false;
  return sameFileContent(doc, mark.document) && editSignature(ws, doc) === mark.edits;
}

/**
 * Whether everything in document `id` is in its file (X13): Save reads "Saved" and the tab
 * shows no ●. An unknown document is not.
 */
export function isInFile(
  ws: Workspace,
  id: DocumentId,
  marks: Readonly<Record<DocumentId, SavedMark>> = useSavedStore.getState().marks,
): boolean {
  return matchesMark(ws, id, marks[id]);
}

/** The single source every page of `doc` comes from, if there is one. */
function onlySource(doc: VirtualDocument): SourceId | undefined {
  let found: SourceId | undefined;
  for (const page of doc.pages) {
    if (page.ref.kind !== 'source') return undefined;
    if (found === undefined) found = page.ref.source;
    else if (found !== page.ref.source) return undefined;
  }
  return found;
}

/** Documents already looked at once (a document that appeared changed never gets a first mark). */
const seen = new Set<DocumentId>();

/** Notes the documents of `ws` seen for the first time (see the module comment). */
export function observeDocuments(ws: Workspace, entryAt: number): void {
  const marks: Record<DocumentId, SavedMark> = {};
  const origins: Record<DocumentId, readonly SourceId[]> = {};
  for (const id of ws.documentOrder) {
    if (seen.has(id)) continue;
    const doc = ws.documents[id];
    if (doc === undefined) continue;
    seen.add(id);
    const origin = onlySource(doc);
    if (origin !== undefined) origins[id] = [origin];
    if (isPristineDocument(ws, doc)) {
      marks[id] = { entryAt, document: doc, edits: editSignature(ws, doc), handleKept: false };
    }
  }
  if (Object.keys(marks).length === 0 && Object.keys(origins).length === 0) return;
  useSavedStore.setState((s) => ({
    marks: { ...s.marks, ...marks },
    origins: { ...origins, ...s.origins },
  }));
}

/**
 * Records that document `id`, as the workspace holds it now, was written and verified: the
 * ● clears and Save reads "Saved" until the document changes again.
 */
export function markSaved(
  id: DocumentId,
  options: { readonly handleKept: boolean },
  state: { readonly workspace: Workspace; readonly entryAt: number } = currentState(),
): void {
  const doc = state.workspace.documents[id];
  if (doc === undefined) return;
  const mark: SavedMark = {
    entryAt: state.entryAt,
    document: doc,
    edits: editSignature(state.workspace, doc),
    handleKept: options.handleKept,
  };
  if (options.handleKept) writtenOver.add(id);
  useSavedStore.setState((s) => ({ marks: { ...s.marks, [id]: mark } }));
}

/** Documents whose file this session wrote over (in place, or through the save picker). */
const writtenOver = new Set<DocumentId>();

/**
 * Whether the file document `id` came from still holds the opened version: nothing was
 * written over it this session (a downloaded or shared copy leaves it as it was). Revert then
 * brings the document back to what is in its file.
 */
export function fileIsAsOpened(id: DocumentId): boolean {
  return !writtenOver.has(id);
}

/**
 * Records the state a document was written in, captured before the write started: a change
 * made while the save ran is then still "not in the file" afterwards.
 */
export function captureState(): { readonly workspace: Workspace; readonly entryAt: number } {
  return currentState();
}

function currentState(): { readonly workspace: Workspace; readonly entryAt: number } {
  const { history } = useWorkspaceStore.getState();
  return { workspace: history.present.workspace, entryAt: history.present.at };
}

/** Adds the source a revert reopened as the document's newest origin. */
export function pushOrigin(id: DocumentId, source: SourceId): void {
  useSavedStore.setState((s) => ({
    origins: { ...s.origins, [id]: [...(s.origins[id] ?? []), source] },
  }));
}

/** The source document `id` was opened from that the workspace still holds, if any. */
export function originOf(
  ws: Workspace,
  id: DocumentId,
  origins: Readonly<Record<DocumentId, readonly SourceId[]>> = useSavedStore.getState().origins,
): SourceId | undefined {
  const list = origins[id] ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const source = list[i];
    if (source !== undefined && ws.sources[source] !== undefined) return source;
  }
  return undefined;
}

/** Whether document `id` is in its file, kept current (the tab's ●, Save's label). */
export function useInFile(id: DocumentId | null | undefined): boolean {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const mark = useSavedStore((s) => (id == null ? undefined : s.marks[id]));
  return id != null && matchesMark(workspace, id, mark);
}

let watching = false;

/** Starts noting new documents (idempotent; the store's first reader calls it). */
export function watchSavedMarks(): void {
  if (watching) return;
  watching = true;
  const now = useWorkspaceStore.getState();
  observeDocuments(now.workspace, now.history.present.at);
  useWorkspaceStore.subscribe((state, previous) => {
    if (state.workspace.documentOrder === previous.workspace.documentOrder) return;
    observeDocuments(state.workspace, state.history.present.at);
  });
}

watchSavedMarks();

/** Tests: forget every mark and origin, and which documents were seen. */
export function resetSavedMarks(): void {
  seen.clear();
  writtenOver.clear();
  useSavedStore.setState({ marks: {}, origins: {} });
}
