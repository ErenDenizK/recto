/** Find in the Text view (find-map.ts): the block under a hit, the n-th occurrence, İ, fallback. */
import type { PageId, SourceId } from '@pdf-editor/document-model';
import type { TextViewPage } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import type { PageFrame } from '../viewer/geometry';
import type { DocumentHit } from '../viewer/search';
import { anchorOfHit, markForHit } from './find-map';
import { userToDisplay } from './position';

const frame: PageFrame = {
  size: { width: 600, height: 800 },
  originX: 0,
  originY: 0,
  rotation: 0,
  scale: 1,
};

const box = (y: number, height = 20) => ({ x: 50, y, width: 400, height });
const page: TextViewPage = {
  page: 0,
  pageAnchor: 'page-1',
  size: { width: 600, height: 800 },
  needsOcr: false,
  blocks: [
    { id: 'p1-1', page: 0, bbox: box(40), kind: 'heading', level: 1, text: 'Annual report' },
    {
      id: 'p1-2',
      page: 0,
      bbox: box(100, 40),
      kind: 'paragraph',
      text: 'The İstanbul office and the istanbul depot.',
    },
    {
      id: 'p1-3',
      page: 0,
      bbox: box(200, 40),
      kind: 'list',
      ordered: false,
      items: [
        { text: 'first item', bbox: box(200), depth: 0 },
        { text: 'a second istanbul item', bbox: box(220), depth: 0 },
      ],
    },
  ],
};

/** A hit whose rect sits over a display-space box (converted back to user space). */
function hitOver(
  seq: number,
  displayY: number,
  context: string,
  matchStart: number | undefined,
  length: number,
) {
  return {
    seq,
    pageIndex: 0,
    pageId: 'p' as PageId,
    sourceId: 's' as SourceId,
    // Display y d on an 800 pt page with a bottom-left origin is user y 800 - d - height.
    rects: [{ x: 60, y: 800 - displayY - 10, width: 30, height: 10 }],
    context,
    ...(matchStart === undefined ? {} : { matchStart, matchLength: length }),
  } satisfies DocumentHit;
}

describe('the block under a hit', () => {
  it('finds a paragraph and a list item by their boxes', () => {
    const inParagraph = hitOver(1, 110, 'istanbul', 0, 8);
    expect(anchorOfHit(inParagraph, page, frame)?.block.id).toBe('p1-2');
    const inItem = hitOver(1, 225, 'istanbul', 0, 8);
    expect(anchorOfHit(inItem, page, frame)).toMatchObject({ block: { id: 'p1-3' }, item: 1 });
    expect(anchorOfHit(hitOver(1, 700, 'x', 0, 1), page, frame)).toBeUndefined();
  });

  it('measures in display space, so the mapping agrees with the blocks', () => {
    const h = hitOver(1, 110, 'x', 0, 1);
    expect(userToDisplay(frame, h.rects[0] ?? { x: 0, y: 0, width: 0, height: 0 }).y).toBeCloseTo(
      110,
    );
  });
});

describe('the mark', () => {
  const first = hitOver(1, 110, '…the İstanbul office…', 5, 8);
  const second = hitOver(2, 125, '…the istanbul depot…', 5, 8);

  it('marks the first occurrence for the first hit, folding the Turkish İ', () => {
    expect(markForHit(first, [first, second], page, frame)).toEqual({
      blockId: 'p1-2',
      start: 4,
      length: 8,
      exact: true,
    });
  });

  it('marks the second occurrence for the second hit in the same block', () => {
    expect(markForHit(second, [first, second], page, frame)).toEqual({
      blockId: 'p1-2',
      start: 28,
      length: 8,
      exact: true,
    });
  });

  it('names the list item and counts ranks per item', () => {
    const hit = hitOver(3, 225, '…second istanbul item', 8, 8);
    expect(markForHit(hit, [first, second, hit], page, frame)).toEqual({
      blockId: 'p1-3',
      item: 1,
      start: 9,
      length: 8,
      exact: true,
    });
  });

  it('marks the whole block when the words are not in its text', () => {
    const hit = hitOver(1, 110, '…ﬁnance…', 1, 7);
    expect(markForHit(hit, [hit], page, frame)).toEqual({
      blockId: 'p1-2',
      start: 0,
      length: page.blocks[1] && 'text' in page.blocks[1] ? page.blocks[1].text.length : -1,
      exact: false,
    });
    const noOffsets = hitOver(1, 110, 'istanbul', undefined, 8);
    expect(markForHit(noOffsets, [], page, frame)?.exact).toBe(false);
  });

  it('is undefined when no block is under the hit', () => {
    const hit = hitOver(1, 700, 'x', 0, 1);
    expect(markForHit(hit, [hit], page, frame)).toBeUndefined();
  });
});
