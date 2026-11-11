/**
 * The single capsule's editing content and the Undo and Redo chips (CapsuleTools.tsx,
 * RedoChip.tsx; EDN-24, EDN-29): five tools with Edit text in its own slot and Done, the pressed
 * tool's states, the tap rule through the store, the tray opener, 48 px slots with 24 px glyphs,
 * the capsule's width, Undo at the editing floor, and Redo's arrival, departure and focus
 * hand-off.
 */
import '../../../styles/tokens.css';
import '../../../styles/reset.css';
import '../../../styles/global.css';

import type { History } from '@pdf-editor/document-model';
import type { CSSProperties } from 'react';
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
import { RedoChip, UndoChip } from './RedoChip';
import './tools';
import './edit-text';

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

/** The capsule's row as the host styles it: 358 wide at 390, 6 px padding, tools then Done. */
function Capsule() {
  return (
    <nav
      data-testid="capsule"
      style={{
        ...({ '--capsule-slot': '48px' } as CSSProperties),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 6px',
        width: 358,
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
  it('shows Pen, Highlight, Text, Edit text, Sign and Done, in that order, and no Undo', () => {
    render(<Capsule />);
    const group = screen.getByRole('group', { name: 'Tools' });
    const ids = Array.from(group.querySelectorAll('button')).map((b) =>
      b.getAttribute('data-testid'),
    );
    expect(ids).toEqual(
      ['pen', 'highlight', 'text', 'edit-text', 'sign'].map((id) => `compact-capsule-tool-${id}`),
    );
    // Undo is a chip beside the tray (RedoChip.tsx): five tools and Done fill the row.
    expect(screen.queryByTestId('compact-undo')).toBeNull();
    expect(screen.getByTestId('compact-edit-done').getAttribute('aria-label')).toBe('Done');
    expect(screen.getByTestId('compact-edit-done').textContent).toBe('Done');
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

  it('keeps the tool pressed under the Eraser, and Edit text presses its own slot', () => {
    render(<Capsule />);
    act(() => setCompactTool('highlight'));
    act(() => toggleEraser());
    expect(compact().tool).toBe('eraser');
    expect(tool('highlight').getAttribute('aria-pressed')).toBe('true');
    act(() => setCompactTool('edit-text'));
    expect(tool('edit-text').getAttribute('aria-pressed')).toBe('true');
    expect(tool('text').getAttribute('aria-pressed')).toBe('false');
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
    expect(group.dataset.index).toBe('4');
    expect(group.hasAttribute('data-armed')).toBe(true);
    fireEvent.click(tool('sign'));
    expect(group.dataset.index).toBe('4');
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

  it('keeps Undo, the chip, off at the editing floor and live above it', () => {
    render(<UndoChip />);
    const undo = screen.getByTestId('compact-undo');
    expect(undo.getAttribute('aria-disabled')).toBe('true');
    const floor = useWorkspaceStore.getState().history.past.length;
    act(() => useWorkspaceStore.setState({ history: historyOf(floor + 1) }));
    expect(undo.hasAttribute('aria-disabled')).toBe(false);
  });

  it('makes every slot 48 px with a 24 px glyph, and fits tools and Done in 358 px', () => {
    render(<Capsule />);
    const capsule = screen.getByTestId('capsule');
    for (const button of capsule.querySelectorAll('button')) {
      const box = button.getBoundingClientRect();
      expect(box.width, button.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
    for (const glyph of capsule.querySelectorAll('[role="group"] svg')) {
      expect(glyph.getBoundingClientRect().width).toBe(24);
    }
    const done = screen.getByTestId('compact-edit-done').getBoundingClientRect();
    const last = tool('sign').getBoundingClientRect();
    expect(done.left).toBeGreaterThanOrEqual(last.right);
    expect(done.right).toBeLessThanOrEqual(capsule.getBoundingClientRect().right);
  });

  it('presses the armed slot in lime, the one lime of the capsule', () => {
    render(<Capsule />);
    fireEvent.click(tool('pen'));
    const wash = screen.getByTestId('compact-capsule-wash');
    const lime = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    expect(lime).not.toBe('');
    expect(getComputedStyle(wash).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    // Done is a text pill: no fill of its own.
    expect(getComputedStyle(screen.getByTestId('compact-edit-done')).backgroundColor).toBe(
      'rgba(0, 0, 0, 0)',
    );
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
      'data-glass-group',
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
        <UndoChip />
        <RedoChip />
      </>,
    );
    screen.getByTestId('compact-redo').focus();
    act(() => useWorkspaceStore.setState({ history: historyOf(3, 0) }));
    expect(document.activeElement).toBe(screen.getByTestId('compact-undo'));
    await waitFor(() => expect(screen.queryByTestId('compact-redo')).toBeNull());
  });
});
