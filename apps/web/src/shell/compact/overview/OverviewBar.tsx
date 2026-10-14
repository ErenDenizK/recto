/**
 * The overview's bar (MOB-3; `docs/research/phone-2026-10/pages.md` §4.1): one floating glass
 * capsule (the reading capsule's M2) whose content follows the overview's state, two or three
 * actions as EDN-7 asks, the rest in a pop-up.
 *
 * - **At rest:** the page count, ＋ Add (a pop-up: Pages from a file, A blank page, and the
 *   Library's recent documents), Share (the whole document, EDN-14's path) and Done.
 * - **Selecting** (a long press): "3 selected", Rotate, Delete, ⋯ (Duplicate, Move to start,
 *   Move to end, Extract as file, Split here) and Done, which ends the selection.
 *
 * The pop-ups are the menu recipe (`ui/Menu.module.css`: M4 glass, container transform from
 * their trigger, MOT-5). Every act is `page-actions.ts`: one undo step with the Undo toast.
 * Extract and Split make files and hand them to the share sheet; the open document is not
 * changed.
 */
import { Menu } from '@base-ui/react/menu';
import type { PageId, VirtualDocument } from '@pdf-editor/document-model';
import type { ReactNode } from 'react';

import { useRecentsStore } from '../../../files/recents';
import { m } from '../../../i18n';
import { pagesPhrase } from '../../../state/workspace-store';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import menuStyles from '../../../ui/Menu.module.css';
import { toast } from '../../../ui/Toast/toast';
import { isOpenEntry, shareOrDownload } from '../compact-actions';
import styles from './CompactOverview.module.css';
import { closeOverview } from './morph';
import {
  addBlank,
  addFromPicker,
  addRecent,
  deliver,
  duplicate,
  extract,
  indexesOf,
  moveTo,
  remove,
  rotate,
  split,
} from './page-actions';
import { setSelecting, useOverviewSelection } from './selection';

/** How many recent documents Add lists. */
const RECENT_ROWS = 4;

function Item({
  icon,
  label,
  onClick,
  disabled,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Menu.Item className={menuStyles.item} disabled={disabled} onClick={onClick}>
      {icon}
      <span className={menuStyles.label}>{label}</span>
    </Menu.Item>
  );
}

/** Makes files from the selection and hands them on; says so if it could not. */
function makeFiles(make: () => Promise<File[]>): void {
  toast.info(m.compact_overview_making());
  make()
    .then((files) => deliver(files))
    .catch((error: unknown) => {
      const reason = error instanceof Error && error.message ? error.message : '';
      toast.failure(m.compact_overview_make_failed({ reason }));
    });
}

export function OverviewBar({
  doc,
  anchor,
}: {
  readonly doc: VirtualDocument;
  readonly anchor: number;
}) {
  const selecting = useOverviewSelection((s) => s.selecting);
  const selected = useOverviewSelection((s) => s.selected);
  const ids: PageId[] = doc.pages.filter((p) => selected.has(p.id)).map((p) => p.id);
  const count = ids.length;
  return selecting ? (
    <Selecting doc={doc} ids={ids} count={count} />
  ) : (
    <AtRest doc={doc} anchor={anchor} />
  );
}

function AtRest({ doc, anchor }: { readonly doc: VirtualDocument; readonly anchor: number }) {
  const recents = useRecentsStore((s) => s.entries)
    .filter((entry) => !isOpenEntry(entry))
    .slice(0, RECENT_ROWS);
  return (
    <div className={styles.barRow} data-testid="compact-overview-actions">
      <span className={styles.count}>{pagesPhrase(doc.pages.length)}</span>
      <Menu.Root>
        <Menu.Trigger
          className="btn btn-quiet"
          aria-label={m.compact_overview_add_label()}
          data-testid="compact-overview-add"
        >
          <Icon name="plus" />
          {m.compact_overview_add()}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="top" align="center" sideOffset={8} collisionPadding={8}>
            <Menu.Popup
              className={menuStyles.popup}
              aria-label={m.compact_overview_add_label()}
              data-testid="compact-overview-add-menu"
            >
              <Item
                icon={<Icon name="file-plus" />}
                label={m.compact_overview_add_file()}
                onClick={() => void addFromPicker([], anchor)}
              />
              <Item
                icon={<Icon name="file" />}
                label={m.compact_overview_add_blank()}
                onClick={() => addBlank([], anchor)}
              />
              {recents.length > 0 ? (
                <Menu.Group>
                  <Menu.Separator className={menuStyles.separator} />
                  <Menu.GroupLabel className={menuStyles.groupLabel}>
                    {m.compact_overview_add_recent()}
                  </Menu.GroupLabel>
                  {recents.map((entry) => (
                    <Item
                      key={entry.id}
                      icon={<Icon name="file" />}
                      label={entry.name}
                      onClick={() => void addRecent(entry, [], anchor)}
                    />
                  ))}
                </Menu.Group>
              ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Button variant="quiet" icon={<Icon name="export" />} onClick={() => void shareOrDownload()}>
        {m.compact_share()}
      </Button>
      <Button variant="quiet" onClick={() => closeOverview()}>
        {m.compact_done()}
      </Button>
    </div>
  );
}

function Selecting({
  doc,
  ids,
  count,
}: {
  readonly doc: VirtualDocument;
  readonly ids: readonly PageId[];
  readonly count: number;
}) {
  const none = count === 0;
  const every = count >= doc.pages.length;
  const first = indexesOf(doc, ids)[0] ?? 0;
  return (
    <div className={styles.barRow} data-testid="compact-overview-selection-bar">
      <span className={styles.count} aria-live="polite">
        {m.compact_overview_selected({ count })}
      </span>
      <Button
        variant="quiet"
        className={styles.iconAction}
        aria-label={m.compact_overview_rotate()}
        disabled={none}
        onClick={() => rotate(ids)}
      >
        <Icon name="arrow-clockwise" />
      </Button>
      <Button
        variant="quiet"
        className={styles.iconAction}
        aria-label={m.compact_overview_delete()}
        disabled={none || every}
        onClick={() => {
          if (remove(ids)) setSelecting(false);
        }}
      >
        <Icon name="trash" />
      </Button>
      <Menu.Root>
        <Menu.Trigger
          className={`btn btn-quiet ${styles.iconAction}`}
          aria-label={m.compact_overview_more()}
          disabled={none}
          data-testid="compact-overview-more"
        >
          <Icon name="dots-three" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="top" align="end" sideOffset={8} collisionPadding={8}>
            <Menu.Popup
              className={menuStyles.popup}
              aria-label={m.compact_overview_more()}
              data-testid="compact-overview-more-menu"
            >
              <Item
                icon={<Icon name="copy" />}
                label={m.compact_overview_duplicate()}
                onClick={() => duplicate(ids)}
              />
              <Item
                icon={<Icon name="arrow-up" />}
                label={m.compact_overview_move_start()}
                disabled={every}
                onClick={() => moveTo(ids, 0)}
              />
              <Item
                icon={<Icon name="arrow-down" />}
                label={m.compact_overview_move_end()}
                disabled={every}
                onClick={() => moveTo(ids, doc.pages.length)}
              />
              <Menu.Separator className={menuStyles.separator} />
              <Item
                icon={<Icon name="file-arrow-up" />}
                label={m.compact_overview_extract()}
                onClick={() => makeFiles(() => extract(ids))}
              />
              <Item
                icon={<Icon name="line-segment" />}
                label={m.compact_overview_split()}
                disabled={ids.length === 1 && first === 0}
                onClick={() => makeFiles(() => split(ids))}
              />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Button
        variant="quiet"
        aria-label={m.compact_overview_select_done()}
        onClick={() => setSelecting(false)}
      >
        {m.compact_done()}
      </Button>
    </div>
  );
}
