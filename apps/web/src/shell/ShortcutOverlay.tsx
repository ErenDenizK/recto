/**
 * S22, the shortcuts overlay (components/07-sheets.md §23; DESIGN.md §4.6), on the Sheet
 * primitive: `?` toggles it, and every bound command of the registry shows with its keycaps in
 * key map v2's groups (Places · Tools · On a selection · Pages · Files · View · Commands ·
 * History, `commands/keymap.ts`); keys acting by context (Esc, J/K) read as one row. A tool, or
 * any other command the tool bar holds, also names its tool bar group ("Tool bar: Draw",
 * experience-redesign spec §5.1). The in-widget keys that are not commands (tabs, tool bar,
 * Library cards, splitters) close the list. Keycaps show the platform's modifier (⌘ or Ctrl).
 *
 * - An `overlay` sheet: centred 760 px from the medium class up, a full sheet on narrower
 *   windows (07 §1.1); one glass panel, the rows in tables (`th` the action, `td` the keys,
 *   §23.8), two columns from 1000 px.
 * - Typing filters: the search field takes focus on open, and what was typed is the sheet's
 *   draft for the session, so Esc or ✕ never loses it (07 §0).
 * - The footer note says shortcuts never fire while typing in a field.
 */
import { useId, useRef } from 'react';

import { type KeymapRow, WIDGET_KEYS, keymapGroupTitle, keymapRows } from '../commands/keymap';
import type { Command } from '../commands/registry';
import { currentPlatform, toAriaKeyShortcut } from '../commands/shortcuts';
import { useCommands } from '../commands/use-commands';
import { m } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
import { Keycaps } from '../ui/Keycaps';
import { Sheet, SheetField, useSheetDraft } from '../ui/sheet';
import { paletteGroupLabelOfCommand } from '../markup/palette-groups';
import styles from './ShortcutOverlay.module.css';

/** A tool's palette group ("Tool bar: Draw") and the command's own note, under its title. */
function notesOf(command: Command): KeymapRow['notes'] {
  const barGroup = paletteGroupLabelOfCommand(command.id);
  return [
    ...(barGroup ? [{ text: m.bar_in_group({ group: barGroup }), barGroup: true }] : []),
    ...(command.note ? [{ text: command.note, barGroup: false }] : []),
  ];
}

/** Rows whose title, notes or group hold every word of `query` (any case). */
function matches(row: KeymapRow, group: string, query: string): boolean {
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
    ...keymapRows(commands, notesOf).map(({ group, rows }) => ({
      id: group,
      group: keymapGroupTitle(group),
      rows,
    })),
    {
      id: 'widgets',
      group: m.shortcuts_in_focus(),
      rows: WIDGET_KEYS.map(
        (row): KeymapRow => ({ id: row.title(), title: row.title(), notes: [], keys: row.keys }),
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
        leading={<Icon name="magnifying-glass" />}
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
                        {/* The title in its own element, apart from its notes (§23.8). */}
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
                        {/* The caps are decorative; the cell reads the keys (§23.8). */}
                        <span className="visually-hidden">
                          {row.keys
                            .map((shortcut) => toAriaKeyShortcut(shortcut, currentPlatform))
                            .join(', ')}
                        </span>
                        <span className={styles.keyList}>
                          {/* "/" stays with the caps after it, so a wrap never ends a line. */}
                          {row.keys.map((shortcut, index) => (
                            <span key={index} className={styles.alternative}>
                              {index > 0 ? (
                                <span className={styles.or} aria-hidden="true">
                                  /
                                </span>
                              ) : null}
                              <Keycaps shortcut={shortcut} tone="onGlass" />
                            </span>
                          ))}
                        </span>
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
