/**
 * The pages stay still under a sheet opened while editing (phone editing WP6; New signature's
 * pad on a phone on its side, where the sheet is full and the pad takes most of it): a finger
 * that signs, or slips off the pad onto the sheet's header or footer, must never scroll the
 * page behind it.
 *
 * - The pages' scroller is locked (`data-locked`, `CompactReader.module.css`: no overflow
 *   scrolling, no pans), keeping its scroll position.
 * - A one-finger move that would not scroll something inside the sheet is cancelled
 *   (`touchmove` default prevented, non-passive), so it cannot chain to the document either,
 *   as WebKit does from a fixed layer with nothing left to scroll. Pointer events still flow,
 *   so drawing and the sheet's own swipe work as before.
 */
import { useEffect } from 'react';

/** Whether `from` sits in an element that scrolls vertically and has room to. */
function inScroller(from: EventTarget | null): boolean {
  let node = from instanceof Element ? from : null;
  while (node && node !== document.body) {
    if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight + 1) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** Locks the pages behind while `locked`. */
export function useBackgroundLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const pages = document.querySelector<HTMLElement>('[data-read-viewport]');
    if (pages) pages.dataset.locked = '';
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1 && !inScroller(event.target)) event.preventDefault();
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      if (pages) delete pages.dataset.locked;
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, [locked]);
}
