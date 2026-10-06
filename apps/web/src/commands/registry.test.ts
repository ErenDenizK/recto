import type { DocumentId } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetLockStore, useLockStore } from '../state/lock-store';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { type CommandDefinition, CommandRegistry, groupCommands } from './registry';
import { dispatchShortcut, isEditableTarget } from './use-shortcuts';

function keydown(init: KeyboardEventInit, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

describe('CommandRegistry', () => {
  it('registers, lists, and unregisters commands', () => {
    const registry = new CommandRegistry();
    const dispose = registry.register({
      id: 'a',
      title: 'A',
      group: 'G',
      act: null,
      run: () => undefined,
    });
    expect(registry.list().map((c) => c.id)).toEqual(['a']);
    expect(registry.get('a')?.shortcuts).toEqual([]);
    dispose();
    expect(registry.list()).toEqual([]);
  });

  it('rejects duplicate ids and invalid shortcuts', () => {
    const registry = new CommandRegistry();
    registry.register({ id: 'a', title: 'A', group: 'G', act: null, run: () => undefined });
    expect(() =>
      registry.register({ id: 'a', title: 'A', group: 'G', act: null, run: () => undefined }),
    ).toThrow(/already registered/);
    expect(() =>
      registry.register({
        id: 'b',
        title: 'B',
        group: 'G',
        act: null,
        shortcut: 'Mod+',
        run: () => undefined,
      }),
    ).toThrow();
  });

  it('keeps list() stable between mutations and notifies subscribers', () => {
    const registry = new CommandRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const first = registry.list();
    expect(registry.list()).toBe(first);
    registry.register({ id: 'a', title: 'A', group: 'G', act: null, run: () => undefined });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(registry.list()).not.toBe(first);
  });

  it('does not let a stale disposer remove a re-registered command', () => {
    const registry = new CommandRegistry();
    const disposeOld = registry.register({
      id: 'a',
      title: 'A',
      group: 'G',
      act: null,
      run: () => undefined,
    });
    disposeOld();
    registry.register({ id: 'a', title: 'A2', group: 'G', act: null, run: () => undefined });
    disposeOld();
    expect(registry.get('a')?.title).toBe('A2');
  });

  it('executes only enabled commands', async () => {
    const registry = new CommandRegistry();
    const run = vi.fn();
    let enabled = false;
    registry.register({ id: 'a', title: 'A', group: 'G', act: null, run, when: () => enabled });
    expect(await registry.execute('a')).toBe(false);
    enabled = true;
    expect(await registry.execute('a')).toBe(true);
    expect(await registry.execute('missing')).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('treats a throwing predicate as disabled', () => {
    const registry = new CommandRegistry();
    registry.register({
      id: 'a',
      title: 'A',
      group: 'G',
      act: null,
      run: () => undefined,
      when: () => {
        throw new Error('boom');
      },
    });
    const command = registry.get('a');
    expect(command && registry.isEnabled(command)).toBe(false);
  });
});

describe('CommandRegistry acts (ADR-0030 §2.3)', () => {
  const a = 'doc-a' as DocumentId;
  const b = 'doc-b' as DocumentId;
  const empty = useWorkspaceStore.getState().workspace;
  const doc = (id: DocumentId) => ({ id, title: id, pages: [], outline: [] }) as unknown;

  beforeEach(() => {
    useWorkspaceStore.setState({
      workspace: {
        ...empty,
        documents: { [a]: doc(a), [b]: doc(b) } as typeof empty.documents,
        documentOrder: [a, b],
        activeDocument: a,
      },
    });
  });
  afterEach(() => {
    useWorkspaceStore.setState({ workspace: empty });
    useUiStore.setState({ docUi: {} });
    resetLockStore();
  });

  const definition = (overrides: Partial<CommandDefinition>): CommandDefinition => ({
    id: 'x',
    title: 'X',
    group: 'G',
    act: null,
    run: () => undefined,
    ...overrides,
  });

  it('fails on a command that declares no act, or an act the guard does not know', () => {
    const registry = new CommandRegistry();
    const { act: _none, ...withoutAct } = definition({});
    expect(() => registry.register(withoutAct as CommandDefinition)).toThrow(/declares no act/);
    expect(() =>
      registry.register(definition({ id: 'y', act: 'edit' as CommandDefinition['act'] })),
    ).toThrow(/declares no act/);
    expect(registry.list()).toEqual([]);
    // `null` says the command changes no document.
    registry.register(definition({ id: 'z', act: null }));
    expect(registry.get('z')?.act).toBeNull();
  });

  it('dims a committing command on a locked document, with the reason, and never runs it', async () => {
    const registry = new CommandRegistry();
    const run = vi.fn();
    registry.register(definition({ id: 'rotate', act: 'pages', run }));
    registry.register(definition({ id: 'zoom', act: null, run }));
    const rotate = registry.get('rotate');
    const zoom = registry.get('zoom');
    if (!rotate || !zoom) throw new Error('not registered');
    expect(registry.isEnabled(rotate)).toBe(true);
    expect(registry.disabledReason(rotate)).toBeUndefined();

    useLockStore.getState().lock(a);
    expect(registry.isEnabled(rotate)).toBe(false);
    expect(registry.refusalOf(rotate)).toEqual({ kind: 'locked', reason: 'user' });
    expect(registry.disabledReason(rotate)).toBe('Locked · unlock first');
    expect(await registry.execute('rotate')).toBe(false);
    // A command that changes no document is not touched by the lock.
    expect(registry.isEnabled(zoom)).toBe(true);
    expect(await registry.execute('zoom')).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('asks for each document the command changes (ADR-0030 §2.4)', () => {
    const registry = new CommandRegistry();
    let documents: DocumentId[] = [a, b];
    registry.register(definition({ id: 'move', act: 'pages', documents: () => documents }));
    const move = registry.get('move');
    if (!move) throw new Error('not registered');
    expect(registry.isEnabled(move)).toBe(true);
    useLockStore.getState().lock(b, 'signed');
    expect(registry.refusalOf(move)).toEqual({ kind: 'locked', reason: 'signed' });
    documents = [a];
    expect(registry.isEnabled(move)).toBe(true);
    // No document to change fails closed.
    documents = [];
    expect(registry.refusalOf(move)).toEqual({ kind: 'unknown' });
    expect(registry.disabledReason(move)).toBe('No document open');
  });

  it('lets a Markup door arm outside Markup, and dims a freehand command that is not one', () => {
    const registry = new CommandRegistry();
    registry.register(definition({ id: 'pen', act: 'freehand', via: 'markup' }));
    registry.register(definition({ id: 'stroke', act: 'freehand' }));
    registry.register(definition({ id: 'field', act: 'place' }));
    const [pen, stroke, field] = ['pen', 'stroke', 'field'].map((id) => registry.get(id));
    if (!pen || !stroke || !field) throw new Error('not registered');
    expect(registry.isEnabled(pen)).toBe(true);
    expect(registry.disabledReason(stroke)).toBe('Open Markup to draw');
    expect(registry.disabledReason(field)).toBe('Open Markup to place');
    useUiStore.getState().openMarkup(a);
    expect(registry.isEnabled(stroke)).toBe(true);
    expect(registry.isEnabled(field)).toBe(true);
    useLockStore.getState().lock(a);
    expect(registry.disabledReason(pen)).toBe('Locked · unlock first');
  });

  it('leaves a command that opens a sheet available while locked: the sheet asks (07 §1.4)', () => {
    const registry = new CommandRegistry();
    registry.register(definition({ id: 'numbers', act: 'document', via: 'sheet' }));
    const numbers = registry.get('numbers');
    if (!numbers) throw new Error('not registered');
    useLockStore.getState().lock(a);
    expect(registry.isEnabled(numbers)).toBe(true);
  });

  it('gives the command’s own reason while `when` says no, before the guard’s', () => {
    const registry = new CommandRegistry();
    let ready = false;
    registry.register(
      definition({
        id: 'revert',
        act: 'document',
        when: () => ready,
        reason: () => 'Nothing changed since opening',
      }),
    );
    const revert = registry.get('revert');
    if (!revert) throw new Error('not registered');
    useLockStore.getState().lock(a);
    expect(registry.disabledReason(revert)).toBe('Nothing changed since opening');
    ready = true;
    expect(registry.disabledReason(revert)).toBe('Locked · unlock first');
    useLockStore.getState().unlock(a);
    expect(registry.disabledReason(revert)).toBeUndefined();
  });
});

describe('groupCommands', () => {
  it('groups in order of first appearance', () => {
    const grouped = groupCommands([
      { id: '1', group: 'View' },
      { id: '2', group: 'File' },
      { id: '3', group: 'View' },
    ]);
    expect(grouped.map((g) => [g.group, g.items.map((i) => i.id)])).toEqual([
      ['View', ['1', '3']],
      ['File', ['2']],
    ]);
  });
});

describe('dispatchShortcut', () => {
  function setup() {
    const registry = new CommandRegistry();
    const palette = vi.fn();
    const read = vi.fn();
    registry.register({
      id: 'palette',
      title: 'Palette',
      group: 'G',
      act: null,
      shortcut: 'Mod+K',
      allowInInputs: true,
      run: palette,
    });
    registry.register({
      id: 'read',
      title: 'Read',
      group: 'G',
      act: null,
      shortcut: '1',
      run: read,
    });
    return { registry, palette, read };
  }

  it('runs the matching command and prevents the default action', () => {
    const { registry, palette } = setup();
    const event = keydown({ key: 'k', ctrlKey: true });
    expect(dispatchShortcut(event, registry, 'other')).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(palette).toHaveBeenCalledOnce();
  });

  it('ignores plain keys in text fields unless the command opts in', () => {
    const { registry, palette, read } = setup();
    const input = document.createElement('input');
    expect(dispatchShortcut(keydown({ key: '1' }, input), registry, 'other')).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(dispatchShortcut(keydown({ key: 'k', ctrlKey: true }, input), registry, 'other')).toBe(
      true,
    );
    expect(palette).toHaveBeenCalledOnce();
  });

  it('ignores keys inside modal dialogs unless the command opts in', () => {
    const { registry, read } = setup();
    const dialog = document.createElement('div');
    dialog.setAttribute('aria-modal', 'true');
    const button = document.createElement('button');
    dialog.append(button);
    expect(dispatchShortcut(keydown({ key: '1' }, button), registry, 'other')).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it('skips events already handled or composing', () => {
    const { registry, read } = setup();
    const handled = keydown({ key: '1' });
    handled.preventDefault();
    expect(dispatchShortcut(handled, registry, 'other')).toBe(false);
    expect(dispatchShortcut(keydown({ key: '1', isComposing: true }), registry, 'other')).toBe(
      false,
    );
    expect(read).not.toHaveBeenCalled();
  });

  it('classifies editable targets', () => {
    const text = document.createElement('input');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.append(editable);
    expect(isEditableTarget(text)).toBe(true);
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    editable.remove();
  });
});
