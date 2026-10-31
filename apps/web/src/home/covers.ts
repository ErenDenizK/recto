/**
 * The cover store (DSN-87, `masa.md` §3.1): small JPEGs of a file's first page and of the page
 * where reading stopped, kept so the desk shows pictures without starting the PDF engine.
 *
 * Stored in IndexedDB, database `pdf-editor:covers:v1`, store `covers` keyed by `key`. It is a
 * database of its own so Recents' database and its version are untouched and a cover failure can
 * never cost Recents. A record is `{ key, kind, page, width, height, type, bytes, at }` with the
 * bytes as an ArrayBuffer (not a Blob: WebKit's Blob-in-IndexedDB history). At most
 * `COVERS_LIMIT` records (the oldest go first), under 0.6 MB in all.
 *
 * - **Key**: the Recents identity (name and size, `sameRecentFile`) and the kind, `first` (page 1)
 *   or `left` (the page left, only past page 1). Keying by identity means a reopen that replaces
 *   an entry keeps its covers with no move step.
 * - **Lifecycle**: the orphan sweep (`sweepCovers`, run by `watchCoverSweep` whenever the Recents
 *   list is loaded or changes) deletes every cover whose identity is in no entry, so Remove, Clear
 *   recents and the cap take covers with them without a transaction across databases.
 *   `clearCovers` is the privacy Clear's (`session/session.ts`).
 * - **Failure**: when IndexedDB is refused (some private windows) covers live in memory until the
 *   tab closes, as Recents does. Nothing here starts the engine (the capture, which does, is
 *   `cover-capture.ts`).
 */
import { useEffect, useRef, useState } from 'react';

import { type RecentEntry, useRecentsStore } from '../files/recents';

export const COVERS_DB_NAME = 'pdf-editor:covers:v1';
const COVERS_DB_VERSION = 1;
const COVERS_STORE = 'covers';
/** At most this many covers are kept (`masa.md` §3.1: 12 entries, two kinds each). */
export const COVERS_LIMIT = 24;

export type CoverKind = 'first' | 'left';

/** A stored cover. */
export interface CoverRecord {
  readonly key: string;
  readonly kind: CoverKind;
  /** The page shown, 0-based. */
  readonly page: number;
  /** Pixel size of the image. */
  readonly width: number;
  readonly height: number;
  readonly type: 'image/jpeg';
  readonly bytes: ArrayBuffer;
  readonly at: number;
}

/** What a read hands the desk: the image behind an object URL. */
export interface Cover {
  readonly kind: CoverKind;
  readonly page: number;
  readonly width: number;
  readonly height: number;
  readonly url: string;
}

type FileId = Pick<RecentEntry, 'name' | 'size'>;

/** The Recents identity of a file (`sameRecentFile`). */
export const coverIdentity = (file: FileId): string => `${file.name}\u0000${file.size}`;

/** The key of a file's cover of `kind`. */
export const coverKey = (kind: CoverKind, file: FileId): string =>
  `${kind}\u0000${coverIdentity(file)}`;

/** The identity part of a key. */
const identityOfKey = (key: string): string => key.slice(key.indexOf('\u0000') + 1);

function parseCover(value: unknown): CoverRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Partial<Record<keyof CoverRecord, unknown>>;
  const count = (v: unknown): v is number =>
    typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
  if (typeof r.key !== 'string' || (r.kind !== 'first' && r.kind !== 'left')) return null;
  if (!count(r.page) || !count(r.width) || !count(r.height) || !count(r.at)) return null;
  if (r.type !== 'image/jpeg' || !(r.bytes instanceof ArrayBuffer)) return null;
  return {
    key: r.key,
    kind: r.kind,
    page: r.page,
    width: r.width,
    height: r.height,
    type: r.type,
    bytes: r.bytes,
    at: r.at,
  };
}

// ---------------------------------------------------------------------------
// Backends
// ---------------------------------------------------------------------------

/** The store behind the module: IndexedDB, or memory where IndexedDB is refused. */
export interface CoversBackend {
  list(): Promise<readonly unknown[]>;
  put(record: CoverRecord): Promise<void>;
  remove(keys: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

export function memoryCoversBackend(): CoversBackend {
  const records = new Map<string, CoverRecord>();
  return {
    list: () => Promise.resolve([...records.values()]),
    put: (record) => {
      records.set(record.key, record);
      return Promise.resolve();
    },
    remove: (keys) => {
      for (const key of keys) records.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      records.clear();
      return Promise.resolve();
    },
  };
}

function settle(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function indexedDbCoversBackend(
  factory: IDBFactory = indexedDB,
  name: string = COVERS_DB_NAME,
): CoversBackend {
  let connection: Promise<IDBDatabase> | undefined;
  const db = (): Promise<IDBDatabase> => {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open(name, COVERS_DB_VERSION);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(COVERS_STORE)) {
          open.result.createObjectStore(COVERS_STORE, { keyPath: 'key' });
        }
      };
      open.onsuccess = () => {
        const result = open.result;
        result.onversionchange = () => {
          result.close();
          connection = undefined;
        };
        result.onclose = () => {
          connection = undefined;
        };
        resolve(result);
      };
      open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
      open.onblocked = () => reject(new Error('IndexedDB open blocked'));
    }).catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
    return connection;
  };
  const write = async (run: (store: IDBObjectStore) => void): Promise<void> => {
    const tx = (await db()).transaction(COVERS_STORE, 'readwrite');
    const done = settle(tx);
    run(tx.objectStore(COVERS_STORE));
    await done;
  };
  return {
    // One read transaction for every cover: at most `COVERS_LIMIT` small records.
    list: async () =>
      new Promise<readonly unknown[]>((resolve, reject) => {
        void db().then((open) => {
          const req = open.transaction(COVERS_STORE, 'readonly').objectStore(COVERS_STORE).getAll();
          req.onsuccess = () => resolve(req.result as unknown[]);
          req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'));
        }, reject);
      }),
    put: (record) => write((store) => void store.put(record)),
    remove: (keys) =>
      write((store) => {
        for (const key of keys) store.delete(key);
      }),
    clear: () => write((store) => void store.clear()),
  };
}

let backend: CoversBackend | undefined;

function store(): CoversBackend {
  if (backend) return backend;
  try {
    backend = typeof indexedDB === 'undefined' ? memoryCoversBackend() : indexedDbCoversBackend();
  } catch {
    backend = memoryCoversBackend();
  }
  return backend;
}

/** Replaces the backend (tests); forgets what was read. */
export function setCoversBackend(next: CoversBackend | undefined): void {
  backend = next;
  prefetched = undefined;
  chain = Promise.resolve();
  inMemory = false;
}

/** True once a failure switched the store to memory. */
let inMemory = false;

/** Runs `run` on the store; where IndexedDB fails the cover moves to memory for the tab. */
async function guarded<T>(run: (target: CoversBackend) => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run(store());
  } catch {
    if (inMemory) return fallback;
    inMemory = true;
    backend = memoryCoversBackend();
    try {
      return await run(backend);
    } catch {
      return fallback;
    }
  }
}

/** Writes and deletions run one after another, so a sweep never races a put. */
let chain: Promise<unknown> = Promise.resolve();

function ordered<T>(run: () => Promise<T>): Promise<T> {
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
let version = 0;

function changed(): void {
  version += 1;
  prefetched = undefined;
  for (const listener of listeners) listener();
}

// ---------------------------------------------------------------------------
// Read, write, sweep, clear
// ---------------------------------------------------------------------------

/** Every stored cover (a damaged record is skipped). */
export async function readCovers(): Promise<CoverRecord[]> {
  const records = await guarded((target) => target.list(), [] as readonly unknown[]);
  const covers: CoverRecord[] = [];
  for (const record of records) {
    const cover = parseCover(record);
    if (cover !== null) covers.push(cover);
  }
  return covers;
}

let prefetched: Promise<CoverRecord[]> | undefined;

/**
 * Starts the one read the desk makes (`desk-prefetch.ts`) and hands it to whoever asks first.
 * A write or a sweep voids it.
 */
export function prefetchCovers(): Promise<CoverRecord[]> {
  prefetched ??= readCovers();
  return prefetched;
}

/** Stores `record` and drops the oldest beyond `COVERS_LIMIT`. */
export function writeCover(record: CoverRecord): Promise<void> {
  return ordered(async () => {
    await guarded((target) => target.put(record), undefined);
    const all = await readCovers();
    const over = all
      .sort((a, b) => b.at - a.at)
      .slice(COVERS_LIMIT)
      .map((cover) => cover.key);
    if (over.length > 0) await guarded((target) => target.remove(over), undefined);
    changed();
  });
}

/** Deletes every cover whose file is in none of `files` (the orphan sweep). */
export function sweepCovers(files: readonly FileId[]): Promise<void> {
  const known = new Set(files.map(coverIdentity));
  return ordered(async () => {
    const stale = (await readCovers())
      .filter((cover) => !known.has(identityOfKey(cover.key)))
      .map((cover) => cover.key);
    if (stale.length === 0) return;
    await guarded((target) => target.remove(stale), undefined);
    changed();
  });
}

/** Deletes every cover (the privacy popover's and Settings' Clear). */
export function clearCovers(): Promise<void> {
  return ordered(async () => {
    await guarded((target) => target.clear(), undefined);
    changed();
  });
}

/**
 * Keeps the covers to the Recents list: sweeps once the list has loaded and after every change
 * (Remove, Clear recents, the cap). Idempotent; returns the stop function.
 */
let sweeping: (() => void) | undefined;

export function watchCoverSweep(): () => void {
  if (sweeping) return sweeping;
  const run = (entries: readonly RecentEntry[]) => void sweepCovers(entries);
  const state = useRecentsStore.getState();
  if (state.loaded) run(state.entries);
  const off = useRecentsStore.subscribe((next, previous) => {
    if (next.loaded && (!previous.loaded || next.entries !== previous.entries)) run(next.entries);
  });
  sweeping = () => {
    off();
    sweeping = undefined;
  };
  return sweeping;
}

// ---------------------------------------------------------------------------
// The read hook
// ---------------------------------------------------------------------------

/**
 * Every cover as an image URL, keyed by `coverKey`: one read (the desk's prefetch, else a
 * transaction of its own), refreshed when a cover is written or deleted. The object URLs are
 * revoked when the view unmounts or the covers change. Empty until the read lands. Reads only;
 * the engine is not involved.
 */
export function useCovers(): ReadonlyMap<string, Cover> {
  const [covers, setCovers] = useState<ReadonlyMap<string, Cover>>(() => new Map());
  const [seen, setSeen] = useState(version);
  useEffect(() => {
    const refresh = () => setSeen(version);
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, []);
  const held = useRef<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void prefetchCovers().then((records) => {
      if (cancelled) return;
      const urls: string[] = [];
      const next = new Map<string, Cover>();
      for (const record of records) {
        const url = URL.createObjectURL(new Blob([record.bytes], { type: record.type }));
        urls.push(url);
        next.set(record.key, {
          kind: record.kind,
          page: record.page,
          width: record.width,
          height: record.height,
          url,
        });
      }
      // The images on screen keep their URLs until the new ones are in place.
      const old = held.current;
      held.current = urls;
      setCovers(next);
      requestAnimationFrame(() => {
        for (const url of old) URL.revokeObjectURL(url);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [seen]);
  useEffect(
    () => () => {
      for (const url of held.current) URL.revokeObjectURL(url);
      held.current = [];
    },
    [],
  );
  return covers;
}
