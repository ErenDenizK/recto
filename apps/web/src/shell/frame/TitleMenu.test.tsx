/**
 * The title menu (01-frame F5; redesign D2-1), Vitest browser mode: every row is a registered
 * command with a declared act, the guard dims rows of a locked document with its reason while
 * Save and the reading rows stay, focus lands on the first row (F2: the name), the Lock switch
 * locks and unlocks through the lock store with the guard's reasons, a signed lock warns once,
 * and the name commits on Enter and reverts on Esc.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { registerAppCommands } from '../../commands/app-commands';
import { commandRegistry } from '../../commands/registry';
import { registerDocumentCommands } from '../../document/document-commands';
import { registerOutlineCommands } from '../../outline/outline-commands';
import { registerArrangeCommands } from '../../stage/arrange-commands';
import { isAct } from '../../state/guard';
import { resetLockStore, useLockStore } from '../../state/lock-store';
import { useUiStore } from '../../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { TooltipProvider } from '../../ui/Tooltip';
import { closeTitleMenu, openTitleMenu, resetFrameStore } from './frame-store';
import { resetLockWarnings } from './LockSwitch';
import { TitleMenu } from './TitleMenu';
import { shownTitleMenu, TITLE_MENU_SECTIONS } from './TitleMenuItems';

let dispose: (() => void)[] = [];
beforeAll(() => {
  dispose = [
    registerAppCommands(commandRegistry),
    registerArrangeCommands(commandRegistry),
    registerDocumentCommands(commandRegistry),
    registerOutlineCommands(commandRegistry),
  ];
});
afterAll(() => {
  for (const d of dispose) d();
});

const active = () => {
  const id = useWorkspaceStore.getState().workspace.activeDocument;
  if (id === undefined) throw new Error('no document');
  return id;
};

beforeEach(async () => {
  resetWorkspace();
  resetLockStore();
  resetLockWarnings();
  resetFrameStore();
  await useWorkspaceStore.getState().openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
  useUiStore.setState({ destination: 'document', docUi: {} });
});
afterEach(() => {
  cleanup();
  act(() => closeTitleMenu());
  resetLockStore();
  resetWorkspace();
});

describe('the rows (F5 §5)', () => {
  it('names only registered commands, each with a declared act (fails for a new row without one)', () => {
    for (const section of TITLE_MENU_SECTIONS) {
      for (const entry of section.entries) {
        if (entry.kind !== 'command') continue;
        const command = commandRegistry.get(entry.id);
        // Rows of packages not registered here (signatures, OCR, furniture) are left out.
        if (!command) continue;
        expect(command.act === null || isAct(command.act), entry.id).toBe(true);
      }
    }
  });

  it('dims the page rows of a locked document with the guard’s reason; Save and reading stay', () => {
    const rows = () => shownTitleMenu(commandRegistry.list()).flatMap((s) => s.rows);
    const row = (key: string) => rows().find((r) => r.key === key);
    expect(row('rotate')?.enabled).toBe(true);
    useLockStore.getState().lock(active());
    expect(row('rotate')).toMatchObject({ enabled: false, reason: 'Locked · unlock first' });
    // Rows that open a sheet stay; the sheet's Apply is what the guard refuses.
    for (const key of ['file.save', 'file.export', 'mode.compare', 'pages.crop']) {
      expect(row(key)?.enabled, key).toBe(true);
    }
  });
});

function Harness() {
  return (
    <TooltipProvider>
      <button type="button" id="anchor">
        report
      </button>
      <TitleMenu anchor={() => document.getElementById('anchor')} />
    </TooltipProvider>
  );
}

describe('the popover (F5 §6, §8)', () => {
  it('is a dialog named for the document, with one menu list; focus on the first row', async () => {
    render(<Harness />);
    act(() => openTitleMenu('menu'));
    const dialog = await screen.findByRole('dialog', { name: 'simple document menu' });
    const menu = within(dialog).getByRole('menu');
    const first = within(menu).getAllByRole('menuitem')[0];
    await waitFor(() => expect(first).toHaveFocus());
    expect(first).toHaveTextContent('Save');
    await userEvent.keyboard('{ArrowDown}');
    expect(within(menu).getAllByRole('menuitem')[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    const rows = within(menu).getAllByRole('menuitem');
    expect(rows[rows.length - 1]).toHaveFocus();
  });

  it('opens on the name for F2 and Rename…; Enter renames, Esc reverts', async () => {
    render(<Harness />);
    act(() => openTitleMenu('name'));
    const name = await screen.findByTestId('title-menu-name');
    await waitFor(() => expect(name).toHaveFocus());
    await userEvent.keyboard('{Control>}a{/Control}lease{Enter}');
    await waitFor(() =>
      expect(useWorkspaceStore.getState().workspace.documents[active()]?.title).toBe('lease'),
    );
    expect(name).toHaveFocus();
    await userEvent.keyboard('x');
    expect(name).toHaveValue('leasex');
    await userEvent.keyboard('{Escape}');
    expect(name).toHaveValue('lease');
    // Esc reverted and kept the menu open.
    expect(screen.getByRole('dialog')).toBeVisible();
  });

  it('locks with the reason "user" and unlocks through the switch (the lock store)', async () => {
    render(<Harness />);
    act(() => openTitleMenu('menu'));
    const lock = await screen.findByRole('switch', { name: /Lock/ });
    expect(lock).not.toBeChecked();
    await userEvent.click(lock);
    expect(useLockStore.getState().locks[active()]).toBe('user');
    await waitFor(() => expect(screen.getByText('You locked it')).toBeVisible());
    // The name is read-only while locked (a `document` act).
    expect(screen.getByTestId('title-menu-name')).toHaveAttribute('readonly');
    await userEvent.click(lock);
    expect(useLockStore.getState().locks[active()]).toBeUndefined();
  });

  it('warns once before unlocking a signed document (flows §2.6)', async () => {
    useLockStore.getState().lock(active(), 'signed');
    render(<Harness />);
    act(() => openTitleMenu('menu'));
    const lock = await screen.findByRole('switch', { name: /Lock/ });
    await waitFor(() =>
      expect(screen.getByText('Signed file: changes break the signature')).toBeVisible(),
    );
    await userEvent.click(lock);
    const warning = screen.getByTestId('unlock-warning');
    expect(useLockStore.getState().locks[active()]).toBe('signed');
    await userEvent.click(within(warning).getByRole('button', { name: 'Keep locked' }));
    expect(useLockStore.getState().locks[active()]).toBe('signed');
    // Warned once this session: the switch now unlocks at once.
    await userEvent.click(lock);
    expect(useLockStore.getState().locks[active()]).toBeUndefined();
  });
});
