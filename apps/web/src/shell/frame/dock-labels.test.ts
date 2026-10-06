/**
 * The dock's label form (`01-frame.md` F10 §2, §9: "unit label-form decision (EN, TR at 600,
 * 700, 840 px, sidebar open)"; spec 01.5). Widths are the spec's: the dock with labels beside
 * is about 422 px in English and 490 px in Turkish; the page pill about 110 px.
 */
import { describe, expect, it } from 'vitest';

import { dockLabelForm, dockRoom } from './dock-labels';

const EN = 422;
const TR = 490;
const PILL = 110;

describe('dock label form', () => {
  it('measures first: beside until the width with labels beside is known', () => {
    expect(dockLabelForm({ size: 'medium', besideWidth: null, room: 100 })).toBe('beside');
  });

  it('keeps 16 px from each edge and the pill’s 12 px clearance on both sides', () => {
    expect(dockRoom(1440, PILL)).toBe(1440 - 32 - 2 * (PILL + 12));
    expect(dockRoom(1440, 0)).toBe(1440 - 32);
  });

  it.each([
    // width, English, Turkish
    [840, 'beside', 'beside'],
    [700, 'beside', 'under'],
    [600, 'under', 'under'],
  ] as const)('at %i px: English %s, Turkish %s', (width, en, tr) => {
    const size = width >= 840 ? 'expanded' : 'medium';
    const room = dockRoom(width, PILL);
    expect(dockLabelForm({ size, besideWidth: EN, room })).toBe(en);
    expect(dockLabelForm({ size, besideWidth: TR, room })).toBe(tr);
  });

  it('with the sidebar docked the band is narrower: a 1280 window keeps labels beside', () => {
    const room = dockRoom(1280 - 320, PILL);
    expect(dockLabelForm({ size: 'large', besideWidth: TR, room })).toBe('beside');
    // A narrow expanded window with the sidebar docked stacks them (spec 01.5).
    expect(
      dockLabelForm({ size: 'expanded', besideWidth: TR, room: dockRoom(900 - 320, PILL) }),
    ).toBe('under');
  });

  it('stacks the labels on a compact window, as the phone dock does', () => {
    expect(dockLabelForm({ size: 'compact', besideWidth: null, room: 10_000 })).toBe('under');
  });
});
