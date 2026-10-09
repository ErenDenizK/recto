/**
 * What the Library's launcher, cards and selection bar do (`02-library` L2, L5, L6, L7, L9), and
 * how the shell moves between the Library and a document (ADR-0019 §1–§2). The file keeps its
 * M8 name: the place's code name is still `home`, and the tabs, the Files list and the
 * commands call `showTab`, `showHome`, `showOpened` and `selectOnHome` from here.
 *
 * - **Combine asks nothing** on the Library (L6, INV-12): `combineNow` makes the new document
 *   from the checked cards in card order (02.9), keeps the sources open, opens it in its Pages
 *   grid and shows "Combined 2 files · Undo". `combineFiles` (the launcher's Combine files…)
 *   combines picked files without opening them as documents, one composed history step
 *   (02.10). The Files list and ⌘K keep the dialog (`combine`) until D2-5 moves them.
 * - **Opening, checking, reordering and closing change no document** (02.8, X12): they ask no
 *   guard; only a card's F2 rename is a `document` act.
 */
import {
  closeDocument,
  type DocumentId,
  mergeDocuments,
  removeSourceIfUnreferenced,
  reorderDocuments,
  type SourceId,
} from '@pdf-editor/document-model';

import { noteReopenedFrom, openDocuments, openFilesFromPicker } from '../commands/app-commands';
import { currentPlatform } from '../commands/shortcuts';
import { enterCompare } from '../compare/compare-commands';
import { useCompareStore } from '../compare/compare-store';
import { presentOpenFailures } from '../errors/present';
import { partitionFiles, pickFiles, rememberFileHandle } from '../files/open-files';
import {
  canReopenRecent,
  type RecentEntry,
  recordRecent,
  removeRecent,
  reopenRecent,
  setRecentNote,
  useRecentsStore,
} from '../files/recents';
import { m } from '../i18n';
import { reopenFromSnapshot } from '../session/session';
import { announce } from '../shell/announcer';
import { openOperationDialog } from '../stage/operation-dialogs-store';
import { validateTitle } from '../stage/operation-plans';
import { mergeAll } from '../stage/section-operations';
import { isLocked, lockOpened } from '../state/lock-store';
import { useUiStore } from '../state/ui-store';
import { addLoadedSource, type LoadedSources, useWorkspaceStore } from '../state/workspace-store';
import { toast } from '../ui/Toast/toast';
import { combinedTitle, combineOrder, compareOrder, liveSelection, movedOrder } from './home-model';
import { resetLibraryStore, setSelecting } from './library-store';
import { backToLibraryMorph } from './library-transition';

const ui = () => useUiStore.getState();
const model = () => useWorkspaceStore.getState();
const order = () => model().workspace.documentOrder;

/**
 * Shows Home (`0`, the app glyph, the palette, "Show Home"): from a document, its page shrinks
 * back into its card (`library-transition.ts`).
 */
export function showHome(): void {
  if (ui().destination === 'home') return;
  backToLibraryMorph(() => ui().showHome());
}

/**
 * Makes a document the active tab (its tab, its Files row). On Home this leaves Home for the
 * document on its surface, with Markup as it was (ADR-0019 §1); elsewhere what the stage
 * shows stays (`ui-store` carries the surface to the new tab).
 */
export function showTab(id: DocumentId): void {
  if (model().workspace.documents[id] === undefined) return;
  model().setActive(id);
  if (ui().destination === 'home') ui().showDocument(id);
}

/**
 * Markup open or closed for the active document (`2` and `1`, M8's Edit and Read segments):
 * the page view in both, so switching never moves the page (ADR-0019 §2). Announced with
 * M8's words, which the visible control still uses.
 */
export function showMarkup(open: boolean): void {
  const id = model().workspace.activeDocument;
  if (id === undefined) return;
  // A locked document has no Markup: its capsule shows Locked (spec X1, D2-2), so `2` and the
  // other doors say why instead of opening a state nothing could be done in.
  if (open && isLocked(id)) {
    announce(m.guard_locked());
    return;
  }
  if (open) ui().openMarkup(id);
  else ui().closeMarkup(id);
  ui().showSurface('page', id);
  announce(open ? m.mode_edit_long() : m.read_locked_announce());
}

/**
 * Keeps the shell in step with the open documents: once the last document closes, starts
 * over as on a fresh start, so Home's empty state shows and the next file opens on its page
 * with Markup closed. (Each document keeps its own surface, `docUi`; the one shown follows
 * a tab switch in `ui-store`.)
 */
export function watchDestination(): () => void {
  return useWorkspaceStore.subscribe((state, previous) => {
    if (state.workspace === previous.workspace) return;
    if (state.workspace.documentOrder.length === 0 && previous.workspace.documentOrder.length > 0) {
      useUiStore.setState({ destination: 'document', docUi: {} });
      resetLibraryStore();
    }
  });
}

/** Selects cards on Home and says how many are selected. */
export function selectOnHome(ids: readonly DocumentId[], anchor?: DocumentId | null): void {
  ui().setHomeSelection(ids, anchor);
  announce(m.home_announce_selected({ count: ids.length }));
}

/**
 * After files were opened, dropped or picked alike (Open PDFs…, the palette, a drop; L2, L9):
 * the Library with the new cards checked (Select mode, the bar up) when two or more arrive on
 * an empty workspace or any arrive while the Library shows, with focus on the first new card;
 * one file opened on an empty workspace goes to its page. Two or more opened over a document
 * open as tabs and stay there, with "Opened 3 files · Show in Library" (02.19).
 */
export function showOpened(
  ids: readonly DocumentId[],
  context: { readonly wasEmpty: boolean },
): void {
  if (ids.length === 0) return;
  const onHome = ui().destination === 'home';
  if (context.wasEmpty && ids.length === 1) {
    if (onHome) ui().showSurface('page');
    return;
  }
  if (onHome || context.wasEmpty) {
    ui().showHome();
    selectOnHome(ids);
    focusCardSoon(ids[0]);
    return;
  }
  if (ids.length > 1) {
    toast.action(
      m.library_opened_files({ count: ids.length }),
      {
        label: m.library_show_in_library(),
        run: () => {
          ui().showHome();
          ui().setHomeSelection(liveSelection(order(), ids));
          focusCardSoon(ids[0]);
        },
      },
      { key: 'library-opened-files', testId: 'library-opened-toast' },
    );
  }
}

/** Focuses a card once the Library has rendered it (after a view change or an open). */
export function focusCardSoon(id: DocumentId | undefined): void {
  if (id === undefined) return;
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[role="option"][data-document-id="${id}"]`)?.focus();
  });
}

/** Opens a card: that document's page, on its tab. */
export function openInRead(id: DocumentId): void {
  if (model().workspace.documents[id] === undefined) return;
  model().setActive(id);
  ui().showSurface('page', id);
}

/** Combine with open documents (S15), pre-ordered: the selection, a card drop's pair. */
export function combine(ids: readonly DocumentId[]): void {
  const live = liveSelection(order(), ids);
  if (live.length < 2) return;
  openOperationDialog({ kind: 'combine', order: live });
}

/**
 * The Combine dialog's confirm (review F8): a new document of the files in `ids`, in that
 * order, titled `title` ("Combined – A + B" by default); the files stay open. One history
 * entry, announced with its undo shortcut and shown as the Undo toast "Combined 2 files · Undo"
 * (`08-feedback` FB4; the combine's own announcement already says it, so the toast is quiet).
 */
export function combineInto(ids: readonly DocumentId[], title: string): DocumentId | undefined {
  const ws = model().workspace;
  const titles = ids.map((id) => ws.documents[id]?.title ?? '');
  const created = mergeAll(ids, title);
  if (created !== undefined) {
    // The grid header's "Sources: …" line, for the session (PG6).
    ui().setCombinedFrom(created, titles);
    toast.undo(m.combined_toast({ count: ids.length }), {
      documentId: created,
      spoken: false,
      testId: 'combined-toast',
    });
  }
  return created;
}

/**
 * The selection bar's Combine (L6, INV-12, J3): a new document of the checked cards **in card
 * order** (02.9), titled "Combined – A + B", the sources kept open; one history entry. It opens
 * in its Pages grid with "Combined 2 files · Undo", and Select mode ends.
 */
export function combineNow(selection: readonly DocumentId[]): DocumentId | undefined {
  const ids = combineOrder(order(), selection);
  if (ids.length < 2) return undefined;
  const ws = model().workspace;
  const title = combinedTitle(ids.map((id) => ws.documents[id]?.title ?? ''));
  const created = combineInto(ids, title);
  if (created === undefined) return undefined;
  setSelecting(false);
  showInGrid(created);
  return created;
}

/** A new document on its own in the Pages grid (Combine, Combine files…; PG6). */
export function showInGrid(id: DocumentId): void {
  model().setActive(id);
  ui().setGridScope('document');
  ui().showSurface('grid', id);
}

/**
 * The launcher's Combine files… (L2, 02.10): the system picker, several files; two or more
 * PDFs become one new document in the order picked, opened in its Pages grid, and only it
 * opens: the picked files load as sources, never as documents of their own, all in one
 * composed history step. They go to Recents as opened files (no snapshot). One file opens as
 * usual, with "Choose two or more files to combine".
 */
export async function combineFiles(): Promise<DocumentId | undefined> {
  const picked = await pickFiles('pdf');
  const files = partitionFiles(picked).pdfs;
  if (files.length === 0) return undefined;
  if (files.length === 1) {
    const wasEmpty = order().length === 0;
    const ids = await openDocuments(files);
    const [only] = ids;
    if (only !== undefined) {
      if (wasEmpty) ui().showSurface('page', only);
      else openInRead(only);
    }
    toast.info(m.library_combine_files_one(), { key: 'library-combine-one' });
    return undefined;
  }
  const title = combinedTitle(files.map((file) => file.name.replace(/\.pdf$/i, '')));
  const checked = validateTitle(title);
  if (!checked.ok) return undefined;
  let created: DocumentId | undefined;
  let skipped: LoadedSources['skipped'] = [];
  let used: readonly File[] = [];
  const committed = await model().applyComposed(
    async (lease) => {
      const result = await model().loadSources(files, lease);
      skipped = result.skipped;
      used = result.loaded.map((l) => l.file);
      return result.loaded.length >= 2 ? result.loaded : undefined;
    },
    (ws, ids, loaded) => {
      let next = ws;
      const made: DocumentId[] = [];
      for (const { source } of loaded) {
        const r = addLoadedSource(next, source, ids);
        next = r.workspace;
        made.push(r.documentId);
      }
      next = mergeDocuments(next, { documentIds: made, title: checked.title }, ids);
      created = next.activeDocument;
      return next;
    },
    (loaded) => m.history_combine({ count: loaded.length }),
  );
  presentOpenFailures(skipped, files.length);
  if (!committed || created === undefined) return undefined;
  for (const file of used) void recordRecent({ name: file.name, size: file.size });
  // Opened from files: "Open documents locked" applies (ADR-0029 §2.8).
  lockOpened([created]);
  showInGrid(created);
  toast.undo(m.combined_toast({ count: used.length }), {
    documentId: created,
    spoken: m.announce_combined({
      count: used.length,
      title: checked.title,
      shortcut: currentPlatform === 'mac' ? m.undo_hint_mac() : m.undo_hint_other(),
    }),
    testId: 'combined-toast',
  });
  return created;
}

/** Open PDFs… (L2; the `file.open` command, Mod+O): the picker, then `showOpened`. */
export function openPdfs(): Promise<void> {
  return openFilesFromPicker();
}

/**
 * The selection bar's Compare (L6, J12): exactly two checked cards; the older file is A
 * (`compareOrder`), Swap is in the Compare bar.
 */
export async function compareSelected(selection: readonly DocumentId[]): Promise<void> {
  const live = liveSelection(order(), selection);
  const [x, y] = live;
  if (live.length !== 2 || x === undefined || y === undefined) return;
  const { files, workspace } = model();
  const modified = (id: DocumentId): number | undefined => {
    const first = workspace.documents[id]?.pages[0]?.ref;
    const file = first?.kind === 'source' ? files[first.source] : undefined;
    return file !== undefined && file.lastModified > 0 ? file.lastModified : undefined;
  };
  const [a, b] = compareOrder(order(), [x, y], modified);
  setSelecting(false);
  await compareOnHome(a, b);
}

/**
 * The selection bar's Pages (L6, 06.9): the Pages grid over every open document, the checked
 * ones open and the others collapsed to their headers, the first checked one current.
 */
export function pagesSelected(selection: readonly DocumentId[]): void {
  const all = order();
  const live = liveSelection(all, selection);
  const checked = all.filter((id) => live.includes(id));
  const first = checked[0] ?? all[0];
  if (first === undefined) return;
  model().setActive(first);
  ui().setGridScope('all');
  for (const id of all) ui().setArrangeCollapsed(id, checked.length > 0 && !checked.includes(id));
  setSelecting(false);
  ui().showSurface('grid', first);
  announce(m.library_announce_pages({ count: checked.length || all.length }));
}

/**
 * The selection bar's Close and Delete in Select mode (L6): the checked documents close as one
 * step, their snapshots go to Recents, and the Undo toast brings them back. Focus goes to the
 * card now at the first closed card's place, else the one before, else Open PDFs….
 */
export function closeSelected(selection: readonly DocumentId[]): void {
  const before = order();
  const ids = liveSelection(before, selection);
  if (ids.length === 0) return;
  const firstIndex = Math.min(...ids.map((id) => before.indexOf(id)));
  closeOnHome(ids, { quiet: true });
  const after = order();
  if (after.length === before.length) return;
  toast.undo(m.library_closed_toast({ count: ids.length }), {
    spoken: m.library_announce_closed({ count: ids.length }),
    keepOnClose: true,
    testId: 'library-closed-toast',
  });
  setSelecting(false);
  const next = after[Math.min(firstIndex, after.length - 1)];
  if (next !== undefined) {
    focusCardSoon(next);
    return;
  }
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[data-library-open]')?.focus();
  });
}

/**
 * Moves a card to `toIndex` (Alt+Left/Right, a drag's drop; L5, INV-19): the tab order, and so
 * Combine's order, changes with it, as one history entry "Moved report.pdf". No guard: the
 * order of the open documents is no document's content (02.8).
 */
export function moveCard(id: DocumentId, toIndex: number): boolean {
  const current = order();
  const next = movedOrder(current, id, toIndex);
  if (next === current) return false;
  const title = model().workspace.documents[id]?.title ?? '';
  const moved = model().applyOperation(
    (ws) => reorderDocuments(ws, next),
    m.library_history_move({ name: title }),
  );
  if (!moved) return false;
  announce(
    m.library_announce_moved({
      name: title,
      position: next.indexOf(id) + 1,
      count: next.length,
    }),
  );
  return true;
}

/** Compare with A and B chosen: the first and second selected cards. */
export async function compareOnHome(a: DocumentId, b: DocumentId): Promise<void> {
  if (a === b) return;
  const state = useCompareStore.getState();
  if (state.a !== a || state.b !== b) {
    // A kept comparison of another pair is released before the choices change.
    if (state.status !== 'setup') {
      await import('../compare/compare-runner').then((runner) => runner.releaseCompare());
    }
    useCompareStore.setState({ a, b });
  }
  enterCompare();
  announce(m.compare_mode_long());
}

/** Arrange with the selected documents shown (every document when none is selected). */
export function arrangeOnHome(selection: readonly DocumentId[]): void {
  const all = order();
  const selected = liveSelection(all, selection);
  const shown = selected.length > 0 ? selected : all;
  const first = shown[0];
  if (first === undefined) return;
  model().setActive(first);
  ui().setGridScope(shown.length > 1 ? 'all' : 'document');
  for (const id of all) ui().setArrangeCollapsed(id, !shown.includes(id));
  ui().showSurface('grid', first);
}

/**
 * Closes the selected documents as one undoable step. `quiet` leaves the announcement to the
 * caller's toast (the Library's Close says it with its Undo).
 */
export function closeOnHome(
  selection: readonly DocumentId[],
  options: { readonly quiet?: boolean } = {},
): void {
  const ids = liveSelection(order(), selection);
  if (ids.length === 0) return;
  const ws = model().workspace;
  const names = ids.map((id) => ws.documents[id]?.title ?? '');
  const label =
    ids.length === 1
      ? m.history_close({ name: names[0] ?? '' })
      : m.home_history_close({ count: ids.length });
  const closed = model().applyOperation((current) => {
    let next = current;
    const sources = new Set<SourceId>();
    for (const id of ids) {
      for (const page of next.documents[id]?.pages ?? []) {
        if (page.ref.kind === 'source') sources.add(page.ref.source);
      }
      next = closeDocument(next, id);
    }
    for (const source of sources) next = removeSourceIfUnreferenced(next, source);
    return next;
  }, label);
  if (!closed) return;
  ui().setHomeSelection([], null);
  if (options.quiet === true) return;
  announce(
    ids.length === 1
      ? m.announce_closed({ name: names[0] ?? '' })
      : m.home_announce_closed({ count: ids.length }),
  );
}

/** Opens what a Recents reopen produced: one file goes straight to Read, several to Home. */
async function openFromRecents(files: readonly File[]): Promise<boolean> {
  const wasEmpty = order().length === 0;
  const ids = await openDocuments(files);
  const [only] = ids;
  if (only !== undefined && ids.length === 1) openInRead(only);
  else showOpened(ids, { wasEmpty });
  return ids.length > 0;
}

/**
 * A Recents row (click, Enter): a row with a kept snapshot reopens it with no prompt or
 * picker, on every browser, at its page and with its changes (ADR-0032 §2.6). Otherwise it
 * reopens the file through its handle, asking for read permission within the click where the
 * browser needs it. Without a handle, or when the handle fails (permission denied, file
 * moved), the row turns to "Open again…" and says so in one line; "Open again…" opens the
 * file dialog. Call it straight from the event, with no await before it, so the permission
 * request keeps the click's user activation.
 */
export async function openRecent(entry: RecentEntry): Promise<void> {
  if (entry.kept !== undefined) {
    const kept = await reopenFromSnapshot(entry.kept.snapshotId);
    if (kept?.ok) {
      setRecentNote(null);
      openInRead(kept.documentId);
      announce(m.announce_opened({ name: kept.record.title }));
      return;
    }
    if (kept?.ok === false && kept.reason === 'failed') {
      // It did not open now (a skipped password prompt, an engine failure): the row keeps
      // its snapshot for another try rather than opening the file without the changes.
      toast.failure(m.session_reopen_failed({ name: kept.title ?? entry.name }));
      return;
    }
    // The snapshot is gone or unreadable: the row reopens like a plain recent.
  }
  const access = useRecentsStore.getState().access[entry.id];
  if (!canReopenRecent(entry) || access === 'unavailable') {
    await openRecentAgain(entry);
    return;
  }
  const result = await reopenRecent(entry);
  if (!result.ok) {
    setRecentNote({ id: entry.id, name: entry.name, kind: 'unavailable' });
    announce(m.recents_note_unavailable({ name: entry.name }));
    return;
  }
  setRecentNote(null);
  rememberFileHandle(result.file, result.handle);
  noteReopenedFrom(result.file, entry.id);
  await openFromRecents([result.file]);
}

/** "Open again…": the file dialog, with one line saying why it opened. */
export async function openRecentAgain(entry: RecentEntry): Promise<void> {
  const note = { id: entry.id, name: entry.name, kind: 'open-again' } as const;
  // The dialog opens first, within the click's user activation; the note follows at once.
  const picking = pickFiles('openable');
  setRecentNote(note);
  announce(m.recents_note_open_again({ name: entry.name }));
  const files = await picking;
  if (files.length === 0) return;
  for (const file of files) {
    if (file.name === entry.name) noteReopenedFrom(file, entry.id);
  }
  if (await openFromRecents(files)) {
    if (useRecentsStore.getState().note === note) setRecentNote(null);
  }
}

/** "Remove from recents" and Delete on a row. */
export function removeRecentEntry(entry: RecentEntry): void {
  void removeRecent(entry.id);
  announce(m.recents_announce_removed({ name: entry.name }));
}
