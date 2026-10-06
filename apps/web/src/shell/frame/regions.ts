/**
 * F6 / Shift+F6 between the frame's regions (spec X9; flows.md §7.2; `components/01-frame.md`
 * §15; A-13): one implementation of the cycle, which takes over `shell/LeftRail.regions.ts`.
 *
 *   top strip (or the compact bar) → sidebar → page → tool sheet → facts chip → pending-marks
 *   bar → dock or palette → contextual bar → page pill → inspector (until D2-9) → toasts
 *
 * - **Landing targets:** the active tab (the Library: ◆), the sidebar's current item, the page
 *   viewport, the sheet's first control, the chip, Apply, the last focused dock item, the bar,
 *   the pill, the newest toast's action.
 * - Regions that are absent, have no box, or are `inert` (hidden on scroll, away in Focus) are
 *   passed by; any key shows hidden bars first (`hide-on-scroll.ts`), so F6 then finds them.
 * - Modal sheets and the title menu trap focus and sit outside the cycle: F6 does nothing
 *   while focus is in a dialog or a menu (they keep their own keyboard).
 *
 * The slots of families that land later (tool sheets, the facts chip, the pending-marks bar,
 * contextual bars) are named here by their `data-region`, so each joins the cycle by setting
 * it, with no change to this list.
 */
import { useEffect } from 'react';

/** Region selectors in F6 order, searched in the whole document (sheets portal out). */
export const REGIONS = [
  '[data-region="top"]',
  '[data-region="navigator"]',
  '#stage',
  '[data-region="tool-sheet"]',
  '[data-region="facts"]',
  '[data-region="pending"]',
  '[data-region="toolbar"]',
  '[data-region="context"]',
  '[data-region="pill"]',
  '#right-panel',
  '[data-region="toasts"]',
] as const;

/** Where focus lands in a region, best first. */
const TARGETS = [
  // The toast region: the newest toast's action, else its first button.
  '[data-toast-newest] [data-toast-action]',
  '[data-toast-newest] button',
  '[role="tab"][tabindex="0"]',
  // The Library: the card that holds the grid's Tab stop.
  '[role="option"][tabindex="0"]',
  '[data-read-viewport]',
  '[aria-pressed="true"][tabindex="0"]',
  '[tabindex="0"]',
  'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
] as const;

/** Shown and reachable: it has a box and no `inert` on it or an ancestor. */
function reachable(element: Element): boolean {
  return element.getClientRects().length > 0 && element.closest('[inert]') === null;
}

/** The regions on screen now, in cycle order. */
export function regionsOf(doc: Document): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const selector of REGIONS) {
    for (const element of doc.querySelectorAll<HTMLElement>(selector)) {
      if (!found.includes(element) && reachable(element)) {
        found.push(element);
        break;
      }
    }
  }
  return found;
}

function focusRegion(region: HTMLElement): void {
  // The region itself may be the target (the page pill is one button).
  if (region.matches('button, [tabindex="0"]') && reachable(region)) {
    region.focus();
    return;
  }
  for (const selector of TARGETS) {
    const target = region.querySelector<HTMLElement>(selector);
    if (target && reachable(target)) {
      target.focus();
      return;
    }
  }
  if (!region.hasAttribute('tabindex')) region.setAttribute('tabindex', '-1');
  region.focus();
}

/** Cycles focus to the next (+1) or previous (-1) region; returns whether it moved. */
export function cycleRegion(doc: Document, direction: 1 | -1): boolean {
  const regions = regionsOf(doc);
  if (regions.length === 0) return false;
  const active = doc.activeElement;
  // The innermost region holding focus.
  let at = -1;
  regions.forEach((region, i) => {
    if (active && region.contains(active) && (at < 0 || regions[at]?.contains(region))) at = i;
  });
  const next =
    at < 0
      ? direction > 0
        ? 0
        : regions.length - 1
      : (at + direction + regions.length) % regions.length;
  const region = regions[next];
  if (!region) return false;
  focusRegion(region);
  return true;
}

/** Installs the F6 handler while mounted (the app shell). */
export function useRegionCycling(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F6' || event.altKey || event.ctrlKey || event.metaKey) return;
      const active = document.activeElement;
      if (active?.closest('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      if (cycleRegion(document, event.shiftKey ? -1 : 1)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
