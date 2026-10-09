/**
 * The Unlock popover (D1-4a; 04-context §19), Vitest browser mode through the real workspace
 * store: a change `commit()` refuses on a locked document opens it where the person acted (at
 * the press, or below the focused control after a key), with the reason in words; Unlock
 * changes the lock store only and announces; a signed file opens locked, its popover is an
 * alertdialog with Keep locked first, and Unlock anyway counts as the title menu's one warning.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import type { DocumentId, PageId } from '@pdf-editor/document-model';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import signedUrl from '../../../../../test/fixtures/signed-approval.pdf?url';
import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { settled } from '../../../test/settled';
import { fixtureFile } from '../../../test/store-harness';
import { lockOf, resetLockStore, useLockStore } from '../../state/lock-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { TooltipProvider } from '../../ui/Tooltip';
import { useAnnouncer } from '../announcer';
import { resetLockWarnings, unlockAsksFirst } from './LockSwitch';
import { UnlockPopover } from './UnlockPopover';

const model = () => useWorkspaceStore.getState();

async function open(url: string, name: string): Promise<DocumentId> {
  const report = await model().openFiles([await fixtureFile(url, name)]);
  const id = report.opened[0]?.documentId;
  if (id === undefined) throw new Error(`${name} did not open`);
  return id;
}

const firstPage = (id: DocumentId) => model().workspace.documents[id]?.pages[0]?.id as PageId;

/** A control that asks for a page change (Rotate), far from the window's corner. */
function Harness({ id }: { readonly id: DocumentId }) {
  return (
    <TooltipProvider>
      <button
        type="button"
        style={{ position: 'fixed', left: 300, top: 200, width: 120, height: 32 }}
        onClick={() => model().rotatePages([firstPage(id)], 90)}
      >
        Rotate
      </button>
      <UnlockPopover />
    </TooltipProvider>
  );
}

beforeEach(() => {
  resetWorkspace();
  resetLockStore();
  resetLockWarnings();
  // Development logs every refusal with its stack.
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetLockStore();
  resetWorkspace();
});

describe('the Unlock popover at the refusing control', () => {
  it('opens at the press with the reason, and Unlock unlocks without a history entry', async () => {
    const id = await open(simpleUrl, 'simple.pdf');
    useLockStore.getState().lock(id, 'user');
    render(<Harness id={id} />);
    const rotate = screen.getByRole('button', { name: 'Rotate' });
    const entries = model().history;

    await userEvent.click(rotate, { position: { x: 20, y: 16 } });
    const popover = await settled(await screen.findByRole('dialog'));
    expect(popover).toHaveAttribute('data-reason', 'user');
    expect(popover).toHaveAccessibleName('simple is locked');
    expect(popover).toHaveTextContent('You locked it. Nothing changes until you unlock it.');
    // At the place of the press (300 + 20, 200 + 16), 8 px below it.
    const box = popover.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(216 + 4);
    expect(box.top).toBeLessThanOrEqual(216 + 16);
    expect(box.left).toBeLessThanOrEqual(320);
    expect(box.right).toBeGreaterThanOrEqual(320);
    // Nothing changed, and Unlock is the default.
    expect(model().history).toBe(entries);
    const unlock = within(popover).getByRole('button', { name: 'Unlock' });
    await waitFor(() => expect(unlock).toHaveFocus());

    await userEvent.click(unlock);
    expect(lockOf(id)).toBeUndefined();
    expect(model().history).toBe(entries);
    await waitFor(() => expect(useAnnouncer.getState().message).toBe('simple unlocked'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // The next press acts.
    await userEvent.click(rotate);
    expect(model().history).not.toBe(entries);
  });

  it('opens below the focused control after a key; Esc keeps the lock and returns focus', async () => {
    const id = await open(simpleUrl, 'simple.pdf');
    useLockStore.getState().lock(id, 'default');
    render(<Harness id={id} />);
    const rotate = screen.getByRole('button', { name: 'Rotate' });
    act(() => rotate.focus());

    await userEvent.keyboard('{Enter}');
    const popover = await settled(await screen.findByRole('dialog'));
    expect(popover).toHaveAccessibleName('simple opened locked');
    expect(popover).toHaveTextContent('“Open documents locked” is on.');
    const box = popover.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(232 + 4);
    expect(box.top).toBeLessThanOrEqual(232 + 16);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(lockOf(id)).toBe('default');
    expect(rotate).toHaveFocus();
  });
});

describe('a signed file (V1-F12)', () => {
  it('opens locked; its popover warns, Keep locked first, Unlock anyway warns only once', async () => {
    const id = await open(signedUrl, 'signed-approval.pdf');
    expect(lockOf(id)).toBe('signed');
    render(<Harness id={id} />);
    const rotate = screen.getByRole('button', { name: 'Rotate' });

    await userEvent.click(rotate);
    let popover = await settled(await screen.findByRole('alertdialog'));
    expect(popover).toHaveAccessibleName('signed-approval is signed');
    expect(popover).toHaveTextContent('Any change removes the digital signature when you save.');
    const keep = within(popover).getByRole('button', { name: 'Keep locked' });
    await waitFor(() => expect(keep).toHaveFocus());
    await userEvent.click(keep);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(lockOf(id)).toBe('signed');

    await userEvent.click(rotate);
    popover = await settled(await screen.findByRole('alertdialog'));
    await userEvent.click(within(popover).getByRole('button', { name: 'Unlock anyway' }));
    expect(lockOf(id)).toBeUndefined();
    // The title menu's switch does not warn again (consistent with the popover).
    expect(unlockAsksFirst(id, 'signed')).toBe(false);
  });
});
