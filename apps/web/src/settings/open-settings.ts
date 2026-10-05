/**
 * Opening the Settings sheet (components/07-sheets.md S3 §1, §6): one call for every opener —
 * ⌘K, Mod+, (where the browser leaves it), the Document menu's "Settings…", the privacy
 * popover's version line (→ About Recto) and the commands that used to open the About dialog
 * or the Appearance submenu. A target names where the sheet opens: a section (scrolled to),
 * a row (scrolled to, its control focused) or a row that pushes a page (that page). It rides
 * on the sheet store's `preset` (07 §2.9: `{ id, docId, preset }`), so it survives the remount
 * a language change causes.
 */
import { closeSheet, openSheet, useSheetStore } from '../ui/sheet';
import {
  rowById,
  type SettingsPageId,
  type SettingsRowId,
  type SettingsSectionId,
} from './search-index';

/** The sheet's id in the sheet store; Settings belongs to the app, not to a document. */
export const SETTINGS_SHEET_ID = 'settings';

export type SettingsTarget =
  | { readonly section: SettingsSectionId }
  | { readonly row: SettingsRowId };

/** The preset string for a target. */
export function presetOf(target: SettingsTarget): string {
  return 'section' in target ? `section:${target.section}` : `row:${target.row}`;
}

/** The target a preset names, or null (none, or not one of ours). */
export function targetOf(preset: string | null): SettingsTarget | null {
  if (!preset) return null;
  const [kind, id] = preset.split(':');
  if (!id) return null;
  if (kind === 'section') return { section: id as SettingsSectionId };
  if (kind === 'row' && rowById(id as SettingsRowId)) return { row: id as SettingsRowId };
  return null;
}

/**
 * Where a target lands: the page to show (null for the main list) and the row or section to
 * reveal there. A row that pushes a page opens that page at its top.
 */
export function landingOf(target: SettingsTarget | null): {
  readonly page: SettingsPageId | null;
  readonly reveal: SettingsTarget | null;
} {
  if (!target) return { page: null, reveal: null };
  if ('section' in target) return { page: null, reveal: target };
  const row = rowById(target.row);
  if (row?.opens) return { page: row.opens, reveal: null };
  return { page: row?.page ?? null, reveal: target };
}

let returnFocus: HTMLElement | null = null;

/**
 * Opens Settings, at `target` when given (replacing any open sheet, 07 §1.1 rule 1).
 * `returnTo` takes focus when the sheet closes, for an opener that closes as the sheet opens
 * (the privacy popover's version line passes its trigger); otherwise focus returns to the
 * element focused before the sheet opened.
 */
export function openSettings(
  target?: SettingsTarget,
  options: { readonly returnTo?: HTMLElement | null } = {},
): void {
  // A second request while open (the language row's) keeps where focus goes back to.
  if (options.returnTo !== undefined || !settingsOpen()) returnFocus = options.returnTo ?? null;
  openSheet(SETTINGS_SHEET_ID, { preset: target ? presetOf(target) : null });
}

/** Where focus goes when the sheet closes, if the opener named a place that still exists. */
export function settingsReturnFocus(): HTMLElement | null {
  return returnFocus?.isConnected ? returnFocus : null;
}

export function closeSettings(): void {
  closeSheet(SETTINGS_SHEET_ID);
}

/** Whether Settings is open now. */
export function settingsOpen(): boolean {
  return useSheetStore.getState().open?.id === SETTINGS_SHEET_ID;
}
