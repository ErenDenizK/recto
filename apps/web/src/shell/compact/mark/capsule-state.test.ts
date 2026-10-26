/**
 * The single capsule's state rules (capsule-state.ts, EDN-24): the pressed tool, the armed-tool
 * tap table, and the tray opening when a tool goes from off to on.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import simpleUrl from '../../../../../../test/fixtures/simple-text.pdf?url';
import { resetWorkspace } from '../../../state/workspace-store';
import { resetToolStore } from '../../../viewer/tool-store';
import { fixtureFile } from '../../../../test/store-harness';
import { openPdf } from '../compact-actions';
import { resetCompactStore, setTrayOpen, showLibrary, useCompactStore } from '../compact-store';
import { armTool, enterEditing, exitEditing, resetBridge, toggleEraser } from './bridge';
import { installTrayOpener, tapCapsuleTool, tapRule, trayTool } from './capsule-state';
import './tools';

const compact = () => useCompactStore.getState();

describe('the pressed tool', () => {
  it('the Eraser counts as the tool it took over from, Edit text as Text', () => {
    expect(trayTool(null, 'pen')).toBeNull();
    expect(trayTool('pen', 'text')).toBe('pen');
    expect(trayTool('eraser', 'highlight')).toBe('highlight');
    expect(trayTool('edit-text', 'pen')).toBe('text');
  });
});

describe('the armed-tool tap table', () => {
  it('arms any tool when the tool is off or another one is pressed', () => {
    expect(tapRule(null, null, 'pen', false)).toBe('arm');
    expect(tapRule('pen', 'pen', 'text', true)).toBe('arm');
    expect(tapRule('pen', 'pen', 'text', false)).toBe('arm');
  });

  it('turns the armed tool off with the tray open, opens the tray when closed', () => {
    expect(tapRule('pen', 'pen', 'pen', true)).toBe('off');
    expect(tapRule('pen', 'pen', 'pen', false)).toBe('open');
    expect(tapRule('edit-text', 'text', 'text', true)).toBe('off');
  });

  it('returns from the Eraser to the tool it took over from', () => {
    expect(tapRule('eraser', 'pen', 'pen', true)).toBe('arm');
  });
});

describe('tapping the capsule’s tools', () => {
  beforeEach(async () => {
    resetWorkspace();
    resetCompactStore();
    resetToolStore();
    resetBridge();
    expect(await openPdf(await fixtureFile(simpleUrl, 'simple-text.pdf'))).toBe(true);
    enterEditing();
  });

  afterEach(() => {
    exitEditing();
    showLibrary();
  });

  it('arms with the tool off and opens the tray', () => {
    tapCapsuleTool('pen');
    expect(compact()).toMatchObject({ tool: 'pen', trayOpen: true });
  });

  it('another tool keeps the tray open; the armed one turns the tool off and closes it', () => {
    tapCapsuleTool('pen');
    tapCapsuleTool('highlight');
    expect(compact()).toMatchObject({ tool: 'highlight', trayOpen: true });
    tapCapsuleTool('highlight');
    expect(compact()).toMatchObject({ tool: null, trayOpen: false });
  });

  it('the armed tool with the tray closed opens it and keeps the tool', () => {
    tapCapsuleTool('text');
    setTrayOpen(false);
    tapCapsuleTool('text');
    expect(compact()).toMatchObject({ tool: 'text', trayOpen: true });
  });

  it('from the Eraser, the tool it took over from arms again', () => {
    tapCapsuleTool('highlight');
    toggleEraser();
    tapCapsuleTool('highlight');
    expect(compact()).toMatchObject({ tool: 'highlight', trayOpen: true });
  });

  it('opens the tray when a tool goes from off to on, once installed', () => {
    const dispose = installTrayOpener();
    armTool('sign');
    expect(compact()).toMatchObject({ tool: 'sign', trayOpen: true });
    setTrayOpen(false);
    armTool('pen');
    expect(compact().trayOpen).toBe(false);
    dispose();
  });

  it('does nothing without the opener installed', () => {
    armTool('sign');
    expect(compact().trayOpen).toBe(false);
  });
});
