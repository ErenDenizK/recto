import { describe, expect, it } from 'vitest';
import { canUndo, createHistory, pushHistory, redo, undo } from '../history';
import { rotatePages, setPageOverlays } from '../pages';
import {
  DEFAULT_HISTORY_TAIL,
  deserializeHistoryTail,
  type SerializedHistoryV1,
  serializeHistoryTail,
  serializeWorkspace,
} from '../serialize';
import type { BlobId, DocumentId, EngineEdit, History, SourceId, Workspace } from '../types';
import { closeDocument } from '../workspace';
import { expectCode, must, open, pageIds } from './fixtures';

/** A history of `steps` rotations of page `i % pages` of a `pages`-page document. */
function rotations(steps: number, pages = 6): { history: History; doc: DocumentId } {
  const { ws, docs } = open(['A', pages], ['B', 2]);
  const doc = must(docs[0]);
  let history = createHistory(ws, 'Open', 0);
  for (let i = 0; i < steps; i++) {
    const page = must(pageIds(history.present.workspace, doc)[i % pages]);
    history = pushHistory(
      history,
      rotatePages(history.present.workspace, [page], 90),
      `Rotate ${i}`,
      {
        now: 1000 + i,
        limit: 200,
      },
    );
  }
  return { history, doc };
}

function edit(id: string, source: SourceId, blob?: string): EngineEdit {
  return {
    id,
    source,
    pageIndex: 0,
    kind: 'annotation.create',
    payload: { annotation: { id, ...(blob ? { image: { type: 'image/png', blob } } : {}) } },
    inverse: { id: `${id}-inv`, source, pageIndex: 0, kind: 'annotation.delete', payload: null },
  };
}

const viaJson = (value: SerializedHistoryV1): unknown => JSON.parse(JSON.stringify(value));

describe('serializeHistoryTail / deserializeHistoryTail', () => {
  it('round-trips a short history through JSON text', () => {
    const { history } = rotations(5);
    const restored = deserializeHistoryTail(JSON.stringify(serializeHistoryTail(history)));
    expect(restored.past).toHaveLength(5);
    expect(restored.future).toHaveLength(0);
    expect(restored.present.label).toBe('Rotate 4');
    expect(restored.present.at).toBe(1004);
    const entries = (h: History) => [...h.past, h.present, ...h.future];
    for (const [i, entry] of entries(restored).entries()) {
      const original = must(entries(history)[i]);
      expect(entry.label).toBe(original.label);
      expect(serializeWorkspace(entry.workspace)).toEqual(serializeWorkspace(original.workspace));
    }
  });

  it('keeps the newest 20 undo steps of a 200-step history, and Undo walks all 20', () => {
    const { history } = rotations(200);
    expect(history.past).toHaveLength(200);
    let restored = deserializeHistoryTail(viaJson(serializeHistoryTail(history)));
    expect(restored.past).toHaveLength(DEFAULT_HISTORY_TAIL);
    expect(restored.past[0]?.label).toBe('Rotate 179');
    for (let i = 0; i < DEFAULT_HISTORY_TAIL; i++) {
      expect(canUndo(restored)).toBe(true);
      restored = undo(restored);
    }
    expect(canUndo(restored)).toBe(false);
    expect(serializeWorkspace(restored.present.workspace)).toEqual(
      serializeWorkspace(must(history.past[180]).workspace),
    );
  });

  it('keeps redo steps after the present entry', () => {
    let { history } = rotations(4);
    history = undo(undo(history));
    const restored = deserializeHistoryTail(viaJson(serializeHistoryTail(history)));
    expect(restored.future.map((e) => e.label)).toEqual(['Rotate 2', 'Rotate 3']);
    expect(redo(restored).present.label).toBe('Rotate 2');
  });

  it('stores each shared object once and restores the sharing', () => {
    const { history } = rotations(20, 50);
    const tail = serializeHistoryTail(history);
    // 21 entries of a 50-page and a 2-page document: one copy of each page plus the 20
    // rotated ones, one copy of B, 21 versions of A.
    expect(tail.entries).toHaveLength(21);
    expect(tail.pages).toHaveLength(50 + 2 + 20);
    expect(tail.documents).toHaveLength(21 + 1);
    expect(tail.sources).toHaveLength(2);
    const restored = deserializeHistoryTail(viaJson(tail));
    const [first, second] = restored.past;
    const b = (e: typeof first) =>
      must(must(e).workspace.documents[must(e).workspace.documentOrder[1] as DocumentId]);
    expect(b(first)).toBe(b(second));
  });

  it('is far smaller than the entries written one by one', () => {
    const { history } = rotations(20, 400);
    const tail = JSON.stringify(serializeHistoryTail(history)).length;
    const naive = [...history.past.slice(-20), history.present].reduce(
      (sum, entry) => sum + JSON.stringify(serializeWorkspace(entry.workspace)).length,
      0,
    );
    // About one copy of the document plus 20 changed pages and 21 small documents.
    expect(tail).toBeLessThan(naive / 8);
    const one = JSON.stringify(serializeWorkspace(history.present.workspace)).length;
    expect(tail).toBeLessThan(one * 2.5);
  });

  it('keeps engine edits, coalesce keys, the active document and blob references', () => {
    const { ws, docs } = open(['A', 2]);
    const doc = must(docs[0]);
    const source = must(Object.keys(ws.sources)[0]) as SourceId;
    let history = createHistory(ws, 'Open', 0);
    const withEdit: Workspace = { ...ws, engineEdits: [edit('e1', source, 'edit-abc')] };
    history = pushHistory(history, withEdit, 'Stamp', { now: 5 });
    const page = must(pageIds(withEdit, doc)[0]);
    const overlaid = setPageOverlays(
      withEdit,
      [page],
      [
        {
          kind: 'image',
          layer: 'over',
          blob: 'img-1' as BlobId,
          anchor: 'center',
          offset: { x: 0, y: 0 },
          scale: 1,
          opacity: 1,
        },
      ],
    );
    history = pushHistory(history, overlaid, 'Watermark', { now: 6, coalesceKey: 'wm' });
    const restored = deserializeHistoryTail(viaJson(serializeHistoryTail(history)));
    expect(restored.present.coalesceKey).toBe('wm');
    expect(restored.present.workspace.activeDocument).toBe(ws.activeDocument);
    expect(restored.present.workspace.engineEdits).toEqual(withEdit.engineEdits);
    // The edit list of both entries holds the same restored edit object.
    expect(restored.present.workspace.engineEdits[0]).toBe(
      must(restored.past[1]).workspace.engineEdits[0],
    );
    const overlay = restored.present.workspace.documents[doc]?.pages[0]?.overlays[0];
    expect(overlay).toMatchObject({ kind: 'image', blob: 'img-1' });
  });

  it('restores entries whose tabs differ (a document closed within the tail)', () => {
    const { ws, docs } = open(['A', 2], ['B', 1]);
    let history = createHistory(ws, 'Open', 0);
    history = pushHistory(history, closeDocument(ws, must(docs[1])), 'Close B', { now: 1 });
    const restored = undo(deserializeHistoryTail(viaJson(serializeHistoryTail(history))));
    expect(restored.present.workspace.documentOrder).toEqual(docs);
  });

  it('n = 0 keeps only the present entry', () => {
    const { history } = rotations(3);
    const restored = deserializeHistoryTail(viaJson(serializeHistoryTail(history, 0)));
    expect(restored.past).toHaveLength(0);
    expect(restored.present.label).toBe('Rotate 2');
  });

  it('rejects a bad tail length', () => {
    const { history } = rotations(1);
    expectCode(() => serializeHistoryTail(history, -1), 'invalid-argument');
    expectCode(() => serializeHistoryTail(history, 1.5), 'invalid-argument');
  });

  it('rejects malformed input', () => {
    const { history } = rotations(3);
    const good = (): Record<string, unknown> =>
      viaJson(serializeHistoryTail(history)) as Record<string, unknown>;
    expectCode(() => deserializeHistoryTail('{'), 'invalid-serialized');
    expectCode(() => deserializeHistoryTail({ ...good(), version: 2 }), 'unsupported-version');
    expectCode(
      () => deserializeHistoryTail({ ...good(), kind: 'workspace' }),
      'invalid-serialized',
    );
    expectCode(() => deserializeHistoryTail({ ...good(), present: 9 }), 'invalid-serialized');
    const badIndex = good();
    const entries = badIndex.entries as { documents: number[] }[];
    must(entries[0]).documents = [99];
    expectCode(() => deserializeHistoryTail(badIndex), 'invalid-serialized');
    const badPage = good();
    (badPage.documents as { pages: unknown[] }[])[0]!.pages = [-1];
    expectCode(() => deserializeHistoryTail(badPage), 'invalid-serialized');
    // A tab whose page refers to a source missing from that entry breaks the invariants.
    const missingSource = good();
    (missingSource.entries as { sources: number[] }[])[0]!.sources = [];
    expectCode(() => deserializeHistoryTail(missingSource), 'invalid-serialized');
  });
});
