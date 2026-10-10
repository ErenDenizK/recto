/**
 * The sidebar (`components/06-navigation.md` N1–N5; redesign spec D2-4) in browser mode: the
 * section switch as APG tabs with counts in the names, the Pages section's one layer (Contents
 * a collapsible group above the thumbnails, DSN-26), the thumbnail listbox keys (S10: navigating never selects), Alt+arrows
 * moving a page by one, the menu from Shift+F10, Find's own field only below 1280 px, and the
 * forms (floating, overlay, nothing on the Library).
 */
import type { PageId } from '@pdf-editor/document-model';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { settled } from '../../../test/settled';
import outlineUrl from '../../../../../test/fixtures/outline-named-dests.pdf?url';
import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { resetAnnotationStore } from '../../annotations/annotation-store';
import { resetEditRunner, whenIdle } from '../../annotations/edit-runner';
import { resetFormStore } from '../../forms/form-store';
import { useSelectionStore } from '../../state/selection-store';
import { DEFAULT_LAYOUT, LAYOUT_STORAGE_KEY, useUiStore } from '../../state/ui-store';
import { useViewStore } from '../../state/view-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { clearSearch, setSearchQuery } from '../../viewer/search';
import { resetFrameStore, showOverlaySidebar } from '../frame/frame-store';
import { Sidebar } from './Sidebar';

const open = async (url: string, name: string) => {
  const report = await useWorkspaceStore.getState().openFiles([await fixtureFile(url, name)]);
  expect(report.skipped).toEqual([]);
};

const switcher = () => screen.getByRole('tablist', { name: 'Sidebar sections' });
const option = (name: string) =>
  within(screen.getByRole('listbox', { name: /^Pages of/ })).getByRole('option', { name });
/** The active document's page ids, in order. */
function order(): PageId[] {
  const ws = useWorkspaceStore.getState().workspace;
  const doc = ws.activeDocument === undefined ? undefined : ws.documents[ws.activeDocument];
  return doc?.pages.map((p) => p.id) ?? [];
}

beforeEach(async () => {
  await page.viewport(1440, 900);
  resetWorkspace();
  resetEditRunner();
  resetAnnotationStore();
  resetFormStore();
  resetFrameStore();
  clearSearch();
  useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
  useViewStore.setState({ currentPage: 0 });
  useUiStore.setState({
    ...DEFAULT_LAYOUT,
    leftPanelOpen: true,
    docUi: {},
    destination: 'document',
  });
});
afterEach(async () => {
  cleanup();
  await whenIdle();
  resetWorkspace();
  useUiStore.setState({ ...DEFAULT_LAYOUT, docUi: {} });
  localStorage.removeItem(LAYOUT_STORAGE_KEY);
});

describe('N1 shell and switch', () => {
  it('is closed by default and shows only in a document', async () => {
    useUiStore.setState({ ...DEFAULT_LAYOUT });
    expect(DEFAULT_LAYOUT.leftPanelOpen).toBe(false);
    await open(simpleUrl, 'simple-text.pdf');
    render(<Sidebar />);
    expect(screen.queryByRole('navigation', { name: 'Sidebar' })).toBeNull();
    act(() => useUiStore.setState({ leftPanelOpen: true }));
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();
    act(() => useUiStore.getState().showHome());
    expect(screen.queryByRole('navigation', { name: 'Sidebar' })).toBeNull();
  });

  it('has three sections as tabs; counts are in the names; arrows show the next', async () => {
    await open(simpleUrl, 'simple-text.pdf');
    render(<Sidebar />);
    const tabs = within(switcher()).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Pages', 'Find', 'Review']);
    tabs[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(useUiStore.getState().leftPanelView).toBe('find');
    expect(await screen.findByTestId('find-section')).toBeVisible();
    act(() => setSearchQuery('the'));
    await expect
      .poll(() => within(switcher()).getAllByRole('tab')[1]?.getAttribute('aria-label'), {
        timeout: 10_000,
      })
      .toMatch(/^Find, \d+ matches$/);
  });

  it('keeps one row of tabs: Contents is a collapsible group above the thumbnails (DSN-26)', async () => {
    await open(outlineUrl, 'outline-named-dests.pdf');
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Sidebar' });
    // One tab list and no second row of views.
    expect(within(nav).getAllByRole('tablist')).toHaveLength(1);
    expect(within(nav).queryByRole('radiogroup')).toBeNull();
    // Collapsed by default: the thumbnails show, the tree does not.
    const contents = within(nav).getByRole('button', { name: 'Contents' });
    expect(contents).toHaveAttribute('aria-expanded', 'false');
    expect(within(nav).getByRole('listbox', { name: /^Pages of/ })).toBeVisible();
    expect(within(nav).queryByRole('tree')).toBeNull();
    // Add bookmark is a small icon button in the group's header, not a full-width button.
    const add = within(nav).getByRole('button', { name: 'Add bookmark' });
    expect(add.textContent).toBe('');
    // Expanded: the tree joins the thumbnails, and the choice is remembered.
    await userEvent.click(contents);
    expect(contents).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('tree', { name: /^Contents of/ })).toBeVisible();
    expect(within(nav).getByRole('listbox', { name: /^Pages of/ })).toBeVisible();
    expect(useUiStore.getState().pagesView).toBe('bookmarks');
    await userEvent.click(contents);
    expect(within(nav).queryByRole('tree')).toBeNull();
    expect(useUiStore.getState().pagesView).toBe('thumbnails');
  });

  it('floats from expanded up: stored, resizable, and not light-dismissed', async () => {
    await open(simpleUrl, 'simple-text.pdf');
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: 'Sidebar' });
    expect(nav).toHaveAttribute('data-form', 'floating');
    expect(nav).not.toHaveAttribute('data-overlay');
    expect(within(nav).getByRole('separator')).toBeVisible();
    // A press outside does not put it away (only the laid-over forms are light-dismissed).
    await userEvent.click(document.body);
    expect(screen.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();
  });

  it('lays over the page on medium only once asked for, 320 px wide', async () => {
    await open(simpleUrl, 'simple-text.pdf');
    render(<Sidebar form="overlay" />);
    expect(screen.queryByRole('navigation', { name: 'Sidebar' })).toBeNull();
    act(() => showOverlaySidebar(true));
    const nav = screen.getByRole('navigation', { name: 'Sidebar' });
    expect(nav.getBoundingClientRect().width).toBeCloseTo(320, 0);
    expect(nav).toHaveAttribute('data-form', 'overlay');
    // No splitter on the overlay (06.18: fixed).
    expect(within(nav).queryByRole('separator')).toBeNull();
  });
});

describe('N2 thumbnail listbox', () => {
  it('navigates without selecting (S10); Shift and Space select; Esc clears', async () => {
    await open(outlineUrl, 'outline-named-dests.pdf');
    render(<Sidebar />);
    await userEvent.click(option('Page 3'));
    expect(useSelectionStore.getState().selected.size).toBe(0);
    expect(option('Page 3')).toHaveFocus();
    expect(useViewStore.getState().scrollRequest?.pageId).toBe(order()[2]);
    await userEvent.keyboard('{ArrowDown}');
    expect(option('Page 4')).toHaveFocus();
    expect(useSelectionStore.getState().selected.size).toBe(0);
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect([...useSelectionStore.getState().selected]).toEqual(order().slice(3, 5));
    expect(option('Page 5')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard(' ');
    expect([...useSelectionStore.getState().selected]).toEqual([order()[3]]);
    await userEvent.keyboard('{Escape}');
    expect(useSelectionStore.getState().selected.size).toBe(0);
    // The list says where it is: position and size.
    expect(option('Page 4')).toHaveAttribute('aria-posinset', '4');
    expect(option('Page 4')).toHaveAttribute('aria-setsize', '6');
  });

  it('moves the focused page by one with Alt+Up and Alt+Down, without selecting it', async () => {
    await open(outlineUrl, 'outline-named-dests.pdf');
    render(<Sidebar />);
    const before = order();
    await userEvent.click(option('Page 5'));
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(order()).toEqual([before[0], before[1], before[2], before[4], before[3], before[5]]);
    await userEvent.keyboard('{Alt>}{ArrowDown}{ArrowDown}{/Alt}');
    expect(order()).toEqual([before[0], before[1], before[2], before[3], before[5], before[4]]);
    expect(useSelectionStore.getState().selected.size).toBe(0);
  });

  it('opens the thumbnail menu from Shift+F10, for the page or the selection', async () => {
    await open(outlineUrl, 'outline-named-dests.pdf');
    render(<Sidebar />);
    await userEvent.click(option('Page 2'));
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    // The menu fades in: ask once its entrance has run.
    const menu = await settled(await screen.findByTestId('thumbnail-menu'));
    expect(within(menu).getByRole('menuitem', { name: 'Delete page 2' })).toBeVisible();
    expect(within(menu).getByRole('menuitem', { name: 'Show in Pages grid' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    expect(
      within(await settled(await screen.findByTestId('thumbnail-menu'))).getByRole('menuitem', {
        name: 'Delete 2 pages',
      }),
    ).toBeVisible();
  });
});

describe('N4 Find: one field from 1280 px (06.20)', () => {
  it('hides its own field at 1440 and shows it at 1000', async () => {
    await open(simpleUrl, 'simple-text.pdf');
    useUiStore.setState({ leftPanelView: 'find' });
    render(<Sidebar />);
    const section = await screen.findByTestId('find-section');
    // The size class follows the viewport a frame after beforeEach's resize, which can lag under load.
    await expect
      .poll(() => within(section).queryByRole('searchbox', { name: 'Find in document' }))
      .toBeNull();
    await page.viewport(1000, 800);
    await expect
      .poll(() => within(section).queryByRole('searchbox', { name: 'Find in document' }))
      .not.toBeNull();
  });
});
