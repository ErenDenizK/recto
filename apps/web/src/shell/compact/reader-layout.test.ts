import { describe, expect, it } from 'vitest';

import {
  anchorAt,
  clampZoom,
  doubleTapZoom,
  fitScale,
  IDENTITY,
  layoutPages,
  MAX_ZOOM,
  mostVisiblePage,
  nearlySame,
  PAGE_GAP,
  PAGE_MARGIN,
  pinchTransform,
  type ReaderFrame,
  rubberZoom,
  scrollForAnchor,
  settleTransform,
  visibleRange,
} from './reader-layout';

const LETTER = { width: 612, height: 792 };
const frame: ReaderFrame = {
  width: 390,
  height: 844,
  insetLeft: 0,
  insetRight: 0,
  padTop: 52,
  padBottom: 76,
};

describe('fit width', () => {
  it('fits the widest page between 8 px margins', () => {
    const scale = fitScale([LETTER, { width: 300, height: 400 }], frame);
    expect(scale * 612).toBeCloseTo(390 - 2 * PAGE_MARGIN, 6);
  });

  it('uses the safe area where it is wider than the margin (landscape notch)', () => {
    const scale = fitScale([LETTER], { ...frame, width: 844, insetLeft: 47, insetRight: 47 });
    expect(scale * 612).toBeCloseTo(844 - 94, 6);
  });

  it('lays pages out in one centred column with gaps', () => {
    const layout = layoutPages([LETTER, LETTER, LETTER], frame, 1, 1);
    expect(layout.width).toBe(390);
    expect(layout.boxes[0]).toMatchObject({ top: 52, left: 8, width: 374 });
    const [a, b] = layout.boxes;
    expect(b?.top).toBeCloseTo((a?.top ?? 0) + (a?.height ?? 0) + PAGE_GAP, 6);
    const last = layout.boxes[2];
    expect(layout.height).toBeCloseTo((last?.top ?? 0) + (last?.height ?? 0) + 76, 6);
  });

  it('centres a narrower page and widens the column when zoomed', () => {
    const layout = layoutPages([LETTER, { width: 306, height: 396 }], frame, 1, 1);
    const narrow = layout.boxes[1];
    // Centred to the device pixel.
    expect(Math.abs((narrow?.left ?? 0) + (narrow?.width ?? 0) / 2 - 195)).toBeLessThanOrEqual(0.5);
    const zoomed = layoutPages([LETTER], frame, 2, 1);
    expect(zoomed.width).toBeCloseTo(2 * 374 + 16, 0);
  });

  it('clamps the zoom to 1–5', () => {
    expect(clampZoom(0.4)).toBe(1);
    expect(clampZoom(9)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(layoutPages([LETTER], frame, 0.5, 1).zoom).toBe(1);
  });
});

describe('the rows a viewport needs', () => {
  const layout = layoutPages(
    Array.from({ length: 50 }, () => LETTER),
    frame,
    1,
    1,
  );

  it('finds the pages in view, with overscan', () => {
    expect(visibleRange(layout.boxes, 0, 844)).toEqual({ first: 0, last: 1 });
    const page10 = layout.boxes[10]?.top ?? 0;
    const range = visibleRange(layout.boxes, page10 + 10, 844);
    expect(range.first).toBe(10);
    expect(range.last).toBeGreaterThanOrEqual(11);
    const wide = visibleRange(layout.boxes, page10 + 10, 844, 1000);
    expect(wide.first).toBeLessThan(10);
  });

  it('names the most visible page between the bars', () => {
    const page3 = layout.boxes[3]?.top ?? 0;
    expect(
      mostVisiblePage(layout.boxes, visibleRange(layout.boxes, page3, 844), page3, page3 + 600),
    ).toBe(3);
  });
});

describe('zoom anchors', () => {
  const sizes = Array.from({ length: 5 }, () => LETTER);
  const fit = layoutPages(sizes, frame, 1, 1);
  const zoomed = layoutPages(sizes, frame, 2, 1);

  it('keeps the point under the fingers when the zoom changes', () => {
    const page2 = fit.boxes[2]?.top ?? 0;
    const scroll = { left: 0, top: page2 - 100 };
    const point = { x: 200, y: 300 };
    const anchor = anchorAt(fit, scroll.left, scroll.top, point.x, point.y);
    expect(anchor?.page).toBe(2);
    if (!anchor) return;
    const next = scrollForAnchor(zoomed, frame, anchor, point.x, point.y);
    // The same document point is under (200, 300) after the change.
    const box = zoomed.boxes[2];
    expect((box?.left ?? 0) + anchor.fx * (box?.width ?? 0) - next.left).toBeCloseTo(200, 6);
    expect((box?.top ?? 0) + anchor.fy * (box?.height ?? 0) - next.top).toBeCloseTo(300, 6);
  });

  it('clamps the scroll position to the content', () => {
    const anchor = anchorAt(fit, 0, 0, 5, 5);
    if (!anchor) throw new Error('no anchor');
    expect(scrollForAnchor(fit, frame, anchor, 300, 300)).toEqual({ left: 0, top: 0 });
  });

  it('a pinch keeps the content point under the fingers’ centre', () => {
    const scroll = { left: 0, top: 500 };
    const t = pinchTransform(scroll, { x: 100, y: 200 }, { x: 120, y: 240 }, 1.5);
    // Content point under (100, 200) at the start, shown with the transform.
    const content = { x: scroll.left + 100, y: scroll.top + 200 };
    expect(t.x + t.scale * content.x - scroll.left).toBeCloseTo(120, 6);
    expect(t.y + t.scale * content.y - scroll.top).toBeCloseTo(240, 6);
  });

  it('the settle transform shows the old layout where the new one lands, page for page', () => {
    const scroll = { left: 0, top: (fit.boxes[1]?.top ?? 0) - 50 };
    const anchor = anchorAt(fit, scroll.left, scroll.top, 195, 400);
    if (!anchor) throw new Error('no anchor');
    const next = scrollForAnchor(zoomed, frame, anchor, 195, 400);
    const t = settleTransform(fit, scroll, zoomed, next, anchor.page);
    // Every page, not only the anchor's, lands on its new box (gaps scale with the zoom).
    for (const index of [0, 1, 2, 3]) {
      const from = fit.boxes[index];
      const to = zoomed.boxes[index];
      if (!from || !to) continue;
      expect(t.x + t.scale * from.left - scroll.left).toBeCloseTo(to.left - next.left, 0);
      expect(t.y + t.scale * from.top - scroll.top).toBeCloseTo(to.top - next.top, 0);
    }
    expect(nearlySame(settleTransform(fit, scroll, fit, scroll, 1), IDENTITY)).toBe(true);
  });

  it('double tap toggles fit and 2×; a pinch resists past the range', () => {
    expect(doubleTapZoom(1)).toBe(2);
    expect(doubleTapZoom(2)).toBe(1);
    expect(doubleTapZoom(3.4)).toBe(1);
    expect(rubberZoom(3)).toBe(3);
    expect(rubberZoom(7)).toBe(5.5);
    expect(rubberZoom(0.6)).toBeCloseTo(0.9, 6);
  });
});
