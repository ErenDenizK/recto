/**
 * The tab list's scroll edges (XD-3). When the open documents do not fit, the tab list scrolls;
 * a tab cut at the edge showed a bare colour dot or half a glyph, the look the review flagged.
 * This marks the list with `data-more-start` and `data-more-end` while tabs lie beyond that
 * edge, so TabBar.module.css fades the edge out (the strip says "more this way" instead of
 * cutting a name), and keeps the active tab in view when the window or the tabs change size
 * (a tablet turned to portrait). Until D2's "N more" overflow menu (01-frame F4 §2) replaces
 * scrolling, this is the strip's overflow.
 */
import { useCallback } from 'react';

/** Sub-pixel slack, so a list scrolled to its end does not still read as "more". */
const EDGE_SLACK = 1;
/** The faded edge (TabBar.module.css, also the list's `scroll-padding-inline`), CSS px. */
const EDGE_FADE = 24;

function markEdges(list: HTMLElement): void {
  const max = list.scrollWidth - list.clientWidth;
  // `scrollLeft` is negative in a right-to-left list; the edges are by magnitude.
  const at = Math.abs(list.scrollLeft);
  list.toggleAttribute('data-more-start', max > EDGE_SLACK && at > EDGE_SLACK);
  list.toggleAttribute('data-more-end', max > EDGE_SLACK && at < max - EDGE_SLACK);
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

/** A ref callback for the `tablist`: wires the edge marks and the resize reveal. */
export function useTablistEdges(): (list: HTMLElement | null) => (() => void) | undefined {
  return useCallback((list: HTMLElement | null) => {
    if (!list) return undefined;
    const update = () => markEdges(list);
    const onResize = () => {
      revealActive(list);
      update();
    };
    const resize = new ResizeObserver(onResize);
    resize.observe(list);
    // Tabs opened, closed or renamed change the content's width, not the list's box.
    const mutation = new MutationObserver(onResize);
    mutation.observe(list, { childList: true, subtree: true, characterData: true });
    list.addEventListener('scroll', update, { passive: true });
    update();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      list.removeEventListener('scroll', update);
    };
  }, []);
}
