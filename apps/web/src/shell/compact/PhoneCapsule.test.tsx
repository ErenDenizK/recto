/**
 * The single capsule on the static path (PhoneCapsule.tsx, EDN-24): with the switch off the
 * shipped capsule's DOM is unchanged (the round ✎ and the "Pages" and "Find" words), and with
 * `?phonebar=1` the reading capsule is the icon capsule, ✎ morphs it into the editing tools with
 * the tray opening from a tool, Done brings the reading content back and focus returns to ✎.
 */
import '../../styles/tokens.css';
import '../../styles/reset.css';
import '../../styles/global.css';

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import simpleUrl from '../../../../../test/fixtures/simple-text.pdf?url';
import { resetWorkspace } from '../../state/workspace-store';
import { settled } from '../../../test/settled';
import { CompactApp } from './CompactApp';
import { openPdf } from './compact-actions';
import { resetCompactStore } from './compact-store';
import { resetPhoneCapsule } from './phone-capsule-flag';

async function open(search: string): Promise<void> {
  window.history.replaceState(null, '', `/${search}`);
  resetPhoneCapsule();
  const bytes = await (await fetch(simpleUrl)).arrayBuffer();
  render(<CompactApp />);
  await openPdf(new File([bytes], 'simple-text.pdf', { type: 'application/pdf' }));
  await screen.findByTestId('compact-reader');
}

beforeEach(() => {
  resetWorkspace();
  resetCompactStore();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  resetPhoneCapsule();
});

describe('with the switch off', () => {
  it('keeps the shipped capsule: the ✎ circle beside it, "Pages" and "Find" as words', async () => {
    await open('');
    const capsule = screen.getByTestId('compact-capsule');
    expect(screen.getByTestId('compact-edit')).toBeVisible();
    expect(screen.queryByTestId('compact-capsule-edit')).toBeNull();
    expect(within(capsule).getByText('Pages')).toBeVisible();
    expect(within(capsule).getByText('Find')).toBeVisible();
    expect(capsule).toHaveAccessibleName('Pages and find');
  });
});

describe('with ?phonebar=1', () => {
  it('reads as the icon capsule with ✎ inside it', async () => {
    await open('?phonebar=1');
    // The host loads lazily (PF-23): wait for it.
    await screen.findByTestId('compact-capsule-edit', {}, { timeout: 10_000 });
    const capsule = screen.getByTestId('compact-capsule');
    expect(capsule).toHaveAccessibleName('Reading tools');
    expect(screen.queryByTestId('compact-edit')).toBeNull();
    expect(within(capsule).queryByText('Pages')).toBeNull();
    expect(within(capsule).getByRole('button', { name: 'Pages' })).toBeVisible();
    expect(within(capsule).getByRole('button', { name: 'Find' })).toBeVisible();
    expect(screen.getByTestId('compact-page-number')).toHaveTextContent('1 / 3');
    expect(within(capsule).getByTestId('compact-capsule-edit')).toBeVisible();
  });

  it('morphs into the tools with a tray, and Done gives focus back to ✎', async () => {
    await open('?phonebar=1');
    await userEvent.click(
      await screen.findByTestId('compact-capsule-edit', {}, { timeout: 10_000 }),
    );
    const pen = await screen.findByTestId('compact-capsule-tool-pen', {}, { timeout: 10_000 });
    const capsule = screen.getByTestId('compact-capsule');
    expect(capsule).toHaveAccessibleName('Editing tools');
    expect(capsule).toContainElement(pen);
    await waitFor(() => expect(pen).toHaveFocus());
    expect(screen.queryByTestId('compact-tool-tray')).toBeNull();
    await userEvent.click(pen);
    await settled(await screen.findByTestId('compact-tool-tray'));
    expect(pen).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByTestId('compact-edit-done'));
    const edit = await screen.findByTestId('compact-capsule-edit');
    await waitFor(() => expect(edit).toHaveFocus());
  });

  it('has no tool drawer, whatever ?drawer asks', async () => {
    await open('?phonebar=1&drawer=list');
    await userEvent.click(screen.getByTestId('compact-capsule-edit'));
    await screen.findByTestId('compact-capsule-tool-pen', {}, { timeout: 10_000 });
    expect(screen.queryByTestId('compact-tool-more')).toBeNull();
    expect(screen.queryByTestId('compact-tool-list')).toBeNull();
  });
});
