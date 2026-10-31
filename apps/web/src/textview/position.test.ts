/** Text view positions (position.ts): rotations round-trip within a point; places and blocks. */
import type { Rotation } from '@pdf-editor/document-model';
import type { TextViewPage } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import type { PageFrame } from '../viewer/geometry';
import { anchorAt, displayToUser, placeOf, userToDisplay } from './position';

const frame = (rotation: Rotation): PageFrame => ({
  size: { width: 612, height: 792 },
  originX: 12,
  originY: 30,
  rotation,
  scale: 1,
});

describe('user and display space', () => {
  it.each([0, 90, 180, 270] as const)('round-trips both ways at %i degrees', (rotation) => {
    const f = frame(rotation);
    const user = { x: 100, y: 200, width: 50, height: 12 };
    const back = displayToUser(f, userToDisplay(f, user));
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(back[key] - user[key])).toBeLessThan(1);
    }
    const display = { x: 40, y: 60, width: 90, height: 14 };
    const again = userToDisplay(f, displayToUser(f, display));
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(again[key] - display[key])).toBeLessThan(1);
    }
  });

  it('puts the top-left of an upright page at the display origin', () => {
    // The CropBox's top-left corner in user space is (12, 30 + 792).
    expect(userToDisplay(frame(0), { x: 12, y: 822 - 10, width: 20, height: 10 })).toEqual({
      x: 0,
      y: 0,
      width: 20,
      height: 10,
    });
  });

  it('swaps the sides of a quarter-turned page', () => {
    const box = userToDisplay(frame(90), { x: 12, y: 30, width: 20, height: 10 });
    expect([box.width, box.height]).toEqual([10, 20]);
  });
});

const bbox = (y: number, height = 20) => ({ x: 0, y, width: 300, height });
const page: TextViewPage = {
  page: 3,
  pageAnchor: 'page-4',
  size: { width: 612, height: 792 },
  needsOcr: false,
  blocks: [
    { id: 'p4-1', page: 3, bbox: bbox(40), kind: 'heading', level: 1, text: 'Title' },
    { id: 'p4-2', page: 3, bbox: bbox(80, 60), kind: 'paragraph', text: 'Body' },
    {
      id: 'p4-3',
      page: 3,
      bbox: bbox(150, 40),
      kind: 'list',
      ordered: false,
      items: [
        { text: 'one', bbox: bbox(150), depth: 0 },
        { text: 'two', bbox: bbox(170), depth: 0 },
      ],
    },
  ],
};

describe('reader places and blocks', () => {
  it('finds the first block whose bottom is below the top of the view', () => {
    expect(anchorAt(page, 0)?.block.id).toBe('p4-1');
    expect(anchorAt(page, 59)?.block.id).toBe('p4-1');
    expect(anchorAt(page, 61)?.block.id).toBe('p4-2');
    expect(anchorAt(page, 139)?.block.id).toBe('p4-2');
  });

  it('finds the list item, and the last block past the end', () => {
    expect(anchorAt(page, 160)).toMatchObject({ block: { id: 'p4-3' }, item: 0 });
    expect(anchorAt(page, 175)).toMatchObject({ block: { id: 'p4-3' }, item: 1 });
    expect(anchorAt(page, 900)).toMatchObject({ block: { id: 'p4-3' }, item: 1 });
    expect(anchorAt({ ...page, blocks: [] }, 10)).toBeUndefined();
  });

  it('turns a block back into a place at the top of its box', () => {
    const anchor = anchorAt(page, 175);
    expect(anchor && placeOf(anchor)).toEqual({ page: 3, y: 170 });
    const paragraph = anchorAt(page, 100);
    expect(paragraph && placeOf(paragraph)).toEqual({ page: 3, y: 80 });
  });
});
