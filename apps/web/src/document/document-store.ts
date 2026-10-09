/**
 * Which document-tools sheet is open (spec document-tools.md §3, §4; 07-sheets S4, S5): Set
 * password, Remove password, Strip metadata, or the Document info sheet (experience-redesign
 * §4.2). Every one is mounted once, at the app root (`DocumentSheets.tsx`).
 *
 * A sheet opened from another replaces it (07 §1.1 rule 1) and gives it back when it is done:
 * one opened from Document info returns to Document info, one opened from Save a copy
 * (`origin: 'export'`) returns to Save a copy. A sheet that another sheet replaced returns to
 * nothing.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { create } from 'zustand';

import { popToSaveCopy, pushOverSaveCopy } from '../export/export-store';

export type DocumentDialogKind = 'set-password' | 'remove-password' | 'strip-metadata' | 'info';

export interface DocumentDialog {
  readonly kind: DocumentDialogKind;
  readonly documentId: DocumentId;
  readonly origin: 'app' | 'export';
}

interface DocumentDialogState {
  readonly dialog: DocumentDialog | null;
}

export const useDocumentDialogStore = create<DocumentDialogState>()(() => ({ dialog: null }));

/** The Document info sheet a password or strip sheet opened from it returns to. */
let returnToInfo: DocumentDialog | null = null;

export function openDocumentDialog(
  kind: DocumentDialogKind,
  documentId: DocumentId,
  origin: DocumentDialog['origin'] = 'app',
): void {
  const was = useDocumentDialogStore.getState().dialog;
  // A sheet pushed over Save a copy that this one replaces does not return to it.
  if (was !== null && was.origin === 'export' && was.kind !== 'info') popToSaveCopy(false);
  returnToInfo =
    kind !== 'info' && was?.kind === 'info' && was.documentId === documentId ? was : null;
  if (origin === 'export' && kind !== 'info') pushOverSaveCopy(documentId);
  useDocumentDialogStore.setState({ dialog: { kind, documentId, origin } });
}

/**
 * Closes the open sheet. It returns to the sheet it was opened from (Document info or Save a
 * copy) unless another sheet `replaced` it.
 */
export function closeDocumentDialog(replaced = false): void {
  const was = useDocumentDialogStore.getState().dialog;
  const info = returnToInfo;
  returnToInfo = null;
  if (was === null) return;
  useDocumentDialogStore.setState({ dialog: null });
  if (was.kind === 'info') return;
  if (was.origin === 'export') popToSaveCopy(!replaced);
  else if (info !== null && !replaced) openDocumentDialog('info', info.documentId, info.origin);
}
