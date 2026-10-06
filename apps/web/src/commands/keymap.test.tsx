/**
 * Key map v2 (flows §7.2–§7.3; spec D2-7), Vitest browser mode, over every command the app
 * registers: every binding belongs to a command and is listed in the overlay's groups, no key
 * is bound twice except the context keys `SHARED_KEYS` names, the keys the spec names are the
 * ones bound, no bound key runs while focus is in a field, and the `1` notice is said once,
 * only on a device that ran M8.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { registerDocumentCommands } from '../document/document-commands';
import { registerOutlineCommands } from '../outline/outline-commands';
import { registerSettingsCommands } from '../settings/settings-commands';
import { registerAppearanceCommands } from '../shell/appearance-commands';
import { registerFocusCommands } from '../shell/frame/focus-mode';
import { registerSignatureCommands } from '../signatures/signature-commands';
import { registerArrangeCommands } from '../stage/arrange-commands';
import { V2_LAYOUT_STORAGE_KEY } from '../state/ui-store';
import { hasToast } from '../ui/Toast/toast';
import { resetToasts } from '../ui/Toast/toast-store';
import { registerAppCommands } from './app-commands';
import {
  bindingKey,
  EXTRA_ROWS,
  KEYMAP_ENTRIES,
  KEYMAP_GROUPS,
  keymapEntry,
  keymapRows,
  SHARED_KEYS,
} from './keymap';
import { KEYMAP_NOTICE_STORAGE_KEY, noteKeyOneChanged } from './keymap-notice';
import { type Command, type CommandRegistry, commandRegistry } from './registry';
import { parseShortcut } from './shortcuts';
import { dispatchShortcut } from './use-shortcuts';

/** Every command set the app registers (`app.tsx`, `shell/AppShell.tsx`). */
function registerEverything(registry: CommandRegistry): () => void {
  const disposers = [
    registerAppCommands(registry),
    registerArrangeCommands(registry),
    registerDocumentCommands(registry),
    registerOutlineCommands(registry),
    registerSignatureCommands(registry),
    registerAppearanceCommands(registry),
    registerSettingsCommands(registry),
    registerFocusCommands(registry),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}

/** The keys flows §7.2 gives the V2 map, as the registry must bind them. */
const SPEC_KEYS: Readonly<Record<string, readonly string[]>> = {
  'view.home': ['0'],
  'mode.read': ['1'],
  'mode.edit': ['M', '2'],
  'mode.arrange': ['3'],
  'mode.compare': ['4'],
  'pages.rotateRight': ['Shift+R'],
  'pages.rotateLeft': ['Alt+Shift+R'],
  'file.save': ['Mod+S'],
  'file.export': ['Mod+Shift+S'],
  'file.open': ['Mod+O'],
  'view.focus': ['F'],
  'nav.previousPage': ['['],
  'nav.nextPage': [']'],
  'nav.goToPage': ['Mod+G'],
  'search.open': ['Mod+F'],
  'view.toggleLeftPanel': ['Mod+B'],
  'view.palette': ['Mod+K'],
  'help.shortcuts': ['?'],
  'edit.undo': ['Mod+Z'],
  'edit.redo': ['Mod+Shift+Z', 'Mod+Y'],
  'pages.duplicate': ['Mod+D'],
  'pages.extract': ['Mod+Shift+E'],
  'tool.select': ['V'],
  'tool.ink': ['P'],
  'tool.highlighter': ['H'],
  'tool.eraser': ['Shift+E'],
  'tool.lasso': ['Q'],
  'tool.rectangle': ['R'],
  'tool.text-box': ['T'],
  'tool.note': ['N'],
  'tool.signature': ['G'],
  'tool.redact': ['X'],
  'tool.edit-text': ['E'],
};

let dispose: () => void = () => undefined;
beforeAll(() => {
  dispose = registerEverything(commandRegistry);
});
afterAll(() => {
  dispose();
});

const bound = (): readonly Command[] =>
  commandRegistry.list().filter((command) => command.shortcuts.length > 0);

describe('the registry is the key map’s one source', () => {
  it('every binding belongs to a command, and every command’s key is listed in a group', () => {
    const commands = bound();
    expect(commands.length).toBeGreaterThan(60);
    const unlisted = commands.filter((c) => keymapEntry(c.id) === undefined).map((c) => c.id);
    expect(unlisted).toEqual([]);
    // No stale entry: each names a command the app registers with a key.
    for (const id of Object.keys(KEYMAP_ENTRIES)) {
      expect(commandRegistry.get(id)?.shortcuts.length ?? 0, id).toBeGreaterThan(0);
    }
    // The overlay's extra rows take their keys from a bound command, or are the browser's, and
    // read beside an entry.
    for (const row of EXTRA_ROWS) {
      const anchor = 'before' in row.place ? row.place.before : row.place.after;
      expect(KEYMAP_ENTRIES[anchor], `${row.id} reads beside ${anchor}`).toBeDefined();
      if (row.command === undefined) {
        expect(row.keys?.length ?? 0, row.id).toBeGreaterThan(0);
        continue;
      }
      expect(commandRegistry.get(row.command)?.shortcuts.length ?? 0, row.id).toBeGreaterThan(0);
    }
  });

  it('binds no key twice, except the context keys, each to the commands named for it', () => {
    const owners = new Map<string, string[]>();
    for (const command of bound()) {
      const keys = command.shortcuts.map(bindingKey);
      expect(new Set(keys).size, `${command.id} lists a key twice`).toBe(keys.length);
      for (const key of keys) owners.set(key, [...(owners.get(key) ?? []), command.id]);
    }
    for (const [key, ids] of owners) {
      if (ids.length < 2) continue;
      const allowed = SHARED_KEYS[key];
      expect(allowed, `${key} is bound by ${ids.join(', ')}`).toBeDefined();
      for (const id of ids) expect(allowed, `${key} → ${id}`).toContain(id);
    }
  });

  it('binds the keys flows §7.2 names; R is the Rectangle alone; Mod+Alt+B is free', () => {
    for (const [id, keys] of Object.entries(SPEC_KEYS)) {
      const command = commandRegistry.get(id);
      expect(command, id).toBeDefined();
      expect(command?.shortcuts.map(bindingKey), id).toEqual(
        keys.map((k) => bindingKey(parseShortcut(k))),
      );
    }
    const owners = (spelling: string) =>
      bound()
        .filter((c) => c.shortcuts.some((s) => bindingKey(s) === spelling))
        .map((c) => c.id);
    expect(owners('R')).toEqual(['tool.rectangle']);
    expect(owners('M')).toEqual(['mode.edit']);
    expect(owners('Mod+Alt+B')).toEqual([]);
  });

  it('lists every bound command in the overlay’s groups, in S22’s order', () => {
    const groups = keymapRows(commandRegistry.list(), () => []);
    expect(groups.map((g) => g.group)).toEqual([...KEYMAP_GROUPS]);
    const listed = new Set(groups.flatMap((g) => g.rows.flatMap((r) => r.keys.map(bindingKey))));
    for (const command of bound()) {
      for (const shortcut of command.shortcuts) {
        expect(listed.has(bindingKey(shortcut)), `${command.id} ${bindingKey(shortcut)}`).toBe(
          true,
        );
      }
    }
    const places = groups.find((g) => g.group === 'places')?.rows.map((r) => r.id);
    expect(places).toEqual(['view.home', 'mode.read', 'mode.edit', 'mode.arrange', 'mode.compare']);
    // On a selection reads as flows §7.2 lists it: H U S X, copy, then Delete.
    const selection = groups.find((g) => g.group === 'selection')?.rows.map((r) => r.id);
    expect(selection).toEqual([
      'selection.highlight',
      'tool.underline',
      'tool.strikeout',
      'selection.redact',
      'selection.copy',
      'row.delete-object',
    ]);
    // The tools in the palette's order, Select first; the steps through lists close View.
    expect(groups.find((g) => g.group === 'tools')?.rows[0]?.id).toBe('tool.select');
    expect(
      groups
        .find((g) => g.group === 'view')
        ?.rows.map((r) => r.id)
        .slice(-2),
    ).toEqual(['row.step-next', 'row.step-previous']);
    // Esc's ladder and J/K read as one row each.
    const rows = groups.flatMap((g) => g.rows);
    expect(rows.filter((r) => r.keys.some((k) => k.key === 'Escape'))).toHaveLength(1);
    expect(rows.filter((r) => r.keys.some((k) => bindingKey(k) === 'J'))).toHaveLength(1);
  });

  it('runs no bound key while focus is in a field, unless the command opts in', () => {
    const input = document.createElement('input');
    input.type = 'text';
    const textarea = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.append(input, textarea, editable);
    try {
      for (const command of bound()) {
        if (command.allowInInputs) continue;
        for (const shortcut of command.shortcuts) {
          for (const target of [input, textarea, editable]) {
            const event = new KeyboardEvent('keydown', {
              bubbles: true,
              cancelable: true,
              key: shortcut.key === ' ' ? ' ' : shortcut.key,
              ctrlKey: shortcut.ctrl || shortcut.mod,
              metaKey: shortcut.meta,
              altKey: shortcut.alt,
              shiftKey: shortcut.shift,
            });
            Object.defineProperty(event, 'target', { value: target });
            expect(dispatchShortcut(event, commandRegistry, 'other'), command.id).toBe(false);
            expect(event.defaultPrevented, command.id).toBe(false);
          }
        }
      }
    } finally {
      input.remove();
      textarea.remove();
      editable.remove();
    }
  });
});

describe('the `1` notice (flows §7.3)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetToasts();
  });

  it('says nothing on a device that never ran M8', () => {
    noteKeyOneChanged();
    expect(hasToast('keymap-notice')).toBe(false);
    expect(localStorage.getItem(KEYMAP_NOTICE_STORAGE_KEY)).toBeNull();
  });

  it('says it once on a device M8 left its layout on', () => {
    localStorage.setItem(V2_LAYOUT_STORAGE_KEY, JSON.stringify({ leftPanelOpen: true }));
    noteKeyOneChanged();
    expect(hasToast('keymap-notice')).toBe(true);
    resetToasts();
    noteKeyOneChanged();
    expect(hasToast('keymap-notice')).toBe(false);
  });
});
