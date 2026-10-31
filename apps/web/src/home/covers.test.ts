/**
 * The cover store (DSN-87): write and read in one transaction, the orphan sweep, Clear, the
 * 24-record cap, the memory fallback where IndexedDB is refused, and the JPEG a capture
 * encodes. Real IndexedDB (browser mode), a database of its own per test.
 */
import type { DocumentId, SourceDocument } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  leftTarget,
  watchPlaces,
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

  it('moves to memory only when the database itself is refused', async () => {
    const refused = (): Promise<never> => Promise.reject(new Error('refused'));
    setCoversBackend({
      open: refused,
      list: refused,
      put: refused,
      remove: refused,
      clear: refused,
    });
    await writeCover(cover('a.pdf'));
    expect((await readCovers()).map((c) => c.key)).toEqual([
      coverKey('first', { name: 'a.pdf', size: 10 }),
    ]);
    expect(await clearCovers()).toBe(true);
    expect(await readCovers()).toEqual([]);
  });

  it('skips a failed put and still clears what is stored', async () => {
    const real = indexedDbCoversBackend(indexedDB, freshDb());
    let failPuts = false;
    setCoversBackend({
      ...real,
      put: (record) => (failPuts ? Promise.reject(new Error('quota')) : real.put(record)),
    });
    await writeCover(cover('a.pdf'));
    failPuts = true;
    await writeCover(cover('b.pdf'));
    expect(await readCovers()).toHaveLength(1);
    expect(await clearCovers()).toBe(true);
    expect(await readCovers()).toEqual([]);
  });

  it('reports a Clear that failed', async () => {
    const real = memoryCoversBackend();
    setCoversBackend({ ...real, clear: () => Promise.reject(new Error('locked')) });
    expect(await clearCovers()).toBe(false);
  });

  it('settles a read whose transaction throws', async () => {
    const real = indexedDbCoversBackend(indexedDB, freshDb());
    setCoversBackend({ ...real, list: () => Promise.reject(new Error('throws')) });
    expect(await readCovers()).toEqual([]);
  });

  it('gives no cover to a file that left Recents', async () => {
    useRecentsStore.setState({ entries: [], loaded: true });
    await writeCover(cover('gone.pdf'));
    useRecentsStore.setState({ entries: [], loaded: false });
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
      await new Promise((r) => setTimeout(r, 50));
      expect(await readCovers()).toHaveLength(2);
      useRecentsStore.setState({ entries: [entry('a.pdf'), entry('b.pdf')], loaded: true });
      await vi.waitFor(async () => expect(await readCovers()).toHaveLength(2));
      useRecentsStore.setState({ entries: [entry('a.pdf')] });
      await vi.waitFor(async () =>
        expect((await readCovers()).map((c) => c.key)).toEqual([
          coverKey('first', { name: 'a.pdf', size: 10 }),
        ]),
      );
      useRecentsStore.setState({ entries: [] });
      await vi.waitFor(async () => expect(await readCovers()).toEqual([]));
    } finally {
      stop();
    }
  });

  it('stops sweeping when stopped', async () => {
    await writeCover(cover('a.pdf'));
    useRecentsStore.setState({ entries: [entry('a.pdf')], loaded: true });
    const stop = watchCoverSweep();
    stop();
    useRecentsStore.setState({ entries: [] });
    await new Promise((r) => setTimeout(r, 50));
    expect(await readCovers()).toHaveLength(1);
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

describe('the left cover', () => {
  const ws = (encrypted: boolean) =>
    ({
      sources: {
        s1: {
          id: 's1',
          name: 'a.pdf',
          byteLength: 10,
          pages: [
            { size: { width: 1, height: 1 }, rotation: 0 },
            { size: { width: 1, height: 1 }, rotation: 0 },
          ],
          flags: { encrypted },
        },
      },
      documents: {
        d1: {
          pages: [0, 1].map((index) => ({
            ref: { kind: 'source', source: 's1', index },
            rotation: 0,
          })),
        },
      },
    }) as unknown as Parameters<typeof leftTarget>[0];
  const doc = 'd1' as unknown as Parameters<typeof leftTarget>[1];

  it('takes a page past the first of a plain source', () => {
    expect(leftTarget(ws(false), doc, 1)?.index).toBe(1);
    expect(leftTarget(ws(false), doc, 0)).toBeUndefined();
  });

  it('stores none for an encrypted source', () => {
    expect(leftTarget(ws(true), doc, 1)).toBeUndefined();
  });
});

describe('the place write', () => {
  const file = { name: 'p.pdf', size: 7 };
  const id = 'd1' as unknown as DocumentId;

  beforeEach(async () => {
    const { setRecentsBackend, memoryRecentsBackend, recordRecent } = await import(
      '../files/recents'
    );
    setRecentsBackend(memoryRecentsBackend());
    await recordRecent({ ...file, now: 1 });
    const { resetResumeStore } = await import('../session/resume');
    resetResumeStore();
  });
  afterEach(() => vi.useRealTimers());

  const point = (page: number) => ({
    page,
    total: 9,
    zoom: 1,
    fit: null,
    offset: 0,
    at: 5,
  });
  const placeOf = () => useRecentsStore.getState().entries.find((e) => e.name === file.name)?.place;

  it('writes two seconds after the last change', async () => {
    vi.useFakeTimers();
    const { setResume } = await import('../session/resume');
    const stop = watchPlaces(() => file);
    setResume(id, point(2));
    await vi.advanceTimersByTimeAsync(1900);
    expect(placeOf()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    expect(placeOf()?.page).toBe(2);
    stop();
  });

  it('keeps the place of a document closed within the delay', async () => {
    vi.useFakeTimers();
    const { setResume } = await import('../session/resume');
    // The file is named when the point is queued; the document is gone by the time it fires.
    let open = true;
    const stop = watchPlaces(() => (open ? file : undefined));
    setResume(id, point(4));
    open = false;
    stop();
    await vi.advanceTimersByTimeAsync(0);
    expect(placeOf()?.page).toBe(4);
  });
});
