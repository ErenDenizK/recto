/**
 * What the session hands the desk (DSN-87): a kept document's place on its Recents row, and the
 * privacy Clear taking the covers with it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { memoryRecentsBackend, setRecentsBackend, useRecentsStore } from '../files/recents';
import {
  clearCovers,
  coverKey,
  memoryCoversBackend,
  readCovers,
  setCoversBackend,
  writeCover,
} from '../home/covers';
import { attachKept, clearKeptChanges, setSessionEnabled, startSession } from './session';
import type { KeptRecordV1 } from './format';

beforeEach(() => {
  setRecentsBackend(memoryRecentsBackend());
  setCoversBackend(memoryCoversBackend());
});

const record = (page: number, resume?: { zoom: number; fit: 'width' | null; offset: number }) =>
  ({
    format: 1,
    kind: 'kept',
    id: 'kept-p1',
    keptAt: Date.now(),
    title: 'p',
    name: 'p.pdf',
    size: 42,
    pages: 8,
    place: { id: 'd1', page, changed: false, ...(resume ? { resume } : {}) },
    sources: [],
    blobs: [],
  }) as unknown as KeptRecordV1;

describe('attachKept', () => {
  it('writes the place with the kept snapshot', async () => {
    attachKept(record(3, { zoom: 1.5, fit: 'width', offset: -4 }));
    await expect
      .poll(() => useRecentsStore.getState().entries[0]?.place)
      .toMatchObject({ page: 3, total: 8, zoom: 1.5, fit: 'width', offset: -4 });
  });

  it('keeps the page alone when no view detail was kept, and clamps a page past the end', async () => {
    attachKept(record(99));
    await expect
      .poll(() => useRecentsStore.getState().entries[0]?.place)
      .toEqual(expect.objectContaining({ page: 7, total: 8 }));
    expect(useRecentsStore.getState().entries[0]?.place?.zoom).toBeUndefined();
  });
});

describe('clearKeptChanges', () => {
  it('clears the covers and says so', async () => {
    await writeCover({
      key: coverKey('first', { name: 'a.pdf', size: 1 }),
      kind: 'first',
      page: 0,
      width: 1,
      height: 1,
      type: 'image/jpeg',
      bytes: new ArrayBuffer(3),
      at: 1,
    });
    expect(await readCovers()).toHaveLength(1);
    expect(await clearKeptChanges()).toBe(true);
    expect(await readCovers()).toEqual([]);
  });

  it('reports false when the covers could not be cleared', async () => {
    const memory = memoryCoversBackend();
    setCoversBackend({ ...memory, clear: () => Promise.reject(new Error('locked')) });
    await clearCovers();
    expect(await clearKeptChanges()).toBe(false);
  });
});

describe('the phone session, with no file opened', () => {
  const entry = (name: string) => ({ id: name, name, size: 10, openedAt: 1 });
  const put = (name: string) =>
    writeCover({
      key: coverKey('first', { name, size: 10 }),
      kind: 'first',
      page: 0,
      width: 1,
      height: 1,
      type: 'image/jpeg',
      bytes: new ArrayBuffer(3),
      at: 1,
    });

  beforeEach(() => setSessionEnabled(true));
  afterEach(() => setSessionEnabled(false));

  it('sweeps the covers when Recents shrinks or is cleared', async () => {
    await put('a.pdf');
    await put('b.pdf');
    useRecentsStore.setState({ entries: [entry('a.pdf'), entry('b.pdf')], loaded: true });
    const stop = startSession({ edition: 'compact', tabId: 'tab-phone-sweep' });
    try {
      useRecentsStore.setState({ entries: [entry('a.pdf')] });
      await vi.waitFor(
        async () =>
          expect((await readCovers()).map((c) => c.key)).toEqual([
            coverKey('first', { name: 'a.pdf', size: 10 }),
          ]),
        { timeout: 10_000 },
      );
      useRecentsStore.setState({ entries: [] });
      await vi.waitFor(async () => expect(await readCovers()).toEqual([]), { timeout: 10_000 });
    } finally {
      stop();
      useRecentsStore.setState({ entries: [], loaded: false });
    }
  });
});
