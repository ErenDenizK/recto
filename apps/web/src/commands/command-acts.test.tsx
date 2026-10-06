/**
 * The registry coverage test (ADR-0030 §2.3; redesign spec §10.1, D1-2), Vitest browser mode:
 * every command the app registers declares its act, a committing command without one fails
 * registration, the acts the spec names are the ones declared, and on an open document the
 * guard dims what cannot run with its reason (the palette, the section menu) while reading,
 * Save, sheets and Undo stay available.
 */
import '../styles/tokens.css';
import '../styles/reset.css';
import '../styles/global.css';

import { act, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import simpleUrl from '../../../../test/fixtures/simple-text.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { registerDocumentCommands } from '../document/document-commands';
import { setLocale } from '../i18n';
import { registerOutlineCommands } from '../outline/outline-commands';
import { registerSettingsCommands } from '../settings/settings-commands';
import { CommandPalette } from '../shell/CommandPalette';
import { registerAppearanceCommands } from '../shell/appearance-commands';
import { registerSignatureCommands } from '../signatures/signature-commands';
import { registerFocusCommands } from '../shell/frame/focus-mode';
import { registerArrangeCommands } from '../stage/arrange-commands';
import { resolveSectionItem, sectionMenuItems } from '../stage/section-menu';
import { type Act, isAct } from '../state/guard';
import { resetLockStore, useLockStore } from '../state/lock-store';
import { useSelectionStore } from '../state/selection-store';
import { useUiStore } from '../state/ui-store';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import { registerAppCommands } from './app-commands';
import { type CommandDefinition, CommandRegistry, commandRegistry } from './registry';

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

/**
 * Acts the spec names (ADR-0030 §2.2, X12, X31, X32, X34, 07-sheets): a change of the declared
 * act of any of these is a change of the spec.
 */
const SPEC_ACTS: Readonly<Record<string, Act | null>> = {
  // Page structure: move, rotate, delete, insert, duplicate, crop; Split removes (X32).
  'pages.rotateRight': 'pages',
  'pages.rotateLeft': 'pages',
  'pages.delete': 'pages',
  'pages.duplicate': 'pages',
  'pages.moveBackward': 'pages',
  'pages.moveForward': 'pages',
  'pages.moveToStart': 'pages',
  'pages.insertBlank': 'pages',
  'pages.extract': null,
  'pages.cut': 'pages',
  'pages.paste': 'pages',
  'pages.crop': 'pages',
  'pages.resize': 'pages',
  'section.reverse': 'pages',
  'section.split': 'pages',
  'section.insertImages': 'pages',
  // Whole-document operations; rename at every entry point (X31); Revert (07-sheets S1).
  'document.pageNumbers': 'document',
  'document.headerFooter': 'document',
  'document.bates': 'document',
  'document.watermark': 'document',
  'document.watermark.remove': 'document',
  'document.ocr': 'document',
  'document.info': 'document',
  'document.stripMetadata': 'document',
  'document.setPassword': 'document',
  'document.removePassword': 'document',
  'section.rename': 'document',
  'file.revert': 'document',
  'forms.clear': 'document',
  // The pointer creates.
  'tool.ink': 'freehand',
  'tool.highlighter': 'freehand',
  'tool.eraser': 'freehand',
  'tool.lasso': 'freehand',
  'tool.rectangle': 'freehand',
  'tool.underline': 'freehand',
  'tool.redact': 'freehand',
  // An object at a point (X34).
  'tool.note': 'place',
  'tool.text-box': 'place',
  'tool.signature': 'place',
  'tool.stamp': 'place',
  'stamp.image': 'place',
  'forms.add.text': 'place',
  'forms.add.checkbox': 'place',
  // The paragraph editor; chosen objects.
  'tool.edit-text': 'text',
  'tool.image': 'targeted',
  'annotation.delete': 'targeted',
  'image.delete': 'targeted',
  'redaction.markMatches': 'targeted',
  // No document changes: outputs, reading, history, Combine and Interleave (X32), close (X12).
  'tool.select': null,
  'file.save': null,
  'file.export': null,
  'file.open': null,
  'document.sign': null,
  'document.compress': null,
  'document.batch': null,
  'edit.undo': null,
  'edit.redo': null,
  'edit.history': null,
  'tab.close': null,
  'section.close': null,
  'documents.mergeAll': null,
  'section.interleave': null,
  'pages.copy': null,
  'pages.copyToNew': null,
  'mode.compare': null,
  'search.open': null,
};

let dispose: () => void = () => undefined;
beforeAll(() => {
  dispose = registerEverything(commandRegistry);
});
afterAll(() => {
  dispose();
});

describe('the registry coverage (ADR-0030 §2.3)', () => {
  it('every command the app registers declares its act', () => {
    const commands = commandRegistry.list();
    expect(commands.length).toBeGreaterThan(120);
    const undeclared = commands.filter((c) => c.act !== null && !isAct(c.act));
    expect(undeclared.map((c) => c.id)).toEqual([]);
    // `via` says how an act is reached, so it comes only with one; a Markup door makes
    // a freehand, place, text or targeted act (ADR-0029 §2.2), never page structure.
    for (const command of commands) {
      if (command.via === undefined) continue;
      expect(command.act, command.id).not.toBeNull();
      if (command.via === 'markup') {
        expect(['freehand', 'place', 'text', 'targeted'], command.id).toContain(command.act);
      }
    }
  });

  it('declares the acts the spec names', () => {
    const declared = Object.fromEntries(
      Object.keys(SPEC_ACTS).map((id) => [id, commandRegistry.get(id)?.act]),
    );
    expect(declared).toEqual(SPEC_ACTS);
  });

  it('fails when a committing command declares no act', () => {
    const registry = new CommandRegistry();
    const register = registry.register.bind(registry);
    vi.spyOn(registry, 'register').mockImplementation((definition: CommandDefinition) => {
      if (definition.id !== 'pages.rotateRight') return register(definition);
      const { act: _forgotten, ...rest } = definition;
      return register(rest as CommandDefinition);
    });
    expect(() => registerAppCommands(registry)).toThrow(
      'Command "pages.rotateRight" declares no act',
    );
  });
});

describe('the guard on an open document (dimmed items carry their reason)', () => {
  beforeEach(async () => {
    resetWorkspace();
    await useWorkspaceStore.getState().openFiles([await fixtureFile(simpleUrl, 'simple.pdf')]);
    const doc = useWorkspaceStore.getState().workspace;
    const id = doc.activeDocument;
    const first = id === undefined ? undefined : doc.documents[id]?.pages[0]?.id;
    if (first === undefined) throw new Error('no page');
    useSelectionStore
      .getState()
      .apply({ selected: new Set([first]), anchor: first, focused: first });
    // The selection shows in the navigator, so Delete is offered on the page (S10).
    useSelectionStore.getState().setNavigatorDocument(id ?? null);
    useUiStore.setState({ destination: 'document', docUi: {} });
  });
  afterEach(() => {
    act(() => {
      useUiStore.setState({ paletteOpen: false });
    });
    useSelectionStore.getState().apply({ selected: new Set(), anchor: null, focused: null });
    useSelectionStore.getState().setNavigatorDocument(null);
    resetLockStore();
    resetWorkspace();
    setLocale('en');
  });

  const active = () => {
    const id = useWorkspaceStore.getState().workspace.activeDocument;
    if (id === undefined) throw new Error('no document');
    return id;
  };
  const command = (id: string) => {
    const found = commandRegistry.get(id);
    if (!found) throw new Error(`no ${id}`);
    return found;
  };
  const enabled = (id: string) => commandRegistry.isEnabled(command(id));
  const reason = (id: string) => commandRegistry.disabledReason(command(id));

  it('dims every committing command of a locked document with "Locked · unlock first"', async () => {
    expect(enabled('pages.rotateRight')).toBe(true);
    useLockStore.getState().lock(active());
    for (const id of [
      'pages.rotateRight',
      'pages.delete',
      'tool.ink',
      'tool.note',
      'stamp.image',
    ]) {
      expect(enabled(id), id).toBe(false);
      expect(reason(id), id).toBe('Locked · unlock first');
    }
    const before = useWorkspaceStore.getState().workspace;
    expect(await commandRegistry.execute('pages.rotateRight')).toBe(false);
    expect(useWorkspaceStore.getState().workspace).toBe(before);
    useLockStore.getState().unlock(active());
    expect(enabled('pages.rotateRight')).toBe(true);
    expect(enabled('tool.ink')).toBe(true);
  });

  it('keeps reading, Save, sheets and Undo available while locked (flows §2.6)', () => {
    useLockStore.getState().lock(active(), 'default');
    for (const id of ['file.save', 'search.open', 'document.pageNumbers', 'pages.copyToNew']) {
      expect(enabled(id), id).toBe(true);
      expect(reason(id), id).toBeUndefined();
    }
  });

  it('dims Add field outside Markup with "Open Markup to place" (X34)', () => {
    expect(enabled('forms.add.text')).toBe(false);
    expect(reason('forms.add.text')).toBe('Open Markup to place');
    useUiStore.getState().openMarkup(active());
    expect(enabled('forms.add.text')).toBe(true);
  });

  it('gives the section menu the guard’s reason for a locked section (X31)', () => {
    const id = active();
    const rename = sectionMenuItems().find((item) => item.command === 'section.rename');
    if (!rename) throw new Error('no rename item');
    expect(resolveSectionItem(rename, id)).toMatchObject({ enabled: true, hint: undefined });
    useLockStore.getState().lock(id);
    expect(resolveSectionItem(rename, id)).toMatchObject({
      enabled: false,
      hint: 'Locked · unlock first',
    });
  });

  it('shows the reason on the dimmed palette row, in the keycap’s place', async () => {
    useLockStore.getState().lock(active());
    render(<CommandPalette />);
    act(() => {
      useUiStore.setState({ paletteOpen: true });
    });
    await userEvent.keyboard('Rotate right');
    const options = await screen.findAllByRole('option');
    const option = options.find((o) => o.textContent?.startsWith('Rotate pages right'));
    if (!option) throw new Error('no Rotate pages right row');
    // The reason is the row's description, not part of its name.
    expect(option).not.toHaveAccessibleName(/Locked/);
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveAccessibleDescription('Locked · unlock first');
  });
});
