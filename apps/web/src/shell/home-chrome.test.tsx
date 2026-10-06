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
  within(screen.getByRole('tablist', { name: /views/i }))
    .getAllByRole('tab')
    .map((t) => t.id.replace(/^rail-/, ''));

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
    await waitFor(() => expect(railTabs()).toEqual(['pages', 'find', 'review', 'files']));
    expect(screen.getByRole('tabpanel', { name: /Pages/ })).toBeInTheDocument();
    expect(screen.getByTestId('page-pill')).toBeInTheDocument();

    useUiStore.getState().showHome();
    await screen.findByTestId('home');
    // The Library has no sidebar (it lists the files itself); the stored view is kept.
    expect(screen.queryByRole('tablist', { name: /views/i })).toBeNull();
    expect(useUiStore.getState().leftPanelView).toBe('pages');
    // The strip (01-frame F2 §4): ◆ current with its label, tabs, +, ◎ and ⋯ only.
    const strip = screen.getByRole('banner', { name: 'Library bar' });
    expect(within(strip).getByTestId('home-button')).toHaveAttribute('aria-current', 'page');
    expect(within(strip).queryByTestId('sidebar-toggle')).toBeNull();
    expect(within(strip).queryByRole('searchbox')).toBeNull();
    expect(within(strip).queryByTestId('undo-redo')).toBeNull();
    expect(within(strip).getByTestId('library-menu')).toBeVisible();
    expect(screen.queryByTestId('page-pill')).toBeNull();
    // No tab is selected, nor looks it: no selected fill, no close affordance shown. A keyboard
    // focus inside a tab shows its close on purpose (TabBar.module.css), and the focus may have
    // been rescued into the tab list when Home took over, so judge the resting look unfocused.
    (document.activeElement as HTMLElement | null)?.blur();
    const tabs = screen.getAllByRole('tab', { name: /first-file|demo-agreement/ });
    for (const tab of tabs) {
      expect(tab).toHaveAttribute('aria-selected', 'false');
      const wrap = tab.parentElement as HTMLElement;
      expect(wrap).not.toHaveAttribute('data-selected');
      const close = wrap.querySelector<HTMLElement>('[aria-hidden="true"]:last-child');
      // After the selected look's short transition.
      await waitFor(() => {
        expect(getComputedStyle(wrap).backgroundColor).toBe('rgba(0, 0, 0, 0)');
        // A pointer resting over a tab, or a page that cannot hover (an earlier file of the run
        // that emulated touch leaves `hover: none` behind), shows the close on purpose
        // (TabBar.module.css): neither is the resting look this checks.
        if (!wrap.matches(':hover') && matchMedia('(hover: hover)').matches) {
          expect(getComputedStyle(close as HTMLElement).opacity).toBe('0');
        }
      });
    }
    // A click on the active tab leaves the focus there; it still does not look selected.
    tabs[0]?.focus();
    expect(getComputedStyle(tabs[0]?.parentElement as HTMLElement).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    );

    // Back in the document, the sidebar and the page pill return.
    useUiStore.getState().showSurface('page');
    await waitFor(() => expect(railTabs()).toEqual(['pages', 'find', 'review', 'files']));
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

  it('shows Recents as cards with a page glyph and no thumbnail', async () => {
    await recordRecent({ name: 'report.pdf', size: 6246, pages: 6 });
    render(<App />);
    const list = await screen.findByRole('list', { name: 'Recent files' });
    const row = within(list).getByRole('button', { name: /^report\.pdf, / });
    expect(row.querySelector('svg')).not.toBeNull();
    expect(list.querySelector('canvas, img')).toBeNull();
    const card = row.closest('li') as HTMLElement;
    const style = getComputedStyle(card);
    expect(style.borderTopStyle).toBe('solid');
    expect(style.backgroundColor).toBe('rgb(23, 25, 30)');
    // One column, under the open and drop card.
    const drop = screen.getByRole('heading', { name: 'Drop PDFs to start' });
    expect(drop.getBoundingClientRect().bottom).toBeLessThan(card.getBoundingClientRect().top);
  });
});
