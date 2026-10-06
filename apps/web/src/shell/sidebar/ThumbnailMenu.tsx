/**
 * The thumbnail menu (`components/06-navigation.md` N2 §5, §6; spec 06.4): the page menu's
 * page group for one thumbnail, or for the selection when it holds that page. Opened by a
 * right-click, Shift+F10 or the Menu key on a row, and on touch by a long press released
 * without moving (06.3), where Select comes first.
 *
 * Items: Select (coarse) · Rotate left · Rotate right · Delete · Crop… · Insert blank page
 * after · Extract to new document · Copy · Paste pages after · Show in Pages grid. Every change
 * is a `pages` act: dimmed while the document is locked; Delete is dimmed when it would remove
 * every page ("A document needs one page"). A Base UI menu at the pointer (or the row's corner
 * from the keyboard) in the menu material; focus returns to the row on close.
 */
import { Menu } from '@base-ui/react/menu';
import type { DocumentId, PageId } from '@pdf-editor/document-model';
import type { ReactNode } from 'react';

import { m } from '../../i18n';
import { toggleSelection, selectionSnapshot, useSelectionStore } from '../../state/selection-store';
import { Icon } from '../../ui/Icon';
import menuStyles from '../../ui/Menu.module.css';
import { useCanChange } from '../../state/guard';
import {
  copyPagesOf,
  cropPages,
  deletePages,
  deletesEveryPage,
  extractPagesOf,
  insertBlankAfterPage,
  pagesFor,
  pasteAfterPage,
  rotatePages,
  showInGrid,
} from './thumbnail-actions';
import styles from './ThumbnailList.module.css';

export interface ThumbnailMenuRequest {
  readonly pageId: PageId;
  readonly point: { readonly x: number; readonly y: number };
  /** A finger opened it: Select comes first (06.3). */
  readonly touch: boolean;
}

function Item({
  label,
  icon,
  disabled,
  danger,
  reason,
  onClick,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly disabled?: boolean | undefined;
  readonly danger?: boolean | undefined;
  /** Why a dimmed item cannot run (its accessible description). */
  readonly reason?: string | undefined;
  readonly onClick: () => void;
}) {
  return (
    <Menu.Item
      className={menuStyles.item}
      disabled={disabled}
      aria-description={disabled ? reason : undefined}
      title={disabled ? reason : undefined}
      data-danger={danger ? '' : undefined}
      onClick={onClick}
    >
      {icon}
      <span className={menuStyles.label}>{label}</span>
    </Menu.Item>
  );
}

export function ThumbnailMenu({
  request,
  documentId,
  order,
  onClose,
  restoreFocus,
}: {
  readonly request: ThumbnailMenuRequest | null;
  readonly documentId: DocumentId;
  /** The document's pages in order. */
  readonly order: readonly PageId[];
  readonly onClose: () => void;
  /** Where focus goes back on close (the row). */
  readonly restoreFocus: () => HTMLElement | null;
}) {
  const canPages = useCanChange(documentId, 'pages');
  const clipboard = useSelectionStore((s) => s.clipboard);
  // Re-render while open when the selection changes (Select toggles it).
  useSelectionStore((s) => s.selected);
  const pageId = request?.pageId;
  const index = pageId === undefined ? -1 : order.indexOf(pageId);
  const ids = pageId === undefined ? [] : pagesFor(pageId, order);
  const count = ids.length;
  const number = index + 1;
  const point = request?.point;
  const anchor =
    point === undefined
      ? null
      : {
          getBoundingClientRect: () =>
            DOMRect.fromRect({ x: point.x, y: point.y, width: 0, height: 0 }),
        };
  const icon = (name: Parameters<typeof Icon>[0]['name']) => (
    <Icon name={name} className={styles.menuIcon} />
  );
  const many = count > 1;
  const everyPage = deletesEveryPage(ids, order.length);
  const selected = pageId !== undefined && useSelectionStore.getState().selected.has(pageId);

  return (
    <Menu.Root
      open={request !== null && index >= 0}
      modal={false}
      onOpenChange={(open) => {
        if (!open) onClose();
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
            aria-label={m.page_menu_label({ number })}
            data-testid="thumbnail-menu"
            finalFocus={() => {
              const active = document.activeElement;
              const lost =
                active === null ||
                active === document.body ||
                active.closest('[data-testid="thumbnail-menu"]') !== null;
              const row = restoreFocus();
              return lost && row?.isConnected ? row : false;
            }}
          >
            {pageId === undefined ? null : (
              <>
                {request?.touch ? (
                  <>
                    <Item
                      label={selected ? m.thumb_menu_deselect() : m.thumb_menu_select()}
                      icon={icon('check-square')}
                      onClick={() => {
                        const state = selectionSnapshot();
                        useSelectionStore
                          .getState()
                          .apply({ ...toggleSelection(state, pageId), focused: state.focused });
                      }}
                    />
                    <Menu.Separator className={menuStyles.separator} />
                  </>
                ) : null}
                <Item
                  label={
                    many
                      ? m.thumb_menu_rotate_left_many({ count })
                      : m.page_menu_rotate_left({ number })
                  }
                  icon={icon('arrow-counter-clockwise')}
                  disabled={!canPages}
                  onClick={() => rotatePages(ids, -90)}
                />
                <Item
                  label={
                    many
                      ? m.thumb_menu_rotate_right_many({ count })
                      : m.page_menu_rotate_right({ number })
                  }
                  icon={icon('arrow-clockwise')}
                  disabled={!canPages}
                  onClick={() => rotatePages(ids, 90)}
                />
                <Item
                  label={
                    many ? m.thumb_menu_delete_many({ count }) : m.page_menu_delete({ number })
                  }
                  icon={icon('trash')}
                  danger
                  disabled={!canPages || everyPage}
                  reason={everyPage ? m.thumb_menu_one_page() : undefined}
                  onClick={() => deletePages(ids)}
                />
                <Menu.Separator className={menuStyles.separator} />
                <Item
                  label={m.thumb_menu_crop()}
                  icon={icon('crop')}
                  disabled={!canPages}
                  onClick={() => cropPages(ids)}
                />
                <Item
                  label={m.thumb_menu_insert_blank()}
                  icon={icon('plus-square')}
                  disabled={!canPages}
                  onClick={() => insertBlankAfterPage(ids[ids.length - 1] ?? pageId)}
                />
                <Item
                  label={m.thumb_menu_extract()}
                  icon={icon('arrow-square-out')}
                  disabled={!canPages || everyPage}
                  onClick={() => extractPagesOf(ids)}
                />
                <Menu.Separator className={menuStyles.separator} />
                <Item
                  label={many ? m.thumb_menu_copy_many({ count }) : m.thumb_menu_copy()}
                  icon={icon('copy')}
                  onClick={() => copyPagesOf(ids)}
                />
                <Item
                  label={m.thumb_menu_paste_after()}
                  icon={icon('file-plus')}
                  disabled={!canPages || clipboard === null}
                  onClick={() => pasteAfterPage(ids[ids.length - 1] ?? pageId)}
                />
                <Menu.Separator className={menuStyles.separator} />
                <Item
                  label={m.thumb_menu_show_grid()}
                  icon={icon('squares-four')}
                  onClick={() => showInGrid(pageId)}
                />
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
