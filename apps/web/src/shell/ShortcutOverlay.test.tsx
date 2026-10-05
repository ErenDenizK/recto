/**
 * S22 on the Sheet (components/07-sheets.md §23.9): every registered shortcut appears, in
 * tables; typing filters; what was typed stays after Esc (the sheet's draft).
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { registerAppCommands } from '../commands/app-commands';
import { commandRegistry } from '../commands/registry';
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
    await waitFor(() => expect(dialog.getAnimations().length).toBe(0));
    expect(dialog.getBoundingClientRect().width).toBe(760);
    const titles = within(dialog)
      .getAllByRole('rowheader')
      .map((cell) => cell.firstElementChild?.textContent);
    for (const command of commandRegistry.list()) {
      if (command.shortcuts.length === 0) continue;
      expect(titles).toContain(command.title.replace(/…$/, ''));
    }
    expect(
      within(dialog).getByText('Shortcuts never fire while you type in a field.'),
    ).toBeVisible();
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
