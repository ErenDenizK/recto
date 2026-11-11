/**
 * Recent on the desk, a shelf of covers (DSN-93, `home-recents.html`; the shelf of DSN-87 in its
 * Colophon form): at most 12 tiles, newest first, kept rows not hoisted, files open right now
 * hidden (the Open shelf shows them). A tile is the cover (the page left once past page 1) on the
 * shelf line and its serif title under it, one line, with a 6 px lime dot before it when changes
 * are kept. Nothing else is visible: the page reached, the time, the hints and the progress are
 * the tile's accessible name and its tooltip (`desk_tile_label`, `desk_tile_meta_read`).
 *
 * The tile contract (M3, M4): `li > button[data-desk-tile][data-recent-id]` holding the cover in
 * `[data-library-sheet]`. The sample is the shelf's last tile while it is not on screen
 * (`sampleTile`), `data-testid="desk-sample-tile"`.
 *
 * - **One row** until "Show all" (shown only when some covers do not fit, `useFirstRow`), which
 *   wraps them; expanded, "Clear" appears beside it and asks first when kept changes are on the
 *   list (`clearWithConfirm`).
 * - **Keys**: a roving tabindex, so the shelf is one tab stop. The arrows move in two dimensions
 *   over the live column count (`gridStep`), Home and End go to the ends, Enter or Space opens,
 *   Delete or Backspace removes, Shift+F10 or the context-menu key opens the tile's ⋯ menu (the
 *   ⋯ button itself is `tabIndex={-1}`: the pointer and touch reach it, keys use Shift+F10).
 * - **Notes and footnote** are Recents' own (02-library L7): the notes and the footnote keep
 *   their words.
 */
import { Menu } from '@base-ui/react/menu';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

import { commandRegistry } from '../commands/registry';
import { type RecentEntry, useRecentsStore } from '../files/recents';
import { m, useLocale } from '../i18n';
import { SampleCover } from '../sample/SampleCover';
import { useSessionStore } from '../session/session-store';
import { pagesPhrase } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import menuStyles from '../ui/Menu.module.css';
import { Tooltip } from '../ui/Tooltip';
import { openSample } from '../sample/open-sample';
import type { Cover } from './covers';
import { useCoverSizes } from './cover-size';
import { columnsOf, entryProgress, isRead, pickCover } from './desk-model';
import { DeskCover } from './DeskCover';
import { removeRecentEntry } from './home-actions';
import { gridStep, relativeTime } from './home-model';
import { clearWithConfirm, recentHint, useNow } from './recent-support';
import styles from './RecentShelf.module.css';
import { Shelf, ShelfText, ShowAll, useFirstRow } from './Shelf';
import { useSampleAvailable } from './use-sample-available';
import { openEntryAtPlace } from './DeskContinue';

const SAMPLE_ID = '\u0000sample';

export function RecentShelf({
  entries,
  covers,
  sampleTile,
}: {
  /** The entries to list, newest first, without the files open right now. */
  readonly entries: readonly RecentEntry[];
  readonly covers: ReadonlyMap<string, Cover>;
  /** The sample is not on screen and not the hero: it is the shelf's last tile. */
  readonly sampleTile: boolean;
}) {
  const access = useRecentsStore((s) => s.access);
  const note = useRecentsStore((s) => s.note);
  const clearFailed = useRecentsStore((s) => s.clearFailed);
  const keeping = useSessionStore((s) => s.keeping);
  const locale = useLocale();
  const now = useNow();
  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const sampleAvailable = useSampleAvailable();

  const ids = useMemo(
    () => [...entries.map((e) => e.id), ...(sampleTile ? [SAMPLE_ID] : [])],
    [entries, sampleTile],
  );
  const sizes = useCoverSizes();
  // A cover is as wide as its height and aspect make it, up to 360 (`RecentShelf.module.css`).
  const widths = useMemo(
    () => [
      ...entries.map((entry) => {
        const cover = pickCover(entry, covers);
        const ratio = cover === undefined ? 210 / 297 : cover.width / cover.height;
        return Math.min(360, Math.round(sizes.shelf * ratio));
      }),
      ...(sampleTile ? [Math.round((sizes.shelf * 210) / 297)] : []),
    ],
    [entries, covers, sampleTile, sizes.shelf],
  );
  const row = useFirstRow(listRef, widths, sizes.gap);
  const reachable = ids.slice(0, row.shown);
  const tabbable =
    focused !== null && reachable.includes(focused) ? focused : (reachable[0] ?? null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-desk-id="${CSS.escape(id)}"]`)?.focus();
  });

  if (entries.length === 0 && !sampleTile) {
    // Nothing to shelve: only the note of a clear that could not finish is left to say.
    return clearFailed ? (
      <p className={styles.note} data-testid="recent-clear-failed">
        {m.recents_clear_failed()}
      </p>
    ) : null;
  }
  const anyKept = entries.some((e) => e.kept !== undefined);

  const focusTile = (id: string | undefined) => {
    if (id === undefined) return;
    setFocused(id);
    listRef.current?.querySelector<HTMLElement>(`[data-desk-id="${CSS.escape(id)}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.currentTarget;
    const id = target.getAttribute('data-desk-id');
    if (id === null) return;
    const index = ids.indexOf(id);
    const entry = entries.find((e) => e.id === id);
    // Shift+F10 and the context-menu key open the tile's menu, whatever else is held.
    if (
      entry !== undefined &&
      (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))
    ) {
      event.preventDefault();
      setMenuFor(id);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (entry === undefined) return;
      event.preventDefault();
      const after = reachable[index + 1] ?? reachable[index - 1];
      removeRecentEntry(entry);
      if (after !== undefined) {
        setFocused(after);
        // The shelf re-renders once the entry has gone; the next tile takes focus then.
        pendingFocus.current = after;
      }
      return;
    }
    const items = (Array.from(listRef.current?.children ?? []) as HTMLElement[]).filter(
      (item) => !item.hidden,
    );
    const next = gridStep(index, event.key, reachable.length, columnsOf(items));
    if (next === null) return;
    event.preventDefault();
    focusTile(reachable[next]);
  };

  return (
    <Shelf
      headingId={headingId}
      label={m.home_recent()}
      testId="library-recents"
      right={
        <>
          {row.expanded ? (
            <ShelfText data-testid="home-clear" onClick={() => void clearWithConfirm(entries)}>
              {m.home_clear()}
            </ShelfText>
          ) : null}
          {row.overflow ? <ShowAll expanded={row.expanded} onToggle={row.toggle} /> : null}
        </>
      }
    >
      <ul
        ref={listRef}
        className={styles.row}
        aria-label={m.recents_list_label()}
        data-testid="recent-files"
      >
        {entries.map((entry, index) => {
          const hint = recentHint(entry, access[entry.id]);
          const time = relativeTime(entry.place?.at ?? entry.openedAt, now, locale);
          return (
            <li key={entry.id} className={styles.item} hidden={index >= row.shown}>
              <Tile
                entry={entry}
                cover={pickCover(entry, covers)}
                hint={hint}
                time={time}
                tabbable={entry.id === tabbable}
                onFocus={() => setFocused(entry.id)}
                onKeyDown={onKeyDown}
              />
              <Menu.Root
                open={menuFor === entry.id}
                onOpenChange={(open) => setMenuFor(open ? entry.id : null)}
              >
                <Menu.Trigger
                  className={styles.more}
                  tabIndex={-1}
                  data-recent-more=""
                  aria-label={m.recents_more({ name: entry.name })}
                >
                  <Icon name="dots-three" />
                </Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8}>
                    <Menu.Popup className={menuStyles.popup} data-testid="recent-menu">
                      <Menu.Item
                        className={menuStyles.item}
                        onClick={() => removeRecentEntry(entry)}
                      >
                        <span className={menuStyles.label}>{m.recents_remove()}</span>
                      </Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </li>
          );
        })}
        {sampleTile ? (
          <li className={styles.item} hidden={entries.length >= row.shown}>
            <Tooltip label={m.desk_sample_label()} side="top">
              <button
                type="button"
                // the tile is the cover, not an action button
                // eslint-disable-next-line recto/q9-controls
                className={styles.tile}
                data-desk-tile=""
                data-desk-id={SAMPLE_ID}
                data-testid="desk-sample-tile"
                tabIndex={SAMPLE_ID === tabbable ? 0 : -1}
                aria-disabled={sampleAvailable ? undefined : true}
                aria-label={
                  sampleAvailable
                    ? m.desk_sample_label()
                    : `${m.cmd_try_sample()}, ${m.sample_offline()}`
                }
                onFocus={() => setFocused(SAMPLE_ID)}
                onKeyDown={onKeyDown}
                onClick={() => {
                  if (sampleAvailable) void openSample();
                }}
              >
                <span className={styles.stage} aria-hidden="true">
                  <span className={styles.drawing} data-library-sheet="">
                    <SampleCover className={styles.drawingSvg} />
                  </span>
                </span>
                <span className={styles.name} aria-hidden="true">
                  {m.cmd_try_sample()}
                </span>
              </button>
            </Tooltip>
          </li>
        ) : null}
      </ul>
      {clearFailed ? (
        <p className={styles.note} data-testid="recent-clear-failed">
          {m.recents_clear_failed()}
        </p>
      ) : null}
      {note !== null ? (
        <p className={styles.note} data-testid="recent-note">
          {note.kind === 'open-again'
            ? m.recents_note_open_again({ name: note.name })
            : m.recents_note_unavailable({ name: note.name })}
        </p>
      ) : null}
      {keeping === 'unavailable' ? (
        <p className={styles.footnote} data-testid="recent-not-kept">
          <Icon name="warning" className={styles.footnoteIcon} />
          {m.session_not_kept()}
        </p>
      ) : anyKept ? (
        <p className={styles.footnote} data-testid="recent-kept-footnote">
          {m.recents_kept_footnote()} ·{' '}
          <Button
            variant="quiet"
            size="sm"
            className={styles.manage}
            onClick={() => void commandRegistry.execute('settings.keptDocuments')}
          >
            {m.recents_manage()}
          </Button>
        </p>
      ) : null}
    </Shelf>
  );
}

function Tile({
  entry,
  cover,
  hint,
  time,
  tabbable,
  onFocus,
  onKeyDown,
}: {
  readonly entry: RecentEntry;
  readonly cover: Cover | undefined;
  readonly hint: string | undefined;
  readonly time: string;
  readonly tabbable: boolean;
  readonly onFocus: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const read = isRead(entry);
  const place = entry.place;
  const page = (place?.page ?? 0) + 1;
  const total = place?.total ?? 0;
  const percent = Math.round(entryProgress(entry) * 100);
  const pages = entry.pages === undefined ? '' : pagesPhrase(entry.pages);
  const meta = read
    ? m.desk_tile_meta_read({ page, total, time })
    : pages === ''
      ? time
      : m.desk_tile_meta_unread({ pages, time });
  const label = [
    read
      ? m.desk_tile_label({ name: entry.name, page, total, percent, time })
      : pages === ''
        ? `${entry.name}, ${time}`
        : m.desk_tile_label_unread({ name: entry.name, pages, time }),
    hint,
  ]
    .filter((part) => part !== undefined && part !== '')
    .join(', ');
  // The visible parts the tile no longer shows, for the pointer: the name, where, when, the hint.
  const tip = [entry.name, meta, hint]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ');
  return (
    <Tooltip label={tip} side="top">
      <button
        type="button"
        // the tile is the cover, not an action button
        // eslint-disable-next-line recto/q9-controls
        className={styles.tile}
        data-desk-tile=""
        data-desk-id={entry.id}
        data-recent-id={entry.id}
        tabIndex={tabbable ? 0 : -1}
        aria-label={label}
        aria-keyshortcuts="Delete"
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        // No await before openRecent: the permission prompt needs this click's activation.
        onClick={() => void openEntryAtPlace(entry)}
      >
        <span className={styles.stage} aria-hidden="true">
          <DeskCover cover={cover} />
        </span>
        <span className={styles.name} aria-hidden="true">
          {entry.kept?.changed === true ? <span className={styles.dot} /> : null}
          <span className={styles.nameText}>{entry.name}</span>
        </span>
      </button>
    </Tooltip>
  );
}
