/**
 * Signature commands (spec recognize-and-compare §3.4), in the Document group, so they appear
 * in ⌘K and in the title menu's Protect section:
 *
 * - "Sign with certificate…" opens the Sign dialog, which continues to Save a copy (signing is
 *   the last step of a copy);
 * - "Signatures…" opens S9 (`SignaturesSheet.tsx`, spec D2-9): reading, so no act and open
 *   while locked; dimmed with "No signatures in this file" on an unsigned one (01-frame F5 §4).
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import type { CommandRegistry } from '../commands/registry';
import { useDocumentDialogStore } from '../document/document-store';
import { saveCopyDocument } from '../export/export-store';
import { m } from '../i18n';
import { documentSources, useWorkspaceStore } from '../state/workspace-store';
import { openSignDialog, useSignStore } from './sign-store';
import { openSignaturesSheet, signaturesSheetOpen } from './SignaturesSheet';

export function registerSignatureCommands(registry: CommandRegistry): () => void {
  const active = () => getActiveDocument(useWorkspaceStore.getState().workspace);
  const signed = () => {
    const ws = useWorkspaceStore.getState().workspace;
    const doc = getActiveDocument(ws);
    return (
      doc !== undefined &&
      documentSources(doc).some((id) => ws.sources[id]?.flags.hasSignatures === true)
    );
  };
  const disposeSign = registry.register({
    id: 'document.sign',
    title: m.cmd_sign(),
    group: m.group_document(),
    act: null,
    keywords: ['signature', 'certificate', 'pades', 'p12', 'pfx', 'digital signature'],
    when: () =>
      active() !== undefined &&
      useSignStore.getState().dialog === null &&
      useDocumentDialogStore.getState().dialog === null &&
      saveCopyDocument() === null,
    run: () => {
      const doc = active();
      if (doc) openSignDialog(doc.id, 'app');
    },
  });
  const disposeSignatures = registry.register({
    id: 'document.signatures',
    title: m.cmd_signatures(),
    group: m.group_document(),
    act: null,
    keywords: ['signatures', 'signed', 'validate', 'verify', 'certificate', 'seal'],
    when: () => signed() && !signaturesSheetOpen(),
    reason: () => (active() !== undefined && !signed() ? m.signatures_none_reason() : undefined),
    run: () => {
      const doc = active();
      if (doc) openSignaturesSheet(doc.id);
    },
  });
  return () => {
    disposeSign();
    disposeSignatures();
  };
}
