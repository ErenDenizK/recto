/**
 * The selectors behind Lock's engine-edit check (redesign spec §7, X11): which source pages a
 * document shows, and which documents share a source page after Combine with kept sources.
 */
import { describe, expect, it } from 'vitest';

import { deletePages, mergeDocuments } from '../pages';
import { documentsSharingSource, sourcePagesShownBy } from '../selectors';
import type { SourceId } from '../types';
import { check, must, open, pageIds } from './fixtures';

describe('shared source pages (X11)', () => {
  it('lists the source pages a document shows, per source', () => {
    const { ws, docs } = open(['A', 3], ['B', 2]);
    const a = must(docs[0]);
    const source = Object.keys(ws.sources)[0] as SourceId;
    const shown = sourcePagesShownBy(ws, a);
    expect([...shown.keys()]).toEqual([source]);
    expect([...must(shown.get(source))]).toEqual([0, 1, 2]);
    // Memoized on the document object.
    expect(sourcePagesShownBy(ws, a)).toBe(shown);
    expect(sourcePagesShownBy(ws, 'missing' as never).size).toBe(0);
  });

  it('finds every document that shows a source page, in tab order', () => {
    const { ws, docs, ids } = open(['A', 3], ['B', 2]);
    const [a, b] = [must(docs[0]), must(docs[1])];
    const [sourceA] = Object.keys(ws.sources) as SourceId[];
    const merged = check(
      mergeDocuments(ws, { documentIds: [a, b], title: 'Combined', keepSources: true }, ids),
    );
    const combined = must(merged.documentOrder.find((id) => id !== a && id !== b));
    expect(documentsSharingSource(merged, must(sourceA), 1)).toEqual([a, combined]);
    expect(documentsSharingSource(merged, must(sourceA))).toEqual([a, combined]);
    // A page the combine dropped is shown by the input only.
    const trimmed = check(deletePages(merged, [must(pageIds(merged, combined)[2])]));
    expect(documentsSharingSource(trimmed, must(sourceA), 2)).toEqual([a]);
    expect(documentsSharingSource(trimmed, must(sourceA), 7)).toEqual([]);
  });
});
