/**
 * Recents (`02-library` L7; replaces Home's Recent section, 4.4 and 4.5): closed documents with
 * their kept snapshots and the files opened lately, in one lit panel. A row reopens the snapshot
 * with no prompt or picker on every browser (J14 = 1); without one it reopens through the kept
 * file handle, asking for permission within the click, or the file dialog ("Open again…").
 *
 * - **Rows**: kept rows first (02.Q4), then plain recents, newest first, without the files open
 *   right now. A kept row shows its first page at 32 × 40, rendered on demand while it is visible
 *   (02.Q1, `recent-thumbs.ts`); the others keep the page glyph.
 * - **Keys** (unchanged from M8): a roving tabindex; Up, Down, Home and End move, Enter opens,
 *   Right reaches the row's ⋯ and Left returns, Delete removes.
 * - **Clear recents**: with kept changes on the list it asks first ("Clear recent files?", Clear
 *   is a danger action, never lime); without, it clears at once.
 * - **Footnote**: "Kept on this device while the browser keeps it · Manage" (Settings →
 *   Documents and storage) when any row is kept, "Changes are not kept in this window" where
 *   storage is refused. Nothing renders while there is nothing to list (no placeholder).
 */
import { Menu } from '@base-ui/react/menu';
import type { SourceId } from '@pdf-editor/document-model';
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { clearRecentFiles } from '../commands/app-commands';
import { commandRegistry } from '../commands/registry';
import { canReopenRecent, loadRecents, type RecentEntry, useRecentsStore } from '../files/recents';
import { m, useLocale } from '../i18n';
import { useSessionStore } from '../session/session-store';
import { pagesPhrase, useWorkspaceStore } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { RowButton } from '../ui/RowButton';
import menuStyles from '../ui/Menu.module.css';
import { confirm } from '../ui/sheet';
import { openRecent, removeRecentEntry } from './home-actions';
import { formatFileSize, middleTruncate, relativeTime, visibleRecents } from './home-model';
import lit from './lit.module.css';
import { RECENT_THUMB, recentThumb } from './recent-thumbs';
import styles from './RecentList.module.css';

const RECENT_NAME_LENGTH = 48;

/** The current time, refreshed every minute while mounted ("5 minutes ago" moves on). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Name and size of each file open right now, so Recents does not repeat a card. */
function useOpenFiles(): readonly { readonly name: string; readonly size: number }[] {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  return useMemo(() => {
    const sources = new Set<SourceId>();
    for (const id of workspace.documentOrder) {
      for (const page of workspace.documents[id]?.pages ?? []) {
        if (page.ref.kind === 'source') sources.add(page.ref.source);
      }
    }
    return [...sources].flatMap((id) => {
      const file = files[id];
      return file === undefined ? [] : [{ name: file.name, size: file.size }];
    });
  }, [workspace, files]);
}

/** Kept rows first (02.Q4), each group newest first as the list keeps them. */
function keptFirst(entries: readonly RecentEntry[]): RecentEntry[] {
  return [...entries.filter((e) => e.kept !== undefined), ...entries.filter((e) => !e.kept)];
}

/**
 * Clear recents (L7 §6): with kept changes on the list, the confirmation first, since Clear
 * deletes them from this device; without, at once.
 */
async function clearWithConfirm(entries: readonly RecentEntry[]): Promise<void> {
  const changed = entries.filter((e) => e.kept?.changed === true).length;
  if (changed > 0) {
    const ok = await confirm({
      title: m.recents_clear_confirm_title(),
      body: m.recents_clear_confirm_body({ count: changed }),
      action: m.recents_clear_confirm_action(),
      danger: true,
      glyph: 'trash',
    });
    if (!ok) return;
  }
  await clearRecentFiles();
}

export function RecentList({ variant }: { readonly variant: 'cards' | 'empty' }) {
  const entries = useRecentsStore((s) => s.entries);
  const access = useRecentsStore((s) => s.access);
  const note = useRecentsStore((s) => s.note);
  const clearFailed = useRecentsStore((s) => s.clearFailed);
  const keeping = useSessionStore((s) => s.keeping);
  const open = useOpenFiles();
  const visible = useMemo(() => keptFirst(visibleRecents(entries, open)), [entries, open]);
  const [focused, setFocused] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const headingId = useId();
  const locale = useLocale();
  const now = useNow();

  useEffect(() => {
    void loadRecents();
  }, []);

  // A Clear that could not delete the stored copy keeps the section, to say so.
  if (visible.length === 0 && !clearFailed) return null;
  const tabbable = visible.some((e) => e.id === focused) ? focused : (visible[0]?.id ?? null);
  const anyKept = visible.some((e) => e.kept !== undefined);

  const focusRow = (id: string | undefined) => {
    if (id === undefined) return;
    setFocused(id);
    listRef.current?.querySelector<HTMLElement>(`[data-recent-id="${id}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const row = target?.closest<HTMLElement>('[data-recent-row]');
    const id = row?.getAttribute('data-recent-row') ?? undefined;
    const index = visible.findIndex((e) => e.id === id);
    const entry = visible[index];
    if (entry === undefined) return;
    const onMore = target?.hasAttribute('data-recent-more') ?? false;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End': {
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? visible.length - 1
              : Math.min(
                  visible.length - 1,
                  Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)),
                );
        focusRow(visible[next]?.id);
        return;
      }
      case 'ArrowRight':
        if (onMore) return;
        event.preventDefault();
        row?.querySelector<HTMLElement>('[data-recent-more]')?.focus();
        return;
      case 'ArrowLeft':
        if (!onMore) return;
        event.preventDefault();
        focusRow(entry.id);
        return;
      case 'Delete':
      case 'Backspace': {
        if (onMore) return;
        event.preventDefault();
        const after = visible[index + 1] ?? visible[index - 1];
        removeRecentEntry(entry);
        if (after !== undefined) {
          setFocused(after.id);
          // The row re-renders as the roving stop once the entry has gone.
          requestAnimationFrame(() => focusRow(after.id));
        }
        return;
      }
    }
  };

  return (
    <section
      className={`${lit.lit} ${styles.panel}`}
      data-lit=""
      data-variant={variant}
      aria-labelledby={headingId}
      data-testid="library-recents"
    >
      <div className={styles.header}>
        <h2 id={headingId} className={styles.title}>
          {m.recents_heading()}
        </h2>
        <Button variant="quiet" onClick={() => void clearWithConfirm(visible)}>
          {m.recents_clear()}
        </Button>
      </div>
      {visible.length > 0 ? (
        <ul
          ref={listRef}
          className={styles.list}
          aria-label={m.recents_list_label()}
          data-testid="recent-files"
        >
          {visible.map((entry) => (
            <RecentRow
              key={entry.id}
              entry={entry}
              hint={recentHint(entry, access[entry.id])}
              time={relativeTime(entry.openedAt, now, locale)}
              locale={locale}
              tabbable={entry.id === tabbable}
              onFocus={() => setFocused(entry.id)}
              onKeyDown={onKeyDown}
            />
          ))}
        </ul>
      ) : null}
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
            onClick={() => void commandRegistry.execute('settings.keptDocuments')}
          >
            {m.recents_manage()}
          </Button>
        </p>
      ) : null}
    </section>
  );
}

/** The quiet hint a row carries: kept changes, permission to ask for, or the file dialog. */
function recentHint(entry: RecentEntry, access: string | undefined): string | undefined {
  // A kept snapshot reopens by itself on every browser (ADR-0032 §2.6).
  if (entry.kept !== undefined) return entry.kept.changed ? m.recents_hint_kept() : undefined;
  if (!canReopenRecent(entry) || access === 'unavailable') return m.recents_hint_open_again();
  if (access === 'prompt') return m.recents_hint_permission();
  return undefined;
}

function RecentRow({
  entry,
  hint,
  time,
  locale,
  tabbable,
  onFocus,
  onKeyDown,
}: {
  readonly entry: RecentEntry;
  readonly hint: string | undefined;
  readonly time: string;
  readonly locale: string;
  readonly tabbable: boolean;
  readonly onFocus: () => void;
  /** The list's roving keys (Up, Down, Home, End, Right, Left, Delete). */
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const details = [
    entry.pages === undefined ? undefined : pagesPhrase(entry.pages),
    formatFileSize(entry.size, locale),
  ]
    .filter(Boolean)
    .join(' · ');
  const label = [entry.name, details, time, hint].filter(Boolean).join(', ');
  return (
    <li className={styles.row} data-recent-row={entry.id}>
      <RowButton
        press
        className={styles.open}
        data-recent-id={entry.id}
        tabIndex={tabbable ? 0 : -1}
        aria-label={label}
        aria-keyshortcuts="Delete"
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        // No await before openRecent: the permission prompt needs this click's activation.
        onClick={() => void openRecent(entry)}
      >
        {entry.kept !== undefined ? (
          <KeptThumb snapshotId={entry.kept.snapshotId} changed={entry.kept.changed} />
        ) : (
          <span className={styles.glyph} aria-hidden="true">
            <Icon name="file" />
          </span>
        )}
        <span className={styles.name} aria-hidden="true">
          {middleTruncate(entry.name, RECENT_NAME_LENGTH)}
        </span>
        <span className={styles.meta} aria-hidden="true">
          <span>{details}</span>
          {hint === undefined ? null : <span className={styles.hint}>{hint}</span>}
          <span>{time}</span>
        </span>
      </RowButton>
      <Menu.Root>
        <Menu.Trigger
          className={styles.more}
          tabIndex={-1}
          data-recent-more=""
          aria-label={m.recents_more({ name: entry.name })}
          onKeyDown={onKeyDown}
        >
          <Icon name="dots-three" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} collisionPadding={8}>
            <Menu.Popup className={menuStyles.popup} data-testid="recent-menu">
              <Menu.Item className={menuStyles.item} onClick={() => removeRecentEntry(entry)}>
                <span className={menuStyles.label}>{m.recents_remove()}</span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </li>
  );
}

/**
 * A kept row's first page (02.Q1): the glyph until the row has been visible and the render is
 * done, then the 32 × 40 page, solid white with its hairline (content, never themed).
 */
function KeptThumb({
  snapshotId,
  changed,
}: {
  readonly snapshotId: string;
  readonly changed: boolean;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  // The snapshot storage opens with the session; until then there is nothing to read.
  const keeping = useSessionStore((s) => s.keeping);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || keeping !== 'available') return undefined;
    let cancelled = false;
    const observer = new IntersectionObserver((records) => {
      if (!records.some((r) => r.isIntersecting)) return;
      observer.disconnect();
      void recentThumb(snapshotId).then((thumb) => {
        if (cancelled || !thumb) return;
        setSize({ width: thumb.width, height: thumb.height });
        setSource(thumb.canvas);
      });
    });
    observer.observe(box);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [snapshotId, keeping]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    canvas.width = source.width;
    canvas.height = source.height;
    canvas.getContext('2d')?.drawImage(source, 0, 0);
  }, [source]);

  return (
    <span
      ref={boxRef}
      className={styles.thumb}
      aria-hidden="true"
      data-changed={changed || undefined}
      style={{ width: RECENT_THUMB.width, height: RECENT_THUMB.height }}
    >
      {size ? (
        <canvas
          ref={canvasRef}
          className={styles.thumbCanvas}
          data-testid="recent-thumb"
          style={{ width: size.width, height: size.height }}
        />
      ) : (
        <Icon name="file-text" />
      )}
    </span>
  );
}
