/**
 * `recto:history-applied` (docs/design/motion-2026-10/frame.md §6): what a step touched, and the
 * event a lane cancels to draw its own flash.
 */
import type { DocumentId, EngineEdit, PageId, Workspace } from '@pdf-editor/document-model';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  changedBetween,
  dispatchHistoryApplied,
  flashChanged,
  HISTORY_APPLIED,
  type HistoryAppliedDetail,
} from './history-applied';

const DOC = 'doc-1' as DocumentId;
const page = (id: string, rotation = 0) => ({
  id: id as PageId,
  ref: { kind: 'source', source: 'src-1', index: 0 },
  rotation,
  overlays: [],
});
const edit = (id: string, annotation: string): EngineEdit =>
  ({
    id,
    source: 'src-1',
    pageIndex: 0,
    kind: 'annotation.create',
    payload: { annotation: { id: annotation } },
  }) as unknown as EngineEdit;

function workspace(pages: ReturnType<typeof page>[], edits: EngineEdit[]): Workspace {
  return {
    sources: {},
    documents: { [DOC]: { id: DOC, pages } },
    documentOrder: [DOC],
    activeDocument: DOC,
    engineEdits: edits,
  } as unknown as Workspace;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('changedBetween', () => {
  it('lists the annotation of an edit one side has, either way', () => {
    const p1 = page('p1');
    const before = workspace([p1], [edit('e1', 'a1')]);
    const after = workspace([p1], [edit('e1', 'a1'), edit('e2', 'ink-7')]);
    expect(changedBetween(before, after, DOC).annotationIds).toEqual(['ink-7']);
    expect(changedBetween(after, before, DOC).annotationIds).toEqual(['ink-7']);
  });

  it('lists the pages that came, went or changed, the revealed one first', () => {
    const p1 = page('p1');
    const p2 = page('p2');
    const before = workspace([p1, p2], []);
    const after = workspace([p1, page('p2', 90), page('p3')], []);
    expect(changedBetween(before, after, DOC, 'p1' as PageId).pageIds).toEqual(['p1', 'p2', 'p3']);
    expect(changedBetween(after, before, DOC).pageIds).toEqual(['p2', 'p3']);
  });
});

describe('the event', () => {
  const detail: HistoryAppliedDetail = {
    direction: 'undo',
    documentId: DOC,
    pageIds: ['p1' as PageId],
    annotationIds: ['a1'],
  };

  it('reaches window listeners with its detail, and a listener can take the flash over', () => {
    const seen = vi.fn((event: CustomEvent<HistoryAppliedDetail>) => event.detail);
    window.addEventListener(HISTORY_APPLIED, seen);
    expect(dispatchHistoryApplied(detail)).toBe(true);
    const take = (event: Event) => event.preventDefault();
    window.addEventListener(HISTORY_APPLIED, take);
    expect(dispatchHistoryApplied(detail)).toBe(false);
    window.removeEventListener(HISTORY_APPLIED, seen);
    window.removeEventListener(HISTORY_APPLIED, take);
    expect(seen).toHaveReturnedWith(detail);
  });

  it('flashes a tint over a changed annotation and leaves nothing behind', async () => {
    const pageEl = document.createElement('div');
    pageEl.style.cssText = 'position: relative; width: 200px; height: 200px';
    const mark = document.createElement('div');
    mark.dataset.annotationId = 'a1';
    mark.style.cssText = 'position: absolute; left: 20px; top: 30px; width: 40px; height: 10px';
    pageEl.append(mark);
    document.body.append(pageEl);
    flashChanged(pageEl, ['a1']);
    const tint = pageEl.querySelector<HTMLElement>('[data-history-flash]');
    expect(tint?.style.left).toBe('17px');
    expect(tint?.style.width).toBe('46px');
    await Promise.all(tint?.getAnimations().map((a) => a.finished) ?? []);
    expect(pageEl.querySelector('[data-history-flash]')).toBeNull();
  });
});
