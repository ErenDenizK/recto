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
 *   "Markup on. Select armed." once (A-14). Fill & sign on a page with no field brings the
 *   first field into view (`revealFirstField`).
 * - **Closing** (Done, MK-3 §6) commits an open text box or note editor, disarms, then closes
 *   Markup, and says "Markup off."
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { commitOpenEditor } from '../annotations/InlineEditors';
import { useAnnotationStore } from '../annotations/annotation-store';
import { documentSources, useFormStore, widgetsOf } from '../forms/form-store';
import { activeStops } from '../forms/navigation';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { loadSavedSignatures } from '../signatures/saved-signatures';
import { canChange } from '../state/guard';
import { isMarkupOpen, type PaletteSet, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
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
  if (set === 'sign') {
    void loadSavedSignatures();
    void revealFirstField(id);
  }
  if (!wasOpen) announce(m.markup_on());
  return true;
}

/** How long the door waits for the document's fields to load before it gives up (ms). */
const FIELDS_WAIT_MS = 3000;

/** Resolves once every source of document `id` has its fields listed (or after a while). */
function fieldsLoaded(id: DocumentId): Promise<void> {
  const doc = useWorkspaceStore.getState().workspace.documents[id];
  if (doc === undefined) return Promise.resolve();
  const sources = documentSources(doc);
  for (const source of sources) useFormStore.getState().ensureSource(source);
  const done = () => sources.every((source) => useFormStore.getState().sources[source]?.loaded);
  if (done()) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(finish, FIELDS_WAIT_MS);
    const unsubscribe = useFormStore.subscribe(() => {
      if (done()) finish();
    });
    function finish() {
      window.clearTimeout(timer);
      unsubscribe();
      resolve();
    }
  });
}

/**
 * Fill & sign opened on a page with nothing to fill brings the form into view (V2 review item
 * 23): the first fillable field at or after the current page (else the first one) scrolls into
 * the free rectangle, so the door shows what it is for. The focus stays on Sign (flows §4.3),
 * the field is not activated, and a page that has a field of its own stays where it is.
 */
async function revealFirstField(id: DocumentId): Promise<void> {
  await fieldsLoaded(id);
  const ui = useUiStore.getState();
  if (activeId() !== id || !isMarkupOpen(ui, id)) return;
  const stops = activeStops();
  if (stops.length === 0) return;
  const current = useViewStore.getState().currentPage;
  if (stops.some((stop) => stop.position === current)) return;
  const stop = stops.find((s) => s.position > current) ?? stops[0];
  if (stop === undefined) return;
  const rect = widgetsOf(stop.field)[stop.widget]?.rect;
  useViewStore
    .getState()
    .scrollToPage(stop.pageId, rect === undefined ? undefined : { reveal: rect });
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
