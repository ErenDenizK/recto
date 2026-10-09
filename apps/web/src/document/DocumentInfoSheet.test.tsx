/**
 * S4 Document info (`components/07-sheets.md` §6; spec D2-9) in Vitest browser mode: the
 * command opens it on the Sheet primitive with the file facts (the inspector's Info, which it
 * took over), the badges with their explanations written out, the metadata editor focused on
 * Title and the password outcome; a password dialog opened from it comes back to it; Esc
 * closes it.
 */
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { EXIT_TIMEOUT, settled } from '../../test/settled';
import formUrl from '../../../../test/fixtures/forms-a.pdf?url';
import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { resetEditRunner, whenIdle } from '../annotations/edit-runner';
import { commandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { TooltipProvider } from '../ui/Tooltip';
import { registerDocumentCommands } from './document-commands';
import { DocumentSheets } from './DocumentSheets';
import { closeDocumentDialog } from './document-store';

const open = async (url: string, name: string) => {
  const report = await useWorkspaceStore.getState().openFiles([await fixtureFile(url, name)]);
  expect(report.skipped).toEqual([]);
};

let dispose: () => void = () => undefined;
beforeEach(() => {
  resetWorkspace();
  resetEditRunner();
  closeDocumentDialog();
  dispose = registerDocumentCommands(commandRegistry);
});
afterEach(async () => {
  dispose();
  await whenIdle();
  closeDocumentDialog();
  resetWorkspace();
});

const renderSheets = () =>
  render(
    <TooltipProvider>
      <DocumentSheets />
    </TooltipProvider>,
  );

describe('S4 Document info', () => {
  it('opens from "Document info…" with the facts, metadata on Title and the password', async () => {
    await open(simpleUrl, 'simple-text.pdf');
    renderSheets();
    expect(commandRegistry.get('document.info')?.title).toBe('Document info…');
    await act(() => commandRegistry.execute('document.info'));
    // The sheet fades in: its facts are asked about once the entrance has run.
    const sheet = await settled(await screen.findByRole('dialog', { name: 'Document info' }));
    expect(sheet).toHaveAttribute('data-sheet', 'document-info');
    const facts = within(sheet).getByTestId('document-facts');
    expect(within(facts).getByText('simple-text.pdf')).toBeVisible();
    expect(within(facts).getByText(m.info_pages())).toBeVisible();
    const editor = within(sheet).getByTestId('metadata-editor');
    // Polled: the sheet's entrance moves in, and a slow run reads its first frame.
    await expect.poll(() => editor.checkVisibility({ opacityProperty: true })).toBe(true);
    expect(within(sheet).getByLabelText('Title')).toHaveFocus();
    expect(within(sheet).getByTestId('security-outcome')).toBeVisible();

    await userEvent.keyboard('{Escape}');
    await expect
      .poll(() => screen.queryByRole('dialog', { name: 'Document info' }), {
        timeout: EXIT_TIMEOUT,
      })
      .toBeNull();
  });

  it('writes each badge’s explanation out, so touch reads it too (inventory 6.7)', async () => {
    await open(formUrl, 'forms-a.pdf');
    renderSheets();
    await act(() => commandRegistry.execute('document.info'));
    const sheet = await settled(await screen.findByRole('dialog', { name: 'Document info' }));
    const notes = within(sheet).getByRole('list', { name: m.info_notes() });
    expect(within(notes).getByText(m.badge_form())).toBeVisible();
    expect(within(notes).getByText(m.badge_form_explanation())).toBeVisible();
  });

  it('comes back after a password dialog opened from it', async () => {
    await open(simpleUrl, 'simple-text.pdf');
    renderSheets();
    await act(() => commandRegistry.execute('document.info'));
    const sheet = await screen.findByRole('dialog', { name: 'Document info' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Set password…' }));
    const password = await screen.findByTestId('set-password-dialog');
    await userEvent.click(within(password).getByRole('button', { name: 'Cancel' }));
    const back = await screen.findByRole('dialog', { name: 'Document info' });
    await expect.poll(() => back.checkVisibility({ opacityProperty: true })).toBe(true);
  });
});
