/**
 * The page's input state for the active document (05-canvas §6), read by the page layers: the
 * hit router's state (`hit-order.ts` `inputStateOf`) from Markup (`ui-store`), the armed tool
 * (`tool-store`) and the change guard (`state/guard.ts`), which answers false for a locked
 * document and for none, so a layer fails closed. Replaces M8's `canEdit` shim (D1-1, deleted in
 * D1-5): a layer asks the router what a press is aimed at and the guard whether it may change.
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { type Act, canChange, useCanChange } from '../state/guard';
import { isMarkupOpen, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { type InputState, inputStateOf } from './hit-order';
import { useToolStore } from './tool-store';

export interface PageInput {
  /** The active document, if any (the page view shows it). */
  readonly id: DocumentId | undefined;
  /** Markup is open for it. */
  readonly markup: boolean;
  /** It may not change: locked, or no known document. */
  readonly locked: boolean;
  /** The router's state for a mouse press (a pen in Markup with Select is the layers' call). */
  readonly state: InputState;
}

/** The active document's id, followed. */
export function useActiveDocumentId(): DocumentId | undefined {
  return useWorkspaceStore((s) => s.workspace.activeDocument);
}

/** `canChange` for the active document. */
export function canChangeActive(act: Act): boolean {
  return canChange(useWorkspaceStore.getState().workspace.activeDocument, act);
}

/** `useCanChange` for the active document. */
export function useCanChangeActive(act: Act): boolean {
  return useCanChange(useActiveDocumentId(), act);
}

/** The page input state of the active document, followed (05-canvas §6). */
export function usePageInput(): PageInput {
  const id = useActiveDocumentId();
  const markup = useUiStore((s) => isMarkupOpen(s, id));
  // Locked, or no document: the guard's `targeted` is allowed whenever neither holds.
  const locked = !useCanChange(id, 'targeted');
  const tool = useToolStore((s) => s.mode);
  return { id, markup, locked, state: inputStateOf({ markup, locked, tool }) };
}

/** The page input state of the active document now (for event handlers). */
export function pageInputNow(penDraws = false): InputState {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  return inputStateOf({
    markup: isMarkupOpen(useUiStore.getState(), id),
    locked: !canChange(id, 'targeted'),
    tool: useToolStore.getState().mode,
    penDraws,
  });
}
