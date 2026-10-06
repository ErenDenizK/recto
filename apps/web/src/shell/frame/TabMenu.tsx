/**
 * The tab menu (`components/01-frame.md` F4 §5, §6; inventory 8.13): right-click, a 450 ms
 * long press or Shift+F10 on a tab. Rename… · Lock · Show in Pages grid · Move left · Move
 * right · Close · Close other documents. It replaces `stage/TabArrangeMenu.tsx`; M8's "Hide
 * from Arrange" went to the Pages grid's scope switch (PG2), and the tab stays draggable onto
 * the grid, which then shows All open.
 *
 * - Rename… activates the document and opens the title menu with its name field focused
 *   (spec 01.4: rename lives in the title menu's header).
 * - Lock locks with the reason `user`; Unlock unlocks a `user` or `default` lock at once, and
 *   for a `signed` or `restricted` lock opens the title menu, whose switch shows the warning
 *   first (F5 §6, flows.md §2.6).
 * - Close asks nothing (changes stay on the device, ADR-0032); focus goes to the next tab.
 */
import { draggable } from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine';
import { ContextMenu } from '@base-ui/react/context-menu';
import type { DocumentId } from '@pdf-editor/document-model';
import { type ReactElement, useCallback } from 'react';

import type { TabDragData } from '../../dnd/page-drag';
import { attachTabDropTarget } from '../../dnd/tab-drop';
import { showTab } from '../../home/home-actions';
import { m } from '../../i18n';
import { enterGrid } from '../../stage/grid/grid-transition';
import { useLock, useLockStore } from '../../state/lock-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import menuStyles from '../../ui/Menu.module.css';
import { announce } from '../announcer';
import { openTitleMenu } from './frame-store';

export interface TabMenuProps {
  readonly documentId: DocumentId;
  readonly title: string;
  /** Closes the document and moves focus as the strip does (F4 §6). */
  readonly onClose: (id: DocumentId) => void;
  readonly children: ReactElement;
}

/** Locks or unlocks from a tab (module header); returns what it announced. */
export function toggleLockFromTab(id: DocumentId, title: string): void {
  const reason = useLockStore.getState().locks[id];
  if (reason === undefined) {
    useLockStore.getState().lock(id, 'user');
    announce(m.frame_lock_announce_locked({ name: title }));
    return;
  }
  if (reason === 'signed' || reason === 'restricted') {
    showTab(id);
    openTitleMenu('menu');
    return;
  }
  useLockStore.getState().unlock(id);
  announce(m.frame_lock_announce_unlocked({ name: title }));
}

export function TabMenu({ documentId, title, onClose, children }: TabMenuProps) {
  const order = useWorkspaceStore((s) => s.workspace.documentOrder);
  const index = order.indexOf(documentId);
  const locked = useLock(documentId) !== undefined;
  const dragRef = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) return;
      // Draggable onto the grid, and a drop target for pages from it (F4 §6, dnd/tab-drop.ts).
      return combine(
        draggable({
          element,
          getInitialData: (): TabDragData => ({ type: 'tab', documentId }),
        }),
        attachTabDropTarget(element, documentId),
      );
    },
    [documentId],
  );

  const move = (to: number) => {
    if (!useWorkspaceStore.getState().reorderDocuments(documentId, to)) return;
    announce(m.frame_tab_moved({ name: title, position: to + 1, count: order.length }));
  };

  const closeOthers = () => {
    const others = useWorkspaceStore
      .getState()
      .workspace.documentOrder.filter((id) => id !== documentId);
    showTab(documentId);
    for (const id of others) useWorkspaceStore.getState().closeDocument(id);
    announce(m.frame_closed_others({ count: others.length }));
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger ref={dragRef} render={children} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner collisionPadding={8}>
          <ContextMenu.Popup className={menuStyles.popup} data-testid="tab-menu">
            <ContextMenu.Item
              className={menuStyles.item}
              onClick={() => {
                showTab(documentId);
                openTitleMenu('name');
              }}
            >
              <span className={menuStyles.label}>{m.frame_rename()}</span>
            </ContextMenu.Item>
            <ContextMenu.Item
              className={menuStyles.item}
              onClick={() => toggleLockFromTab(documentId, title)}
            >
              <span className={menuStyles.label}>{locked ? m.frame_unlock() : m.frame_lock()}</span>
            </ContextMenu.Item>
            <ContextMenu.Item
              className={menuStyles.item}
              onClick={() => {
                showTab(documentId);
                enterGrid();
              }}
            >
              <span className={menuStyles.label}>{m.frame_show_in_grid()}</span>
            </ContextMenu.Item>
            <ContextMenu.Separator className={menuStyles.separator} />
            <ContextMenu.Item
              className={menuStyles.item}
              disabled={index <= 0}
              onClick={() => move(index - 1)}
            >
              <span className={menuStyles.label}>{m.frame_move_left()}</span>
            </ContextMenu.Item>
            <ContextMenu.Item
              className={menuStyles.item}
              disabled={index < 0 || index >= order.length - 1}
              onClick={() => move(index + 1)}
            >
              <span className={menuStyles.label}>{m.frame_move_right()}</span>
            </ContextMenu.Item>
            <ContextMenu.Separator className={menuStyles.separator} />
            <ContextMenu.Item className={menuStyles.item} onClick={() => onClose(documentId)}>
              <span className={menuStyles.label}>{m.common_close()}</span>
            </ContextMenu.Item>
            <ContextMenu.Item
              className={menuStyles.item}
              disabled={order.length < 2}
              onClick={closeOthers}
            >
              <span className={menuStyles.label}>{m.frame_close_others()}</span>
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
