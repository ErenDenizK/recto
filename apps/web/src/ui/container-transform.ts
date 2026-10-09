/**
 * The container transform, applied once for every menu, popover and select popup
 * (motion-2026-10/platform.md §1; `motion/container.ts` for the motion itself).
 *
 * The menu and popover recipes (`Menu.module.css`, `Popover.module.css`, and Select's popup,
 * which composes the menu's) carry the global class `ct-popup`. One document-level observer
 * watches those popups mount and close, whoever renders them, so no caller wires anything:
 *
 * - **Open.** The popup's trigger is the control that `aria-controls` it (Base UI's menu,
 *   popover and select triggers), else the control pressed a moment ago (`press-origin.ts`:
 *   a popover opened by a plain button, a context menu on a swatch or a tab). The popup is
 *   marked `data-ct`, which turns off the recipe's CSS entrance and exit (its starting and
 *   ending styles still set the opacity Base UI and the tests read), and once Base UI's
 *   positioner has placed it (the positioner rests at opacity 0 until then), it grows from the
 *   trigger's rect into its own on `quick`.
 * - **Close.** When Base UI puts it in its ending style, it goes back into the trigger on
 *   `press`, if the trigger is still on screen; the trigger then takes it in with the *receive*
 *   pulse. With the trigger gone it leaves as the recipe's exit (0.98 and a fade,
 *   `--duration-fast`). Reopened mid-close, it turns back from where it is.
 * - **At once.** A popup Base UI opens or closes at once (`data-instant`: a keyboard press, a
 *   dismissal) and the menu → sheet hand-off (`menu-handoff.ts`) skip the motion.
 * - **Not** a submenu (it opens beside its row, and the pointer travels into it) or a popup
 *   with no trigger (a context menu on the page): those keep the recipe's CSS motion.
 * - While a popup is open its trigger keeps the pressed state: Base UI's `data-popup-open`, or
 *   `data-origin-open` written here on a pressed control that is not a Base UI trigger
 *   (`styles/controls.css`, `IconButton`, `MenuButton`).
 */
import {
  type ContainerMotion,
  containerMotion,
  containerStart,
  duration,
  EASE,
  EXIT_SCALE,
  radiusOf,
  receivePulse,
  reducedMotion,
} from '../motion';
import {
  controllerOf,
  installPressOrigin,
  onScreen,
  recentOrigin,
  setPopupOwner,
} from './press-origin';

/** The global class of every popup the container transform serves. */
export const CONTAINER_POPUP = 'ct-popup';
/** A popup opened from a control this long after its press grows from it. */
const POPUP_ORIGIN_MS = 600;

interface Entry {
  readonly trigger: HTMLElement;
  /** Set when the trigger is not a Base UI trigger, so it shows its pressed state itself. */
  readonly marked: boolean;
  motion: ContainerMotion | null;
  closing: boolean;
  /** Stops waiting for the positioner. */
  cancelWait?: (() => void) | undefined;
}

const entries = new WeakMap<HTMLElement, Entry>();
const closing = new Set<HTMLElement>();
let installed = false;

/** The positioner Base UI wraps the popup in (it rests at opacity 0 until placed). */
const positionerOf = (popup: HTMLElement): HTMLElement => popup.parentElement ?? popup;

/** The popup's laid-out box: its positioner's, which no animation of the popup moves. */
const boxOf = (popup: HTMLElement): DOMRect => {
  const parent = popup.parentElement;
  return parent?.matches('[role="presentation"]')
    ? parent.getBoundingClientRect()
    : popup.getBoundingClientRect();
};

function triggerOf(popup: HTMLElement): { el: HTMLElement; marked: boolean } | null {
  const own = controllerOf(popup);
  if (own) return own.matches('[role^="menuitem"]') ? null : { el: own, marked: false };
  const pressed = recentOrigin(POPUP_ORIGIN_MS)?.el;
  if (!pressed || popup.contains(pressed) || pressed.closest(`.${CONTAINER_POPUP}`)) return null;
  return onScreen(pressed) ? { el: pressed, marked: true } : null;
}

function start(popup: HTMLElement, entry: Entry): void {
  if (!popup.isConnected || entry.closing) return;
  const box = boxOf(popup);
  const t = entry.trigger.getBoundingClientRect();
  if (box.width === 0 || t.width === 0) return;
  const geometry = containerStart(t, box, radiusOf(entry.trigger, t.width, t.height));
  entry.motion = containerMotion(popup, geometry, radiusOf(popup, box.width, box.height));
  entry.motion.to(1);
}

function mount(popup: HTMLElement): void {
  if (entries.has(popup) || popup.hasAttribute('data-instant')) return;
  if (popup.hasAttribute('data-ending-style')) return;
  const trigger = triggerOf(popup);
  if (!trigger) return;
  const entry: Entry = {
    trigger: trigger.el,
    marked: trigger.marked,
    motion: null,
    closing: false,
  };
  entries.set(popup, entry);
  setPopupOwner(popup, entry.trigger);
  popup.dataset.ct = '';
  if (entry.marked) entry.trigger.setAttribute('data-origin-open', '');
  const positioner = positionerOf(popup);
  if (positioner.style.opacity !== '0') {
    start(popup, entry);
    return;
  }
  // Placed in a later commit: start in the same task, before it paints.
  const wait = new MutationObserver(() => {
    if (positioner.style.opacity === '0') return;
    wait.disconnect();
    entry.cancelWait = undefined;
    start(popup, entry);
  });
  wait.observe(positioner, { attributes: true, attributeFilter: ['style'] });
  entry.cancelWait = () => wait.disconnect();
}

/** The recipe's exit, for a popup whose trigger has gone. */
function fallbackExit(popup: HTMLElement): Animation {
  return popup.animate(
    [
      { opacity: '1', transform: 'none' },
      { opacity: '0', transform: reducedMotion() ? 'none' : `scale(${EXIT_SCALE})` },
    ],
    { duration: duration('fast'), easing: EASE.exit, fill: 'forwards' },
  );
}

function close(popup: HTMLElement): void {
  const entry = entries.get(popup);
  if (!entry || entry.closing) return;
  entry.closing = true;
  entry.cancelWait?.();
  if (entry.marked) entry.trigger.removeAttribute('data-origin-open');
  const atOnce =
    popup.hasAttribute('data-instant') ||
    document.documentElement.hasAttribute('data-menu-handoff');
  const motion = entry.motion;
  if (atOnce) {
    if (motion) {
      motion.to(0);
      motion.finish();
    }
    return;
  }
  const home = onScreen(entry.trigger);
  if (!motion || (!home && motion.progress >= 1)) {
    if (motion) fallbackExit(popup);
    return;
  }
  closing.add(popup);
  if (home && motion.progress >= 1) {
    // At rest: re-read the geometry, the trigger or the popup may have moved since it opened.
    const t = entry.trigger.getBoundingClientRect();
    const box = boxOf(popup);
    motion.to(0, containerStart(t, box, radiusOf(entry.trigger, t.width, t.height)));
  } else {
    motion.to(0);
  }
  const run = motion.finished;
  void run.then(() => {
    closing.delete(popup);
    if (entry.closing && motion.finished === run && onScreen(entry.trigger)) {
      receivePulse(entry.trigger);
    }
  });
}

function unmounted(popup: HTMLElement): void {
  const entry = entries.get(popup);
  if (!entry) return;
  entry.cancelWait?.();
  closing.delete(popup);
  if (entry.marked && !entry.closing) entry.trigger.removeAttribute('data-origin-open');
  entries.delete(popup);
}

/** Reopened while it closed (Base UI drops the ending style): back from where it is. */
function reopen(popup: HTMLElement): void {
  const entry = entries.get(popup);
  if (!entry?.closing || !popup.isConnected) return;
  entry.closing = false;
  closing.delete(popup);
  if (entry.marked) entry.trigger.setAttribute('data-origin-open', '');
  entry.motion?.to(1);
}

/** Every popup of the recipe in `node`, itself included. */
function popupsIn(node: Node): HTMLElement[] {
  if (!(node instanceof HTMLElement)) return [];
  const found = [...node.querySelectorAll<HTMLElement>(`.${CONTAINER_POPUP}`)];
  return node.classList.contains(CONTAINER_POPUP) ? [node, ...found] : found;
}

/** Starts serving every popup of the recipes (idempotent; the app calls it once). */
export function installContainerTransform(): void {
  if (installed || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return;
  }
  installed = true;
  installPressOrigin();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of record.addedNodes) popupsIn(node).forEach(mount);
        // Unmounted without an exit (a caller that renders it only while open): the trigger's
        // pressed state goes with it.
        for (const node of record.removedNodes) popupsIn(node).forEach(unmounted);
        continue;
      }
      const el = record.target;
      if (el === document.documentElement && el instanceof HTMLElement) {
        // The menu → sheet hand-off: whatever is closing goes at once.
        if (el.hasAttribute('data-menu-handoff')) {
          for (const popup of closing) entries.get(popup)?.motion?.finish();
        }
        continue;
      }
      if (!(el instanceof HTMLElement) || !el.classList.contains(CONTAINER_POPUP)) continue;
      if (el.hasAttribute('data-ending-style')) close(el);
      else reopen(el);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-ending-style'],
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-menu-handoff'],
  });
}
