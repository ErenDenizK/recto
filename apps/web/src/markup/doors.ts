/**
 * The doors into Markup and the way out (`03-markup` MK-1 §6, MK-3; flows §4.2–§4.3): the
 * dock's Markup opens the palette on its Draw set, Fill & sign on its Sign set (Select armed,
 * the saved signatures inline, the field stepper); Done, the second Esc and `1` close it.
 *
 * The dock that calls these is the capsule's (`shell/frame/Dock.tsx`); focus follows the
 * capsule's morph (`shell/capsule/Capsule.tsx`): into the armed Select on opening when it was
 * in the capsule, back to the door Markup was opened through on closing.
 *
 * - **Opening** asks the guard first (`canChange(id, 'freehand', { opensMarkup: true })`): a
 *   locked document opens nothing (its dock shows Locked instead). It arms Select and says
 *   "Markup on. Select armed." once (A-14).
 * - **Closing** (Done, MK-3 §6) commits an open text box or note editor, disarms, then closes
 *   Markup, and says "Markup off."
 */
import { commitOpenEditor } from '../annotations/InlineEditors';
import { useAnnotationStore } from '../annotations/annotation-store';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { loadSavedSignatures } from '../signatures/saved-signatures';
import { canChange } from '../state/guard';
import { isMarkupOpen, type PaletteSet, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { useToolStore } from '../viewer/tool-store';

const activeId = () => useWorkspaceStore.getState().workspace.activeDocument;

/**
 * Opens Markup for the active document on `set`, with Select armed. False when nothing opened
 * (no document, or locked).
 */
export function openMarkupDoor(set: PaletteSet): boolean {
  const id = activeId();
  if (id === undefined || !canChange(id, 'freehand', { opensMarkup: true })) return false;
  const ui = useUiStore.getState();
  const wasOpen = isMarkupOpen(ui, id);
  ui.openMarkup(id, set);
  ui.showSurface('page', id);
  useToolStore.getState().setMode('select');
  if (set === 'sign') void loadSavedSignatures();
  if (!wasOpen) announce(m.markup_on());
  return true;
}

/** Closes Markup (Done, Esc at Select): module header. */
export function closeMarkupDoor(): void {
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
  ui.closeMarkup(id);
  announce(m.markup_off());
}
