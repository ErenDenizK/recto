/**
 * What the Settings sheet holds and how its search finds it (components/07-sheets.md S3 §2, §6;
 * flows.md §9.5; spec redesign D0-10, 07.8). Pure: no React, no stores.
 *
 * - **Sections** in the order of 07 S3's anatomy, then the rows that push a page (Privacy,
 *   Keyboard shortcuts, About Recto) in an unlabelled last group.
 * - **Rows** are the settings that exist today, and only those: a feature that is not built has
 *   no row (no placeholders). Each names the palette commands that reach it (`commands`), so
 *   every setting is also one ⌘K away; `settings-commands.test.ts` holds that to the registry.
 * - **Pushed pages** (07 §2, the S0 page stack): a row with `opens` pushes that page; a row
 *   with `page` lives inside one, and search lists it under the page's row.
 * - **Search** matches every word of the query against the row's title, its section or page
 *   and its keywords, in **every** UI language, folding case and diacritics the way the
 *   palette does (`commands/fuzzy.ts`): "saydamlik" finds "Saydamlığı azalt" in the English
 *   UI, and "glass" finds it in the Turkish one.
 *
 * **Extension point (D0-11, Saved signatures).** Add `'signatures'` to `SettingsPageId`, a
 * `savedSignatures` row in `documents` with `opens: 'signatures'` (after `keptDocuments`, as
 * in 07 S3's anatomy), its title and keywords messages, and its page in
 * `SettingsSheet.tsx`'s `PAGES`; search, ⌘K coverage and the page stack follow from here.
 */
import { foldForSearch } from '../commands/fuzzy';
import { type Locale, locales, m } from '../i18n';
import { PRODUCT_NAME } from '../shell/about/build-info';

/** A text in a given UI language (a message called with `{ locale }`). */
export type LocalText = (locale?: Locale) => string;

export type SettingsSectionId =
  | 'appearance'
  | 'language'
  | 'pen'
  | 'documents'
  /** Rows that push a page: Privacy, Keyboard shortcuts, About Recto. */
  | 'more';

/** The pages a row pushes (07 S3 §2: four long sections push a page). */
export type SettingsPageId = 'kept' | 'privacy' | 'about';

export type SettingsRowId =
  | 'glassPanels'
  | 'reduceTransparency'
  | 'language'
  | 'penDrawsInEdit'
  | 'keptDocuments'
  | 'recents'
  | 'commentName'
  | 'showTips'
  | 'privacy'
  | 'privacyRequests'
  | 'privacyOffline'
  | 'shortcuts'
  | 'about'
  | 'aboutVersion'
  | 'aboutCommit'
  | 'aboutBuildDate'
  | 'aboutReleaseNotes'
  | 'aboutLicence'
  | 'aboutSource'
  | 'aboutStorage'
  | 'aboutOffline'
  | 'aboutPage';

export interface SettingsSection {
  readonly id: SettingsSectionId;
  /** The heading; null for the unlabelled last group (its rows name themselves). */
  readonly title: LocalText | null;
}

export interface SettingsPage {
  readonly id: SettingsPageId;
  readonly title: LocalText;
  /** The row that pushes it. */
  readonly row: SettingsRowId;
}

export interface SettingsRow {
  readonly id: SettingsRowId;
  readonly section: SettingsSectionId;
  readonly title: LocalText;
  /** Comma-separated search terms, per language. */
  readonly keywords?: LocalText;
  /** The page this row lives in (it shows only there; search lists it under the page's row). */
  readonly page?: SettingsPageId;
  /** The page this row pushes. */
  readonly opens?: SettingsPageId;
  /** Palette commands that reach this setting (⌘K): open it, or set its value. */
  readonly commands: readonly string[];
}

const at =
  (message: (inputs?: Record<string, never>, options?: { locale?: Locale }) => string): LocalText =>
  (locale) =>
    message({}, locale ? { locale } : undefined);

const aboutTitle: LocalText = (locale) =>
  m.about_command({ name: PRODUCT_NAME }, locale ? { locale } : undefined);

/** Sections in their order on the sheet. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { id: 'appearance', title: at(m.settings_section_appearance) },
  { id: 'language', title: at(m.settings_section_language) },
  { id: 'pen', title: at(m.settings_section_pen) },
  { id: 'documents', title: at(m.settings_section_documents) },
  { id: 'more', title: null },
];

export const SETTINGS_PAGES: readonly SettingsPage[] = [
  { id: 'kept', title: at(m.settings_kept_documents), row: 'keptDocuments' },
  { id: 'privacy', title: at(m.settings_section_privacy), row: 'privacy' },
  { id: 'about', title: aboutTitle, row: 'about' },
];

const ABOUT = ['help.about'] as const;
const PRIVACY = ['settings.privacy'] as const;

/** Every row, in its order on the sheet (a page's rows in their order on the page). */
export const SETTINGS_ROWS: readonly SettingsRow[] = [
  {
    id: 'glassPanels',
    section: 'appearance',
    title: at(m.appearance_glass_panels),
    keywords: at(m.settings_glass_panels_keywords),
    commands: ['view.glassPanels', 'settings.appearance'],
  },
  {
    id: 'reduceTransparency',
    section: 'appearance',
    title: at(m.appearance_reduce_transparency),
    keywords: at(m.settings_reduce_transparency_keywords),
    commands: ['view.reduceTransparency', 'settings.appearance'],
  },
  {
    id: 'language',
    section: 'language',
    title: at(m.settings_section_language),
    keywords: at(m.settings_language_keywords),
    commands: ['language.en', 'language.tr', 'language.browser'],
  },
  {
    id: 'penDrawsInEdit',
    section: 'pen',
    title: at(m.pen_draws_in_edit),
    keywords: at(m.settings_pen_draws_keywords),
    commands: ['view.penDrawsInEdit'],
  },
  {
    id: 'keptDocuments',
    section: 'documents',
    title: at(m.settings_kept_documents),
    keywords: at(m.settings_kept_documents_keywords),
    opens: 'kept',
    commands: ['settings.keptDocuments'],
  },
  // D0-11: the `savedSignatures` row goes here (see the module comment).
  {
    id: 'recents',
    section: 'documents',
    title: at(m.settings_recents),
    keywords: at(m.settings_recents_keywords),
    commands: ['file.clearRecents'],
  },
  {
    id: 'commentName',
    section: 'documents',
    title: at(m.settings_comment_name),
    keywords: at(m.settings_comment_name_keywords),
    commands: ['settings.commentName', 'comments.setAuthor'],
  },
  {
    id: 'showTips',
    section: 'documents',
    title: at(m.settings_show_tips),
    keywords: at(m.settings_show_tips_keywords),
    commands: ['settings.showTips'],
  },
  {
    id: 'privacy',
    section: 'more',
    title: at(m.settings_section_privacy),
    keywords: at(m.settings_privacy_keywords),
    opens: 'privacy',
    commands: PRIVACY,
  },
  {
    id: 'privacyRequests',
    section: 'more',
    page: 'privacy',
    title: at(m.settings_privacy_requests),
    commands: PRIVACY,
  },
  {
    id: 'privacyOffline',
    section: 'more',
    page: 'privacy',
    title: at(m.privacy_offline_heading),
    commands: PRIVACY,
  },
  {
    id: 'shortcuts',
    section: 'more',
    title: at(m.keyboard_shortcuts),
    keywords: at(m.settings_shortcuts_keywords),
    commands: ['help.shortcuts'],
  },
  {
    id: 'about',
    section: 'more',
    title: aboutTitle,
    keywords: at(m.settings_about_keywords),
    opens: 'about',
    commands: ABOUT,
  },
  {
    id: 'aboutVersion',
    section: 'more',
    page: 'about',
    title: at(m.about_version),
    commands: ABOUT,
  },
  { id: 'aboutCommit', section: 'more', page: 'about', title: at(m.about_commit), commands: ABOUT },
  {
    id: 'aboutBuildDate',
    section: 'more',
    page: 'about',
    title: at(m.about_build_date),
    commands: ABOUT,
  },
  {
    id: 'aboutReleaseNotes',
    section: 'more',
    page: 'about',
    title: at(m.about_release_notes),
    commands: ABOUT,
  },
  {
    id: 'aboutLicence',
    section: 'more',
    page: 'about',
    title: at(m.about_license),
    commands: ABOUT,
  },
  { id: 'aboutSource', section: 'more', page: 'about', title: at(m.about_source), commands: ABOUT },
  {
    id: 'aboutStorage',
    section: 'more',
    page: 'about',
    title: at(m.about_storage),
    commands: ABOUT,
  },
  {
    id: 'aboutOffline',
    section: 'more',
    page: 'about',
    title: at(m.about_offline),
    commands: ABOUT,
  },
  {
    id: 'aboutPage',
    section: 'more',
    page: 'about',
    title: at(m.menu_about_page),
    commands: ['help.aboutPage'],
  },
];

export function rowById(id: SettingsRowId): SettingsRow | undefined {
  return SETTINGS_ROWS.find((row) => row.id === id);
}

export function pageById(id: SettingsPageId): SettingsPage | undefined {
  return SETTINGS_PAGES.find((page) => page.id === id);
}

export function sectionById(id: SettingsSectionId): SettingsSection | undefined {
  return SETTINGS_SECTIONS.find((section) => section.id === id);
}

/** A row's keywords in every UI language (the palette commands that reach it share them). */
export function rowKeywords(id: SettingsRowId): string[] {
  const row = rowById(id);
  if (!row?.keywords) return [];
  const all = new Set<string>();
  for (const locale of locales) {
    for (const word of row.keywords(locale).split(',')) {
      const trimmed = word.trim();
      if (trimmed) all.add(trimmed);
    }
  }
  return [...all];
}

/** Every text a row is found by, in every UI language, folded for matching. */
export function rowHaystack(row: SettingsRow): string {
  const parts: string[] = [];
  const where = row.page ? pageById(row.page)?.title : sectionById(row.section)?.title;
  for (const locale of locales) {
    parts.push(row.title(locale));
    if (where) parts.push(where(locale));
    if (row.keywords) parts.push(row.keywords(locale));
  }
  return foldForSearch(parts.join(' \u0000 ').normalize('NFC'));
}

const haystacks = new Map<SettingsRowId, string>();

function haystackOf(row: SettingsRow): string {
  let text = haystacks.get(row.id);
  if (text === undefined) {
    text = rowHaystack(row);
    haystacks.set(row.id, text);
  }
  return text;
}

/** The query's words, folded; empty when there is nothing to search for. */
export function queryWords(query: string): string[] {
  return foldForSearch(query.normalize('NFC')).split(/\s+/).filter(Boolean);
}

/**
 * The rows whose texts hold every word of `query` (07 S3 §6: by EN and TR keywords, without
 * diacritics, as ⌘K), in sheet order. `rows` defaults to every row; the sheet passes the rows
 * it shows (Keyboard shortcuts waits for a keyboard on touch).
 */
export function searchSettings(
  query: string,
  rows: readonly SettingsRow[] = SETTINGS_ROWS,
): SettingsRow[] {
  const words = queryWords(query);
  if (words.length === 0) return [...rows];
  return rows.filter((row) => {
    const text = haystackOf(row);
    return words.every((word) => text.includes(word));
  });
}
