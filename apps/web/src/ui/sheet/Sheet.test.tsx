/**
 * The Sheet primitive in a real browser (components/07-sheets.md §2.9; quality-bar Q-7): each
 * presentation per size class, focus on open and close, the trap of modal sheets and the live
 * page of tool sheets, Esc keeping the draft, Enter submitting only from the allowed controls,
 * the lock banner, one sheet at a time, the confirmation's focus and scrim, and motion by
 * transform only with the panel's size constant throughout.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { EXIT_TIMEOUT } from '../../../test/settled';
import { ConfirmHost } from './Confirm';
import type { SheetKind } from './presentation';
import { Sheet, type SheetCloseReason } from './Sheet';
import { SheetField } from './SheetField';
import { confirm, useSheetDraft, useSheetStore } from './sheet-store';

beforeEach(async () => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  await page.viewport(1440, 900);
});

afterEach(() => {
  delete document.documentElement.dataset.motion;
});

/** Waits for the panel's motion to come to rest. */
async function settle(el: Element): Promise<void> {
  await waitFor(() => expect(el.getAnimations().length).toBe(0), { timeout: 3000 });
}

function Harness({
  kind,
  id = 'sheet',
  title = 'Page numbers',
  initialOpen = true,
  onClose,
  onApply,
  locked,
  withTextArea = false,
}: {
  readonly kind: SheetKind;
  readonly id?: string;
  readonly title?: string;
  readonly initialOpen?: boolean;
  readonly onClose?: (reason: SheetCloseReason) => void;
  readonly onApply?: () => void;
  readonly locked?: { name: string; onUnlock: () => void };
  readonly withTextArea?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [start, setStart] = useSheetDraft('page-numbers', 'doc-a', '1');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open {title}
      </button>
      <button type="button">On the page</button>
      <Sheet
        id={id}
        kind={kind}
        open={open}
        onClose={(reason) => {
          onClose?.(reason);
          setOpen(false);
        }}
        title={title}
        primary={{ label: 'Apply', onPress: () => onApply?.() }}
        locked={locked}
        testId={`sheet-${id}`}
      >
        <SheetField label="Start at" value={start} onChange={(e) => setStart(e.target.value)} />
        {withTextArea ? <textarea aria-label="Note" /> : null}
      </Sheet>
    </>
  );
}

const panelOf = (id = 'sheet') => screen.getByTestId(`sheet-${id}`);

describe('presentation per kind and size class (07 §1.1)', () => {
  it('a task sheet is a 400 px side sheet at 1440 × 900, 8 px from the trailing edge', async () => {
    render(<Harness kind="task" />);
    const panel = panelOf();
    expect(panel.dataset.presentation).toBe('side');
    await settle(panel);
    const box = panel.getBoundingClientRect();
    expect(box.width).toBe(400);
    expect(innerWidth - box.right).toBe(8);
    expect(innerHeight - box.bottom).toBe(8);
    expect(document.querySelector('[data-presentation][class*="scrim"]')).not.toBeNull();
    expect(getComputedStyle(panel).backdropFilter).toContain('blur(24px)');
  });

  it('a tool sheet is a side sheet with no scrim, and the page stays live', async () => {
    const onClose = vi.fn();
    render(<Harness kind="tool" onClose={onClose} />);
    const panel = panelOf();
    expect(panel.dataset.presentation).toBe('side');
    expect(document.querySelector('[class*="scrim"]')).toBeNull();
    await settle(panel);
    // A press on the page does not close it, and the page's control takes the press.
    await userEvent.click(screen.getByRole('button', { name: 'On the page' }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'On the page' })).toHaveFocus();
    expect(panel).toBeVisible();
  });

  it('a task sheet is a form sheet at 820 × 1180 (medium)', async () => {
    await page.viewport(820, 1180);
    render(<Harness kind="task" />);
    const panel = panelOf();
    expect(panel.dataset.presentation).toBe('form');
    await settle(panel);
    const box = panel.getBoundingClientRect();
    expect(box.width).toBe(640);
    expect(Math.abs(box.left + box.width / 2 - innerWidth / 2)).toBeLessThanOrEqual(0.5);
  });

  it('a tool sheet is a bottom sheet at 390 × 844, resting at its 40 % detent', async () => {
    await page.viewport(390, 844);
    render(<Harness kind="tool" />);
    const panel = panelOf();
    expect(panel.dataset.presentation).toBe('bottom');
    await settle(panel);
    const box = panel.getBoundingClientRect();
    // 40 % of the window shows above its bottom edge (the panel reaches 48 px below it).
    expect(Math.round(innerHeight - box.top)).toBe(Math.round(0.4 * innerHeight));
    expect(panel.style.transform).toBe('');
    expect(Number.isInteger(Number.parseFloat(panel.style.getPropertyValue('--sheet-y')))).toBe(
      true,
    );
  });

  it('a task sheet is a full sheet on a compact-height window', async () => {
    await page.viewport(800, 420);
    render(<Harness kind="task" />);
    expect(panelOf().dataset.presentation).toBe('full');
  });

  it('a confirmation is a centred 400 px alertdialog, and a bottom sheet at 390 px', async () => {
    const view = render(<Harness kind="confirmation" />);
    expect(screen.getByRole('alertdialog')).toBe(panelOf());
    expect(panelOf().dataset.presentation).toBe('dialog');
    await settle(panelOf());
    expect(panelOf().getBoundingClientRect().width).toBe(400);
    view.unmount();
    await page.viewport(390, 844);
    render(<Harness kind="confirmation" />);
    expect(panelOf().dataset.presentation).toBe('bottom');
  });

  it('re-presents at once when the window crosses a class, keeping focus', async () => {
    render(<Harness kind="task" />);
    const panel = panelOf();
    await settle(panel);
    const field = screen.getByRole('textbox', { name: 'Start at' });
    field.focus();
    await page.viewport(820, 1180);
    await waitFor(() => expect(panel.dataset.presentation).toBe('form'));
    expect(panelOf()).toBe(panel);
    expect(field).toHaveFocus();
  });
});

describe('focus, keys and drafts (07 §2.6)', () => {
  it('focuses the first control on open and returns to the invoker on close', async () => {
    render(<Harness kind="task" initialOpen={false} />);
    const opener = screen.getByRole('button', { name: 'Open Page numbers' });
    await userEvent.click(opener);
    const panel = panelOf();
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    await userEvent.keyboard('{Escape}');
    // Focus returns once the exit has run and the panel has gone.
    await waitFor(() => expect(opener).toHaveFocus(), { timeout: EXIT_TIMEOUT });
  });

  it('traps Tab in a modal sheet', async () => {
    render(<Harness kind="task" />);
    const panel = panelOf();
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    for (let i = 0; i < 8; i++) {
      await userEvent.keyboard('{Tab}');
      // A Tab past either end lands on Base UI's focus guard, which hands focus back into the
      // panel from its own focus handler; a loaded runner can ask in between.
      await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    }
  });

  it('does not trap Tab in a tool sheet', async () => {
    render(<Harness kind="tool" />);
    const panel = panelOf();
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    let left = false;
    for (let i = 0; i < 10 && !left; i++) {
      await userEvent.keyboard('{Tab}');
      left = !panel.contains(document.activeElement);
    }
    expect(left).toBe(true);
    expect(panel).toHaveAttribute('role', 'dialog');
  });

  it('Esc closes and keeps what was typed for the next open', async () => {
    const onClose = vi.fn();
    render(<Harness kind="task" onClose={onClose} initialOpen={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open Page numbers' }));
    const field = await screen.findByRole('textbox', { name: 'Start at' });
    await userEvent.clear(field);
    await userEvent.type(field, '7');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledWith('escape');
    await waitFor(() => expect(screen.queryByTestId('sheet-sheet')).toBeNull(), {
      timeout: EXIT_TIMEOUT,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Open Page numbers' }));
    expect(await screen.findByRole('textbox', { name: 'Start at' })).toHaveValue('7');
  });

  it('✕ closes with its reason; Cancel with its own', async () => {
    const onClose = vi.fn();
    const view = render(<Harness kind="task" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenLastCalledWith('close');
    view.unmount();
    render(<Harness kind="task" onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenLastCalledWith('cancel');
  });

  it('Enter in a single-line field runs the primary; in a text area it does not', async () => {
    const onApply = vi.fn();
    render(<Harness kind="task" onApply={onApply} withTextArea />);
    const field = await screen.findByRole('textbox', { name: 'Start at' });
    await userEvent.click(field);
    await userEvent.keyboard('{Enter}');
    expect(onApply).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('textbox', { name: 'Note' }));
    await userEvent.keyboard('{Enter}');
    expect(onApply).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledTimes(2);
  });

  it('a locked document shows the banner; the primary reads Locked and offers to unlock', async () => {
    const onUnlock = vi.fn();
    const onApply = vi.fn();
    render(<Harness kind="task" onApply={onApply} locked={{ name: 'report.pdf', onUnlock }} />);
    expect(screen.getByTestId('sheet-lock-banner')).toHaveTextContent('report.pdf is locked');
    const primary = screen.getByRole('button', { name: 'Locked' });
    await userEvent.click(primary);
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(onUnlock).toHaveBeenCalledTimes(2);
  });

  it('one sheet at a time: a second sheet closes the first', async () => {
    const onCloseFirst = vi.fn();
    render(
      <>
        <Harness kind="task" id="first" title="First" onClose={onCloseFirst} />
        <Harness kind="settings" id="second" title="Second" initialOpen={false} />
      </>,
    );
    await settle(panelOf('first'));
    // The second opens from a command (the page is inert under the first).
    act(() => screen.getByRole('button', { name: 'Open Second', hidden: true }).click());
    await waitFor(() => expect(onCloseFirst).toHaveBeenCalledWith('replaced'));
  });
});

describe('Confirm (07 §3)', () => {
  it('focuses the action when undoable, Cancel otherwise; the scrim ignores presses', async () => {
    render(<ConfirmHost />);
    let answer: Promise<boolean> = Promise.resolve(false);
    act(() => {
      answer = confirm({
        title: 'Revert to the opened version?',
        body: 'Your 14 changes since opening go. Undo brings them back.',
        action: 'Revert',
        danger: true,
        glyph: 'revert',
        undoable: true,
      });
    });
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Revert to the opened version?',
    });
    expect(dialog).toHaveAccessibleDescription(
      'Your 14 changes since opening go. Undo brings them back.',
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Revert' })).toHaveFocus(), {
      timeout: 3000,
    });
    // A destructive action carries its glyph, not colour alone (07 §3.8, A-19).
    expect(screen.getByRole('button', { name: 'Revert' }).querySelector('svg')).not.toBeNull();
    // A press on the scrim answers nothing, and starts no exit. The dialog fades in from
    // opacity 0 and the focus lands before its first frame, so a slow runner could take the
    // press (and the visibility check) while it is still transparent: let the entrance end.
    await settle(dialog);
    await userEvent.click(document.body, { position: { x: 10, y: 10 }, force: true });
    expect(screen.getByRole('alertdialog')).toBeVisible();
    expect(dialog.getAnimations()).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Revert' }));
    await expect(answer).resolves.toBe(true);

    act(() => {
      answer = confirm({
        title: 'Clear 3 kept documents?',
        body: 'Their changes are removed from this device.',
        action: 'Clear',
        danger: true,
      });
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus(), {
      timeout: 3000,
    });
    expect(screen.getByRole('button', { name: 'Clear' }).querySelector('svg')).not.toBeNull();
    await userEvent.keyboard('{Escape}');
    await expect(answer).resolves.toBe(false);
  });
});

describe('motion (quality-bar Q-7)', () => {
  /**
   * Records the properties of every Web Animation started on a sheet panel, whenever it runs
   * (a busy browser may finish a short motion before a test looks).
   */
  function recordAnimated(): { props: Set<string>; restore: () => void } {
    const props = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called with its element below
    const original = Element.prototype.animate;
    const spy = vi.spyOn(Element.prototype, 'animate').mockImplementation(function (
      this: Element,
      frames,
      options,
    ) {
      if (
        this instanceof HTMLElement &&
        this.dataset.sheet !== undefined &&
        Array.isArray(frames)
      ) {
        for (const frame of frames) {
          for (const key of Object.keys(frame)) {
            if (!['offset', 'easing', 'composite'].includes(key)) props.add(key);
          }
        }
      }
      return original.call(this, frames, options);
    });
    return { props, restore: () => spy.mockRestore() };
  }

  it('opens by transform only, with the panel at its final size every frame', async () => {
    const animated = recordAnimated();
    try {
      render(<Harness kind="task" initialOpen={false} />);
      // fireEvent clicks synchronously (inside act), so the panel mounts before any frame.
      fireEvent.click(screen.getByRole('button', { name: 'Open Page numbers' }));
      const panel = await screen.findByTestId('sheet-sheet');
      const sizes = new Set<string>();
      do {
        sizes.add(`${panel.offsetWidth}×${panel.offsetHeight}`);
        await new Promise((r) => requestAnimationFrame(r));
      } while (panel.getAnimations().length > 0);
      expect([...animated.props].sort()).toEqual(['opacity', 'transform']);
      expect(sizes.size).toBe(1);
      // At rest: no transform or will-change left inline (Q-2).
      expect(panel.style.transform).toBe('');
      expect(panel.style.willChange).toBe('');
    } finally {
      animated.restore();
    }
  });

  it('under reduced motion only fades', async () => {
    document.documentElement.dataset.motion = 'reduced';
    await page.viewport(390, 844);
    const animated = recordAnimated();
    try {
      render(<Harness kind="tool" initialOpen={false} />);
      // fireEvent clicks synchronously (inside act), so the panel mounts before any frame.
      fireEvent.click(screen.getByRole('button', { name: 'Open Page numbers' }));
      const panel = await screen.findByTestId('sheet-sheet');
      await settle(panel);
      expect([...animated.props]).toEqual(['opacity']);
    } finally {
      animated.restore();
    }
  });

  it('the exiting panel is inert from its first frame (A-13)', async () => {
    render(<Harness kind="task" />);
    const panel = panelOf();
    await settle(panel);
    await userEvent.keyboard('{Escape}');
    expect(panel).toHaveAttribute('inert');
  });
});
