/**
 * Where a popup or a sheet comes from (motion-2026-10/platform.md §1): the control the person
 * last pressed, so what it opens can grow out of it and go back into it ("things come out of
 * the button you pressed and go back into it", owner, R14).
 *
 * One capture-phase listener on the document notes every press of a control (a pointer down or
 * a click on it, Enter or Space while it has focus) with its rect at that moment. A surface that
 * opens shortly after reads it with `recentOrigin()`. A press inside a menu or a list box also
 * names where its result returns: the menu's own trigger (a menu item vanishes with its menu,
 * `ui/menu-handoff.ts`), followed up through submenus to the control on the page.
 *
 * Keyboard shortcuts note nothing (their key lands on whatever has focus), nor do presses on
 * the page or anything larger than a control, so a context menu or a sheet opened by a
 * shortcut keeps its own entrance.
 */

/** What a press can come from: a control, a row of a menu or a list box, a tab, a link. */
const CONTROL =
  'button, [role="button"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"], [role="tab"], [role="switch"], a[href]';
/** A press counts for this long after it (a click opens a surface within a frame or two). */
export const ORIGIN_MAX_AGE_MS = 1000;
/** Anything larger than this on either side is a surface, not a control. */
const MAX_CONTROL_PX = 320;

export interface PressOrigin {
  /** The control pressed. */
  readonly el: HTMLElement;
  /** Its rect when it was pressed. */
  readonly rect: DOMRect;
  /** Where a surface it opened returns: the control itself, or the menu's trigger. */
  readonly returnTo: HTMLElement;
  /** `performance.now()` of the press. */
  readonly at: number;
}

let last: PressOrigin | null = null;
let installed = false;

/** The control a popup belongs to: whoever controls it (`aria-controls`), if it is on the page. */
export function controllerOf(popup: Element): HTMLElement | null {
  const id = popup.id;
  if (!id) return null;
  return document.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(id)}"]`);
}

/** What a press inside may return out of. */
const POPUP = '[role="menu"], [role="listbox"], .ct-popup';

/** Popups whose trigger is known though nothing `aria-controls` them (container-transform). */
const owners = new WeakMap<Element, HTMLElement>();

/** Notes that `popup` came out of `trigger`, so a press inside it returns there. */
export function setPopupOwner(popup: Element, trigger: HTMLElement): void {
  owners.set(popup, trigger);
}

/** The control a press in `el` returns to: up through menus, list boxes and popovers. */
function returnTarget(el: HTMLElement): HTMLElement {
  let at = el;
  for (let i = 0; i < 4; i++) {
    // The nearest enclosing popup that knows its trigger (a menu list inside a popover does not).
    let owner: HTMLElement | null = null;
    for (
      let popup = at.closest<HTMLElement>(POPUP);
      popup && !owner;
      popup = popup.parentElement?.closest<HTMLElement>(POPUP) ?? null
    ) {
      owner = controllerOf(popup) ?? owners.get(popup) ?? null;
    }
    if (!owner || owner === at) break;
    at = owner;
  }
  return at;
}

function note(target: EventTarget | null): void {
  if (!(target instanceof Element)) return;
  const el = target.closest<HTMLElement>(CONTROL);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.width > MAX_CONTROL_PX || rect.height > MAX_CONTROL_PX) return;
  last = { el, rect, returnTo: returnTarget(el), at: performance.now() };
}

/** Starts noting presses (idempotent). */
export function installPressOrigin(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('pointerdown', (e) => note(e.target), { capture: true });
  // A click from the keyboard or a script; a pointer's click re-notes the same control.
  document.addEventListener('click', (e) => note(e.target), { capture: true });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') note(e.target);
    },
    { capture: true },
  );
}

/** The last press, if it was within `maxAge` ms. */
export function recentOrigin(maxAge = ORIGIN_MAX_AGE_MS): PressOrigin | null {
  if (!last || performance.now() - last.at > maxAge) return null;
  return last;
}

/** Forgets the last press (tests). */
export function resetPressOrigin(): void {
  last = null;
}

/**
 * Whether `el` can take a surface back: in the document, laid out and visible (a modal's
 * `inert` on the page does not count: it lifts as the surface closes), and at least partly
 * inside the window.
 */
export function onScreen(el: Element | null | undefined): el is HTMLElement {
  if (!(el instanceof HTMLElement) || !el.isConnected) return false;
  if (
    el.checkVisibility &&
    !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
  ) {
    return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  return r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
}
