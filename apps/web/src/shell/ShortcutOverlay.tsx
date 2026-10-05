/**
 * S22, the shortcuts overlay (components/07-sheets.md §23; DESIGN.md §4.6), on the Sheet
 * primitive: `?` toggles it, every registered command shows grouped with its keycaps, and a
 * tool, or any other command the tool bar holds, also names its tool bar group ("Tool bar:
 * Draw", experience-redesign spec §5.1). The in-widget keys that are not commands (tabs, tool
 * bar, splitters) close the list.
 *
 * - An `overlay` sheet: centred 760 px from the medium class up, a full sheet on narrower
 *   windows (07 §1.1); one glass panel, the rows in tables (`th` the action, `td` the keys,
 *   §23.8), two columns from 1000 px.
 * - Typing filters: the search field takes focus on open, and what was typed is the sheet's
 *   draft for the session, so Esc or ✕ never loses it (07 §0).
 * - The footer note says shortcuts never fire while typing in a field.
 */
import { Search } from 'lucide-react';
import { useId, useRef } from 'react';

import { type Command, groupCommands } from '../commands/registry';
import { type ParsedShortcut, parseShortcut } from '../commands/shortcuts';
import { useCommands } from '../commands/use-commands';
import { m } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { Keycaps } from '../ui/Keycaps';
import { Sheet, SheetField, useSheetDraft } from '../ui/sheet';
import { barGroupLabelOfCommand } from './FloatingToolbar.groups';
import styles from './ShortcutOverlay.module.css';

/** In-widget keys; `title` is a message function so it follows the active language. */
const WIDGET_KEYS: readonly { title: () => string; keys: readonly ParsedShortcut[] }[] = [
  { title: m.shortcuts_move_tabs, keys: [parseShortcut('Left'), parseShortcut('Right')] },
  { title: m.shortcuts_close_tab, keys: [parseShortcut('Delete')] },
  { title: m.shortcuts_move_tools, keys: [parseShortcut('Left'), parseShortcut('Right')] },
  { title: m.bar_shortcut_back, keys: [parseShortcut('Escape')] },
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

/** One row of the list: what it does, the notes under it, and its keys. */
interface Row {
  readonly id: string;
  readonly title: string;
  readonly notes: readonly { readonly text: string; readonly barGroup: boolean }[];
  readonly keys: readonly ParsedShortcut[];
}

function commandRow(command: Command): Row {
  const barGroup = barGroupLabelOfCommand(command.id);
  return {
    id: command.id,
    title: command.title.replace(/…$/, ''),
    notes: [
      ...(barGroup ? [{ text: m.bar_in_group({ group: barGroup }), barGroup: true }] : []),
      ...(command.note ? [{ text: command.note, barGroup: false }] : []),
    ],
    keys: command.shortcuts,
  };
}

/** Rows whose title, notes or group hold every word of `query` (any case). */
function matches(row: Row, group: string, query: string): boolean {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [row.title, group, ...row.notes.map((n) => n.text)].join(' ').toLocaleLowerCase();
  return words.every((word) => text.includes(word));
}

export function ShortcutOverlay() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const commands = useCommands();
  const [query, setQuery] = useSheetDraft('shortcuts', null, '');
  const searchRef = useRef<HTMLInputElement>(null);
  // Group names hold spaces, so the headings' ids are by position.
  const baseId = useId();

  const groups = [
    ...groupCommands(commands).map(({ group, items }) => ({
      id: group,
      group,
      rows: items.map(commandRow),
    })),
    {
      id: 'widgets',
      group: m.shortcuts_in_focus(),
      rows: WIDGET_KEYS.map(
        (row): Row => ({ id: row.title(), title: row.title(), notes: [], keys: row.keys }),
      ),
    },
  ]
    .map((g) => ({ ...g, rows: g.rows.filter((row) => matches(row, g.group, query)) }))
    .filter((g) => g.rows.length > 0);

  return (
    <Sheet
      id="shortcuts"
      kind="overlay"
      open={open}
      onClose={() => setOpen(false)}
      title={m.keyboard_shortcuts()}
      restored={query !== ''}
      initialFocus={searchRef}
      footnote={m.shortcuts_footer_note()}
      testId="shortcuts-overlay"
    >
      <SheetField
        ref={searchRef}
        type="search"
        label={m.shortcuts_search_label()}
        placeholder={m.shortcuts_search_placeholder()}
        autoComplete="off"
        spellCheck={false}
        leading={<Search aria-hidden="true" />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {groups.length === 0 ? (
        <p className={styles.empty}>{m.shortcuts_no_match({ query: query.trim() })}</p>
      ) : (
        <div className={styles.groups}>
          {groups.map(({ id, group, rows }, index) => (
            <section key={id} className={styles.group} aria-labelledby={`${baseId}-${index}`}>
              <h3 id={`${baseId}-${index}`} className={styles.groupTitle}>
                {group}
              </h3>
              <table className={styles.table} aria-labelledby={`${baseId}-${index}`}>
                <thead className="visually-hidden">
                  <tr>
                    <th scope="col">{m.shortcuts_action()}</th>
                    <th scope="col">{m.shortcuts_keys()}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className={styles.row}>
                      <th scope="row" className={styles.rowTitle}>
                        <span>{row.title}</span>
                        {row.notes.map((note) => (
                          <span
                            key={note.text}
                            className={styles.note}
                            data-bar-group-note={note.barGroup ? '' : undefined}
                          >
                            {note.text}
                          </span>
                        ))}
                      </th>
                      <td className={styles.keys}>
                        {row.keys.map((shortcut, index) => (
                          <Keycaps key={index} shortcut={shortcut} tone="onGlass" />
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
