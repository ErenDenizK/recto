/**
 * The compact Home's composition (EDN-29, DSN-93; ADR-0033 §2.3): the header with the mark and the
 * gear, the first visit's Margin cover with "Try the sample" as a lime link, Continue for the
 * document open and read last with its one lime and the dock's Open as a ghost beside it, Recent
 * as a shelf of covers with Remove on a row menu, and Open in the dock capsule; every target at
 * least 44 px (A-15); no language switch on the page (DSN-46).
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { settled } from '../../../test/settled';
import { fixtureFile } from '../../../test/store-harness';
import { type RecentEntry, useRecentsStore } from '../../files/recents';
import { resetResumeStore, setResume } from '../../session/resume';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { CompactLibrary } from './CompactLibrary';
import { openPdf } from './compact-actions';
import { resetCompactStore } from './compact-store';

function height(element: HTMLElement): number {
  return element.getBoundingClientRect().height;
}

const entry = (id: string, name: string, extra: Partial<RecentEntry> = {}): RecentEntry => ({
  id,
  name,
  size: 2048,
  openedAt: Date.now(),
  pages: 3,
  ...extra,
});

describe('CompactLibrary', () => {
  beforeEach(() => {
    // The compact root's capsule metrics (CompactApp.module.css), which the dock reads.
    document.documentElement.style.setProperty('--capsule-h', '60px');
    document.documentElement.style.setProperty('--capsule-slot', '48px');
    resetCompactStore();
    resetResumeStore();
    resetWorkspace();
    useRecentsStore.setState({ loaded: true, entries: [] });
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--capsule-h');
    document.documentElement.style.removeProperty('--capsule-slot');
    useRecentsStore.setState({ loaded: true, entries: [] });
  });

  it('heads itself with the mark and the wordmark, and the gear opens Settings', async () => {
    render(<CompactLibrary />);
    expect(screen.getByRole('heading', { level: 1, name: 'Recto' })).toBeVisible();
    const more = screen.getByRole('button', { name: 'Settings' });
    expect(more.querySelector('[data-icon="gear-six"]')).not.toBeNull();
    expect(more).toHaveAttribute('aria-haspopup', 'dialog');
    expect(height(more)).toBeGreaterThanOrEqual(44);
    expect(more.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
    // The gear's glyph is 24 px (DSN-95).
    expect(more.querySelector('svg')?.getBoundingClientRect().width).toBe(24);
    await userEvent.click(more);
    const sheet = await screen.findByTestId('compact-settings-sheet', {}, { timeout: 10_000 });
    await waitFor(() => expect(sheet).toBeVisible());
    expect(within(sheet).getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    for (const name of ['Reduce motion', 'Language']) {
      expect(within(sheet).getByRole('radiogroup', { name })).toBeInTheDocument();
    }
    // About is a page within the sheet; ‹ goes back to Settings.
    await userEvent.click(within(sheet).getByRole('button', { name: /^About Recto/ }));
    await waitFor(() =>
      expect(within(sheet).getByRole('heading', { name: 'About Recto' })).toBeInTheDocument(),
    );
    expect(within(sheet).getByTestId('compact-about-version')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Settings' }));
    await waitFor(() =>
      expect(within(sheet).getByRole('radiogroup', { name: 'Reduce motion' })).toBeInTheDocument(),
    );
    act(() => {
      resetCompactStore();
    });
  });

  it('has no tool chips, no promise line and no language switch', () => {
    render(<CompactLibrary />);
    expect(screen.queryByTestId('compact-tools')).toBeNull();
    expect(screen.queryByText(/Nothing leaves this phone/)).toBeNull();
    for (const name of ['English', 'Türkçe']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('on the first visit shows the Margin cover, its name and the sample as a lime link', async () => {
    render(<CompactLibrary />);
    await waitFor(() => {
      expect(screen.getByTestId('compact-library')).toHaveAttribute('data-first-run');
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Margin, No. 07' })).toBeVisible();
    const sample = screen.getByRole('button', { name: 'Try the sample' });
    expect(sample).toHaveAttribute('data-testid', 'compact-sample');
    expect(height(sample)).toBeGreaterThanOrEqual(44);
    const lime = getComputedStyle(sample).color;
    expect(lime).toBe('rgb(200, 251, 61)');
    // No Recent section before the first file, and Open is the one lime button.
    expect(screen.queryByRole('heading', { name: 'Recent' })).toBeNull();
    const open = within(screen.getByTestId('compact-library-dock')).getByRole('button', {
      name: 'Open PDF',
    });
    expect(open).not.toHaveAttribute('data-ghost');
    expect(getComputedStyle(open).backgroundColor).toBe('rgb(200, 251, 61)');
  });

  it('puts Open in the dock capsule, 48 px high, named Open PDF with the word Open', () => {
    render(<CompactLibrary />);
    const dock = screen.getByTestId('compact-library-dock');
    const open = within(dock).getByRole('button', { name: 'Open PDF' });
    expect(open).toBeVisible();
    expect(open).toHaveTextContent('Open');
    expect(height(open)).toBe(48);
    expect(height(dock)).toBe(60);
    expect(getComputedStyle(dock.parentElement as HTMLElement).position).toBe('fixed');
    expect(open.querySelector('svg')?.getBoundingClientRect().width).toBe(24);
  });

  it('lists Recent as a shelf of covers, newest first, with the sample as its last tile', async () => {
    useRecentsStore.setState({
      loaded: true,
      entries: [entry('r1', 'report.pdf'), entry('r2', 'Q3 board review.pdf', { pages: 8 })],
    });
    render(<CompactLibrary />);
    const list = await screen.findByTestId('compact-recents');
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeVisible();
    const tiles = within(list).getAllByRole('button');
    expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual([
      expect.stringMatching(/^report\.pdf, 3 pages/),
      expect.stringMatching(/^Q3 board review\.pdf, 8 pages/),
      null,
    ]);
    // The title is the name without its extension, in the serif.
    expect(within(list).getByText('Q3 board review')).toBeVisible();
    expect(within(list).getByText('report')).toBeVisible();
    expect(getComputedStyle(within(list).getByText('report')).fontFamily).toContain('Noto Serif');
    // Covers are 200 high, on one baseline.
    const sheets = Array.from(
      list.querySelectorAll<HTMLElement>('[data-testid="compact-recent"] > span:first-child'),
    );
    for (const sheet of sheets) expect(sheet.getBoundingClientRect().height).toBe(200);
    expect(within(list).getByRole('button', { name: /Try the sample/ })).toHaveAttribute(
      'data-testid',
      'compact-sample',
    );
    expect(screen.getByTestId('compact-library')).not.toHaveAttribute('data-first-run');
    expect(screen.queryByRole('heading', { level: 2, name: 'Margin, No. 07' })).toBeNull();
  });

  it('names Clear as Clear recents and keeps it a 44 px target', async () => {
    useRecentsStore.setState({ loaded: true, entries: [entry('r1', 'report.pdf')] });
    render(<CompactLibrary />);
    const clear = await screen.findByRole('button', { name: 'Clear recents' });
    expect(clear).toHaveTextContent('Clear');
    expect(height(clear)).toBeGreaterThanOrEqual(44);
  });

  it('opens a row menu with Remove from a context press on a cover', async () => {
    useRecentsStore.setState({ loaded: true, entries: [entry('r1', 'report.pdf')] });
    render(<CompactLibrary />);
    const tile = await screen.findByRole('button', { name: /^report\.pdf, / });
    // The context press alone: a real right click's mouseup can land on the menu that just
    // opened under the pointer and pick its item, closing it (a burn-in flake).
    fireEvent.contextMenu(tile);
    // The menu's first render can be replaced as it positions: assert on the item that stays.
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: 'Remove from recents' })).toBeVisible(),
    );
    await settled(screen.getByRole('menuitem', { name: 'Remove from recents' }));
  });

  it('shows Continue for the open document, with the one lime and a ghost Open', async () => {
    const file = await fixtureFile(simpleUrl, 'simple-text.pdf');
    expect(await openPdf(file)).toBe(true);
    const { workspace } = useWorkspaceStore.getState();
    const id = workspace.activeDocument;
    if (id === undefined) throw new Error('no document');
    act(() => {
      setResume(id, { page: 1, total: 3, zoom: 1, fit: null, offset: 0, at: Date.now() });
    });
    useRecentsStore.setState({ loaded: true, entries: [entry('r1', 'other.pdf')] });
    render(<CompactLibrary />);
    const card = await screen.findByTestId('continue-card');
    expect(within(card).getByTestId('continue-page')).toHaveTextContent('Page 2 of 3');
    const go = within(card).getByTestId('continue-resume');
    expect(go).toHaveTextContent('Continue');
    expect(height(go)).toBe(44);
    expect(getComputedStyle(go).backgroundColor).toBe('rgb(200, 251, 61)');
    const progress = within(card).getByRole('progressbar', { name: 'Reading progress' });
    expect(progress).toHaveAttribute('aria-valuenow', '67');
    expect(progress.getBoundingClientRect().height).toBe(2);
    // The dock's Open is a ghost pill: only one lime per view (owner).
    const open = within(screen.getByTestId('compact-library-dock')).getByRole('button', {
      name: 'Open PDF',
    });
    expect(open).toHaveAttribute('data-ghost');
    expect(getComputedStyle(open).backgroundColor).not.toBe('rgb(200, 251, 61)');
    expect(screen.getByTestId('compact-library')).toHaveAttribute('data-continued');
  });
});
