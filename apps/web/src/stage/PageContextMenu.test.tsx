/**
 * The page context menu (ADR-0019 §4, craft spec §3.4), Vitest browser mode with the Read
 * view, the tool bar (which mounts the menu) and real PDFium: it opens on a right-click and
 * on Shift+F10, its items act on the page it was opened on and name it, "Edit text here" is
 * Edit's only, Read offers no page change (one quiet row switches to Edit instead), and a
 * right-click on selected text keeps the browser's menu. On touch a long press on the paper
 * opens it (04-context §2.3; spec D1-7), once, and never on a text run or for a drawing pen.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';
import '../annotations/index';

import { getActiveDocument, type VirtualDocument } from '@pdf-editor/document-model';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { EXIT_TIMEOUT } from '../../test/settled';
import rotatedUrl from '../../../../test/fixtures/rotated-pages.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { enterEditMode, fixtureFile } from '../../test/store-harness';
import { resetAnnotationStore } from '../annotations/annotation-store';
import { resetEditRunner, whenIdle } from '../annotations/edit-runner';
import { registerAppCommands } from '../commands/app-commands';
import { useShortcuts } from '../commands/use-shortcuts';
import { useAnnouncer } from '../shell/announcer';
import { Dock } from '../shell/frame/Dock';
import { PageContextMenu } from './PageContextMenu';
import { resetLockStore, useLockStore } from '../state/lock-store';
import { useSelectionStore } from '../state/selection-store';
import { isMarkupOpen, stageView, useUiStore } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { useToastStore } from '../ui/Toast/toast-store';
import { resetToolStore, useToolStore } from '../viewer/tool-store';
import { closeOperationDialog, useOperationDialogStore } from './operation-dialogs-store';
import { ReadView } from './ReadView';

function Harness() {
  useShortcuts();
  // The live document, so a deleted page leaves the view.
  const doc = useWorkspaceStore((s) => getActiveDocument(s.workspace));
  if (!doc) return null;
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: 800 }}>
      <ReadView doc={doc} />
      <Dock />
      <PageContextMenu />
    </div>
  );
}

const activeDoc = () =>
  getActiveDocument(useWorkspaceStore.getState().workspace) as VirtualDocument;

/** Opens the four-page fixture (in Read unless `edit`) and waits for page 2. */
async function mount(edit = false): Promise<{ container: HTMLElement; doc: VirtualDocument }> {
  const report = await useWorkspaceStore
    .getState()
    .openFiles([await fixtureFile(rotatedUrl, 'rotated.pdf')]);
  expect(report.skipped).toEqual([]);
  if (edit) enterEditMode();
  const doc = activeDoc();
  useUiStore.getState().setZoom(0.3);
  useViewStore.getState().setCurrentPage(0);
  const { container } = render(<Harness />);
  await waitFor(
    () => {
      if (!container.querySelector('[data-page-index="1"] canvas[data-state="rendered"]')) {
        throw new Error('page 2 not rendered');
      }
    },
    { timeout: 10_000 },
  );
  return { container, doc };
}

function pageElement(container: HTMLElement, index: number): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-page-index="${index}"]`);
  if (!element) throw new Error(`no page ${index + 1}`);
  return element;
}

/** A right-click in the middle of a page; returns whether the browser's menu was kept. */
function rightClick(target: Element): boolean {
  const box = target.getBoundingClientRect();
  return target.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    }),
  );
}

/** A synthetic pointer event of `pointerType` at the middle of `target`. */
function press(type: string, target: Element, pointerType = 'touch'): void {
  const box = target.getBoundingClientRect();
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 21,
      pointerType,
      isPrimary: true,
      button: 0,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    }),
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The open menu, once its items have risen in. A long press opens it only after its hold and a
 * loaded runner adds its own delay to that and to the entrance, so the wait is longer than
 * `waitFor`'s 1 s default.
 */
async function menu(): Promise<HTMLElement> {
  return waitFor(
    () => {
      const popup = screen.getByTestId('page-context-menu');
      if (popup.hasAttribute('data-closed')) throw new Error('still closing');
      expect(within(popup).getAllByRole('menuitem')[0]).toBeVisible();
      return popup;
    },
    { timeout: EXIT_TIMEOUT },
  );
}

/** Waits for the last menu to have gone (its exit transition), so the next one is new. */
const closed = () =>
  waitFor(() => expect(screen.queryByTestId('page-context-menu')).toBeNull(), {
    timeout: EXIT_TIMEOUT,
  });

describe('page context menu', () => {
  let disposeCommands: () => void = () => undefined;
  beforeAll(() => {
    disposeCommands = registerAppCommands();
  });
  afterAll(() => {
    disposeCommands();
  });
  beforeEach(async () => {
    await page.viewport(1280, 900);
    resetWorkspace();
    resetEditRunner();
    resetAnnotationStore();
    resetToolStore();
    useUiStore.setState({ docUi: {} });
    useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
  });
  afterEach(async () => {
    closeOperationDialog();
    await whenIdle();
    cleanup();
    resetToolStore();
    resetAnnotationStore();
    resetWorkspace();
  });

  it('in viewing offers the page operations (S8); locked, they are dimmed and change nothing', async () => {
    const { container, doc } = await mount();
    const kept = rightClick(pageElement(container, 1));
    expect(kept).toBe(false);
    const popup = await menu();
    expect(popup).toHaveAccessibleName('Page 2');
    const names = within(popup)
      .getAllByRole('menuitem')
      .map((item) => item.textContent?.trim());
    expect(names).toEqual([
      expect.stringMatching(/^Edit text here/),
      'Rotate page 2 left',
      'Rotate page 2 right',
      'Delete page 2',
      'Crop…',
      'Insert blank page after',
      'Insert pages from file…',
      'Extract page…',
      'Copy page',
      'Paste pages after',
      expect.stringMatching(/^Show in Pages grid/),
    ]);
    // `pages` acts need no Markup (ADR-0030): a rotation from viewing, one step.
    await userEvent.click(within(popup).getByRole('menuitem', { name: 'Rotate page 2 right' }));
    expect(activeDoc().pages[1]?.rotation).toBe(((doc.pages[1]?.rotation ?? 0) + 90) % 360);
    expect(isMarkupOpen(useUiStore.getState(), doc.id)).toBe(false);
    await closed();

    // Locked: the same rows, dimmed with nothing changed (Show in Pages grid stays).
    useLockStore.getState().lock(doc.id);
    const before = activeDoc().pages.map((p) => p.rotation);
    rightClick(pageElement(container, 1));
    const locked = await menu();
    for (const name of [
      'Edit text here',
      'Rotate page 2 left',
      'Delete page 2',
      'Crop…',
      'Insert blank page after',
      'Insert pages from file…',
      'Paste pages after',
    ]) {
      expect(
        within(locked).getByRole('menuitem', { name: new RegExp(`^${name}`) }),
      ).toHaveAttribute('aria-disabled', 'true');
    }
    // Extract and Copy change nothing: allowed while locked (04-context §10 item 6).
    for (const name of ['Extract page…', 'Copy page']) {
      expect(within(locked).getByRole('menuitem', { name })).not.toHaveAttribute('aria-disabled');
    }
    expect(
      within(locked).getByRole('menuitem', { name: /^Show in Pages grid/ }),
    ).not.toHaveAttribute('aria-disabled');
    await userEvent.click(within(locked).getByRole('menuitem', { name: 'Delete page 2' }), {
      force: true,
    });
    expect(activeDoc().pages.map((p) => p.rotation)).toEqual(before);
    expect(activeDoc().pages).toHaveLength(doc.pages.length);
    await userEvent.keyboard('{Escape}');
    await closed();
    resetLockStore();
  });

  it('in Edit names the clicked page and rotates that page', async () => {
    const { container, doc } = await mount(true);
    rightClick(pageElement(container, 1));
    const popup = await menu();
    expect(popup).toHaveAccessibleName('Page 2');
    const names = within(popup)
      .getAllByRole('menuitem')
      .map((item) => item.textContent?.trim());
    expect(names).toEqual([
      expect.stringMatching(/^Edit text here/),
      'Rotate page 2 left',
      'Rotate page 2 right',
      'Delete page 2',
      'Crop…',
      'Insert blank page after',
      'Insert pages from file…',
      'Extract page…',
      'Copy page',
      'Paste pages after',
      expect.stringMatching(/^Show in Pages grid/),
    ]);

    await userEvent.click(within(popup).getByRole('menuitem', { name: 'Rotate page 2 right' }));
    const before = doc.pages[1]?.rotation ?? 0;
    expect(activeDoc().pages[1]?.rotation).toBe((before + 90) % 360);
    expect(activeDoc().pages[0]?.rotation).toBe(doc.pages[0]?.rotation);
    // With Undo, as the grid's turns (§13 item 6; MOB-4).
    expect(useAnnouncer.getState().message).toMatch(/^Rotated page 2 right\. Undo with /);
    expect(useToastStore.getState().shown.map((t) => t.text)).toContain('Rotated page 2 right');
    await closed();

    rightClick(pageElement(container, 1));
    await userEvent.click(
      within(await menu()).getByRole('menuitem', { name: 'Rotate page 2 left' }),
    );
    expect(activeDoc().pages[1]?.rotation).toBe(before);
    expect(useAnnouncer.getState().message).toMatch(/^Rotated page 2 left\. Undo with /);
  });

  it('Delete, Crop… and Arrange act on the clicked page', async () => {
    const { container, doc } = await mount(true);
    const second = doc.pages[1]?.id;
    const third = doc.pages[2]?.id;
    if (second === undefined || third === undefined) throw new Error('pages missing');

    rightClick(pageElement(container, 1));
    await userEvent.click(within(await menu()).getByRole('menuitem', { name: 'Crop…' }));
    expect(useOperationDialogStore.getState().dialog).toMatchObject({
      kind: 'crop',
      documentId: doc.id,
      pageIds: [second],
    });
    closeOperationDialog();
    await closed();

    rightClick(pageElement(container, 1));
    await userEvent.click(within(await menu()).getByRole('menuitem', { name: 'Delete page 2' }));
    expect(activeDoc().pages.map((p) => p.id)).not.toContain(second);
    expect(activeDoc().pages).toHaveLength(3);
    expect(useAnnouncer.getState().message).toMatch(/^Deleted page 2\. Undo with /);

    // The old page 3 is page 2 now.
    await closed();
    rightClick(pageElement(container, 1));
    await userEvent.click(
      within(await menu()).getByRole('menuitem', { name: /^Show in Pages grid/ }),
    );
    await waitFor(() => {
      expect(stageView(useUiStore.getState())).toBe('grid');
    });
    // The grid opens at that page, its cell focused; the surface change clears the selection.
    expect(useSelectionStore.getState().focused).toBe(third);
  });

  it('§13 page rows: Insert blank, Insert pages from file…, Extract, Copy and Paste (MOB-4)', async () => {
    const { container, doc } = await mount();
    const [p1, p2] = doc.pages.map((p) => p.id);
    const steps = () => useWorkspaceStore.getState().history.past.length;
    const ids = () => activeDoc().pages.map((p) => p.id);
    const choose = async (name: string) => {
      rightClick(pageElement(container, 1));
      await userEvent.click(within(await menu()).getByRole('menuitem', { name }));
      await closed();
    };

    // Insert blank page after page 2: one step, at position 3.
    let before = steps();
    await choose('Insert blank page after');
    expect(ids()).toHaveLength(5);
    expect(ids().slice(0, 2)).toEqual([p1, p2]);
    expect(activeDoc().pages[2]?.ref.kind).toBe('blank');
    expect(steps()).toBe(before + 1);
    useWorkspaceStore.getState().undo();

    // Insert pages from file…: the picker (a stub here) asks, then all of the file's pages land
    // after page 2 as one step.
    const picked = await fixtureFile(simpleUrl, 'simple-text.pdf');
    const picker = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: () =>
        Promise.resolve([
          { kind: 'file', name: picked.name, getFile: () => Promise.resolve(picked) },
        ]),
    });
    try {
      before = steps();
      await choose('Insert pages from file…');
      await waitFor(() => expect(ids()).toHaveLength(7), { timeout: 10_000 });
      expect(ids().slice(0, 2)).toEqual([p1, p2]);
      expect(ids().slice(5)).toEqual(doc.pages.slice(2).map((p) => p.id));
      expect(steps()).toBe(before + 1);
      useWorkspaceStore.getState().undo();
      expect(ids()).toEqual(doc.pages.map((p) => p.id));
    } finally {
      if (picker) Object.defineProperty(window, 'showOpenFilePicker', picker);
      else delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    }

    // Extract page…: the Extract sheet with page 2.
    await choose('Extract page…');
    expect(useOperationDialogStore.getState().dialog).toEqual({ kind: 'extract', pageIds: [p2] });
    closeOperationDialog();

    // Copy page, then Paste pages after on page 2: a copy of page 2 at position 3.
    await choose('Copy page');
    before = steps();
    await choose('Paste pages after');
    expect(ids()).toHaveLength(5);
    expect(activeDoc().pages[2]?.ref).toEqual(activeDoc().pages[1]?.ref);
    expect(steps()).toBe(before + 1);
  });

  it('offers "Edit text here" in Edit, which arms Edit text', async () => {
    const { container } = await mount(true);
    rightClick(pageElement(container, 0));
    const popup = await menu();
    const items = within(popup).getAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('Edit text here');
    expect(items[1]).toHaveTextContent('Rotate page 1 left');
    await userEvent.click(within(popup).getByRole('menuitem', { name: /^Edit text here/ }));
    expect(useToolStore.getState().mode).toBe('edit-text');
  });

  it('opens on Shift+F10 in the viewport for the current page; Esc closes it and returns the focus', async () => {
    const { container } = await mount(true);
    const viewport = container.querySelector<HTMLElement>('[data-read-viewport]');
    if (!viewport) throw new Error('no viewport');
    viewport.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    const popup = await menu();
    const n = useViewStore.getState().currentPage + 1;
    expect(popup).toHaveAccessibleName(`Page ${n}`);
    expect(within(popup).getByRole('menuitem', { name: `Delete page ${n}` })).toBeVisible();
    await waitFor(() => expect(popup).toContainElement(document.activeElement as HTMLElement));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(viewport).toHaveFocus();
  });

  it('keeps the browser menu on selected text', async () => {
    const { container } = await mount();
    const span = await waitFor(() => {
      const found = [
        ...container.querySelectorAll<HTMLElement>(
          '[data-page-index="0"] [data-testid="text-layer"] span',
        ),
      ].find((s) => (s.textContent ?? '').trim().length > 3);
      if (!found) throw new Error('no text yet');
      return found;
    });
    const range = document.createRange();
    range.selectNodeContents(span);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    expect(rightClick(span)).toBe(true);
    expect(screen.queryByTestId('page-context-menu')).toBeNull();
    window.getSelection()?.removeAllRanges();
  });

  it('opens the page menu on blank paper while other text on the page stays selected', async () => {
    const { container } = await mount();
    const span = await waitFor(() => {
      const found = [
        ...container.querySelectorAll<HTMLElement>(
          '[data-page-index="0"] [data-testid="text-layer"] span',
        ),
      ].find((s) => (s.textContent ?? '').trim().length > 3);
      if (!found) throw new Error('no text yet');
      return found;
    });
    const range = document.createRange();
    range.selectNodeContents(span);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const page = pageElement(container, 0);
    const box = span.getBoundingClientRect();
    // The page's corner, well away from the selected run (Firefox keeps a double-click's
    // selection, and `containsNode` alone counts the whole page as touched by it).
    const kept = page.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: Math.max(box.left - 60, 1),
        clientY: box.bottom + 80,
      }),
    );
    expect(kept).toBe(false);
    await menu();
    window.getSelection()?.removeAllRanges();
  });

  it('opens on a long press on the paper (touch) at the press point, once', async () => {
    const { container } = await mount();
    const canvas = pageElement(container, 1).querySelector('canvas');
    if (!canvas) throw new Error('no canvas');
    press('pointerdown', canvas);
    await sleep(300);
    expect(screen.queryByTestId('page-context-menu')).toBeNull();
    const popup = await menu();
    expect(popup).toHaveAccessibleName('Page 2');
    // Android's own contextmenu from the same touch is swallowed: no second opening.
    expect(rightClick(canvas)).toBe(false);
    press('pointerup', canvas);
    expect(screen.getAllByTestId('page-context-menu')).toHaveLength(1);
    expect(popup).toHaveAccessibleName('Page 2');
    await userEvent.keyboard('{Escape}');
    await closed();
  });

  it('leaves a long press on a text run to native selection, and a mouse to right-click', async () => {
    const { container } = await mount();
    const span = await waitFor(() => {
      const found = container.querySelector(
        '[data-page-index="0"] [data-testid="text-layer"] > span',
      );
      if (!found) throw new Error('no text yet');
      return found;
    });
    press('pointerdown', span);
    await sleep(600);
    press('pointerup', span);
    expect(screen.queryByTestId('page-context-menu')).toBeNull();
    const canvas = pageElement(container, 0).querySelector('canvas');
    if (!canvas) throw new Error('no canvas');
    press('pointerdown', canvas, 'mouse');
    await sleep(600);
    press('pointerup', canvas, 'mouse');
    expect(screen.queryByTestId('page-context-menu')).toBeNull();
  });

  it('never long-presses for a pen on a drawing tool’s layer', async () => {
    const { container } = await mount(true);
    useToolStore.getState().setMode('ink');
    const layer = await waitFor(() => {
      const found = pageElement(container, 1).querySelector('[data-drawing]');
      if (!found) throw new Error('no drawing layer');
      return found;
    });
    press('pointerdown', layer, 'pen');
    await sleep(600);
    expect(screen.queryByTestId('page-context-menu')).toBeNull();
    press('pointercancel', layer, 'pen');
  });
});
