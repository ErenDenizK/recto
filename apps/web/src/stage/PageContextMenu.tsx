/**
 * The page context menu (ADR-0019 §4, craft spec §3.4): right-click, the Menu key or
 * Shift+F10 on a page in Read or Edit. In Edit it carries the page operations that left the
 * tool bar with the Pages group: Rotate page left and right, Delete page, Crop… and Arrange,
 * and "Edit text here", which arms Edit text. Every item acts on the page it was opened on,
 * and Rotate and Delete say which ("Rotate page 3 left"). The Document menu keeps "Rotate
 * pages…" and "Crop…" for many pages.
 *
 * The page operations are `pages` acts (ADR-0030): offered in viewing and in Markup alike, and
 * dimmed while the document is locked (S8), as "Edit text here" is (a `text` act); Arrange
 * stays.
 *
 * One menu for the page view, mounted with the tool bar: it listens on the document for a
 * `contextmenu` over a page of the Read viewport, and for Shift+F10 or the Menu key with the
 * focus in the viewport (the focused page, else the current page). A right-click over
 * selected text, an editor or a contextual bar keeps the browser's own menu (Copy).
 *
 * On touch and pen it also opens from a long press on the paper (04-context §2.3, §13 item 1;
 * spec D1-7), through the gesture core's recogniser (`motion/gesture/`, 450 ms, 10 px): iOS
 * fires no `contextmenu` for a long press, and the recogniser keeps WebKit's callout and
 * selection off the pressed paper and swallows Android's own `contextmenu` and the release's
 * click. A press on a text run is left to native selection; a pointer that draws never
 * long-presses (spec 04.11, `pointerDraws`: a drawing tool's pointer, a finger only while it
 * draws, and the pen in Markup with Select once it writes there).
 *
 * A Base UI menu anchored at the pointer (or the page's visible corner from the keyboard), in
 * the menu glass (tier 3, ui/Menu.module.css). On close the focus returns where it was.
 */
import { Menu } from '@base-ui/react/menu';
import { findPageLocation, type PageId } from '@pdf-editor/document-model';
import { Crop, LayoutGrid, RotateCcw, RotateCw, TextCursorInput, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { activateTool } from '../annotations/commands';
import { penSession, pointerRole } from '../annotations/pen/ink-input';
import { toolDefinition } from '../annotations/tools';
import { commandRegistry } from '../commands/registry';
import { currentPlatform, type ParsedShortcut } from '../commands/shortcuts';
import { m } from '../i18n';
import { attachLongPress } from '../motion/gesture';
import { announce } from '../shell/announcer';
import { useSelectionStore } from '../state/selection-store';
import { useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { penDrawsNow } from '../viewer/edit-policy';
import { pointerDraws } from '../viewer/hit-order';
import { pageInputNow, useCanChangeActive } from '../viewer/input-state';
import { TEXT_LAYER_ATTR } from '../viewer/text-model';
import { Keycaps } from '../ui/Keycaps';
import { toast } from '../ui/Toast/toast';
import menuStyles from '../ui/Menu.module.css';
import { openOperationDialog } from './operation-dialogs-store';
import styles from './PageContextMenu.module.css';

/** Where the menu opened and for which page. */
export interface PageMenuRequest {
  readonly pageId: PageId;
  readonly point: { readonly x: number; readonly y: number };
}

/** Targets that keep the browser's menu: editors and the contextual bars over the page. */
const OWN_MENU =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [data-annotation-keep]';
/** From the keyboard, the menu opens this far inside the page's visible corner. */
const KEYBOARD_INSET = 24;
/** A keyboard-opened menu also gets the browser's `contextmenu` event: ignored this long. */
const KEYBOARD_ECHO_MS = 400;

/** The page's 1-based position in its document, or undefined when it is gone. */
function pageNumber(pageId: PageId): number | undefined {
  const location = findPageLocation(useWorkspaceStore.getState().workspace, pageId);
  return location === undefined ? undefined : location.index + 1;
}

/** Rotates one page 90° (clockwise for a positive delta) and says which page turned. */
export function rotatePage(pageId: PageId, delta: 90 | -90): boolean {
  const number = pageNumber(pageId);
  if (number === undefined) return false;
  if (!useWorkspaceStore.getState().rotatePages([pageId], delta)) return false;
  announce(
    delta > 0 ? m.page_menu_rotated_right({ number }) : m.page_menu_rotated_left({ number }),
  );
  return true;
}

/** Deletes one page (one undo step) and says which page went. */
export function deletePage(pageId: PageId): boolean {
  const number = pageNumber(pageId);
  if (number === undefined) return false;
  const documentId = findPageLocation(useWorkspaceStore.getState().workspace, pageId)?.document;
  if (!useWorkspaceStore.getState().deletePages([pageId])) return false;
  const selection = useSelectionStore.getState();
  if (selection.selected.has(pageId)) {
    const selected = new Set(selection.selected);
    selected.delete(pageId);
    selection.apply({
      selected,
      anchor: selection.anchor === pageId ? null : selection.anchor,
      focused: selection.focused === pageId ? null : selection.focused,
    });
  }
  const shortcut = currentPlatform === 'mac' ? m.undo_hint_mac() : m.undo_hint_other();
  // The Undo toast (FB4), said as before ("Deleted page 2. Undo with Control Z").
  toast.undo(m.toast_deleted_pages({ count: 1, page: number }), {
    documentId,
    spoken: m.page_menu_deleted({ number, shortcut }),
  });
  return true;
}

/** "Crop…": the crop dialog for this page. */
export function cropPage(pageId: PageId): boolean {
  const location = findPageLocation(useWorkspaceStore.getState().workspace, pageId);
  if (location === undefined) return false;
  openOperationDialog({ kind: 'crop', documentId: location.document, pageIds: [pageId] });
  return true;
}

/** "Arrange": the light table with this page selected (unless it is already in the selection). */
export function arrangePage(pageId: PageId): void {
  const selection = useSelectionStore.getState();
  if (!selection.selected.has(pageId)) {
    selection.apply({ selected: new Set([pageId]), anchor: pageId, focused: pageId });
  }
  void commandRegistry.execute('mode.arrange');
}

/** Whether a right-click lands on the current text selection (Copy is the browser's). */
function onSelectedText(target: Element): boolean {
  const selection = globalThis.getSelection?.() ?? null;
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  return selection.containsNode(target, true);
}

/**
 * The page a long press may open the menu on, or null (04-context §2.3 *Start*, *Cancel*,
 * *Resolve*): the paper of a page in the Read viewport, not an editor or a bar, not the
 * selected text, not a text run (native selection runs there), and not a pointer that draws.
 */
function longPressPage(event: PointerEvent): HTMLElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const page = target.closest<HTMLElement>('[data-read-viewport] [data-page-id]');
  if (!page || target.closest(OWN_MENU) || onSelectedText(target)) return null;
  if (target.closest(`[${TEXT_LAYER_ATTR}] > span`)) return null;
  const state = pageInputNow(event.pointerType === 'pen' && penDrawsNow());
  const fingerDraws = pointerRole(penSession(), event, performance.now()) !== 'pan';
  if (pointerDraws(state, event.pointerType, fingerDraws)) return null;
  return page;
}

/** The menu's point from the keyboard: just inside the visible part of the page. */
function keyboardPoint(page: HTMLElement, viewport: Element): { x: number; y: number } {
  const box = page.getBoundingClientRect();
  const view = viewport.getBoundingClientRect();
  return {
    x: Math.max(box.left, view.left) + KEYBOARD_INSET,
    y: Math.max(box.top, view.top) + KEYBOARD_INSET,
  };
}

function Item({
  label,
  icon,
  shortcut,
  quiet,
  disabled,
  onClick,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly shortcut?: ParsedShortcut | undefined;
  /** Looks unavailable (the Read row), but can still be chosen. */
  readonly quiet?: boolean;
  /** Dimmed and not chosen: the guard refuses its act (the document is locked). */
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) {
  return (
    <Menu.Item
      className={quiet ? `${menuStyles.item} ${styles.quiet}` : menuStyles.item}
      data-quiet={quiet ? '' : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span className={menuStyles.label}>{label}</span>
      {shortcut ? <Keycaps shortcut={shortcut} tone="quiet" /> : null}
    </Menu.Item>
  );
}

export function PageContextMenu() {
  const [request, setRequest] = useState<PageMenuRequest | null>(null);
  // Page operations are `pages` acts, "Edit text here" a `text` act: both refused only while
  // the document is locked (ADR-0030), when they show dimmed (S8).
  const canPages = useCanChangeActive('pages');
  const canEditText = useCanChangeActive('text');
  // Re-render when the page moves (its number changes) while the menu is open.
  useWorkspaceStore((s) => s.workspace);
  const restore = useRef<HTMLElement | null>(null);
  const keyboardAt = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    const open = (page: HTMLElement, point: { x: number; y: number }) => {
      const pageId = page.dataset.pageId as PageId | undefined;
      if (pageId === undefined) return;
      const active = document.activeElement;
      restore.current = active instanceof HTMLElement && active !== document.body ? active : null;
      setRequest({ pageId, point });
    };
    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented || !(event.target instanceof Element)) return;
      const page = event.target.closest<HTMLElement>('[data-read-viewport] [data-page-id]');
      if (!page) return;
      if (performance.now() - keyboardAt.current < KEYBOARD_ECHO_MS) {
        event.preventDefault();
        return;
      }
      if (event.target.closest(OWN_MENU) || onSelectedText(event.target)) return;
      event.preventDefault();
      open(page, { x: event.clientX, y: event.clientY });
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const menuKey =
        event.key === 'ContextMenu' ||
        (event.key === 'F10' && event.shiftKey && !event.ctrlKey && !event.altKey);
      if (!menuKey || event.metaKey || event.defaultPrevented) return;
      if (!(event.target instanceof Element) || event.target.closest(OWN_MENU)) return;
      const viewport = event.target.closest('[data-read-viewport]');
      if (!viewport) return;
      const page =
        event.target.closest<HTMLElement>('[data-page-id]') ??
        viewport.querySelector<HTMLElement>(
          `[data-page-index="${useViewStore.getState().currentPage}"]`,
        );
      if (!page) return;
      event.preventDefault();
      keyboardAt.current = performance.now();
      open(page, keyboardPoint(page, viewport));
    };
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);
    // Touch and pen: the long press, at the press point (its echoes never reach onContextMenu).
    const detachLongPress = attachLongPress(document, {
      shouldStart: (event) => longPressPage(event) !== null,
      onFire: (event) => {
        const page = longPressPage(event);
        if (page) open(page, { x: event.clientX, y: event.clientY });
      },
    });
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
      detachLongPress();
    };
  }, []);

  const pageId = request?.pageId;
  const number = pageId === undefined ? undefined : pageNumber(pageId);
  const point = request?.point;
  const anchor =
    point === undefined
      ? null
      : {
          getBoundingClientRect: () =>
            DOMRect.fromRect({ x: point.x, y: point.y, width: 0, height: 0 }),
        };
  const close = () => setRequest(null);
  const run = (action: (id: PageId) => unknown) => () => {
    if (pageId !== undefined) action(pageId);
  };

  return (
    <Menu.Root
      open={request !== null && number !== undefined}
      modal={false}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Menu.Portal>
        <Menu.Positioner
          anchor={anchor}
          side="right"
          align="start"
          sideOffset={0}
          collisionPadding={8}
        >
          <Menu.Popup
            className={menuStyles.popup}
            aria-label={number === undefined ? undefined : m.page_menu_label({ number })}
            data-testid="page-context-menu"
            // Back where the focus was (the viewport, a run), unless an item moved it on (a
            // dialog took it).
            finalFocus={() => {
              const active = document.activeElement;
              const target = restore.current;
              restore.current = null;
              const lost =
                active === null ||
                active === document.body ||
                active.closest('[data-testid="page-context-menu"]') !== null;
              return lost && target?.isConnected ? target : false;
            }}
          >
            {number === undefined ? null : (
              <>
                <Item
                  label={m.page_menu_edit_text()}
                  icon={<TextCursorInput aria-hidden="true" className={styles.icon} />}
                  shortcut={commandRegistry.get('tool.edit-text')?.shortcuts[0]}
                  disabled={!canEditText}
                  onClick={() => void activateTool(toolDefinition('edit-text'))}
                />
                <Menu.Separator className={menuStyles.separator} />
                <Item
                  label={m.page_menu_rotate_left({ number })}
                  icon={<RotateCcw aria-hidden="true" className={styles.icon} />}
                  disabled={!canPages}
                  onClick={run((id) => rotatePage(id, -90))}
                />
                <Item
                  label={m.page_menu_rotate_right({ number })}
                  icon={<RotateCw aria-hidden="true" className={styles.icon} />}
                  disabled={!canPages}
                  onClick={run((id) => rotatePage(id, 90))}
                />
                <Item
                  label={m.page_menu_delete({ number })}
                  icon={<Trash2 aria-hidden="true" className={styles.icon} />}
                  disabled={!canPages}
                  onClick={run(deletePage)}
                />
                <Menu.Separator className={menuStyles.separator} />
                <Item
                  label={m.page_menu_crop()}
                  icon={<Crop aria-hidden="true" className={styles.icon} />}
                  disabled={!canPages}
                  onClick={run(cropPage)}
                />
                <Menu.Separator className={menuStyles.separator} />
                <Item
                  label={m.mode_arrange()}
                  icon={<LayoutGrid aria-hidden="true" className={styles.icon} />}
                  shortcut={commandRegistry.get('mode.arrange')?.shortcuts[0]}
                  onClick={run(arrangePage)}
                />
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
