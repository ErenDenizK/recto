/**
 * Where session snapshots live (ADR-0032 §2.4, "OPFS is the browser's file store for large
 * bytes"): the origin private file system, under one directory (`SNAPSHOT_ROOT`) with four
 * folders:
 *
 * - `sources/` the bytes of each source as opened, once per source (`<sourceId>.pdf`);
 * - `blobs/` image bytes of image pages and edit blobs (stamp and signature appearances),
 *   once per id;
 * - `sessions/` one manifest per tab (`<tabId>.json`): the open documents and the history tail;
 * - `kept/` one record per closed document (`<snapshotId>.json`), reopened from Recents.
 *
 * Engines differ (written for all three; CI runs them):
 * - Chromium and Firefox write through `FileSystemFileHandle.createWritable()`, which writes
 *   a swap file and replaces the old file on `close()`, so a manifest is never half written.
 * - WebKit before Safari 26 has no `createWritable()` on the main thread; writes then go to a
 *   small module worker (`opfs-writer.worker.ts`) that uses `createSyncAccessHandle()`.
 * - Firefox in a private window refuses `getDirectory()` (SecurityError); some browsers
 *   refuse it with storage blocked. `openSnapshotStorage` probes once with a real write, and
 *   the app then says "Changes are not kept in this window" (ADR-0032 §2.7).
 *
 * Every operation tolerates a missing file or folder (a Clear in another tab may have run).
 */

/** The OPFS directory that holds every snapshot. Storage names never change (spec §13). */
export const SNAPSHOT_ROOT = 'pdf-editor-session-v1';

export type SnapshotFolder = 'sources' | 'blobs' | 'sessions' | 'kept';
export const SNAPSHOT_FOLDERS: readonly SnapshotFolder[] = ['sources', 'blobs', 'sessions', 'kept'];

export interface StoredFileInfo {
  readonly name: string;
  readonly size: number;
  readonly lastModified: number;
}

/** The snapshot store; `memorySnapshotStorage` stands in for OPFS in unit tests. */
export interface SnapshotStorage {
  readonly kind: 'opfs' | 'memory';
  /** The file, or undefined when it does not exist. */
  read(folder: SnapshotFolder, name: string): Promise<File | undefined>;
  /** Creates or replaces the file. */
  write(folder: SnapshotFolder, name: string, data: Blob | string): Promise<void>;
  /** Deletes the file; nothing happens when it does not exist. */
  remove(folder: SnapshotFolder, name: string): Promise<void>;
  list(folder: SnapshotFolder): Promise<readonly StoredFileInfo[]>;
  /** Deletes every snapshot (the whole root directory). */
  clear(): Promise<void>;
}

/** Names the store accepts: ids and fixed suffixes only, never a path. */
const SAFE_NAME = /^[A-Za-z0-9._-]{1,200}$/;

export function assertSafeName(name: string): void {
  if (!SAFE_NAME.test(name) || name === '.' || name === '..') {
    throw new Error(`Not a snapshot file name: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Memory (tests)
// ---------------------------------------------------------------------------

export function memorySnapshotStorage(): SnapshotStorage & {
  /** Every file, keyed `folder/name` (tests). */
  readonly files: Map<string, File>;
} {
  const files = new Map<string, File>();
  let clock = 0;
  return {
    kind: 'memory',
    files,
    read: (folder, name) => Promise.resolve(files.get(`${folder}/${name}`)),
    // A bad name throws inside the executor, so the write rejects like the OPFS one.
    write: (folder, name, data) =>
      new Promise<void>((resolve) => {
        assertSafeName(name);
        // Strictly increasing times, so "older than" checks are deterministic in tests.
        clock = Math.max(clock + 1, Date.now());
        files.set(`${folder}/${name}`, new File([data], name, { lastModified: clock }));
        resolve();
      }),
    remove: (folder, name) => {
      files.delete(`${folder}/${name}`);
      return Promise.resolve();
    },
    list: (folder) =>
      Promise.resolve(
        [...files.entries()]
          .filter(([key]) => key.startsWith(`${folder}/`))
          .map(([, file]) => ({
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
          })),
      ),
    clear: () => {
      files.clear();
      return Promise.resolve();
    },
  };
}

// ---------------------------------------------------------------------------
// OPFS
// ---------------------------------------------------------------------------

/** The parts of the File System API used here, typed locally (not every engine has all). */
interface WritableLike {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

interface FileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  createWritable?(): Promise<WritableLike>;
}

interface DirectoryHandleLike {
  readonly kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values?(): AsyncIterableIterator<FileHandleLike | DirectoryHandleLike>;
}

interface StorageManagerLike {
  getDirectory?(): Promise<DirectoryHandleLike>;
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'TypeError')
  );
}

/** Writes through a module worker with sync access handles (WebKit without createWritable). */
class SyncHandleWriter {
  private worker: Worker | undefined;
  private seq = 0;
  private readonly pending = new Map<
    number,
    { resolve: () => void; reject: (error: Error) => void }
  >();

  private start(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./opfs-writer.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; message?: string }>) => {
      const job = this.pending.get(event.data.id);
      if (!job) return;
      this.pending.delete(event.data.id);
      if (event.data.ok) job.resolve();
      else job.reject(new Error(event.data.message ?? 'Snapshot write failed'));
    };
    worker.onerror = () => {
      for (const job of this.pending.values()) job.reject(new Error('Snapshot writer stopped'));
      this.pending.clear();
      this.worker = undefined;
    };
    this.worker = worker;
    return worker;
  }

  async write(folder: SnapshotFolder, name: string, data: Blob | string): Promise<void> {
    const bytes = await new Blob([data]).arrayBuffer();
    const worker = this.start();
    const id = ++this.seq;
    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, root: SNAPSHOT_ROOT, folder, name, bytes }, [bytes]);
    });
  }
}

/** The OPFS store over a root directory handle (`navigator.storage.getDirectory()`). */
export function opfsSnapshotStorage(origin: DirectoryHandleLike): SnapshotStorage {
  let root: Promise<DirectoryHandleLike> | undefined;
  const folders = new Map<SnapshotFolder, Promise<DirectoryHandleLike>>();
  const sync = new SyncHandleWriter();
  const base = (): Promise<DirectoryHandleLike> => {
    root ??= origin.getDirectoryHandle(SNAPSHOT_ROOT, { create: true });
    root.catch(() => {
      root = undefined;
    });
    return root;
  };
  const folder = (name: SnapshotFolder): Promise<DirectoryHandleLike> => {
    let found = folders.get(name);
    if (!found) {
      found = base().then((dir) => dir.getDirectoryHandle(name, { create: true }));
      found.catch(() => folders.delete(name));
      folders.set(name, found);
    }
    return found;
  };
  /** A folder that exists, looked up afresh (reads never create folders). */
  const existing = async (name: SnapshotFolder): Promise<DirectoryHandleLike> =>
    (await origin.getDirectoryHandle(SNAPSHOT_ROOT)).getDirectoryHandle(name);
  /** Runs `task`; a handle made stale by a Clear in another tab is looked up again once. */
  const retrying = async <T>(task: () => Promise<T>): Promise<T> => {
    try {
      return await task();
    } catch (error) {
      if (!isNotFound(error)) throw error;
      root = undefined;
      folders.clear();
      return task();
    }
  };
  return {
    kind: 'opfs',
    read: async (name, file) => {
      assertSafeName(file);
      try {
        const handle = await (await existing(name)).getFileHandle(file);
        return await handle.getFile();
      } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
      }
    },
    write: async (name, file, data) => {
      assertSafeName(file);
      await retrying(async () => {
        const handle = await (await folder(name)).getFileHandle(file, { create: true });
        if (typeof handle.createWritable !== 'function') {
          await sync.write(name, file, data);
          return;
        }
        const writable = await handle.createWritable();
        try {
          await writable.write(data);
          await writable.close();
        } catch (error) {
          await writable.abort?.().catch(() => undefined);
          throw error;
        }
      });
    },
    remove: async (name, file) => {
      assertSafeName(file);
      try {
        await (await existing(name)).removeEntry(file);
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
    list: async (name) => {
      let dir: DirectoryHandleLike;
      try {
        dir = await existing(name);
      } catch (error) {
        if (isNotFound(error)) return [];
        throw error;
      }
      if (typeof dir.values !== 'function') return [];
      const out: StoredFileInfo[] = [];
      for await (const entry of dir.values()) {
        if (entry.kind !== 'file') continue;
        try {
          const file = await entry.getFile();
          out.push({ name: entry.name, size: file.size, lastModified: file.lastModified });
        } catch {
          // Deleted while listing.
        }
      }
      return out;
    },
    clear: async () => {
      folders.clear();
      root = undefined;
      try {
        await origin.removeEntry(SNAPSHOT_ROOT, { recursive: true });
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    },
  };
}

export type SnapshotAvailability =
  | { readonly ok: true; readonly storage: SnapshotStorage }
  | {
      readonly ok: false;
      /** `unsupported`: no OPFS; `refused`: OPFS exists but storage is refused (private window). */
      readonly reason: 'unsupported' | 'refused';
    };

/**
 * Opens the OPFS store and proves it with a small write, so a private window that refuses
 * storage (or keeps none) is known before anything relies on it.
 */
export async function openSnapshotStorage(
  storageManager: StorageManagerLike | undefined = globalThis.navigator?.storage,
): Promise<SnapshotAvailability> {
  if (typeof storageManager?.getDirectory !== 'function') {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    const origin = await storageManager.getDirectory();
    const storage = opfsSnapshotStorage(origin);
    await storage.write('sessions', 'probe', 'ok');
    await storage.remove('sessions', 'probe');
    return { ok: true, storage };
  } catch {
    return { ok: false, reason: 'refused' };
  }
}
