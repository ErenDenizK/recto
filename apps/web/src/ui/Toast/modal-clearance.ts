/**
 * Keeps the toast stack off an open modal sheet (DSN-58; 07-sheets §1.1 rule 6; FB4 §4, A-24).
 * Toasts sit above a modal sheet so one about the sheet's work stays readable, but a paused
 * toast must never cover the sheet's own controls. In the full edition, while a modal popup is
 * open and the stack's row crosses it:
 *
 * - the stack centres in the room beside the popup on its row (a side sheet: the room on its
 *   left), when its widest toast fits there;
 * - else it yields (a bottom sheet, a tall centred dialog): it is hidden (`data-yield`, visibility, as the phone's DSN-56), its timers
 *   already paused by the modal, and it comes back with the time it had left as the sheet goes.
 *
 * The stack never moves down: its row is the lowest it may sit, above the dock band and the
 * capsule (01-frame F13), and that row crosses the popup, so a place under the popup's foot
 * would lie over the band; with no room beside it, it yields.
 *
 * Geometry is read without transforms (`offsetLeft`/`offsetTop`), so a panel still on its
 * entrance spring is placed where it will rest.
 */

/** What the region counts as a modal popup (the `modal` pause reads the same). */
export const MODAL_POPUP = '[role="dialog"][aria-modal="true"], [role="alertdialog"]';

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** An element's layout box in the viewport, before any transform. */
function layoutBox(el: HTMLElement): Box {
  let left = 0;
  let top = 0;
  for (let e: HTMLElement | null = el; e; e = e.offsetParent as HTMLElement | null) {
    left += e.offsetLeft;
    top += e.offsetTop;
  }
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight };
}

/**
 * Places `region` clear of every open modal popup, or hides it when there is no room; with no
 * modal open, back where it rests. It starts from where the region rests each time.
 */
export function clearModals(region: HTMLElement): void {
  resetClearance(region);
  const toasts = [...region.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
  if (toasts.length === 0) return;
  const rect = region.getBoundingClientRect();
  const css = getComputedStyle(region);
  const padding = Number.parseFloat(css.paddingInlineStart) || 0;
  const need = Math.max(...toasts.map((t) => t.offsetWidth)) + 2 * padding;
  const crossing = [...document.querySelectorAll<HTMLElement>(MODAL_POPUP)]
    .map(layoutBox)
    .filter(
      (box) =>
        box.bottom > rect.top &&
        box.top < rect.bottom &&
        box.right > rect.left &&
        box.left < rect.right,
    );
  const [box] = crossing;
  if (!box) return;
  if (crossing.length === 1) {
    const before = box.left - rect.left;
    const after = rect.right - box.right;
    // Beside it on the row (a side sheet).
    if (Math.max(before, after) >= need) {
      if (before >= after) {
        region.style.setProperty('--toast-clear-right', `${Math.round(rect.right - box.left)}px`);
      } else {
        region.style.setProperty('--toast-clear-left', `${Math.round(box.right - rect.left)}px`);
      }
      return;
    }
  }
  region.setAttribute('data-yield', '');
}

/** Lets the region rest where it is again. */
export function resetClearance(region: HTMLElement): void {
  region.style.removeProperty('--toast-clear-left');
  region.style.removeProperty('--toast-clear-right');
  region.removeAttribute('data-yield');
}
