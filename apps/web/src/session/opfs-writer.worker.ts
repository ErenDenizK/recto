/**
 * Writes one snapshot file through a sync access handle (session/storage.ts): the path
 * WebKit takes where `FileSystemFileHandle.createWritable()` is missing on the main thread.
 * Sync access handles exist only in dedicated workers. One message per file:
 * `{ id, root, folder, name, bytes }` → `{ id, ok, message? }`.
 */
interface WriteRequest {
  readonly id: number;
  readonly root: string;
  readonly folder: string;
  readonly name: string;
  readonly bytes: ArrayBuffer;
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
}

interface Dir {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<Dir>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<SyncFileHandle>;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WriteRequest>) => void) | null;
  postMessage(message: unknown): void;
};

/** Writes run one at a time: a sync access handle is exclusive per file. */
let queue: Promise<void> = Promise.resolve();

scope.onmessage = (event) => {
  const { id, root, folder, name, bytes } = event.data;
  queue = queue.then(async () => {
    try {
      const origin = (await navigator.storage.getDirectory()) as unknown as Dir;
      const base = await origin.getDirectoryHandle(root, { create: true });
      const dir = await base.getDirectoryHandle(folder, { create: true });
      const file = await dir.getFileHandle(name, { create: true });
      const handle = await file.createSyncAccessHandle();
      try {
        await handle.truncate(0);
        await handle.write(new Uint8Array(bytes), { at: 0 });
        await handle.flush();
      } finally {
        await handle.close();
      }
      scope.postMessage({ id, ok: true });
    } catch (error) {
      scope.postMessage({ id, ok: false, message: String(error) });
    }
  });
};
