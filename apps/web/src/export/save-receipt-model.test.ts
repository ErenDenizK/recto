/**
 * The save receipt's pure parts (DSN-67): the first size of a copy, the changed pages, and the
 * `?receipt` flag.
 */
import type {
  EngineEdit,
  PageId,
  SourceId,
  VirtualDocument,
  VirtualPage,
  Workspace,
} from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import { changedPages } from './changed-pages';
import { decideReceipt } from './receipt-flag';
import { BLANK_PAGE_BYTES, MARK_BYTES, quickSize, TEXT_EDIT_BYTES } from './size-quick';

const SOURCE = 'src-1' as SourceId;

const page = (n: number, extra: Partial<VirtualPage> = {}): VirtualPage => ({
  id: `p${n}` as PageId,
  ref: { kind: 'source', source: SOURCE, index: n },
  rotation: 0,
  overlays: [],
  ...extra,
});

const edit = (
  kind: EngineEdit['kind'],
  pageIndex: number,
  payload: unknown = null,
  id = `e-${kind}-${pageIndex}`,
): EngineEdit => ({ id, source: SOURCE, pageIndex, kind, payload });

/** An 8-page, 80 000-byte file, with `pages` as the document and `edits` in the log. */
function setup(pages: readonly VirtualPage[], edits: readonly EngineEdit[] = []) {
  const ws = {
    sources: { [SOURCE]: { id: SOURCE, byteLength: 80_000, pageCount: 8 } },
    documents: {},
    documentOrder: [],
    engineEdits: edits,
  } as unknown as Workspace;
  return { ws, doc: { pages } as unknown as VirtualDocument };
}

describe('quickSize', () => {
  it('shares the file over its pages', () => {
    const { ws, doc } = setup([page(0), page(1), page(2), page(3)]);
    expect(quickSize(ws, doc)).toBe(40_000);
  });

  it('adds what edits and added pages cost', () => {
    const blank: VirtualPage = {
      id: 'b' as PageId,
      ref: { kind: 'blank', size: { width: 595, height: 842 } },
      rotation: 0,
      overlays: [],
    };
    const { ws, doc } = setup(
      [page(0), blank],
      [edit('text.edit', 0), edit('annotation.create', 0), edit('form.set-value', 0)],
    );
    expect(quickSize(ws, doc)).toBe(10_000 + BLANK_PAGE_BYTES + TEXT_EDIT_BYTES + MARK_BYTES);
  });

  it('has nothing to say about a document without pages', () => {
    const { ws, doc } = setup([]);
    expect(quickSize(ws, doc)).toBeNull();
  });
});

describe('changedPages', () => {
  it('lists edited text, marks, a signature, an added page and a rotated page, in order', () => {
    const blank: VirtualPage = {
      id: 'b' as PageId,
      ref: { kind: 'blank', size: { width: 595, height: 842 } },
      rotation: 0,
      overlays: [],
    };
    const { ws, doc } = setup(
      [page(0), page(1), page(2, { rotation: 90 }), page(3), blank],
      [
        edit('text.edit', 0),
        edit('annotation.create', 1, { annotation: { id: 'a', kind: 'ink' } }),
        edit('annotation.create', 3, { annotation: { id: 'b', kind: 'stamp' } }),
      ],
    );
    const { pages, deleted } = changedPages(ws, doc);
    expect(pages.map((p) => [p.position, p.kinds])).toEqual([
      [1, ['text']],
      [2, ['marks']],
      [3, ['rotated']],
      [4, ['signature']],
      [5, ['added']],
    ]);
    // Eight pages in the file, five kept (four from the source).
    expect(deleted).toBe(4);
  });

  it('forgets an annotation that was made and deleted again', () => {
    const { ws, doc } = setup(
      [page(0), page(1)],
      [
        edit('annotation.create', 0, { annotation: { id: 'a', kind: 'ink' } }),
        edit('annotation.delete', 0, { annotationId: 'a' }),
      ],
    );
    expect(changedPages(ws, doc).pages).toEqual([]);
  });
});

describe('decideReceipt', () => {
  it('is off unless asked, and the query beats the session', () => {
    expect(decideReceipt('', null)).toBe(false);
    expect(decideReceipt('?receipt=1', null)).toBe(true);
    expect(decideReceipt('', '1')).toBe(true);
    expect(decideReceipt('?receipt=0', '1')).toBe(false);
    expect(decideReceipt('?receipt=yes', null)).toBe(false);
  });
});
