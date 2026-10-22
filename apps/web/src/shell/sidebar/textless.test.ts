/**
 * The textless-page facts step aside for Find (DSN-61): they start only when no search runs,
 * read a few pages per request, wait while a search runs, and stop for a changed document.
 */
import type {
  DocumentId,
  PageId,
  SourceId,
  VirtualDocument,
  VirtualPage,
} from '@pdf-editor/document-model';
import type { OcrPageFacts } from '@pdf-editor/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type OcrDependencies, setOcrDependencies } from '../../ocr/ocr-deps';
import { useWorkspaceStore } from '../../state/workspace-store';
import { clearSearch, useSearchStore } from '../../viewer/search';
import { textlessPages } from './textless';

const SRC = 'src-t' as SourceId;
const PAGES = 45;

function doc(id: string): VirtualDocument {
  const pages: VirtualPage[] = Array.from({ length: PAGES }, (_, index) => ({
    id: `${id}-p${index}` as PageId,
    ref: { kind: 'source', source: SRC, index },
    rotation: 0,
    overlays: [],
  }));
  return { id: id as DocumentId, title: id, pages, outline: [], labels: [] } as never;
}

const scan: OcrPageFacts = { visibleText: false, invisibleText: 'none' } as OcrPageFacts;

function activate(id: string | undefined): void {
  useWorkspaceStore.setState((s) => {
    const { activeDocument: _previous, ...rest } = s.workspace;
    return { workspace: id === undefined ? rest : { ...rest, activeDocument: id as DocumentId } };
  });
}

function setStatus(status: 'idle' | 'searching' | 'done', query = 'x'): void {
  useSearchStore.setState({ status, query });
}

let calls: { from: number; count: number }[];
let release: (() => void)[];

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  release = [];
  const deps: OcrDependencies = {
    facts: (_source, range) => {
      calls.push({ from: range?.from ?? 0, count: range?.count ?? PAGES });
      return new Promise((resolve) => {
        release.push(() => resolve(Array.from({ length: range?.count ?? PAGES }, () => scan)));
      });
    },
    packs: () => Promise.reject(new Error('unused')),
    engineFiles: () => Promise.resolve([]),
  };
  setOcrDependencies(deps);
});

afterEach(() => {
  setOcrDependencies(undefined);
  clearSearch();
  activate(undefined);
  vi.useRealTimers();
});

/** Lets the walk's timers and promise chains run to their next wait. */
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('textlessPages', () => {
  it('does not start while a search runs, nor when typing keeps restarting it', async () => {
    activate('a');
    setStatus('idle', '');
    const result = textlessPages(doc('a'));
    await tick(900);
    // A new query restarts the calm period.
    setStatus('idle', 'th');
    await tick(900);
    expect(calls).toEqual([]);
    setStatus('searching', 'th');
    await tick(5000);
    expect(calls).toEqual([]);
    setStatus('done', 'th');
    await tick(1000);
    expect(calls).toEqual([{ from: 0, count: 20 }]);
    release.shift()?.();
    await tick(0);
    release.shift()?.();
    await tick(0);
    release.shift()?.();
    expect(await result).toEqual({
      pages: Array.from({ length: PAGES }, (_, i) => i),
      targets: PAGES,
    });
    expect(calls.map((c) => c.from)).toEqual([0, 20, 40]);
  });

  it('reads an idle query as calm, and pauses between chunks for a search', async () => {
    activate('b');
    setStatus('idle', 'typed');
    const result = textlessPages(doc('b'));
    await tick(1000);
    expect(calls).toHaveLength(1);
    release.shift()?.();
    await tick(0);
    // The second chunk is under way when a search starts: it ends, the third waits.
    expect(calls).toHaveLength(2);
    setStatus('searching');
    release.shift()?.();
    await tick(10_000);
    expect(calls).toHaveLength(2);
    setStatus('done');
    await tick(0);
    expect(calls).toHaveLength(3);
    release.shift()?.();
    expect((await result).targets).toBe(PAGES);
  });

  it('stops for a document that is no longer active and keeps nothing cached', async () => {
    activate('c');
    setStatus('idle', '');
    const first = textlessPages(doc('c'));
    await tick(1000);
    expect(calls).toHaveLength(1);
    activate('other');
    release.shift()?.();
    await tick(0);
    expect(await first).toEqual({ pages: [], targets: PAGES });
    expect(calls).toHaveLength(1);
    // Active again: a new read starts (the stopped one left no cache entry).
    activate('c');
    void textlessPages(doc('c'));
    await tick(1000);
    expect(calls).toHaveLength(2);
  });
});
