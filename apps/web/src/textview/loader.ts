/**
 * The Text view's loader (`TextViewLoader`, PRD-35, EDN-26): reads the document in aligned
 * chunks of 4 pages (never fewer than 2; a 1-page document is 1), always with the whole
 * document's style (`textStyle`, read once), keeps at most 120 pages (least recently asked
 * out first) and tells subscribers when a page's state changes.
 *
 * - A chunk is asked for once at a time; a second `ensure` for it waits for the first.
 * - A page that fails is `'failed'` until `retry`; the style or the source failing fails the
 *   chunk the same way and is read again on `retry`.
 * - A change to the document (an edit, a page moved, OCR: `watch` calls `reload`) drops
 *   everything, opens the tab again and notifies; chunks in flight are aborted.
 *   `invalidate(pages)` drops some pages; a chunk in flight over them is read again.
 * - `dispose` aborts what is in flight and releases the source (and with it the analysis lease).
 */
import type { ConvertStyle, TextViewPage } from '@pdf-editor/engine';

import type { TextViewLoader, TextViewPageState } from './contract';
import type { PageRef, TextSource } from './text-source';

/** Pages per chunk (EDN-26). */
export const CHUNK_PAGES = 4;
/** Pages kept; the least recently asked for go first (EDN-26). */
export const KEPT_PAGES = 120;

/**
 * The pages read together with `page`: the aligned group of `CHUNK_PAGES` holding it, or, when
 * a single page would be left over at the end, that page joins the group before it.
 */
export function planChunk(page: number, count: number): number[] {
  if (count <= 0) return [];
  const lastStart = count - 1;
  const loneTail = count > 1 && count % CHUNK_PAGES === 1;
  const at = Math.min(Math.max(0, page), lastStart);
  const index = loneTail && at === lastStart ? at - 1 : at;
  const start = Math.floor(index / CHUNK_PAGES) * CHUNK_PAGES;
  let end = Math.min(count, start + CHUNK_PAGES);
  if (loneTail && end === lastStart) end = count;
  return Array.from({ length: end - start }, (_, i) => start + i);
}

export interface DocumentTextLoader extends TextViewLoader {
  /** The page as the engine has it open (for crops). */
  pageRef(page: number): PageRef;
}

export interface LoaderOptions {
  /** Opens the tab again after a change (`reload`). */
  readonly reopen?: () => Promise<TextSource>;
  /** Calls `onChange` when the document changes; returns the stop function. */
  readonly watch?: (onChange: () => void) => () => void;
}

interface Chunk {
  readonly pages: readonly number[];
  done: Promise<void>;
  /** Pages were invalidated while it ran: its result is read again. */
  stale: boolean;
}

export function createTextViewLoader(
  first: TextSource,
  options: LoaderOptions = {},
): DocumentTextLoader {
  let source = first;
  let reopening: Promise<void> | undefined;
  let generation = 0;
  let control = new AbortController();
  let style: Promise<ConvertStyle> | undefined;
  let disposed = false;
  const pages = new Map<number, TextViewPage>();
  const failed = new Set<number>();
  const inflight = new Map<number, Chunk>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const keep = (page: TextViewPage) => {
    pages.delete(page.page);
    pages.set(page.page, page);
    while (pages.size > KEPT_PAGES) {
      const oldest = pages.keys().next().value;
      if (oldest === undefined) break;
      pages.delete(oldest);
    }
  };

  async function read(chunk: readonly number[], gen: number): Promise<boolean> {
    try {
      const signal = control.signal;
      const active = source;
      style ??= active.style(signal);
      const result = await active.blocks(chunk, await style, signal);
      if (gen !== generation || disposed) return false;
      const byPage = new Map(result.map((page) => [page.page, page]));
      for (const index of chunk) {
        const page = byPage.get(index);
        if (page) {
          keep(page);
          failed.delete(index);
        } else failed.add(index);
      }
      return true;
    } catch {
      if (gen !== generation || disposed) return false;
      // The style may be what failed: read it again next time.
      style = undefined;
      for (const index of chunk) failed.add(index);
      return true;
    }
  }

  function start(chunk: readonly number[]): Chunk {
    const gen = generation;
    for (const index of chunk) failed.delete(index);
    notify();
    const record: Chunk = { pages: chunk, stale: false, done: Promise.resolve() };
    record.done = (async () => {
      try {
        for (;;) {
          record.stale = false;
          const settled = await read(chunk, gen);
          if (!settled) return;
          if (!record.stale) break;
        }
        notify();
      } finally {
        for (const index of chunk) if (inflight.get(index) === record) inflight.delete(index);
      }
    })();
    for (const index of chunk) inflight.set(index, record);
    return record;
  }

  async function ensure(page: number): Promise<void> {
    if (disposed) return;
    if (reopening) await reopening;
    if (disposed || page < 0 || page >= source.pageCount) return;
    const chunk = planChunk(page, source.pageCount);
    const running = inflight.get(page);
    if (running) return running.done;
    if (chunk.every((index) => pages.has(index))) {
      // Asked for again: these are the ones to keep.
      for (const index of chunk) {
        const kept = pages.get(index);
        if (kept) keep(kept);
      }
      return;
    }
    return start(chunk).done;
  }

  function reload() {
    if (disposed) return;
    generation += 1;
    control.abort();
    control = new AbortController();
    style = undefined;
    pages.clear();
    failed.clear();
    inflight.clear();
    const reopen = options.reopen;
    if (!reopen) {
      notify();
      return;
    }
    const gen = generation;
    const opening = reopen().then(
      (next) => {
        if (gen !== generation || disposed) {
          next.dispose();
          return;
        }
        const old = source;
        source = next;
        old.dispose();
        notify();
      },
      () => {
        // Keep the old source; its pages read again when asked.
        if (gen === generation) notify();
      },
    );
    reopening = opening.finally(() => {
      if (reopening === opening) reopening = undefined;
    });
    notify();
  }

  const unwatch = options.watch?.(reload);

  return {
    get pageCount() {
      return source.pageCount;
    },
    get language() {
      return source.language;
    },
    frame: (page) => source.pageRef(page).frame,
    pageRef: (page) => source.pageRef(page),
    ensure,
    peek(page): TextViewPageState {
      return pages.get(page) ?? (failed.has(page) ? 'failed' : 'loading');
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    retry(page) {
      for (const index of planChunk(page, source.pageCount)) failed.delete(index);
      return ensure(page);
    },
    invalidate(invalid) {
      if (disposed) return;
      for (const index of invalid) {
        pages.delete(index);
        failed.delete(index);
        const running = inflight.get(index);
        if (running) running.stale = true;
      }
      notify();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      unwatch?.();
      control.abort();
      listeners.clear();
      source.dispose();
    },
  };
}
