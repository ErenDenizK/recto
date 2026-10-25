import type { OutlineNode, PageId } from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import { outlineFromHeadings, pagesStillPresent } from './headings-outline';

const pages = ['p0', 'p1', 'p2'] as PageId[];
const h = (page: number, level: number, text: string) => ({ page, level, text });
const titles = (nodes: readonly OutlineNode[]): unknown[] =>
  nodes.map((n) => (n.children.length > 0 ? [n.title, titles(n.children)] : n.title));

describe('outlineFromHeadings (PRD-33)', () => {
  it('nests by level and points each entry at its page', () => {
    const tree = outlineFromHeadings(
      [h(0, 1, 'One'), h(0, 2, 'One A'), h(1, 2, 'One B'), h(1, 3, 'Deep'), h(2, 1, 'Two')],
      pages,
    );
    expect(titles(tree)).toEqual([['One', ['One A', ['One B', ['Deep']]]], 'Two']);
    expect(tree[1]?.destination).toEqual({ kind: 'page', page: 'p2' });
  });

  it('a skipped level nests one step down, a lower level pops back', () => {
    const tree = outlineFromHeadings(
      [h(0, 1, 'A'), h(0, 3, 'C'), h(0, 2, 'B'), h(0, 1, 'D')],
      pages,
    );
    expect(titles(tree)).toEqual([['A', ['C', 'B']], 'D']);
  });

  it('starts at the top level when the first heading is deep, and drops blank or off-document ones', () => {
    const tree = outlineFromHeadings(
      [h(0, 3, ' Lone  heading '), h(1, 1, ' '), h(9, 1, 'Gone')],
      pages,
    );
    expect(titles(tree)).toEqual(['Lone heading']);
  });

  it('strips control characters from titles', () => {
    const tree = outlineFromHeadings([h(0, 1, 'Intro\u0000\u0007 text\u009f')], pages);
    expect(tree[0]?.title).toBe('Intro text');
  });

  it('indices follow the start page list: a page that left makes the run void', () => {
    // Reordered pages still resolve through the start list; a removed one does not.
    expect(outlineFromHeadings([h(0, 1, 'A')], ['p2', 'p0'] as PageId[])[0]?.destination).toEqual({
      kind: 'page',
      page: 'p2',
    });
    expect(pagesStillPresent(pages, ['p2', 'p0', 'p1'] as PageId[])).toBe(true);
    expect(pagesStillPresent(pages, ['p0', 'p1'] as PageId[])).toBe(false);
  });
});
