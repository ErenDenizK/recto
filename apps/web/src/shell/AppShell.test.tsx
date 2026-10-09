import {
  addSource,
  createHistory,
  createSequentialIdGenerator,
  createWorkspace,
} from '@pdf-editor/document-model';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { settled } from '../../test/settled';
import { App } from '../app';
import { currentPlatform } from '../commands/shortcuts';
import { stageView, useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';

const MOD = currentPlatform === 'mac' ? 'Meta' : 'Control';

describe('AppShell', () => {
  beforeEach(async () => {
    // The strip and its tabs from the medium class up (01-frame F2); narrower is the compact bar.
    await page.viewport(1440, 900);
    useUiStore.setState({
      // A test that runs "Arrange pages" must not leave the next one in Arrange.
      docUi: {},
      paletteOpen: false,
      shortcutsOpen: false,
      recents: [],
    });
    resetWorkspace();
  });

  it('renders the shell with the empty state and the privacy shield', () => {
    render(<App />);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Read, mark up, sign and arrange PDFs.' }),
    ).toBeVisible();
    // On the Library the footer's chip is the privacy shield (02-library L12); the strip's
    // trailing piece holds only ⋯ there (01-frame R11), and ◎ returns with a document.
    expect(screen.getByRole('button', { name: 'Nothing is uploaded' })).toBeVisible();
    expect(screen.getByTestId('library-privacy')).toHaveTextContent('Nothing is uploaded');
    expect(
      screen.queryByRole('button', { name: 'Privacy: nothing has left this device' }),
    ).toBeNull();
    // No dock on the Library with no file open: the launcher holds the actions.
    expect(document.querySelector('[data-region="toolbar"]')).toBeNull();
  });

  it('opens the command palette on Mod+K with focus in the input, and closes on Esc', async () => {
    render(<App />);
    await userEvent.keyboard(`{${MOD}>}k{/${MOD}}`);
    const input = await screen.findByRole('combobox', { name: 'Search commands' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    expect(screen.getByRole('option', { name: /Toggle left panel/ })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: 'Search commands' })).not.toBeInTheDocument();
      // The backdrop must unmount too, or it would swallow every click afterwards.
      expect(document.querySelector('[data-base-ui-portal]')).toBeNull();
    });
  });

  it('filters palette results and runs the active command with Enter', async () => {
    render(<App />);
    await userEvent.keyboard(`{${MOD}>}k{/${MOD}}`);
    const input = await screen.findByRole('combobox', { name: 'Search commands' });
    await userEvent.type(input, 'arrange');
    await waitFor(() => {
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('Pages grid');
    });
    await userEvent.keyboard('{Enter}');
    // With no document open there is no grid to show (the surface belongs to a document,
    // redesign spec §7): the command is not available, and the stage keeps its empty state.
    expect(useUiStore.getState().recents).not.toContain('mode.arrange');
    expect(stageView(useUiStore.getState())).toBe('page');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('combobox', { name: 'Search commands' })).toBeNull();
    });
    expect(
      screen.getByRole('heading', { name: 'Read, mark up, sign and arrange PDFs.' }),
    ).toBeVisible();
  });

  it('opens documents as tabs', async () => {
    render(<App />);
    // A model-only source (never opened by the engine): the shell must still show the tab,
    // and its pages fail to render quietly.
    const { workspace } = addSource(
      createWorkspace(),
      {
        name: 'report.pdf',
        byteLength: 4,
        pageCount: 1,
        pages: [{ size: { width: 612, height: 792 }, rotation: 0 }],
        fingerprint: 'test',
        flags: {
          encrypted: false,
          repaired: false,
          hasAcroForm: false,
          hasXfa: false,
          hasSignatures: false,
          tagged: false,
          linearized: false,
        },
        metadata: { policy: 'inherit-first-source' },
        outline: [],
      },
      createSequentialIdGenerator('test'),
    );
    useWorkspaceStore.setState({ history: createHistory(workspace), workspace });
    expect(await screen.findByRole('tab', { name: 'report', selected: true })).toBeVisible();
    // The dock (01-frame F10) rests in the capsule once a document is open: it fades in as
    // the capsule morphs to hold it, so it is asked about once that has run.
    expect(await settled(screen.getByRole('toolbar', { name: 'Document tools' }))).toBeVisible();
  });
});
