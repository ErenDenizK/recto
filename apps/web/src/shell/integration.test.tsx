/**
 * End-to-end inside the browser: a real PDF goes through the PDFium adapter (in its worker),
 * lands in the document model, and renders as thumbnails and pages.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import fixtureUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { App } from '../app';
import { openDocuments } from '../commands/app-commands';
import { useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';

async function fixtureFile(): Promise<File> {
  const bytes = await (await fetch(fixtureUrl)).arrayBuffer();
  return new File([bytes], 'simple-text.pdf', { type: 'application/pdf' });
}

describe('engine integration', () => {
  beforeEach(async () => {
    // Desktop layout: both side panels plus a stage.
    await page.viewport(1280, 800);
    resetWorkspace();
    useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
    useUiStore.setState({ docUi: {}, fitMode: 'width', paletteOpen: false });
  });
  afterEach(() => {
    resetWorkspace();
  });

  it('opens a PDF, renders thumbnails and pages, and reports the page count', async () => {
    // The sidebar is closed by default (06-navigation N1): this test opens it on Pages.
    useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'pages', pagesView: 'thumbnails' });
    render(<App />);
    await openDocuments([await fixtureFile()]);

    expect(await screen.findByRole('tab', { name: 'simple-text', selected: true })).toBeVisible();
    await waitFor(
      () => {
        expect(
          document.querySelector('[role="listbox"] canvas[data-state="rendered"]'),
        ).not.toBeNull();
        expect(document.querySelector('main canvas[data-state="rendered"]')).not.toBeNull();
      },
      { timeout: 20_000 },
    );
    const thumbnail = document.querySelector<HTMLCanvasElement>('canvas[data-state="rendered"]');
    expect(thumbnail?.width).toBeGreaterThan(0);
    // The page pill (01-frame F11) has the page and the total the status bar showed.
    expect(screen.getByTestId('page-pill').textContent).toMatch(/^1 \/ 3 · /);
    expect(screen.getAllByRole('option')).toHaveLength(3);

    useUiStore.getState().showSurface('grid');
    await waitFor(() => {
      expect(screen.getAllByRole('gridcell')).toHaveLength(3);
    });
    // The grid has no page pill; its header counts the pages (D2-5).
    expect(screen.queryByTestId('page-pill')).toBeNull();
  }, 30_000);

  it('rotates the selection with Shift+R and undoes it with Mod+Z', async () => {
    render(<App />);
    await openDocuments([await fixtureFile()]);
    useUiStore.getState().showSurface('grid');
    const cells = await screen.findAllByRole('gridcell');
    await userEvent.click(cells[1]!);
    expect(cells[1]).toHaveAttribute('aria-selected', 'true');

    // Shift+R rotates; R alone is the Rectangle (key map v2, flows §7.2).
    await userEvent.keyboard('{Shift>}R{/Shift}');
    await waitFor(() => {
      expect(screen.getAllByRole('gridcell')[1]).toHaveAccessibleName(/rotated 90 degrees/);
    });
    expect(useWorkspaceStore.getState().history.present.label).toBe('Rotate 1 page');

    const mod = navigator.platform.toLowerCase().includes('mac') ? 'Meta' : 'Control';
    await userEvent.keyboard(`{${mod}>}z{/${mod}}`);
    await waitFor(() => {
      expect(screen.getAllByRole('gridcell')[1]).not.toHaveAccessibleName(/rotated/);
    });
  }, 30_000);

  it('S10: a navigating click in the navigator never selects, so Delete changes nothing', async () => {
    useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'pages', pagesView: 'thumbnails' });
    render(<App />);
    await openDocuments([await fixtureFile()]);
    const list = await screen.findByRole('listbox', { name: /^Pages of simple-text/ });
    await waitFor(() => {
      expect(within(list).getAllByRole('option')).toHaveLength(3);
    });
    const before = useWorkspaceStore.getState().workspace;

    // A click navigates (page 2 becomes current) and selects nothing.
    await userEvent.click(within(list).getByRole('option', { name: 'Page 2' }));
    await waitFor(() => {
      expect(screen.getByTestId('page-pill').textContent).toMatch(/^2 \/ 3 · /);
    });
    expect(within(list).getByRole('option', { name: 'Page 2' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(useSelectionStore.getState().selected.size).toBe(0);
    await userEvent.keyboard('{Delete}');
    await userEvent.keyboard('{Backspace}');
    // Arrow keys navigate too, and select nothing.
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Delete}');
    expect(useWorkspaceStore.getState().workspace).toBe(before);
    expect(within(list).getAllByRole('option')).toHaveLength(3);

    // An explicit selection (Mod-click) is visible, and Delete acts on it.
    const mod = navigator.platform.toLowerCase().includes('mac') ? 'Meta' : 'Control';
    await userEvent.keyboard(`{${mod}>}`);
    await userEvent.click(within(list).getByRole('option', { name: 'Page 2' }));
    await userEvent.keyboard(`{/${mod}}`);
    expect(within(list).getByRole('option', { name: 'Page 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{Delete}');
    await waitFor(() => {
      expect(within(list).getAllByRole('option')).toHaveLength(2);
    });
  }, 30_000);

  it('Delete leaves a selection the closed navigator does not show', async () => {
    useUiStore.setState({ leftPanelOpen: true, leftPanelView: 'pages', pagesView: 'thumbnails' });
    render(<App />);
    await openDocuments([await fixtureFile()]);
    const list = await screen.findByRole('listbox', { name: /^Pages of simple-text/ });
    const mod = navigator.platform.toLowerCase().includes('mac') ? 'Meta' : 'Control';
    await userEvent.keyboard(`{${mod}>}`);
    await userEvent.click(within(list).getByRole('option', { name: 'Page 3' }));
    await userEvent.keyboard(`{/${mod}}`);
    expect(useSelectionStore.getState().selected.size).toBe(1);

    useUiStore.setState({ leftPanelOpen: false });
    await waitFor(() => {
      expect(screen.queryByRole('listbox', { name: /^Pages of simple-text/ })).toBeNull();
    });
    const before = useWorkspaceStore.getState().workspace;
    await userEvent.keyboard('{Delete}');
    expect(useWorkspaceStore.getState().workspace).toBe(before);
  }, 30_000);
});
