/**
 * Command palette (Mod+K). Built on the Base UI Dialog (focus trap, Esc, scroll lock,
 * focus return). The list follows the APG combobox + listbox pattern: focus stays in the
 * input and `aria-activedescendant` points at the active option.
 *
 * Motion (docs/design/motion-2026-10/frame.md §2): the popup scales up from its top centre
 * over a scrim that blurs as it fades in; the first six rows come in 20 ms apart; the
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

import { fuzzyFilter } from '../commands/fuzzy';
import { type Command, commandRegistry, groupCommands } from '../commands/registry';
import { parseShortcut } from '../commands/shortcuts';
import { useCommands } from '../commands/use-commands';
import { m } from '../i18n';
import { animateStyle, type Motion } from '../motion/animate';
import { useUiStore } from '../state/ui-store';
import { Icon } from '../ui/Icon';
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

/** Internal id of the recents section; its heading is translated when rendered. */
const RECENT_GROUP = 'Recent';

/**
 * Builds the visible sections: recents first when the query is empty, else by relevance. A
 * dimmed row carries its reason (`reasonOf`, the registry's `disabledReason`).
 */
export function buildSections(
  query: string,
  commands: readonly Command[],
  recents: readonly string[],
  isEnabled: (command: Command) => boolean,
  reasonOf: (command: Command) => string | undefined = () => undefined,
): Section[] {
  const visible = commands.filter((c) => !c.hiddenInPalette);
  const toRow = (command: Command, positions: readonly number[] = []): Row => {
    const enabled = isEnabled(command);
    return { command, positions, enabled, reason: enabled ? undefined : reasonOf(command) };
  };

  if (query.trim() === '') {
    const recentCommands = recents
      .map((id) => visible.find((c) => c.id === id))
      .filter((c): c is Command => c !== undefined);
    const rest = visible.filter((c) => !recentCommands.includes(c));
    const sections: Section[] = [];
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
  // Groups are ordered by their best match; items keep their rank inside a group.
  const grouped = groupCommands(ranked.map((r) => ({ ...r, group: r.item.group })));
  return grouped.map(({ group, items }) => ({
    group,
    rows: items.map((r) => toRow(r.item, r.positions)),
  }));
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

function PalettePopup({ onClose }: { readonly onClose: () => void }) {
  const commands = useCommands();
  const recents = useUiStore((s) => s.recents);
  const pushRecent = useUiStore((s) => s.pushRecent);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  // The active option is tracked by command id and derived into an index, so it survives
  // re-ranking and falls back to the first enabled row when filtered out.
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<HTMLDivElement | null>(null);
  const baseId = useId();

  const sections = useMemo(
    () =>
      buildSections(
        deferredQuery,
        commands,
        recents,
        (c) => commandRegistry.isEnabled(c),
        (c) => commandRegistry.disabledReason(c),
      ),
    [deferredQuery, commands, recents],
  );
  const rows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);
  const matchedIndex = rows.findIndex((r) => r.command.id === activeId && r.enabled);
  const activeIndex = matchedIndex >= 0 ? matchedIndex : rows.findIndex((r) => r.enabled);
  const active = activeIndex >= 0 ? rows[activeIndex] : undefined;
  const optionId = (commandId: string) => `${baseId}-option-${commandId}`;
  const activeOptionId = active ? optionId(active.command.id) : undefined;

  useEffect(() => {
    if (!activeOptionId) return;
    document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeOptionId]);
  usePaletteFill(list, activeOptionId);

  const run = (row: Row | undefined) => {
    if (!row?.enabled) return;
    pushRecent(row.command.id);
    onClose();
    // Same task as the keydown/click, so pickers keep the user activation they need.
    commandRegistry.execute(row.command.id).catch((error: unknown) => {
      console.error(`Command "${row.command.id}" failed`, error);
    });
  };

  const move = (delta: 1 | -1) => {
    if (rows.length === 0) return;
    let next = activeIndex;
    let remaining = rows.length;
    do {
      next = (next + delta + rows.length) % rows.length;
      remaining -= 1;
    } while (remaining > 0 && !rows[next]?.enabled);
    setActiveId(rows[next]?.command.id ?? null);
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
      run(active);
    }
  };

  const listboxId = `${baseId}-listbox`;
  // Each section's first row in the whole list, for the entrance's stagger.
  const firstRows = sections.map((_, i) =>
    sections.slice(0, i).reduce((sum, section) => sum + section.rows.length, 0),
  );

  return (
    <Dialog.Popup className={styles.popup} initialFocus={inputRef}>
      <Dialog.Title className="visually-hidden">{m.palette_title()}</Dialog.Title>
      <div className={styles.searchRow}>
        <Icon name="magnifying-glass" className={styles.searchIcon} />
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
          const headingId = `${baseId}-group-${section.group}`;
          const first = firstRows[s] ?? 0;
          return (
            <div
              key={section.group}
              role="group"
              aria-labelledby={headingId}
              className={styles.group}
            >
              <div
                id={headingId}
                role="presentation"
                className={styles.groupLabel}
                data-stagger=""
                style={staggerStyle(first)}
              >
                {section.group === RECENT_GROUP ? m.palette_recent() : section.group}
              </div>
              {section.rows.map((row, i) => {
                const shortcut = row.command.shortcuts[0];
                const selected = row === active;
                const reasonId = row.reason ? `${optionId(row.command.id)}-reason` : undefined;
                return (
                  // Options are driven from the combobox input via aria-activedescendant
                  // (APG); they take pointer input only and are never focused themselves.
                  // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div
                    key={row.command.id}
                    id={optionId(row.command.id)}
                    role="option"
                    tabIndex={-1}
                    aria-selected={selected}
                    aria-disabled={!row.enabled || undefined}
                    aria-describedby={reasonId}
                    className={styles.option}
                    data-stagger=""
                    style={staggerStyle(first + i)}
                    onPointerMove={() => {
                      if (row.enabled && !selected) setActiveId(row.command.id);
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                    }}
                    onClick={() => {
                      run(row);
                    }}
                  >
                    {selected ? (
                      <span className={styles.fill} data-palette-fill="" aria-hidden="true" />
                    ) : null}
                    <span className={styles.title}>
                      <Highlighted text={row.command.title} positions={row.positions} />
                    </span>
                    {section.group === RECENT_GROUP ? (
                      <span className={styles.groupHint}>{row.command.group}</span>
                    ) : null}
                    {/* The tool bar group of a tool (experience-redesign spec §5.1). */}
                    {section.group !== RECENT_GROUP &&
                    paletteGroupLabelOfCommand(row.command.id) ? (
                      <span className={styles.groupHint} data-bar-group-hint="">
                        {paletteGroupLabelOfCommand(row.command.id)}
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
                    ) : shortcut ? (
                      <Keycaps shortcut={shortcut} />
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
