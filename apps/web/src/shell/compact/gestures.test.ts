import { describe, expect, it } from 'vitest';

import {
  type HideState,
  INITIAL_HIDE,
  isDoubleTap,
  isTap,
  onReaderScroll,
  type PressSample,
} from './gestures';

/**
 * Feeds scroll positions through the reducer. Without a `start`, the reader rests at the
 * first position (no travel yet).
 */
function scrollThrough(tops: readonly number[], canHide = true, start?: HideState): HideState {
  let state = start ?? { ...INITIAL_HIDE, lastTop: tops[0] ?? 0 };
  for (const top of start ? tops : tops.slice(1)) {
    state = onReaderScroll(state, { top, maxTop: 5000, canHide });
  }
  return state;
}

describe('hide on scroll', () => {
  it('hides after 24 px downward, not before', () => {
    expect(scrollThrough([100, 110, 123]).hidden).toBe(false);
    expect(scrollThrough([100, 110, 124]).hidden).toBe(true);
  });

  it('shows after 8 px upward, and a change of direction restarts the run', () => {
    const hidden = scrollThrough([100, 200]);
    expect(hidden.hidden).toBe(true);
    expect(scrollThrough([195], true, hidden).hidden).toBe(true);
    expect(scrollThrough([192], true, hidden).hidden).toBe(false);
    // Down 20, up 5, down 20: neither run reaches 24.
    expect(scrollThrough([100, 120, 115, 135]).hidden).toBe(false);
  });

  it('shows at either end of the document', () => {
    const hidden = scrollThrough([100, 200]);
    expect(onReaderScroll(hidden, { top: 0, maxTop: 5000, canHide: true }).hidden).toBe(false);
    expect(onReaderScroll(hidden, { top: 4999.5, maxTop: 5000, canHide: true }).hidden).toBe(false);
  });

  it('never hides while hiding is not allowed (keyboard, focus in chrome, a sheet, Find)', () => {
    expect(scrollThrough([100, 300, 600], false).hidden).toBe(false);
    const hidden = scrollThrough([100, 200]);
    expect(onReaderScroll(hidden, { top: 400, maxTop: 5000, canHide: false }).hidden).toBe(false);
  });

  it('a scroll of zero keeps the state', () => {
    const state = scrollThrough([100]);
    expect(onReaderScroll(state, { top: 100, maxTop: 5000, canHide: true })).toBe(state);
  });
});

const press = (x: number, y: number, time: number, scrollTop = 0): PressSample => ({
  x,
  y,
  time,
  scrollLeft: 0,
  scrollTop,
});

describe('taps', () => {
  it('a still, short press is a tap', () => {
    expect(isTap(press(100, 100, 0), press(104, 103, 120))).toBe(true);
  });

  it('moving, holding or scrolling is not a tap', () => {
    expect(isTap(press(100, 100, 0), press(100, 115, 100))).toBe(false);
    expect(isTap(press(100, 100, 0), press(100, 100, 700))).toBe(false);
    expect(isTap(press(100, 100, 0, 0), press(100, 100, 100, 40))).toBe(false);
  });

  it('two taps within 300 ms and 32 px are a double tap', () => {
    const first = { x: 100, y: 100, time: 0 };
    expect(isDoubleTap(null, first)).toBe(false);
    expect(isDoubleTap(first, { x: 110, y: 110, time: 250 })).toBe(true);
    expect(isDoubleTap(first, { x: 110, y: 110, time: 350 })).toBe(false);
    expect(isDoubleTap(first, { x: 150, y: 100, time: 100 })).toBe(false);
  });
});
