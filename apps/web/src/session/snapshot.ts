/**
 * Building snapshots from the app's state (ADR-0032 §2.4), as pure functions over what the
 * stores hold, so the writer and the tests share them:
 *
 * - `buildSessionManifest`: the history tail (the last 20 undo steps, `serializeHistoryTail`),
 *   per open document its page, view and lock, and the files the tail needs: every source
 *   any kept entry shows, every image blob its documents draw and every edit blob its edits
 *   refer to (`engineEditBlobIds`), so the edit runner can inline them after a restore.
 * - `buildKeptRecord`: one closed document for Recents (§2.6), as a workspace holding the
 *   document, the sources it shows and the engine edits on them.
 * - `isDocumentChanged`: whether a document differs from the file it came from.
 */
import {
  type BlobId,
  closeDocument,
  DEFAULT_HISTORY_TAIL,
  type DocumentId,
  type EngineEdit,
  type History,
  removeSourceIfUnreferenced,
  type SourceId,
  serializeHistoryTail,
  serializeWorkspace,
  type VirtualDocument,
  type Workspace,
} from '@pdf-editor/document-model';

import {
  blobsOfDocument,
  documentSources,
  engineEditBlobIds,
  type SourceFileInfo,
  type StoredBlob,
} from '../state/workspace-store';
import {
  type BlobFacts,
  type DocumentPlace,
  type KeptRecordV1,
  SNAPSHOT_FORMAT,
  type SessionManifestV1,
  type SourceFacts,
} from './format';

/** What the snapshot reads from the stores. */
export interface SnapshotState {
  readonly history: History;
  readonly files: Readonly<Record<SourceId, SourceFileInfo>>;
  readonly blobs: Readonly<Record<BlobId, StoredBlob>>;
  readonly editBlobs: Readonly<Record<string, Blob>>;
}

/** Where each document was shown; supplied by the writer from the UI stores. */
export interface PlaceState {
  readonly destination: 'home' | 'document';
  readonly zoom: number;
  readonly fitMode: 'width' | 'page' | null;
  place(id: DocumentId): Omit<DocumentPlace, 'id' | 'changed'>;
  /** Whether the document has changes, in `ws` (a closing document's last workspace). */
  changed(id: DocumentId, ws?: Workspace): boolean;
}

/** The files a snapshot needs that are not stored yet are written from these. */
export interface SnapshotFiles {
  readonly sources: readonly SourceFacts[];
  readonly blobs: readonly BlobFacts[];
}

function entriesOf(history: History, n: number): Workspace[] {
  const past = n === 0 ? [] : history.past.slice(-n);
  return [...past, history.present, ...history.future.slice(0, n)].map((e) => e.workspace);
}

/** The sources, image blobs and edit blobs a set of workspaces refers to. */
export function filesOf(workspaces: readonly Workspace[], state: SnapshotState): SnapshotFiles {
  const sources = new Map<SourceId, SourceFacts>();
  const blobs = new Map<string, BlobFacts>();
  const seenDocs = new Set<VirtualDocument>();
  const seenEdits = new Set<EngineEdit>();
  for (const ws of workspaces) {
    for (const id of Object.keys(ws.sources) as SourceId[]) {
      if (sources.has(id)) continue;
      const source = ws.sources[id];
      const info = state.files[id];
      sources.set(id, {
        id,
        name: info?.name ?? source?.name ?? 'document.pdf',
        size: info?.size ?? source?.byteLength ?? 0,
        lastModified: info?.lastModified ?? 0,
      });
    }
    for (const doc of Object.values(ws.documents)) {
      if (seenDocs.has(doc)) continue;
      seenDocs.add(doc);
      for (const id of blobsOfDocument(doc)) {
        const blob = state.blobs[id];
        if (blob === undefined || blobs.has(id)) continue;
        blobs.set(id, {
          id,
          kind: 'image',
          type: blob.type,
          width: blob.width,
          height: blob.height,
          name: blob.name,
        });
      }
    }
    for (const edit of ws.engineEdits) {
      if (seenEdits.has(edit)) continue;
      seenEdits.add(edit);
      for (const id of engineEditBlobIds(edit)) {
        const blob = state.editBlobs[id];
        if (blob === undefined || blobs.has(id)) continue;
        blobs.set(id, { id, kind: 'edit', type: blob.type });
      }
    }
  }
  return { sources: [...sources.values()], blobs: [...blobs.values()] };
}

/** A tab's session manifest, or undefined when no document is open (nothing to restore). */
export function buildSessionManifest(
  state: SnapshotState,
  places: PlaceState,
  tabId: string,
  savedAt: number,
  tail: number = DEFAULT_HISTORY_TAIL,
): SessionManifestV1 | undefined {
  const present = state.history.present.workspace;
  if (present.documentOrder.length === 0) return undefined;
  const files = filesOf(entriesOf(state.history, tail), state);
  return {
    format: SNAPSHOT_FORMAT,
    kind: 'session',
    tabId,
    savedAt,
    destination: places.destination,
    zoom: places.zoom,
    fitMode: places.fitMode,
    history: serializeHistoryTail(state.history, tail),
    documents: present.documentOrder.map((id) => ({
      id,
      ...places.place(id),
      changed: places.changed(id),
    })),
    sources: files.sources,
    blobs: files.blobs,
  };
}

/** The workspace with only `id` open: its sources and the engine edits on them. */
export function workspaceOfDocument(ws: Workspace, id: DocumentId): Workspace {
  let next = ws;
  for (const other of ws.documentOrder) if (other !== id) next = closeDocument(next, other);
  for (const source of Object.keys(next.sources) as SourceId[]) {
    next = removeSourceIfUnreferenced(next, source);
  }
  return next;
}

/** A closed document's kept record (Recents, ADR-0032 §2.6), from a workspace that has it. */
export function buildKeptRecord(
  ws: Workspace,
  id: DocumentId,
  state: SnapshotState,
  place: DocumentPlace,
  keptAt: number,
): KeptRecordV1 | undefined {
  const doc = ws.documents[id];
  if (doc === undefined) return undefined;
  const own = workspaceOfDocument(ws, id);
  const files = filesOf([own], state);
  const first = documentSources(doc)[0];
  const firstFacts = files.sources.find((s) => s.id === first);
  return {
    format: SNAPSHOT_FORMAT,
    kind: 'kept',
    id: keptIdOf(id),
    keptAt,
    title: (doc.title === '' ? undefined : doc.title) ?? firstFacts?.name ?? 'document.pdf',
    name: firstFacts?.name ?? (doc.title === '' ? 'document.pdf' : doc.title),
    size: firstFacts?.size ?? 0,
    pages: doc.pages.length,
    workspace: serializeWorkspace(own),
    place: { ...place, id },
    sources: files.sources,
    blobs: files.blobs,
  };
}

/** The kept record id of a document (one record per document: a later close replaces it). */
export function keptIdOf(id: DocumentId): string {
  return `kept-${id}`;
}

/**
 * Whether a document is exactly one source as opened: its pages in order, unrotated, with
 * no crop, resize, overlay, furniture or created field, and no engine edit on the source.
 */
export function isPristineDocument(ws: Workspace, doc: VirtualDocument): boolean {
  const first = doc.pages[0]?.ref;
  if (first?.kind !== 'source') return false;
  const source = ws.sources[first.source];
  if (source?.pageCount !== doc.pages.length) return false;
  if ((doc.furniture?.length ?? 0) > 0 || (doc.fields?.length ?? 0) > 0) return false;
  if (doc.security !== undefined || doc.passwordRemoved === true) return false;
  const pagesAsOpened = doc.pages.every(
    (page, index) =>
      page.ref.kind === 'source' &&
      page.ref.source === first.source &&
      page.ref.index === index &&
      page.rotation === 0 &&
      page.cropBox === undefined &&
      page.resize === undefined &&
      page.overlays.length === 0,
  );
  return pagesAsOpened && !ws.engineEdits.some((edit) => edit.source === first.source);
}

/**
 * Tracks which documents have changes (ADR-0032 §2.7's `beforeunload` rule; Recents'
 * "Edited, changes kept"). A document that appears as a pristine copy of its file keeps
 * that object as its baseline; it is changed once its object or its source's edits differ.
 * One that appears changed (a combine, a split part, images, a restored edited document)
 * is changed from the start.
 */
export class ChangeTracker {
  private readonly baseline = new Map<DocumentId, VirtualDocument>();
  private readonly changedFromStart = new Set<DocumentId>();

  /** Notes the documents of `ws` seen for the first time. */
  observe(ws: Workspace): void {
    for (const id of ws.documentOrder) {
      if (this.baseline.has(id) || this.changedFromStart.has(id)) continue;
      const doc = ws.documents[id];
      if (doc === undefined) continue;
      if (isPristineDocument(ws, doc)) this.baseline.set(id, doc);
      else this.changedFromStart.add(id);
    }
  }

  /** A restored or reopened document: changed as its snapshot said. */
  adopt(ws: Workspace, id: DocumentId, changed: boolean): void {
    this.baseline.delete(id);
    this.changedFromStart.delete(id);
    const doc = ws.documents[id];
    if (changed || doc === undefined) this.changedFromStart.add(id);
    else this.baseline.set(id, doc);
  }

  changed(ws: Workspace, id: DocumentId): boolean {
    if (this.changedFromStart.has(id)) return true;
    const doc = ws.documents[id];
    const base = this.baseline.get(id);
    if (doc === undefined || base === undefined) return false;
    if (doc !== base) return true;
    const sources = new Set<string>(documentSources(doc));
    return ws.engineEdits.some((edit) => sources.has(edit.source));
  }

  anyChanged(ws: Workspace): boolean {
    return ws.documentOrder.some((id) => this.changed(ws, id));
  }

  clear(): void {
    this.baseline.clear();
    this.changedFromStart.clear();
  }
}
