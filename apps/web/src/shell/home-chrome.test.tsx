/**
 * Home's chrome (review F16, F17, F25; Vitest browser mode, the real app and style sheets):
 * Home shows every open file, so it has the Library's strip (01-frame F2 §4): no sidebar, no
 * document controls and no page pill, and no tab looks selected; tabs take
 * their title's width up to 220 px before truncating; Recents are cards with a generic page
 * glyph, never a thumbnail.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { App } from '../app';
import { openDocuments } from '../commands/app-commands';
import { recordRecent } from '../files/recents';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace } from '../state/workspace-store';

async function fixture(name: string): Promise<File> {
  const bytes = await (await fetch(simpleUrl)).arrayBuffer();
  return new File([bytes], name, { type: 'application/pdf' });
}

const railTabs = () =>
  within(screen.getByRole('tablist', { name: 'Sidebar sections' }))
    .getAllByRole('tab')
    .map((t) => t.textContent);

describe('Home chrome', () => {
  beforeEach(async () => {
    await page.viewport(1440, 900);
    resetWorkspace();
    useUiStore.setState({
      destination: 'document',
      docUi: {},
      homeSelection: [],
      homeAnchor: null,
      leftPanelOpen: true,
      leftPanelView: 'pages',
      paletteOpen: false,
    });
  });
  afterEach(() => {
    resetWorkspace();
  });

  it('shows the Library strip on Home: no sidebar, ▤, Find, ↶ ↷, Save or page pill', async () => {
    render(<App />);
    await openDocuments([await fixture('first-file.pdf'), await fixture('demo-agreement.pdf')]);
    await waitFor(() => expect(railTabs()).toEqual(['Pages', 'Find', 'Review']));
    expect(screen.getByRole('tabpanel', { name: /Pages/ })).toBeInTheDocument();
    expect(screen.getByTestId('page-pill')).toBeInTheDocument();

    useUiStore.getState().showHome();
    await screen.findByTestId('home');
    // The Library has no sidebar (it lists the files itself); the stored view is kept.
    expect(screen.queryByRole('tablist', { name: 'Sidebar sections' })).toBeNull();
    expect(useUiStore.getState().leftPanelView).toBe('pages');
    // The Home strip (Colophon L2): the brand, the search, "On this device" and the gear; no
    // ◆ button, tabs, + or ⋯, and ◎ is the "On this device" status.
    const strip = screen.getByRole('banner', { name: 'Library bar' });
    expect(within(strip).getByTestId('home-search')).toBeVisible();
    expect(within(strip).getByTestId('privacy-indicator')).toHaveTextContent('On this device');
    expect(within(strip).getByTestId('home-settings')).toBeVisible();
    expect(strip.getBoundingClientRect().height).toBe(64);
    expect(within(strip).queryByTestId('home-button')).toBeNull();
    expect(within(strip).queryByTestId('sidebar-toggle')).toBeNull();
    expect(within(strip).queryByRole('tablist')).toBeNull();
    expect(within(strip).queryByTestId('undo-redo')).toBeNull();
    expect(screen.queryByTestId('page-pill')).toBeNull();
    // Back in the document, the sidebar and the page pill return.
    useUiStore.getState().showSurface('page');
    await waitFor(() => expect(railTabs()).toEqual(['Pages', 'Find', 'Review']));
    expect(screen.getByTestId('page-pill').textContent).toMatch(/^1 \/ /);
  });

  it('lets a tab take its title’s width up to 220 px before truncating', async () => {
    render(<App />);
    await openDocuments([
      await fixture('demo-agreement.pdf'),
      await fixture('a-very-long-file-name-that-cannot-fit-in-one-tab.pdf'),
    ]);
    const name = (title: string) => {
      const tab = screen.getByRole('tab', { name: title });
      const label = tab.querySelector<HTMLElement>('span:nth-child(2)') as HTMLElement;
      return {
        tab,
        label,
        width: (tab.parentElement as HTMLElement).getBoundingClientRect().width,
      };
    };
    await waitFor(() => expect(screen.getAllByRole('tab', { name: /demo|long/ })).toHaveLength(2));
    const short = name('demo-agreement');
    expect(short.label.scrollWidth).toBeLessThanOrEqual(short.label.clientWidth);
    expect(short.width).toBeLessThan(220);
    const long = name('a-very-long-file-name-that-cannot-fit-in-one-tab');
    expect(long.width).toBeCloseTo(220, 0);
    expect(long.label.scrollWidth).toBeGreaterThan(long.label.clientWidth);
  });

  it('shows Recents on the shelf, a plain recent with the page glyph', async () => {
    await recordRecent({ name: 'report.pdf', size: 6246, pages: 6 });
    render(<App />);
    const list = await screen.findByRole('list', { name: 'Recent files' });
    const row = within(list).getByRole('button', { name: /^report\.pdf, / });
    // No kept snapshot: the glyph, never a thumbnail (02.Q1).
    expect(row.querySelector('svg')).not.toBeNull();
    expect(list.querySelector('canvas, img')).toBeNull();
    // Colophon Home (DSN-93): the shelf stands on the desk itself, not in a lit panel.
    expect(row.closest('[data-lit]')).toBeNull();
    // One launcher above it, in the same Home.
    const home = screen.getByTestId('home');
    expect(within(home).getByTestId('library-open')).toBeVisible();
  });
});
