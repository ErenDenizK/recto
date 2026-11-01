/** The Text view loader (loader.ts): chunk planning, the shared style, failure, LRU, reload. */
import type { ConvertStyle, TextViewPage } from '@pdf-editor/engine';
import { describe, expect, it, vi } from 'vitest';

import { createTextViewLoader, KEPT_PAGES, planChunk } from './loader';
import type { TextSource } from './text-source';

const STYLE: ConvertStyle = { bodySize: 11, headingSizes: [20, 14] };

const pageOf = (page: number): TextViewPage => ({
  page,
  pageAnchor: `page-${page + 1}`,
  size: { width: 612, height: 792 },
  needsOcr: false,
  blocks: [],
});

/** A source whose calls are recorded; `fail` makes the next `blocks`/`style` call reject. */
function fakeSource(count: number, language?: string) {
  const calls = { style: 0, blocks: [] as { pages: readonly number[]; style: ConvertStyle }[] };
  const state = {
    failStyle: false,
    failBlocks: false,
    hold: undefined as Promise<void> | undefined,
  };
  const signals: AbortSignal[] = [];
  const dispose = vi.fn();
  const source: TextSource = {
    pageCount: count,
    language,
    pageRef: (page) => ({
      sourceId: 's' as never,
      index: page,
      delta: 0,
      frame: { size: { width: 612, height: 792 }, originX: 0, originY: 0, rotation: 0, scale: 1 },
    }),
    style(signal) {
      signals.push(signal);
      calls.style += 1;
      return state.failStyle ? Promise.reject(new Error('style')) : Promise.resolve(STYLE);
    },
    async blocks(pages, style, signal) {
      signals.push(signal);
      calls.blocks.push({ pages, style });
      await state.hold;
      if (state.failBlocks) throw new Error('blocks');
      return pages.map(pageOf);
    },
    dispose,
  };
  return { source, calls, state, signals, dispose };
}

describe('planChunk', () => {
  it('groups pages by 4, aligned', () => {
    expect(planChunk(0, 12)).toEqual([0, 1, 2, 3]);
    expect(planChunk(5, 12)).toEqual([4, 5, 6, 7]);
    expect(planChunk(11, 12)).toEqual([8, 9, 10, 11]);
  });

  it('never leaves a chunk of one page, except a 1-page document', () => {
    expect(planChunk(0, 1)).toEqual([0]);
    expect(planChunk(0, 2)).toEqual([0, 1]);
    expect(planChunk(2, 3)).toEqual([0, 1, 2]);
    expect(planChunk(4, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(planChunk(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(planChunk(8, 9)).toEqual([4, 5, 6, 7, 8]);
    expect(planChunk(6, 9)).toEqual([4, 5, 6, 7, 8]);
    expect(planChunk(0, 9)).toEqual([0, 1, 2, 3]);
    expect(planChunk(4, 6)).toEqual([4, 5]);
    expect(planChunk(-3, 6)).toEqual([0, 1, 2, 3]);
    expect(planChunk(0, 0)).toEqual([]);
  });
});

describe('loading', () => {
  it('reads a chunk with the document style, once, however it is asked', async () => {
    const { source, calls } = fakeSource(12);
    const loader = createTextViewLoader(source);
    expect(loader.peek(5)).toBe('loading');
    await Promise.all([loader.ensure(5), loader.ensure(6)]);
    await loader.ensure(4);
    expect(calls.blocks.map((c) => c.pages)).toEqual([[4, 5, 6, 7]]);
    expect(calls.blocks[0]?.style).toBe(STYLE);
    expect(loader.peek(5)).toMatchObject({ page: 5, pageAnchor: 'page-6' });
    await loader.ensure(0);
    await loader.ensure(9);
    // The style is read once for the whole document.
    expect(calls.style).toBe(1);
    expect(calls.blocks.every((c) => c.style === STYLE)).toBe(true);
    expect(loader.pageCount).toBe(12);
    loader.dispose();
  });

  it('tells subscribers when pages arrive and ignores pages outside the document', async () => {
    const { source, calls } = fakeSource(3);
    const loader = createTextViewLoader(source);
    const listener = vi.fn();
    const stop = loader.subscribe(listener);
    await loader.ensure(99);
    await loader.ensure(-1);
    expect(calls.blocks).toHaveLength(0);
    await loader.ensure(1);
    expect(listener).toHaveBeenCalled();
    stop();
    listener.mockClear();
    await loader.ensure(0);
    expect(listener).not.toHaveBeenCalled();
    loader.dispose();
  });

  it('exposes the page frame and the document language', () => {
    const { source } = fakeSource(2, 'tr-TR');
    const loader = createTextViewLoader(source);
    expect(loader.language).toBe('tr-TR');
    expect(loader.frame(1).size).toEqual({ width: 612, height: 792 });
  });
});

describe('failure', () => {
  it('marks the chunk failed and reads it again on retry', async () => {
    const { source, state, calls } = fakeSource(8);
    const loader = createTextViewLoader(source);
    state.failBlocks = true;
    await loader.ensure(1);
    expect(loader.peek(0)).toBe('failed');
    expect(loader.peek(3)).toBe('failed');
    expect(loader.peek(4)).toBe('loading');
    state.failBlocks = false;
    await loader.retry(1);
    expect(loader.peek(2)).toMatchObject({ page: 2 });
    expect(calls.blocks).toHaveLength(2);
    loader.dispose();
  });

  it('reads the style again after it failed', async () => {
    const { source, state, calls } = fakeSource(4);
    const loader = createTextViewLoader(source);
    state.failStyle = true;
    await loader.ensure(0);
    expect(loader.peek(0)).toBe('failed');
    expect(calls.blocks).toHaveLength(0);
    state.failStyle = false;
    await loader.retry(0);
    expect(calls.style).toBe(2);
    expect(loader.peek(0)).toMatchObject({ page: 0 });
    loader.dispose();
  });
});

describe('keeping pages', () => {
  it('keeps at most 120 pages, the least recently asked for going first', async () => {
    const { source } = fakeSource(400);
    const loader = createTextViewLoader(source);
    for (let page = 0; page < 400; page += 4) await loader.ensure(page);
    const loaded = Array.from({ length: 400 }, (_, i) => loader.peek(i)).filter(
      (state) => typeof state === 'object',
    );
    expect(loaded).toHaveLength(KEPT_PAGES);
    expect(loader.peek(0)).toBe('loading');
    expect(loader.peek(399)).toMatchObject({ page: 399 });
    loader.dispose();
  });

  it('asking for a page again keeps it', async () => {
    const { source } = fakeSource(400);
    const loader = createTextViewLoader(source);
    await loader.ensure(0);
    for (let page = 4; page < 400; page += 4) {
      await loader.ensure(0);
      await loader.ensure(page);
    }
    expect(loader.peek(0)).toMatchObject({ page: 0 });
    expect(loader.peek(4)).toBe('loading');
    loader.dispose();
  });

  it('forgets invalidated pages and reads them again', async () => {
    const { source, calls } = fakeSource(8);
    const loader = createTextViewLoader(source);
    await loader.ensure(0);
    loader.invalidate([1]);
    expect(loader.peek(1)).toBe('loading');
    expect(loader.peek(0)).toMatchObject({ page: 0 });
    await loader.ensure(1);
    expect(calls.blocks.map((c) => c.pages)).toEqual([
      [0, 1, 2, 3],
      [0, 1, 2, 3],
    ]);
    loader.dispose();
  });

  it('reads a chunk again when its pages were invalidated while it ran', async () => {
    const { source, state, calls } = fakeSource(4);
    const loader = createTextViewLoader(source);
    let release: () => void = () => undefined;
    state.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const asked = loader.ensure(0);
    await Promise.resolve();
    loader.invalidate([2]);
    release();
    await asked;
    expect(calls.blocks).toHaveLength(2);
    expect(loader.peek(2)).toMatchObject({ page: 2 });
    loader.dispose();
  });
});

describe('a changed document and leaving', () => {
  it('drops everything, opens the tab again and takes its new page count', async () => {
    const first = fakeSource(8);
    const next = fakeSource(5);
    let change: () => void = () => undefined;
    const loader = createTextViewLoader(first.source, {
      reopen: () => Promise.resolve(next.source),
      watch: (onChange) => {
        change = onChange;
        return () => undefined;
      },
    });
    await loader.ensure(0);
    const listener = vi.fn();
    loader.subscribe(listener);
    change();
    expect(first.signals.every((s) => s.aborted)).toBe(true);
    expect(loader.peek(0)).toBe('loading');
    await loader.ensure(0);
    expect(first.dispose).toHaveBeenCalled();
    expect(loader.pageCount).toBe(5);
    expect(next.calls.blocks.map((c) => c.pages)).toEqual([[0, 1, 2, 3, 4]]);
    expect(loader.peek(4)).toMatchObject({ page: 4 });
    expect(listener).toHaveBeenCalled();
    loader.dispose();
  });

  it('aborts what is in flight, releases the source and answers nothing after', async () => {
    const { source, state, signals, dispose, calls } = fakeSource(8);
    const stop = vi.fn();
    const loader = createTextViewLoader(source, { watch: () => stop });
    state.hold = new Promise(() => undefined);
    void loader.ensure(0);
    await Promise.resolve();
    await Promise.resolve();
    loader.dispose();
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((s) => s.aborted)).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    await loader.ensure(4);
    expect(calls.blocks).toHaveLength(1);
    loader.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
