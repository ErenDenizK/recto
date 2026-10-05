/**
 * The toast region and the toast API in a real browser (Vitest browser mode; `08-feedback`
 * FB4 §4, §6, §8, FB10; spec redesign X9, X14; A-13, A-14, A-24): a silent named region,
 * each toast said once, F6 landing on the newest toast's action as the last stop, Esc and ✕
 * dismissing with focus going back, Up and Down between toasts, hover holding the timer,
 * an exiting toast inert, and Undo toasts bound to their history step.
 */
import type { DocumentId, PageId } from '@pdf-editor/document-model';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from 'vitest/browser';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../../test/store-harness';
import { resetAnnouncer, useAnnouncer } from '../../shell/announcer';
import { useRegionCycling } from '../../shell/LeftRail.regions';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { resetToastHints, setHistoryOpener, toast } from './toast';
import { ACTION_MS, resetToasts, useToastStore } from './toast-store';
import { ToastRegion } from './ToastRegion';

/** A shell with one header button, the F6 cycle installed, and the region beside it. */
function Shell() {
  const ref = useRef<HTMLDivElement>(null);
  useRegionCycling(ref);
  return (
    <>
      <div ref={ref} data-testid="app-shell">
        <header>
          <button type="button">Tab</button>
        </header>
        <main>
          <button type="button" data-read-viewport="">
            page
          </button>
        </main>
      </div>
      <ToastRegion />
    </>
  );
}

const region = () => screen.getByRole('region', { name: 'Notifications' });
const shownTexts = () => useToastStore.getState().shown.map((t) => t.text);

beforeEach(() => {
  resetToasts();
  resetAnnouncer();
  resetToastHints();
});
afterEach(() => {
  resetToasts();
  setHistoryOpener(undefined);
});

describe('the region', () => {
  it('is a silent region named Notifications, each toast a group named by its text', async () => {
    render(<Shell />);
    act(() => {
      toast.info('Text copied');
    });
    const group = await screen.findByRole('group', { name: 'Text copied' });
    expect(region()).not.toHaveAttribute('aria-live');
    expect(region()).not.toHaveAttribute('role', 'status');
    expect(group.closest('[aria-live]')).toBeNull();
  });

  it('says each toast once, through the announcer, with the F6 hint the first time only', async () => {
    render(<Shell />);
    act(() => {
      toast.action('Opened 3 files', { label: 'Show', run: () => undefined });
    });
    expect(useAnnouncer.getState()).toMatchObject({
      message: 'Opened 3 files. F6 reaches the notification',
      serial: 1,
    });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    act(() => {
      toast.action('Opened 2 files', { label: 'Show', run: () => undefined });
    });
    expect(useAnnouncer.getState()).toMatchObject({ message: 'Opened 2 files', serial: 2 });
    // Rendering and re-rendering the region says nothing more.
    await screen.findByRole('group', { name: 'Opened 2 files' });
    expect(useAnnouncer.getState().serial).toBe(2);
  });

  it('is the last F6 stop, landing on the newest toast’s action; Esc dismisses and focus goes back', async () => {
    render(<Shell />);
    act(() => {
      toast.info('Text copied');
      toast.action('Opened 3 files', { label: 'Show', run: () => undefined });
    });
    await screen.findByRole('group', { name: 'Opened 3 files' });
    const viewport = document.querySelector<HTMLElement>('[data-read-viewport]');
    viewport?.focus();
    await userEvent.keyboard('{F6}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show' }));
    // Up reaches the older toast.
    await userEvent.keyboard('{ArrowUp}');
    const older = screen.getByRole('group', { name: 'Text copied' });
    expect(older.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show' }));
    // Esc dismisses the focused toast; focus returns to where it was before F6.
    await userEvent.keyboard('{Escape}');
    expect(shownTexts()).toEqual(['Text copied']);
    expect(document.activeElement).toBe(viewport);
    // From the last stop, F6 wraps to the first region.
    viewport?.focus();
    await userEvent.keyboard('{F6}');
    await userEvent.keyboard('{F6}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tab' }));
  });

  it('passes an empty region by', async () => {
    render(<Shell />);
    screen.getByRole('button', { name: 'Tab' }).focus();
    await userEvent.keyboard('{F6}');
    expect(document.activeElement).toBe(document.querySelector('[data-read-viewport]'));
    await userEvent.keyboard('{F6}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tab' }));
  });

  it('holds the timer while hovered (A-24) and runs on after', async () => {
    render(<Shell />);
    act(() => {
      toast.action('Deleted page 7', { label: 'Undo', run: () => undefined });
    });
    const group = await screen.findByRole('group', { name: 'Deleted page 7' });
    await userEvent.hover(group);
    expect(useToastStore.getState().paused.has('hover')).toBe(true);
    const [held] = useToastStore.getState().shown;
    expect(held?.runningSince).toBeNull();
    await userEvent.unhover(group);
    expect(useToastStore.getState().paused.has('hover')).toBe(false);
    expect(useToastStore.getState().shown[0]?.remaining).toBeLessThanOrEqual(ACTION_MS);
  });

  it('holds the timer while focus is inside it (A-24) and runs on when focus leaves', async () => {
    render(<Shell />);
    act(() => {
      toast.action('Deleted page 7', { label: 'Undo', run: () => undefined });
    });
    await screen.findByRole('group', { name: 'Deleted page 7' });
    const viewport = document.querySelector<HTMLElement>('[data-read-viewport]');
    viewport?.focus();
    await userEvent.keyboard('{F6}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Undo' }));
    expect(useToastStore.getState().paused.has('focus')).toBe(true);
    expect(useToastStore.getState().shown[0]?.runningSince).toBeNull();
    // Up and Down between toasts keep the hold; leaving the region lets go.
    await userEvent.keyboard('{Shift>}{F6}{/Shift}');
    expect(region().contains(document.activeElement)).toBe(false);
    expect(useToastStore.getState().paused.has('focus')).toBe(false);
    expect(useToastStore.getState().shown[0]?.remaining).toBeLessThanOrEqual(ACTION_MS);
  });

  it('dismisses with ✕; a leaving toast is inert from its first frame (A-13)', async () => {
    render(<Shell />);
    act(() => {
      toast.failure('Could not open scan.pdf: the file is damaged.');
    });
    const group = await screen.findByRole('group', {
      name: 'Could not open scan.pdf: the file is damaged.',
    });
    fireEvent.click(within(group).getByRole('button', { name: 'Dismiss' }));
    expect(shownTexts()).toEqual([]);
    expect(group).toHaveAttribute('inert');
    await waitFor(() => expect(group.isConnected).toBe(false));
  });

  it('shows a system toast with its two actions and no ✕, and "+N waiting" on the top toast', async () => {
    render(<Shell />);
    act(() => {
      toast.system('Update ready', {
        detail: 'Your documents reopen where they were.',
        action: { label: 'Reload', run: () => undefined },
        secondary: { label: 'Later', run: () => undefined },
      });
      toast.failure('a');
      toast.failure('b');
      toast.failure('c');
    });
    const update = await screen.findByRole('group', { name: 'Update ready' });
    expect(within(update).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(within(update).getByRole('button', { name: 'Later' })).toBeInTheDocument();
    expect(within(update).queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(update).toHaveTextContent('+1 waiting');
  });
});

describe('Undo toasts', () => {
  beforeEach(async () => {
    resetWorkspace();
    await useWorkspaceStore.getState().openFiles([await fixtureFile(simpleUrl, 'simple-text.pdf')]);
  });
  afterEach(() => resetWorkspace());

  const firstPage = (): PageId => {
    const ws = useWorkspaceStore.getState().workspace;
    const doc = ws.documents[ws.activeDocument as DocumentId];
    return doc?.pages[0]?.id as PageId;
  };

  it('undoes its own step, says so with the shortcut, and leaves', async () => {
    const before = useWorkspaceStore.getState().history.past.length;
    render(<Shell />);
    act(() => {
      useWorkspaceStore.getState().rotatePages([firstPage()], 90);
      toast.undo('Rotated page 1');
    });
    expect(useAnnouncer.getState().message).toMatch(
      /^Rotated page 1\. Undo with (Control|Command) Z$/,
    );
    const group = await screen.findByRole('group', { name: 'Rotated page 1' });
    fireEvent.click(within(group).getByRole('button', { name: 'Undo' }));
    expect(useWorkspaceStore.getState().history.past).toHaveLength(before);
    expect(shownTexts()).toEqual([]);
  });

  it('leaves when Mod+Z (any undo) takes its step away', () => {
    useWorkspaceStore.getState().rotatePages([firstPage()], 90);
    toast.undo('Rotated page 1');
    useWorkspaceStore.getState().undo();
    expect(shownTexts()).toEqual([]);
  });

  it('leaves when newer changes come after it, or offers History when a scrubber is there', () => {
    useWorkspaceStore.getState().rotatePages([firstPage()], 90);
    toast.undo('Rotated page 1');
    useWorkspaceStore.getState().deletePages([firstPage()]);
    expect(shownTexts()).toEqual([]);

    let opened = 0;
    setHistoryOpener(() => (opened += 1));
    toast.undo('Rotated page 1 again');
    // A different kind of step, so history does not merge it into the rotation.
    useWorkspaceStore.getState().deletePages([firstPage()]);
    const [stale] = useToastStore.getState().shown;
    expect(stale?.text).toBe('Newer changes came after this');
    expect(stale?.action?.label).toBe('History');
    stale?.action?.run();
    expect(opened).toBe(1);
  });

  it('leaves with its document when that document closes', () => {
    const ws = useWorkspaceStore.getState().workspace;
    const id = ws.activeDocument as DocumentId;
    toast.info('Text copied', { documentId: id });
    toast.info('Kept', { documentId: id, keepOnClose: true });
    useWorkspaceStore.getState().closeDocument(id);
    expect(shownTexts()).toEqual(['Kept']);
  });
});
