/**
 * The glass scroll bar's page and section mapping (`scroll-map.ts`, R29 study, GLS-26 amendment):
 * the bubble's words, the section a page belongs to, where sections lie along the track and the
 * Find hits on a page.
 */
import {
  createWorkspace,
  type OutlineNode,
  type PageId,
  type VirtualDocument,
} from '@pdf-editor/document-model';
import { afterEach, describe, expect, it } from 'vitest';

import { useSearchStore } from '../viewer/search';
import { bubbleText, buildScrollMap, hitsOnPage } from './scroll-map';

const id = (n: number) => `p${n}` as PageId;
const heading = (title: string, page: number, top?: number): OutlineNode => ({
  title,
  open: true,
  children: [],
  destination: {
    kind: 'page',
    page: id(page),
    ...(top === undefined ? {} : { view: { fit: 'xyz' as const, top } }),
  },
});
const page = (n: number) => ({
  id: id(n),
  ref: { kind: 'image', blob: 'b' },
  rotation: 0,
  resize: { width: 600, height: 800 },
});
const doc = (outline: OutlineNode[]) =>
  ({ pages: [0, 1, 2, 3, 4, 5, 6, 7].map(page), outline }) as unknown as VirtualDocument;

describe('bubbleText', () => {
  it('names the page, and the section after a bar', () => {
    expect(bubbleText(3, 8, 'Roll three')).toBe('4 / 8 | Roll three');
    expect(bubbleText(0, 8, '')).toBe('1 / 8');
  });
});

describe('buildScrollMap', () => {
  const outline = [heading('Cover', 0), heading('Roll three', 3), heading('Flatplan', 6, 200)];
  const map = buildScrollMap(doc(outline), createWorkspace(), (top) => Math.floor(top / 100));

  afterEach(() => useSearchStore.setState({ hits: [] }));

  it('puts a page under the last section at or above it', () => {
    expect(map.pages).toBe(8);
    expect(map.at(0)).toMatchObject({ page: 0, section: 0, heading: 'Cover' });
    expect(map.at(250)).toMatchObject({ page: 2, section: 0, heading: 'Cover' });
    expect(map.at(300)).toMatchObject({ page: 3, section: 1, heading: 'Roll three' });
    expect(map.at(700)).toMatchObject({ page: 7, section: 2, heading: 'Flatplan' });
  });

  it('lays sections along the track by page and heading position', () => {
    expect(map.sections.map((s) => s.title)).toEqual(['Cover', 'Roll three', 'Flatplan']);
    expect(map.sections[1]?.at).toBeCloseTo(3 / 8);
    // A heading 200 pt from the top of an 800 pt page sits 3/4 of the way down it.
    expect(map.sections[2]?.at).toBeCloseTo((6 + 0.75) / 8);
  });

  it('has no section before the first heading, and none for no outline', () => {
    const late = buildScrollMap(doc([heading('Roll three', 3)]), createWorkspace(), () => 1);
    expect(late.at(0)).toMatchObject({ page: 1, section: -1, heading: '' });
    expect(buildScrollMap(doc([]), createWorkspace(), () => 0).sections).toEqual([]);
  });

  it('counts the Find hits on the page under the thumb', () => {
    const hits = [{ pageIndex: 3 }, { pageIndex: 3 }, { pageIndex: 5 }];
    useSearchStore.setState({ hits: hits as never });
    expect(map.at(300)?.hits).toBe(2);
    expect(map.at(0)?.hits).toBe(0);
    expect(hitsOnPage(hits, 5)).toBe(1);
  });

  it('answers nothing where the reader has no page', () => {
    expect(buildScrollMap(doc([]), createWorkspace(), () => undefined).at(0)).toBeUndefined();
  });
});
