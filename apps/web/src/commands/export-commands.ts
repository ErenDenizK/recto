/**
 * "Save a copy…" (components/07-sheets.md §4.1; flows §5.1; spec redesign D0-9): opens the
 * one Save a copy sheet for the active tab. The id stays `file.export` (menus, the tab bar's
 * button and tests name it). Mod+S is Save (files/save-commands.ts, ADR-0032 §2.1); Save a
 * copy takes Mod+Shift+S where the browser leaves it (Firefox keeps it for screenshots).
 * Registered from `app-commands.ts`.
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import { openSaveCopy } from '../export/export-store';
import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import type { CommandRegistry } from './registry';

const activeDocument = () => getActiveDocument(useWorkspaceStore.getState().workspace);

export function registerExportCommands(registry: CommandRegistry): () => void {
  return registry.register({
    id: 'file.export',
    title: m.cmd_export(),
    group: m.group_file(),
    shortcut: 'Mod+Shift+S',
    note: m.save_copy_shortcut_note(),
    keywords: ['save', 'download', 'pdf', 'merge', 'write', 'copy', 'export', 'share'],
    when: () => (activeDocument()?.pages.length ?? 0) > 0,
    run: () => {
      const doc = activeDocument();
      if (doc) openSaveCopy(doc.id);
    },
  });
}
