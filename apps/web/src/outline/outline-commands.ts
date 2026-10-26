/**
 * Outline commands for the command palette and the Document menu (DESIGN.md §4.1). The
 * item-level actions (rename, delete, move, indent) live on the tree's keys and context
 * menu, where there is an item to act on; the palette carries the document-level ones.
 */
import { countDeadOutlineLinks, getActiveDocument } from '@pdf-editor/document-model';

import type { CommandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { useWorkspaceStore } from '../state/workspace-store';
import {
  addBookmark,
  addBookmarksFromHeadings,
  removeDeadLinks,
  showOutlinePanel,
  useHeadingsRunStore,
} from './outline-actions';

const activeDocument = () => getActiveDocument(useWorkspaceStore.getState().workspace);

export function registerOutlineCommands(registry: CommandRegistry): () => void {
  const disposers = [
    registry.register({
      id: 'outline.addBookmark',
      title: m.cmd_outline_add(),
      group: m.group_document(),
      act: 'document',
      keywords: ['bookmark', 'outline', 'toc', 'contents', 'add', 'new'],
      when: () => (activeDocument()?.pages.length ?? 0) > 0,
      run: () => {
        const doc = activeDocument();
        if (!doc) return;
        showOutlinePanel();
        addBookmark(doc.id);
      },
    }),
    registry.register({
      id: 'outline.fromHeadings',
      title: m.cmd_outline_from_headings(),
      group: m.group_document(),
      act: 'document',
      keywords: [
        'bookmark',
        'outline',
        'toc',
        'contents',
        'headings',
        'titles',
        'generate',
        'auto',
      ],
      when: () => {
        const doc = activeDocument();
        if (doc === undefined || doc.pages.length === 0 || doc.outline.length > 0) return false;
        const run = useHeadingsRunStore.getState();
        return !run.running[doc.id] && !run.none[doc.id];
      },
      run: () => {
        const doc = activeDocument();
        if (!doc) return;
        showOutlinePanel();
        void addBookmarksFromHeadings(doc.id);
      },
    }),
    registry.register({
      id: 'outline.removeDeadLinks',
      title: m.cmd_outline_remove_dead(),
      group: m.group_document(),
      act: 'document',
      keywords: ['bookmark', 'outline', 'broken', 'unresolved', 'dead', 'clean'],
      when: () => countDeadOutlineLinks(activeDocument()?.outline ?? []) > 0,
      run: () => {
        const doc = activeDocument();
        if (doc) removeDeadLinks(doc.id);
      },
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
