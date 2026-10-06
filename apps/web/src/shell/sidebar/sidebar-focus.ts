/**
 * Where focus goes when the sidebar opens (`components/06-navigation.md` N1 §6; 01-frame F3):
 * Mod+B moves focus to the open section's current item; ▤ keeps it on ▤. The command asks
 * with `requestSidebarFocus()`; the sidebar takes the request once its section has rendered
 * (`takeSidebarFocus`). Closing with focus inside returns it to the page.
 */
import { SIDEBAR_ID } from '../frame/ids';

let wanted = false;

/** Mod+B (and the routes that open a section to work in it): focus the current item next. */
export function requestSidebarFocus(): void {
  wanted = true;
}

/** Whether a request waits (read and cleared by the sidebar once its body is laid out). */
export function takeSidebarFocusRequest(): boolean {
  const was = wanted;
  wanted = false;
  return was;
}

/**
 * The section's current item: the element marked `data-sidebar-current` (the current page's
 * thumbnail, the tree's roving row, the current result or review row), else the body's first
 * Tab stop, else the section switch.
 */
export function sidebarCurrentItem(root: ParentNode = document): HTMLElement | null {
  const sidebar = root.querySelector<HTMLElement>(`#${SIDEBAR_ID}`);
  if (!sidebar) return null;
  const visible = (el: HTMLElement) => el.getClientRects().length > 0;
  const marked = sidebar.querySelector<HTMLElement>('[data-sidebar-current]');
  if (marked && visible(marked)) return marked;
  const body = sidebar.querySelector<HTMLElement>('[data-sidebar-body]');
  const first = Array.from(
    body?.querySelectorAll<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), [tabindex="0"]',
    ) ?? [],
  ).find((el) => el.tabIndex >= 0 && visible(el));
  if (first) return first;
  return sidebar.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
}

/** Focuses the current item; returns whether something took focus. */
export function focusSidebarItem(): boolean {
  const item = sidebarCurrentItem();
  if (!item) return false;
  item.focus({ preventScroll: true });
  item.scrollIntoView?.({ block: 'nearest' });
  return document.activeElement === item;
}
