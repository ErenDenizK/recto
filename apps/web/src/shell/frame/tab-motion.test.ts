/**
 * The tabs' motion bookkeeping (tab-motion.ts; 01-frame F4; G6): which tabs closed, and where a
 * collapsing one is drawn among the open ones.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { describe, expect, it } from 'vitest';

import { closedTabs, withLeaving } from './tab-motion';

const tab = (id: string) => ({ id: id as DocumentId });
const ids = (list: readonly { item: { id: DocumentId }; leaving: boolean }[]) =>
  list.map(({ item, leaving }) => `${item.id}${leaving ? '…' : ''}`);

describe('closedTabs', () => {
  it('names the tabs gone from the documents, each with the tab it followed', () => {
    const before = [tab('a'), tab('b'), tab('c')];
    const after = [tab('a'), tab('c')];
    expect(closedTabs(before, after, after)).toEqual([{ item: tab('b'), after: 'a' }]);
    const rest = [tab('b'), tab('c')];
    expect(closedTabs(before, rest, rest)).toEqual([{ item: tab('a'), after: null }]);
  });

  it('leaves out a tab that only moved into "N more"', () => {
    const before = [tab('a'), tab('b'), tab('c')];
    expect(closedTabs(before, [tab('a'), tab('b')], before)).toEqual([]);
  });
});

describe('withLeaving', () => {
  it('draws a closed tab after the one it followed, or first', () => {
    const open = [tab('a'), tab('c')];
    expect(ids(withLeaving(open, [{ item: tab('b'), after: tab('a').id }]))).toEqual([
      'a',
      'b…',
      'c',
    ]);
    expect(ids(withLeaving(open, [{ item: tab('z'), after: null }]))).toEqual(['z…', 'a', 'c']);
    expect(ids(withLeaving(open, [{ item: tab('b'), after: tab('gone').id }]))).toEqual([
      'b…',
      'a',
      'c',
    ]);
  });

  it('never draws a tab twice when it opens again while collapsing', () => {
    const open = [tab('a'), tab('b')];
    expect(ids(withLeaving(open, [{ item: tab('b'), after: tab('a').id }]))).toEqual(['a', 'b']);
  });
});
