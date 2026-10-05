/**
 * ↶ ↷ and the History scrubber (01-frame F3; 08-feedback FB7; spec redesign D0-6), mounted in
 * Vitest browser mode on the real workspace store: tooltips that name the step, disabled
 * states that stay focusable, one press per step, and the scrubber opened by right-click,
 * Shift+F10 or a held press, then driven by the keys (preview, keep, restore).
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import {
  addSource,
  createHistory,
  createSequentialIdGenerator,
  createWorkspace,
  type DocumentId,
  type History,
  historyMetaOf,
  pushHistory,
  rotatePages,
  type SourceInput,
  type Workspace,
} from '@pdf-editor/document-model';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { registerAppCommands } from '../../commands/app-commands';
import { closeHistoryScrubber, useHistoryScrubber } from '../../history/scrubber-store';
import { setLocale } from '../../i18n';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { resetToasts, useToastStore } from '../../ui/Toast';
import { TooltipProvider } from '../../ui/Tooltip';
import { useAnnouncer } from '../announcer';
import { UndoRedo } from './UndoRedo';

registerAppCommands();

const ids = createSequentialIdGenerator('u');

function source(name: string, pageCount: number): SourceInput {
  return {
    name,
    byteLength: 1000,
    pageCount,
    pages: Array.from({ length: pageCount }, () => ({
      size: { width: 612, height: 792 },
      rotation: 0 as const,
    })),
    fingerprint: `fp-${name}`,
    flags: {
      encrypted: false,
      repaired: false,
      hasAcroForm: false,
      hasXfa: false,
      hasSignatures: false,
      tagged: false,
      linearized: false,
    },
    metadata: { policy: 'explicit' },
    outline: [],
  };
}

/** "Open report.pdf", then `steps` rotations of pages 1, 2, 3, … as the store records them. */
function history(steps: number): { history: History; doc: DocumentId } {
  const opened = addSource(createWorkspace(), source('report.pdf', 6), ids);
  const doc = opened.documentId;
  let h = createHistory(createWorkspace(), 'Start', 0);
  const push = (next: Workspace, label: string, now: number) => {
    h = pushHistory(h, next, label, { now, meta: historyMetaOf(h.present.workspace, next) });
  };
  push({ ...opened.workspace, activeDocument: doc }, 'Open report.pdf', 1);
  for (let i = 0; i < steps; i++) {
    const ws = h.present.workspace;
    const page = ws.documents[doc]?.pages[i % 6]?.id;
    if (!page) throw new Error('no page');
    push(rotatePages(ws, [page], 90), `Rotate ${i + 1}`, 1000 + i);
  }
  return { history: h, doc };
}

function mount(steps: number) {
  const made = history(steps);
  act(() => useWorkspaceStore.getState().replaceHistory(made.history));
  render(
    <TooltipProvider>
      <UndoRedo />
    </TooltipProvider>,
  );
  return {
    ...made,
    undo: screen.getByRole('button', { name: 'Undo' }),
    redo: screen.getByRole('button', { name: 'Redo' }),
  };
}

const presentIndex = () => useWorkspaceStore.getState().history.past.length;
const scrubber = () => screen.queryByTestId('history-scrubber');
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  resetWorkspace();
  resetToasts();
  useAnnouncer.setState({ message: '' } as never);
});

afterEach(() => {
  closeHistoryScrubber();
  cleanup();
  setLocale('en');
});

describe('↶ ↷ (01-frame F3)', () => {
  it('names the step in the description and stays focusable when there is nothing to do', () => {
    const { undo, redo } = mount(2);
    expect(undo).not.toHaveAttribute('aria-disabled');
    expect(redo).toHaveAttribute('aria-disabled', 'true');
    expect(undo).toHaveAccessibleDescription(
      'Undo rotate 2 on page 2. Right-click or hold for history',
    );
    expect(redo).toHaveAccessibleDescription('Nothing to redo');
    expect(undo).toHaveAttribute('aria-keyshortcuts');
    redo.focus();
    expect(document.activeElement).toBe(redo);
  });

  it('one press undoes one step, says it, and keeps the focus; ↷ redoes it', async () => {
    const { undo, redo } = mount(2);
    await userEvent.click(undo);
    expect(presentIndex()).toBe(2);
    expect(useAnnouncer.getState().message).toBe('Undid rotate 2 on page 2');
    expect(document.activeElement).toBe(undo);
    expect(redo).not.toHaveAttribute('aria-disabled');
    await userEvent.click(redo);
    expect(presentIndex()).toBe(3);
    expect(useAnnouncer.getState().message).toBe('Redid rotate 2 on page 2');
  });

  it('a disabled press does nothing', () => {
    const { redo } = mount(1);
    // Playwright will not click an aria-disabled control; a script click still reaches it.
    act(() => redo.click());
    expect(presentIndex()).toBe(2);
  });

  it('a step in another document is named in a toast, and the tabs stay (flows.md §5.3)', async () => {
    // report and agreement open, agreement active; the last step rotated a page of report.
    const report = addSource(createWorkspace(), source('report.pdf', 3), ids);
    const both = addSource(report.workspace, source('agreement.pdf', 2), ids);
    const ws = { ...both.workspace, activeDocument: both.documentId };
    const page = ws.documents[report.documentId]?.pages[0]?.id;
    if (!page) throw new Error('no page');
    const rotated = rotatePages(ws, [page], 90);
    let h = createHistory(ws, 'Open', 0);
    h = pushHistory(h, rotated, 'Rotate 1 page', { now: 1, meta: historyMetaOf(ws, rotated) });
    act(() => useWorkspaceStore.getState().replaceHistory(h));
    render(<UndoRedo />);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    const [shown] = useToastStore.getState().shown;
    expect(shown?.text).toBe('Undid rotate 1 page in report');
    expect(shown?.action?.label).toBe('Show');
    expect(useWorkspaceStore.getState().workspace.activeDocument).toBe(both.documentId);
    act(() => shown?.action?.run());
    expect(useWorkspaceStore.getState().workspace.activeDocument).toBe(report.documentId);
  });

  it('says it in Turkish', () => {
    setLocale('tr');
    const { history: h } = history(1);
    act(() => useWorkspaceStore.getState().replaceHistory(h));
    render(<UndoRedo />);
    const undo = screen.getByRole('button', { name: 'Geri al' });
    expect(undo).toHaveAccessibleDescription(
      'Geri al: 1. sayfadaki rotate 1. Geçmiş için sağ tıklayın ya da basılı tutun',
    );
  });
});

describe('the History scrubber (08-feedback FB7)', () => {
  it('opens on a right-click as a list, newest first, the current step checked', async () => {
    const { undo } = mount(3);
    await userEvent.click(undo, { button: 'right' });
    await waitFor(() => expect(scrubber()).toBeVisible());
    expect(scrubber()).toHaveAttribute('data-presentation', 'list');
    const options = screen.getAllByRole('option');
    // The empty start is left out: the opening, said in the past tense (FB7 §5), then three
    // rotations.
    expect(options.map((o) => o.getAttribute('aria-label')?.split(',')[0])).toEqual([
      'Rotate 3',
      'Rotate 2',
      'Rotate 1',
      'Opened report.pdf',
    ]);
    expect(options[0]).toHaveAttribute('aria-current', 'step');
    expect(options[0]).toHaveAccessibleName(/^Rotate 3, page 3, \d\d[:.]\d\d$/);
    // Every step is in the same minute: the time shows once, at the top of the run; each
    // option's name still says it.
    expect(options.map((o) => o.firstElementChild?.textContent)).toEqual([
      expect.stringMatching(/^\d\d[:.]\d\d$/),
      '',
      '',
      '',
    ]);
    expect(options[3]).toHaveAccessibleName(/^Opened report\.pdf, \d\d[:.]\d\d$/);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('listbox')));
    expect(undo).toHaveAttribute('aria-expanded', 'true');
  });

  it('dims the undone (future) steps against the past ones', async () => {
    const { undo } = mount(3);
    act(() => {
      useWorkspaceStore.getState().undo();
    });
    await userEvent.click(undo, { button: 'right' });
    await waitFor(() => expect(scrubber()).toBeVisible());
    const [future, present, past] = screen.getAllByRole('option');
    if (!future || !present || !past) throw new Error('no rows');
    expect(future).toHaveAttribute('data-state', 'future');
    expect(past).toHaveAttribute('data-state', 'past');
    const color = (row: HTMLElement) => getComputedStyle(row).color;
    expect(color(future)).not.toBe(color(past));
    expect(color(past)).toBe(color(present));
  });

  it('Shift+F10 opens it; ↓ previews older steps, Enter keeps, focus returns to ↶', async () => {
    const { undo } = mount(3);
    undo.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('listbox')));
    await userEvent.keyboard('{ArrowDown}');
    // The first move previews at once.
    await waitFor(() => expect(presentIndex()).toBe(3));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(presentIndex()).toBe(2));
    expect(screen.getByRole('heading', { name: 'Previewing step 2' })).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(scrubber()).toBeNull());
    expect(presentIndex()).toBe(2);
    expect(useAnnouncer.getState().message).toBe('Now at step 3 of 5: rotate 1 on page 1');
    await waitFor(() => expect(document.activeElement).toBe(undo));
  });

  it('Esc restores the step it opened at, after any number of previews', async () => {
    const { undo } = mount(4);
    undo.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('listbox')));
    await userEvent.keyboard('{End}');
    await pause(150);
    expect(presentIndex()).toBe(1);
    await userEvent.keyboard('{Home}{ArrowDown}{ArrowDown}');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(scrubber()).toBeNull());
    await pause(150);
    expect(presentIndex()).toBe(5);
    await waitFor(() => expect(document.activeElement).toBe(undo));
  });

  it('a click on a row keeps it', async () => {
    const { undo } = mount(3);
    await userEvent.click(undo, { button: 'right' });
    await waitFor(() => expect(scrubber()).toBeVisible());
    await userEvent.click(screen.getAllByRole('option')[3] as HTMLElement);
    await waitFor(() => expect(scrubber()).toBeNull());
    expect(presentIndex()).toBe(1);
  });

  it('a held mouse press opens it and does not undo', async () => {
    const { undo } = mount(2);
    const box = undo.getBoundingClientRect();
    const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    const init = {
      ...at,
      bubbles: true,
      pointerId: 7,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
    };
    act(() => {
      undo.dispatchEvent(new PointerEvent('pointerdown', init));
    });
    await pause(520);
    expect(useHistoryScrubber.getState().opening).not.toBeNull();
    act(() => {
      undo.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
      undo.dispatchEvent(new MouseEvent('click', { ...at, bubbles: true }));
    });
    expect(presentIndex()).toBe(3);
    await waitFor(() => expect(scrubber()).toBeVisible());
  });

  it('with only the opening, the scrubber says there is nothing to go back to', async () => {
    const { undo } = mount(0);
    await userEvent.click(undo, { button: 'right' });
    await waitFor(() => expect(scrubber()).toBeVisible());
    expect(screen.getByText('Nothing to undo yet.')).toBeVisible();
  });
});
