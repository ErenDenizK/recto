/**
 * The doors into Markup and the way out (`03-markup` MK-1 §6, MK-3; flows §4.2–§4.3): the
 * dock's Markup opens the palette on its Draw set, Fill & sign on its Sign set (Select armed,
 * the saved signatures inline, the field stepper); Done, the second Esc and `1` close it.
 *
 * The dock that calls these is the frame's (D2-2's capsule); today's stand-in is the Read dock
 * in `shell/FloatingToolbar.tsx`.
 *
 * - **Opening** asks the guard first (`canChange(id, 'freehand', { opensMarkup: true })`): a
 *   locked document opens nothing (the Unlock popover is the Lock UI's). It arms Select and
 *   says "Markup on. Select armed." once (A-14).
 * - **Closing** (Done, MK-3 §6) commits an open text box or note editor, disarms, then closes
 *   Markup, and says "Markup off." Focus goes to the dock's Markup button when it was inside
 *   the palette, else it stays where it was (the page).
 */
import { commitOpenEditor } from '../annotations/InlineEditors';
import { useAnnotationStore } from '../annotations/annotation-store';
import { m } from '../i18n';
import { loadSavedSignatures } from '../signatures/saved-signatures';
import { announce } from '../shell/announcer';
import { canChange } from '../state/guard';
import { isMarkupOpen, type PaletteSet, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { useToolStore } from '../viewer/tool-store';

const activeId = () => useWorkspaceStore.getState().workspace.activeDocument;

/** Set by a door pressed from the dock: the palette takes the focus when it mounts. */
let focusOnOpen = false;

/** Whether the palette that just mounted takes the focus (read once). */
export function takeFocusOnOpen(): boolean {
  const take = focusOnOpen;
  focusOnOpen = false;
  return take;
}

/** Set by Done or Esc from inside the palette: the dock's door takes the focus back. */
let focusDockOnClose: PaletteSet | null = null;

/** The door the dock focuses after Markup closed from inside the palette (read once). */
export function takeDockFocus(): PaletteSet | null {
  const door = focusDockOnClose;
  focusDockOnClose = null;
  return door;
}

/**
 * Opens Markup for the active document on `set`, with Select armed. `focus`: the palette takes
 * the focus (opened from the dock). False when nothing opened (no document, or locked).
 */
export function openMarkupDoor(set: PaletteSet, options: { readonly focus?: boolean } = {}) {
  const id = activeId();
  if (id === undefined || !canChange(id, 'freehand', { opensMarkup: true })) return false;
  const ui = useUiStore.getState();
  const wasOpen = isMarkupOpen(ui, id);
  ui.openMarkup(id, set);
  ui.showSurface('page', id);
  useToolStore.getState().setMode('select');
  if (set === 'sign') void loadSavedSignatures();
  focusOnOpen = options.focus === true;
  if (!wasOpen) announce(m.markup_on());
  return true;
}

/** Closes Markup (Done, Esc at Select): module header. */
export function closeMarkupDoor(options: { readonly fromPalette?: boolean } = {}): void {
  const id = activeId();
  if (id === undefined) return;
  const ui = useUiStore.getState();
  if (!isMarkupOpen(ui, id)) return;
  const store = useAnnotationStore.getState();
  if (store.editor !== null) {
    commitOpenEditor();
    useAnnotationStore.getState().setEditor(null);
  }
  useToolStore.getState().setMode('select');
  focusDockOnClose = options.fromPalette ? (ui.docUi[id]?.paletteSet ?? 'draw') : null;
  ui.closeMarkup(id);
  announce(m.markup_off());
}
