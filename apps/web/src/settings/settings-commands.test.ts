/**
 * Every setting is reachable from ⌘K (spec redesign D0-10 acceptance; 07-sheets S3 §1, §25):
 * each row of the Settings sheet names palette commands, and with the shell's commands
 * registered at least one of them exists and runs from the palette. The openers land the sheet
 * on their row; Show tips again and Follow the browser set their values.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerAppCommands } from '../commands/app-commands';
import { CommandRegistry } from '../commands/registry';
import { followsBrowser, getLocale, setLocale } from '../i18n';
import { registerAppearanceCommands } from '../shell/appearance-commands';
import { resetInputPolicyStore, useInputPolicyStore } from '../state/input-policy-store';
import { closeSheet, useSheetStore } from '../ui/sheet';
import { SETTINGS_SHEET_ID } from './open-settings';
import { SETTINGS_ROWS } from './search-index';
import { registerSettingsCommands } from './settings-commands';

let registry: CommandRegistry;
let disposers: (() => void)[] = [];

beforeEach(() => {
  registry = new CommandRegistry();
  disposers = [
    registerAppCommands(registry),
    registerAppearanceCommands(registry),
    registerSettingsCommands(registry),
  ];
});

afterEach(() => {
  for (const dispose of disposers) dispose();
  closeSheet();
  resetInputPolicyStore();
  setLocale('en');
});

describe('settings in the palette', () => {
  it('reaches every row through a registered palette command', () => {
    for (const row of SETTINGS_ROWS) {
      const registered = row.commands.filter((id) => {
        const command = registry.get(id);
        return command !== undefined && !command.hiddenInPalette;
      });
      expect(registered, `${row.id}: ${row.commands.join(', ')}`).not.toHaveLength(0);
    }
  });

  it('opens Settings with Mod+, and at a row from its command', async () => {
    expect(registry.get('settings.open')?.shortcuts[0]).toMatchObject({ key: ',', mod: true });
    await registry.execute('settings.open');
    expect(useSheetStore.getState().open).toMatchObject({ id: SETTINGS_SHEET_ID, preset: null });
    await registry.execute('settings.commentName');
    expect(useSheetStore.getState().open?.preset).toBe('row:commentName');
    await registry.execute('settings.appearance');
    expect(useSheetStore.getState().open?.preset).toBe('section:appearance');
    // "About Recto" opens the About Recto page where the dialog was.
    await registry.execute('help.about');
    expect(useSheetStore.getState().open).toMatchObject({
      id: SETTINGS_SHEET_ID,
      preset: 'row:about',
    });
  });

  it('shows tips again only when one has been used up', async () => {
    resetInputPolicyStore({ editTextHintShown: false });
    expect(await registry.execute('settings.showTips')).toBe(false);
    resetInputPolicyStore({ editTextHintShown: true });
    expect(await registry.execute('settings.showTips')).toBe(true);
    expect(useInputPolicyStore.getState().editTextHintShown).toBe(false);
  });

  it('follows the browser’s language, and a chosen language stops following', async () => {
    setLocale('tr');
    expect(followsBrowser()).toBe(false);
    expect(await registry.execute('language.browser')).toBe(true);
    expect(followsBrowser()).toBe(true);
    // The test browser asks for English.
    expect(getLocale()).toBe('en');
    expect(registry.isEnabled(registry.get('language.browser')!)).toBe(false);
    setLocale('tr');
    expect(followsBrowser()).toBe(false);
  });
});
