/**
 * "Export as Markdown / text…" (spec recognize-and-compare §4) in the Document menu and the
 * palette (group "Document"): opens Save a copy on Text (components/07-sheets.md §4.1).
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import type { CommandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import { openSaveCopy } from '../export/export-store';

const activeDocument = () => getActiveDocument(useWorkspaceStore.getState().workspace);

export function registerConvertCommands(registry: CommandRegistry): () => void {
  return registry.register({
    id: 'document.exportMarkdown',
    title: m.cmd_convert_markdown(),
    group: m.group_document(),
    act: null,
    keywords: ['markdown', 'md', 'text', 'txt', 'convert', 'extract', 'export', 'plain'],
    when: () => (activeDocument()?.pages.length ?? 0) > 0,
    run: () => {
      const doc = activeDocument();
      if (doc) openSaveCopy(doc.id, 'text');
    },
  });
}
