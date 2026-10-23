/**
 * Where a document was left (R26 concept 4, DSN-66): the store keeps one point per document, the
 * document read last, and the snapshot place round-trips the zoom and offset.
 */
import type { DocumentId, VirtualPage, Workspace } from '@pdf-editor/document-model';
import { beforeEach, describe, expect, it } from 'vitest';

import { homeCards } from '../home/home-model';
import { parseKeptRecord } from './format';
import {
  progressOf,
  type ResumePoint,
  resetResumeStore,
  seedResume,
  setResume,
  useResumeStore,
} from './resume';

const a = 'a' as DocumentId;
const b = 'b' as DocumentId;
const point = (patch: Partial<ResumePoint> = {}): ResumePoint => ({
  page: 3,
  total: 8,
  zoom: 1.25,
  fit: null,
  offset: 120,
  at: 1,
  ...patch,
});

beforeEach(resetResumeStore);

describe('the resume store', () => {
  it('keeps a point per document and follows the one read last', () => {
    setResume(a, point());
    setResume(b, point({ page: 1 }));
    const state = useResumeStore.getState();
    expect(state.points[a]?.page).toBe(3);
    expect(state.points[b]?.page).toBe(1);
    expect(state.last).toBe(b);
  });

  it('writes nothing for an unchanged point, so the session does not save again', () => {
    setResume(a, point());
    const before = useResumeStore.getState();
    setResume(a, point({ at: 99 }));
    expect(useResumeStore.getState()).toBe(before);
  });

  it('moves `last` back to a document read again without touching its point', () => {
    setResume(a, point());
    setResume(b, point({ page: 1 }));
    const points = useResumeStore.getState().points;
    setResume(a, point());
    expect(useResumeStore.getState().last).toBe(a);
    expect(useResumeStore.getState().points).toBe(points);
  });

  it('seeds a restored document quietly and only when its snapshot kept a place', () => {
    setResume(a, point());
    seedResume(b, { page: 5, resume: { zoom: 2, fit: 'width', offset: -4 } }, 9);
    expect(useResumeStore.getState().points[b]).toMatchObject({
      page: 5,
      total: 9,
      zoom: 2,
      fit: 'width',
      offset: -4,
    });
    expect(useResumeStore.getState().last).toBe(a);
    seedResume('c' as DocumentId, { page: 2 }, 4);
    expect(useResumeStore.getState().points.c).toBeUndefined();
  });

  it('reads progress as the page reached over the total, at most 1', () => {
    expect(progressOf({ page: 3, total: 8 })).toBe(0.5);
    expect(progressOf({ page: 7, total: 8 })).toBe(1);
    expect(progressOf({ page: 20, total: 8 })).toBe(1);
    expect(progressOf({ page: 0, total: 0 })).toBe(0);
  });
});

describe('the snapshot place', () => {
  const record = (resume: unknown) => ({
    format: 1,
    kind: 'kept',
    id: 'k1',
    keptAt: 1,
    title: 'T',
    name: 'T.pdf',
    size: 10,
    pages: 8,
    workspace: {},
    place: { id: 'a', page: 3, view: 'read', mode: 'read', changed: false, resume },
    sources: [],
    blobs: [],
  });

  it('round-trips the zoom, fit and offset', () => {
    const read = parseKeptRecord(record({ zoom: 1.25, fit: null, offset: 120 }));
    expect(read.place.resume).toEqual({ zoom: 1.25, fit: null, offset: 120 });
  });

  it('reads an older record without a place to resume', () => {
    expect(parseKeptRecord(record(undefined)).place.resume).toBeUndefined();
  });

  it('refuses a damaged place instead of dropping it silently', () => {
    expect(() => parseKeptRecord(record({ zoom: 'big', fit: null, offset: 1 }))).toThrow();
  });
});

describe('Library cards', () => {
  const page = (id: string) =>
    ({ id, ref: { kind: 'source', source: 's', index: 0 } }) as unknown as VirtualPage;
  const ws = {
    documentOrder: [a],
    documents: {
      [a]: { id: a, title: 'T', pages: [page('p1'), page('p2'), page('p3'), page('p4')] },
    },
    sources: {},
  } as unknown as Workspace;

  it('shows the cover on page 1 and the page left past it, with the progress', () => {
    const [first] = homeCards(ws, {}, {}, { [a]: { page: 0 } });
    expect(first?.progress).toBe(0.25);
    expect(first?.leftPage).toBeUndefined();
    const [third] = homeCards(ws, {}, {}, { [a]: { page: 2 } });
    expect(third?.progress).toBe(0.75);
    expect(third?.reachedPage).toBe(3);
    expect(third?.leftPage?.id).toBe('p3');
  });

  it('has no progress without a point', () => {
    const [card] = homeCards(ws, {}, {}, {});
    expect(card?.progress).toBeUndefined();
  });
});
