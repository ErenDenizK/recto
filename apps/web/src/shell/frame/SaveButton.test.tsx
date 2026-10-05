/**
 * Save's states (01-frame F7 §4, §8): "Saved" when nothing is new (aria-disabled, focusable, the
 * reason as its description), "Save" when the saved mark says the file lacks a change, one
 * width for both, and focus that stays on the button while it turns from one into the other.
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
} from '@pdf-editor/document-model';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetSave } from '../../files/save';
import { markSaved, resetSavedMarks, watchSavedMarks } from '../../state/saved-store';
import { resetWorkspace, useWorkspaceStore } from '../../state/workspace-store';
import { SaveButton, saveButtonState } from './SaveButton';

const ids = createSequentialIdGenerator('savebtn');

function open(): DocumentId {
  const workspace = addSource(
    createWorkspace(),
    {
      name: 'report.pdf',
      byteLength: 3,
      pageCount: 1,
      pages: [{ size: { width: 612, height: 792 }, rotation: 0 }],
      fingerprint: 'report',
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
    ids,
  ).workspace;
  useWorkspaceStore.setState({ history: createHistory(workspace, 'Open', 1), workspace });
  return workspace.documentOrder[0] as DocumentId;
}

function rotate(id: DocumentId): void {
  const page = useWorkspaceStore.getState().workspace.documents[id]?.pages[0]?.id;
  if (page) useWorkspaceStore.getState().rotatePages([page], 90);
}

describe('saveButtonState', () => {
  it('maps the saved mark and a running save', () => {
    expect(saveButtonState({ inFile: true, saving: false })).toBe('saved');
    expect(saveButtonState({ inFile: false, saving: false })).toBe('save');
    expect(saveButtonState({ inFile: false, saving: true })).toBe('saving');
    expect(saveButtonState({ inFile: true, saving: true })).toBe('saving');
  });
});

describe('SaveButton', () => {
  beforeEach(() => {
    resetWorkspace();
    resetSavedMarks();
    resetSave();
    watchSavedMarks();
  });

  it('reads "Saved" as opened and "Save" after a change, at one width, keeping focus', () => {
    const id = open();
    render(<SaveButton />);
    const button = screen.getByTestId('save-button');
    expect(button).toHaveAccessibleName('Saved');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Everything is in report.pdf');
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+S');
    const width = button.getBoundingClientRect().width;

    button.focus();
    act(() => rotate(id));
    expect(screen.getByTestId('save-button')).toBe(button);
    expect(button).toHaveAccessibleName('Save');
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button.getBoundingClientRect().width).toBe(width);

    act(() => markSaved(id, { handleKept: true }));
    expect(button).toHaveAccessibleName('Saved');
    expect(button).toHaveFocus();
  });
});
