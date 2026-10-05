/**
 * Opening New signature, S7 (components/07-sheets.md §9; 03-markup.md MK-13): from the
 * signature tool when nothing is saved, the Signature menu's "New signature…", G with nothing
 * saved, and Settings → Saved signatures → Add…. The opener rides on the sheet store's
 * `preset`: `use` (the default) makes a signature to place, `keep` (from Settings) keeps one
 * and goes back to Settings → Saved signatures.
 */
import { openSheet, useSheetStore } from '../ui/sheet';

/** The sheet's id in the sheet store; New signature belongs to the app, not to a document. */
export const NEW_SIGNATURE_SHEET_ID = 'new-signature';

export type NewSignatureIntent = 'use' | 'keep';

/** Opens New signature, replacing any open sheet (07 §1.1 rule 1). */
export function openNewSignature(intent: NewSignatureIntent = 'use'): void {
  openSheet(NEW_SIGNATURE_SHEET_ID, { preset: intent });
}

/** What the open New signature is for. */
export function intentOf(preset: string | null): NewSignatureIntent {
  return preset === 'keep' ? 'keep' : 'use';
}

/** Whether New signature is open now. */
export function newSignatureOpen(): boolean {
  return useSheetStore.getState().open?.id === NEW_SIGNATURE_SHEET_ID;
}
