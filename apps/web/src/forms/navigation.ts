/**
 * Tab / Shift+Tab through form fields in document order across pages (spec document-tools
 * §1), and opening a field from outside its page (the Forms panel).
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import { isPageView, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { useToolStore } from '../viewer/tool-store';
import { useCreateStore } from './create/create-store';
import {
  type ActiveField,
  type FieldStop,
  fieldStops,
  isFillable,
  useFormStore,
} from './form-store';

function sameStop(a: ActiveField, b: ActiveField): boolean {
  return (
    a.source === b.source &&
    a.fieldId === b.fieldId &&
    a.name === b.name &&
    a.widget === b.widget &&
    a.pageId === b.pageId
  );
}

/** The fillable stops of the active document, in document order. */
export function activeStops(): FieldStop[] {
  const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
  if (!doc) return [];
  return fieldStops(doc, useFormStore.getState().sources).filter((s) => isFillable(s.field));
}

/** Opens a field: shows its page in Read mode with the Select tool and activates it. */
export function openField(stop: ActiveField): void {
  const ui = useUiStore.getState();
  if (!isPageView(ui)) ui.showSurface('page');
  useToolStore.getState().setMode('select');
  // Filling a field leaves "Edit fields" (created fields fill instead of moving).
  if (useCreateStore.getState().design) useCreateStore.getState().setDesign(false);
  const current = useFormStore.getState().active;
  useFormStore.getState().setActive({
    ...(stop.source === undefined ? {} : { source: stop.source }),
    ...(stop.fieldId === undefined ? {} : { fieldId: stop.fieldId }),
    name: stop.name,
    widget: stop.widget,
    pageId: stop.pageId,
    ...(stop.selectAll ? { selectAll: true } : {}),
  });
  if (current?.pageId !== stop.pageId) useViewStore.getState().scrollToPage(stop.pageId);
}

/**
 * Moves from `from` to the next (1) or previous (-1) fillable field. Tab does not wrap (spec
 * document-tools §1, 05-canvas §19.5): past the first or last field it returns false and the
 * browser's Tab goes on to the chrome. The stepper passes `wrap` to cycle.
 */
export function moveField(
  from: ActiveField,
  direction: 1 | -1,
  options: { readonly wrap?: boolean } = {},
): boolean {
  const stops = activeStops();
  if (stops.length === 0) return false;
  const index = stops.findIndex((s) => sameStop(s, from));
  let nextIndex: number;
  if (index < 0) nextIndex = direction > 0 ? 0 : stops.length - 1;
  else if (options.wrap) nextIndex = (index + direction + stops.length) % stops.length;
  else nextIndex = index + direction;
  const next = stops[nextIndex];
  if (!next || (index >= 0 && nextIndex === index)) return false;
  openField({ ...next, selectAll: true });
  return true;
}

/** True when `moveField` would land on another field (no wrap). */
export function canMoveField(from: ActiveField, direction: 1 | -1): boolean {
  const stops = activeStops();
  const index = stops.findIndex((s) => sameStop(s, from));
  if (index < 0) return stops.length > 0;
  return index + direction >= 0 && index + direction < stops.length;
}
