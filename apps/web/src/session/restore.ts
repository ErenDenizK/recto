/**
 * Restoring snapshots (ADR-0032 §2.5, §2.6; `02-library` L7, L8):
 *
 * - **Launch.** `planLaunch` finds the session manifests no open tab holds (a tab holds a
 *   Web Lock named after its id while it lives), takes the newest to restore and turns the
 *   others into kept records, so two tabs closed together lose nothing. `restoreSession`
 *   reopens the kept source bytes in the engine under the ids the snapshot refers to, puts
 *   back the image and edit blobs (before any replay, so the edit runner can inline them),
 *   replaces the history with the restored 20-step tail and returns each document to its
 *   place: page, zoom, view and lock (never Markup). The edit runner then replays the engine
 *   edits on the restored bytes (reopen-and-replay, ADR-0011).
 * - **Recents.** `reopenKept` reopens a closed document from its kept record with no prompt
 *   or picker, on every browser, as one "Open" step.
 *
 * A source whose bytes are missing or no longer open fails only the documents that show it:
 * the rest restore without the history tail (an undo step could otherwise bring back a page
 * that cannot render), and the failure is reported with the document's name.
 */
import {
  assertWorkspaceInvariants,
  type BlobId,
  closeDocument,
  createHistory,
  type DocumentId,
  deserializeHistoryTail,
  deserializeWorkspace,
  type History,
  removeSourceIfUnreferenced,
  type SourceId,
  type Workspace,
} from '@pdf-editor/document-model';

import { m } from '../i18n';
import { useUiStore, withDocumentUi } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import {
  documentSources,
  type ProtectionLease,
  type StoredBlob,
  useWorkspaceStore,
} from '../state/workspace-store';
import { documentFingerprint, rememberPosition } from '../viewer/navigation';
import {
  type BlobFacts,
  type DocumentPlace,
  type KeptRecordV1,
  parseKeptRecord,
  parseSessionManifest,
  recordFile,
  type SessionManifestV1,
  type SourceFacts,
  SnapshotFormatError,
  sourceFile,
} from './format';
import { buildKeptRecord, type SnapshotState, workspaceOfDocument } from './snapshot';
import type { SnapshotStorage } from './storage';

/** The Web Lock a tab holds while it lives, so others never restore its session. */
export const TAB_LOCK_PREFIX = 'pdf-editor-session:';

interface LocksLike {
  request(name: string, callback: () => Promise<void>): Promise<void>;
  query(): Promise<{ held?: readonly { name?: string }[] }>;
}

function locks(): LocksLike | undefined {
  const candidate = (globalThis.navigator as { locks?: LocksLike } | undefined)?.locks;
  return typeof candidate?.request === 'function' ? candidate : undefined;
}

/** Holds this tab's lock until the page goes away. */
export function holdTabLock(tabId: string): void {
  void locks()
    ?.request(`${TAB_LOCK_PREFIX}${tabId}`, () => new Promise<void>(() => undefined))
    .catch(() => undefined);
}

/**
 * Ids of the tabs alive now. Without Web Locks (old browsers) none count as alive: two
 * tabs may then restore the same session, which duplicates documents but loses nothing.
 */
export async function liveTabIds(): Promise<Set<string>> {
  const api = locks();
  if (!api) return new Set();
  try {
    const { held = [] } = await api.query();
    return new Set(
      held
        .map((lock) => lock.name ?? '')
        .filter((name) => name.startsWith(TAB_LOCK_PREFIX))
        .map((name) => name.slice(TAB_LOCK_PREFIX.length)),
    );
  } catch {
    return new Set();
  }
}

export interface LaunchPlan {
  /** The newest session no live tab holds. */
  readonly restore?: SessionManifestV1;
  /** Other orphaned sessions: their documents become kept records. */
  readonly orphans: readonly SessionManifestV1[];
  /** Manifests that could not be read (set aside as `<name>.damaged`). */
  readonly damaged: readonly string[];
}

export async function planLaunch(
  storage: SnapshotStorage,
  live: ReadonlySet<string>,
): Promise<LaunchPlan> {
  const manifests: SessionManifestV1[] = [];
  const damaged: string[] = [];
  for (const info of await storage.list('sessions')) {
    if (!info.name.endsWith('.json')) continue;
    const tabId = info.name.slice(0, -'.json'.length);
    if (live.has(tabId)) continue;
    try {
      const file = await storage.read('sessions', info.name);
      if (file) manifests.push(parseSessionManifest(await file.text()));
    } catch {
      damaged.push(info.name);
    }
  }
  manifests.sort((a, b) => b.savedAt - a.savedAt);
  const [restore, ...orphans] = manifests;
  return { ...(restore === undefined ? {} : { restore }), orphans, damaged };
}

/** Keeps an unreadable manifest under another name, so it is never silently dropped. */
export async function setAside(storage: SnapshotStorage, name: string): Promise<void> {
  const file = await storage.read('sessions', name);
  if (file) await storage.write('sessions', `${name.replace(/\.json$/, '')}.damaged`, file);
  await storage.remove('sessions', name);
}

/** A stand-in for the stores' state, from a snapshot's file facts (no bytes needed). */
function stateFromFacts(
  history: History,
  sources: readonly SourceFacts[],
  blobs: readonly BlobFacts[],
): SnapshotState {
  const empty = new ArrayBuffer(0);
  return {
    history,
    files: Object.fromEntries(
      sources.map((s) => [
        s.id,
        { name: s.name, size: s.size, lastModified: s.lastModified, colorIndex: 0 },
      ]),
    ),
    blobs: Object.fromEntries(
      blobs.flatMap((b) =>
        b.kind === 'image'
          ? [[b.id, { bytes: empty, type: b.type, width: b.width, height: b.height, name: b.name }]]
          : [],
      ),
    ),
    editBlobs: Object.fromEntries(
      blobs.flatMap((b) => (b.kind === 'edit' ? [[b.id, new Blob([], { type: b.type })]] : [])),
    ),
  };
}

/**
 * Kept records for documents of a manifest that will not be restored here (an orphaned tab;
 * in the compact edition, every document but the active one). Their files are stored
 * already, so nothing but the records is written.
 */
export function keptRecordsOf(
  manifest: SessionManifestV1,
  ids: readonly DocumentId[] | 'all',
  keptAt: number,
): KeptRecordV1[] {
  const history = deserializeHistoryTail(manifest.history);
  const ws = history.present.workspace;
  const state = stateFromFacts(history, manifest.sources, manifest.blobs);
  return manifest.documents.flatMap((place) => {
    if (ids !== 'all' && !ids.includes(place.id)) return [];
    const record = buildKeptRecord(ws, place.id, state, place, keptAt);
    return record === undefined ? [] : [record];
  });
}

// ---------------------------------------------------------------------------
// Loading files back
// ---------------------------------------------------------------------------

interface Loaded {
  /** Sources that could not be read or opened. */
  readonly failed: ReadonlySet<SourceId>;
}

/** Reads a snapshot's sources and blobs and loads them into the engine and the store. */
async function loadFiles(
  storage: SnapshotStorage,
  sources: readonly SourceFacts[],
  blobs: readonly BlobFacts[],
  lease: ProtectionLease,
): Promise<Loaded> {
  const store = useWorkspaceStore.getState();
  const failed = new Set<SourceId>();
  const files: File[] = [];
  const ids: SourceId[] = [];
  for (const facts of sources) {
    // Already open in this tab (a document sharing it is open): the engine has it.
    if (store.files[facts.id] !== undefined) continue;
    const stored = await storage.read('sources', sourceFile(facts.id)).catch(() => undefined);
    if (!stored) {
      failed.add(facts.id);
      continue;
    }
    files.push(
      new File([stored], facts.name, { type: 'application/pdf', lastModified: facts.lastModified }),
    );
    ids.push(facts.id);
  }
  // Blobs first: the edit runner inlines edit blobs as soon as the history arrives.
  for (const facts of blobs) {
    const stored = await storage.read('blobs', facts.id).catch(() => undefined);
    if (!stored) continue;
    if (facts.kind === 'edit') {
      store.putEditBlob(facts.id, new Blob([stored], { type: facts.type }));
    } else {
      const blob: StoredBlob = {
        bytes: await stored.arrayBuffer(),
        type: facts.type,
        width: facts.width,
        height: facts.height,
        name: facts.name,
      };
      store.restoreBlob(facts.id as BlobId, blob, lease);
    }
  }
  if (files.length > 0) {
    const { loaded } = await store.loadSources(files, lease, { sourceIds: ids });
    const opened = new Set(loaded.map((l) => l.source.id));
    for (const id of ids) if (!opened.has(id)) failed.add(id);
  }
  return { failed };
}

/** The workspace without the documents that show a failed source. */
function withoutFailed(
  ws: Workspace,
  failed: ReadonlySet<SourceId>,
): { workspace: Workspace; dropped: string[] } {
  let next = ws;
  const dropped: string[] = [];
  for (const id of ws.documentOrder) {
    const doc = ws.documents[id];
    if (doc === undefined || !documentSources(doc).some((s) => failed.has(s))) continue;
    dropped.push(doc.title);
    next = closeDocument(next, id);
  }
  for (const source of failed) {
    if (next.sources[source] !== undefined) next = removeSourceIfUnreferenced(next, source);
  }
  return { workspace: next, dropped };
}

/** Brings the engine to the restored edits (the runner also reacts to the history change). */
async function replayEdits(): Promise<void> {
  const { scheduleReconcile } = await import('../annotations/edit-runner');
  await scheduleReconcile();
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

/** Puts documents back where they were: lock, view, page; zoom and destination for all. */
export function applyPlaces(
  ws: Workspace,
  places: readonly DocumentPlace[],
  view?: Pick<SessionManifestV1, 'destination' | 'zoom' | 'fitMode'>,
): void {
  const ui = useUiStore.getState();
  let docUi = ui.docUi;
  for (const place of places) {
    const doc = ws.documents[place.id];
    if (doc === undefined) continue;
    // M8's names in the format: 'arrange' is the grid; 'edit' opens Markup, which carries
    // M8's Edit until the lock replaces it (D1-2).
    docUi = withDocumentUi(docUi, place.id, {
      surface: place.view === 'arrange' ? 'grid' : 'page',
      ...(place.mode === 'edit' ? { markup: true } : {}),
    });
    // The page view returns to the remembered page on mount (ReadView, CompactReader).
    const fingerprint = documentFingerprint(ws, doc);
    if (fingerprint !== undefined) rememberPosition(fingerprint, place.page);
  }
  const active = places.find((p) => p.id === ws.activeDocument);
  useUiStore.setState({
    docUi,
    ...(view === undefined
      ? {}
      : {
          destination: view.destination,
          ...(view.fitMode === null
            ? { zoom: view.zoom, fitMode: null }
            : { fitMode: view.fitMode }),
        }),
  });
  if (active !== undefined) {
    useViewStore.setState({ currentPage: active.page, navTarget: null });
  }
}

// ---------------------------------------------------------------------------
// Launch restore
// ---------------------------------------------------------------------------

export interface RestoreOutcome {
  /** Restored documents, in tab order. */
  readonly restored: readonly DocumentId[];
  /** Names of documents that could not be restored. */
  readonly failed: readonly string[];
  /** Whether the undo steps came back (false when a document failed, or none were kept). */
  readonly withHistory: boolean;
}

/**
 * Restores a session manifest into an empty workspace. `only` restores one document (the
 * compact edition, one document at a time). Never throws: a damaged snapshot is a failure.
 */
export async function restoreSession(
  storage: SnapshotStorage,
  manifest: SessionManifestV1,
  options: { readonly only?: DocumentId } = {},
): Promise<RestoreOutcome> {
  let history: History;
  try {
    history = deserializeHistoryTail(manifest.history);
  } catch (error) {
    console.warn('The kept session could not be read', error);
    return { restored: [], failed: manifest.sources.map((s) => s.name), withHistory: false };
  }
  const only = options.only;
  if (only !== undefined) {
    const present = history.present.workspace;
    if (present.documents[only] === undefined) {
      return { restored: [], failed: [], withHistory: false };
    }
    history = createHistory(workspaceOfDocument(present, only), history.present.label, Date.now());
  }
  const needed = new Set<string>();
  for (const entry of [...history.past, history.present, ...history.future]) {
    for (const id of Object.keys(entry.workspace.sources)) needed.add(id);
  }
  const store = useWorkspaceStore.getState();
  return store.withLease(async (lease) => {
    const { failed } = await loadFiles(
      storage,
      manifest.sources.filter((s) => needed.has(s.id)),
      manifest.blobs,
      lease,
    );
    let restoredHistory = history;
    let dropped: string[] = [];
    if (failed.size > 0) {
      const result = withoutFailed(history.present.workspace, failed);
      dropped = result.dropped;
      restoredHistory = createHistory(result.workspace, history.present.label, Date.now());
    }
    const ws = restoredHistory.present.workspace;
    if (ws.documentOrder.length === 0) {
      return { restored: [], failed: dropped, withHistory: false };
    }
    useWorkspaceStore.getState().replaceHistory(restoredHistory);
    applyPlaces(ws, manifest.documents, manifest);
    void replayEdits();
    return {
      restored: ws.documentOrder,
      failed: dropped,
      withHistory: failed.size === 0 && restoredHistory.past.length > 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Recents
// ---------------------------------------------------------------------------

/** Adds a kept document's workspace to `ws` (sources it lacks, its edits), as the active tab. */
export function mergeKeptWorkspace(ws: Workspace, kept: Workspace): Workspace {
  const id = kept.documentOrder[0];
  const doc = id === undefined ? undefined : kept.documents[id];
  if (id === undefined || doc === undefined || ws.documents[id] !== undefined) return ws;
  const sources = { ...ws.sources };
  for (const [sourceId, source] of Object.entries(kept.sources)) {
    sources[sourceId as SourceId] ??= source;
  }
  const known = new Set(ws.engineEdits.map((edit) => edit.id));
  const merged: Workspace = {
    ...ws,
    sources,
    documents: { ...ws.documents, [id]: doc },
    documentOrder: [...ws.documentOrder, id],
    activeDocument: id,
    engineEdits: [...ws.engineEdits, ...kept.engineEdits.filter((edit) => !known.has(edit.id))],
  };
  assertWorkspaceInvariants(merged);
  return merged;
}

export type ReopenKeptResult =
  | { readonly ok: true; readonly documentId: DocumentId; readonly record: KeptRecordV1 }
  | { readonly ok: false; readonly reason: 'missing' | 'damaged' | 'failed' };

/** Reopens a closed document from its kept record (no prompt, no picker; §2.6). */
export async function reopenKept(
  storage: SnapshotStorage,
  snapshotId: string,
): Promise<ReopenKeptResult> {
  let record: KeptRecordV1;
  let kept: Workspace;
  try {
    const file = await storage.read('kept', recordFile(snapshotId));
    if (!file) return { ok: false, reason: 'missing' };
    record = parseKeptRecord(await file.text());
    kept = deserializeWorkspace(record.workspace);
  } catch (error) {
    if (!(error instanceof SnapshotFormatError)) console.warn('Kept record unreadable', error);
    return { ok: false, reason: 'damaged' };
  }
  const documentId = kept.documentOrder[0];
  if (documentId === undefined) return { ok: false, reason: 'damaged' };
  const store = useWorkspaceStore.getState();
  if (store.workspace.documents[documentId] !== undefined) {
    store.setActive(documentId);
    return { ok: true, documentId, record };
  }
  let failedSources = false;
  const committed = await store.applyComposed(
    async (lease) => {
      const { failed } = await loadFiles(storage, record.sources, record.blobs, lease);
      if (failed.size > 0) {
        failedSources = true;
        return undefined;
      }
      return kept;
    },
    (ws, _ids, value) => mergeKeptWorkspace(ws, value),
    m.history_open({ name: record.title }),
  );
  if (!committed) return { ok: false, reason: failedSources ? 'missing' : 'failed' };
  const ws = useWorkspaceStore.getState().workspace;
  applyPlaces(ws, [record.place]);
  void replayEdits();
  return { ok: true, documentId, record };
}
