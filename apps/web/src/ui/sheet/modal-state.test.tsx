/**
 * Which surfaces are known as modal (07-sheets §8; FB4 §4, A-24; DSN-56's finding): a modal
 * sheet, a confirmation and the phone's scrim sheet carry `aria-modal="true"` on their popup,
 * so the toast timers pause under them and the shortcut guards that read `aria-modal` (Mod+S,
 * the lasso keys, space-pan, the registry's plain keys) hold while one has focus. A tool sheet
 * and the phone's tool drawer stay non-modal: the page and its keys stay live.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

import { settled } from '../../../test/settled';
import { CommandRegistry } from '../../commands/registry';
import { dispatchShortcut } from '../../commands/use-shortcuts';
import { setDrawerOpen } from '../../shell/compact/compact-store';
import { CompactSheet } from '../../shell/compact/CompactSheet';
import { ToolDrawer } from '../../shell/compact/mark/ToolDrawer';
import { resetToasts, useToastStore } from '../Toast/toast-store';
import { ToastRegion } from '../Toast/ToastRegion';
import type { SheetKind } from './presentation';
import { Sheet } from './Sheet';
import { useSheetStore } from './sheet-store';

beforeEach(async () => {
  resetToasts();
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(1440, 900);
});

afterEach(() => {
  act(() => setDrawerOpen(false));
  resetToasts();
});

const modalPaused = () => useToastStore.getState().paused.has('modal');

/** A registry with one plain-key command, as the tool keys are. */
function plainKey() {
  const registry = new CommandRegistry();
  const run = vi.fn();
  registry.register({ id: 'tool.pen', title: 'Pen', group: 'G', act: null, shortcut: 'p', run });
  return { registry, run };
}

function press(target: Element, registry: CommandRegistry): void {
  const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  dispatchShortcut(event, registry, 'other');
}

function SheetOf({ kind }: { readonly kind: SheetKind }) {
  return (
    <>
      <Sheet id="s" kind={kind} open onClose={() => undefined} title="Page numbers">
        <button type="button">Inside</button>
      </Sheet>
      <ToastRegion />
    </>
  );
}

describe('the full edition', () => {
  for (const kind of ['task', 'settings', 'confirmation'] as const) {
    it(`knows a ${kind} sheet as modal: toasts pause, plain keys hold`, async () => {
      const { registry, run } = plainKey();
      render(<SheetOf kind={kind} />);
      const sheet = await settled(
        await screen.findByRole(kind === 'confirmation' ? 'alertdialog' : 'dialog'),
      );
      expect(sheet).toHaveAttribute('aria-modal', 'true');
      await waitFor(() => expect(modalPaused()).toBe(true));
      press(screen.getByRole('button', { name: 'Inside' }), registry);
      expect(run).not.toHaveBeenCalled();
    });
  }

  it('keeps a tool sheet non-modal: toasts run, plain keys act', async () => {
    const { registry, run } = plainKey();
    render(<SheetOf kind="tool" />);
    const sheet = await settled(await screen.findByRole('dialog'));
    expect(sheet).toHaveAttribute('aria-modal', 'false');
    expect(modalPaused()).toBe(false);
    press(screen.getByRole('button', { name: 'Inside' }), registry);
    expect(run).toHaveBeenCalledOnce();
  });

  it('lets the toasts run again once the modal sheet has gone', async () => {
    const { rerender } = render(<SheetOf kind="task" />);
    await waitFor(() => expect(modalPaused()).toBe(true));
    rerender(<ToastRegion />);
    await waitFor(() => expect(modalPaused()).toBe(false), { timeout: 3000 });
  });
});

describe('the compact edition', () => {
  it('knows a scrim sheet as modal: toasts pause, plain keys hold', async () => {
    await page.viewport(390, 844);
    const { registry, run } = plainKey();
    render(
      <>
        <CompactSheet open onClose={() => undefined} title="Contents">
          <button type="button">Inside</button>
        </CompactSheet>
        <ToastRegion edition="compact" />
      </>,
    );
    const sheet = await settled(await screen.findByRole('dialog', { name: 'Contents' }));
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    await waitFor(() => expect(modalPaused()).toBe(true));
    press(screen.getByRole('button', { name: 'Inside' }), registry);
    expect(run).not.toHaveBeenCalled();
  });

  it('keeps the tool drawer non-modal: toasts run, plain keys act', async () => {
    await page.viewport(390, 844);
    const { registry, run } = plainKey();
    act(() => setDrawerOpen(true));
    render(
      <>
        <ToolDrawer />
        <ToastRegion edition="compact" />
      </>,
    );
    const drawer = await settled(await screen.findByTestId('compact-tool-drawer'));
    expect(drawer).not.toHaveAttribute('aria-modal', 'true');
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
    expect(modalPaused()).toBe(false);
    press(drawer, registry);
    expect(run).toHaveBeenCalledOnce();
  });
});
