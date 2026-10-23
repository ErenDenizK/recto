/**
 * Letters stand down after a double-click selection (TXT-21): the typing that follows a
 * double-clicked word is not a run of tool keys; the next pointer press or Esc ends it, and
 * Ctrl/⌘ shortcuts and non-letter keys still run.
 */
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandRegistry } from './registry';
import { resetLetterStandDown, useShortcuts } from './use-shortcuts';

function setup() {
  const registry = new CommandRegistry();
  const runs = { h: vi.fn(), end: vi.fn(), save: vi.fn() };
  const add = (id: string, shortcut: string, run: () => void) =>
    registry.register({ id, title: id, group: 'G', act: null, shortcut, run });
  add('tool.h', 'H', runs.h);
  add('nav.end', 'End', runs.end);
  add('file.save', 'Mod+S', runs.save);
  renderHook(() => {
    useShortcuts(registry);
  });
  return runs;
}

const press = (init: KeyboardEventInit) =>
  document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));

function selectWord() {
  const p = document.body.appendChild(document.createElement('p'));
  p.textContent = 'lamp';
  const range = document.createRange();
  range.selectNodeContents(p);
  getSelection()?.removeAllRanges();
  getSelection()?.addRange(range);
  document.body.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
}

describe('letters after a double-click selection', () => {
  beforeEach(() => {
    resetLetterStandDown();
  });
  afterEach(() => {
    getSelection()?.removeAllRanges();
    cleanup();
  });

  it('stand down until a pointer press, while End and Ctrl+S still run', () => {
    const runs = setup();
    selectWord();
    press({ key: 'h' });
    expect(runs.h).not.toHaveBeenCalled();
    press({ key: 'End' });
    press({ key: 's', ctrlKey: true });
    expect(runs.end).toHaveBeenCalledOnce();
    expect(runs.save).toHaveBeenCalledOnce();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    press({ key: 'h' });
    expect(runs.h).toHaveBeenCalledOnce();
  });

  it('stand down until Esc', () => {
    const runs = setup();
    selectWord();
    press({ key: 'Escape' });
    press({ key: 'h' });
    expect(runs.h).toHaveBeenCalledOnce();
  });

  it('a double-click that selects nothing changes nothing', () => {
    const runs = setup();
    getSelection()?.removeAllRanges();
    document.body.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    press({ key: 'h' });
    expect(runs.h).toHaveBeenCalledOnce();
  });
});
