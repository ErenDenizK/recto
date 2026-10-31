import { describe, expect, it } from 'vitest';

import { gripEdge, HEADER_GAP, type HeaderPlaceInput, placeHeader } from './header-place';

/** A 1440 × 900 window under a 44 px strip, above a 56 px dock band (16 px off the edge). */
const FREE = { left: 0, top: 44, right: 1440, bottom: 900 - 72 };
const HEADER = { width: 230, height: 46 };

const input = (over: Partial<HeaderPlaceInput>): HeaderPlaceInput => ({
  text: { left: 500, top: 300, right: 940, bottom: 420 },
  free: FREE,
  header: HEADER,
  above: 0,
  below: 0,
  ...over,
});

describe('placeHeader (05-canvas §17.3)', () => {
  it('goes beside the paragraph, trailing first, in a margin that takes it', () => {
    expect(placeHeader(input({}))).toEqual({
      side: 'right',
      left: 940 + HEADER_GAP,
      top: 300,
      maxWidth: 340,
    });
    const leading = placeHeader(input({ text: { left: 500, top: 300, right: 1300, bottom: 420 } }));
    expect(leading).toMatchObject({ side: 'left', left: 500 - HEADER_GAP, top: 300 });
  });

  it('fits a narrower margin by wrapping, down to the minimum', () => {
    // A page at fit width: 192 px between the text and either edge of the window.
    const narrow = placeHeader(input({ text: { left: 192, top: 300, right: 1248, bottom: 420 } }));
    expect(narrow).toEqual({ side: 'right', left: 1248 + HEADER_GAP, top: 300, maxWidth: 176 });
  });

  it('keeps a header beside the paragraph under the strip while the paragraph scrolls under it', () => {
    const place = placeHeader(input({ text: { left: 500, top: 10, right: 940, bottom: 420 } }));
    expect(place.top).toBe(FREE.top + HEADER_GAP);
  });

  it('with no margin, sits above in the empty space over the paragraph', () => {
    const text = { left: 100, top: 300, right: 1340, bottom: 420 };
    expect(placeHeader(input({ text, above: 70 }))).toEqual({
      side: 'above',
      left: 100,
      top: 300 - HEADER_GAP - HEADER.height,
    });
  });

  it('never covers what lies above or below: too small a gap is passed over', () => {
    const text = { left: 100, top: 300, right: 1340, bottom: 420 };
    // A heading's rule 42 px above, the next paragraph 20 px below: docked at the foot.
    const place = placeHeader(input({ text, above: 42, below: 20 }));
    expect(place).toEqual({
      side: 'dock',
      left: (1440 - HEADER.width) / 2,
      top: FREE.bottom - HEADER_GAP - HEADER.height,
    });
    // With room below and none above: below.
    expect(placeHeader(input({ text, above: 42, below: 80 }))).toMatchObject({
      side: 'below',
      top: 420 + HEADER_GAP,
    });
  });

  it('does not go above when that would be under the strip', () => {
    const text = { left: 100, top: 80, right: 1340, bottom: 200 };
    expect(placeHeader(input({ text, above: 200, below: 80 })).side).toBe('below');
  });

  it('docks at the head of the free rectangle when the foot would cover the paragraph', () => {
    const text = { left: 100, top: 500, right: 1340, bottom: 800 };
    expect(placeHeader(input({ text }))).toMatchObject({
      side: 'dock',
      top: FREE.top + HEADER_GAP,
    });
  });

  it('falls below a paragraph taller than the window', () => {
    const text = { left: 100, top: 20, right: 1340, bottom: 1400 };
    expect(placeHeader(input({ text }))).toMatchObject({ side: 'below', top: 1400 + HEADER_GAP });
  });

  it('passes over the gaps when they are not known', () => {
    const text = { left: 100, top: 300, right: 1340, bottom: 420 };
    expect(placeHeader(input({ text, above: undefined, below: undefined })).side).toBe('dock');
  });

  // TXT-26: the sample's feature page at 1440 × 900, the left column's last paragraph open.
  describe('beside a neighbouring column', () => {
    const text = { left: 500, top: 515, right: 715, bottom: 565 };
    const column = { left: 727, top: 500, right: 935, bottom: 590 };

    it('rests in the page margin past the column, not over it', () => {
      expect(placeHeader(input({ text, others: [column] }))).toEqual({
        side: 'right',
        left: 935 + HEADER_GAP,
        top: 515,
        maxWidth: 340,
      });
    });

    it('takes the leading side when the trailing margin is too narrow', () => {
      const free = { ...FREE, right: 1050 };
      expect(placeHeader(input({ text, free, others: [column] }))).toMatchObject({
        side: 'left',
        left: 500 - HEADER_GAP,
      });
    });

    it('prefers the empty space above to covering the column', () => {
      const free = { ...FREE, left: 400, right: 1050 };
      expect(placeHeader(input({ text, free, others: [column], above: 80 })).side).toBe('above');
      // With nowhere clear, beside the paragraph over the column, as before.
      expect(placeHeader(input({ text, free, others: [column] }))).toMatchObject({
        side: 'right',
        left: 715 + HEADER_GAP,
      });
    });

    it('ignores paragraphs that are not level with it', () => {
      const below = { ...column, top: 700, bottom: 760 };
      expect(placeHeader(input({ text, others: [below] }))).toMatchObject({
        side: 'right',
        left: 715 + HEADER_GAP,
      });
    });
  });
});

describe('gripEdge (TXT-24, TXT-26)', () => {
  const frame = { left: 500, top: 515, right: 715, bottom: 565 };

  it('puts the grip on the top edge when nothing is there', () => {
    expect(gripEdge(frame, [], 24, 12)).toBe('top');
  });

  it('puts it on the bottom edge when the paragraph above is under it', () => {
    const above = { left: 500, top: 450, right: 715, bottom: 510 };
    expect(gripEdge(frame, [above], 24, 12)).toBe('bottom');
  });

  it('keeps the top when the bottom is taken too', () => {
    const above = { left: 500, top: 450, right: 715, bottom: 510 };
    const below = { left: 500, top: 570, right: 715, bottom: 620 };
    expect(gripEdge(frame, [above, below], 24, 12)).toBe('top');
  });
});
