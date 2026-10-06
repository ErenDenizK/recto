/**
 * Key map v2 (flows §7.2–§7.3; spec D2-7): how the bound commands read in the shortcuts
 * overlay (`07-sheets` S22 §23). The registry stays the single source of every binding (each
 * command's `shortcut`); this file only says where each binding is listed, which bindings
 * may share a key, and the rows for keys a focused control or the browser handles.
 *
 * - **Groups** (S22 §23.2, §23.5): Places · Tools · On a selection · Pages · Files · View ·
 *   Commands · History, in that order, then the keys of focused lists and bars.
 * - **Merged rows:** one key that acts by context reads as one row: Esc's ladder (flows §7.2
 *   "Esc ladder"), Delete on a selected object, J and K through a list (Compare changes,
 *   redaction marks, OCR words).
 * - **Shared keys:** two commands may bind one key only when listed in `SHARED_KEYS`, where
 *   their `when`s never hold together (`keymap.test.tsx` fails on any other).
 */
import { m } from '../i18n';
import type { Command } from './registry';
import { type ParsedShortcut, parseShortcut } from './shortcuts';

export const KEYMAP_GROUPS = [
  'places',
  'tools',
  'selection',
  'pages',
  'files',
  'view',
  'commands',
  'history',
] as const;

export type KeymapGroup = (typeof KEYMAP_GROUPS)[number];

/** The overlay's group headings (S22 §23.5), in the active language. */
export function keymapGroupTitle(group: KeymapGroup): string {
  switch (group) {
    case 'places':
      return m.keymap_group_places();
    case 'tools':
      return m.keymap_group_tools();
    case 'selection':
      return m.keymap_group_selection();
    case 'pages':
      return m.keymap_group_pages();
    case 'files':
      return m.keymap_group_files();
    case 'view':
      return m.keymap_group_view();
    case 'commands':
      return m.keymap_group_commands();
    case 'history':
      return m.keymap_group_history();
  }
}

/** Rows that several commands make together; the title says what the key does. */
export type MergedRow = 'escape' | 'delete-object' | 'step-next' | 'step-previous';

export function mergedRowTitle(row: MergedRow): string {
  switch (row) {
    case 'escape':
      return m.keymap_row_escape();
    case 'delete-object':
      return m.keymap_row_delete_object();
    case 'step-next':
      return m.keymap_row_step_next();
    case 'step-previous':
      return m.keymap_row_step_previous();
  }
}

export interface KeymapEntry {
  readonly group: KeymapGroup;
  /** Listed under this merged row instead of its own title. */
  readonly row?: MergedRow;
  /** The row's title when the group says it better than the command's title. */
  readonly title?: () => string;
}

/**
 * Where each bound command is listed (flows §7.2's areas mapped onto S22's groups), in the
 * order the overlay reads them; the tools follow the palette's order (registration).
 */
export const KEYMAP_ENTRIES: Readonly<Record<string, KeymapEntry>> = {
  // Places: 0 1 M/2 3 4.
  'view.home': { group: 'places' },
  'mode.read': { group: 'places' },
  'mode.edit': { group: 'places' },
  'mode.arrange': { group: 'places' },
  'mode.compare': { group: 'places' },
  // On a selection: the text markups that have no palette place (MK-2), Delete.
  'tool.underline': { group: 'selection', title: m.keymap_row_underline },
  'tool.strikeout': { group: 'selection', title: m.keymap_row_strikeout },
  'annotation.delete': { group: 'selection', row: 'delete-object' },
  'image.delete': { group: 'selection', row: 'delete-object' },
  // Pages.
  'pages.selectAll': { group: 'pages' },
  'pages.rotateRight': { group: 'pages' },
  'pages.rotateLeft': { group: 'pages' },
  'pages.delete': { group: 'pages' },
  'pages.duplicate': { group: 'pages' },
  'pages.moveBackward': { group: 'pages' },
  'pages.moveForward': { group: 'pages' },
  'pages.moveToRowStart': { group: 'pages' },
  'pages.moveToRowEnd': { group: 'pages' },
  'pages.moveToStart': { group: 'pages' },
  'pages.moveToEnd': { group: 'pages' },
  'pages.cut': { group: 'pages' },
  'pages.copy': { group: 'pages' },
  'pages.paste': { group: 'pages' },
  'pages.pasteDuplicate': { group: 'pages' },
  'pages.extract': { group: 'pages' },
  'section.rename': { group: 'pages' },
  // Files.
  'file.open': { group: 'files' },
  'file.save': { group: 'files' },
  'file.export': { group: 'files' },
  'tab.close': { group: 'files' },
  // View, with the steps through lists.
  'search.open': { group: 'view' },
  'search.next': { group: 'view' },
  'search.previous': { group: 'view' },
  'nav.goToPage': { group: 'view' },
  'nav.previousPage': { group: 'view' },
  'nav.nextPage': { group: 'view' },
  'view.focus': { group: 'view' },
  'view.toggleLeftPanel': { group: 'view' },
  'zoom.in': { group: 'view' },
  'zoom.out': { group: 'view' },
  'zoom.fit': { group: 'view' },
  'nav.screenDown': { group: 'view' },
  'nav.screenUp': { group: 'view' },
  'nav.firstPage': { group: 'view' },
  'nav.lastPage': { group: 'view' },
  'compare.next': { group: 'view', row: 'step-next' },
  'redaction.next': { group: 'view', row: 'step-next' },
  'ocr.nextWord': { group: 'view', row: 'step-next' },
  'compare.previous': { group: 'view', row: 'step-previous' },
  'redaction.previous': { group: 'view', row: 'step-previous' },
  'ocr.previousWord': { group: 'view', row: 'step-previous' },
  // Commands, with Esc's ladder.
  'view.palette': { group: 'commands' },
  'help.shortcuts': { group: 'commands' },
  'settings.open': { group: 'commands' },
  'selection.clear': { group: 'commands', row: 'escape' },
  'view.leaveFocus': { group: 'commands', row: 'escape' },
  'grid.done': { group: 'commands', row: 'escape' },
  'compare.leave': { group: 'commands', row: 'escape' },
  // History.
  'edit.undo': { group: 'history' },
  'edit.redo': { group: 'history' },
};

/** Where a bound command is listed: its entry, or Tools for every tool key. */
export function keymapEntry(id: string): KeymapEntry | undefined {
  const entry = KEYMAP_ENTRIES[id];
  if (entry) return entry;
  if (id.startsWith('tool.')) return { group: 'tools' };
  return undefined;
}

/**
 * Keys more than one command binds, and the commands that may bind each: they act by
 * context (Esc's ladder, Delete on what is selected, J/K in the list on screen), and the
 * registry runs the first one whose `when` holds.
 */
export const SHARED_KEYS: Readonly<Record<string, readonly string[]>> = {
  Escape: ['selection.clear', 'view.leaveFocus', 'grid.done', 'compare.leave'],
  Delete: ['annotation.delete', 'image.delete', 'pages.delete'],
  Backspace: ['annotation.delete', 'image.delete', 'pages.delete'],
  J: ['compare.next', 'redaction.next', 'ocr.nextWord'],
  K: ['compare.previous', 'redaction.previous', 'ocr.previousWord'],
};

/** A binding in one canonical spelling (`Mod+Shift+Z`, `Escape`, `J`), for comparisons. */
export function bindingKey(shortcut: ParsedShortcut): string {
  const parts: string[] = [];
  if (shortcut.mod) parts.push('Mod');
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.meta) parts.push('Meta');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  parts.push(key === ' ' ? 'Space' : key);
  return parts.join('+');
}

/**
 * Rows the overlay adds beside the commands' own: a command's key read on a text selection
 * (flows §7.2 "On a selection", `03-markup` §5: H and X act on it and never arm), its keys
 * taken from the command so the registry stays the source; and keys the browser handles.
 */
export const EXTRA_ROWS: readonly {
  readonly id: string;
  readonly group: KeymapGroup;
  readonly title: () => string;
  /** The command whose keys the row shows. */
  readonly command?: string;
  /** Keys no command binds (the browser's copy). */
  readonly keys?: readonly string[];
  /** Where it reads: just before or after a `KEYMAP_ENTRIES` row. */
  readonly place: { readonly before: string } | { readonly after: string };
}[] = [
  {
    id: 'selection.highlight',
    group: 'selection',
    title: m.keymap_row_highlight,
    command: 'tool.highlighter',
    place: { before: 'tool.underline' },
  },
  {
    id: 'selection.redact',
    group: 'selection',
    title: m.keymap_row_redact,
    command: 'tool.redact',
    place: { after: 'tool.strikeout' },
  },
  {
    id: 'selection.copy',
    group: 'selection',
    title: m.keymap_row_copy,
    keys: ['Mod+C'],
    place: { after: 'tool.strikeout' },
  },
  {
    id: 'commands.regions',
    group: 'commands',
    title: m.keymap_row_regions,
    keys: ['F6', 'Shift+F6'],
    place: { after: 'settings.open' },
  },
];

const ENTRY_ORDER = new Map(Object.keys(KEYMAP_ENTRIES).map((id, index) => [id, index]));

/** Where a row reads in its group: its entry's place; the tools (no entry) after, in order. */
function rankOf(id: string, commands: readonly string[] = [id]): number {
  const extra = EXTRA_ROWS.findIndex((row) => row.id === id);
  const row = EXTRA_ROWS[extra];
  if (row) {
    const anchor = 'before' in row.place ? row.place.before : row.place.after;
    const side = 'before' in row.place ? -0.5 : 0.5;
    return (ENTRY_ORDER.get(anchor) ?? Number.MAX_SAFE_INTEGER) + side + extra / 100;
  }
  return Math.min(...commands.map((c) => ENTRY_ORDER.get(c) ?? Number.MAX_SAFE_INTEGER));
}

/** In-widget keys: a focused list, bar or field handles them, not the registry. */
export const WIDGET_KEYS: readonly { title: () => string; keys: readonly ParsedShortcut[] }[] = [
  { title: m.shortcuts_move_tabs, keys: [parseShortcut('Left'), parseShortcut('Right')] },
  { title: m.shortcuts_close_tab, keys: [parseShortcut('Delete')] },
  { title: m.shortcuts_move_tools, keys: [parseShortcut('Left'), parseShortcut('Right')] },
  { title: m.shortcuts_rename_card, keys: [parseShortcut('F2')] },
  { title: m.shortcuts_move_card, keys: [parseShortcut('Alt+Left'), parseShortcut('Alt+Right')] },
  { title: m.shortcuts_resize_panel, keys: [parseShortcut('Left'), parseShortcut('Right')] },
  { title: m.shortcuts_move_focus_pages, keys: [parseShortcut('Left'), parseShortcut('Down')] },
  {
    title: m.shortcuts_extend_selection,
    keys: [parseShortcut('Shift+Left'), parseShortcut('Shift+Down')],
  },
  { title: m.shortcuts_toggle_selection, keys: [parseShortcut('Space')] },
  { title: m.shortcuts_move_row, keys: [parseShortcut('Alt+Up'), parseShortcut('Alt+Down')] },
  { title: m.shortcuts_open_in_read, keys: [parseShortcut('Enter')] },
  { title: m.shortcuts_outline_expand, keys: [parseShortcut('Left'), parseShortcut('Right')] },
  { title: m.shortcuts_outline_rename, keys: [parseShortcut('F2')] },
  {
    title: m.shortcuts_outline_move,
    keys: [
      parseShortcut('Alt+Up'),
      parseShortcut('Alt+Down'),
      parseShortcut('Alt+Left'),
      parseShortcut('Alt+Right'),
    ],
  },
];

/** One row of the overlay: what it does, the notes under it, and its keys. */
export interface KeymapRow {
  readonly id: string;
  readonly title: string;
  readonly notes: readonly { readonly text: string; readonly barGroup: boolean }[];
  readonly keys: readonly ParsedShortcut[];
}

/**
 * The overlay's rows from the registry's commands, in S22's groups and `KEYMAP_ENTRIES`'
 * order: each bound command once (a merged row once for all its commands), `EXTRA_ROWS` at
 * their places. A bound command with no entry is listed under Commands, so nothing bound is
 * ever missing (`keymap.test.tsx` fails on it).
 */
export function keymapRows(
  commands: readonly Command[],
  note: (command: Command) => KeymapRow['notes'],
): { readonly group: KeymapGroup; readonly rows: readonly KeymapRow[] }[] {
  const byId = new Map(commands.map((c) => [c.id, c]));
  const rows = new Map<KeymapGroup, { row: KeymapRow; rank: number }[]>(
    KEYMAP_GROUPS.map((g) => [g, []]),
  );
  // A merged row gathers its commands' keys, each once, and reads at its first command's place.
  const merged = new Map<MergedRow, { keys: ParsedShortcut[]; ids: string[] }>();
  for (const command of commands) {
    if (command.shortcuts.length === 0) continue;
    const entry = keymapEntry(command.id) ?? { group: 'commands' };
    if (entry.row !== undefined) {
      const into = merged.get(entry.row) ?? { keys: [], ids: [] };
      if (into.ids.length === 0) {
        merged.set(entry.row, into);
        const row: KeymapRow = {
          id: `row.${entry.row}`,
          title: mergedRowTitle(entry.row),
          notes: [],
          keys: into.keys,
        };
        rows.get(entry.group)?.push({ row, rank: 0 });
      }
      into.ids.push(command.id);
      for (const shortcut of command.shortcuts) {
        const key = bindingKey(shortcut);
        if (!into.keys.some((k) => bindingKey(k) === key)) into.keys.push(shortcut);
      }
      continue;
    }
    rows.get(entry.group)?.push({
      row: {
        id: command.id,
        title: (entry.title?.() ?? command.title).replace(/…$/, ''),
        notes: note(command),
        keys: command.shortcuts,
      },
      rank: rankOf(command.id),
    });
  }
  for (const extra of EXTRA_ROWS) {
    const keys = extra.command
      ? (byId.get(extra.command)?.shortcuts ?? [])
      : (extra.keys ?? []).map(parseShortcut);
    if (keys.length === 0) continue;
    rows.get(extra.group)?.push({
      row: { id: extra.id, title: extra.title(), notes: [], keys },
      rank: rankOf(extra.id),
    });
  }
  return KEYMAP_GROUPS.map((group) => ({
    group,
    rows: (rows.get(group) ?? [])
      .map(({ row, rank }) => {
        const members = [...merged.entries()].find(([name]) => row.id === `row.${name}`);
        return { row, rank: members ? rankOf(row.id, members[1].ids) : rank };
      })
      .sort((a, b) => a.rank - b.rank)
      .map(({ row }) => row),
  }));
}
