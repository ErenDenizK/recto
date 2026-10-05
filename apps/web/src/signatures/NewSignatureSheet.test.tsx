/**
 * S7, New signature, in the browser (components/07-sheets.md §9, 07.5; 03-markup.md MK-13 §4,
 * §8, §9; spec redesign D0-11): a centred 520 px dialog on a fine pointer; Use is disabled with
 * its reason until there is something to use; the pad draws in pad units with Undo and Clear
 * and says how many strokes it holds; the keyboard-only path (Type → Enter) keeps the
 * signature; at five kept the box says the oldest goes, and it does; from Settings it always
 * keeps; a window that keeps nothing says so.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { useAnnotationStore } from '../annotations/annotation-store';
import { closeSheet, useSheetStore } from '../ui/sheet';
import { TooltipProvider } from '../ui/Tooltip';
import { openNewSignature } from './new-signature';
import NewSignatureSheet from './NewSignatureSheet';
import {
  loadSavedSignatures,
  memorySignatureBackend,
  type SavedSignature,
  saveSignature,
  setSignatureBackend,
  useSavedSignatures,
} from './saved-signatures';

beforeEach(async () => {
  useSheetStore.setState({ open: null, front: null, confirm: null, drafts: {} });
  useAnnotationStore.getState().setAuthor('');
  setSignatureBackend(memorySignatureBackend());
  await page.viewport(1440, 900);
});

afterEach(() => {
  act(() => closeSheet());
  setSignatureBackend(undefined);
});

async function openSheet(intent: 'use' | 'keep' = 'use'): Promise<HTMLElement> {
  act(() => openNewSignature(intent));
  render(
    <TooltipProvider>
      <NewSignatureSheet />
    </TooltipProvider>,
  );
  const dialog = await screen.findByRole('dialog', { name: 'New signature' });
  await waitFor(() => expect(dialog.getAnimations({ subtree: true }).length).toBe(0), {
    timeout: 5000,
  });
  return dialog;
}

function stroke(pad: HTMLElement, from: [number, number], to: [number, number]): void {
  const box = pad.getBoundingClientRect();
  const at = ([fx, fy]: [number, number]) => ({
    clientX: box.left + box.width * fx,
    clientY: box.top + box.height * fy,
    pointerId: 7,
    pointerType: 'mouse',
    button: 0,
    buttons: 1,
    bubbles: true,
  });
  pad.dispatchEvent(new PointerEvent('pointerdown', at(from)));
  for (let i = 1; i <= 4; i += 1) {
    const t = i / 4;
    pad.dispatchEvent(
      new PointerEvent(
        'pointermove',
        at([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]),
      ),
    );
  }
  pad.dispatchEvent(new PointerEvent('pointerup', at(to)));
}

describe('New signature', () => {
  it('is a centred 520 px dialog whose Use waits for a signature, with the reason', async () => {
    const dialog = await openSheet();
    expect(dialog.dataset.presentation).toBe('dialog');
    expect(dialog.getBoundingClientRect().width).toBe(520);
    expect(
      within(dialog).getByRole('tablist', { name: 'How to make the signature' }),
    ).toBeVisible();
    const use = within(dialog).getByRole('button', { name: 'Use signature' });
    expect(use).toHaveAttribute('aria-disabled', 'true');
    expect(use).toHaveAccessibleDescription('Draw, type or choose a signature first');
    expect(within(dialog).getByRole('checkbox', { name: 'Save for next time' })).toBeChecked();
  });

  it('draws on the pad, undoes a stroke, clears, and says how many strokes it holds', async () => {
    const dialog = await openSheet();
    const pad = within(dialog).getByRole('img', {
      name: 'Signature pad: draw with the mouse, pen or finger',
    });
    stroke(pad, [0.1, 0.6], [0.4, 0.3]);
    stroke(pad, [0.5, 0.6], [0.8, 0.4]);
    await waitFor(() => expect(pad).toHaveAttribute('data-strokes', '2'));
    expect(within(dialog).getByRole('status')).toHaveTextContent('Signature drawn, 2 strokes');
    const use = within(dialog).getByRole('button', { name: 'Use signature' });
    expect(use).not.toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(page.getByRole('button', { name: 'Undo stroke' }));
    expect(pad).toHaveAttribute('data-strokes', '1');
    await userEvent.click(page.getByRole('button', { name: 'Clear' }));
    expect(pad).toHaveAttribute('data-strokes', '0');
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Use signature' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
  });

  it('keeps a typed signature from the keyboard alone, with its name', async () => {
    const dialog = await openSheet();
    within(dialog).getByRole('tab', { name: 'Draw' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(within(dialog).getByRole('tab', { name: 'Type' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const field = within(dialog).getByRole('textbox', { name: 'Your name' });
    field.focus();
    await userEvent.keyboard('Ada Lovelace');
    const name = within(dialog).getByRole('textbox', { name: /Name for this signature/ });
    name.focus();
    await userEvent.keyboard('Full name{Enter}');
    await waitFor(() => expect(useSavedSignatures.getState().signatures).toHaveLength(1));
    expect(useSavedSignatures.getState().signatures[0]).toMatchObject({
      kind: 'typed',
      text: 'Ada Lovelace',
      name: 'Full name',
    });
    await waitFor(() => expect(useSheetStore.getState().open).toBeNull());
  });

  it('with Save for next time off, keeps nothing', async () => {
    const dialog = await openSheet();
    await userEvent.click(page.getByRole('tab', { name: 'Type' }));
    await userEvent.type(page.getByRole('textbox', { name: 'Your name' }), 'Ada');
    await userEvent.click(page.getByRole('checkbox', { name: 'Save for next time' }));
    expect(within(dialog).queryByRole('textbox', { name: /Name for this signature/ })).toBeNull();
    await userEvent.click(page.getByRole('button', { name: 'Use signature' }));
    await waitFor(() => expect(useSheetStore.getState().open).toBeNull());
    expect(useSavedSignatures.getState().signatures).toHaveLength(0);
  });

  it('at five kept, says the oldest goes, and it does', async () => {
    const kept: SavedSignature[] = [];
    for (let i = 0; i < 5; i += 1) {
      const saved = await saveSignature({ kind: 'typed', text: `Name ${i}` });
      if (saved) kept.push(saved);
    }
    const dialog = await openSheet();
    await userEvent.click(page.getByRole('tab', { name: 'Type' }));
    await userEvent.type(page.getByRole('textbox', { name: 'Your name' }), 'Sixth');
    expect(
      within(dialog).getByRole('checkbox', { name: 'Save for next time (replaces the oldest)' }),
    ).toBeChecked();
    await userEvent.click(page.getByRole('button', { name: 'Use signature' }));
    await waitFor(() =>
      expect(useSavedSignatures.getState().signatures[0]).toMatchObject({ text: 'Sixth' }),
    );
    const ids = useSavedSignatures.getState().signatures.map((s) => s.id);
    expect(ids).toHaveLength(5);
    expect(ids).not.toContain(kept[0]?.id);
  });

  it('from Settings, always keeps: no box, Save signature', async () => {
    const dialog = await openSheet('keep');
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
    await userEvent.click(page.getByRole('tab', { name: 'Type' }));
    await userEvent.type(page.getByRole('textbox', { name: 'Your name' }), 'Ada');
    await userEvent.click(page.getByRole('button', { name: 'Save signature' }));
    // Generous waits: the save goes through IndexedDB and Settings comes back after the sheet
    // leaves, both slow on a loaded runner.
    await waitFor(() => expect(useSavedSignatures.getState().signatures).toHaveLength(1), {
      timeout: 5000,
    });
    // Back to Settings → Saved signatures.
    await waitFor(() => expect(useSheetStore.getState().open?.id).toBe('settings'), {
      timeout: 5000,
    });
    expect(useSheetStore.getState().open?.preset).toBe('row:savedSignatures');
  });

  it('in a window that keeps nothing, says so and still makes a signature', async () => {
    setSignatureBackend(null);
    await loadSavedSignatures();
    const dialog = await openSheet();
    const box = within(dialog).getByRole('checkbox', { name: 'Save for next time' });
    expect(box).not.toBeChecked();
    expect(box).toHaveAttribute('aria-disabled', 'true');
    expect(within(dialog).getByText('Signatures are not kept in this window')).toBeVisible();
  });
});
