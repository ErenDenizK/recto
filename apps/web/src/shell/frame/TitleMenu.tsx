/**
 * The title menu (`components/01-frame.md` F5; flows.md §4.6; RA-9): the document's one menu,
 * headed like the macOS title popover, opened from the active tab (or the compact bar's title).
 *
 * - **Header:** the first page, the editable name, "12 pages · 2.4 MB", the status of the
 *   changes, the **Lock** switch with its reason (`LockSwitch.tsx`) and the privacy line,
 *   which opens ◎'s popover.
 * - **Rows:** File · Pages · Add to pages · Protect · Convert, then Compare with… and Document
 *   info… (`TitleMenuItems.ts`). Static: a row the guard or its command refuses dims with its
 *   reason and stays where it is (RA-21); activating it announces the reason and keeps the
 *   menu open.
 * - **Role** (spec 01.3): not a `role="menu"` as a whole, since it holds a text field and a
 *   switch: a non-modal dialog (Base UI `Popover`) named "report.pdf document menu", with the
 *   header controls first and one `role="menu"` list of `menuitem`s grouped per section.
 * - **Focus:** on open, the first row (Save), not the name: no keyboard pops up on a tablet and
 *   nothing is renamed by a stray key; F2 and Rename… open it on the name, selected. Tab moves
 *   header → list; in the list the arrows, Home and End move and Right opens "Rotate all ▸".
 *   Choosing a row closes the menu and runs it (a sheet takes focus and gives it back to the
 *   tab); Esc closes and returns focus to the trigger.
 * - **Name:** Enter commits (`renameDocumentTo`, a `document` act: read-only while locked),
 *   Esc reverts and keeps the menu open, an empty name reverts.
 *
 * On compact widths the spec's bottom sheet at the 92 % detent is the phone edition's (M10,
 * ADR-0033); a narrow full-edition window gets the same popover, which fits 320 px.
 */
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import type { VirtualDocument, VirtualPage, Workspace } from '@pdf-editor/document-model';
import { ChevronRight, ShieldCheck } from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { type Command, commandRegistry } from '../../commands/registry';
import { RENDER_PRIORITY } from '../../engine/engine-service';
import { formatFileSize } from '../../home/home-model';
import { m, useLocale } from '../../i18n';
import { PageCanvas } from '../../pages/PageCanvas';
import { displaySize, fitInBox } from '../../pages/page-geometry';
import { openPrivacyShield } from '../../privacy/PrivacyShield';
import { useSessionStore } from '../../session/session-store';
import { contentFrame, ResizedContent } from '../../stage/ResizedContent';
import { renameDocumentTo } from '../../stage/section-operations';
import { useCanChange } from '../../state/guard';
import { matchesMark, useSavedStore } from '../../state/saved-store';
import { pagesPhrase, useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { Keycaps } from '../../ui/Keycaps';
import { closeMenusAtOnce } from '../../ui/menu-handoff';
import menuStyles from '../../ui/Menu.module.css';
import { PopoverPopup } from '../../ui/Popover';
import { announce } from '../announcer';
import { closeTitleMenu, useFrameStore } from './frame-store';
import { APP_ITEMS } from './LibraryMenu';
import { LockSwitch } from './LockSwitch';
import styles from './TitleMenu.module.css';
import {
  mergeFiles,
  rotateDocumentPages,
  rotateScope,
  type ShownRow,
  shownTitleMenu,
} from './TitleMenuItems';

const subscribe = (listener: () => void) => commandRegistry.subscribe(listener);
const snapshot = () => commandRegistry.list();

/** The thumbnail's box in the header (F5 §2: 48 × 62). */
const THUMB = { width: 48, height: 62 } as const;

export interface TitleMenuProps {
  /** The element the menu opens from and gives focus back to (the active tab, the title). */
  readonly anchor: () => HTMLElement | null;
  /** Below 336 px the compact bar's ↷ moves here as a first row (spec 01.8). */
  readonly withRedo?: boolean;
}

export function TitleMenu({ anchor, withRedo = false }: TitleMenuProps) {
  const open = useFrameStore((s) => s.titleMenu);
  const doc = useActiveDocument();
  // A document closed while its menu is open closes the menu (F5 §6).
  useEffect(() => {
    if (open !== null && doc === undefined) closeTitleMenu();
  }, [open, doc]);
  if (!doc) return null;
  return (
    <Popover.Root
      open={open !== null}
      onOpenChange={(next) => {
        if (!next) closeTitleMenu();
      }}
    >
      {open !== null ? (
        <TitleMenuPopup doc={doc} anchor={anchor} focus={open} withRedo={withRedo} />
      ) : null}
    </Popover.Root>
  );
}

function TitleMenuPopup({
  doc,
  anchor,
  focus,
  withRedo,
}: {
  readonly doc: VirtualDocument;
  readonly anchor: () => HTMLElement | null;
  readonly focus: 'menu' | 'name' | 'facts';
  readonly withRedo: boolean;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const initialFocus = () => {
    if (focus === 'name') return nameRef.current;
    return listRef.current?.querySelector<HTMLElement>('[role="menuitem"]') ?? true;
  };
  useEffect(() => {
    if (focus === 'name') nameRef.current?.select();
  }, [focus]);
  return (
    <PopoverPopup
      side="bottom"
      align="start"
      anchor={anchor}
      className={styles.popup}
      initialFocus={initialFocus}
      finalFocus={() => anchor()}
      aria-label={m.frame_title_menu_name({ name: doc.title })}
      data-testid="title-menu"
    >
      <Header doc={doc} nameRef={nameRef} />
      <Rows listRef={listRef} withRedo={withRedo} />
    </PopoverPopup>
  );
}

// ---------------------------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------------------------

function Header({
  doc,
  nameRef,
}: {
  readonly doc: VirtualDocument;
  readonly nameRef: RefObject<HTMLInputElement | null>;
}) {
  const locale = useLocale();
  const workspace = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  const marks = useSavedStore((s) => s.marks);
  const keeping = useSessionStore((s) => s.keeping);
  const size = documentFileSize(doc, files);
  const facts = [
    pagesPhrase(doc.pages.length),
    size === undefined ? undefined : formatFileSize(size, locale),
  ]
    .filter(Boolean)
    .join(' · ');
  const edited = !matchesMark(workspace, doc.id, marks[doc.id]);
  const status = !edited
    ? m.frame_status_no_changes()
    : keeping === 'unavailable'
      ? m.frame_status_not_kept()
      : m.frame_status_kept();
  const first = doc.pages[0];
  return (
    <div className={styles.header}>
      <div className={styles.identity}>
        <div className={styles.thumbBox} aria-hidden="true">
          {first ? <Thumb workspace={workspace} page={first} /> : null}
        </div>
        <div className={styles.identityText}>
          {/* Keyed by the title: a rename elsewhere (a section header, Undo) starts the field again. */}
          <NameField key={doc.title} doc={doc} inputRef={nameRef} />
          <p className={styles.facts}>{facts}</p>
          <p className={styles.status} data-testid="title-menu-status">
            {status}
          </p>
        </div>
      </div>
      <LockSwitch documentId={doc.id} title={doc.title} />
      <Popover.Close
        className={styles.privacy}
        onClick={() => {
          closeMenusAtOnce();
          openPrivacyShield();
        }}
      >
        <ShieldCheck aria-hidden="true" />
        <span className={styles.privacyLabel}>{m.frame_privacy_line()}</span>
        <ChevronRight className={styles.privacyArrow} aria-hidden="true" />
      </Popover.Close>
    </div>
  );
}

/** Size of the file a document came from; undefined when made of several files or images. */
function documentFileSize(
  doc: VirtualDocument,
  files: Readonly<Record<string, { readonly size: number }>>,
): number | undefined {
  const sources = new Set<string>();
  for (const page of doc.pages) {
    if (page.ref.kind !== 'source') return undefined;
    sources.add(page.ref.source);
  }
  const [only] = sources;
  return sources.size === 1 && only !== undefined ? files[only]?.size : undefined;
}

function Thumb({ workspace, page }: { readonly workspace: Workspace; readonly page: VirtualPage }) {
  const size = displaySize(workspace, page);
  const box = fitInBox(size, THUMB.width, THUMB.height);
  const frame = contentFrame(workspace, page);
  return (
    <div className={styles.thumb} style={{ width: box.width, height: box.height }}>
      <ResizedContent frame={frame}>
        <PageCanvas
          sourceId={page.ref.kind === 'source' ? page.ref.source : undefined}
          blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
          index={page.ref.kind === 'source' ? page.ref.index : 0}
          rotation={page.rotation}
          widthPt={frame?.widthPt ?? size.width}
          heightPt={frame?.heightPt ?? size.height}
          cssWidth={box.width * (frame?.width ?? 1)}
          priority={RENDER_PRIORITY.visible}
        />
      </ResizedContent>
    </div>
  );
}

/** The name, editable in place (spec 01.4); a `document` act, read-only while locked. */
function NameField({
  doc,
  inputRef,
}: {
  readonly doc: VirtualDocument;
  readonly inputRef: RefObject<HTMLInputElement | null>;
}) {
  const [draft, setDraft] = useState(doc.title);
  const [problem, setProblem] = useState<string | null>(null);
  const allowed = useCanChange(doc.id, 'document');
  const hintId = useId();

  const commit = () => {
    const value = draft.trim();
    if (value === '' || value === doc.title) {
      setDraft(doc.title);
      setProblem(null);
      return;
    }
    const result = renameDocumentTo(doc.id, value);
    if (result.ok) setProblem(null);
    else setProblem(m.frame_rename_invalid());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape' && draft !== doc.title) {
      // Esc reverts and keeps the menu open; a second Esc closes it.
      event.preventDefault();
      event.stopPropagation();
      setDraft(doc.title);
      setProblem(null);
    }
  };

  return (
    <label className={styles.nameRow}>
      <span className="visually-hidden">{m.frame_name()}</span>
      <input
        ref={inputRef}
        className={styles.name}
        value={draft}
        readOnly={!allowed}
        aria-invalid={problem !== null || undefined}
        aria-describedby={!allowed || problem !== null ? hintId : undefined}
        aria-keyshortcuts="F2"
        spellCheck={false}
        autoComplete="off"
        data-testid="title-menu-name"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      {!allowed || problem !== null ? (
        <span id={hintId} className="visually-hidden">
          {allowed ? problem : m.guard_locked()}
        </span>
      ) : null}
    </label>
  );
}

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

/** The roving rows of the list: arrows, Home, End (APG menu, inside a dialog). */
function moveFocus(list: HTMLElement, from: Element | null, key: string): boolean {
  const rows = [...list.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  if (rows.length === 0) return false;
  const index = rows.findIndex((row) => row === from);
  let next: number;
  if (key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % rows.length;
  else if (key === 'ArrowUp')
    next = index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length;
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = rows.length - 1;
  else return false;
  for (const row of rows) row.tabIndex = -1;
  const target = rows[next];
  if (!target) return false;
  target.tabIndex = 0;
  target.focus();
  return true;
}

function Rows({
  listRef,
  withRedo,
}: {
  readonly listRef: RefObject<HTMLDivElement | null>;
  readonly withRedo: boolean;
}) {
  const commands = useSyncExternalStore(subscribe, snapshot);
  // Availability follows the document and its lock (read when the menu renders).
  useWorkspaceStore((s) => s.workspace);
  const sections = shownTitleMenu(commands);
  // The list's one Tab stop: its first row (APG roving; the arrows move it).
  const firstKey = withRedo ? 'edit.redo' : sections[0]?.rows[0]?.key;
  const tabStop = (key: string) => (key === firstKey ? 0 : -1);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;
    if (moveFocus(list, document.activeElement, event.key)) event.preventDefault();
  };

  return (
    <div
      ref={listRef}
      role="menu"
      tabIndex={-1}
      aria-label={m.frame_document_menu()}
      className={styles.list}
      onKeyDown={onKeyDown}
    >
      {withRedo ? (
        <div role="group" className={styles.group}>
          <CommandRow id="edit.redo" tabIndex={tabStop('edit.redo')} />
        </div>
      ) : null}
      {sections.map(({ section, rows }) => (
        <div
          key={section.id}
          role="group"
          aria-label={section.label?.() ?? m.frame_document_menu()}
          className={styles.group}
          data-section={section.id}
        >
          {section.label ? (
            <div className={styles.groupLabel} aria-hidden="true">
              {section.label()}
            </div>
          ) : null}
          {rows.map((row) =>
            row.entry.kind === 'rotate' ? (
              <RotateRow key={row.key} row={row} tabIndex={tabStop(row.key)} />
            ) : (
              <Row key={row.key} row={row} tabIndex={tabStop(row.key)} />
            ),
          )}
        </div>
      ))}
      <div role="group" aria-label={m.frame_app_group()} className={styles.group}>
        {APP_ITEMS.map((item) => (
          <MenuRow
            key={item.id}
            label={item.label()}
            enabled
            tabIndex={-1}
            onActivate={() => {
              closeMenusAtOnce();
              closeTitleMenu();
              item.run();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CommandRow({ id, tabIndex }: { readonly id: string; readonly tabIndex: number }) {
  const registered = commandRegistry.get(id);
  if (!registered) return null;
  const enabled = commandRegistry.isEnabled(registered);
  return (
    <Row
      row={{
        key: id,
        entry: { kind: 'command', id },
        command: registered,
        label: registered.title,
        enabled,
        reason: enabled ? undefined : commandRegistry.disabledReason(registered),
      }}
      tabIndex={tabIndex}
    />
  );
}

function runRow(row: ShownRow): void {
  if (row.entry.kind === 'merge') void mergeFiles();
  else if (row.command) void commandRegistry.execute(row.command.id);
}

function Row({ row, tabIndex }: { readonly row: ShownRow; readonly tabIndex: number }) {
  return (
    <MenuRow
      label={row.label}
      enabled={row.enabled}
      reason={row.reason}
      command={row.command}
      tabIndex={tabIndex}
      data-command={row.command?.id ?? row.key}
      onActivate={() => {
        closeMenusAtOnce();
        closeTitleMenu();
        runRow(row);
      }}
    />
  );
}

/** One `menuitem`: label, keycaps on fine pointers, the reason while dimmed (RA-21). */
function MenuRow({
  label,
  enabled,
  reason,
  command,
  tabIndex,
  onActivate,
  trailing,
  ...rest
}: {
  readonly label: string;
  readonly enabled: boolean;
  readonly reason?: string | undefined;
  readonly command?: Command | undefined;
  readonly tabIndex: number;
  readonly onActivate: () => void;
  readonly trailing?: ReactElement;
  readonly 'data-command'?: string;
}) {
  const shortcut = command?.shortcuts[0];
  const reasonId = useId();
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={tabIndex}
      className={`${menuStyles.item} ${styles.row}`}
      aria-disabled={enabled ? undefined : 'true'}
      aria-describedby={enabled || !reason ? undefined : reasonId}
      data-disabled={enabled ? undefined : ''}
      title={enabled ? undefined : reason}
      onClick={() => {
        if (enabled) onActivate();
        else if (reason) announce(reason);
      }}
      {...rest}
    >
      <span className={menuStyles.label}>{label}</span>
      {trailing ??
        (enabled && shortcut ? (
          <Keycaps shortcut={shortcut} tone="quiet" />
        ) : !enabled && reason ? (
          <span id={reasonId} className={menuStyles.hint}>
            {reason}
          </span>
        ) : null)}
    </button>
  );
}

/** "Rotate all ▸": a nested menu of the three turns (Right or Enter opens it). */
function RotateRow({ row, tabIndex }: { readonly row: ShownRow; readonly tabIndex: number }) {
  const scope = rotateScope();
  const count = scope.pages.length;
  const [open, setOpen] = useState(false);
  const turn = (delta: 90 | -90 | 180) => {
    rotateDocumentPages(delta);
    closeTitleMenu();
  };
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        render={
          <button
            type="button"
            role="menuitem"
            tabIndex={tabIndex}
            className={`${menuStyles.item} ${styles.row}`}
            aria-disabled={row.enabled ? undefined : 'true'}
            title={row.enabled ? undefined : row.reason}
            data-disabled={row.enabled ? undefined : ''}
            data-command="rotate"
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' && row.enabled) {
                event.preventDefault();
                setOpen(true);
              }
            }}
          />
        }
        disabled={!row.enabled}
      >
        <span className={menuStyles.label}>{row.label}</span>
        <ChevronRight className={menuStyles.submenuArrow} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="right" align="start" sideOffset={4} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup}>
            <Menu.Group>
              <Menu.GroupLabel className={menuStyles.groupLabel}>
                {scope.selected
                  ? m.menu_rotate_scope_selected({ count })
                  : m.menu_rotate_scope_all({ count })}
              </Menu.GroupLabel>
              <Menu.Item className={menuStyles.item} onClick={() => turn(90)}>
                <span className={menuStyles.label}>{m.menu_rotate_right()}</span>
              </Menu.Item>
              <Menu.Item className={menuStyles.item} onClick={() => turn(-90)}>
                <span className={menuStyles.label}>{m.menu_rotate_left()}</span>
              </Menu.Item>
              <Menu.Item className={menuStyles.item} onClick={() => turn(180)}>
                <span className={menuStyles.label}>{m.menu_rotate_half()}</span>
              </Menu.Item>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
