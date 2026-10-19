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
import { toast } from '../Toast/toast';
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
  vi.useRealTimers();
  document.documentElement.style.removeProperty('--free-bottom');
});

const modalPaused = () => useToastStore.getState().paused.has('modal');

/**
 * Lets the region's observers answer what has just mounted: their callbacks run as microtasks
 * after the change and queue one more, all done before the next frame.
 */
async function observed(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

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
    await observed();
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

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** A modal task sheet with its primary in the footer, and the region with one toast. */
function SheetWithToast({ open }: { readonly open: boolean }) {
  return (
    <>
      <Sheet
        id="s"
        kind="task"
        open={open}
        onClose={() => undefined}
        title="Save a copy"
        primary={{ label: 'Download copy', onPress: () => undefined }}
      >
        <p>Body</p>
      </Sheet>
      <ToastRegion />
    </>
  );
}

describe('a toast never covers a modal sheet (DSN-58)', () => {
  for (const [width, height] of [
    [1440, 900],
    [1180, 820],
  ] as const) {
    it(`moves beside a side sheet at ${width} × ${height}, readable and clear of its footer`, async () => {
      await page.viewport(width, height);
      const { rerender } = render(<SheetWithToast open={false} />);
      act(() => {
        toast.info('Split into 2 documents');
      });
      const shown = await settled(
        await screen.findByRole('group', { name: 'Split into 2 documents' }),
      );
      rerender(<SheetWithToast open />);
      const sheet = await settled(await screen.findByRole('dialog', { name: 'Save a copy' }));
      expect(sheet).toHaveAttribute('data-presentation', 'side');
      const button = screen.getByRole('button', { name: 'Download copy' });
      await waitFor(() =>
        expect(overlaps(shown.getBoundingClientRect(), sheet.getBoundingClientRect())).toBe(false),
      );
      expect(shown).toBeVisible();
      const b = button.getBoundingClientRect();
      expect(
        document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('button'),
      ).toBe(button);
    });
  }

  it('yields where there is no room beside the sheet, and comes back as it goes', async () => {
    // Under 600 px a task sheet is a bottom sheet across the window (presentation.ts).
    await page.viewport(560, 800);
    const { rerender } = render(<SheetWithToast open={false} />);
    act(() => {
      toast.info('Split into 2 documents');
    });
    const shown = await settled(
      await screen.findByRole('group', { name: 'Split into 2 documents' }),
    );
    rerender(<SheetWithToast open />);
    const sheet = await settled(await screen.findByRole('dialog', { name: 'Save a copy' }));
    expect(sheet).toHaveAttribute('data-presentation', 'bottom');
    const region = shown.closest('[data-region="toasts"]') as HTMLElement;
    await waitFor(() => expect(region).toHaveAttribute('data-yield'));
    expect(getComputedStyle(region).visibility).toBe('hidden');
    const button = screen.getByRole('button', { name: 'Download copy' });
    const b = button.getBoundingClientRect();
    expect(
      document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)?.closest('button'),
    ).toBe(button);
    rerender(<SheetWithToast open={false} />);
    await waitFor(() => expect(region).not.toHaveAttribute('data-yield'), { timeout: 3000 });
    expect(shown).toBeVisible();
  });

  it('moves two toasts beside a side sheet together', async () => {
    const { rerender } = render(<SheetWithToast open={false} />);
    act(() => {
      toast.info('Split into 2 documents');
      toast.info('Deleted page 2');
    });
    const one = await settled(await screen.findByRole('group', { name: 'Split into 2 documents' }));
    const two = await settled(await screen.findByRole('group', { name: 'Deleted page 2' }));
    rerender(<SheetWithToast open />);
    const sheet = await settled(await screen.findByRole('dialog', { name: 'Save a copy' }));
    await waitFor(() => {
      for (const t of [one, two]) {
        expect(overlaps(t.getBoundingClientRect(), sheet.getBoundingClientRect())).toBe(false);
      }
    });
    expect(one).toBeVisible();
    expect(two).toBeVisible();
  });

  it('never drops below the band under a tall dialog: it yields instead', async () => {
    // The dock band's room at the foot of the free rectangle (frame-insets.ts).
    document.documentElement.style.setProperty('--free-bottom', '72px');
    const { rerender } = render(<TallDialog open={false} />);
    act(() => {
      toast.info('Deleted page 2');
    });
    const shown = await settled(await screen.findByRole('group', { name: 'Deleted page 2' }));
    const region = shown.closest('[data-region="toasts"]') as HTMLElement;
    const resting = region.getBoundingClientRect();
    rerender(<TallDialog open />);
    const dialog = await settled(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' }));
    expect(dialog).toHaveAttribute('data-presentation', 'dialog');
    await waitFor(() => expect(region).toHaveAttribute('data-yield'));
    expect(region.getBoundingClientRect().bottom).toBe(resting.bottom);
    expect(getComputedStyle(region).visibility).toBe('hidden');
  });

  it('brings a yielded toast back with the time it had left, not a fresh timer', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = new Date('2026-10-19T12:00:00Z').getTime();
    vi.setSystemTime(start);
    await page.viewport(560, 800);
    const { rerender } = render(<SheetWithToast open={false} />);
    act(() => {
      toast.info('Split into 2 documents');
    });
    const shown = await settled(
      await screen.findByRole('group', { name: 'Split into 2 documents' }),
    );
    const region = shown.closest('[data-region="toasts"]') as HTMLElement;
    const first = useToastStore.getState().shown[0];
    expect(first?.runningSince).toBe(start);
    const duration = first?.remaining ?? 0;
    // 1.5 s on screen, then the sheet: the timer stops with what was left.
    vi.setSystemTime(start + 1500);
    rerender(<SheetWithToast open />);
    await settled(await screen.findByRole('dialog', { name: 'Save a copy' }));
    await waitFor(() => expect(region).toHaveAttribute('data-yield'));
    expect(useToastStore.getState().shown[0]).toMatchObject({
      remaining: duration - 1500,
      runningSince: null,
    });
    // A long while under the sheet takes nothing off it.
    vi.setSystemTime(start + 60_000);
    rerender(<SheetWithToast open={false} />);
    await waitFor(() => expect(region).not.toHaveAttribute('data-yield'), { timeout: 3000 });
    await waitFor(() => expect(modalPaused()).toBe(false), { timeout: 3000 });
    expect(useToastStore.getState().shown[0]).toMatchObject({
      remaining: duration - 1500,
      runningSince: start + 60_000,
    });
    expect(shown).toBeVisible();
  });
});

/** The shortcuts overlay's shape: a centred dialog at its tallest, its foot on the band's row. */
function TallDialog({ open }: { readonly open: boolean }) {
  return (
    <>
      <Sheet id="o" kind="overlay" open={open} onClose={() => undefined} title="Keyboard shortcuts">
        <div style={{ height: 2000 }} />
      </Sheet>
      <ToastRegion />
    </>
  );
}

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
    await observed();
    expect(modalPaused()).toBe(false);
    press(drawer, registry);
    expect(run).toHaveBeenCalledOnce();
  });
});
