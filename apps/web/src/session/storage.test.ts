/**
 * The OPFS snapshot store in a real browser (Vitest browser mode, Chromium): write, read,
 * list, remove and a Clear that removes everything; the probe that tells a private window
 * (storage refused) from no OPFS at all.
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  memorySnapshotStorage,
  openSnapshotStorage,
  opfsSnapshotStorage,
  SNAPSHOT_ROOT,
  type SnapshotStorage,
} from './storage';

async function opfs(): Promise<SnapshotStorage> {
  const result = await openSnapshotStorage();
  if (!result.ok) throw new Error(`OPFS unavailable: ${result.reason}`);
  return result.storage;
}

/** A directory whose file handles lack `createWritable`, as WebKit's main thread has them. */
function withoutCreateWritable(dir: FileSystemDirectoryHandle): unknown {
  return new Proxy(dir, {
    get(target, prop) {
      if (prop === 'getDirectoryHandle') {
        return async (name: string, options?: FileSystemGetDirectoryOptions) =>
          withoutCreateWritable(await target.getDirectoryHandle(name, options));
      }
      if (prop === 'getFileHandle') {
        return async (name: string, options?: FileSystemGetFileOptions) => {
          const file = await target.getFileHandle(name, options);
          return {
            kind: 'file',
            name: file.name,
            getFile: () => file.getFile(),
          };
        };
      }
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function' ? (value as () => unknown).bind(target) : value;
    },
  });
}

describe('OPFS snapshot storage', () => {
  afterEach(async () => {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(SNAPSHOT_ROOT, { recursive: true }).catch(() => undefined);
  });

  it('writes, reads, lists, replaces and removes files', async () => {
    const storage = await opfs();
    expect(storage.kind).toBe('opfs');
    await storage.write('sources', 'src_a.pdf', new Blob(['%PDF-1.7 a']));
    await storage.write('sessions', 'tab.json', '{"v":1}');
    expect(await (await storage.read('sources', 'src_a.pdf'))?.text()).toBe('%PDF-1.7 a');
    await storage.write('sessions', 'tab.json', '{"v":2}');
    expect(await (await storage.read('sessions', 'tab.json'))?.text()).toBe('{"v":2}');
    const listed = await storage.list('sources');
    expect(listed.map((f) => [f.name, f.size])).toEqual([['src_a.pdf', 10]]);
    expect(await storage.read('kept', 'missing.json')).toBeUndefined();
    await storage.remove('sources', 'src_a.pdf');
    await storage.remove('sources', 'src_a.pdf');
    expect(await storage.list('sources')).toEqual([]);
  });

  it('Clear removes every folder, and the store works again after it', async () => {
    const storage = await opfs();
    await storage.write('kept', 'k.json', '{}');
    await storage.write('blobs', 'edit-1', new Blob([new Uint8Array([1])]));
    await storage.clear();
    const root = await navigator.storage.getDirectory();
    await expect(root.getDirectoryHandle(SNAPSHOT_ROOT)).rejects.toThrow();
    for (const folder of ['sources', 'blobs', 'sessions', 'kept'] as const) {
      expect(await storage.list(folder)).toEqual([]);
    }
    // Reading creates nothing.
    await expect(root.getDirectoryHandle(SNAPSHOT_ROOT)).rejects.toThrow();
    await storage.write('kept', 'k.json', '{"again":true}');
    expect(await (await storage.read('kept', 'k.json'))?.text()).toBe('{"again":true}');
  });

  it('a Clear from another tab does not break this tab’s next write', async () => {
    const storage = await opfs();
    await storage.write('sessions', 'a.json', '1');
    const other = await opfs();
    await other.clear();
    await storage.write('sessions', 'a.json', '2');
    expect(await (await storage.read('sessions', 'a.json'))?.text()).toBe('2');
  });

  it('a record whose rewrite was cut short reads as its whole copy, and goes with it', async () => {
    const storage = await opfs();
    // As WebKit's worker leaves them when the tab is killed while it rewrites a manifest:
    // the new copy whole beside it, the record itself cut short.
    await storage.write('sessions', 'tab.json', '{"v":');
    await storage.write('sessions', 'tab.json.tmp', '{"v":2}');
    expect(await (await storage.read('sessions', 'tab.json'))?.text()).toBe('{"v":2}');
    expect((await storage.list('sessions')).map((f) => f.name)).toEqual(['tab.json']);
    // Cut short while the new copy was written: the record itself is still whole.
    await storage.write('kept', 'k.json', '{"v":1}');
    await storage.write('kept', 'k.json.tmp', '{"v":');
    expect(await (await storage.read('kept', 'k.json'))?.text()).toBe('{"v":1}');
    // Killed before the very first copy took its name: it is found under that name.
    await storage.write('kept', 'first.json.tmp', '{"first":true}');
    expect((await storage.list('kept')).map((f) => f.name).sort()).toEqual([
      'first.json',
      'k.json',
    ]);
    expect(await (await storage.read('kept', 'first.json'))?.text()).toBe('{"first":true}');
    await storage.remove('sessions', 'tab.json');
    await storage.remove('kept', 'first.json');
    expect(await storage.list('sessions')).toEqual([]);
    expect((await storage.list('kept')).map((f) => f.name)).toEqual(['k.json']);
  });

  it('WebKit’s worker path replaces a record whole and leaves no copy behind', async () => {
    // The origin as WebKit before Safari 26 shows it: no createWritable on the main thread.
    const origin = withoutCreateWritable(await navigator.storage.getDirectory());
    const storage = opfsSnapshotStorage(origin as never);
    await storage.write('sessions', 'tab.json', '{"v":1}');
    await storage.write('sessions', 'tab.json', '{"v":2}');
    await storage.write('sources', 'src_a.pdf', new Blob(['%PDF-1.7 a']));
    expect(await (await storage.read('sessions', 'tab.json'))?.text()).toBe('{"v":2}');
    expect(await (await storage.read('sources', 'src_a.pdf'))?.text()).toBe('%PDF-1.7 a');
    const root = await navigator.storage.getDirectory();
    const sessions = await (await root.getDirectoryHandle(SNAPSHOT_ROOT)).getDirectoryHandle(
      'sessions',
    );
    const names: string[] = [];
    for await (const name of (sessions as unknown as { keys(): AsyncIterable<string> }).keys()) {
      names.push(name);
    }
    expect(names).toEqual(['tab.json']);
  });

  it('refuses names that are not plain ids', async () => {
    const storage = memorySnapshotStorage();
    await expect(storage.write('kept', '../x', '1')).rejects.toThrow();
    await expect(storage.write('kept', 'a/b', '1')).rejects.toThrow();
  });
});

describe('openSnapshotStorage', () => {
  it('says unsupported without OPFS', async () => {
    expect(await openSnapshotStorage({})).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('keeps nothing when storage never answers', async () => {
    const hanging = { getDirectory: () => new Promise<never>(() => undefined) };
    expect(await openSnapshotStorage(hanging, 50)).toEqual({ ok: false, reason: 'timeout' });
  });

  it('says refused when storage is refused (a private window)', async () => {
    const refusing = {
      getDirectory: () => Promise.reject(new DOMException('denied', 'SecurityError')),
    };
    expect(await openSnapshotStorage(refusing)).toEqual({ ok: false, reason: 'refused' });
  });
});
