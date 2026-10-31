/**
 * The cover store (DSN-87): write and read in one transaction, the orphan sweep, Clear, the
 * 24-record cap, the memory fallback where IndexedDB is refused, and the JPEG a capture
 * encodes. Real IndexedDB (browser mode), a database of its own per test.
 */
import type { SourceDocument } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type RecentEntry, useRecentsStore } from '../files/recents';
import {
  clearCovers,
  type CoverRecord,
  COVERS_DB_NAME,
  COVERS_LIMIT,
  coverKey,
  indexedDbCoversBackend,
  memoryCoversBackend,
  readCovers,
  setCoversBackend,
  sweepCovers,
  watchCoverSweep,
  writeCover,
} from './covers';
import {
  coverIsCurrent,
  encodeCover,
  FIRST_BOX,
  firstCoverSource,
  LEFT_BOX,
} from './cover-capture';

const dbs: string[] = [];
const freshDb = (): string => {
  const name = `${COVERS_DB_NAME}.test-${crypto.randomUUID()}`;
  dbs.push(name);
  return name;
};

const cover = (name: string, kind: 'first' | 'left' = 'first', at = 1): CoverRecord => ({
  key: coverKey(kind, { name, size: 10 }),
  kind,
  page: kind === 'first' ? 0 : 3,
  width: 2,
  height: 3,
  type: 'image/jpeg',
  bytes: new Uint8Array([0xff, 0xd8, 0xff]).buffer,
  at,
});

beforeEach(() => setCoversBackend(indexedDbCoversBackend(indexedDB, freshDb())));
afterEach(() => {
  setCoversBackend(undefined);
  for (const name of dbs.splice(0)) indexedDB.deleteDatabase(name);
});

describe('the store', () => {
  it('keeps a cover and reads every cover back', async () => {
    await writeCover(cover('a.pdf'));
    await writeCover(cover('a.pdf', 'left'));
    const all = await readCovers();
    expect(all.map((c) => c.key).sort()).toEqual(
      [
        coverKey('first', { name: 'a.pdf', size: 10 }),
        coverKey('left', { name: 'a.pdf', size: 10 }),
      ].sort(),
    );
    expect(all[0]?.bytes).toBeInstanceOf(ArrayBuffer);
  });

  it('skips a damaged record', async () => {
    const backend = memoryCoversBackend();
    await backend.put({ ...cover('a.pdf'), type: 'image/png' } as unknown as CoverRecord);
    await backend.put(cover('b.pdf'));
    setCoversBackend(backend);
    expect((await readCovers()).map((c) => c.key)).toEqual([
      coverKey('first', { name: 'b.pdf', size: 10 }),
    ]);
  });

  it('keeps at most 24 covers, the newest', async () => {
    for (let i = 0; i < COVERS_LIMIT + 3; i += 1)
      await writeCover(cover(`f${i}.pdf`, 'first', i + 1));
    const all = await readCovers();
    expect(all).toHaveLength(COVERS_LIMIT);
    expect(all.some((c) => c.at <= 3)).toBe(false);
  });

  it('sweeps the covers of files no entry names', async () => {
    await writeCover(cover('a.pdf'));
    await writeCover(cover('a.pdf', 'left'));
    await writeCover(cover('b.pdf'));
    await sweepCovers([{ name: 'a.pdf', size: 10 }]);
    expect((await readCovers()).map((c) => c.key).sort()).toEqual(
      [
        coverKey('first', { name: 'a.pdf', size: 10 }),
        coverKey('left', { name: 'a.pdf', size: 10 }),
      ].sort(),
    );
    // Same name, other size: another file.
    await sweepCovers([{ name: 'a.pdf', size: 11 }]);
    expect(await readCovers()).toEqual([]);
  });

  it('clears everything', async () => {
    await writeCover(cover('a.pdf'));
    await clearCovers();
    expect(await readCovers()).toEqual([]);
  });

  it('moves to memory where IndexedDB is refused', async () => {
    setCoversBackend({
      list: () => Promise.reject(new Error('refused')),
      put: () => Promise.reject(new Error('refused')),
      remove: () => Promise.reject(new Error('refused')),
      clear: () => Promise.reject(new Error('refused')),
    });
    await writeCover(cover('a.pdf'));
    expect((await readCovers()).map((c) => c.key)).toEqual([
      coverKey('first', { name: 'a.pdf', size: 10 }),
    ]);
    await clearCovers();
    expect(await readCovers()).toEqual([]);
  });
});

describe('the sweep follows Recents', () => {
  const entry = (name: string): RecentEntry => ({ id: name, name, size: 10, openedAt: 1 });
  afterEach(() => useRecentsStore.setState({ entries: [], loaded: false }));

  it('waits for the list to load, then drops covers on Remove, Clear and the cap', async () => {
    await writeCover(cover('a.pdf'));
    await writeCover(cover('b.pdf'));
    const stop = watchCoverSweep();
    try {
      // Not loaded: an empty list must not delete anything.
      useRecentsStore.setState({ entries: [], loaded: false });
      await sweepCovers([
        { name: 'a.pdf', size: 10 },
        { name: 'b.pdf', size: 10 },
      ]);
      expect(await readCovers()).toHaveLength(2);
      useRecentsStore.setState({ entries: [entry('a.pdf'), entry('b.pdf')], loaded: true });
      await sweepCovers([
        { name: 'a.pdf', size: 10 },
        { name: 'b.pdf', size: 10 },
      ]);
      expect(await readCovers()).toHaveLength(2);
      useRecentsStore.setState({ entries: [entry('a.pdf')] });
      await sweepCovers([{ name: 'a.pdf', size: 10 }]);
      expect((await readCovers()).map((c) => c.key)).toEqual([
        coverKey('first', { name: 'a.pdf', size: 10 }),
      ]);
      useRecentsStore.setState({ entries: [] });
      await sweepCovers([]);
      expect(await readCovers()).toEqual([]);
    } finally {
      stop();
    }
  });
});

describe('which source gets a cover', () => {
  const source = (encrypted: boolean): SourceDocument =>
    ({
      id: 's1',
      name: 'a.pdf',
      byteLength: 10,
      pageCount: 1,
      pages: [{ size: { width: 100, height: 100 }, rotation: 0 }],
      fingerprint: 'x',
      flags: { encrypted },
    }) as unknown as SourceDocument;

  const sources = (s: SourceDocument) => ({ [s.id]: s }) as Parameters<typeof firstCoverSource>[0];

  it('takes a plain source by name and size', () => {
    expect(firstCoverSource(sources(source(false)), { name: 'a.pdf', size: 10 })?.id).toBe('s1');
    expect(firstCoverSource(sources(source(false)), { name: 'a.pdf', size: 11 })).toBeUndefined();
  });

  it('stores none for an encrypted source', () => {
    expect(firstCoverSource(sources(source(true)), { name: 'a.pdf', size: 10 })).toBeUndefined();
  });
});

describe('the encoded cover', () => {
  async function paper(width: number, height: number): Promise<ImageBitmap> {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d');
    context.fillStyle = '#ccd';
    context.fillRect(0, 0, width, height);
    return createImageBitmap(canvas);
  }

  it('is a JPEG that fits the box and never grows past the page', async () => {
    const big = await paper(1200, 1600);
    const first = await encodeCover(big, 1200, 1600, FIRST_BOX);
    expect(first).not.toBeNull();
    expect(first?.width).toBeLessThanOrEqual(FIRST_BOX.width);
    expect(first?.height).toBeLessThanOrEqual(FIRST_BOX.height);
    const bytes = new Uint8Array(first?.bytes ?? new ArrayBuffer(0));
    expect([...bytes.slice(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(bytes.byteLength).toBeLessThan(40 * 1024);
    const left = await encodeCover(big, 1200, 1600, LEFT_BOX);
    expect(left?.width).toBeLessThanOrEqual(LEFT_BOX.width);
    const small = await paper(100, 150);
    const same = await encodeCover(small, 100, 150, FIRST_BOX);
    expect(same).toMatchObject({ width: 100, height: 150 });
  });
});

describe('skipping a current cover', () => {
  it('skips only when the cover is newer than the file', () => {
    expect(coverIsCurrent(200, 100)).toBe(true);
    expect(coverIsCurrent(100, 200)).toBe(false);
    expect(coverIsCurrent(undefined, 100)).toBe(false);
    expect(coverIsCurrent(200, undefined)).toBe(false);
  });
});
