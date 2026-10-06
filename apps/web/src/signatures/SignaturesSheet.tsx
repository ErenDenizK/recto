/**
 * S9 Signatures (`components/07-sheets.md` §11; spec D2-9): the validity of the signatures in
 * the file, one card per signature (`SignaturesSection.tsx`), with the honesty line and the
 * export statement. It replaces the inspector's Signatures section (inventory 6.5) and the
 * status bar badge's target (14.5).
 *
 * - **Opened by** the title menu's Signatures… (Protect) and its facts row on a signed file,
 *   and ⌘K (`document.signatures`). Reading only: no guard, so it opens while locked.
 * - **A task sheet** with no primary: ✕, Esc or the scrim close it. View signed version opens
 *   the signed revision as a read-only tab and closes the sheet (S9 §6).
 * - The document is the one it opened on; it closes when that document goes.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { useEffect } from 'react';
import { create } from 'zustand';

import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import { Sheet } from '../ui/sheet';
import { useRetained } from '../ui/use-retained';
import { SignaturesSection } from './SignaturesSection';

export const SIGNATURES_SHEET = 'signatures';

const useSignaturesSheet = create<{ readonly documentId: DocumentId | null }>()(() => ({
  documentId: null,
}));

/** Opens S9 on `documentId`. */
export function openSignaturesSheet(documentId: DocumentId): void {
  useSignaturesSheet.setState({ documentId });
}

export function closeSignaturesSheet(): void {
  useSignaturesSheet.setState({ documentId: null });
}

/** Whether S9 is open (the command waits while it is). */
export function signaturesSheetOpen(): boolean {
  return useSignaturesSheet.getState().documentId !== null;
}

/** Mounted once in the shell. */
export function SignaturesSheet() {
  const requested = useSignaturesSheet((s) => s.documentId);
  const live = useWorkspaceStore((s) =>
    requested === null ? undefined : s.workspace.documents[requested],
  );
  // The document stays named while the sheet plays its exit.
  const [doc] = useRetained(live ?? null);
  const open = requested !== null && live !== undefined;
  // Its document closed: the sheet closes with it.
  const gone = requested !== null && live === undefined;
  useEffect(() => {
    if (gone) closeSignaturesSheet();
  }, [gone]);
  if (!doc) return null;
  return (
    <Sheet
      id={SIGNATURES_SHEET}
      kind="task"
      open={open}
      onClose={closeSignaturesSheet}
      title={m.signatures_title()}
      subtitle={doc.title}
      testId="signatures-sheet"
    >
      <SignaturesSection documentId={doc.id} onSignedVersionOpened={closeSignaturesSheet} />
    </Sheet>
  );
}
