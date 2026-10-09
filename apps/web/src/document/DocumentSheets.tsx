/**
 * The document-tools sheets (spec document-tools.md §3, §4; components/07-sheets.md S4, S5),
 * mounted once at the app root: Document info (`DocumentInfoSheet.tsx`), Set password and
 * Remove password (`PasswordSheet.tsx`) and Strip metadata (`StripMetadataSheet.tsx`). The
 * document dialog store (`document-store.ts`) says which one is open, for which document, and
 * where it returns when it closes (Document info or Save a copy).
 *
 * Each opening is a fresh form: passwords and choices typed in one visit never come back in
 * the next (a password is never a draft, 07 §8). The document stays shown while the sheet
 * plays its exit.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import type { ReactNode } from 'react';

import { useWorkspaceStore } from '../state/workspace-store';
import { useRetained } from '../ui/use-retained';
import {
  type DocumentDialog,
  type DocumentDialogKind,
  useDocumentDialogStore,
} from './document-store';
import { DocumentInfoSheet } from './DocumentInfoSheet';
import { RemovePasswordSheet, SetPasswordSheet } from './PasswordSheet';
import { StripMetadataSheet } from './StripMetadataSheet';

export function DocumentSheets() {
  return (
    <>
      <DocumentInfoSheet />
      <ToolSheet kind="set-password" />
      <ToolSheet kind="remove-password" />
      <ToolSheet kind="strip-metadata" />
    </>
  );
}

/** One key per opening, so each visit starts a fresh form. */
const openings = new WeakMap<DocumentDialog, number>();
let serial = 0;
const openingOf = (dialog: DocumentDialog): number => {
  let n = openings.get(dialog);
  if (n === undefined) {
    serial += 1;
    n = serial;
    openings.set(dialog, n);
  }
  return n;
};

function ToolSheet({ kind }: { readonly kind: Exclude<DocumentDialogKind, 'info'> }) {
  const dialog = useDocumentDialogStore((s) => (s.dialog?.kind === kind ? s.dialog : null));
  const [shown] = useRetained(dialog);
  const live = useWorkspaceStore((s) =>
    shown === null ? undefined : s.workspace.documents[shown.documentId],
  );
  const [doc] = useRetained(live ?? null);
  if (shown === null || doc?.id !== shown.documentId) return null;
  const open = dialog !== null && live !== undefined;
  return <Body key={openingOf(shown)} kind={kind} doc={doc} open={open} origin={shown.origin} />;
}

function Body({
  kind,
  doc,
  open,
  origin,
}: {
  readonly kind: Exclude<DocumentDialogKind, 'info'>;
  readonly doc: VirtualDocument;
  readonly open: boolean;
  readonly origin: DocumentDialog['origin'];
}): ReactNode {
  switch (kind) {
    case 'set-password':
      return <SetPasswordSheet doc={doc} open={open} origin={origin} />;
    case 'remove-password':
      return <RemovePasswordSheet doc={doc} open={open} origin={origin} />;
    case 'strip-metadata':
      return <StripMetadataSheet doc={doc} open={open} origin={origin} />;
  }
}
