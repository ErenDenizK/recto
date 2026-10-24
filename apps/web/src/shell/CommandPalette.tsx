/**
 * Command palette (Mod+K). Built on the Base UI Dialog (focus trap, Esc, scroll lock,
 * focus return); modal, so it says `aria-modal="true"`, which Base UI does not (07-sheets
 * §8). The list follows the APG combobox + listbox pattern: focus stays in the input and
 * `aria-activedescendant` points at the active option.
 *
 * Motion (docs/design/motion-2026-10/frame.md §2): the popup scales up from its top centre
 * over a dim-only scrim that fades in (G-31); the first six rows come in 20 ms apart; the
 * selection's fill slides from row to row on `quick` (`usePaletteFill`) instead of jumping.
 */
import { Dialog } from '@base-ui/react/dialog';
import {
  type KeyboardEvent,
  useDeferredValue,
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getActiveDocument } from '@pdf-editor/document-model';

import { fuzzyFilter } from '../commands/fuzzy';
import {
  hasFormFields,
  OPEN_DOCUMENTS_SHOWN,
  PAGE_SCOPE_COMMANDS,
  suggestionsFor,
} from '../commands/palette-scope';
import { type Command, commandRegistry, groupCommands } from '../commands/registry';
import { parseShortcut } from '../commands/shortcuts';
import { useCommands } from '../commands/use-commands';
import { loadRecents, type RecentEntry, useRecentsStore } from '../files/recents';
import { openRecent } from '../home/home-actions';
import type * as PaletteIntent from '../commands/palette-intent';
import { m } from '../i18n';
import { animateStyle, type Motion } from '../motion/animate';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { openMarkupDoor } from '../markup/doors';
import { usePagesBarSelection } from '../stage/grid/PagesBar';
import { useTextless } from './sidebar/textless';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import { Keycaps } from '../ui/Keycaps';
import styles from './CommandPalette.module.css';
import { paletteGroupLabelOfCommand } from '../markup/palette-groups';

interface Row {
  readonly command: Command;
  readonly positions: readonly number[];
  readonly enabled: boolean;
  /** Why a dimmed row cannot run ("Locked · unlock first"; ADR-0030 §2.3, RA-21). */
  readonly reason: string | undefined;
}

interface Section {
  readonly group: string;
  readonly rows: Row[];
}

/** One row as the list draws it: a command, an intent the query parsed, or a recent file. */
interface ListRow {
  readonly key: string;
  readonly title: string;
  readonly positions: readonly number[];
  readonly enabled: boolean;
  /** An intent that cannot run: its title stays legible, only its detail explains. */
  readonly invalidIntent?: boolean;
  /** Can be the active row (an invalid intent can, so Enter on it does nothing). */
  readonly focusable: boolean;
  /** Why it cannot run, or the intent's quiet detail. */
  readonly reason: string | undefined;
  readonly hint: string | undefined;
  readonly shortcut: Command['shortcuts'][number] | undefined;
  readonly command: Command | undefined;
  readonly run: () => void;
}

interface ListSection {
  readonly id: string;
  /** The visible heading; none for the intent's own rows. */
  readonly label: string | undefined;
  readonly ariaLabel: string;
  readonly rows: ListRow[];
}

/** How many recent files the empty state offers. */
const RECENT_FILES_SHOWN = 5;
/** Offered by typing "clear recents", not in the empty state's list (Epic 4). */
const HIDDEN_WHEN_EMPTY = new Set(['file.clearRecents']);

/** Internal id of the recents section; its heading is translated when rendered. */
const RECENT_GROUP = 'Recent';
/** Internal id of the selection's section ("For 3 selected pages"), translated when rendered. */
export const SCOPE_GROUP = 'Scope';

/**
 * Builds the visible sections: recents first when the query is empty, else by relevance. A
 * dimmed row carries its reason (`reasonOf`, the registry's `disabledReason`). Commands in
 * `scopeIds` (the selection's actions, PRD-29) lead as their own section in both states, ranked
 * among themselves, and leave the sections below.
 */
export function buildSections(
  query: string,
  commands: readonly Command[],
  recents: readonly string[],
  isEnabled: (command: Command) => boolean,
  reasonOf: (command: Command) => string | undefined = () => undefined,
  scopeIds: readonly string[] = [],
): Section[] {
  const visible = commands.filter((c) => !c.hiddenInPalette);
  const toRow = (command: Command, positions: readonly number[] = []): Row => {
    const enabled = isEnabled(command);
    return { command, positions, enabled, reason: enabled ? undefined : reasonOf(command) };
  };

  if (query.trim() === '') {
    const scoped = scopeIds
      .map((id) => visible.find((c) => c.id === id))
      .filter((c): c is Command => c !== undefined);
    const recentCommands = recents
      .map((id) => visible.find((c) => c.id === id))
      .filter((c): c is Command => c !== undefined && !scoped.includes(c));
    const rest = visible.filter((c) => !recentCommands.includes(c) && !scoped.includes(c));
    const sections: Section[] = [];
    if (scoped.length > 0) {
      // Scoped and nothing typed: the selection's section alone (08-feedback §2.4).
      return [{ group: SCOPE_GROUP, rows: scoped.map((c) => toRow(c)) }];
    }
    if (recentCommands.length > 0) {
      sections.push({ group: RECENT_GROUP, rows: recentCommands.map((c) => toRow(c)) });
    }
    for (const { group, items } of groupCommands(rest)) {
      sections.push({ group, rows: items.map((c) => toRow(c)) });
    }
    return sections;
  }

  const ranked = fuzzyFilter(
    query,
    visible,
    (c) => c.title,
    (c) => [...(c.keywords ?? []), c.group],
  );
  // Groups are ordered by their best match; items keep their rank inside a group. The
  // selection's matches lead (08-feedback §6: a selection action outranks a global one).
  const inScope = (id: string) => scopeIds.includes(id);
  const grouped = groupCommands(
    ranked.filter((r) => !inScope(r.item.id)).map((r) => ({ ...r, group: r.item.group })),
  );
  const scoped = ranked.filter((r) => inScope(r.item.id));
  return [
    ...(scoped.length > 0
      ? [{ group: SCOPE_GROUP, rows: scoped.map((r) => toRow(r.item, r.positions)) }]
      : []),
    ...grouped.map(({ group, items }) => ({
      group,
      rows: items.map((r) => toRow(r.item, r.positions)),
    })),
  ];
}

/** The entrance delay of the row at `index` (the first six one after another). */
const staggerStyle = (index: number): CSSProperties =>
  ({ '--row-index': Math.min(index, STAGGERED_ROWS - 1) }) as CSSProperties;

function Highlighted({
  text,
  positions,
}: {
  readonly text: string;
  readonly positions: readonly number[];
}) {
  if (positions.length === 0) return <>{text}</>;
  const set = new Set(positions);
  const parts: { text: string; match: boolean }[] = [];
  for (const [index, char] of text.split('').entries()) {
    const match = set.has(index);
    const last = parts.at(-1);
    if (last?.match === match) last.text += char;
    else parts.push({ text: char, match });
  }
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={index} className={styles.match}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

/** Rows that come in one after another when the list shows; the rest come with the last. */
const STAGGERED_ROWS = 6;

/** Where the selection's fill was last sent, and the slide taking it there. */
interface FillState {
  readonly id: string;
  /** Its row's top in the list's content (scroll included), px. */
  readonly top: number;
  readonly slide: Motion<readonly number[]> | null;
}

/**
 * The selection's fill slides (frame.md §2; language.md §7.3 *select*): each selected row draws
 * its own fill, and when the selection moves the new fill starts where the last one was drawn
 * (a slide in flight included, with its velocity) and springs home on `quick`. Nothing is left
 * inline at rest (Q-2); under reduced motion the move is instant (`animateStyle`).
 */
function usePaletteFill(list: HTMLElement | null, activeOptionId: string | undefined): void {
  const last = useRef<FillState | null>(null);
  useLayoutEffect(() => {
    if (!list || !activeOptionId) {
      last.current = null;
      return;
    }
    const option = document.getElementById(activeOptionId);
    const fill = option?.querySelector<HTMLElement>('[data-palette-fill]');
    if (!option || !fill) return;
    const listTop = list.getBoundingClientRect().top - list.scrollTop;
    const top = option.getBoundingClientRect().top - listTop;
    const was = last.current;
    if (was?.id === activeOptionId) return;
    let slide: Motion<readonly number[]> | null = null;
    if (was) {
      // Where the last fill is drawn now: its row's top plus the offset its slide has reached.
      const offset = was.slide?.value[1] ?? 0;
      const velocity = was.slide?.velocity[1] ?? 0;
      was.slide?.stop();
      const from = was.top + offset - top;
      if (Math.abs(from) > 0.5) {
        slide = animateStyle(fill, 'transform', [0, from], [0, 0], {
          spring: 'quick',
          velocity: [0, velocity],
        });
      }
    }
    last.current = { id: activeOptionId, top, slide };
  }, [list, activeOptionId]);
}

const FOOTER_KEYS = {
  navigate: [parseShortcut('Up'), parseShortcut('Down')],
  run: parseShortcut('Enter'),
  close: parseShortcut('Escape'),
};

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => setOpen(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        {/* Always rendered: the Portal unmounts it after the exit transition, so every
            open starts with fresh state. Unmounting it early would strand the backdrop. */}
        <PalettePopup
          onClose={() => {
            setOpen(false);
          }}
        />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The intent parser, its rows and their strings load on the palette's first open, in a chunk of
 * their own, so they stay out of the editor's initial bundle (V1-P2). A keystroke that comes
 * before the chunk does ranks commands as before.
 */
type IntentModule = Pick<
  typeof PaletteIntent,
  'parseQuery' | 'gatherQueryContext' | 'describeIntent' | 'runIntent'
>;
let intentModule: IntentModule | null = null;
let intentLoading: Promise<IntentModule> | null = null;
function loadIntents(): Promise<IntentModule> {
  intentLoading ??= import('../commands/palette-intent').then((loaded) => {
    intentModule = loaded;
    return loaded;
  });
  return intentLoading;
}

function PalettePopup({ onClose }: { readonly onClose: () => void }) {
  const commands = useCommands();
  const recents = useUiStore((s) => s.recents);
  const pushRecent = useUiStore((s) => s.pushRecent);
  const recentFiles = useRecentsStore((s) => s.entries);
  const [query, setQuery] = useState('');
  const [intents, setIntents] = useState<IntentModule | null>(intentModule);
  // The selected pages scope the list until the chip is removed (PRD-29, 08-feedback §6).
  const selectedPages = usePagesBarSelection().length;
  const [scopeOff, setScopeOff] = useState(false);
  const scopeCount = scopeOff ? 0 : selectedPages;
  // The chip stays mounted while its leave animation plays; the list is unscoped at once.
  const [chipLeaving, setChipLeaving] = useState(false);
  const dismissScope = () => {
    setScopeOff(true);
    setChipLeaving(true);
  };
  const workspace = useWorkspaceStore((s) => s.workspace);
  const activeDoc = getActiveDocument(workspace);
  const deferredQuery = useDeferredValue(query);
  // The active option is tracked by row key and derived into an index, so it survives
  // re-ranking and falls back to the first enabled row when filtered out.
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const baseId = useId();

  useEffect(() => {
    void loadRecents();
    loadIntents()
      .then(setIntents)
      .catch((error: unknown) => {
        console.error('Palette intents failed to load', error);
      });
  }, []);

  const emptyQuery = deferredQuery.trim() === '';
  const textless = useTextless(emptyQuery ? activeDoc : undefined);

  const sections = useMemo<ListSection[]>(() => {
    const empty = emptyQuery;
    const result: ListSection[] = [];
    // A query that reads as an intent (a page, a range, a heading, a file) shows it first, with
    // what it will do; nothing runs unseen (Epic 4).
    const intent =
      empty || !intents ? null : intents.parseQuery(deferredQuery, intents.gatherQueryContext());
    if (intent && intents) {
      result.push({
        id: 'intent',
        label: undefined,
        ariaLabel: m.palette_intent_group(),
        rows: intents.describeIntent(intent, deferredQuery).map((view, index) => ({
          key: view.key,
          title: view.label,
          positions: [],
          enabled: view.runnable,
          invalidIntent: !view.runnable,
          focusable: true,
          reason: view.detail,
          hint: undefined,
          shortcut: undefined,
          command: undefined,
          run: () => {
            if (!view.runnable) return;
            onClose();
            intents.runIntent(intent, index).catch((error: unknown) => {
              console.error('Palette intent failed', error);
            });
          },
        })),
      });
    }
    const commandSections = buildSections(
      deferredQuery,
      empty ? commands.filter((c) => !HIDDEN_WHEN_EMPTY.has(c.id)) : commands,
      recents,
      (c) => commandRegistry.isEnabled(c),
      (c) => commandRegistry.disabledReason(c),
      scopeCount > 0 ? PAGE_SCOPE_COMMANDS : [],
    );
    const scope = commandSections.find((section) => section.group === SCOPE_GROUP);
    if (scope) {
      result.push({
        id: SCOPE_GROUP,
        label: m.palette_scope_section({ count: scopeCount }),
        ariaLabel: m.palette_scope_section({ count: scopeCount }),
        rows: scope.rows.map((row) => commandRow(row, false, pushRecent, onClose)),
      });
    }
    // Scoped and nothing typed: only the selection's section (08-feedback §2.4).
    if (empty && scopeCount > 0) return result;
    const suggested =
      empty && activeDoc
        ? suggestionsFor({
            fields: hasFormFields(workspace, activeDoc),
            textlessPages: textless?.pages.length ?? 0,
          })
        : [];
    if (suggested.length > 0) {
      result.push({
        id: 'suggested',
        label: m.palette_suggested_doc(),
        ariaLabel: m.palette_suggested_doc(),
        rows: suggested.map((kind) =>
          kind === 'fill-sign'
            ? suggestionRow(
                'suggest-fill-sign',
                m.dock_fill_sign(),
                m.palette_suggest_fill(),
                () => {
                  onClose();
                  openMarkupDoor('sign');
                },
              )
            : suggestionRow(
                'suggest-recognize',
                m.ocr_cmd(),
                m.palette_suggest_recognize({ count: textless?.pages.length ?? 0 }),
                () => {
                  onClose();
                  commandRegistry.execute('document.ocr').catch((error: unknown) => {
                    console.error('Recognize text failed', error);
                  });
                },
              ),
        ),
      });
    }
    if (empty && recentFiles.length > 0) {
      result.push({
        id: 'recent-files',
        label: m.palette_recent_files(),
        ariaLabel: m.palette_recent_files(),
        rows: recentFiles.slice(0, RECENT_FILES_SHOWN).map((entry) => fileRow(entry, onClose)),
      });
    }
    // Other open documents: all of them up to four when nothing is typed, else the title matches.
    const others = workspace.documentOrder.flatMap((id) =>
      id !== workspace.activeDocument && workspace.documents[id] ? [workspace.documents[id]] : [],
    );
    const documents = empty
      ? others.slice(0, OPEN_DOCUMENTS_SHOWN).map((doc) => ({ doc, positions: [] as number[] }))
      : fuzzyFilter(deferredQuery, others, (doc) => doc.title).map((r) => ({
          doc: r.item,
          positions: r.positions,
        }));
    if (documents.length > 0) {
      result.push({
        id: 'open-documents',
        label: m.palette_open_documents(),
        ariaLabel: m.palette_open_documents(),
        rows: documents.map(({ doc, positions }) => ({
          key: `doc-${doc.id}`,
          title: doc.title,
          positions,
          enabled: true,
          focusable: true,
          reason: undefined,
          hint: m.palette_switch_to(),
          shortcut: undefined,
          command: undefined,
          run: () => {
            onClose();
            useWorkspaceStore.getState().setActive(doc.id);
          },
        })),
      });
    }
    for (const section of commandSections) {
      if (section.group === SCOPE_GROUP) continue;
      const recent = section.group === RECENT_GROUP;
      result.push({
        id: section.group,
        label: recent ? m.palette_recent() : section.group,
        ariaLabel: recent ? m.palette_recent() : section.group,
        rows: section.rows.map((row) => commandRow(row, recent, pushRecent, onClose)),
      });
    }
    return result;
  }, [
    deferredQuery,
    emptyQuery,
    commands,
    recents,
    recentFiles,
    pushRecent,
    onClose,
    intents,
    scopeCount,
    workspace,
    activeDoc,
    textless,
  ]);
  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);
  const matchedIndex = rows.findIndex((r) => r.key === activeId && r.focusable);
  const activeIndex = matchedIndex >= 0 ? matchedIndex : rows.findIndex((r) => r.focusable);
  const active = activeIndex >= 0 ? rows[activeIndex] : undefined;
  const optionId = (key: string) => `${baseId}-option-${key}`;
  const activeOptionId = active ? optionId(active.key) : undefined;

  useEffect(() => {
    if (!activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeOptionId]);
  usePaletteFill(list, activeOptionId);

  const move = (delta: 1 | -1) => {
    if (rows.length === 0) return;
    let next = activeIndex;
    let remaining = rows.length;
    do {
      next = (next + delta + rows.length) % rows.length;
      remaining -= 1;
    } while (remaining > 0 && !rows[next]?.focusable);
    setActiveId(rows[next]?.key ?? null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      active?.run();
    } else if (event.key === 'Backspace' && query === '' && scopeCount > 0) {
      // Backspace in an empty input removes the scope chip: every command again (08-feedback §6).
      event.preventDefault();
      dismissScope();
    }
  };

  const listboxId = `${baseId}-listbox`;
  // Each section's first row in the whole list, for the entrance's stagger.
  const firstRows = sections.map((_, i) =>
    sections.slice(0, i).reduce((sum, section) => sum + section.rows.length, 0),
  );

  return (
    <Dialog.Popup className={styles.popup} initialFocus={inputRef} aria-modal="true">
      <Dialog.Title className="visually-hidden">{m.palette_title()}</Dialog.Title>
      <div className={styles.searchRow}>
        <Icon name="magnifying-glass" className={styles.searchIcon} />
        {scopeCount > 0 || chipLeaving ? (
          <span
            className={styles.scopeChip}
            role="group"
            aria-label={m.palette_scope_name({ count: selectedPages })}
            data-testid="palette-scope"
            data-leaving={chipLeaving ? '' : undefined}
            onAnimationEnd={() => {
              if (chipLeaving) setChipLeaving(false);
            }}
          >
            <Icon name="squares-four" className={styles.scopeIcon} />
            {m.palette_intent_count({ count: selectedPages })}
            <IconButton
              size="row"
              label={m.palette_scope_clear()}
              icon={<Icon name="x" />}
              tabIndex={-1}
              onPointerDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                dismissScope();
                inputRef.current?.focus();
              }}
            />
          </span>
        ) : null}
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          role="combobox"
          aria-label={m.search_commands()}
          aria-expanded="true"
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          placeholder={m.search_commands_placeholder()}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveId(null);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      <div
        ref={setList}
        id={listboxId}
        role="listbox"
        aria-label={m.palette_commands_label()}
        className={styles.list}
      >
        {rows.length === 0 ? (
          <p className={styles.empty} role="presentation">
            {m.palette_no_match({ query: query.trim() })}
          </p>
        ) : null}
        {sections.map((section, s) => {
          const headingId = `${baseId}-group-${section.id}`;
          const first = firstRows[s] ?? 0;
          return (
            <div
              key={section.id}
              role="group"
              aria-labelledby={section.label === undefined ? undefined : headingId}
              aria-label={section.label === undefined ? section.ariaLabel : undefined}
              className={styles.group}
              data-intent={section.id === 'intent' ? '' : undefined}
            >
              {section.label === undefined ? null : (
                <div
                  id={headingId}
                  role="presentation"
                  className={styles.groupLabel}
                  data-stagger=""
                  style={staggerStyle(first)}
                >
                  {section.label}
                </div>
              )}
              {section.rows.map((row, i) => {
                const selected = row === active;
                const reasonId = row.reason ? `${optionId(row.key)}-reason` : undefined;
                return (
                  // Options are driven from the combobox input via aria-activedescendant
                  // (APG); they take pointer input only and are never focused themselves.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={row.key}
                    id={optionId(row.key)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    aria-disabled={!row.enabled || undefined}
                    aria-describedby={reasonId}
                    data-intent-invalid={row.invalidIntent ? '' : undefined}
                    className={styles.option}
                    data-stagger=""
                    style={staggerStyle(first + i)}
                    onPointerMove={() => {
                      if (row.focusable && !selected) setActiveId(row.key);
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={row.run}
                  >
                    {selected ? (
                      <span className={styles.fill} data-palette-fill="" aria-hidden="true" />
                    ) : null}
                    <span className={styles.title}>
                      <Highlighted text={row.title} positions={row.positions} />
                    </span>
                    {row.hint ? (
                      <span className={styles.groupHint} data-bar-group-hint="">
                        {row.hint}
                      </span>
                    ) : null}
                    {/* The reason takes the keycap's place (04-context §12.2); it is the
                        option's description, not part of its name. */}
                    {row.reason ? (
                      <span
                        id={reasonId}
                        className={styles.reason}
                        data-reason=""
                        aria-hidden="true"
                      >
                        {row.reason}
                      </span>
                    ) : row.shortcut ? (
                      <Keycaps shortcut={row.shortcut} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className={styles.footer} aria-hidden="true">
        <span className={styles.footerItem}>
          {FOOTER_KEYS.navigate.map((key) => (
            <Keycaps key={key.key} shortcut={key} />
          ))}
          {m.palette_navigate()}
        </span>
        <span className={styles.footerItem}>
          <Keycaps shortcut={FOOTER_KEYS.run} />
          {m.palette_run()}
        </span>
        <span className={styles.footerItem}>
          <Keycaps shortcut={FOOTER_KEYS.close} />
          {m.common_close()}
        </span>
      </div>
    </Dialog.Popup>
  );
}

/** A suggestion for the open document: its title, why it is offered, and what it does. */
function suggestionRow(key: string, title: string, reason: string, run: () => void): ListRow {
  return {
    key,
    title,
    positions: [],
    enabled: true,
    focusable: true,
    reason,
    hint: undefined,
    shortcut: undefined,
    command: undefined,
    run,
  };
}

/** A recent file in the empty state: opens it as the Library's row does (L7 §6). */
function fileRow(entry: RecentEntry, onClose: () => void): ListRow {
  return {
    key: `file-${entry.id}`,
    title: entry.name,
    positions: [],
    enabled: true,
    focusable: true,
    reason: undefined,
    hint: undefined,
    shortcut: undefined,
    command: undefined,
    run: () => {
      onClose();
      // No await before it: the permission prompt needs this activation.
      openRecent(entry).catch((error: unknown) => {
        console.error(`Opening ${entry.name} failed`, error);
      });
    },
  };
}

/** A command row; a recent command shows its group, a tool its bar group (spec §5.1). */
function commandRow(
  row: Row,
  recent: boolean,
  pushRecent: (id: string) => void,
  onClose: () => void,
): ListRow {
  const { command } = row;
  return {
    key: command.id,
    title: command.title,
    positions: row.positions,
    enabled: row.enabled,
    focusable: row.enabled,
    reason: row.reason,
    hint: recent ? command.group : paletteGroupLabelOfCommand(command.id),
    shortcut: command.shortcuts[0],
    command,
    run: () => {
      if (!row.enabled) return;
      pushRecent(command.id);
      onClose();
      // Same task as the keydown/click, so pickers keep the user activation they need.
      commandRegistry.execute(command.id).catch((error: unknown) => {
        console.error(`Command "${command.id}" failed`, error);
      });
    },
  };
}
