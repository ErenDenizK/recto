/**
 * The menu → sheet hand-off (quality-bar Q-7; the S0 sheet's motion, components/07-sheets.md
 * §2, meeting the menu recipe): a menu item that opens a sheet ("Save a copy…", "Revert to the
 * opened version…", "Settings…") closes its menu at once, as macOS does, rather than over the
 * sheet's entrance. With the menu's 120 ms fade-out the two glass surfaces showed through each
 * other for about 100 ms.
 *
 * It is done once, at the seam: the `Sheet` primitive calls `closeMenusAtOnce()` when it
 * opens, whoever opened it, and the menu recipe (`ui/Menu.module.css`) and the popover recipe
 * (`ui/Popover.module.css`) drop their exit transition while the root carries
 * `data-menu-handoff`. Only a popup in its ending style is touched, so a menu opened inside the
 * sheet (a Select) still animates. The mark lasts a little longer than a popup's exit
 * (`--duration-fast` plus the frame Base UI waits before it starts), then goes.
 */

/** How long the root keeps the mark: a popup's exit (120 ms) with a frame or two to spare. */
export const MENU_HANDOFF_MS = 250;

let timer: ReturnType<typeof setTimeout> | undefined;

/** Closing menus and popovers skip their exit fade for the next moment (a sheet opens). */
export function closeMenusAtOnce(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-menu-handoff', '');
  clearTimeout(timer);
  timer = setTimeout(() => {
    root.removeAttribute('data-menu-handoff');
    timer = undefined;
  }, MENU_HANDOFF_MS);
}
