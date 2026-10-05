/**
 * Signature commands (spec recognize-and-compare §3.4): "Sign with certificate…" in the
 * Document group, so it appears in the command palette and the tab bar's Document menu.
 * It opens the Sign dialog, which continues to Save a copy (signing is the last step of a
 * copy).
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import type { CommandRegistry } from '../commands/registry';
import { useDocumentDialogStore } from '../document/document-store';
import { saveCopyDocument } from '../export/export-store';
import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import { openSignDialog, useSignStore } from './sign-store';

export function registerSignatureCommands(registry: CommandRegistry): () => void {
  const active = () => getActiveDocument(useWorkspaceStore.getState().workspace);
  const dispose = registry.register({
    id: 'document.sign',
    title: m.cmd_sign(),
    group: m.group_document(),
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
  return dispose;
}
