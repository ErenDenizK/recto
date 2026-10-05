/**
 * S6 on the Sheet (components/07-sheets.md §8.9): a wrong password then the right one, in one
 * sheet that stays in place; Skip and Esc leave the file closed; "1 of 2" names the queue.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { requestPassword, usePasswordStore } from '../state/password-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { useSheetStore } from '../ui/sheet/sheet-store';
import { PasswordDialog } from './PasswordDialog';

beforeEach(async () => {
  usePasswordStore.setState({ queue: [] });
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  useWorkspaceStore.setState({ opening: 0 });
  await page.viewport(1440, 900);
});

describe('the password prompt (07 §8)', () => {
  it('a wrong password shows the error in place, the field cleared and focused; the right one closes it', async () => {
    render(<PasswordDialog />);
    useWorkspaceStore.setState({ opening: 1 });
    let answer: Promise<string | null> = Promise.resolve(null);
    act(() => {
      answer = requestPassword({ fileName: 'report.pdf', incorrect: false });
    });
    const dialog = await screen.findByRole('alertdialog', { name: 'Password required' });
    expect(dialog).toHaveAccessibleDescription(
      'report.pdf is protected. The password is used on this device only.',
    );
    const field = screen.getByLabelText('Password');
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAttribute('autocomplete', 'current-password');
    await userEvent.type(field, 'wrong');
    await userEvent.keyboard('{Enter}');
    await expect(answer).resolves.toBe('wrong');

    // The engine tries it and asks again: the same sheet, not a new one.
    act(() => {
      answer = requestPassword({ fileName: 'report.pdf', incorrect: true });
    });
    await waitFor(() =>
      expect(screen.getByText('That password did not open the file. Try again.')).toBeVisible(),
    );
    expect(screen.getByRole('alertdialog')).toBe(dialog);
    const again = screen.getByLabelText('Password');
    expect(again).toHaveValue('');
    expect(again).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(again).toHaveFocus());

    // Show reveals the text.
    await userEvent.type(again, 'user');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(again).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await expect(answer).resolves.toBe('user');
    // Still there while PDFium tries; gone once the file has opened.
    expect(screen.getByRole('alertdialog')).toBeVisible();
    act(() => useWorkspaceStore.setState({ opening: 0 }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('Skip file and Esc leave the file closed; the queue shows its place', async () => {
    render(<PasswordDialog />);
    let first: Promise<string | null> = Promise.resolve('x');
    let second: Promise<string | null> = Promise.resolve('x');
    act(() => {
      first = requestPassword({ fileName: 'a.pdf', incorrect: false });
      second = requestPassword({ fileName: 'b.pdf', incorrect: false });
    });
    await waitFor(() => expect(screen.getByText('1 of 2')).toBeVisible());
    await userEvent.click(screen.getByRole('button', { name: 'Skip file' }));
    await expect(first).resolves.toBeNull();
    await waitFor(() => expect(screen.getByText('2 of 2')).toBeVisible());
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/^b\.pdf is protected/);
    await userEvent.keyboard('{Escape}');
    await expect(second).resolves.toBeNull();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});
