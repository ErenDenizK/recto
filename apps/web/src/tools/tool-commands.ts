/**
 * Document tool commands (spec §5–§7), grouped under "Document" in the palette and listed
 * by the Document menu in the tab bar (`DocumentMenu.tsx`: Compress… and Export pages as
 * images… under "Convert and export", Save repaired copy under "Document" while there is a
 * repaired source). Registered from `app-commands.ts`.
 *
 * Each opens Save a copy preset (components/07-sheets.md §4.1, §25): Compress… on Size with
 * Smaller chosen, Export pages as images… on Images, Save repaired copy on PDF (the copy is
 * written from the version rebuilt on open, and the sheet says so).
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import { registerBatchCommands } from '../batch/batch-commands';
import type { CommandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import { openSaveCopy } from '../export/export-store';
import { repairedSources } from './repair';

const activeDocument = () => getActiveDocument(useWorkspaceStore.getState().workspace);
const hasPages = () => (activeDocument()?.pages.length ?? 0) > 0;

export function registerToolCommands(registry: CommandRegistry): () => void {
  const group = m.group_document();
  const disposers = [
    registry.register({
      id: 'document.compress',
      title: m.cmd_tools_compress(),
      group,
      act: null,
      keywords: ['compress', 'optimize', 'reduce', 'size', 'shrink', 'downsample', 'jpeg'],
      when: hasPages,
      run: () => {
        const doc = activeDocument();
        if (doc) openSaveCopy(doc.id, 'size');
      },
    }),
    registry.register({
      id: 'document.exportImages',
      title: m.cmd_tools_export_images(),
      group,
      act: null,
      keywords: ['png', 'jpeg', 'jpg', 'webp', 'image', 'rasterize', 'picture', 'zip', 'copy'],
      when: hasPages,
      run: () => {
        const doc = activeDocument();
        if (doc) openSaveCopy(doc.id, 'images');
      },
    }),
    registry.register({
      id: 'document.saveRepaired',
      title: m.cmd_tools_save_repaired(),
      group,
      act: null,
      keywords: ['repair', 'fix', 'damaged', 'broken', 'qpdf', 'rewrite'],
      when: () => repairedSources().length > 0,
      run: () => {
        const doc = activeDocument();
        if (doc) openSaveCopy(doc.id, 'pdf');
      },
    }),
    registerBatchCommands(registry),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
