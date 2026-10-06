/**
 * The Library on real PDFs (Vitest browser mode, Chromium, PDFium; `02-library` L1–L9, L12):
 * lit cards in tab order, one click opens, Select mode by Shift, Mod, the ○ and right-click, the
 * static selection bar's dimmed reasons, Combine without a dialog in card order, Compare with the
 * older file as A, Pages and Close, the keys (Esc ladder, Alt+arrows, F2), drops and the
 * launcher's lift, Open PDFs… and Combine files…, the empty launcher, and Recents.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import type { DocumentId, SourceId } from '@pdf-editor/document-model';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import mixedUrl from '../../../../test/fixtures/mixed-sizes.pdf?url';
import rotatedUrl from '../../../../test/fixtures/rotated-pages.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { App } from '../app';
import { openDocuments } from '../commands/app-commands';
import { commandRegistry } from '../commands/registry';
import { currentPlatform } from '../commands/shortcuts';
import { resetCompareStore, useCompareStore } from '../compare/compare-store';
import {
  loadRecents,
  memoryRecentsBackend,
  type RecentFileHandle,
  recordRecent,
  setRecentsBackend,
  storedHandlesReadable,
  useRecentsStore,
} from '../files/recents';
import { setLocale } from '../i18n';
import { closeOperationDialog } from '../stage/operation-dialogs-store';
import { useAnnouncer } from '../shell/announcer';
import { useLockStore } from '../state/lock-store';
import { stageView, useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { isSelecting, resetLibraryStore } from './library-store';
import { libraryTextSafeRect } from './text-safe';

const MOD = currentPlatform === 'mac' ? 'Meta' : 'Control';

async function fixture(url: string, name: string): Promise<File> {
  const bytes = await (await fetch(url)).arrayBuffer();
  return new File([bytes], name, {
    type: 'application/pdf',
    lastModified: Date.UTC(2026, 8, 1, 12),
  });
}

const FILES: Readonly<Record<string, string>> = {
  'simple-text.pdf': simpleUrl,
  'rotated-pages.pdf': rotatedUrl,
  'mixed-sizes.pdf': mixedUrl,
};

const ws = () => useWorkspaceStore.getState().workspace;
/** What the stage shows: Home or a document view. */
const shown = () => stageView(useUiStore.getState());
const titleOf = (id: DocumentId | undefined) =>
  id === undefined ? undefined : ws().documents[id]?.title;

/** Opens fixtures (tab order as given) and shows Home. */
async function openOnHome(...names: string[]): Promise<readonly DocumentId[]> {
  render(<App />);
  const ids = await openDocuments(
    await Promise.all(names.map((name) => fixture(FILES[name] ?? '', name))),
  );
  useUiStore.getState().showHome();
  await screen.findByTestId('home');
  return ids;
}

const grid = () => screen.getByRole('listbox', { name: 'Files' });
const card = (title: string) =>
  within(grid()).getByRole('option', { name: new RegExp(`^${title},`) });
const selectedTitles = () =>
  within(grid())
    .getAllByRole('option', { selected: true })
    .map((o) => o.getAttribute('aria-label')?.split(',')[0]);

/**
 * Dispatches a native drag event carrying `data` (Testing Library's `fireEvent` copies the
 * DataTransfer into an empty one, which loses its items and drag data).
 */
function drag(target: Element, type: string, data: DataTransfer): void {
  act(() => {
    target.dispatchEvent(
      new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }),
    );
  });
}

describe('Library', () => {
  beforeEach(async () => {
    await page.viewport(1440, 900);
    resetWorkspace();
    resetCompareStore();
    resetLibraryStore();
    closeOperationDialog();
    useUiStore.setState({
      destination: 'document',
      docUi: {},
      homeSelection: [],
      homeAnchor: null,
      arrangePinned: [],
      arrangeHidden: [],
      arrangeCollapsed: [],
      paletteOpen: false,
    });
  });
  afterEach(() => {
    closeOperationDialog();
    resetWorkspace();
    resetLibraryStore();
  });

  it('shows one lit card per open document, in tab order, with pages, size and a thumbnail', async () => {
    await openOnHome('simple-text.pdf', 'rotated-pages.pdf');
    const options = within(grid()).getAllByRole('option');
    expect(options.map((o) => o.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^simple-text, 3 pages, \d+(\.\d)? KB$/),
      expect.stringMatching(/^rotated-pages, 4 pages, \d+(\.\d)? KB$/),
    ]);
    expect(options[0]).toHaveAttribute('data-lit');
    // The first page through the shared thumbnail renderer.
    await waitFor(
      () => {
        expect(options[1]?.querySelector('canvas[data-state="rendered"]')).not.toBeNull();
      },
      { timeout: 20_000 },
    );
    expect(screen.getByTestId('library-head')).toHaveTextContent('Open · 2 documents · 7 pages');
    // The head row is the field's text-safe band (02.2), published for D3-8.
    expect(screen.getByTestId('library-head')).toHaveAttribute('data-text-safe');
    const rect = libraryTextSafeRect();
    const head = screen.getByTestId('library-head').getBoundingClientRect();
    expect(rect?.top).toBeCloseTo(head.top - 24);
    expect(rect?.width).toBeCloseTo(head.width + 48);

    // A closed tab leaves the Library.
    const first = ws().documentOrder[0];
    if (first !== undefined) useWorkspaceStore.getState().closeDocument(first);
    await waitFor(() => {
      expect(within(grid()).getAllByRole('option')).toHaveLength(1);
    });
  }, 45_000);

  it('opens a card with one click; Shift, Mod, the ○ and right-click select', async () => {
    await openOnHome('simple-text.pdf', 'rotated-pages.pdf', 'mixed-sizes.pdf');
    // Not selecting: no bar, Select in the head.
    expect(screen.queryByTestId('library-selection-bar')).toBeNull();
    expect(screen.getByTestId('library-select')).toHaveAttribute('aria-pressed', 'false');

    await userEvent.keyboard(`{${MOD}>}`);
    await userEvent.click(card('rotated-pages'));
    await userEvent.keyboard(`{/${MOD}}`);
    expect(selectedTitles()).toEqual(['rotated-pages']);
    expect(screen.getByTestId('library-select')).toHaveAttribute('aria-pressed', 'true');
    expect(useAnnouncer.getState().message).toBe('1 file selected');
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(card('mixed-sizes'));
    await userEvent.keyboard('{/Shift}');
    expect(selectedTitles()).toEqual(['rotated-pages', 'mixed-sizes']);
    // In Select mode a plain click toggles.
    await userEvent.click(card('rotated-pages'));
    expect(selectedTitles()).toEqual(['mixed-sizes']);
    expect(
      within(screen.getByTestId('library-selection-bar')).getByText('1 selected'),
    ).toBeVisible();

    // Done leaves Select mode and clears.
    await userEvent.click(screen.getByTestId('library-select'));
    expect(within(grid()).queryAllByRole('option', { selected: true })).toHaveLength(0);
    expect(screen.queryByTestId('library-selection-bar')).toBeNull();

    // Right-click enters Select mode with the card checked; the ○ toggles.
    fireEvent.contextMenu(card('simple-text'));
    expect(selectedTitles()).toEqual(['simple-text']);
    fireEvent.click(within(card('mixed-sizes')).getByTestId('library-card-check'));
    expect(selectedTitles()).toEqual(['simple-text', 'mixed-sizes']);

    // Not selecting, one click opens.
    await userEvent.click(screen.getByTestId('library-select'));
    await userEvent.click(card('rotated-pages'));
    await waitFor(() => {
      expect(shown()).toBe('page');
    });
    expect(titleOf(ws().activeDocument ?? undefined)).toBe('rotated-pages');
  });

  it('dims Combine and Compare with their reasons, so the bar never reflows', async () => {
    await openOnHome('simple-text.pdf', 'rotated-pages.pdf', 'mixed-sizes.pdf');
    fireEvent.contextMenu(card('simple-text'));
    const bar = screen.getByTestId('library-selection-bar');
    expect(bar).toHaveAttribute('role', 'toolbar');
    const combine = () => within(bar).getByTestId('library-combine');
    const compare = () => within(bar).getByTestId('library-compare');
    expect(combine()).toHaveAttribute('aria-disabled', 'true');
    expect(combine()).toHaveAccessibleDescription('Select two or more documents to combine');
    expect(compare()).toHaveAttribute('aria-disabled', 'true');
    expect(compare()).toHaveAccessibleDescription('Select exactly two documents to compare');
    fireEvent.contextMenu(card('mixed-sizes'));
    expect(combine()).not.toHaveAttribute('aria-disabled', 'true');
    expect(combine()).toHaveTextContent('Combine 2 files');
    expect(compare()).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.contextMenu(card('rotated-pages'));
    expect(compare()).toHaveAttribute('aria-disabled', 'true');
    expect(combine()).toHaveTextContent('Combine 3 files');
  });

  it('combines the checked cards in card order with no dialog, in the Pages grid, one Undo', async () => {
    await openOnHome('simple-text.pdf', 'rotated-pages.pdf', 'mixed-sizes.pdf');
    // Checked in the opposite order to the cards.
    fireEvent.contextMenu(card('mixed-sizes'));
    fireEvent.contextMenu(card('simple-text'));
    await userEvent.click(screen.getByTestId('library-combine'));
    expect(screen.queryByTestId('merge-all-dialog')).toBeNull();
    await waitFor(() => {
      expect(shown()).toBe('grid');
    });
    const created = ws().activeDocument;
    expect(titleOf(created ?? undefined)).toBe('Combined – simple-text + mixed-sizes');
    // Card order: simple-text's 3 pages, then mixed-sizes' 5; the sources stay open.
    expect(ws().documents[created as DocumentId]?.pages).toHaveLength(8);
    expect(ws().documentOrder).toHaveLength(4);
    expect(useWorkspaceStore.getState().history.present.label).toBe('Combine 2 files');
    expect(await screen.findByTestId('combined-toast')).toHaveTextContent('Combined 2 files');
    useWorkspaceStore.getState().undo();
    await waitFor(() => {
      expect(ws().documentOrder).toHaveLength(3);
    });
  });

  it('compares two checked documents, the older file as A', async () => {
    const [simple, , mixed] = await openOnHome(
      'simple-text.pdf',
      'rotated-pages.pdf',
      'mixed-sizes.pdf',
    );
    // Give mixed-sizes the older file time.
    act(() => {
      const files = { ...useWorkspaceStore.getState().files };
      for (const [id, file] of Object.entries(files)) {
        if (file.name === 'mixed-sizes.pdf')
          files[id as SourceId] = { ...file, lastModified: 1000 };
      }
      useWorkspaceStore.setState({ files });
    });
    fireEvent.contextMenu(card('simple-text'));
    fireEvent.contextMenu(card('mixed-sizes'));
    await userEvent.click(screen.getByTestId('library-compare'));
    await waitFor(() => {
      expect(shown()).toBe('compare');
    });
    const { a, b } = useCompareStore.getState();
    expect([a, b]).toEqual([mixed, simple]);
  });

  it('opens the Pages grid over every document, and closes the checked ones in one step', async () => {
    await openOnHome('simple-text.pdf', 'rotated-pages.pdf', 'mixed-sizes.pdf');
    fireEvent.contextMenu(card('rotated-pages'));
    fireEvent.contextMenu(card('mixed-sizes'));
    await userEvent.click(screen.getByTestId('library-close'));
    await waitFor(() => {
      expect(within(grid()).getAllByRole('option')).toHaveLength(1);
    });
    expect(useWorkspaceStore.getState().history.present.label).toBe('Close 2 documents');
    expect(await screen.findByTestId('library-closed-toast')).toHaveTextContent(
      'Closed 2 documents · changes kept',
    );
    // Focus goes to the card now in the first closed card's place, else the one before.
    await waitFor(() => {
      expect(card('simple-text')).toHaveFocus();
    });
    useWorkspaceStore.getState().undo();
    await waitFor(() => {
      expect(within(grid()).getAllByRole('option')).toHaveLength(3);
    });

    fireEvent.contextMenu(card('mixed-sizes'));
    await userEvent.click(screen.getByTestId('library-pages'));
    await waitFor(() => {
      expect(shown()).toBe('grid');
    });
    expect(titleOf(ws().activeDocument ?? undefined)).toBe('mixed-sizes');
    const collapsed = useUiStore.getState().arrangeCollapsed.map(titleOf);
    expect(collapsed.sort()).toEqual(['rotated-pages', 'simple-text']);
  });

  it('moves with arrows, checks with Space, Esc clears then leaves, Enter opens', async () => {
    await openOnHome('simple-text.pdf', 'rotated-pages.pdf', 'mixed-sizes.pdf');
    const options = within(grid()).getAllByRole('option');
    // Roving tabindex: one card is in the tab order.
    expect(options.filter((o) => o.tabIndex === 0)).toHaveLength(1);
    options[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(card('rotated-pages')).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(selectedTitles()).toEqual(['rotated-pages']);
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(selectedTitles()).toEqual(['rotated-pages', 'mixed-sizes']);
    await userEvent.keyboard('{Escape}');
    expect(within(grid()).queryAllByRole('option', { selected: true })).toHaveLength(0);
    // Still in Select mode: the second Esc leaves it.
    expect(isSelecting()).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect(isSelecting()).toBe(false);
    expect(shown()).toBe('home');
    await userEvent.keyboard(`{${MOD}>}a{/${MOD}}`);
    expect(selectedTitles()).toEqual(['simple-text', 'rotated-pages', 'mixed-sizes']);
    await userEvent.keyboard('{Escape}{Escape}');

    await userEvent.keyboard('{Home}{Enter}');
    await waitFor(() => {
      expect(shown()).toBe('page');
    });
    expect(titleOf(ws().activeDocument ?? undefined)).toBe('simple-text');
  });

  it('reorders with Alt+arrows: tabs and Combine follow, one history entry', async () => {
    await openOnHome('simple-text.pdf', 'rotated-pages.pdf', 'mixed-sizes.pdf');
    card('simple-text').focus();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(ws().documentOrder.map(titleOf)).toEqual([
      'rotated-pages',
      'simple-text',
      'mixed-sizes',
    ]);
    expect(useWorkspaceStore.getState().history.present.label).toBe('Move simple-text');
    expect(useAnnouncer.getState().message).toBe('Moved simple-text to position 2 of 3');
    await waitFor(() => {
      expect(card('simple-text')).toHaveFocus();
    });
    expect(
      within(screen.getByRole('tablist', { name: 'Open documents' }))
        .getAllByRole('tab')
        .map((tab) => tab.textContent?.trim().replace(/\s+.*/, '')),
    ).toEqual(['rotated-pages', 'simple-text', 'mixed-sizes']);
    useWorkspaceStore.getState().undo();
    expect(ws().documentOrder.map(titleOf)).toEqual([
      'simple-text',
      'rotated-pages',
      'mixed-sizes',
    ]);
  });

  it('renames with F2, refused with its reason on a locked document', async () => {
    const [simple] = await openOnHome('simple-text.pdf', 'rotated-pages.pdf');
    card('simple-text').focus();
    await userEvent.keyboard('{F2}');
    const input = await screen.findByRole('textbox', { name: 'Document title' });
    await userEvent.clear(input);
    await userEvent.type(input, 'notes{Enter}');
    expect(titleOf(simple)).toBe('notes');

    act(() => useLockStore.getState().lock(simple as DocumentId));
    card('notes').focus();
    await userEvent.keyboard('{F2}');
    expect(screen.queryByRole('textbox', { name: 'Document title' })).toBeNull();
    expect(card('notes')).toHaveAccessibleName(/, Locked$/);
  });

  it('starts over after the last document closes: the launcher, then the next file in viewing', async () => {
    const ids = await openOnHome('simple-text.pdf');
    act(() => {
      for (const id of ids) useWorkspaceStore.getState().closeDocument(id);
    });
    expect(screen.getByTestId('home')).toHaveAttribute('data-variant', 'empty');
    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(useUiStore.getState()).toMatchObject({ destination: 'document', docUi: {} });
  });

  it('checks the new cards after two files are dropped, and lifts the launcher while dragging', async () => {
    render(<App />);
    const files = await Promise.all([
      fixture(simpleUrl, 'simple-text.pdf'),
      fixture(rotatedUrl, 'rotated-pages.pdf'),
    ]);
    const data = new DataTransfer();
    for (const file of files) data.items.add(file);
    const shell = screen.getByTestId('app-shell');
    drag(shell, 'dragenter', data);
    drag(shell, 'dragover', data);
    // No overlay on the Library: the launcher lifts and says what a release does.
    const launcher = screen.getByTestId('library-launcher');
    expect(launcher).toHaveAttribute('data-dragging');
    expect(within(launcher).getByRole('heading', { level: 1 })).toHaveTextContent(
      'Drop to open 2 files',
    );
    expect(screen.queryByTestId('drop-overlay')).toBeNull();
    drag(shell, 'drop', data);
    await waitFor(
      () => {
        expect(within(grid()).getAllByRole('option', { selected: true })).toHaveLength(2);
      },
      { timeout: 20_000 },
    );
    expect(shown()).toBe('home');
    expect(screen.getByTestId('library-combine')).toHaveTextContent('Combine 2 files');
    await waitFor(() => {
      expect(card('simple-text')).toHaveFocus();
    });

    // A file dropped while the Library shows joins the cards, checked.
    const more = new DataTransfer();
    more.items.add(await fixture(mixedUrl, 'mixed-sizes.pdf'));
    drag(screen.getByTestId('home'), 'drop', more);
    await waitFor(
      () => {
        expect(selectedTitles()).toEqual(['mixed-sizes']);
      },
      { timeout: 20_000 },
    );
  }, 45_000);

  it('checks the new cards after two files are picked with Open PDFs…', async () => {
    const files = await Promise.all([
      fixture(simpleUrl, 'simple-text.pdf'),
      fixture(rotatedUrl, 'rotated-pages.pdf'),
    ]);
    const picker = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: () => Promise.resolve(files.map((file) => ({ getFile: () => Promise.resolve(file) }))),
    });
    try {
      render(<App />);
      const empty = await screen.findByTestId('home');
      // First focus on a first visit (J1).
      const open = within(empty).getByRole('button', { name: 'Open PDFs…' });
      await waitFor(() => {
        expect(open).toHaveFocus();
      });
      await userEvent.click(open);
      await waitFor(
        () => {
          expect(within(grid()).getAllByRole('option', { selected: true })).toHaveLength(2);
        },
        { timeout: 20_000 },
      );
      expect(shown()).toBe('home');
    } finally {
      if (picker) Object.defineProperty(window, 'showOpenFilePicker', picker);
      else Reflect.deleteProperty(window, 'showOpenFilePicker');
    }
  }, 45_000);

  it('Combine files… makes one document of the picked files, with no other tab', async () => {
    const files = await Promise.all([
      fixture(simpleUrl, 'simple-text.pdf'),
      fixture(rotatedUrl, 'rotated-pages.pdf'),
    ]);
    const picker = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: () => Promise.resolve(files.map((file) => ({ getFile: () => Promise.resolve(file) }))),
    });
    try {
      render(<App />);
      const empty = await screen.findByTestId('home');
      await userEvent.click(within(empty).getByRole('button', { name: 'Combine files…' }));
      await waitFor(
        () => {
          expect(ws().documentOrder).toHaveLength(1);
        },
        { timeout: 20_000 },
      );
      expect(titleOf(ws().activeDocument ?? undefined)).toBe(
        'Combined – simple-text + rotated-pages',
      );
      expect(ws().documents[ws().activeDocument as DocumentId]?.pages).toHaveLength(7);
      expect(shown()).toBe('grid');
      // One composed step: undo leaves nothing open.
      useWorkspaceStore.getState().undo();
      expect(ws().documentOrder).toHaveLength(0);
    } finally {
      if (picker) Object.defineProperty(window, 'showOpenFilePicker', picker);
      else Reflect.deleteProperty(window, 'showOpenFilePicker');
    }
  }, 45_000);

  it('opens a single dropped file in viewing; two over a document open as tabs with a toast', async () => {
    render(<App />);
    const data = new DataTransfer();
    data.items.add(await fixture(simpleUrl, 'simple-text.pdf'));
    drag(screen.getByTestId('app-shell'), 'drop', data);
    await waitFor(
      () => {
        expect(ws().documentOrder).toHaveLength(1);
      },
      { timeout: 20_000 },
    );
    expect(shown()).toBe('page');
    expect(screen.queryByTestId('home')).toBeNull();

    // Over a document: the overlay, then tabs and "Opened 2 files · Show in Library" (02.19).
    const two = new DataTransfer();
    two.items.add(await fixture(rotatedUrl, 'rotated-pages.pdf'));
    two.items.add(await fixture(mixedUrl, 'mixed-sizes.pdf'));
    const shell = screen.getByTestId('app-shell');
    drag(shell, 'dragenter', two);
    expect(await screen.findByTestId('drop-overlay')).toHaveTextContent('Drop to open 2 files');
    drag(shell, 'drop', two);
    await waitFor(
      () => {
        expect(ws().documentOrder).toHaveLength(3);
      },
      { timeout: 20_000 },
    );
    expect(shown()).toBe('page');
    expect(screen.queryByTestId('drop-overlay')).toBeNull();
    expect(await screen.findByTestId('library-opened-toast')).toHaveTextContent('Opened 2 files');
  }, 45_000);

  it('is the launcher with no file open: the headline, Open PDFs…, the sample and Combine files…', async () => {
    render(<App />);
    useUiStore.getState().showHome();
    const home = await screen.findByTestId('home');
    expect(home).toHaveAttribute('data-variant', 'empty');
    expect(home).toHaveAccessibleName('Library');
    expect(
      within(home).getByRole('heading', {
        level: 1,
        name: 'Read, mark up, sign and arrange PDFs.',
      }),
    ).toBeVisible();
    expect(within(home).getByText('Nothing leaves this device.')).toBeVisible();
    expect(within(home).getByRole('button', { name: 'Open PDFs…' })).toHaveClass('btn-prominent');
    expect(within(home).getByRole('button', { name: 'Try the sample' })).toBeVisible();
    expect(within(home).getByRole('button', { name: 'Combine files…' })).toBeVisible();
    expect(within(home).getByRole('button', { name: 'More' })).toBeVisible();
    expect(within(home).getByRole('radiogroup', { name: 'Language' })).toBeVisible();
    expect(within(home).getByTestId('library-privacy')).toHaveTextContent('Nothing is uploaded');
    expect(within(home).queryByRole('listbox')).toBeNull();
  });

  it('is reached from the palette in both languages', async () => {
    render(<App />);
    const command = commandRegistry.list().find((c) => c.id === 'view.home');
    expect(command?.title).toBe('Show Home');
    expect(command?.keywords).toEqual(expect.arrayContaining(['overview', 'ana ekran']));
    await userEvent.keyboard(`{${MOD}>}k{/${MOD}}`);
    const input = await screen.findByRole('combobox', { name: 'Search commands' });
    await userEvent.type(input, 'ana ekran');
    await waitFor(() => {
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('Show Home');
    });
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(shown()).toBe('home');
    });
  });
});

/** A file handle as Chromium hands one out, with a scripted read permission. */
function fakeHandle(
  file: File,
  permission: { readonly query: PermissionState; readonly request?: PermissionState },
): RecentFileHandle & { requested: number } {
  const handle = {
    kind: 'file' as const,
    name: file.name,
    requested: 0,
    getFile: () => Promise.resolve(file),
    queryPermission: () => Promise.resolve(permission.query),
    requestPermission: () => {
      handle.requested += 1;
      return Promise.resolve(permission.request ?? permission.query);
    },
  };
  return handle;
}

describe('Recents on the Library', () => {
  const recents = () => screen.getByRole('list', { name: 'Recent files' });
  const row = (name: string) =>
    within(recents()).getByRole('button', { name: new RegExp(`^${name.replace('.', '\\.')},`) });
  const recentNames = () =>
    within(recents())
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('data-recent-id'))
      .map((b) => b.getAttribute('aria-label')?.split(',')[0]);
  let restorePicker: (() => void) | undefined;

  /** Replaces the Chromium file picker with one that "chooses" `files`. */
  function stubPicker(files: readonly File[]): { calls: number } {
    const state = { calls: 0 };
    const previous = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: () => {
        state.calls += 1;
        return Promise.resolve(files.map((file) => fakeHandle(file, { query: 'granted' })));
      },
    });
    restorePicker = () => {
      if (previous) Object.defineProperty(window, 'showOpenFilePicker', previous);
      else Reflect.deleteProperty(window, 'showOpenFilePicker');
    };
    return state;
  }

  beforeEach(async () => {
    await page.viewport(1440, 900);
    setRecentsBackend(memoryRecentsBackend());
    resetWorkspace();
    useUiStore.setState({
      destination: 'document',
      docUi: {},
      homeSelection: [],
      homeAnchor: null,
      paletteOpen: false,
    });
  });
  afterEach(() => {
    restorePicker?.();
    restorePicker = undefined;
    resetWorkspace();
    setRecentsBackend(undefined);
  });

  it('shows nothing while there are no recents', async () => {
    render(<App />);
    const home = await screen.findByTestId('home');
    await loadRecents();
    expect(within(home).queryByRole('heading', { name: 'Recent' })).toBeNull();
    expect(within(home).queryByRole('list', { name: 'Recent files' })).toBeNull();
  });

  it('lists recents under the drop area with no file open: name, pages, size and time', async () => {
    const now = Date.now();
    await recordRecent({ name: 'report.pdf', size: 6246, pages: 6, now: now - 5 * 60_000 });
    await recordRecent({ name: 'invoice.pdf', size: 812, now: now - 86_400_000 - 3_600_000 });
    await recordRecent({ name: 'scan.pdf', size: 2_936_013, pages: 1, now: now - 10_000 });
    render(<App />);
    const home = await screen.findByTestId('home');
    expect(home).toHaveAttribute('data-variant', 'empty');
    const heading = await within(home).findByRole('heading', { name: 'Recent' });
    // Newest first.
    expect(recentNames()).toEqual(['scan.pdf', 'report.pdf', 'invoice.pdf']);
    expect(row('report.pdf')).toHaveAccessibleName(
      'report.pdf, 6 pages · 6.1 KB, 5 minutes ago, Open again…',
    );
    expect(row('invoice.pdf')).toHaveAccessibleName('invoice.pdf, 812 B, yesterday, Open again…');
    expect(row('scan.pdf')).toHaveTextContent('now');
    // One column: the launcher card first, the recents under it (L1 §2).
    const drop = within(home).getByRole('heading', {
      name: 'Read, mark up, sign and arrange PDFs.',
    });
    expect(heading.compareDocumentPosition(drop) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(within(home).getByRole('button', { name: 'Clear recents' })).toBeVisible();
  });

  it('records every open, lists it under the cards once closed, in the active language', async () => {
    await openOnHome('simple-text.pdf', 'rotated-pages.pdf');
    await waitFor(() => {
      expect(useRecentsStore.getState().entries.map((e) => e.name)).toEqual([
        'rotated-pages.pdf',
        'simple-text.pdf',
      ]);
    });
    // Open files are the cards above; Recents does not repeat them.
    expect(screen.queryByRole('list', { name: 'Recent files' })).toBeNull();
    const first = ws().documentOrder[0];
    if (first !== undefined) useWorkspaceStore.getState().closeDocument(first);
    // Closing keeps the entry.
    await waitFor(() => {
      expect(recentNames()).toEqual(['simple-text.pdf']);
    });
    expect(row('simple-text.pdf')).toHaveAccessibleName(/^simple-text\.pdf, 3 pages · .+, now/);
    // Under the cards.
    expect(
      grid().compareDocumentPosition(recents()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    act(() => {
      setLocale('tr');
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Son açılanlar' })).toBeVisible();
    });
    expect(
      within(screen.getByRole('list', { name: 'Son açılan dosyalar' })).getByRole('button', {
        name: /^simple-text\.pdf, 3 sayfa · .+, şimdi, Yeniden aç…$/,
      }),
    ).toBeVisible();
    act(() => {
      setLocale('en');
    });
  }, 45_000);

  it('moves with the arrows, removes with Delete and reaches the ⋯ menu with Right', async () => {
    for (const [i, name] of ['a.pdf', 'b.pdf', 'c.pdf'].entries()) {
      await recordRecent({ name, size: 100 + i, now: Date.now() - (3 - i) * 1000 });
    }
    render(<App />);
    await screen.findByRole('list', { name: 'Recent files' });
    expect(recentNames()).toEqual(['c.pdf', 'b.pdf', 'a.pdf']);
    // One tab stop: the first row.
    expect(row('c.pdf')).toHaveAttribute('tabindex', '0');
    expect(row('b.pdf')).toHaveAttribute('tabindex', '-1');
    row('c.pdf').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(row('b.pdf')).toHaveFocus();
    expect(row('b.pdf')).toHaveAttribute('tabindex', '0');
    await userEvent.keyboard('{End}');
    expect(row('a.pdf')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(row('c.pdf')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Delete}');
    await waitFor(() => {
      expect(recentNames()).toEqual(['c.pdf', 'a.pdf']);
    });
    expect(useAnnouncer.getState().message).toBe('b.pdf removed from recents');
    await waitFor(() => {
      expect(row('a.pdf')).toHaveFocus();
    });

    await userEvent.keyboard('{ArrowRight}');
    const more = screen.getByRole('button', { name: 'More actions for a.pdf' });
    expect(more).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(row('a.pdf')).toHaveFocus();
  });

  it('removes an entry from its ⋯ menu', async () => {
    await recordRecent({ name: 'a.pdf', size: 1, now: Date.now() - 2000 });
    await recordRecent({ name: 'b.pdf', size: 2, now: Date.now() - 1000 });
    render(<App />);
    await screen.findByRole('list', { name: 'Recent files' });
    await userEvent.click(screen.getByRole('button', { name: 'More actions for a.pdf' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Remove from recents' }));
    await waitFor(() => {
      expect(recentNames()).toEqual(['b.pdf']);
    });
    expect(useRecentsStore.getState().entries.map((e) => e.name)).toEqual(['b.pdf']);
  });

  it('clears every entry with "Clear recents", and the palette has the command', async () => {
    await recordRecent({ name: 'a.pdf', size: 1 });
    await recordRecent({ name: 'b.pdf', size: 2 });
    render(<App />);
    await screen.findByRole('list', { name: 'Recent files' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear recents' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Recent' })).toBeNull();
    });
    expect(useAnnouncer.getState().message).toBe('Recents cleared');

    await recordRecent({ name: 'c.pdf', size: 3 });
    await screen.findByRole('list', { name: 'Recent files' });
    const command = commandRegistry.list().find((c) => c.id === 'file.clearRecents');
    expect(command?.title).toBe('Clear recents');
    expect(command?.keywords).toEqual(expect.arrayContaining(['history', 'geçmiş']));
    await act(async () => {
      await commandRegistry.execute('file.clearRecents');
    });
    expect(screen.queryByRole('list', { name: 'Recent files' })).toBeNull();
  });

  it('says so, on Home and out loud, when the stored copy cannot be cleared', async () => {
    // Review F6: a stored database that refuses to clear (the only backend, no fallback).
    const memory = memoryRecentsBackend();
    let refuse = true;
    setRecentsBackend(
      {
        ...memory,
        clear: () => (refuse ? Promise.reject(new Error('InvalidStateError')) : memory.clear()),
      },
      { memoryFallback: false },
    );
    await recordRecent({ name: 'a.pdf', size: 1 });
    render(<App />);
    await screen.findByRole('list', { name: 'Recent files' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear recents' }));
    const message =
      'Recents were cleared from the list, but the copy kept on this device could not be deleted. Try Clear recents again, or clear this site’s data in your browser.';
    const note = await screen.findByTestId('recent-clear-failed');
    expect(note).toBeVisible();
    expect(note).toHaveTextContent(message);
    expect(screen.queryByRole('list', { name: 'Recent files' })).toBeNull();
    expect(useAnnouncer.getState().alert).toBe(message);
    // Clear again, now that the database lets it: the section goes.
    refuse = false;
    await userEvent.click(screen.getByRole('button', { name: 'Clear recents' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Recent' })).toBeNull();
    });
    expect(useAnnouncer.getState().message).toBe('Recents cleared');
    expect(await memory.list()).toEqual([]);
  });

  it('reopens through a kept handle, in Read, asking for permission within the click', async () => {
    const file = await fixture(simpleUrl, 'simple-text.pdf');
    const handle = fakeHandle(file, { query: 'prompt', request: 'granted' });
    // Stored by an earlier visit: after a reload Chromium asks again before reading.
    setRecentsBackend(
      memoryRecentsBackend([
        { id: 'kept', name: file.name, size: file.size, pages: 3, openedAt: 1, handle },
      ]),
    );
    render(<App />);
    await screen.findByRole('list', { name: 'Recent files' });
    if (!storedHandlesReadable()) {
      // Chromium 153 crashes on reading a stored handle back, so the row goes through the
      // file dialog instead (files/recents.ts).
      expect(row('simple-text.pdf')).toHaveAccessibleName(/, Open again…$/);
      const picker = stubPicker([file]);
      await userEvent.click(row('simple-text.pdf'));
      await waitFor(() => {
        expect(ws().documentOrder).toHaveLength(1);
      });
      expect(picker.calls).toBe(1);
      expect(handle.requested).toBe(0);
      return;
    }
    await waitFor(() => {
      expect(row('simple-text.pdf')).toHaveAccessibleName(/, Needs permission$/);
    });
    await userEvent.click(row('simple-text.pdf'));
    await waitFor(() => {
      expect(ws().documentOrder).toHaveLength(1);
    });
    expect(handle.requested).toBe(1);
    expect(titleOf(ws().activeDocument)).toBe('simple-text');
    expect(shown()).toBe('page');
    // Still one entry, now on top, with its handle.
    await waitFor(() => {
      expect(useRecentsStore.getState().entries).toHaveLength(1);
    });
    expect(useRecentsStore.getState().entries[0]?.handle).toBe(handle);
  }, 45_000);

  it('turns a row to "Open again…" when permission is denied, then opens the file dialog', async () => {
    const file = await fixture(simpleUrl, 'simple-text.pdf');
    const handle = fakeHandle(file, { query: 'prompt', request: 'denied' });
    await recordRecent({ name: file.name, size: file.size, handle, now: Date.now() });
    render(<App />);
    await screen.findByRole('list', { name: 'Recent files' });
    const picker = stubPicker([file]);

    await userEvent.click(row('simple-text.pdf'));
    const note = await screen.findByTestId('recent-note');
    expect(note).toHaveTextContent(
      '“simple-text.pdf” could not be reopened: it was moved, or access was not given. Open again… to choose it.',
    );
    expect(row('simple-text.pdf')).toHaveAccessibleName(/, Open again…$/);
    expect(ws().documentOrder).toHaveLength(0);
    expect(picker.calls).toBe(0);

    // The second click goes through the file dialog.
    await userEvent.click(row('simple-text.pdf'));
    await waitFor(() => {
      expect(ws().documentOrder).toHaveLength(1);
    });
    expect(picker.calls).toBe(1);
    expect(shown()).toBe('page');
  }, 45_000);

  it('opens the file dialog for an entry without a handle and says so in one line', async () => {
    const file = await fixture(simpleUrl, 'simple-text.pdf');
    await recordRecent({ name: file.name, size: file.size, now: Date.now() });
    render(<App />);
    await screen.findByRole('list', { name: 'Recent files' });
    let release: (files: unknown[]) => void = () => undefined;
    const previous = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    restorePicker = () => {
      if (previous) Object.defineProperty(window, 'showOpenFilePicker', previous);
      else Reflect.deleteProperty(window, 'showOpenFilePicker');
    };

    await userEvent.click(row('simple-text.pdf'));
    // While the dialog is open, the line says why it opened.
    const note = await screen.findByTestId('recent-note');
    expect(note).toHaveTextContent(
      'This browser doesn’t keep access to files: choose “simple-text.pdf” in the file dialog.',
    );
    expect(useAnnouncer.getState().message).toBe(note.textContent);
    act(() => release([fakeHandle(file, { query: 'granted' })]));
    await waitFor(() => {
      expect(ws().documentOrder).toHaveLength(1);
    });
    await waitFor(() => {
      expect(screen.queryByTestId('recent-note')).toBeNull();
    });
    // The picked file came with a handle: the entry keeps it from now on.
    await waitFor(() => {
      expect(useRecentsStore.getState().entries[0]?.handle).toBeDefined();
    });
    expect(useRecentsStore.getState().entries).toHaveLength(1);
  }, 45_000);
});
