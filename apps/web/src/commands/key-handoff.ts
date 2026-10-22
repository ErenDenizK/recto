/**
 * Keys typed during a view change go where focus is going (MOT-17). A command that opens a
 * field (Mod+F's Find) hands the keys to it from its keydown: the field takes the focus at
 * once when it can, and while it cannot yet (it mounts with the view a transition is still
 * preparing, or shows once its store update has drawn) the text typed meanwhile is held and
 * typed into the field as soon as it takes the focus, so no letter reaches the view being
 * left, where the key map reads it as a tool or a place (`t` arming the Text box).
 *
 * - **Held:** characters (no Ctrl or ⌘; Alt and AltGr type characters) and Backspace, which
 *   takes back the last held one. Ctrl/⌘ keys (app shortcuts), Enter and the arrows pass.
 * - **Ends** once the field has the focus, on Esc, Tab or a press anywhere (the held text
 *   goes), or after `HANDOFF_MS`. Polled on a timer, not on frames: a view transition holds frames while
 *   it prepares, which is how the keys were lost.
 * - One handoff at a time; a new one ends the last.
 */

/** Longest wait for the field: a view change's preparation plus its 240 ms transition. */
export const HANDOFF_MS = 1500;
/** How often the field is looked for while it cannot take the focus. */
const POLL_MS = 16;

export interface KeyHandoffOptions {
  /** Run once the field has the focus, before the held text goes in (Find selects its query). */
  readonly onFocus?: (field: HTMLElement) => void;
}

let current: (() => void) | undefined;

/** A field that can take the focus now: in the document, shown, enabled and not inert. */
function focusable(field: HTMLElement): boolean {
  if (!field.isConnected || field.closest('[inert]') !== null) return false;
  if ('disabled' in field && field.disabled === true) return false;
  return field.getClientRects().length > 0;
}

/**
 * A key that types into a field: a character without Ctrl or ⌘. Alt counts as typing (macOS
 * Option+L types @ on a German Mac), and so does AltGr, which Windows reports as Ctrl+Alt.
 */
function typesText(event: KeyboardEvent): boolean {
  if (event.isComposing || event.key.length !== 1) return false;
  const altGraph = event.getModifierState('AltGraph');
  return altGraph || (!event.ctrlKey && !event.metaKey);
}

/**
 * Types `text` into `field` at its caret (over its selection), as typing would, with the
 * `input` event a controlled field's `onChange` reads. Text fields only: a rich text field
 * is not handed keys yet.
 */
function typeInto(field: HTMLElement, text: string): void {
  if (text === '') return;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? start;
  field.setRangeText(text, start, end, 'end');
  field.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
  );
}

/**
 * Hands the keys typed from now on to the field `target` returns (undefined or null while it
 * is not there yet): focuses it now if it can, else holds the typed text until it can.
 */
export function handKeysTo(
  target: () => HTMLElement | null | undefined,
  options: KeyHandoffOptions = {},
): void {
  current?.();
  let held = '';
  let timer = 0;
  const started = performance.now();

  const end = () => {
    window.clearTimeout(timer);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('pointerdown', end, true);
    if (current === end) current = undefined;
  };

  /** Focuses the field if it can take the focus now; true once it has it. */
  const land = (): boolean => {
    const field = target();
    if (!field || !focusable(field)) return false;
    if (document.activeElement !== field) field.focus({ preventScroll: true });
    if (document.activeElement !== field) return false;
    end();
    options.onFocus?.(field);
    typeInto(field, held);
    return true;
  };

  const poll = () => {
    if (land()) return;
    if (performance.now() - started >= HANDOFF_MS) end();
    else timer = window.setTimeout(poll, POLL_MS);
  };

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      end();
      return;
    }
    const text = typesText(event);
    if (!text && event.key !== 'Backspace') return;
    // Held even when the field can take it now: the key's own typing would still go to
    // the element it was pressed on.
    event.preventDefault();
    event.stopImmediatePropagation();
    held = text ? held + event.key : held.slice(0, -1);
    land();
  }

  current = end;
  if (land()) return;
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', end, true);
  timer = window.setTimeout(poll, 0);
}
