/**
 * The shell's commands. Everything here is reachable from the palette (Mod+K) and listed
 * in the shortcut overlay (?).
 *
 * Browser caveats, documented once here and surfaced via `note`:
 * - Mod+W (close tab) and Mod+T/N are reserved by browsers in a normal tab and never
 *   reach the page. In an installed PWA window Chromium delivers some of them. Keyboard
 *   users can always close the focused tab with Delete in the tab bar.
 * - Mod+=/-/0 override the browser's page zoom; `preventDefault` is honoured by Chromium,
 *   Firefox and Safari for keydown, so the document zooms instead of the UI.
 */
import {
  canRedo,
  canUndo,
  type DocumentId,
  getActiveDocument,
  type PageId,
} from '@pdf-editor/document-model';

import {
  clearAnnotationTools,
  hasAnnotationToolState,
  registerAnnotationCommands,
} from '../annotations';
import { registerCompareCommands } from '../compare/compare-commands';
import { registerConvertCommands } from '../convert/convert-commands';
import { fileHandleOf, partitionFiles, pickFiles } from '../files/open-files';
import { clearRecents, recordRecent } from '../files/recents';
import { rememberDocumentHandle } from '../files/save';
import { registerSaveCommands } from '../files/save-commands';
import { registerFurnitureCommands } from '../furniture';
import { registerFormCommands } from '../forms';
import { redoStep, undoStep } from '../history/actions';
import { openHistoryScrubber } from '../history/scrubber-store';
import { showHome, showMarkup, showOpened, watchDestination } from '../home/home-actions';
import { m } from '../i18n';
import { registerLanguageCommands } from '../i18n/language-commands';
import { registerOcrCommands } from '../ocr';
import { PRODUCT_NAME } from '../shell/about/build-info';
import { announce } from '../shell/announcer';
import { focusOpenedPage } from '../shell/focus-opened-page';
import { toggleSidebar } from '../shell/frame/frame-store';
import { useAuthorPrompt } from '../shell/comment-author';
import { openImagesAsDocument } from '../stage/section-operations';
import { selectAllOf, useSelectionStore, visibleSelection } from '../state/selection-store';
import { ARRANGE_SIZES, isMarkupOpen, stageView, useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';
import { registerToolCommands } from '../tools/tool-commands';
import { registerEditPolicyCommands } from '../viewer/edit-policy';
import { registerViewerCommands } from '../viewer/viewer-commands';
import { registerExportCommands } from './export-commands';
import { type CommandRegistry, commandRegistry } from './registry';
import { presentOpenFailures } from '../errors/present';
import { openSettings } from '../settings/open-settings';

const ui = () => useUiStore.getState();
const model = () => useWorkspaceStore.getState();

/**
 * The stage already shows `view` (Home, the grid, or the page view with Markup closed or
 * open, M8's Read and Edit): the view and mode commands then change nothing and say nothing
 * (craft spec §9: a mode is announced on change).
 */
function showing(view: 'home' | 'grid' | 'page' | 'markup'): boolean {
  const state = ui();
  const stage = stageView(state);
  if (view === 'home' || view === 'grid') return stage === view;
  const markup = isMarkupOpen(state, model().workspace.activeDocument);
  return stage === 'page' && markup === (view === 'markup');
}
const selection = () => useSelectionStore.getState();
const activeDocument = () => getActiveDocument(model().workspace);

/** The about page, `about/` under the deployment base (a sibling of the app). */
function aboutPageUrl(): string {
  return new URL('about/', new URL(import.meta.env.BASE_URL, location.href)).href;
}

/** Opens the about page in a new tab, with no handle back to the app. */
function openAboutPage(): void {
  window.open(aboutPageUrl(), '_blank', 'noopener');
}

/**
 * Opens files as tabs (in the given order) and announces the outcome. PDFs open one tab
 * each; images (PNG, JPEG, WebP) become the pages of one new document. Resolves to the
 * documents opened from PDFs, in order.
 *
 * Files that did not open get a visible failure toast (`errors/present.ts`, FB8; INV-6): the
 * damaged-file toast, the skipped-password toast with "Enter password…" (which asks again),
 * or one toast for several files. Its announcement joins "Opened …" in the same task.
 */
export async function openDocuments(files: readonly File[]): Promise<readonly DocumentId[]> {
  if (files.length === 0) return [];
  const { pdfs, images } = partitionFiles(files);
  if (images.length > 0) await openImagesAsDocument(images);
  if (pdfs.length === 0) return [];
  const { opened, skipped } = await model().openFiles(pdfs);
  rememberOpened(pdfs, opened);
  if (opened.length === 1) announce(m.announce_opened({ name: opened[0]?.name ?? '' }));
  else if (opened.length > 1) announce(m.announce_opened_many({ count: opened.length }));
  presentOpenFailures(
    skipped.map((skip) => {
      const file = pdfs.find((f) => f.name === skip.name);
      return {
        ...skip,
        retry: file
          ? () => {
              const wasEmpty = model().workspace.documentOrder.length === 0;
              void openDocuments([file]).then((ids) => showOpened(ids, { wasEmpty }));
            }
          : undefined,
      };
    }),
    pdfs.length,
  );
  return opened.map((o) => o.documentId);
}

/** Entries that a reopen from Recents should replace, by the file it produced. */
const reopenedFrom = new WeakMap<File, string>();

/** Marks `file` as the reopen of Recents entry `id`, so its entry moves rather than doubles. */
export function noteReopenedFrom(file: File, id: string): void {
  reopenedFrom.set(file, id);
}

/**
 * Records each opened PDF in Recents (craft §3.1): name, size, page count and, where the
 * browser gave one, the file handle, which Save also keeps for the document. Matched to the
 * files by name, in order.
 */
function rememberOpened(
  files: readonly File[],
  opened: readonly { readonly name: string; readonly documentId: DocumentId }[],
): void {
  const unused = [...files];
  for (const { name, documentId } of opened) {
    const index = unused.findIndex((file) => file.name === name);
    const [file] = unused.splice(index < 0 ? 0 : index, 1);
    if (file === undefined) continue;
    const handle = fileHandleOf(file);
    // Save writes back through it (files/save.ts, ADR-0032 §2.1).
    if (handle !== undefined) rememberDocumentHandle(documentId, handle);
    const replaces = reopenedFrom.get(file);
    const pages = model().workspace.documents[documentId]?.pages.length;
    void recordRecent({
      name: file.name,
      size: file.size,
      ...(pages === undefined ? {} : { pages }),
      ...(handle === undefined ? {} : { handle }),
      ...(replaces === undefined ? {} : { replaces }),
    });
  }
}

/**
 * "Clear recents": forgets every recent file and handle on this device, and says so, or
 * says (assertively) that the copy stored on this device could not be deleted.
 */
export async function clearRecentFiles(): Promise<void> {
  if (await clearRecents()) announce(m.recents_announce_cleared());
  else announce(m.recents_clear_failed(), { politeness: 'assertive' });
}

/**
 * "Open files…" and the tab bar's "+": PDFs and images (images become one document). Like a
 * drop: two or more on an empty workspace, or any while Home shows, land on Home with the
 * new cards selected (experience-redesign §3).
 */
export async function openFilesFromPicker(): Promise<void> {
  // Where the focus was: the opened document's pages take it if it has not moved since.
  const before = document.activeElement;
  const files = await pickFiles('openable');
  const wasEmpty = model().workspace.documentOrder.length === 0;
  showOpened(await openDocuments(files), { wasEmpty });
  // On a document (not Home's selected cards), focus goes to its pages (01-frame F3 §6).
  const active = model().workspace.activeDocument;
  if (active && ui().destination !== 'home') focusOpenedPage(active, before);
}

/**
 * Pages the page commands act on: the selection; in Arrange mode, the keyboard-focused
 * page when nothing is selected.
 */
export function targetPages(): PageId[] {
  const { selected, focused } = selection();
  if (selected.size > 0) {
    // Keep document order so announcements and moves read naturally.
    const ws = model().workspace;
    const ordered: PageId[] = [];
    for (const id of ws.documentOrder) {
      for (const page of ws.documents[id]?.pages ?? []) {
        if (selected.has(page.id)) ordered.push(page.id);
      }
    }
    return ordered;
  }
  if (focused !== null && stageView(ui()) === 'grid') return [focused];
  return [];
}

const hasTargets = () => targetPages().length > 0;

/**
 * The documents the page commands change: those holding the target pages, in tab order
 * (ADR-0030 §2.4: each is asked; in the grid's "All open" scope a selection may span several).
 */
export function targetDocuments(): DocumentId[] {
  return documentsHolding(targetPages());
}

/** The documents holding `pageIds`, in tab order. */
function documentsHolding(pageIds: readonly PageId[]): DocumentId[] {
  const ws = model().workspace;
  const pages = new Set(pageIds);
  return ws.documentOrder.filter((id) =>
    (ws.documents[id]?.pages ?? []).some((page) => pages.has(page.id)),
  );
}

function rotate(delta: 90 | -90): void {
  const pages = targetPages();
  if (model().rotatePages(pages, delta)) {
    const count = pages.length;
    announce(delta > 0 ? m.announce_rotated_right({ count }) : m.announce_rotated_left({ count }));
  }
}

/**
 * The pages Delete acts on: a selection the person can see only (S10, flows §3.1). In the
 * Pages grid that is `targetPages()`; on the page, the selected pages the navigator lists,
 * and none while it is closed. A navigating click in the navigator selects nothing, so a
 * click then Delete changes nothing.
 */
export function visibleTargetPages(): PageId[] {
  const stage = stageView(ui());
  if (stage === 'grid') return targetPages();
  if (stage !== 'page') return [];
  const { selected, navigatorDocument } = selection();
  const shown =
    navigatorDocument === null ? undefined : model().workspace.documents[navigatorDocument];
  return visibleSelection(selected, shown);
}

function deleteTargets(): void {
  const pages = visibleTargetPages();
  if (pages.length === 0) return;
  // Focus the page after the deleted block (else before it) so keyboard work continues.
  const doc = activeDocument();
  const deleted = new Set(pages);
  let nextFocus: PageId | null = null;
  if (doc) {
    const indices = doc.pages.flatMap((p, i) => (deleted.has(p.id) ? [i] : []));
    const last = indices[indices.length - 1] ?? -1;
    const first = indices[0] ?? -1;
    nextFocus =
      doc.pages.slice(last + 1).find((p) => !deleted.has(p.id))?.id ??
      doc.pages
        .slice(0, Math.max(0, first))
        .reverse()
        .find((p) => !deleted.has(p.id))?.id ??
      null;
  }
  // The first deleted page's number, for "Deleted page 7 · Undo".
  const firstNumber = (doc?.pages.findIndex((p) => deleted.has(p.id)) ?? 0) + 1;
  if (model().deletePages(pages)) {
    useSelectionStore.getState().apply({
      selected: new Set(),
      anchor: null,
      focused: nextFocus,
    });
    // Every removal shows an Undo toast (ADR-0032 §2; FB4), said with its shortcut.
    toast.undo(m.toast_deleted_pages({ count: pages.length, page: firstNumber }), {
      documentId: doc?.id,
    });
  }
}

/**
 * Moves the selected pages of the active document by `delta` slots (±1, or ±columns in
 * the light table). Consecutive moves of the same pages coalesce into one undo step.
 */
export function moveSelectionBy(delta: number): boolean {
  const doc = activeDocument();
  if (!doc || delta === 0) return false;
  const targets = new Set(targetPages());
  const indices = doc.pages.flatMap((p, i) => (targets.has(p.id) ? [i] : []));
  const first = indices[0];
  const last = indices[indices.length - 1];
  if (first === undefined || last === undefined) return false;
  const count = doc.pages.length;
  const gap = delta > 0 ? Math.min(count, last + 1 + delta) : Math.max(0, first + delta);
  const ids = indices.flatMap((i) => {
    const id = doc.pages[i]?.id;
    return id === undefined ? [] : [id];
  });
  const moved = model().movePages(
    ids,
    { document: doc.id, index: gap },
    { coalesceKey: `move:${[...ids].sort().join(',')}` },
  );
  if (!moved) return false;
  const after = getActiveDocument(model().workspace);
  const position = (after?.pages.findIndex((p) => p.id === ids[0]) ?? 0) + 1;
  announce(m.announce_moved({ count: ids.length, position, title: doc.title }));
  return true;
}

export function arrangeSizeMessage(): string {
  const size = ARRANGE_SIZES[ui().arrangeSize] ?? ARRANGE_SIZES[1];
  return m.announce_thumbnail_size({ size: size.label });
}

/**
 * Registers all shell commands; returns a disposer (safe under StrictMode re-runs). Titles
 * and groups are read in the active language, so a language switch re-registers them.
 */
export function registerAppCommands(registry: CommandRegistry = commandRegistry): () => void {
  const disposers = [
    watchDestination(),
    registry.register({
      id: 'file.open',
      title: m.cmd_open_files(),
      group: m.group_file(),
      act: null,
      shortcut: 'Mod+O',
      keywords: ['add', 'import', 'pdf', 'load'],
      allowInInputs: true,
      run: openFilesFromPicker,
    }),
    registry.register({
      id: 'file.clearRecents',
      title: m.cmd_clear_recents(),
      group: m.group_file(),
      act: null,
      // Always offered, also with nothing remembered (craft §14 answer 3).
      run: clearRecentFiles,
    }),
    registry.register({
      id: 'tab.close',
      title: m.cmd_close_tab(),
      group: m.group_file(),
      act: null,
      shortcut: 'Mod+W',
      keywords: ['document', 'close'],
      note: m.cmd_close_tab_note(),
      when: () => activeDocument() !== undefined,
      run: () => {
        const doc = activeDocument();
        if (!doc) return;
        model().closeDocument(doc.id);
        announce(m.announce_closed({ name: doc.title }));
      },
    }),
    registry.register({
      id: 'view.palette',
      title: m.cmd_palette(),
      group: m.group_general(),
      act: null,
      shortcut: 'Mod+K',
      allowInInputs: true,
      hiddenInPalette: true,
      run: () => ui().setPaletteOpen(!ui().paletteOpen),
    }),
    registry.register({
      id: 'help.shortcuts',
      title: m.cmd_shortcuts(),
      group: m.group_general(),
      act: null,
      shortcut: '?',
      keywords: ['help', 'keys', 'keymap', 'hotkeys'],
      run: () => ui().setShortcutsOpen(!ui().shortcutsOpen),
    }),
    // Version, build, licence, storage and offline status (ADR-0017 §6): Settings → About
    // Recto (07-sheets §25; spec D0-10), where the About dialog went.
    registry.register({
      id: 'help.about',
      title: m.about_command({ name: PRODUCT_NAME }),
      group: m.group_general(),
      act: null,
      keywords: ['version', 'build', 'release notes', 'licence', 'license', 'source', 'storage'],
      run: () => openSettings({ row: 'about' }),
    }),
    // The about page beside the app (presentation spec §3), listed last in the Document
    // menu's "Document" section.
    registry.register({
      id: 'help.aboutPage',
      title: m.menu_about_page(),
      group: m.group_general(),
      act: null,
      run: openAboutPage,
    }),
    registry.register({
      id: 'selection.clear',
      title: m.cmd_clear_selection(),
      group: m.group_general(),
      act: null,
      shortcut: 'Escape',
      hiddenInPalette: true,
      when: () => hasAnnotationToolState() || selection().selected.size > 0,
      run: () => {
        // Esc returns to Select and drops the annotation selection first (spec §2).
        if (clearAnnotationTools()) return;
        selection().clear();
      },
    }),
    // Before the page commands: in Read mode R, Delete, ... act on annotations.
    registerAnnotationCommands(registry),
    // The author name is asked once at the first comment; this asks again (§4.1).
    registry.register({
      id: 'comments.setAuthor',
      title: m.cmd_set_author(),
      group: m.group_edit(),
      act: null,
      run: () => {
        useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'comments' });
        useAuthorPrompt.getState().edit();
      },
    }),
    registry.register({
      id: 'edit.undo',
      title: m.cmd_undo(),
      group: m.group_edit(),
      act: null,
      shortcut: 'Mod+Z',
      keywords: ['revert', 'back'],
      when: () => canUndo(model().history),
      // Says the step and reveals the change (01-frame F3 §6, history/actions.ts).
      run: () => void undoStep(),
    }),
    registry.register({
      id: 'edit.redo',
      title: m.cmd_redo(),
      group: m.group_edit(),
      act: null,
      shortcut: ['Mod+Shift+Z', 'Mod+Y'],
      keywords: ['again', 'forward'],
      when: () => canRedo(model().history),
      run: () => void redoStep(),
    }),
    // The History scrubber from ⌘K (08-feedback FB7 §1); ↶ shows it, so only in a document.
    registry.register({
      id: 'edit.history',
      title: m.cmd_history(),
      group: m.group_edit(),
      act: null,
      keywords: ['undo', 'steps', 'scrubber', 'jump'],
      when: () =>
        useUiStore.getState().destination !== 'home' && model().workspace.documentOrder.length > 0,
      run: openHistoryScrubber,
    }),
    registry.register({
      id: 'pages.selectAll',
      title: m.cmd_select_all(),
      group: m.group_pages(),
      act: null,
      shortcut: 'Mod+A',
      keywords: ['selection', 'everything'],
      when: () => (activeDocument()?.pages.length ?? 0) > 0,
      run: () => {
        const doc = activeDocument();
        if (!doc) return;
        const order = doc.pages.map((p) => p.id);
        selection().apply(selectAllOf(order, selection().focused));
        announce(m.announce_selected({ count: order.length }));
      },
    }),
    registry.register({
      id: 'pages.rotateRight',
      title: m.cmd_rotate_right(),
      group: m.group_pages(),
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'R',
      keywords: ['clockwise', 'turn', '90'],
      when: hasTargets,
      run: () => rotate(90),
    }),
    registry.register({
      id: 'pages.rotateLeft',
      title: m.cmd_rotate_left(),
      group: m.group_pages(),
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Shift+R',
      keywords: ['counterclockwise', 'anticlockwise', 'turn', '90'],
      when: hasTargets,
      run: () => rotate(-90),
    }),
    registry.register({
      id: 'pages.delete',
      title: m.cmd_delete_pages(),
      group: m.group_pages(),
      act: 'pages',
      documents: () => documentsHolding(visibleTargetPages()),
      shortcut: ['Delete', 'Backspace'],
      keywords: ['remove'],
      when: () => visibleTargetPages().length > 0,
      run: deleteTargets,
    }),
    registry.register({
      id: 'pages.duplicate',
      title: m.cmd_duplicate_pages(),
      group: m.group_pages(),
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Mod+D',
      keywords: ['copy', 'clone'],
      note: m.cmd_duplicate_pages_note(),
      when: hasTargets,
      run: () => {
        const pages = targetPages();
        if (model().duplicatePages(pages)) announce(m.announce_duplicated({ count: pages.length }));
      },
    }),
    registry.register({
      id: 'pages.moveBackward',
      title: m.cmd_move_backward(),
      group: m.group_pages(),
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Alt+Left',
      keywords: ['reorder', 'earlier', 'left'],
      when: hasTargets,
      run: () => {
        moveSelectionBy(-1);
      },
    }),
    registry.register({
      id: 'pages.moveForward',
      title: m.cmd_move_forward(),
      group: m.group_pages(),
      act: 'pages',
      documents: targetDocuments,
      shortcut: 'Alt+Right',
      keywords: ['reorder', 'later', 'right'],
      when: hasTargets,
      run: () => {
        moveSelectionBy(1);
      },
    }),
    registry.register({
      id: 'view.toggleLeftPanel',
      title: m.cmd_toggle_left_panel(),
      group: m.group_view(),
      act: null,
      shortcut: 'Mod+B',
      keywords: ['sidebar', 'pages', 'outline', 'files'],
      run: toggleSidebar,
    }),
    registry.register({
      id: 'view.toggleRightPanel',
      title: m.cmd_toggle_right_panel(),
      group: m.group_view(),
      act: null,
      shortcut: 'Mod+Alt+B',
      keywords: ['inspector', 'properties', 'history', 'info'],
      run: () => ui().toggleRightPanel(),
    }),
    ...(['pages', 'outline', 'files'] as const).map((view) =>
      registry.register({
        id: `view.show.${view}`,
        title: { pages: m.cmd_show_pages, outline: m.cmd_show_outline, files: m.cmd_show_files }[
          view
        ](),
        group: m.group_view(),
        act: null,
        keywords: ['panel', 'sidebar'],
        run: () => useUiStore.setState({ leftPanelOpen: true, leftPanelView: view }),
      }),
    ),
    // Home is a view of the open files; a document is in Read (locked) or Edit, and Arrange
    // and Compare are views beside them (ADR-0019 §1–§2). Keys follow the control: 1–4.
    registry.register({
      id: 'view.home',
      title: m.cmd_view_home(),
      group: m.group_view(),
      act: null,
      shortcut: '0',
      run: () => {
        if (showing('home')) return;
        showHome();
        announce(m.home_long());
      },
    }),
    registry.register({
      id: 'mode.read',
      title: m.cmd_mode_read(),
      group: m.group_view(),
      act: null,
      shortcut: '1',
      keywords: ['mode', 'viewer', 'continuous', 'lock'],
      when: () => activeDocument() !== undefined,
      run: () => {
        if (!showing('page')) showMarkup(false);
      },
    }),
    registry.register({
      id: 'mode.edit',
      title: m.cmd_mode_edit(),
      group: m.group_view(),
      act: null,
      shortcut: '2',
      keywords: ['mode', 'annotate', 'markup', 'write'],
      when: () => activeDocument() !== undefined,
      run: () => {
        if (!showing('markup')) showMarkup(true);
      },
    }),
    registry.register({
      id: 'mode.arrange',
      title: m.cmd_mode_arrange(),
      group: m.group_view(),
      act: null,
      shortcut: '3',
      keywords: ['mode', 'light table', 'grid', 'organize', 'reorder'],
      run: () => {
        if (showing('grid')) return;
        ui().showSurface('grid');
        announce(m.mode_arrange_long());
      },
    }),
    registry.register({
      id: 'zoom.in',
      title: m.cmd_zoom_in(),
      group: m.group_zoom(),
      act: null,
      shortcut: 'Mod+=',
      keywords: ['magnify', 'bigger'],
      run: () => ui().zoomIn(),
    }),
    registry.register({
      id: 'zoom.out',
      title: m.cmd_zoom_out(),
      group: m.group_zoom(),
      act: null,
      shortcut: 'Mod+-',
      keywords: ['smaller'],
      run: () => ui().zoomOut(),
    }),
    registry.register({
      id: 'zoom.fit',
      title: m.cmd_zoom_fit(),
      group: m.group_zoom(),
      act: null,
      shortcut: 'Mod+0',
      keywords: ['reset', 'fit'],
      run: () => ui().zoomFit(),
    }),
    registry.register({
      id: 'zoom.fitPage',
      title: m.cmd_zoom_fit_page(),
      group: m.group_zoom(),
      act: null,
      keywords: ['whole', 'fit', 'page'],
      run: () => ui().zoomFitPage(),
    }),
    registry.register({
      id: 'zoom.actual',
      title: m.cmd_zoom_actual(),
      group: m.group_zoom(),
      act: null,
      keywords: ['100%', 'reset', 'real'],
      run: () => ui().zoomActual(),
    }),
    registry.register({
      id: 'arrange.larger',
      title: m.cmd_thumbnails_larger(),
      group: m.group_zoom(),
      act: null,
      keywords: ['light table', 'cell size', 'bigger'],
      note: m.cmd_thumbnails_note(),
      when: () => ui().arrangeSize < ARRANGE_SIZES.length - 1,
      run: () => {
        if (ui().stepArrangeSize(1)) announce(arrangeSizeMessage());
      },
    }),
    registry.register({
      id: 'arrange.smaller',
      title: m.cmd_thumbnails_smaller(),
      group: m.group_zoom(),
      act: null,
      keywords: ['light table', 'cell size'],
      note: m.cmd_thumbnails_note(),
      when: () => ui().arrangeSize > 0,
      run: () => {
        if (ui().stepArrangeSize(-1)) announce(arrangeSizeMessage());
      },
    }),
    registerLanguageCommands(registry),
    registerExportCommands(registry),
    registerSaveCommands(registry),
    registerViewerCommands(registry),
    registerEditPolicyCommands(registry),
    registerToolCommands(registry),
    registerConvertCommands(registry),
    registerOcrCommands(registry),
    registerCompareCommands(registry),
    registerFurnitureCommands(registry),
    registerFormCommands(registry),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
