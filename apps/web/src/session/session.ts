/**
 * The session module's entry (ADR-0032 §2.4–§2.7, spec redesign X18: D0-7 owns `session/`;
 * the frame and the Library consume this API). `startSession` runs once per launch in either
 * edition:
 *
 * 1. Holds this tab's Web Lock and probes OPFS. Where storage is refused (a private window)
 *    it says "Changes are not kept in this window" and the app behaves as before: nothing is
 *    kept, nothing restored, and `beforeunload` asks while any document has changes.
 * 2. Restores the newest session no open tab holds ("Restored 3 documents · Start fresh");
 *    the compact edition (ADR-0033 §2.3) restores the active document only, the others go
 *    to Recents, and a restored document with changes offers Download a copy. Other orphaned
 *    sessions become kept records.
 * 3. Starts the writer: every history change, page, zoom, view or lock change is kept within
 *    2 s, and at once when the page is hidden or left; documents that close become kept
 *    records for Recents.
 * 4. Installs the `beforeunload` rule: ask only while a change is not in the snapshot yet or
 *    storage is not persistent, and only when some document has changes.
 *
 * Tests read `data-session` on `<html>` (`restoring`, `ready`, `off` with `data-session-reason`
 * `unsupported`, `refused` or `timeout`), `data-session-saved` (the time of the last snapshot)
 * and `data-session-state` (`saved` once nothing waits to be written, `pending`, or `failed`
 * after a write failed) rather than any hook in the production build.
 */
import {
  closeDocument,
  type DocumentId,
  documentTitleFromName,
  removeSourceIfUnreferenced,
  type SourceId,
  type Workspace,
} from '@pdf-editor/document-model';

import { getEngineService } from '../engine/engine-service';
import { forgetKept, keepRecent, onKeptRemoved, useRecentsStore } from '../files/recents';
import { m } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { readJson, writeJson } from '../state/safe-storage';
import { useWorkspaceStore } from '../state/workspace-store';
import type { DocumentPlace, KeptRecordV1 } from './format';
import {
  holdTabLock,
  keptRecordsOf,
  liveTabIds,
  planLaunch,
  type ReopenKeptResult,
  reopenKept,
  restoreSession,
  setAside,
} from './restore';
import { type SessionNotice, setSessionNotice, useSessionStore } from './session-store';
import { ChangeTracker, type PlaceState, type SnapshotState } from './snapshot';
import { openSnapshotStorage, type SnapshotStorage } from './storage';
import { SnapshotWriter } from './writer';

export type Edition = 'full' | 'compact';

/** The private-window notice was dismissed on this device (FB9: "✕, per device"). */
const NOT_KEPT_DISMISSED_KEY = 'pdf-editor:session:not-kept-dismissed:v1';

interface Controller {
  readonly storage: SnapshotStorage;
  readonly writer: SnapshotWriter;
  readonly tracker: ChangeTracker;
  /** Documents the last launch restored (Start fresh closes those still open). */
  restored: readonly DocumentId[];
  /** The history position Start fresh made, so its Undo undoes exactly that step. */
  freshAt: number | null;
}

let controller: Controller | undefined;
/**
 * Off in the component tests (test/setup.ts): they share one origin, so one test's session
 * would restore into the next. The session's own tests turn it on.
 */
let enabled = true;

export function setSessionEnabled(value: boolean): void {
  enabled = value;
}
/** Without storage, changes still matter for the `beforeunload` rule. */
const offlineTracker = new ChangeTracker();

function setDataset(
  name: 'session' | 'sessionSaved' | 'sessionChanged' | 'sessionState' | 'sessionReason',
  value: string,
): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset[name] = value;
}

function snapshotState(): SnapshotState {
  const { history, files, blobs, editBlobs } = useWorkspaceStore.getState();
  return { history, files, blobs, editBlobs };
}

/** The page shown last in each document (the view store knows only the active one's). */
const pages = new Map<DocumentId, number>();

function placeState(tracker: ChangeTracker): PlaceState {
  const ui = useUiStore.getState();
  const ws = useWorkspaceStore.getState().workspace;
  return {
    destination: ui.destination,
    zoom: ui.zoom,
    fitMode: ui.fitMode,
    place: (id) => {
      const view =
        id === ws.activeDocument && ui.destination === 'document' ? ui.viewMode : ui.lastView[id];
      return {
        page: pages.get(id) ?? 0,
        view: view === 'arrange' ? 'arrange' : 'read',
        mode: ui.documentMode[id] === 'edit' ? 'edit' : 'read',
      };
    },
    changed: (id, in_ = ws) => tracker.changed(in_, id),
  };
}

async function sourceBytes(id: SourceId): Promise<Blob | undefined> {
  const result = await getEngineService().sourceBytes(id);
  return result.ok ? new Blob([result.value], { type: 'application/pdf' }) : undefined;
}

function persist(): Promise<boolean> {
  const storage = globalThis.navigator?.storage;
  if (typeof storage?.persist !== 'function') return Promise.resolve(false);
  return (async () => {
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
    return storage.persist();
  })();
}

/**
 * The Recents row a kept document goes to (ADR-0032 §2.6): its file's row when it is that
 * file's document, else (a combine, a split part, an extract, a renamed document) a row named
 * after the document and sized by its sources, so it reads as itself and never takes over
 * the row of the file it came from.
 */
export function recentRowOf(record: KeptRecordV1): { name: string; size: number } {
  if (record.title === record.name || record.title === documentTitleFromName(record.name)) {
    return { name: record.name, size: record.size };
  }
  return {
    name: `${record.title}.pdf`,
    size: record.sources.reduce((sum, source) => sum + source.size, 0),
  };
}

function attachKept(record: KeptRecordV1, bytes = 0): void {
  void keepRecent({
    ...recentRowOf(record),
    pages: record.pages,
    kept: { snapshotId: record.id, keptAt: record.keptAt, bytes, changed: record.place.changed },
  });
}

/** Whether leaving now could lose a change (ADR-0032 §2.7). */
export function shouldWarnBeforeUnload(): boolean {
  const ws = useWorkspaceStore.getState().workspace;
  if (!controller) return offlineTracker.anyChanged(ws);
  if (!controller.tracker.anyChanged(ws)) return false;
  const { persisted } = useSessionStore.getState();
  return controller.writer.pending || persisted !== true;
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (!shouldWarnBeforeUnload()) return;
  event.preventDefault();
  // Older engines (Safari before 17) show the prompt only when returnValue is set.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  event.returnValue = '';
}

/** Keeps the writer told about every change worth keeping. */
function watch(ctl: Controller): () => void {
  const { writer, tracker } = ctl;
  tracker.observe(useWorkspaceStore.getState().workspace);
  const offWorkspace = useWorkspaceStore.subscribe((state, previous) => {
    if (state.history === previous.history) return;
    const ws = state.workspace;
    const before = previous.workspace;
    tracker.observe(ws);
    const now = new Set(ws.documentOrder);
    const was = new Set(before.documentOrder);
    const closed = before.documentOrder.filter((id) => !now.has(id));
    const added = ws.documentOrder.filter((id) => !was.has(id));
    if (closed.length > 0) writer.noteClosed(before, closed);
    if (added.length > 0) writer.noteReopened(added);
    const content =
      ws.documents !== before.documents ||
      ws.engineEdits !== before.engineEdits ||
      ws.documentOrder !== before.documentOrder ||
      state.history.past.length !== previous.history.past.length ||
      state.history.future.length !== previous.history.future.length;
    writer.noteChange(content ? 'content' : 'view');
  });
  const offUi = useUiStore.subscribe((state, previous) => {
    if (
      state.zoom !== previous.zoom ||
      state.fitMode !== previous.fitMode ||
      state.destination !== previous.destination ||
      state.viewMode !== previous.viewMode ||
      state.documentMode !== previous.documentMode ||
      state.lastView !== previous.lastView
    ) {
      writer.noteChange('view');
    }
  });
  const offView = useViewStore.subscribe((state, previous) => {
    if (state.currentPage === previous.currentPage) return;
    const id = useWorkspaceStore.getState().workspace.activeDocument;
    if (id === undefined) return;
    pages.set(id, state.currentPage);
    writer.noteChange('view');
  });
  const flushNow = () => void writer.flush();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushNow();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flushNow);
  return () => {
    offWorkspace();
    offUi();
    offView();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', flushNow);
  };
}

export interface StartOptions {
  readonly edition: Edition;
  /** Called after a launch restore with what came back (the compact edition shows it). */
  readonly onRestored?: (restored: readonly DocumentId[], places: readonly DocumentPlace[]) => void;
  /** Tests pass a store; the app probes OPFS. */
  readonly storage?: SnapshotStorage;
  readonly tabId?: string;
}

/** Starts keeping and restoring for this tab (once per launch). Returns a stop function. */
export function startSession(options: StartOptions): () => void {
  if (!enabled) return () => undefined;
  let stopped = false;
  let unwatch: (() => void) | undefined;
  setDataset('session', 'restoring');
  window.addEventListener('beforeunload', onBeforeUnload);
  const offlineUnsub = useWorkspaceStore.subscribe((state) =>
    offlineTracker.observe(state.workspace),
  );
  void (async () => {
    const tabId = options.tabId ?? globalThis.crypto.randomUUID();
    holdTabLock(tabId);
    const available = options.storage
      ? ({ ok: true, storage: options.storage } as const)
      : await openSnapshotStorage();
    if (stopped) return;
    if (!available.ok) {
      useSessionStore.setState({ keeping: 'unavailable' });
      if (readJson(NOT_KEPT_DISMISSED_KEY) !== true) setSessionNotice({ kind: 'not-kept' });
      setDataset('sessionReason', available.reason);
      setDataset('session', 'off');
      return;
    }
    offlineUnsub();
    const { storage } = available;
    const tracker = new ChangeTracker();
    const writer = new SnapshotWriter({
      storage,
      tabId,
      state: snapshotState,
      places: () => placeState(tracker),
      sourceBytes,
      persist,
      onKept: (record) => attachKept(record),
      onForgotten: (ids) => void forgetKept(ids),
      onStatus: (status) => {
        useSessionStore.setState({
          unsaved: status.unsaved,
          savedAt: status.savedAt,
          writeFailed: status.writeFailed,
          persisted: status.persisted,
          items: status.items,
          totalBytes: status.totalBytes,
        });
        if (status.savedAt !== null) setDataset('sessionSaved', String(status.savedAt));
        if (status.changedAt !== null) setDataset('sessionChanged', String(status.changedAt));
        setDataset(
          'sessionState',
          status.writeFailed ? 'failed' : status.idle ? 'saved' : 'pending',
        );
      },
    });
    const ctl: Controller = { storage, writer, tracker, restored: [], freshAt: null };
    controller = ctl;
    useSessionStore.setState({ keeping: 'available', restoring: true });
    onKeptRemoved((snapshotIds) => void writer.forget(snapshotIds));

    try {
      await launch(ctl, tabId, options);
    } catch (error) {
      console.warn('Restoring the last session failed', error);
    }
    if (stopped) return;
    useSessionStore.setState({ restoring: false });
    unwatch = watch(ctl);
    setDataset('session', 'ready');
    // Retention and the popover's list; queued behind the writes, never holding the launch.
    void writer.refresh();
  })();
  return () => {
    stopped = true;
    unwatch?.();
    offlineUnsub();
    window.removeEventListener('beforeunload', onBeforeUnload);
    controller?.writer.stop();
    controller = undefined;
    onKeptRemoved(undefined);
  };
}

async function launch(ctl: Controller, tabId: string, options: StartOptions): Promise<void> {
  const { storage, writer, tracker } = ctl;
  const plan = await planLaunch(storage, await liveTabIds());
  for (const name of plan.damaged) await setAside(storage, name).catch(() => undefined);
  const now = Date.now();
  // Other closed tabs' documents go to Recents; their manifests go once the records exist.
  for (const orphan of plan.orphans) {
    let records: KeptRecordV1[];
    try {
      records = keptRecordsOf(orphan, 'all', now);
    } catch (error) {
      console.warn('An orphaned session could not be read', error);
      await setAside(storage, `${orphan.tabId}.json`).catch(() => undefined);
      continue;
    }
    void writer.keep(records, () => storage.remove('sessions', `${orphan.tabId}.json`));
  }
  const manifest = plan.restore;
  // Restore only into an empty tab: a file opened during launch (a share target) wins.
  if (manifest === undefined || useWorkspaceStore.getState().workspace.documentOrder.length > 0) {
    if (manifest !== undefined) {
      void writer.keep(keptRecordsOf(manifest, 'all', now), () =>
        storage.remove('sessions', `${manifest.tabId}.json`),
      );
    }
    return;
  }
  const compact = options.edition === 'compact';
  const active = manifest.history.entries[manifest.history.present]?.activeDocument;
  const only = compact ? (active ?? manifest.documents[0]?.id) : undefined;
  const outcome = await restoreSession(storage, manifest, only === undefined ? {} : { only });
  // Documents that did not load (a skipped password prompt, an engine failure) go to Recents
  // before the old manifest goes, with their changes, for another try (ADR-0032 §2.6).
  let failedKept = false;
  if (outcome.failedIds.length > 0) {
    try {
      void writer.keep(keptRecordsOf(manifest, outcome.failedIds, now));
      failedKept = true;
    } catch (error) {
      console.warn('The documents that did not restore could not be kept', error);
    }
  }
  const ws = useWorkspaceStore.getState().workspace;
  for (const place of manifest.documents) {
    if (ws.documents[place.id] !== undefined) {
      tracker.adopt(ws, place.id, place.changed);
      pages.set(place.id, place.page);
    }
  }
  writer.markStored(manifest.sources, manifest.blobs);
  ctl.restored = outcome.restored;
  if (compact && only !== undefined) {
    const others = manifest.documents.filter((d) => d.id !== only).map((d) => d.id);
    if (others.length > 0) void writer.keep(keptRecordsOf(manifest, others, now));
  }
  // This tab's manifest first; the old one goes only once it is written. Queued, not awaited:
  // the launch never waits on a storage write.
  // A manifest whose history cannot be read is set aside, never deleted (ADR-0032 §3); one
  // whose failed documents could not be kept stays for the next launch.
  writer.noteChange('content');
  void writer.flush().then(async () => {
    if (manifest.tabId === tabId) return;
    const name = `${manifest.tabId}.json`;
    if (outcome.damaged) await setAside(storage, name).catch(() => undefined);
    else if (outcome.failedIds.length === 0 || failedKept) {
      await storage.remove('sessions', name).catch(() => undefined);
    }
  });
  if (outcome.restored.length > 0) {
    const first = ws.documents[outcome.restored[0] as DocumentId];
    const changed = outcome.restored.some((id) => tracker.changed(ws, id));
    setSessionNotice({
      kind: 'restored',
      documents: outcome.restored,
      ...(outcome.restored.length === 1 && first ? { title: first.title } : {}),
      ...(compact && changed ? { offerCopy: true } : {}),
    });
    options.onRestored?.(outcome.restored, manifest.documents);
  }
  if (outcome.failed.length > 0) {
    // The failure stays until dismissed; it replaces the success line when nothing came back.
    const failed: SessionNotice = {
      kind: 'failed',
      names: outcome.failed,
      ...(failedKept ? { kept: true } : {}),
    };
    if (outcome.restored.length === 0) setSessionNotice(failed);
    else failedAfterRestore = failed;
  }
}

/** The failure of a partial restore, shown after the success notice is dismissed. */
let failedAfterRestore: SessionNotice | null = null;

/** Dismisses the notice; a partial restore's failure line follows it. */
export function dismissSessionNotice(): void {
  const notice = useSessionStore.getState().notice;
  if (notice?.kind === 'not-kept') writeJson(NOT_KEPT_DISMISSED_KEY, true);
  if (notice?.kind === 'restored' && failedAfterRestore !== null) {
    setSessionNotice(failedAfterRestore);
    failedAfterRestore = null;
    return;
  }
  setSessionNotice(null);
}

/**
 * Start fresh (L8): every restored document still open closes as one step; their snapshots
 * stay in Recents. "Started fresh · 3 documents kept in Recent · Undo".
 */
export function startFresh(): void {
  const ctl = controller;
  if (!ctl) return;
  const store = useWorkspaceStore.getState();
  const ids = ctl.restored.filter((id) => store.workspace.documents[id] !== undefined);
  if (ids.length === 0) {
    dismissSessionNotice();
    return;
  }
  const closed = store.applyOperation((ws: Workspace) => {
    let next = ws;
    const sources = new Set<SourceId>();
    for (const id of ids) {
      for (const page of next.documents[id]?.pages ?? []) {
        if (page.ref.kind === 'source') sources.add(page.ref.source);
      }
      next = closeDocument(next, id);
    }
    for (const source of sources) next = removeSourceIfUnreferenced(next, source);
    return next;
  }, m.session_history_start_fresh());
  if (!closed) return;
  ctl.freshAt = useWorkspaceStore.getState().history.present.at;
  ctl.restored = [];
  failedAfterRestore = null;
  setSessionNotice({ kind: 'started-fresh', count: ids.length });
}

/** The Undo of "Started fresh": undoes that step if it is still the last one. */
export function undoStartFresh(): void {
  const ctl = controller;
  const { history, undo } = useWorkspaceStore.getState();
  if (ctl?.freshAt != null && history.present.at === ctl.freshAt) undo();
  if (ctl) ctl.freshAt = null;
  setSessionNotice(null);
}

/** Reopens a closed document from its kept snapshot (Recents). Undefined when not kept here. */
export async function reopenFromSnapshot(
  snapshotId: string,
): Promise<ReopenKeptResult | undefined> {
  const ctl = controller;
  if (!ctl) return undefined;
  useSessionStore.setState({ restoring: true });
  try {
    const result = await reopenKept(ctl.storage, snapshotId);
    if (result.ok) {
      const ws = useWorkspaceStore.getState().workspace;
      ctl.tracker.adopt(ws, result.documentId, result.record.place.changed);
      pages.set(result.documentId, result.record.place.page);
    } else if (result.reason !== 'failed') {
      // Gone or unreadable: the row reopens like a plain recent from now on.
      void forgetKept([snapshotId]);
    }
    return result;
  } finally {
    useSessionStore.setState({ restoring: false });
  }
}

/**
 * Clear (the privacy popover): deletes every snapshot on this device, open and closed, and
 * every Recents row's "changes kept". Final. Resolves false when storage could not be cleared.
 */
export async function clearKeptChanges(): Promise<boolean> {
  const ctl = controller;
  if (!ctl) return true;
  const ok = await ctl.writer.clearAll();
  // Every row's snapshot is gone, also those the list did not know of (another tab's).
  const kept = useRecentsStore
    .getState()
    .entries.flatMap((entry) => (entry.kept === undefined ? [] : [entry.kept.snapshotId]));
  if (ok) await forgetKept(kept);
  return ok;
}

/** Writes the snapshot now (tests; the writer also does on hide). */
export function flushSession(): Promise<void> {
  return controller?.writer.flush() ?? Promise.resolve();
}

/** Whether `id`'s document differs from the file it came from. */
export function isDocumentChanged(id: DocumentId): boolean {
  const ws = useWorkspaceStore.getState().workspace;
  return (controller?.tracker ?? offlineTracker).changed(ws, id);
}
