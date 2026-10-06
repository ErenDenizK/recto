import { describe, expect, it } from 'vitest';

import { HIDE_AFTER, type HideState, hideOnScroll, SHOW_AFTER, SHOWN } from './hide-on-scroll';

/** Scrolls through `tops` in a file whose largest scrollTop is `max`, from the first one. */
function run(
  tops: readonly number[],
  max = 5000,
  blocked = false,
  from: HideState = { ...SHOWN, top: tops[0] ?? 0 },
) {
  return tops.reduce((state, top) => hideOnScroll(state, { top, max, blocked }), from);
}

describe('hide on scroll (01-frame F12 §4)', () => {
  it('hides after 24 px of cumulative downward scroll, not before', () => {
    expect(run([100, 110, 120]).hidden).toBe(false);
    expect(run([100, 110, 120, 100 + HIDE_AFTER]).hidden).toBe(true);
    expect(run([100, 100 + HIDE_AFTER - 1]).hidden).toBe(false);
  });

  it('shows again after 8 px up, and a change of direction starts the count again', () => {
    const hidden = run([100, 200]);
    expect(hidden.hidden).toBe(true);
    expect(run([195], 5000, false, hidden).hidden).toBe(true);
    expect(run([200 - SHOW_AFTER], 5000, false, hidden).hidden).toBe(false);
    // Down 20, up 4, down 20: neither run reaches 24 alone.
    expect(run([100, 120, 116, 136]).hidden).toBe(false);
  });

  it('shows at either end of the file', () => {
    const hidden = run([100, 200]);
    expect(run([0], 5000, false, hidden).hidden).toBe(false);
    expect(run([4999.5], 5000, false, hidden).hidden).toBe(false);
  });

  it('never hides a file of one screen or less (both ends at once)', () => {
    expect(run([0, 0], 0).hidden).toBe(false);
  });

  it('never hides while a "never" condition holds, and shows at once when one starts', () => {
    expect(run([100, 300], 5000, true).hidden).toBe(false);
    const hidden = run([100, 300]);
    expect(hideOnScroll(hidden, { top: 310, max: 5000, blocked: true }).hidden).toBe(false);
  });
});
