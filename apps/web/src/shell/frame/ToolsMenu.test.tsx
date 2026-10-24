/**
 * The dock's Tools entry (DSN-76; Vitest browser mode): the `?tools=1` gate, each row's command
 * id (a registered command the title menu or the dock's More already holds, DSN-46), and the
 * menu's keyboard (Esc closes, focus back on the entry, arrows move).
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { settled } from '../../../test/settled';
import { registerAppCommands } from '../../commands/app-commands';
import { commandRegistry } from '../../commands/registry';
import { registerArrangeCommands } from '../../stage/arrange-commands';
import { resetLockStore } from '../../state/lock-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { Dock } from './Dock';
import { TITLE_MENU_SECTIONS } from './TitleMenuItems';
import { TOOL_ENTRIES } from './ToolsMenu';
import { toolsEntryEnabled } from './tools-flag';

const dock = () => screen.getByRole('toolbar', { name: 'Document tools' });
const setSearch = (search: string) => history.replaceState(null, '', `/${search}`);

describe('Tools entry', () => {
  let dispose: () => void = () => undefined;
  beforeAll(() => {
    // The app registers the arrange commands (Combine, Split) beside the rest (`app.tsx`).
    const offs = [registerAppCommands(), registerArrangeCommands(commandRegistry)];
    dispose = () => offs.forEach((off) => off());
  });
  afterAll(() => dispose());
  beforeEach(() => {
    resetWorkspace();
    resetLockStore();
  });
  afterEach(() => {
    cleanup();
    resetWorkspace();
    setSearch('');
  });

  async function mount() {
    await useWorkspaceStore.getState().openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
    render(
      <div style={{ position: 'relative', height: 600 }} data-frame-layer="band">
        <Dock />
      </div>,
    );
  }

  it('shows only with ?tools=1', async () => {
    setSearch('');
    expect(toolsEntryEnabled()).toBe(false);
    await mount();
    expect(within(dock()).queryByRole('button', { name: 'Tools' })).toBeNull();
    cleanup();
    setSearch('?tools=1');
    expect(toolsEntryEnabled()).toBe(true);
    await mount();
    expect(within(dock()).getByRole('button', { name: 'Tools' })).toBeVisible();
  });

  it('runs commands the title menu or the dock More already hold', () => {
    const homed = new Set([
      'tool.redact', // the dock's More
      ...TITLE_MENU_SECTIONS.flatMap((s) =>
        s.entries.flatMap((e) => (e.kind === 'command' ? [e.id] : [])),
      ),
    ]);
    for (const { id } of TOOL_ENTRIES) {
      expect(commandRegistry.get(id), id).toBeDefined();
      expect(homed.has(id), id).toBe(true);
    }
  });

  it('opens a list, moves with the arrows and closes on Esc with focus back on the entry', async () => {
    setSearch('?tools=1');
    await mount();
    const entry = within(dock()).getByRole('button', { name: 'Tools' });
    entry.focus();
    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', { name: 'Tools' });
    await settled(menu);
    const items = within(menu).getAllByRole('menuitem');
    expect(items.length).toBe(TOOL_ENTRIES.length);
    await userEvent.keyboard('{ArrowDown}');
    const first = document.activeElement;
    expect(menu.contains(first)).toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).not.toBe(first);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(entry);
  });

  it('keeps Redact out of More while Tools is shown (DSN-76, DSN-47), in More otherwise', async () => {
    for (const [search, inMore] of [
      ['', true],
      ['?tools=1', false],
    ] as const) {
      setSearch(search);
      await mount();
      await userEvent.click(within(dock()).getByRole('button', { name: 'More' }));
      const menu = await screen.findByRole('menu', { name: 'More' });
      await settled(menu);
      expect(within(menu).queryByRole('menuitem', { name: 'Redact' }) !== null, search).toBe(
        inMore,
      );
      await userEvent.keyboard('{Escape}');
      await vi.waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      cleanup();
    }
  });

  it("wears the title menu's labels (DSN-52)", async () => {
    setSearch('?tools=1');
    await mount();
    await userEvent.click(within(dock()).getByRole('button', { name: 'Tools' }));
    const menu = await screen.findByRole('menu', { name: 'Tools' });
    await settled(menu);
    for (const name of ['Split…', 'Compare with…'])
      expect(within(menu).getByRole('menuitem', { name: new RegExp(name) })).toBeDefined();
  });
});
