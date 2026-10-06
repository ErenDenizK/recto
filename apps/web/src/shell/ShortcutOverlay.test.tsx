/**
 * S22 on the Sheet (components/07-sheets.md §23.9): every registered shortcut appears, in
 * tables, in key map v2's groups (EN and TR) with the platform's keycaps; typing filters;
 * what was typed stays after Esc (the sheet's draft).
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { registerAppCommands } from '../commands/app-commands';
import { keymapRows } from '../commands/keymap';
import { commandRegistry } from '../commands/registry';
import { setLocale } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { useSheetStore } from '../ui/sheet/sheet-store';
import { ShortcutOverlay } from './ShortcutOverlay';

let dispose: () => void = () => undefined;

beforeEach(async () => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(1440, 900);
  dispose = registerAppCommands();
});

afterEach(() => {
  act(() => useUiStore.setState({ shortcutsOpen: false }));
  dispose();
});

describe('the shortcuts overlay (07 §23)', () => {
  it('lists every registered shortcut in tables, centred 760 px wide', async () => {
    useUiStore.setState({ shortcutsOpen: true });
    render(<ShortcutOverlay />);
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog.dataset.presentation).toBe('dialog');
    await waitFor(() => expect(dialog.getAnimations().length).toBe(0), { timeout: 5000 });
    expect(dialog.getBoundingClientRect().width).toBe(760);
    const titles = within(dialog)
      .getAllByRole('rowheader')
      .map((cell) => cell.firstElementChild?.textContent);
    // Every row of key map v2 (each bound command; a merged row once), from the registry.
    const rows = keymapRows(commandRegistry.list(), () => []).flatMap((g) => g.rows);
    expect(rows.length).toBeGreaterThan(50);
    for (const row of rows) expect(titles).toContain(row.title);
    expect(
      within(dialog).getByText('Shortcuts never fire while you type in a field.'),
    ).toBeVisible();
  });

  it('groups the map as S22 names them, with the platform’s keycaps, in EN and TR', async () => {
    useUiStore.setState({ shortcutsOpen: true });
    const { unmount } = render(<ShortcutOverlay />);
    const dialog = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' });
    const headings = (root: HTMLElement) =>
      within(root)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent);
    expect(headings(dialog)).toEqual([
      'Places',
      'Tools',
      'On a selection',
      'Pages',
      'Files',
      'View',
      'Commands',
      'History',
      'In a focused list or bar',
    ]);
    const places = within(dialog).getByRole('table', { name: 'Places' });
    const placeRows = within(places)
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent);
    expect(placeRows).toEqual([
      'Library0',
      'Back to viewing1',
      'Open or close MarkupM2',
      'Pages grid3',
      'Compare4',
    ]);
    // Mod reads as the platform's modifier: Ctrl here (⌘ on Apple, `shortcuts.test.ts`).
    const files = within(dialog).getByRole('table', { name: 'Files' });
    const save = within(files)
      .getByRole('rowheader', { name: /^Save$/ })
      .closest('tr');
    expect(save?.textContent).toMatch(/CtrlS$/);
    unmount();
    act(() => useUiStore.setState({ shortcutsOpen: false }));

    // Turkish: titles are read at registration, so the commands register again.
    dispose();
    setLocale('tr');
    dispose = registerAppCommands();
    try {
      act(() => useUiStore.setState({ shortcutsOpen: true }));
      render(<ShortcutOverlay />);
      const tr = await screen.findByRole('dialog', { name: 'Klavye kısayolları' });
      expect(headings(tr)).toEqual([
        'Yerler',
        'Araçlar',
        'Seçili metinde',
        'Sayfalar',
        'Dosyalar',
        'Görünüm',
        'Komutlar',
        'Geçmiş',
        'Odaktaki liste ya da çubukta',
      ]);
      expect(within(tr).getByRole('rowheader', { name: 'Görüntülemeye dön' })).toBeInTheDocument();
      expect(
        within(tr).getByRole('rowheader', { name: 'İşaretlemeyi aç veya kapat' }),
      ).toBeInTheDocument();
    } finally {
      setLocale('en');
    }
  });

  it('typing filters, and the search stays after Esc', async () => {
    useUiStore.setState({ shortcutsOpen: true });
    render(<ShortcutOverlay />);
    const search = await screen.findByRole('searchbox', { name: 'Find a shortcut' });
    await waitFor(() => expect(search).toHaveFocus());
    await userEvent.type(search, 'highlighter');
    const dialog = screen.getByRole('dialog');
    const rows = within(dialog).getAllByRole('rowheader');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.textContent?.toLowerCase()).toContain('highlighter');

    await userEvent.keyboard('{Escape}');
    expect(useUiStore.getState().shortcutsOpen).toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    act(() => useUiStore.setState({ shortcutsOpen: true }));
    expect(await screen.findByRole('searchbox', { name: 'Find a shortcut' })).toHaveValue(
      'highlighter',
    );

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'zzzz');
    expect(screen.getByText('No shortcut matches “zzzz”.')).toBeVisible();
  });
});
