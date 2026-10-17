/**
 * The tab list's scroll edges (XD-3). When the open documents do not fit, the tab list scrolls;
 * a tab cut at the edge showed a bare colour dot or half a glyph, the look the review flagged.
 * This marks the list with `data-more-start` and `data-more-end` while tabs lie beyond that
 * edge, so frame/TopStrip.module.css fades the edge out (the strip says "more this way" instead of
 * cutting a name), and keeps the active tab in view when the window or the tabs change size
 * (a tablet turned to portrait). Until D2's "N more" overflow menu (01-frame F4 §2) replaces
 * scrolling, this is the strip's overflow.
 *
 * Motion inside the list widens its scrollable overflow for a while without a resize or a DOM
 * change: the active tab's fill sliding by `transform` and `width` from where the last one was
 * drawn (tab-motion.ts) reaches past the list's end as tabs move into "N more", the more so when
 * the window narrows mid-slide (the slide keeps the width it set out for). So while any finite
 * animation runs in the list the edges are read every frame, and once more a frame after the
 * last one has finished: the list marks its edge for as long as it scrolls, and a fade marked
 * mid-slide does not stay on a list that no longer scrolls.
 */
import { useCallback } from 'react';

/** Sub-pixel slack, so a list scrolled to its end does not still read as "more". */
const EDGE_SLACK = 1;
/** The faded edge (frame/TopStrip.module.css, also the list's `scroll-padding-inline`), CSS px. */
const EDGE_FADE = 24;

function markEdges(list: HTMLElement): void {
  const max = list.scrollWidth - list.clientWidth;
  const scrolls = max > EDGE_SLACK;
  // `scrollLeft` is negative in a right-to-left list; the edges are by magnitude.
  const at = Math.abs(list.scrollLeft);
  let start = scrolls && at > EDGE_SLACK;
  let end = scrolls && at < max - EDGE_SLACK;
  // A list that scrolls by only a little, with the active tab centred in it (`revealActive`),
  // is within the slack of both ends at once: 2 px of overflow scrolled by 1. Its tabs still
  // lie beyond both edges, so both fade; an overflowing list always marks an edge (XD-3).
  if (scrolls && !start && !end) start = end = true;
  list.toggleAttribute('data-more-start', start);
  list.toggleAttribute('data-more-end', end);
}

function revealActive(list: HTMLElement): void {
  // The active tab is the one Tab stop (APG roving), also on Home where none is selected.
  const tab = list.querySelector<HTMLElement>('[role="tab"][tabindex="0"]');
  if (!tab) return;
  const box = tab.getBoundingClientRect();
  const view = list.getBoundingClientRect();
  // Clear of the faded edges where the list is wide enough, as `scroll-padding-inline` does
  // for the activation's scrollIntoView.
  const fade = Math.min(EDGE_FADE, Math.max(0, (view.width - box.width) / 2));
  if (box.left < view.left + fade) list.scrollLeft -= view.left + fade - box.left;
  else if (box.right > view.right - fade) list.scrollLeft += box.right - (view.right - fade);
}

/** The finite animations running in `list`'s subtree (an endless one never settles). */
function moving(list: HTMLElement): Animation[] {
  return list
    .getAnimations({ subtree: true })
    .filter(
      (a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime),
    );
}

/** A ref callback for the `tablist`: wires the edge marks and the resize reveal. */
export function useTablistEdges(): (list: HTMLElement | null) => (() => void) | undefined {
  return useCallback((list: HTMLElement | null) => {
    if (!list) return undefined;
    let frame = 0;
    const update = () => {
      markEdges(list);
      // Follow the motion that may stretch the overflow frame by frame, and read once more a
      // frame after it has finished, when its own finish handler has left the element at rest.
      if (frame !== 0 || moving(list).length === 0) return;
      let still = 0;
      const step = () => {
        markEdges(list);
        still = moving(list).length === 0 ? still + 1 : 0;
        frame = still > 1 ? 0 : requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    const onResize = () => {
      revealActive(list);
      update();
    };
    const resize = new ResizeObserver(onResize);
    resize.observe(list);
    // Tabs opened, closed or renamed change the content's width, not the list's box.
    const mutation = new MutationObserver(onResize);
    mutation.observe(list, { childList: true, subtree: true, characterData: true });
    // A new selection starts the fill's slide, and a tab growing in or collapsing changes its
    // own sizing (`data-tab-motion`): attributes on the tabs, read with the motion they start.
    const motion = new MutationObserver(update);
    motion.observe(list, {
      subtree: true,
      attributeFilter: ['data-selected', 'data-tab-motion'],
    });
    list.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      motion.disconnect();
      list.removeEventListener('scroll', update);
    };
  }, []);
}
