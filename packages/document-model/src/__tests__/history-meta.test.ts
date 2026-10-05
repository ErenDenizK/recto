/**
 * `HistoryEntry.meta` (spec redesign §7, X10; 08-feedback FB7): carried by `pushHistory`,
 * listed by `historyEntries`, and derived from a change by `historyMetaOf`.
 */
import { describe, expect, it } from 'vitest';
import {
  createHistory,
  historyEntries,
  historyMetaOf,
  jumpTo,
  pushHistory,
  redo,
  undo,
} from '../history';
import { deletePages, duplicatePages, mergeDocuments, movePages, rotatePages } from '../pages';
import type { EngineEdit, HistoryEntryMeta, SourceId, Workspace } from '../types';
import { addSource, closeDocument, renameDocument, setActiveDocument } from '../workspace';
import { must, open, pageIds, sourceInput } from './fixtures';

function edit(id: string, source: SourceId, pageIndex: number, kind: EngineEdit['kind']) {
  return { id, source, pageIndex, kind, payload: null } satisfies EngineEdit;
}

const sourceOf = (ws: Workspace, i = 0) => must(Object.keys(ws.sources)[i]) as SourceId;

describe('pushHistory with meta', () => {
  const { ws, docs } = open(['A', 3]);
  const doc = must(docs[0]);
  const page = must(pageIds(ws, doc)[1]);
  const meta: HistoryEntryMeta = { documentId: doc, page: 2, kind: 'page' };

  it('keeps meta on the entry and lists it', () => {
    let h = createHistory(ws, 'Open', 0);
    h = pushHistory(h, rotatePages(ws, [page], 90), 'Rotate', { now: 1, meta });
    expect(h.present.meta).toEqual(meta);
    const items = historyEntries(h);
    expect(items[0]?.meta).toBeUndefined();
    expect(items[1]?.meta).toEqual(meta);
  });

  it('travels with its entry through undo, redo and jumps', () => {
    let h = createHistory(ws, 'Open', 0);
    h = pushHistory(h, rotatePages(ws, [page], 90), 'Rotate', { now: 1, meta });
    h = pushHistory(h, rotatePages(h.present.workspace, [page], 90), 'Rotate again', { now: 2 });
    expect(undo(h).future[0]?.meta).toBeUndefined();
    expect(undo(h).present.meta).toEqual(meta);
    expect(redo(undo(h)).past[1]?.meta).toEqual(meta);
    expect(jumpTo(h, 0).future[0]?.meta).toEqual(meta);
  });

  it('a coalesced push takes the newer meta', () => {
    let h = createHistory(ws, 'Open', 0);
    const w1 = rotatePages(ws, [page], 90);
    h = pushHistory(h, w1, 'Rotate', { now: 1, coalesceKey: 'r', meta });
    const later: HistoryEntryMeta = { ...meta, page: 3 };
    h = pushHistory(h, rotatePages(w1, [page], 90), 'Rotate', {
      now: 2,
      coalesceKey: 'r',
      meta: later,
    });
    expect(h.past).toHaveLength(1);
    expect(h.present.meta).toEqual(later);
  });

  it('adds no meta property when none is given', () => {
    const h = pushHistory(createHistory(ws), rotatePages(ws, [page], 90), 'Rotate', { now: 1 });
    expect('meta' in h.present).toBe(false);
  });
});

describe('historyMetaOf', () => {
  it('names the document and page of a content edit, in the active document first', () => {
    const { ws, ids, docs } = open(['A', 3], ['B', 1]);
    const [a, b] = [must(docs[0]), must(docs[1])];
    // A's third page also shown by B (a duplicate keeps its source page), and B active.
    const copied = duplicatePages(ws, [must(pageIds(ws, a)[2])], ids, {
      target: { document: b, index: 1 },
    });
    const active = setActiveDocument(copied, b);
    const after = { ...active, engineEdits: [edit('e1', sourceOf(ws), 2, 'annotation.create')] };
    expect(historyMetaOf(active, after)).toEqual({
      documentId: b,
      page: 2,
      kind: 'annotation.create',
    });
    const inA = setActiveDocument(copied, a);
    expect(historyMetaOf(inA, { ...inA, engineEdits: after.engineEdits })).toMatchObject({
      documentId: a,
      page: 3,
    });
  });

  it('follows a moved page to where it is shown now', () => {
    const { ws, docs } = open(['A', 3]);
    const a = must(docs[0]);
    const p3 = must(pageIds(ws, a)[2]);
    const moved = movePages(ws, { pageIds: [p3], target: { document: a, index: 0 } });
    expect(pageIds(moved, a)[0]).toBe(p3);
    const after = { ...moved, engineEdits: [edit('e1', sourceOf(ws), 2, 'form.set-value')] };
    expect(historyMetaOf(moved, after)).toMatchObject({ documentId: a, page: 1 });
  });

  it('describes a merged (coalesced) edit by its replacement', () => {
    const { ws } = open(['A', 2]);
    const source = sourceOf(ws);
    const one = { ...ws, engineEdits: [edit('e1', source, 0, 'annotation.update')] };
    const merged = { ...ws, engineEdits: [edit('e1b', source, 1, 'annotation.update')] };
    expect(historyMetaOf(one, merged)).toMatchObject({ page: 2, kind: 'annotation.update' });
  });

  it('opening, closing and renaming', () => {
    const { ws, ids, docs } = open(['A', 2]);
    const a = must(docs[0]);
    const opened = addSource(ws, sourceInput('B', 4), ids);
    expect(historyMetaOf(ws, opened.workspace)).toEqual({
      documentId: opened.documentId,
      kind: 'open',
    });
    expect(historyMetaOf(opened.workspace, closeDocument(opened.workspace, a))).toEqual({
      documentId: a,
      kind: 'close',
    });
    expect(historyMetaOf(ws, renameDocument(ws, a, 'Renamed'))).toEqual({
      documentId: a,
      kind: 'document',
    });
  });

  it('page changes in place and page-list changes', () => {
    const { ws, ids, docs } = open(['A', 4]);
    const a = must(docs[0]);
    const [, p2, p3, p4] = pageIds(ws, a);
    expect(historyMetaOf(ws, rotatePages(ws, [must(p3)], 90))).toEqual({
      documentId: a,
      page: 3,
      kind: 'page',
    });
    expect(historyMetaOf(ws, deletePages(ws, [must(p2)]))).toEqual({
      documentId: a,
      page: 2,
      kind: 'pages',
    });
    // Deleting the last page points at the page that is last now.
    expect(historyMetaOf(ws, deletePages(ws, [must(p4)]))).toEqual({
      documentId: a,
      page: 3,
      kind: 'pages',
    });
    expect(historyMetaOf(ws, duplicatePages(ws, [must(p3)], ids))).toMatchObject({
      documentId: a,
      page: 4,
      kind: 'pages',
    });
  });

  it('a change of several documents names none; no change says nothing', () => {
    const { ws, ids, docs } = open(['A', 2], ['B', 2]);
    const merged = mergeDocuments(ws, { documentIds: docs, title: 'Both' }, ids);
    expect(historyMetaOf(ws, merged)).toEqual({ kind: 'workspace' });
    expect(historyMetaOf(ws, ws)).toEqual({});
    expect(historyMetaOf(ws, setActiveDocument(ws, must(docs[1])))).toEqual({});
  });
});
