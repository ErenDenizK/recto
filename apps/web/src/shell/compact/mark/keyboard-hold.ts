/**
 * Holding the keyboard while an editor loads (EDN-17; code-audit §2 "Edit text", risk "the iOS
 * keyboard in ParagraphEditor"). iOS Safari raises the on-screen keyboard only for a `focus()`
 * made while a tap is being handled; the paragraph editor takes its focus later, once the
 * engine has laid the paragraph out (`ParagraphEditor`'s mirror is editable only then), so its
 * own focus would leave the keyboard down.
 *
 * So the tap focuses a stand-in at once: an invisible editable at the tap point, 16 px (iOS
 * never zooms for it), outside the page's layers. The keyboard rises for it; when the editor's
 * mirror (or the line editor's field) takes the focus, iOS keeps the keyboard up, since focus
 * moves from one editable to another, and the stand-in is removed. It never takes text (a
 * keystroke before the editor is ready is dropped, as the editor's own mirror drops it), and
 * it lets the keyboard go when nothing took the focus: `until` turns false, or after
 * `HOLD_MAX_MS` at the latest.
 *
 * Removed once handed over, the stand-in is never where an editor's "focus back" lands: the
 * paragraph editor then falls back to the pages (`ParagraphEditor` `restoreFocus`), which
 * lowers the keyboard as it closes.
 */

/** The stand-in lets go at the latest after this long, ms. */
export const HOLD_MAX_MS = 15_000;
/** How often `until` is asked, ms. */
const CHECK_MS = 250;
/** The stand-in's font size: iOS zooms for an editable under 16 px. */
const HOLD_FONT_PX = 16;

let proxy: HTMLElement | null = null;
let until: (() => boolean) | undefined;
let timer: number | undefined;
let started = 0;

/** Removes the stand-in without touching the focus (it has already moved on). */
function drop(): void {
  window.clearInterval(timer);
  timer = undefined;
  until = undefined;
  document.removeEventListener('focusin', onFocusIn, true);
  const el = proxy;
  proxy = null;
  el?.remove();
}

function onFocusIn(event: FocusEvent): void {
  if (event.target !== proxy) drop();
}

function check(): void {
  if (!proxy) return;
  const expired = performance.now() - started > HOLD_MAX_MS;
  if (expired || (until !== undefined && !until())) releaseKeyboard();
}

/**
 * Focuses the stand-in at `at` (client px) now, inside the tap's handling, so the keyboard
 * rises; `keep` says while it should wait for an editor (default: until `HOLD_MAX_MS`).
 */
export function holdKeyboard(
  at: { readonly x: number; readonly y: number },
  keep?: () => boolean,
): void {
  drop();
  const el = document.createElement('div');
  el.contentEditable = 'true';
  el.tabIndex = -1;
  el.spellcheck = false;
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('autocorrect', 'off');
  el.dataset.keyboardHold = '';
  const x = Math.max(0, Math.min(at.x, window.innerWidth - 1));
  const y = Math.max(0, Math.min(at.y, window.innerHeight - 1));
  Object.assign(el.style, {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    width: '1px',
    height: '1px',
    margin: '0',
    padding: '0',
    border: '0',
    overflow: 'hidden',
    opacity: '0',
    color: 'transparent',
    caretColor: 'transparent',
    outline: 'none',
    fontSize: `${HOLD_FONT_PX}px`,
    pointerEvents: 'none',
    whiteSpace: 'pre',
  });
  el.addEventListener('beforeinput', (event) => event.preventDefault());
  document.body.append(el);
  proxy = el;
  until = keep;
  started = performance.now();
  document.addEventListener('focusin', onFocusIn, true);
  timer = window.setInterval(check, CHECK_MS);
  el.focus({ preventScroll: true });
}

/** What `holdKeyboard` waits for, replaced (the editor's chunk knows better once loaded). */
export function keepHolding(keep: () => boolean): void {
  if (proxy) until = keep;
}

/** Lets the keyboard go: the stand-in loses the focus (when it still has it) and goes. */
export function releaseKeyboard(): void {
  if (proxy && document.activeElement === proxy) proxy.blur();
  drop();
}

/** Whether the stand-in is holding the keyboard. */
export function isHoldingKeyboard(): boolean {
  return proxy !== null && document.activeElement === proxy;
}
