/**
 * The Pages bar (`components/04-context.md` §10; flows.md §4.4; spec X21, D2-5): acting on
 * selected pages, as the capsule's content (`shell/capsule/`): the dock morphs into it in the
 * Pages grid, and in viewing while pages are selected explicitly in the sidebar.
 *
 *   ✓ Done │ 3 selected │ ↺ ↻ │ ‹ › │ Delete │ Extract │ Duplicate │ Move to ▾ │ ⋯
 *   ✓ Done │ 12 pages │ Select all │ ⋯                     (nothing selected)
 *   ✕ │ 3 selected │ …                                     (viewing: ✕ clears the sidebar's)
 *   ✓ Done │ 3 selected │ Extract │ Copy │ Unlock          (locked)
 *
 * - **Every act is a registered command** with its `act` (F§2.5), so the guard dims it with
 *   the registry's reason and it is one undo step, with a toast for removals; Extract and Copy
 *   change nothing and stay allowed while locked (flows §2.6). ‹ › move by one (the non-drag
 *   reorder, WCAG 2.5.7, INV-R8), dimmed at the first and last page; Delete dims when it would
 *   take every page of a document.
 * - **Shedding** (§2.2) by the room the dock band leaves: Duplicate and Move to fold into ⋯
 *   first, then Extract. Rotate and move are glyphs with their names in tooltips; the rest keep
 *   their labels (RA-20).
 * - **Keyboard**: one Tab stop, arrows between items (`useRovingTabindex`), as the dock. The
 *   count is announced by whoever changed the selection, never by the bar (A-14).
 * - **Material**: the capsule's (M2, one σ per size); the bar adds no surface of its own, so
 *   its menus are the only glass it opens (Q-4).
 */
import { Menu } from '@base-ui/react/menu';
import type { DocumentId, PageId, VirtualDocument } from '@pdf-editor/document-model';
import { findPageLocation } from '@pdf-editor/document-model';
import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { targetPages } from '../../commands/app-commands';
import { commandRegistry } from '../../commands/registry';
import { useCommands } from '../../commands/use-commands';
import { m } from '../../i18n';
import { announce } from '../../shell/announcer';
import { useRovingTabindex } from '../../shell/FloatingToolbar.roving';
import dockStyles from '../../shell/frame/Dock.module.css';
import { openTitleMenu } from '../../shell/frame/frame-store';
import { useLock } from '../../state/lock-store';
import { useSelectionStore, visibleSelection } from '../../state/selection-store';
import { stageView, useUiStore } from '../../state/ui-store';
import { useTabItems, useWorkspaceStore } from '../../state/workspace-store';
import { Icon, type IconName } from '../../ui/Icon';
import menuStyles from '../../ui/Menu.module.css';
import { Tooltip } from '../../ui/Tooltip';
import { extractPages, movePagesToDocument } from '../arrange-actions';
import { leaveGrid } from './grid-transition';
import styles from './PagesBar.module.css';

/** How much the bar shows of itself (§2.2 shedding): all, without Duplicate and Move to, less. */
export type PagesBarFold = 'full' | 'mid' | 'tight';

/** The fold for the room the band leaves (CSS px) on a fine or a coarse pointer. */
export function pagesBarFold(room: number, coarse: boolean): PagesBarFold {
  const full = coarse ? 1040 : 860;
  const mid = coarse ? 820 : 660;
  return room >= full ? 'full' : room >= mid ? 'mid' : 'tight';
}

/** The pages the bar acts on now: the grid's selection, or the one shown in the sidebar. */
export function usePagesBarSelection(): readonly PageId[] {
  const grid = useUiStore((s) => stageView(s) === 'grid');
  const selected = useSelectionStore((s) => s.selected);
  const shownId = useSelectionStore((s) => s.navigatorDocument);
  const shown = useWorkspaceStore((s) =>
    shownId === null ? undefined : s.workspace.documents[shownId],
  );
  if (grid) return [...selected];
  return visibleSelection(selected, shown);
}

/** A key for the capsule's morph inside the bar: nothing selected, some, and locked. */
export function usePagesBarKey(id: DocumentId | undefined): string {
  const count = usePagesBarSelection().length;
  const locked = useLock(id) !== undefined;
  return `${count > 0 ? 'some' : 'none'}:${locked ? 'locked' : 'open'}`;
}

const shortcutOf = (id: string) => commandRegistry.get(id)?.shortcuts[0];

function reasonOf(id: string): string | undefined {
  const command = commandRegistry.get(id);
  if (!command) return m.section_not_available();
  return commandRegistry.isEnabled(command) ? undefined : commandRegistry.disabledReason(command);
}

/** Whether the pages sit at the very start or end of their documents (‹ › dim there). */
function edges(ids: readonly PageId[]): { first: boolean; last: boolean; all: boolean } {
  const ws = useWorkspaceStore.getState().workspace;
  let first = false;
  let last = false;
  const perDocument = new Map<DocumentId, number>();
  for (const id of ids) {
    const location = findPageLocation(ws, id);
    if (!location) continue;
    const count = ws.documents[location.document]?.pages.length ?? 0;
    if (location.index === 0) first = true;
    if (location.index === count - 1) last = true;
    perDocument.set(location.document, (perDocument.get(location.document) ?? 0) + 1);
  }
  const all = [...perDocument].some(
    ([doc, n]) => n >= (ws.documents[doc]?.pages.length ?? Number.POSITIVE_INFINITY),
  );
  return { first, last, all };
}

/** The room the dock band leaves the capsule (its width less 16 px a side), kept current. */
function useBandRoom(ref: RefObject<HTMLElement | null>): number {
  const [room, setRoom] = useState(Number.POSITIVE_INFINITY);
  useLayoutEffect(() => {
    const band = ref.current?.closest<HTMLElement>('[data-frame-layer="band"]');
    if (!band) return;
    const measure = () => setRoom(band.clientWidth - 32);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(band);
    return () => observer.disconnect();
  }, [ref]);
  return room;
}

export function PagesBar({ doc }: { readonly doc: VirtualDocument }) {
  const ref = useRef<HTMLDivElement>(null);
  const inGrid = useUiStore((s) => stageView(s) === 'grid');
  // The grid's form holds while the bar leaves the grid (the capsule fades it out in place as
  // it morphs back into the dock), so ✕ never flashes in Done's place.
  const [wasGrid, setWasGrid] = useState(inGrid);
  if (inGrid && !wasGrid) setWasGrid(true);
  const grid = inGrid || wasGrid;
  const selection = usePagesBarSelection();
  const locked = useLock(doc.id) !== undefined;
  const roving = useRovingTabindex(ref, '[data-pages-item="done"]');
  const room = useBandRoom(ref);
  const coarse =
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse), (any-pointer: coarse)').matches;
  const fold = pagesBarFold(room, coarse);
  // Enablement follows the selection and the documents (re-render as they change).
  useCommands();
  useWorkspaceStore((s) => s.workspace);
  const count = selection.length;
  const some = count > 0;
  const { first, last, all } = some ? edges(selection) : { first: false, last: false, all: false };

  const run = (id: string) => () => void commandRegistry.execute(id);
  const done = () => {
    if (grid) leaveGrid();
    else {
      useSelectionStore.getState().clear();
      announce(m.status_selected({ count: 0 }));
    }
  };

  const more: MoreEntry[] = some
    ? [
        ...(fold === 'tight' && !locked
          ? [{ id: 'pages.extract', label: m.pages_bar_extract() }]
          : []),
        ...(fold !== 'full' && !locked
          ? [{ id: 'pages.duplicate', label: m.pages_bar_duplicate() }]
          : []),
        { id: 'pages.insertBlank', label: m.pages_bar_insert_blank() },
        { id: 'pages.crop', label: m.pages_bar_crop() },
        { id: 'pages.resize', label: m.pages_bar_resize() },
        { id: 'pages.copy', label: m.pages_bar_copy() },
        { id: 'pages.paste', label: m.pages_bar_paste() },
        { id: 'pages.copyToNew', label: m.pages_bar_copy_to_new() },
        { id: 'pages.reverseSelection', label: m.pages_bar_reverse() },
      ]
    : [
        { id: 'pages.paste', label: m.pages_bar_paste() },
        { id: 'pages.select.odd', label: m.pages_bar_select_odd() },
        { id: 'pages.select.even', label: m.pages_bar_select_even() },
        { id: 'section.insertImages', label: m.pages_bar_insert_images() },
        { id: 'section.split', label: m.pages_bar_split() },
        { id: 'section.interleave', label: m.pages_bar_interleave() },
        { id: 'pages.resize', label: m.pages_bar_resize() },
        { id: 'pages.crop', label: m.pages_bar_crop() },
      ];

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={m.pages_bar_label()}
      aria-orientation="horizontal"
      className={`${dockStyles.toolbar} ${styles.bar}`}
      data-bar-view="pages"
      data-testid="pages-bar"
      onKeyDown={roving.onKeyDown}
      onFocus={roving.onFocus}
    >
      {grid ? (
        <BarButton
          item="done"
          icon="check"
          label={m.pages_bar_done()}
          keys="Escape"
          focusOnArrival
          onActivate={done}
        />
      ) : (
        <BarButton
          item="done"
          icon="x"
          label={m.pages_bar_clear()}
          iconOnly
          keys="Escape"
          focusOnArrival
          onActivate={done}
        />
      )}
      <span className={styles.count} data-capsule-item="count" aria-live="off">
        {some ? m.status_selected({ count }) : m.pages_count({ count: doc.pages.length })}
      </span>
      <span className={styles.separator} data-capsule-item="sep-1" aria-hidden="true" />
      {some && !locked ? (
        <>
          <BarButton
            item="rotate-left"
            icon="arrow-counter-clockwise"
            label={m.action_rotate_left()}
            iconOnly
            shortcut={shortcutOf('pages.rotateLeft')}
            reason={reasonOf('pages.rotateLeft')}
            onActivate={run('pages.rotateLeft')}
          />
          <BarButton
            item="rotate-right"
            icon="arrow-clockwise"
            label={m.action_rotate_right()}
            iconOnly
            shortcut={shortcutOf('pages.rotateRight')}
            reason={reasonOf('pages.rotateRight')}
            onActivate={run('pages.rotateRight')}
          />
          <span className={styles.separator} data-capsule-item="sep-2" aria-hidden="true" />
          <BarButton
            item="earlier"
            icon="caret-left"
            label={m.pages_bar_earlier()}
            iconOnly
            shortcut={shortcutOf('pages.moveBackward')}
            reason={first ? m.pages_bar_already_first() : reasonOf('pages.moveBackward')}
            onActivate={run('pages.moveBackward')}
          />
          <BarButton
            item="later"
            icon="caret-right"
            label={m.pages_bar_later()}
            iconOnly
            shortcut={shortcutOf('pages.moveForward')}
            reason={last ? m.pages_bar_already_last() : reasonOf('pages.moveForward')}
            onActivate={run('pages.moveForward')}
          />
          <span className={styles.separator} data-capsule-item="sep-3" aria-hidden="true" />
          <BarButton
            item="delete"
            icon="trash"
            label={m.pages_bar_delete()}
            danger
            shortcut={shortcutOf('pages.delete')}
            reason={all ? m.pages_bar_one_page() : reasonOf('pages.delete')}
            onActivate={run('pages.delete')}
          />
          {fold !== 'tight' ? (
            <BarButton
              item="extract"
              icon="file-arrow-up"
              label={m.pages_bar_extract()}
              shortcut={shortcutOf('pages.extract')}
              reason={reasonOf('pages.extract')}
              onActivate={run('pages.extract')}
            />
          ) : null}
          {fold === 'full' ? (
            <>
              <BarButton
                item="duplicate"
                icon="copy"
                label={m.pages_bar_duplicate()}
                shortcut={shortcutOf('pages.duplicate')}
                reason={reasonOf('pages.duplicate')}
                onActivate={run('pages.duplicate')}
              />
              <MoveToMenu documentId={doc.id} />
            </>
          ) : null}
        </>
      ) : null}
      {some && locked ? (
        <>
          <BarButton
            item="extract"
            icon="file-arrow-up"
            label={m.pages_bar_extract()}
            reason={reasonOf('pages.extract')}
            onActivate={run('pages.extract')}
          />
          <BarButton
            item="copy"
            icon="copy"
            label={m.pages_bar_copy()}
            reason={reasonOf('pages.copy')}
            onActivate={run('pages.copy')}
          />
        </>
      ) : null}
      {!some ? (
        <BarButton
          item="select-all"
          icon="selection"
          label={m.pages_bar_select_all()}
          shortcut={shortcutOf('pages.selectAll')}
          onActivate={run('pages.selectAll')}
        />
      ) : null}
      {locked ? (
        <BarButton
          item="locked"
          icon="lock-simple"
          label={m.pages_bar_unlock()}
          popup="dialog"
          onActivate={() => openTitleMenu('menu')}
        />
      ) : (
        <MoreMenu entries={more} />
      )}
    </div>
  );
}

interface MoreEntry {
  readonly id: string;
  readonly label: string;
}

function BarButton({
  item,
  icon,
  label,
  iconOnly = false,
  danger = false,
  shortcut,
  keys,
  reason,
  popup,
  focusOnArrival = false,
  onActivate,
}: {
  readonly item: string;
  readonly icon: IconName;
  readonly label: string;
  readonly iconOnly?: boolean;
  readonly danger?: boolean;
  readonly shortcut?: ReturnType<typeof shortcutOf>;
  readonly keys?: string;
  /** Why it is dimmed; dimmed controls stay focusable and say why (RA-21). */
  readonly reason?: string | undefined;
  readonly popup?: 'dialog' | 'menu' | undefined;
  readonly focusOnArrival?: boolean;
  readonly onActivate: () => void;
}): ReactNode {
  const disabled = reason !== undefined;
  const button = (
    <button
      type="button"
      className={dockStyles.item}
      data-capsule-item={item}
      data-pages-item={item}
      data-danger={danger ? '' : undefined}
      data-icon-only={iconOnly ? '' : undefined}
      data-capsule-focus={focusOnArrival ? '' : undefined}
      aria-label={iconOnly ? label : undefined}
      aria-haspopup={popup}
      aria-keyshortcuts={keys}
      aria-disabled={disabled ? 'true' : undefined}
      onClick={(event: ReactMouseEvent) => {
        if (disabled) {
          event.preventDefault();
          announce(reason);
          return;
        }
        onActivate();
      }}
    >
      <Icon name={icon} className={dockStyles.icon} />
      {iconOnly ? null : <span className={dockStyles.label}>{label}</span>}
    </button>
  );
  if (!iconOnly && shortcut === undefined && reason === undefined) return button;
  return (
    <Tooltip label={label} shortcut={shortcut} reason={reason} side="top">
      {button}
    </Tooltip>
  );
}

/** Move to ▾ (§14): each other open document with its tag dot, then "New document". */
function MoveToMenu({ documentId }: { readonly documentId: DocumentId }) {
  const tabs = useTabItems().filter((tab) => tab.id !== documentId);
  const reason = reasonOf('pages.extract');
  return (
    <Menu.Root>
      <Menu.Trigger
        className={dockStyles.item}
        data-capsule-item="move-to"
        data-pages-item="move-to"
        aria-disabled={reason ? 'true' : undefined}
      >
        <Icon name="folder" className={dockStyles.icon} />
        <span className={dockStyles.label}>{m.pages_bar_move_to()}</span>
        <Icon name="caret-up" className={styles.caret} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="center" sideOffset={8} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup} aria-label={m.pages_bar_move_to()}>
            {tabs.map((tab) => (
              <Menu.Item
                key={tab.id}
                className={menuStyles.item}
                onClick={() => movePagesToDocument(tab.id)}
              >
                <span className={menuStyles.tag} data-tag={tab.colorIndex} aria-hidden="true" />
                <span className={menuStyles.label}>{tab.title}</span>
                <span className={menuStyles.hint}>{m.pages_count({ count: tab.pageCount })}</span>
              </Menu.Item>
            ))}
            {tabs.length > 0 ? <Menu.Separator className={menuStyles.separator} /> : null}
            <Menu.Item
              className={menuStyles.item}
              disabled={reason !== undefined}
              onClick={() => {
                if (targetPages().length > 0) extractPages();
              }}
            >
              <span className={menuStyles.label}>{m.pages_bar_new_document()}</span>
              {reason ? <span className={menuStyles.hint}>{reason}</span> : null}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** ⋯ (§10): the rarer page acts, each dimmed with its reason when it cannot run. */
function MoreMenu({ entries }: { readonly entries: readonly MoreEntry[] }) {
  return (
    <Menu.Root>
      <Tooltip label={m.pages_bar_more()} side="top">
        <Menu.Trigger
          className={dockStyles.item}
          data-capsule-item="more"
          data-pages-item="more"
          data-icon-only=""
          aria-label={m.pages_bar_more()}
        >
          <Icon name="dots-three" className={dockStyles.icon} />
        </Menu.Trigger>
      </Tooltip>
      <Menu.Portal>
        <Menu.Positioner side="top" align="end" sideOffset={8} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup} aria-label={m.pages_bar_more()}>
            {entries.map((entry) => {
              const reason = reasonOf(entry.id);
              return (
                <Menu.Item
                  key={entry.id}
                  className={menuStyles.item}
                  data-command={entry.id}
                  disabled={reason !== undefined}
                  onClick={() => void commandRegistry.execute(entry.id)}
                >
                  <span className={menuStyles.label}>{entry.label}</span>
                  {reason ? <span className={menuStyles.hint}>{reason}</span> : null}
                </Menu.Item>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
