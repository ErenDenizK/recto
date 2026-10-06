/**
 * Pages grid commands (`components/06-navigation.md` PG1 §6, PG3, PG5; `07-sheets.md`
 * S13–S18; light-table spec §3–§5). Registered next to the shell's commands so they appear in
 * the palette and the shortcut overlay. Titles, notes and groups are read in the active
 * language; `app.tsx` re-registers on a language switch.
 *
 * Mod+X / Mod+C / Mod+V act on pages only in the grid; elsewhere the browser keeps its
 * clipboard shortcuts (a text selection on the page). Esc in the grid clears the selection
 * (`selection.clear`), then leaves the grid (`grid.done`, flows §7.2's ladder).
 */
import {
  type DocumentId,
  findPageLocation,
  getActiveDocument,
  type PageId,
  reversePages,
} from '@pdf-editor/document-model';

import { targetDocuments, targetPages } from '../commands/app-commands';
import { type CommandRegistry, commandRegistry } from '../commands/registry';
import { pickFiles } from '../files/open-files';
import { m } from '../i18n';
import { announce } from '../shell/announcer';
import { useSelectionStore } from '../state/selection-store';
import { stageView, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import {
  copyPages,
  cutPages,
  insertBlankAfter,
  movePagesToEdge,
  pastePages,
  pasteTarget,
  planPaste,
  reverseSelectedPages,
  selectParity,
} from './arrange-actions';
import { hasAnnotationToolState } from '../annotations';
import { enterGrid, leaveGrid } from './grid/grid-transition';
import { openOperationDialog } from './operation-dialogs-store';
import { copyPagesToNewDocument, insertImagesInto, startRename } from './section-operations';
import {
  registerSectionMenuItem,
  sectionCommandOrigin,
  sectionCommandTarget,
} from './section-menu';

const ui = () => useUiStore.getState();
const model = () => useWorkspaceStore.getState();
const inArrange = () => stageView(ui()) === 'grid';
const hasTargets = () => targetPages().length > 0;
const hasClipboard = () => (useSelectionStore.getState().clipboard?.pageIds.length ?? 0) > 0;
/** The section a section command acts on: the invoking section, else the active tab. */
const sectionDocument = () => {
  const ws = model().workspace;
  const id = sectionCommandTarget() ?? ws.activeDocument;
  return id === undefined ? undefined : ws.documents[id];
};
const otherDocuments = (id: DocumentId) =>
  model().workspace.documentOrder.filter((other) => other !== id);
/** The document a section command changes, as the guard asks it (ADR-0030 §2.4). */
const sectionDocuments = (): DocumentId[] => {
  const doc = sectionDocument();
  return doc === undefined ? [] : [doc.id];
};

/**
 * The documents a paste changes: the one it lands in and, for a cut clipboard (a move), the
 * documents its pages leave (ADR-0030 §2.4: Mod+X then Mod+V asks for each).
 */
function pasteDocuments(asDuplicate: boolean): DocumentId[] {
  const { clipboard, focused } = useSelectionStore.getState();
  const plan = planPaste(clipboard, asDuplicate);
  if (plan === undefined || clipboard === null) return [];
  const ws = model().workspace;
  const target = pasteTarget(ws, focused, ws.activeDocument);
  if (target === undefined) return [];
  const changed = new Set<DocumentId>([target.document]);
  if (!plan.duplicate) {
    for (const page of clipboard.pageIds) {
      const location = findPageLocation(ws, page);
      if (location !== undefined) changed.add(location.document);
    }
  }
  return [...changed];
}

let columnsProvider: () => number = () => 1;

/** The light table reports its column count so row-edge moves work from the palette. */
export function provideArrangeColumns(provider: () => number): () => void {
  columnsProvider = provider;
  return () => {
    if (columnsProvider === provider) columnsProvider = () => 1;
  };
}

/**
 * "Resize pages…" from the palette, the context menu or the section menu: the selected
 * pages (of the invoking section, when a section menu ran it), else the whole document.
 */
function openResizeDialog(): void {
  openPagesDialog('resize');
}

/** "Crop pages…" (crop/): the same pages as "Resize pages…". */
function openCropDialog(): void {
  openPagesDialog('crop');
}

function openPagesDialog(kind: 'resize' | 'crop'): void {
  const ws = model().workspace;
  const fromSection = sectionCommandTarget();
  let pages: PageId[] = targetPages();
  if (fromSection !== null) {
    pages = pages.filter((id) => findPageLocation(ws, id)?.document === fromSection);
  }
  const documentId =
    fromSection ??
    (pages[0] === undefined ? undefined : findPageLocation(ws, pages[0])?.document) ??
    ws.activeDocument;
  if (documentId === undefined || ws.documents[documentId] === undefined) return;
  openOperationDialog({ kind, documentId, pageIds: pages });
}

export function registerArrangeCommands(registry: CommandRegistry = commandRegistry): () => void {
  const pages = m.group_pages();
  const documents = m.group_documents();
  const view = m.group_view();
  const file = m.group_file();
  const disposers = [
    registerSectionMenuItem({ command: 'section.resize', label: m.section_resize, group: 'pages' }),
    registerSectionMenuItem({ command: 'section.crop', label: m.section_crop, group: 'pages' }),
    registry.register({
      id: 'pages.cut',
      title: m.cmd_cut_pages(),
      group: pages,
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Mod+X',
      keywords: ['move', 'clipboard', 'light table'],
      note: m.cmd_cut_pages_note(),
      when: () => inArrange() && hasTargets(),
      run: () => {
        cutPages();
      },
    }),
    registry.register({
      id: 'pages.copy',
      title: m.cmd_copy_pages(),
      group: pages,
      act: null,
      shortcut: 'Mod+C',
      keywords: ['clipboard', 'duplicate', 'light table'],
      note: m.cmd_arrange_only_note(),
      when: () => inArrange() && hasTargets(),
      run: () => {
        copyPages();
      },
    }),
    registry.register({
      id: 'pages.paste',
      title: m.cmd_paste_pages(),
      group: pages,
      act: 'pages',
      documents: () => pasteDocuments(false),
      shortcut: 'Mod+V',
      keywords: ['clipboard', 'move', 'insert', 'light table'],
      note: m.cmd_paste_pages_note(),
      when: () => inArrange() && hasClipboard(),
      run: () => {
        pastePages(false);
      },
    }),
    registry.register({
      id: 'pages.pasteDuplicate',
      title: m.cmd_paste_duplicates(),
      group: pages,
      act: 'pages',
      documents: () => pasteDocuments(true),
      shortcut: 'Mod+Shift+V',
      keywords: ['clipboard', 'copy', 'light table'],
      note: m.cmd_arrange_only_note(),
      when: () => inArrange() && hasClipboard(),
      run: () => {
        pastePages(true);
      },
    }),
    // S16: a sheet, prefilled with the pages; it asks `pages` only to remove them (Keep copies
    // them, which changes nothing and works on a locked document).
    registry.register({
      id: 'pages.extract',
      title: m.cmd_extract_pages(),
      group: pages,
      act: null,
      shortcut: 'Mod+Shift+E',
      keywords: ['extract', 'split', 'new', 'separate', 'move to new document'],
      when: hasTargets,
      run: () => {
        openOperationDialog({ kind: 'extract', pageIds: targetPages() });
      },
    }),
    // Done, Esc with nothing selected, `3` (PG1 §6): back to the page the grid opened at.
    registry.register({
      id: 'grid.done',
      title: m.cmd_grid_done(),
      group: view,
      act: null,
      shortcut: 'Escape',
      keywords: ['pages grid', 'leave', 'back', 'done'],
      when: () =>
        inArrange() &&
        useSelectionStore.getState().selected.size === 0 &&
        !hasAnnotationToolState(),
      run: () => leaveGrid(),
    }),
    registry.register({
      id: 'pages.copyToNew',
      title: m.cmd_copy_to_new_document(),
      group: pages,
      act: null,
      keywords: ['extract', 'duplicate', 'new', 'copy'],
      when: hasTargets,
      run: () => {
        copyPagesToNewDocument();
      },
    }),
    registry.register({
      id: 'pages.insertBlank',
      title: m.cmd_insert_blank(),
      group: pages,
      act: 'pages',
      documents: targetDocuments,
      keywords: ['empty', 'new page', 'add'],
      when: hasTargets,
      run: () => {
        insertBlankAfter();
      },
    }),
    registry.register({
      id: 'pages.resize',
      title: m.cmd_resize_pages(),
      group: pages,
      act: 'pages',
      via: 'sheet',
      keywords: ['page size', 'scale', 'fit', 'canvas', 'a4', 'letter', 'paper', 'dimensions'],
      when: () => hasTargets() || (getActiveDocument(model().workspace)?.pages.length ?? 0) > 0,
      run: openResizeDialog,
    }),
    registry.register({
      id: 'pages.crop',
      title: m.cmd_crop_pages(),
      group: pages,
      act: 'pages',
      via: 'sheet',
      keywords: ['cropbox', 'trim', 'margins', 'cut', 'discard', 'remove content'],
      when: () => hasTargets() || (getActiveDocument(model().workspace)?.pages.length ?? 0) > 0,
      run: openCropDialog,
    }),
    registry.register({
      id: 'pages.moveToRowStart',
      title: m.cmd_move_row_start(),
      group: pages,
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Alt+Shift+Left',
      keywords: ['reorder', 'light table'],
      when: () => inArrange() && hasTargets(),
      run: () => {
        movePagesToEdge('row-start', columnsProvider());
      },
    }),
    registry.register({
      id: 'pages.moveToRowEnd',
      title: m.cmd_move_row_end(),
      group: pages,
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Alt+Shift+Right',
      keywords: ['reorder', 'light table'],
      when: () => inArrange() && hasTargets(),
      run: () => {
        movePagesToEdge('row-end', columnsProvider());
      },
    }),
    registry.register({
      id: 'pages.moveToStart',
      title: m.cmd_move_document_start(),
      group: pages,
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Alt+Shift+Up',
      keywords: ['reorder', 'first', 'top'],
      when: hasTargets,
      run: () => {
        movePagesToEdge('section-start', columnsProvider());
      },
    }),
    registry.register({
      id: 'pages.moveToEnd',
      title: m.cmd_move_document_end(),
      group: pages,
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Alt+Shift+Down',
      keywords: ['reorder', 'last', 'bottom'],
      when: hasTargets,
      run: () => {
        movePagesToEdge('section-end', columnsProvider());
      },
    }),
    registry.register({
      id: 'pages.reverseSelection',
      title: m.cmd_reverse_selection(),
      group: pages,
      act: 'pages',
      documents: targetDocuments,
      keywords: ['flip', 'reorder', 'backwards'],
      when: () => targetPages().length > 1,
      run: () => {
        reverseSelectedPages();
      },
    }),
    ...(['odd', 'even'] as const).map((parity) =>
      registry.register({
        id: `pages.select.${parity}`,
        title: parity === 'odd' ? m.cmd_select_odd() : m.cmd_select_even(),
        group: pages,
        act: null,
        keywords: ['selection', parity === 'odd' ? 'front' : 'back', 'duplex'],
        when: () => (getActiveDocument(model().workspace)?.pages.length ?? 0) > 0,
        run: () => {
          const doc = getActiveDocument(model().workspace);
          if (doc) selectParity(doc.id, parity);
        },
      }),
    ),
    // The grid's All open (PG2): every open document as a section.
    registry.register({
      id: 'arrange.showAll',
      title: m.cmd_show_all_in_arrange(),
      group: view,
      act: null,
      keywords: ['pages grid', 'all open', 'sections', 'documents'],
      when: () =>
        model().workspace.documentOrder.length > 1 && !(inArrange() && ui().gridScope === 'all'),
      run: () => {
        const ws = model().workspace;
        ui().setGridScope('all');
        if (!inArrange()) enterGrid();
        announce(m.announce_showing_all({ count: ws.documentOrder.length }));
      },
    }),
    registry.register({
      id: 'section.reverse',
      title: m.cmd_reverse_document(),
      group: documents,
      act: 'pages',
      documents: sectionDocuments,
      keywords: ['backwards', 'flip', 'order'],
      when: () => (sectionDocument()?.pages.length ?? 0) > 1,
      run: () => {
        const doc = sectionDocument();
        if (!doc) return;
        if (
          model().applyOperation(
            (ws) => reversePages(ws, doc.id),
            m.history_reverse({ title: doc.title }),
          )
        ) {
          announce(m.announce_reversed_document({ title: doc.title }));
        }
      },
    }),
    registry.register({
      id: 'section.split',
      title: m.cmd_split_document(),
      group: documents,
      act: 'pages',
      via: 'sheet',
      keywords: ['separate', 'chunks', 'ranges', 'bookmarks', 'every'],
      when: () => (sectionDocument()?.pages.length ?? 0) > 1,
      run: () => {
        const doc = sectionDocument();
        if (doc) openOperationDialog({ kind: 'split', documentId: doc.id });
      },
    }),
    // S15 Combine with open documents (INV-12): a new document, its sources kept; the id
    // stays M8's so palette recents and the title menu keep finding it.
    registry.register({
      id: 'documents.mergeAll',
      title: m.cmd_combine_open(),
      group: documents,
      act: null,
      keywords: ['combine', 'join', 'concatenate', 'append', 'one file', 'merge'],
      when: () => model().workspace.documentOrder.length > 1,
      run: () => {
        openOperationDialog({ kind: 'combine' });
      },
    }),
    registry.register({
      id: 'section.interleave',
      title: m.cmd_interleave(),
      group: documents,
      act: null,
      keywords: ['duplex', 'scan', 'odd even', 'collate', 'zip'],
      when: () => {
        const doc = sectionDocument();
        return doc !== undefined && otherDocuments(doc.id).length > 0;
      },
      run: () => {
        const doc = sectionDocument();
        if (doc) openOperationDialog({ kind: 'interleave', documentId: doc.id });
      },
    }),
    registry.register({
      id: 'section.resize',
      title: m.cmd_resize_document_pages(),
      group: documents,
      act: 'pages',
      via: 'sheet',
      // The section and tab menus run it; the palette has "Resize pages…" (pages.resize).
      hiddenInPalette: true,
      keywords: ['page size', 'scale', 'fit', 'canvas', 'a4', 'letter', 'paper', 'dimensions'],
      when: () => (sectionDocument()?.pages.length ?? 0) > 0,
      run: openResizeDialog,
    }),
    registry.register({
      id: 'section.crop',
      title: m.cmd_crop_document_pages(),
      group: documents,
      act: 'pages',
      via: 'sheet',
      // The section and tab menus run it; the palette has "Crop pages…" (pages.crop).
      hiddenInPalette: true,
      keywords: ['cropbox', 'trim', 'margins', 'cut', 'discard', 'remove content'],
      when: () => (sectionDocument()?.pages.length ?? 0) > 0,
      run: openCropDialog,
    }),
    registry.register({
      id: 'section.rename',
      title: m.cmd_rename_document(),
      group: documents,
      act: 'document',
      documents: sectionDocuments,
      shortcut: 'F2',
      keywords: ['title', 'name'],
      note: m.cmd_rename_document_note(),
      when: () => sectionDocument() !== undefined,
      run: () => {
        const doc = sectionDocument();
        if (doc) startRename(doc.id, sectionCommandOrigin() ?? undefined);
      },
    }),
    registry.register({
      id: 'section.insertImages',
      title: m.cmd_insert_images(),
      group: documents,
      act: 'pages',
      documents: sectionDocuments,
      keywords: ['picture', 'photo', 'png', 'jpeg', 'jpg', 'webp', 'scan', 'add'],
      when: () => sectionDocument() !== undefined,
      run: async () => {
        const doc = sectionDocument();
        if (!doc) return;
        const id = doc.id;
        // The picker needs this click's user activation: no await before it.
        const files = await pickFiles('images');
        if (files.length > 0) await insertImagesInto(id, files);
      },
    }),
    registry.register({
      id: 'section.close',
      title: m.section_close(),
      group: file,
      act: null,
      hiddenInPalette: true,
      when: () => sectionDocument() !== undefined,
      run: () => {
        const doc = sectionDocument();
        if (!doc) return;
        model().closeDocument(doc.id);
        announce(m.announce_closed({ name: doc.title }));
      },
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
