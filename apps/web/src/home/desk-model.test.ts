/**
 * The desk's pure rules (DSN-87, `masa.md` §2.2, §2.4, §2.6, §3.3).
 */
import { describe, expect, it } from 'vitest';

import type { RecentEntry } from '../files/recents';
import type { Cover } from './covers';
import { coverKey } from './covers';
import {
  columnsOf,
  continueEntry,
  entryProgress,
  heroKind,
  isFirstVisit,
  isRead,
  pickCover,
} from './desk-model';

const entry = (over: Partial<RecentEntry> = {}): RecentEntry => ({
  id: 'a',
  name: 'report.pdf',
  size: 100,
  openedAt: 1,
  ...over,
});
const place = (page: number, total = 10) => ({ page, total, at: 1 });
const cover = (kind: 'first' | 'left'): Cover => ({
  kind,
  page: 0,
  width: 60,
  height: 80,
  url: `blob:${kind}`,
});

describe('heroKind', () => {
  const base = { loaded: true, waited: false, hasContinue: false, sampleFree: true };
  it('holds the slot while Recents are read, then falls back after the wait', () => {
    expect(heroKind({ ...base, loaded: false })).toBe('holding');
    expect(heroKind({ ...base, loaded: false, waited: true })).toBe('sample');
  });
  it('shows Continue whenever there is something to continue', () => {
    expect(heroKind({ ...base, hasContinue: true })).toBe('continue');
    expect(heroKind({ ...base, loaded: false, hasContinue: true })).toBe('continue');
  });
  it('shows the sample while it is not on screen, else nothing', () => {
    expect(heroKind(base)).toBe('sample');
    expect(heroKind({ ...base, sampleFree: false })).toBe('none');
  });
});

describe('isFirstVisit', () => {
  const base = { loaded: true, recents: 0, open: 0, hasContinue: false };
  it('needs Recents read and empty, nothing open, nothing to continue', () => {
    expect(isFirstVisit(base)).toBe(true);
    expect(isFirstVisit({ ...base, loaded: false })).toBe(false);
    expect(isFirstVisit({ ...base, recents: 1 })).toBe(false);
    expect(isFirstVisit({ ...base, open: 1 })).toBe(false);
    expect(isFirstVisit({ ...base, hasContinue: true })).toBe(false);
  });
});

describe('continueEntry', () => {
  it('is the newest entry with a place past page 1', () => {
    const entries = [
      entry({ id: 'new' }),
      entry({ id: 'first-page', place: place(0) }),
      entry({ id: 'read', place: place(3) }),
      entry({ id: 'older', place: place(5) }),
    ];
    expect(continueEntry(entries)?.id).toBe('read');
    expect(continueEntry([entry(), entry({ id: 'b', place: place(0) })])).toBeUndefined();
  });
});

describe('pickCover', () => {
  const covers = new Map([
    [coverKey('first', entry()), cover('first')],
    [coverKey('left', entry()), cover('left')],
  ]);
  it('prefers the page left once past page 1, else the first page', () => {
    expect(pickCover(entry({ place: place(3) }), covers)?.kind).toBe('left');
    expect(pickCover(entry({ place: place(0) }), covers)?.kind).toBe('first');
    expect(pickCover(entry(), covers)?.kind).toBe('first');
  });
  it('falls back to the first page when the left one is missing, and to nothing', () => {
    const onlyFirst = new Map([[coverKey('first', entry()), cover('first')]]);
    expect(pickCover(entry({ place: place(3) }), onlyFirst)?.kind).toBe('first');
    expect(pickCover(entry({ place: place(3) }), new Map())).toBeUndefined();
  });
});

describe('progress', () => {
  it('is the page reached over the total, 0 with no place', () => {
    expect(entryProgress(entry({ place: place(3) }))).toBeCloseTo(0.4);
    expect(entryProgress(entry({ place: place(20) }))).toBe(1);
    expect(entryProgress(entry())).toBe(0);
    expect(entryProgress(entry({ place: place(0, 0) }))).toBe(0);
  });
  it('counts as read only past page 1', () => {
    expect(isRead(entry({ place: place(1) }))).toBe(true);
    expect(isRead(entry({ place: place(0) }))).toBe(false);
    expect(isRead(entry())).toBe(false);
  });
});

describe('layout helpers', () => {
  it('counts the columns as the items sharing the first top edge', () => {
    expect(columnsOf([])).toBe(1);
    expect(
      columnsOf([{ offsetTop: 0 }, { offsetTop: 0 }, { offsetTop: 0 }, { offsetTop: 300 }]),
    ).toBe(3);
  });
});
