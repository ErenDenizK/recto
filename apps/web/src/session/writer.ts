/**
 * The snapshot writer (ADR-0032 §2.4, §2.7; flows §5.2): keeps every open document on this
 * device, so a reload, a crash or a killed tab loses nothing.
 *
 * - **When.** Within 2 s of a change: a change starts a short debounce (`debounceMs`) that
 *   never pushes the write past `maxWaitMs` after the first unsaved change. Also at once when
 *   the page is hidden (`visibilitychange`) or left (`pagehide`), where a phone may kill it.
 * - **What.** The tab's session manifest (`buildSessionManifest`: the 20-step history tail and
 *   each document's place) plus the files it names that are not stored yet: each source's
 *   bytes once (sources are immutable, ADR-0005) and each blob once.
 * - **Closed documents** become kept records for Recents (`buildKeptRecord`), written from the
 *   workspace they were last open in; a document that comes back (undo of the close, a reopen)
 *   loses its record.
 * - **Retention** runs after kept records change and at start (`planRetention`).
 * - **Clear** deletes every snapshot and is final: writes and clears run in one queue, so a
 *   write that began before Clear has finished when it runs, and nothing queued before it is
 *   written after it. The writer then holds the current state as saved: only a new change is
 *   kept again.
 *
 * `navigator.storage.persist()` is asked once, at the first snapshot with a change (§2.4: "at
 * the first edit"), and never awaited: Firefox resolves it only when its permission prompt is
 * answered.
 */
import type { DocumentId, Workspace } from '@pdf-editor/document-model';

import {
  type BlobFacts,
  type DocumentPlace,
  type KeptRecordV1,
  parseKeptRecord,
  parseSessionManifest,
  recordFile,
  type SessionManifestV1,
  type SourceFacts,
  sourceFile,
} from './format';
import { type KeptUsage, planRetention } from './retention';
import {
  buildKeptRecord,
  buildSessionManifest,
  filesOf,
  type PlaceState,
  type SnapshotState,
  workspaceOfDocument,
} from './snapshot';
import type { KeptItem } from './session-store';
import { SNAPSHOT_FOLDERS, type SnapshotStorage, type StoredFileInfo } from './storage';

/** Debounce after a change, and the most a write may wait (ADR-0032: "within 2 s"). */
export const SNAPSHOT_DEBOUNCE_MS = 700;
export const SNAPSHOT_MAX_WAIT_MS = 1800;

export interface WriterDeps {
  readonly storage: SnapshotStorage;
  readonly tabId: string;
  readonly state: () => SnapshotState;
  readonly places: () => PlaceState;
  /** A source's bytes as opened (the engine keeps them while any history entry needs them). */
  readonly sourceBytes: (id: SourceFacts['id']) => Promise<Blob | undefined>;
  readonly now?: () => number;
  /** Called once with whether the browser keeps storage persistently. */
  readonly persist?: () => Promise<boolean>;
  /** A closed document's record was written (Recents attaches it). */
  readonly onKept?: (record: KeptRecordV1) => void;
  /** Kept records were deleted: retention, a reopen, Clear (Recents detaches them). */
  readonly onForgotten?: (ids: readonly string[]) => void;
  /** Status for the UI after every write. */
  readonly onStatus?: (status: WriterStatus) => void;
  readonly debounceMs?: number;
  readonly maxWaitMs?: number;
}

export interface WriterStatus {
  readonly unsaved: boolean;
  readonly savedAt: number | null;
  /** When the last change to keep was noted (`noteChange`), or null before any. */
  readonly changedAt: number | null;
  readonly writeFailed: boolean;
  readonly persisted: boolean | null;
  readonly items: readonly KeptItem[];
  readonly totalBytes: number;
  /** Nothing waits to be written: no change since the last write, none queued or running. */
  readonly idle: boolean;
}

const key = (folder: string, name: string): string => `${folder}/${name}`;

/** Files a manifest or record needs, as `folder/name` keys. */
export function neededFiles(
  sources: readonly SourceFacts[],
  blobs: readonly BlobFacts[],
): string[] {
  return [
    ...sources.map((s) => key('sources', sourceFile(s.id))),
    ...blobs.map((b) => key('blobs', b.id)),
  ];
}

export class SnapshotWriter {
  private readonly deps: WriterDeps;
  private readonly now: () => number;
  private queue: Promise<unknown> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private firstPendingAt: number | undefined;
  /** Files known to be stored (written here, or found by a restore). */
  private readonly stored = new Set<string>();
  /** Closed documents waiting for their kept record, with the workspace they were open in. */
  private closed: {
    ws: Workspace;
    id: DocumentId;
    place: DocumentPlace;
    state: SnapshotState;
    /** When it closed: the record's `keptAt`. */
    at: number;
  }[] = [];
  /** Documents back in the workspace whose kept record must go. */
  private reopened = new Set<DocumentId>();
  private unsaved = false;
  /** Something changed since the last write was queued. */
  private dirty = false;
  /** Queued or running tasks (writes, clears, kept records). */
  private running = 0;
  private savedAt: number | null = null;
  private changedAt: number | null = null;
  private writeFailed = false;
  private persisted: boolean | null = null;
  private persistAsked = false;
  private items: readonly KeptItem[] = [];
  private totalBytes = 0;
  /** Whether this tab has a manifest on disk (deleted when the last document closes). */
  private hasManifest = false;
  private stopped = false;
  /** A full retention run has read the kept records (the list knows them). */
  private listed = false;

  constructor(deps: WriterDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
  }

  get pending(): boolean {
    return this.unsaved;
  }

  /** A change to keep: `content` (history) counts for the `beforeunload` rule, `view` not. */
  noteChange(kind: 'content' | 'view'): void {
    if (this.stopped) return;
    const wasIdle = this.idle;
    this.dirty = true;
    this.changedAt = this.now();
    if (kind === 'content' && !this.unsaved) this.unsaved = true;
    if (wasIdle || kind === 'content') this.report();
    const now = this.now();
    this.firstPendingAt ??= now;
    const maxWait = this.deps.maxWaitMs ?? SNAPSHOT_MAX_WAIT_MS;
    const delay = Math.max(
      0,
      Math.min(this.deps.debounceMs ?? SNAPSHOT_DEBOUNCE_MS, this.firstPendingAt + maxWait - now),
    );
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush();
    }, delay);
  }

  /** Documents that left the workspace; `ws` is the workspace they were last open in. */
  noteClosed(ws: Workspace, ids: readonly DocumentId[]): void {
    if (this.stopped || ids.length === 0) return;
    const places = this.deps.places();
    const state = this.deps.state();
    for (const id of ids) {
      this.reopened.delete(id);
      this.closed = this.closed.filter((c) => c.id !== id);
      const place = { id, ...places.place(id), changed: places.changed(id, ws) };
      this.closed.push({ ws, id, state, place, at: this.now() });
    }
    this.noteChange('content');
  }

  /** Documents that came back (undo of a close, a reopen from Recents). */
  noteReopened(ids: readonly DocumentId[]): void {
    if (this.stopped || ids.length === 0) return;
    for (const id of ids) {
      this.closed = this.closed.filter((c) => c.id !== id);
      this.reopened.add(id);
    }
    this.noteChange('content');
  }

  /** Marks files as stored (a restore found them), so they are not written again. */
  markStored(sources: readonly SourceFacts[], blobs: readonly BlobFacts[]): void {
    for (const file of neededFiles(sources, blobs)) this.stored.add(file);
  }

  /**
   * Writes now (after anything queued) when something changed since the last write.
   * Resolves when written; never rejects.
   */
  flush(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.firstPendingAt = undefined;
    if (!this.dirty) return this.whenIdle();
    this.dirty = false;
    return this.enqueue(() => this.write());
  }

  /** Resolves once every queued write and clear has finished. */
  whenIdle(): Promise<void> {
    return this.queue.then(() => undefined);
  }

  /**
   * Deletes every snapshot of every tab and every kept document (the privacy popover's
   * Clear). Final: nothing queued before it is written after it. Resolves to whether the
   * storage could be cleared.
   */
  clearAll(): Promise<boolean> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.firstPendingAt = undefined;
    const forgotten = this.items.filter((item) => item.state === 'closed').map((item) => item.id);
    this.dirty = false;
    // Pending closes are part of what is cleared.
    this.closed = [];
    this.reopened.clear();
    return this.enqueue(async () => {
      let ok = true;
      try {
        await this.deps.storage.clear();
      } catch (error) {
        console.warn('Clearing kept changes failed', error);
        ok = false;
      }
      this.stored.clear();
      this.hasManifest = false;
      this.unsaved = false;
      this.writeFailed = false;
      this.items = [];
      this.totalBytes = 0;
      this.listed = true;
      if (forgotten.length > 0) this.deps.onForgotten?.(forgotten);
      this.report();
      return ok;
    });
  }

  /** Deletes kept records whose Recents rows went (Remove, Clear recents, the cap). */
  forget(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return Promise.resolve();
    return this.enqueue(async () => {
      for (const id of ids) {
        await this.deps.storage.remove('kept', recordFile(id)).catch(() => undefined);
      }
      await this.retain();
      this.listed = true;
      this.report();
    });
  }

  /**
   * Writes kept records built elsewhere (an orphaned tab's documents at launch), whose files
   * are stored already; `then` runs in the queue after them (deleting the old manifest).
   */
  keep(records: readonly KeptRecordV1[], then?: () => Promise<void>): Promise<void> {
    return this.enqueue(async () => {
      for (const record of records) {
        await this.deps.storage.write('kept', recordFile(record.id), JSON.stringify(record));
        this.deps.onKept?.(record);
      }
      await then?.();
    });
  }

  /** Stops writing (tests, and the edition shutting down). */
  stop(): void {
    this.stopped = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Retention and the popover's list, without a write (at start). */
  refresh(): Promise<void> {
    return this.enqueue(async () => {
      await this.retain();
      this.listed = true;
      this.report();
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.running += 1;
    const done = async (): Promise<T> => {
      try {
        return await task();
      } finally {
        this.running -= 1;
        if (this.running === 0) this.report();
      }
    };
    const run = this.queue.then(done, done);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private report(): void {
    this.deps.onStatus?.({
      unsaved: this.unsaved,
      savedAt: this.savedAt,
      changedAt: this.changedAt,
      writeFailed: this.writeFailed,
      persisted: this.persisted,
      items: this.items,
      totalBytes: this.totalBytes,
      idle: this.idle,
    });
  }

  /** Nothing waits to be written (see `WriterStatus.idle`). */
  get idle(): boolean {
    return !this.dirty && this.timer === undefined && this.running === 0;
  }

  private async writeFiles(
    sources: readonly SourceFacts[],
    blobs: readonly BlobFacts[],
    state: SnapshotState,
  ): Promise<boolean> {
    const { storage } = this.deps;
    let complete = true;
    for (const source of sources) {
      const name = sourceFile(source.id);
      if (this.stored.has(key('sources', name))) continue;
      const bytes = await this.deps.sourceBytes(source.id);
      if (bytes === undefined) {
        complete = false;
        continue;
      }
      await storage.write('sources', name, bytes);
      this.stored.add(key('sources', name));
    }
    for (const blob of blobs) {
      if (this.stored.has(key('blobs', blob.id))) continue;
      const bytes =
        blob.kind === 'edit'
          ? state.editBlobs[blob.id]
          : (() => {
              const stored = state.blobs[blob.id as keyof typeof state.blobs];
              return stored ? new Blob([stored.bytes], { type: stored.type }) : undefined;
            })();
      if (bytes === undefined) {
        complete = false;
        continue;
      }
      await storage.write('blobs', blob.id, bytes);
      this.stored.add(key('blobs', blob.id));
    }
    return complete;
  }

  private async write(): Promise<void> {
    if (this.stopped) return;
    const { storage, tabId } = this.deps;
    const state = this.deps.state();
    const startedUnsaved = this.unsaved;
    // A change after this point marks the state unsaved again.
    this.unsaved = false;
    try {
      await this.forgetMissing();
      const manifest = buildSessionManifest(state, this.deps.places(), tabId, this.now());
      if (manifest === undefined) {
        if (this.hasManifest) await storage.remove('sessions', recordFile(tabId));
        this.hasManifest = false;
      } else {
        await this.writeFiles(manifest.sources, manifest.blobs, state);
        await storage.write('sessions', recordFile(tabId), JSON.stringify(manifest));
        this.hasManifest = true;
        // At the first edit (ADR-0032 §2.4), never awaited: Firefox answers persist() only
        // once the person answers its permission prompt, which may be never.
        if (manifest.documents.some((d) => d.changed)) this.askPersistence();
      }
      const keptChanged = await this.writeKept();
      this.savedAt = this.now();
      this.writeFailed = false;
      await this.retain(keptChanged || !this.listed);
      this.listed = true;
    } catch (error) {
      console.warn('Keeping changes on this device failed', error);
      this.writeFailed = true;
      this.unsaved ||= startedUnsaved;
      // Tried again with the next change, or on the next hide.
      this.dirty = true;
    }
    this.report();
  }

  /**
   * Forgets files this writer thinks are stored but are gone (a Clear in another tab, the
   * browser evicting storage), so the manifest never names a file that is not there.
   */
  private async forgetMissing(): Promise<void> {
    if (this.stored.size === 0) return;
    const present = new Set<string>();
    for (const folder of ['sources', 'blobs'] as const) {
      for (const info of await this.deps.storage.list(folder)) present.add(key(folder, info.name));
    }
    for (const file of [...this.stored]) if (!present.has(file)) this.stored.delete(file);
  }

  /** Asks for persistent storage once; the answer arrives whenever the browser gives it. */
  private askPersistence(): void {
    if (this.persistAsked || !this.deps.persist) return;
    this.persistAsked = true;
    const answer = (persisted: boolean) => {
      this.persisted = persisted;
      this.report();
    };
    this.deps.persist().then(answer, () => answer(false));
  }

  /** Writes the pending kept records and deletes the records of reopened documents. */
  private async writeKept(): Promise<boolean> {
    const { storage } = this.deps;
    const closed = this.closed;
    const reopened = [...this.reopened];
    this.closed = [];
    this.reopened.clear();
    let changed = false;
    for (const item of closed) {
      const record = buildKeptRecord(item.ws, item.id, item.state, item.place, item.at);
      if (record === undefined) continue;
      if (!(await this.writeFiles(record.sources, record.blobs, item.state))) continue;
      await storage.write('kept', recordFile(record.id), JSON.stringify(record));
      changed = true;
      this.deps.onKept?.(record);
    }
    const forgotten: string[] = [];
    for (const id of reopened) {
      const record = `kept-${id}`;
      await storage.remove('kept', recordFile(record));
      forgotten.push(record);
      changed = true;
    }
    if (forgotten.length > 0) this.deps.onForgotten?.(forgotten);
    return changed;
  }

  /**
   * Runs retention over every stored file and rebuilds the popover's list. Without a change
   * to kept records (`full` false) it only re-measures: nothing can have expired by size, and
   * the 30-day rule waits for the next full run (each launch makes one).
   */
  private async retain(full = true): Promise<void> {
    const { storage } = this.deps;
    const stored = new Map<string, StoredFileInfo>();
    for (const folder of SNAPSHOT_FOLDERS) {
      for (const info of await storage.list(folder)) stored.set(key(folder, info.name), info);
    }
    this.totalBytes = [...stored.values()].reduce((sum, info) => sum + info.size, 0);
    if (!full) {
      const closed = this.items.filter(
        (item) => item.state === 'closed' && stored.has(key('kept', recordFile(item.id))),
      );
      this.items = [...this.openItems(stored), ...closed];
      return;
    }
    const live = new Set<string>();
    for (const [file] of stored) {
      if (!file.startsWith('sessions/')) continue;
      live.add(file);
      try {
        const manifest = await readManifest(storage, file.slice('sessions/'.length));
        if (manifest) {
          for (const needed of neededFiles(manifest.sources, manifest.blobs)) live.add(needed);
        }
      } catch {
        // A damaged manifest keeps only itself (set aside, never dropped silently).
      }
    }
    const kept: KeptUsage[] = [];
    const records: KeptRecordV1[] = [];
    for (const [file, info] of stored) {
      if (!file.startsWith('kept/')) continue;
      const name = file.slice('kept/'.length);
      try {
        const record = parseKeptRecord(await (await storage.read('kept', name))?.text());
        records.push(record);
        kept.push({
          id: record.id,
          keptAt: record.keptAt,
          files: [file, ...neededFiles(record.sources, record.blobs)],
        });
      } catch {
        // Unreadable: it ages out like any other record rather than vanishing at once.
        kept.push({ id: name.replace(/\.json$/, ''), keptAt: info.lastModified, files: [file] });
      }
    }
    const plan = planRetention({ now: this.now(), kept, live, stored });
    for (const file of plan.unreferenced) {
      const [folder, name] = file.split('/') as [(typeof SNAPSHOT_FOLDERS)[number], string];
      await storage.remove(folder, name).catch(() => undefined);
      stored.delete(file);
      this.stored.delete(file);
    }
    if (plan.expired.length > 0) this.deps.onForgotten?.(plan.expired);
    this.totalBytes = [...stored.values()].reduce((sum, info) => sum + info.size, 0);
    const expired = new Set(plan.expired);
    const sizeOf = (files: readonly string[]) =>
      files.reduce((sum, file) => sum + (stored.get(file)?.size ?? 0), 0);
    const closed = records
      .filter((record) => !expired.has(record.id))
      .map(
        (record): KeptItem => ({
          id: record.id,
          title: record.title,
          bytes: sizeOf([
            key('kept', recordFile(record.id)),
            ...neededFiles(record.sources, record.blobs),
          ]),
          state: 'closed',
          at: record.keptAt,
          changed: record.place.changed,
        }),
      )
      .sort((a, b) => b.at - a.at);
    this.items = [...this.openItems(stored), ...closed];
  }

  /** The open documents of this tab, sized by the files each needs. */
  private openItems(stored: ReadonlyMap<string, StoredFileInfo>): KeptItem[] {
    if (!this.hasManifest) return [];
    const state = this.deps.state();
    const places = this.deps.places();
    const ws = state.history.present.workspace;
    return ws.documentOrder.flatMap((id): KeptItem[] => {
      const doc = ws.documents[id];
      if (doc === undefined) return [];
      const files = filesOf([workspaceOfDocument(ws, id)], state);
      const bytes = neededFiles(files.sources, files.blobs).reduce(
        (sum, file) => sum + (stored.get(file)?.size ?? 0),
        0,
      );
      return [
        {
          id,
          title: doc.title,
          bytes,
          state: 'open',
          at: this.savedAt ?? this.now(),
          changed: places.changed(id),
        },
      ];
    });
  }
}

/** The session manifest of `tabId`, if one is stored and readable. */
export async function readManifest(
  storage: SnapshotStorage,
  name: string,
): Promise<SessionManifestV1 | undefined> {
  const file = await storage.read('sessions', name);
  if (!file) return undefined;
  return parseSessionManifest(await file.text());
}
