import { describe, expect, it } from 'vitest';

import { HEADER_GAP, type HeaderPlaceInput, placeHeader } from './header-place';

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
});
