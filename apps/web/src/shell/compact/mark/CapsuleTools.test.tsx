/**
 * The single capsule's editing content and the Redo chip (CapsuleTools.tsx, RedoChip.tsx; EDN-24):
 * four tools and no Edit text, the pressed tool's states, the tap rule through the store, Undo at
 * the editing floor, the tray opener, 44 px targets, the capsule's width, and the chip's arrival,
 * departure and focus hand-off.
 */
import '../../../styles/tokens.css';
import '../../../styles/reset.css';
import '../../../styles/global.css';

import type { History } from '@pdf-editor/document-model';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import simpleUrl from '../../../../../../test/fixtures/simple-text.pdf?url';
import { settled } from '../../../../test/settled';
import { resetWorkspace, useWorkspaceStore } from '../../../state/workspace-store';
import { resetToolStore } from '../../../viewer/tool-store';
import { fixtureFile } from '../../../../test/store-harness';
import { openPdf } from '../compact-actions';
import { resetCompactStore, setCompactTool, showLibrary, useCompactStore } from '../compact-store';
import { enterEditing, exitEditing, resetBridge, toggleEraser } from './bridge';
import { CapsuleTools } from './CapsuleTools';
import { RedoChip } from './RedoChip';
import './tools';

const compact = () => useCompactStore.getState();
const tool = (id: string) => screen.getByTestId(`compact-capsule-tool-${id}`);

/** A history with `past` steps behind the present and `future` ahead of it. */
function historyOf(past: number, future = 0): History {
  const entry = useWorkspaceStore.getState().history.present;
  return {
    past: Array.from({ length: past }, () => entry),
    present: entry,
    future: Array.from({ length: future }, () => entry),
  };
}

/** The capsule's row as the host styles it: 2 px gap, 6 px padding, 2 px border. */
function Capsule() {
  return (
    <nav
      data-testid="capsule"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 6px',
        border: '1px solid transparent',
        width: 'max-content',
      }}
    >
      <CapsuleTools />
    </nav>
  );
}

beforeEach(async () => {
  resetWorkspace();
  resetCompactStore();
  resetToolStore();
  resetBridge();
  expect(await openPdf(await fixtureFile(simpleUrl, 'simple-text.pdf'))).toBe(true);
  enterEditing();
});

afterEach(() => {
  cleanup();
  exitEditing();
  showLibrary();
});

describe('the capsule tools', () => {
  it('shows Undo, Pen, Highlight, Text, Sign and Done, and no Edit text', () => {
    render(<Capsule />);
    expect(screen.getByRole('group', { name: 'Tools' })).toBeTruthy();
    for (const id of ['pen', 'highlight', 'text', 'sign']) expect(tool(id)).toBeTruthy();
    expect(screen.queryByTestId('compact-capsule-tool-edit-text')).toBeNull();
    expect(screen.getByTestId('compact-undo')).toBeTruthy();
    expect(screen.getByTestId('compact-edit-done').getAttribute('aria-label')).toBe('Done');
  });

  it('presses the armed tool, with the tray state and the flight marker on it alone', () => {
    render(<Capsule />);
    expect(tool('pen').getAttribute('aria-pressed')).toBe('false');
    act(() => setCompactTool('highlight'));
    expect(tool('highlight').getAttribute('aria-pressed')).toBe('true');
    // A tool going from off to on opens its tray (the opener).
    expect(tool('highlight').getAttribute('aria-expanded')).toBe('true');
    act(() => useCompactStore.setState({ trayOpen: false }));
    expect(tool('highlight').getAttribute('aria-expanded')).toBe('false');
    expect(tool('highlight').getAttribute('aria-controls')).toBe('compact-tool-tray');
    expect(tool('highlight').hasAttribute('data-compact-tool-chip')).toBe(true);
    expect(document.querySelectorAll('[data-compact-tool-chip]')).toHaveLength(1);
    expect(tool('pen').hasAttribute('aria-expanded')).toBe(false);
  });

  it('keeps the tool pressed under the Eraser, and Text pressed under Edit text', () => {
    render(<Capsule />);
    act(() => setCompactTool('highlight'));
    act(() => toggleEraser());
    expect(compact().tool).toBe('eraser');
    expect(tool('highlight').getAttribute('aria-pressed')).toBe('true');
    act(() => setCompactTool('edit-text'));
    expect(tool('text').getAttribute('aria-pressed')).toBe('true');
  });

  it('arms on a tap and opens the tray, then the pressed tool turns the tool off', () => {
    render(<Capsule />);
    fireEvent.click(tool('pen'));
    expect(compact()).toMatchObject({ tool: 'pen', trayOpen: true });
    expect(tool('pen').getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(tool('text'));
    expect(compact()).toMatchObject({ tool: 'text', trayOpen: true });
    fireEvent.click(tool('text'));
    expect(compact()).toMatchObject({ tool: null, trayOpen: false });
    expect(tool('text').getAttribute('aria-pressed')).toBe('false');
  });

  it('slides one wash to the pressed tool by index, and leaves it under the last one when off', () => {
    render(<Capsule />);
    const group = screen.getByRole('group', { name: 'Tools' });
    fireEvent.click(tool('sign'));
    expect(group.dataset.index).toBe('3');
    expect(group.hasAttribute('data-armed')).toBe(true);
    fireEvent.click(tool('sign'));
    expect(group.dataset.index).toBe('3');
    expect(group.hasAttribute('data-armed')).toBe(false);
    // Transform only, and nothing inline at rest (Q-2, MOT-14).
    const wash = screen.getByTestId('compact-capsule-wash');
    expect(wash.getAttribute('style')).toBeNull();
    expect(getComputedStyle(wash).transitionProperty).toContain('transform');
  });

  it('opens the tray when a tool goes from off to on elsewhere, and stops on unmount', () => {
    const { unmount } = render(<Capsule />);
    act(() => setCompactTool('sign'));
    expect(compact().trayOpen).toBe(true);
    act(() => useCompactStore.setState({ trayOpen: false, tool: null }));
    unmount();
    act(() => setCompactTool('pen'));
    expect(compact().trayOpen).toBe(false);
  });

  it('keeps Undo off at the editing floor and live above it', () => {
    render(<Capsule />);
    const undo = screen.getByTestId('compact-undo');
    expect(undo.getAttribute('aria-disabled')).toBe('true');
    const floor = useWorkspaceStore.getState().history.past.length;
    act(() => useWorkspaceStore.setState({ history: historyOf(floor + 1) }));
    expect(undo.hasAttribute('aria-disabled')).toBe(false);
  });

  it('makes every target 44 px, and fits the capsule in 324 px', () => {
    render(<Capsule />);
    for (const button of screen.getByTestId('capsule').querySelectorAll('button')) {
      const box = button.getBoundingClientRect();
      expect(box.width, button.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(screen.getByTestId('capsule').getBoundingClientRect().width).toBeLessThanOrEqual(324);
  });
});

describe('the Redo chip', () => {
  it('shows only while there is a step to redo, 44 px, with the stay-clear attributes', async () => {
    render(<RedoChip />);
    expect(screen.queryByTestId('compact-redo')).toBeNull();
    act(() => useWorkspaceStore.setState({ history: historyOf(2, 1) }));
    const chip = screen.getByTestId('compact-redo');
    expect(chip.getAttribute('aria-label')).toBe('Redo');
    for (const name of [
      'data-compact-chrome',
      'data-annotation-keep',
      'data-compact-above-capsule',
    ])
      expect(chip.hasAttribute(name)).toBe(true);
    // Measured at rest: it enters from scale .6.
    await settled(chip);
    const box = chip.getBoundingClientRect();
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    act(() => useWorkspaceStore.setState({ history: historyOf(3, 0) }));
    // It leaves on its own animation's end, a condition not a clock.
    await waitFor(() => expect(screen.queryByTestId('compact-redo')).toBeNull());
  });

  it('hands focus to Undo when it goes while holding it', async () => {
    act(() => useWorkspaceStore.setState({ history: historyOf(2, 1) }));
    render(
      <>
        <Capsule />
        <RedoChip />
      </>,
    );
    screen.getByTestId('compact-redo').focus();
    act(() => useWorkspaceStore.setState({ history: historyOf(3, 0) }));
    expect(document.activeElement).toBe(screen.getByTestId('compact-undo'));
    await waitFor(() => expect(screen.queryByTestId('compact-redo')).toBeNull());
  });
});
