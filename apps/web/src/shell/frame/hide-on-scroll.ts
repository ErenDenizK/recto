/**
 * Hide on scroll (`components/01-frame.md` F12; flows.md §6.1; research 19 M-14 with C's A-12
 * safeguards; `language.md` §7.3 *hide on scroll*): on compact and compact-height, in viewing
 * only, the compact bar and the dock move away after 24 px of scrolling down and come back
 * on 8 px up. Nothing hides by itself from medium up.
 *
 * - **Shows** on an upward scroll of 8 px, at either end of the file, on any key, on focus
 *   moving into chrome, on a sheet or menu opening, and on a tap on the page that is not a
 *   target (the page's own controls keep their taps).
 * - **Never hides** with keyboard modality (the last input a key), focus inside the bar or the
 *   dock, Markup, the grid, Compare, a dialog open, "Keep tools visible" on, or a file of one
 *   screen or less (no room to scroll: both ends at once).
 * - Hidden bars are `inert` from the first frame (A-13: focus never lands on an invisible
 *   control) and move by `transform` only; the free rectangle does not change, so the page
 *   never reflows (`frame-insets.ts`).
 *
 * `hideOnScroll` is the pure reducer (`hide-on-scroll.test.ts`); `useHideOnScroll` wires it
 * to the reader's scroll, keys and taps and writes `frame-store`'s `chromeHidden`.
 */
import { useEffect } from 'react';

import { lastInput } from './input-modality';
import { setChromeHidden, useFrameStore } from './frame-store';

/** Cumulative downward scroll that hides the bars (F12 §4). */
export const HIDE_AFTER = 24;
/** Upward scroll that shows them again. */
export const SHOW_AFTER = 8;

export interface HideState {
  readonly hidden: boolean;
  /** Scroll travelled in the current direction: positive down, negative up. */
  readonly travel: number;
  /** The scroll position last seen. */
  readonly top: number;
}

export const SHOWN: HideState = { hidden: false, travel: 0, top: 0 };

export interface ScrollInput {
  /** `scrollTop` now. */
  readonly top: number;
  /** The largest `scrollTop` (`scrollHeight − clientHeight`). */
  readonly max: number;
  /** A "never hides" condition holds (F12 §4). */
  readonly blocked: boolean;
}

/** One scroll event: the next state. */
export function hideOnScroll(state: HideState, input: ScrollInput): HideState {
  const { top, max, blocked } = input;
  const delta = top - state.top;
  // Either end of the file (also a file of one screen, where both ends meet): shown.
  if (blocked || top <= 0 || top >= max - 1) return { hidden: false, travel: 0, top };
  if (delta === 0) return { ...state, top };
  // A change of direction starts the count again.
  const travel = Math.sign(delta) === Math.sign(state.travel) ? state.travel + delta : delta;
  if (!state.hidden && travel >= HIDE_AFTER) return { hidden: true, travel, top };
  if (state.hidden && travel <= -SHOW_AFTER) return { hidden: false, travel, top };
  return { hidden: state.hidden, travel, top };
}

/** Taps on these never count as "a tap on the page that is not a target". */
const TARGETS =
  'a, button, input, textarea, select, [contenteditable="true"], [role="button"], [role="link"], [data-annotation-id], [data-field], [data-link]';

/**
 * Runs hide on scroll while `enabled` (compact or compact-height, viewing); `blocked` is
 * read at each scroll for the conditions the frame knows (Markup, the grid, Compare, "Keep
 * tools visible"); keyboard modality, focus in chrome and open dialogs are read here.
 */
export function useHideOnScroll(enabled: boolean, blocked: () => boolean): void {
  useEffect(() => {
    if (!enabled) {
      setChromeHidden(false);
      return;
    }
    let state = SHOWN;
    const show = () => {
      state = { ...state, hidden: false, travel: 0 };
      if (!useFrameStore.getState().chromeHidden) return;
      // At once, before the key acts: Tab and F6 must find the bars (React re-renders after).
      for (const bar of document.querySelectorAll('[data-hides-on-scroll][inert]')) {
        bar.removeAttribute('inert');
      }
      setChromeHidden(false);
    };
    const chromeHasFocus = () =>
      document.activeElement?.closest('[data-region="top"], [data-frame-layer="band"]') != null;
    const dialogOpen = () =>
      document.querySelector('[role="dialog"], [role="alertdialog"]') != null;
    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.hasAttribute('data-read-viewport')) return;
      state = hideOnScroll(state, {
        top: target.scrollTop,
        max: target.scrollHeight - target.clientHeight,
        blocked: blocked() || lastInput() === 'keyboard' || chromeHasFocus() || dialogOpen(),
      });
      if (useFrameStore.getState().chromeHidden !== state.hidden) setChromeHidden(state.hidden);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!useFrameStore.getState().chromeHidden) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[data-read-viewport]') || target.closest(TARGETS)) return;
      show();
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-region="top"], [data-frame-layer="band"], [role="dialog"]'))
        show();
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    // Any key shows the bars before it acts (F12 §6: Tab and F6 never land in a hidden bar).
    window.addEventListener('keydown', show, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', show, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      setChromeHidden(false);
    };
  }, [enabled, blocked]);
}
