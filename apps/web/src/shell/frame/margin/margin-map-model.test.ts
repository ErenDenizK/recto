import type { OutlineNode, PageId } from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import {
  currentEntry,
  EDGE,
  MAX_ENTRIES,
  MAX_WIDTH,
  mapEntries,
  MIN_WIDTH,
  MIN_WINDOW,
  PAGE_GAP,
  placeMargin,
} from './margin-map-model';

const id = (n: number) => `p${n}` as PageId;
const node = (
  title: string,
  page: number | null,
  children: OutlineNode[] = [],
  top?: number,
): OutlineNode => ({
  title,
  open: true,
  children,
  ...(page === null
    ? {}
    : {
        destination: {
          kind: 'page' as const,
          page: id(page),
          ...(top === undefined ? {} : { view: { fit: 'xyz' as const, top } }),
        },
      }),
});
const indexOf = (p: PageId) => Number(p.slice(1));
const height = () => 800;

describe('mapEntries', () => {
  it('lists two levels in document order and skips entries without a page', () => {
    const outline = [
      node('One', 0, [node('One.a', 1, [node('deep', 1)]), node('uri', null)]),
      node('Two', 3),
      node('Gone', 99),
    ];
    const entries = mapEntries(outline, (p) => (indexOf(p) < 10 ? indexOf(p) : -1), height);
    expect(entries.map((e) => [e.title, e.level, e.pageIndex])).toEqual([
      ['One', 1, 0],
      ['One.a', 2, 1],
      ['Two', 1, 3],
    ]);
  });

  it('places a heading by its /XYZ top', () => {
    const [entry] = mapEntries([node('Mid', 2, [], 200)], indexOf, height);
    expect(entry?.frac).toBeCloseTo(0.75);
  });

  it('caps the list', () => {
    const outline = Array.from({ length: MAX_ENTRIES + 20 }, (_, i) => node(`h${i}`, 0));
    expect(mapEntries(outline, indexOf, height)).toHaveLength(MAX_ENTRIES);
  });
});

describe('currentEntry', () => {
  const entries = mapEntries(
    [node('A', 0), node('B', 1, [], 400), node('C', 1, [], 100), node('D', 4)],
    indexOf,
    height,
  );

  it('is none before the first heading', () => {
    expect(currentEntry([], 0, 0)).toBeUndefined();
    const later = mapEntries([node('A', 2)], indexOf, height);
    expect(currentEntry(later, 1, 0.9)).toBeUndefined();
  });

  it('is the last heading at or above the reading position', () => {
    expect(currentEntry(entries, 0, 0)?.title).toBe('A');
    expect(currentEntry(entries, 1, 0.2)?.title).toBe('A');
    expect(currentEntry(entries, 1, 0.5)?.title).toBe('B');
    expect(currentEntry(entries, 1, 0.9)?.title).toBe('C');
    expect(currentEntry(entries, 3, 0)?.title).toBe('C');
    expect(currentEntry(entries, 4, 0)?.title).toBe('D');
  });
});

describe('placeMargin', () => {
  const wide = { windowWidth: 1440, freeLeft: 0, freeRight: 1440, entries: 5 };

  it('shows in the left margin of a page that fits with room', () => {
    // A 540 px page centred at 1440: margins of 450.
    const place = placeMargin({ ...wide, pages: { left: 450, right: 990 } });
    expect(place?.side).toBe('left');
    expect(place?.left).toBe(EDGE);
    expect(place?.width).toBe(MAX_WIDTH);
    // Never closer than 64 px to the page.
    expect((place?.left ?? 0) + (place?.width ?? 0)).toBeLessThanOrEqual(450 - PAGE_GAP);
  });

  it('keeps the 64 px gap when the room is tight', () => {
    const place = placeMargin({ ...wide, pages: { left: 300, right: 1140 } });
    expect(place).not.toBeNull();
    expect((place?.left ?? 0) + (place?.width ?? 0)).toBeLessThanOrEqual(300 - PAGE_GAP);
  });

  it('stays on the left while the left has room, even when the right has more', () => {
    const place = placeMargin({
      windowWidth: 1440,
      freeLeft: 0,
      freeRight: 1440,
      entries: 5,
      pages: { left: 300, right: 1000 },
    });
    expect(place?.side).toBe('left');
  });

  it('uses the right margin when the left is too narrow (the sidebar is open)', () => {
    const place = placeMargin({
      windowWidth: 1440,
      freeLeft: 300,
      freeRight: 1440,
      entries: 5,
      pages: { left: 500, right: 1000 },
    });
    expect(place?.side).toBe('right');
    expect(place?.left).toBe(1000 + PAGE_GAP);
    expect((place?.left ?? 0) + (place?.width ?? 0)).toBeLessThanOrEqual(1440 - EDGE);
  });

  it('withdraws when the page grows into the margin (zoom in)', () => {
    const room = MIN_WIDTH + PAGE_GAP + EDGE;
    expect(placeMargin({ ...wide, pages: { left: room, right: 1440 - room } })).not.toBeNull();
    expect(placeMargin({ ...wide, pages: { left: room - 1, right: 1440 - room + 1 } })).toBeNull();
    expect(placeMargin({ ...wide, pages: { left: -200, right: 1700 } })).toBeNull();
  });

  it('withdraws on narrow windows, without an outline and without a page', () => {
    const pages = { left: 450, right: 990 };
    expect(placeMargin({ ...wide, windowWidth: MIN_WINDOW - 1, pages })).toBeNull();
    expect(placeMargin({ ...wide, windowWidth: MIN_WINDOW, pages })).not.toBeNull();
    expect(placeMargin({ ...wide, entries: 0, pages })).toBeNull();
    expect(placeMargin({ ...wide, pages: null })).toBeNull();
  });
});
