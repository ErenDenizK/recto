/**
 * Writes one snapshot file through a sync access handle (session/storage.ts): the path
 * WebKit takes where `FileSystemFileHandle.createWritable()` is missing on the main thread.
 * Sync access handles exist only in dedicated workers. One message per file:
 * `{ id, root, folder, name, bytes, atomic }` → `{ id, ok, message? }`.
 *
 * A sync access handle writes in place, so a tab killed mid-write (common when iPadOS hides
 * it) would leave the file cut short. `atomic` files (manifests and kept records) are written
 * whole to `<name>.tmp` first and then moved onto their name. Where `move()` is missing or
 * refuses to replace the file, the record is rewritten in place after the copy is whole and
 * the copy is removed afterwards: at every moment one of the two is whole, and the store's
 * reads take the newest whole one.
 */
interface WriteRequest {
  readonly id: number;
  readonly root: string;
  readonly folder: string;
  readonly name: string;
  readonly bytes: ArrayBuffer;
  readonly atomic?: boolean;
}

/**
 * Safari 15.2–16.x shipped an earlier draft whose methods return promises; today's are
 * synchronous. Every call is awaited, which suits both.
 */
interface SyncAccessHandleLike {
  truncate(size: number): void | Promise<void>;
  write(buffer: Uint8Array, options?: { at?: number }): number | Promise<number>;
  flush(): void | Promise<void>;
  close(): void | Promise<void>;
}

interface SyncFileHandle {
  createSyncAccessHandle(): Promise<SyncAccessHandleLike>;
  /** Renames the file within its folder (replacing a file of that name where allowed). */
  move?(newName: string): Promise<void>;
}

interface Dir {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<Dir>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<SyncFileHandle>;
  removeEntry(name: string): Promise<void>;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WriteRequest>) => void) | null;
  postMessage(message: unknown): void;
};

/** The copy an atomic write makes first (storage.ts `TEMP_SUFFIX`). */
const TEMP_SUFFIX = '.tmp';

/** Writes `bytes` as the whole of `name`, in place. */
async function writeWhole(dir: Dir, name: string, bytes: Uint8Array): Promise<SyncFileHandle> {
  const file = await dir.getFileHandle(name, { create: true });
  const handle = await file.createSyncAccessHandle();
  try {
    await handle.truncate(0);
    await handle.write(bytes, { at: 0 });
    await handle.flush();
  } finally {
    await handle.close();
  }
  return file;
}

/** Writes `name` so that a whole copy of it exists at every moment. */
async function writeAtomic(dir: Dir, name: string, bytes: Uint8Array): Promise<void> {
  const temp = `${name}${TEMP_SUFFIX}`;
  const copy = await writeWhole(dir, temp, bytes);
  if (typeof copy.move === 'function') {
    try {
      await copy.move(name);
      return;
    } catch {
      // Some engines refuse to replace an existing file: rewrite it in place below.
    }
  }
  await writeWhole(dir, name, bytes);
  await dir.removeEntry(temp).catch(() => undefined);
}

/** Writes run one at a time: a sync access handle is exclusive per file. */
let queue: Promise<void> = Promise.resolve();

scope.onmessage = (event) => {
  const { id, root, folder, name, bytes, atomic } = event.data;
  queue = queue.then(async () => {
    try {
      const origin = (await navigator.storage.getDirectory()) as unknown as Dir;
      const base = await origin.getDirectoryHandle(root, { create: true });
      const dir = await base.getDirectoryHandle(folder, { create: true });
      const data = new Uint8Array(bytes);
      if (atomic === true) await writeAtomic(dir, name, data);
      else await writeWhole(dir, name, data);
      scope.postMessage({ id, ok: true });
    } catch (error) {
      scope.postMessage({ id, ok: false, message: String(error) });
    }
  });
};
