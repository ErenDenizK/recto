/**
 * Save commands (ADR-0032 §2.1, §2.2; 01-frame F5 "File" and F7): "Save" on Mod+S and "Revert to
 * the opened version…". Registered from `commands/app-commands.ts`; the Document menu lists
 * both until D2 moves them to the title menu.
 *
 * Save runs from the shortcut's keydown, so its questions, the browser's write prompt and the
 * save picker keep that press's activation. It stays enabled while everything is in the file:
 * Mod+S then says "Everything is in report.pdf" instead of letting the browser offer "Save page
 * as". Save is available in Read mode (spec 0032.3). It is not offered on the Library (01-frame
 * §4), where the Save button is not shown either.
 */
import { getActiveDocument } from '@pdf-editor/document-model';

import type { CommandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { askToRevert, revertAvailability } from './revert';
import { saveDocument } from './save';

const activeDocument = () => getActiveDocument(useWorkspaceStore.getState().workspace);
/** Where the Save button shows: anywhere but the Library (01-frame §4). */
const saveShown = () =>
  useUiStore.getState().destination !== 'home' && (activeDocument()?.pages.length ?? 0) > 0;

export function registerSaveCommands(registry: CommandRegistry): () => void {
  const disposers = [
    registry.register({
      id: 'file.save',
      title: m.cmd_save(),
      group: m.group_file(),
      act: null,
      shortcut: 'Mod+S',
      // Mod+S from a text field saves too, rather than the browser's "Save page as".
      allowInInputs: true,
      when: saveShown,
      run: () => {
        // Inside a dialog the key only stops "Save page as"; the dialog keeps the focus.
        if (document.activeElement?.closest('[aria-modal="true"]')) return;
        const doc = activeDocument();
        if (doc) void saveDocument(doc.id);
      },
    }),
    registry.register({
      id: 'file.revert',
      title: m.cmd_revert(),
      group: m.group_file(),
      act: 'document',
      when: () => {
        const doc = activeDocument();
        if (!doc) return false;
        return revertAvailability(useWorkspaceStore.getState().workspace, doc.id).available;
      },
      run: () => {
        const doc = activeDocument();
        if (doc) void askToRevert(doc.id);
      },
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
