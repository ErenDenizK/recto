/**
 * "Save a copy…" (components/07-sheets.md §4.1; flows §5.1; spec redesign D0-9): opens the
 * one Save a copy sheet for the active tab. The id stays `file.export` (menus, the tab bar's
 * button and tests name it). Mod+S is Save (files/save-commands.ts, ADR-0032 §2.1); Save a
 * copy takes Mod+Shift+S where the browser leaves it (Firefox keeps it for screenshots).
 *
 * "Print…" (PRD-25; epics-r25 Epic 5): prints the active document as Save a copy would write
 * it, through `export/print.ts`, loaded on the first press. Mod+P replaces the browser's print
 * of the app's own page. Not yet among the keys a text field lets through (INK-12's list,
 * r25/keys-land): add it there when that lands.
 *
 * Registered from `app-commands.ts`.
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import { openSaveCopy } from '../export/export-store';
import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import type { CommandRegistry } from './registry';

const activeDocument = () => getActiveDocument(useWorkspaceStore.getState().workspace);
const hasPages = () => (activeDocument()?.pages.length ?? 0) > 0;

export function registerExportCommands(registry: CommandRegistry): () => void {
  const disposers = [
    registry.register({
      id: 'file.export',
      title: m.cmd_export(),
      group: m.group_file(),
      act: null,
      shortcut: 'Mod+Shift+S',
      note: m.save_copy_shortcut_note(),
      keywords: ['save', 'download', 'pdf', 'merge', 'write', 'copy', 'export', 'share'],
      when: hasPages,
      run: () => {
        const doc = activeDocument();
        if (doc) openSaveCopy(doc.id);
      },
    }),
    registry.register({
      id: 'file.print',
      title: m.cmd_print(),
      group: m.group_file(),
      act: null,
      shortcut: 'Mod+P',
      keywords: ['print'],
      when: hasPages,
      run: async () => {
        const doc = activeDocument();
        if (doc) await (await import('../export/print')).printDocument(doc.id);
      },
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
