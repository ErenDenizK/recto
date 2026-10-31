/**
 * The intent bar inside the palette (PRD-39, spec §2.13, §2.15, §3), Vitest browser mode: a
 * sentence shows its reading as an option named by the sentence with decorative page thumbnails,
 * two readings are stacked in a labelled group, a problem stays legible and does nothing on Enter,
 * and a reading runs only once it has been painted for exactly the typed text.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { getActiveDocument } from '@pdf-editor/document-model';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import manyUrl from '../../../../test/fixtures/many-pages.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { registerAppCommands } from '../commands/app-commands';
import { registerArrangeCommands } from '../stage/arrange-commands';
import { commandRegistry } from '../commands/registry';
import { setLocale } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { CommandPalette } from './CommandPalette';

const pages = () => getActiveDocument(useWorkspaceStore.getState().workspace)?.pages.length ?? 0;
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const combobox = () => screen.getByRole('combobox');

let dispose: () => void;
beforeEach(async () => {
  setLocale('en');
  resetWorkspace();
  await useWorkspaceStore.getState().openFiles([await fixtureFile(manyUrl, 'many.pdf')]);
  const disposers = [
    registerAppCommands(commandRegistry),
    registerArrangeCommands(commandRegistry),
  ];
  dispose = () => {
    for (const d of disposers) d();
  };
  render(<CommandPalette />);
  act(() => {
    useUiStore.setState({ paletteOpen: true });
  });
});
afterEach(() => {
  act(() => {
    useUiStore.setState({ paletteOpen: false });
  });
  dispose();
  setLocale('en');
});

describe('the intent bar in the palette', () => {
  it('names a reading by its sentence and hides the thumbnails from assistive tech', async () => {
    await userEvent.keyboard('rotate 2-3 right');
    const option = await screen.findByRole('option', { name: 'Rotate pages 2–3 right' });
    expect(option).toHaveAttribute('aria-selected', 'true');
    const strip = option.querySelector('[data-strip]');
    expect(strip).toHaveAttribute('aria-hidden', 'true');
    expect(
      [...option.querySelectorAll('[data-affected="true"]')].map((el) =>
        el.getAttribute('data-page'),
      ),
    ).toEqual(['2', '3']);
    // The unaffected neighbours are drawn dimmed, not ringed.
    expect(option.querySelectorAll('[data-affected="false"]').length).toBeGreaterThan(0);
  });

  it('shows two readings stacked in a labelled group, the first active', async () => {
    setLocale('tr');
    await userEvent.keyboard('çift sayfaları çıkar');
    const group = await screen.findByRole('group', { name: 'Bu iki türlü okunabilir' });
    const options = within(group).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps a problem legible, says why, and does nothing on Enter', async () => {
    await userEvent.keyboard('rotate 2-999 right');
    const option = await screen.findByRole('option', { name: /^Rotate pages\s+right/ });
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveAccessibleDescription(/This document has/);
    await frame();
    await frame();
    await userEvent.keyboard('{Enter}');
    expect(combobox()).toBeVisible();
    expect(pages()).toBeGreaterThan(2);
  });

  it('does not run a reading that was never painted for the typed text', async () => {
    const before = pages();
    act(() => {
      fireEvent.change(combobox(), { target: { value: 'delete 2' } });
      fireEvent.keyDown(combobox(), { key: 'Enter' });
    });
    await frame();
    expect(pages()).toBe(before);
  });

  it('runs a painted reading on Enter and closes the palette', async () => {
    const before = pages();
    await userEvent.keyboard('delete 2');
    await screen.findByRole('option', { name: 'Delete page 2' });
    await frame();
    await frame();
    await userEvent.keyboard('{Enter}');
    await expect.poll(pages).toBe(before - 1);
    await expect.poll(() => screen.queryByRole('combobox')).toBeNull();
  });

  it('runs again only after an edit has re-previewed', async () => {
    const before = pages();
    await userEvent.keyboard('delete 2');
    await screen.findByRole('option', { name: 'Delete page 2' });
    await userEvent.keyboard('0');
    act(() => {
      fireEvent.keyDown(combobox(), { key: 'Enter' });
    });
    await frame();
    expect(pages()).toBe(before);
  });

  it('says a quiet row for a word it did not understand', async () => {
    await userEvent.keyboard('rotate yamuk');
    const option = await screen.findByRole('option', { name: /Didn’t understand “yamuk”/ });
    expect(option).toHaveAttribute('aria-disabled', 'true');
  });
});
