/**
 * The Settings sheet's palette commands (components/07-sheets.md S3 §1, §25; spec redesign
 * D0-10: "every setting reachable from ⌘K and the sheet"). Each row of `search-index.ts` names
 * the commands that reach it; the ones that set a value live beside their store (the
 * appearance toggles in `shell/appearance-commands.ts`, the pen in `viewer/edit-policy.ts`,
 * the two languages in `i18n/language-commands.ts`, Clear recents in `app-commands.ts`) and
 * these open the sheet where a setting has no one-step value:
 *
 * - **Settings…** (Mod+, where the browser leaves it) opens the sheet;
 * - **Appearance settings…** opens it at Appearance (the Appearance submenu's successor);
 * - **Kept documents…**, **Saved signatures…**, **Privacy settings…** push their page; **Name on comments…** focuses
 *   the field;
 * - **Show tips again** resets the one-time hints, and **Language: follow the browser** sets the
 *   third language choice (07.8).
 *
 * "About Recto" (`help.about`, app-commands) opens the About Recto page.
 */
import type { CommandRegistry } from '../commands/registry';
import { chooseLocale, followsBrowser, getLocale, LOCALE_NAMES, m } from '../i18n';
import { announce } from '../shell/announcer';
import { useInputPolicyStore } from '../state/input-policy-store';
import { openSettings } from './open-settings';
import { rowKeywords } from './search-index';

/** Whether a one-time tip has been used up and "Show tips again" would bring it back. */
export function tipsToShowAgain(): boolean {
  return useInputPolicyStore.getState().editTextHintShown;
}

/**
 * "Show tips and facts again" (07.8): the one-time hints show again. Today that is the
 * "Double-click to edit text" hint (craft §3.5); the facts chip arrives with the Library (D4).
 */
export function showTipsAgain(): void {
  useInputPolicyStore.setState({ editTextHintShown: false });
  announce(m.settings_tips_reset());
}

/** Language: follow the browser (07.8); says the language it follows. */
export function followBrowserLanguage(): void {
  const changed = chooseLocale('browser');
  const say = () => announce(m.settings_language_followed({ language: LOCALE_NAMES[getLocale()] }));
  // After a language change the shell remounts; speak once the live region is back.
  if (changed) setTimeout(say, 100);
  else say();
}

export function registerSettingsCommands(registry: CommandRegistry): () => void {
  const disposers = [
    registry.register({
      id: 'settings.open',
      title: m.settings_command(),
      group: m.group_general(),
      shortcut: 'Mod+,',
      run: () => openSettings(),
    }),
    registry.register({
      id: 'settings.appearance',
      title: m.settings_cmd_appearance(),
      group: m.group_view(),
      run: () => openSettings({ section: 'appearance' }),
    }),
    registry.register({
      id: 'language.browser',
      title: m.settings_cmd_language_browser(),
      group: m.group_language(),
      keywords: ['language', 'dil', 'browser', 'tarayıcı', 'system', 'sistem', 'auto'],
      when: () => !followsBrowser(),
      run: followBrowserLanguage,
    }),
    registry.register({
      id: 'settings.keptDocuments',
      title: m.settings_cmd_kept(),
      group: m.group_general(),
      keywords: rowKeywords('keptDocuments'),
      run: () => openSettings({ row: 'keptDocuments' }),
    }),
    registry.register({
      id: 'settings.savedSignatures',
      title: m.settings_cmd_signatures(),
      group: m.group_general(),
      keywords: rowKeywords('savedSignatures'),
      run: () => openSettings({ row: 'savedSignatures' }),
    }),
    registry.register({
      id: 'settings.commentName',
      title: m.settings_cmd_comment_name(),
      group: m.group_general(),
      keywords: rowKeywords('commentName'),
      run: () => openSettings({ row: 'commentName' }),
    }),
    registry.register({
      id: 'settings.showTips',
      title: m.settings_show_tips(),
      group: m.group_general(),
      keywords: rowKeywords('showTips'),
      when: tipsToShowAgain,
      run: showTipsAgain,
    }),
    registry.register({
      id: 'settings.privacy',
      title: m.settings_cmd_privacy(),
      group: m.group_general(),
      keywords: rowKeywords('privacy'),
      run: () => openSettings({ row: 'privacy' }),
    }),
  ];
  return () => {
    for (const dispose of disposers) dispose();
  };
}
