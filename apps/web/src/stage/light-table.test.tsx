/**
 * The light table with real PDFs (Vitest browser mode, Chromium): two documents shown as
 * sections, pages moved across them with the keyboard (cut / paste, Alt+Shift+Arrow) and
 * with a real native drag and drop (Playwright drives the drag).
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import rotatedUrl from '../../../../test/fixtures/rotated-pages.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { App } from '../app';
import { openDocuments } from '../commands/app-commands';
import { useAnnouncer } from '../shell/announcer';
import { useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { cellRenderStats } from './PageCell';

async function fixture(url: string, name: string): Promise<File> {
  const bytes = await (await fetch(url)).arrayBuffer();
  return new File([bytes], name, { type: 'application/pdf' });
}

const mod = navigator.platform.toLowerCase().includes('mac') ? 'Meta' : 'Control';

async function openTwo() {
  render(<App />);
  await openDocuments([
    await fixture(simpleUrl, 'simple-text.pdf'),
    await fixture(rotatedUrl, 'rotated-pages.pdf'),
  ]);
  const ws = useWorkspaceStore.getState().workspace;
  const [simple, rotated] = ws.documentOrder;
  useUiStore.getState().setGridScope('all');
  useUiStore.getState().showSurface('grid');
  const grids = await screen.findAllByRole('grid');
  expect(grids).toHaveLength(2);
  return { simple: simple!, rotated: rotated! };
}

function grid(name: string): HTMLElement {
  return screen.getByRole('grid', { name });
}

describe('light table', () => {
  beforeEach(async () => {
    await page.viewport(1440, 900);
    resetWorkspace();
    useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
    useSelectionStore.getState().setSelecting(false);
    useSelectionStore.getState().setClipboard(null);
    useUiStore.setState({
      docUi: {},
      gridScope: 'all',
      arrangeCollapsed: [],
      paletteOpen: false,
      arrangeSize: 1,
    });
  });
  afterEach(() => {
    resetWorkspace();
  });

  it('shows one section per shown document with grid semantics', async () => {
    await openTwo();
    const simple = grid('simple-text');
    expect(simple).toHaveAttribute('aria-rowcount', '1');
    expect(Number(simple.getAttribute('aria-colcount'))).toBeGreaterThanOrEqual(3);
    const cells = within(simple).getAllByRole('gridcell');
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveAccessibleName('Page 1 of 3, from simple-text.pdf');
    expect(within(grid('rotated-pages')).getAllByRole('gridcell')[1]).toHaveAccessibleName(
      /^Page 2 of 4, from rotated-pages\.pdf, rotated 90 degrees$/,
    );
  }, 30_000);

  it('moves a page across documents with the keyboard: cut, arrow into the other section, paste', async () => {
    await openTwo();
    const first = within(grid('simple-text')).getAllByRole('gridcell')[0]!;
    await userEvent.click(first, { modifiers: ['ControlOrMeta'] });
    await userEvent.keyboard(`{${mod}>}x{/${mod}}`);
    expect(useSelectionStore.getState().clipboard?.mode).toBe('cut');
    // One row per section at this width: ArrowDown crosses into the next section.
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(document.activeElement).toHaveAccessibleName(/^Page 1 of 4, from rotated-pages/);
    });
    await userEvent.keyboard(`{${mod}>}v{/${mod}}`);

    await waitFor(() => {
      expect(within(grid('rotated-pages')).getAllByRole('gridcell')).toHaveLength(5);
    });
    expect(within(grid('simple-text')).getAllByRole('gridcell')).toHaveLength(2);
    expect(within(grid('rotated-pages')).getAllByRole('gridcell')[1]).toHaveAccessibleName(
      'Page 2 of 5, from simple-text.pdf',
    );
    expect(useWorkspaceStore.getState().history.present.label).toBe('Move 1 page to rotated-pages');
    expect(useAnnouncer.getState().message).toBe('Moved 1 page to position 2 in rotated-pages');

    // Alt+Shift+Down: to the end of the section; consecutive keyboard moves coalesce.
    const past = useWorkspaceStore.getState().history.past.length;
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}');
    await waitFor(() => {
      expect(within(grid('rotated-pages')).getAllByRole('gridcell')[4]).toHaveAccessibleName(
        'Page 5 of 5, from simple-text.pdf',
      );
    });
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    await waitFor(() => {
      expect(within(grid('rotated-pages')).getAllByRole('gridcell')[3]).toHaveAccessibleName(
        'Page 4 of 5, from simple-text.pdf',
      );
    });
    expect(useWorkspaceStore.getState().history.past.length).toBe(past + 1);

    await userEvent.keyboard(`{${mod}>}z{/${mod}}`);
    await waitFor(() => {
      expect(within(grid('rotated-pages')).getAllByRole('gridcell')[1]).toHaveAccessibleName(
        'Page 2 of 5, from simple-text.pdf',
      );
    });
  }, 30_000);

  it('moves a page across documents with a native drag and drop, re-rendering only affected cells', async () => {
    const { rotated } = await openTwo();
    const source = within(grid('simple-text')).getAllByRole('gridcell')[2]!;
    const target = within(grid('rotated-pages')).getAllByRole('gridcell')[1]!;
    const before = cellRenderStats.renders;
    const beforeRotated = [...within(grid('rotated-pages')).getAllByRole('gridcell')].map(
      (cell) => cellRenderStats.byPage.get(cell.dataset.pageId ?? '') ?? 0,
    );

    // Dropping on the centre of a cell lands in the gutter after it (nearest gap).
    await userEvent.dragAndDrop(source, target);

    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspace.documents[rotated]?.pages).toHaveLength(5);
    });
    expect(useWorkspaceStore.getState().history.present.label).toBe('Move 1 page to rotated-pages');
    const cells = within(grid('rotated-pages')).getAllByRole('gridcell');
    expect(cells[2]).toHaveAccessibleName('Page 3 of 5, from simple-text.pdf');
    expect(screen.queryByTestId('insertion-bar')).toBeNull();

    // Profiler check: the drop re-rendered the two touched sections' cells (their "of N"
    // labels changed), never all cells repeatedly. 3 + 4 cells before the drop.
    const renders = cellRenderStats.renders - before;
    expect(renders).toBeGreaterThan(0);
    expect(renders).toBeLessThanOrEqual(3 * 7);
    const after = beforeRotated.map((n, i) => {
      const id = cells[i < 2 ? i : i + 1]?.dataset.pageId ?? '';
      return (cellRenderStats.byPage.get(id) ?? 0) - n;
    });
    for (const delta of after) expect(delta).toBeLessThanOrEqual(3);
  }, 30_000);

  it('opens a page with a click; in selection mode a click toggles (the Photos model)', async () => {
    await openTwo();
    const bar = await screen.findByRole('toolbar', { name: 'Selected pages' });
    // At rest the bar offers Select, and no page acts (PG4 §6, owner feedback F4).
    expect(within(bar).getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Delete' })).toBeNull();
    // Select: nothing selected yet, every click toggles.
    await userEvent.click(within(bar).getByRole('button', { name: 'Select' }));
    await waitFor(() => {
      expect(within(bar).getByText('Select pages')).toBeInTheDocument();
    });
    const cells = within(grid('simple-text')).getAllByRole('gridcell');
    await userEvent.click(cells[0]!);
    await userEvent.click(cells[2]!);
    await waitFor(() => {
      expect(within(bar).getByText('2 selected')).toBeInTheDocument();
    });
    await userEvent.click(cells[0]!);
    await userEvent.click(cells[2]!);
    // Deselecting the last page keeps Select on, as Photos' Select does.
    await waitFor(() => {
      expect(within(bar).getByText('Select pages')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    // Done ends selection mode and stays in the grid; then a click opens the page.
    await userEvent.click(within(bar).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(within(bar).getByRole('button', { name: 'Select' })).toBeInTheDocument();
    });
    expect(useSelectionStore.getState().selecting).toBe(false);
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    const second = cells[1]!.dataset.pageId;
    await userEvent.click(cells[1]!);
    await waitFor(() => {
      expect(screen.queryAllByRole('grid')).toHaveLength(0);
    });
    expect(useSelectionStore.getState().selected.size).toBe(0);
    expect(
      document.querySelector(`[data-read-viewport] [data-page-id="${second ?? ''}"]`),
    ).not.toBeNull();
  }, 30_000);

  it('Mod-click starts selection mode; deselecting the last page ends it', async () => {
    await openTwo();
    const bar = await screen.findByRole('toolbar', { name: 'Selected pages' });
    const cells = within(grid('simple-text')).getAllByRole('gridcell');
    await userEvent.click(cells[1]!, { modifiers: ['ControlOrMeta'] });
    await waitFor(() => {
      expect(within(bar).getByText('1 selected')).toBeInTheDocument();
    });
    expect(screen.getByTestId('light-table').querySelector('[data-selecting]')).not.toBeNull();
    // In the mode a plain click toggles.
    await userEvent.click(cells[2]!);
    await waitFor(() => {
      expect(within(bar).getByText('2 selected')).toBeInTheDocument();
    });
    await userEvent.click(cells[2]!);
    await userEvent.click(cells[1]!);
    await waitFor(() => {
      expect(within(bar).getByRole('button', { name: 'Select' })).toBeInTheDocument();
    });
    expect(screen.getByTestId('light-table').querySelector('[data-selecting]')).toBeNull();
    expect(screen.getAllByRole('grid')).toHaveLength(2);
  }, 30_000);

  it('acts on a selection from the Pages bar; Esc ends selection mode, then leaves the grid', async () => {
    await openTwo();
    // The capsule holds the Pages bar in the grid (X21): at rest, Done, the count and Select.
    const bar = await screen.findByRole('toolbar', { name: 'Selected pages' });
    expect(within(bar).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    await userEvent.click(within(bar).getByRole('button', { name: 'Select' }));
    const cell = within(grid('rotated-pages')).getAllByRole('gridcell')[0]!;
    await userEvent.click(cell);
    await waitFor(() => {
      expect(within(bar).getByText('1 selected')).toBeInTheDocument();
    });
    await userEvent.click(within(bar).getByRole('button', { name: 'Rotate right' }));
    await waitFor(() => {
      expect(within(grid('rotated-pages')).getAllByRole('gridcell')[0]).toHaveAccessibleName(
        /rotated 90 degrees/,
      );
    });
    // The Esc ladder (flows §7.2): the selection and its mode first, then the grid itself.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(useSelectionStore.getState().selected.size).toBe(0);
    });
    expect(useSelectionStore.getState().selecting).toBe(false);
    expect(within(bar).getByRole('button', { name: 'Select' })).toBeInTheDocument();
    expect(screen.getAllByRole('grid')).toHaveLength(2);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryAllByRole('grid')).toHaveLength(0);
    });
  }, 30_000);

  it('shows the active document alone in This document, with no section header', async () => {
    await openTwo();
    useUiStore.getState().setGridScope('document');
    await waitFor(() => {
      expect(screen.getAllByRole('grid')).toHaveLength(1);
    });
    const active = useWorkspaceStore.getState().workspace.activeDocument;
    const title =
      (active ? useWorkspaceStore.getState().workspace.documents[active]?.title : '') ?? '';
    expect(screen.getByRole('grid', { name: title })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 2, name: title })).toBeNull();
    // The scope switch says which is chosen; All open counts the documents.
    expect(screen.getByRole('radio', { name: 'This document' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^All open/ })).not.toBeChecked();
  }, 30_000);

  it('inserts OS files dropped on a section at the gap, as one undo step', async () => {
    const { rotated } = await openTwo();
    const file = await fixture(simpleUrl, 'dropped.pdf');
    const target = within(grid('rotated-pages')).getAllByRole('gridcell')[0]!;
    const box = target.getBoundingClientRect();
    const transfer = new DataTransfer();
    transfer.items.add(file);
    // Right part of the first cell: the gap after it (index 1).
    const at = { clientX: box.right - 10, clientY: box.top + 30 };
    const fire = (type: string) =>
      target.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer, ...at }),
      );
    const past = useWorkspaceStore.getState().history.past.length;
    fire('dragenter');
    fire('dragover');
    await waitFor(() => {
      expect(screen.getByTestId('insertion-bar')).toHaveAttribute('data-index', '1');
    });
    fire('dragover');
    fire('drop');

    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspace.documents[rotated]?.pages).toHaveLength(7);
    });
    // The dropped file does not stay open as its own tab.
    expect(useWorkspaceStore.getState().workspace.documentOrder).toHaveLength(2);
    expect(within(grid('rotated-pages')).getAllByRole('gridcell')[1]).toHaveAccessibleName(
      'Page 2 of 7, from dropped.pdf',
    );
    expect(useWorkspaceStore.getState().history.present.label).toBe(
      'Insert 3 pages from dropped.pdf',
    );
    // Opening the file and inserting its pages is a single undo step.
    expect(useWorkspaceStore.getState().history.past.length).toBe(past + 1);
    await userEvent.keyboard(`{${mod}>}z{/${mod}}`);
    await waitFor(() => {
      expect(useWorkspaceStore.getState().workspace.documents[rotated]?.pages).toHaveLength(4);
    });
    expect(useWorkspaceStore.getState().workspace.documentOrder).toHaveLength(2);
  }, 30_000);
});
