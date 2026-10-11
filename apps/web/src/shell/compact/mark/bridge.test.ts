/**
 * The bridge to the one editing gate (bridge.ts; code-audit §2): entering opens Markup on the
 * document and arms the tool through the tool store, the chip toggles it, a "soon" tool never
 * arms, the Eraser goes back to the tool it took over from, a later entry arms the last tool,
 * and leaving (Done, or the Library) closes Markup and returns the tool store to Select. Undo
 * never reaches past the step the document stood at when editing first began.
 */
import type { History, HistoryEntry } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import simpleUrl from '../../../../../../test/fixtures/simple-text.pdf?url';
import { isMarkupOpen, useUiStore } from '../../../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../../../state/workspace-store';
import { resetToolStore, useToolStore } from '../../../viewer/tool-store';
import { fixtureFile } from '../../../../test/store-harness';
import { openPdf } from '../compact-actions';
import { resetCompactStore, showLibrary, useCompactStore } from '../compact-store';
import {
  armTool,
  canUndoAbove,
  enterEditing,
  exitEditing,
  resetBridge,
  toggleEraser,
  toggleTool,
  toolOff,
} from './bridge';
import './tools';

const compact = () => useCompactStore.getState();
const mode = () => useToolStore.getState().mode;
const markupOpen = () =>
  isMarkupOpen(useUiStore.getState(), useWorkspaceStore.getState().workspace.activeDocument);

describe('the editing bridge', () => {
  beforeEach(async () => {
    resetWorkspace();
    resetCompactStore();
    resetToolStore();
    resetBridge();
    expect(await openPdf(await fixtureFile(simpleUrl, 'simple-text.pdf'))).toBe(true);
  });

  afterEach(() => {
    exitEditing();
  });

  it('enters on Pen through Markup and the tool store', () => {
    expect(markupOpen()).toBe(false);
    enterEditing();
    expect(markupOpen()).toBe(true);
    expect(mode()).toBe('ink');
    expect(compact()).toMatchObject({ editing: true, tool: 'pen' });
  });

  it('the chip toggles the tool off (Select) and back on', () => {
    enterEditing();
    toolOff();
    expect(compact().tool).toBeNull();
    expect(mode()).toBe('select');
    toggleTool();
    expect(compact().tool).toBe('pen');
    expect(mode()).toBe('ink');
  });

  it('arms the eraser and goes back to the pen it took over from', () => {
    enterEditing();
    armTool('highlight');
    toggleEraser();
    expect(mode()).toBe('eraser');
    expect(compact().tool).toBe('eraser');
    toggleEraser();
    expect(compact().tool).toBe('highlight');
    expect(mode()).toBe('ink');
  });

  it('a soon tool does not arm; a stub arms Select or its mode', () => {
    enterEditing();
    armTool('edit-text');
    expect(compact().tool).toBe('pen');
    armTool('text');
    expect(mode()).toBe('text-box');
    armTool('sign');
    expect(mode()).toBe('select');
    expect(compact().tool).toBe('sign');
  });

  it('Done closes Markup and returns to Select; the next entry arms the last tool', () => {
    enterEditing();
    armTool('highlight');
    exitEditing();
    expect(compact()).toMatchObject({ editing: false, tool: null });
    expect(markupOpen()).toBe(false);
    expect(mode()).toBe('select');
    enterEditing();
    expect(compact().tool).toBe('highlight');
    expect(mode()).toBe('ink');
  });

  it('the Library leaves editing the same way', () => {
    enterEditing();
    showLibrary();
    expect(markupOpen()).toBe(false);
    expect(mode()).toBe('select');
  });
});

describe('undo floor', () => {
  const history = (past: number): History => {
    const entry = {} as HistoryEntry;
    return { past: Array.from({ length: past }, () => entry), present: entry, future: [] };
  };

  it('stops at the step the document stood at when editing began', () => {
    expect(canUndoAbove(history(1), 1)).toBe(false);
    expect(canUndoAbove(history(2), 1)).toBe(true);
  });
});
