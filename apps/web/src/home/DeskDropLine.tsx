/**
 * The desk's one quiet line (DSN-87, `masa.md` §2.2): "or drop files anywhere", and the
 * "More ways…" menu (Base UI `Menu`) after it: Batch…, Images to PDF…, PDF to images…, Text to
 * PDF…, Markdown to PDF…. Every row runs a registered command, so the same names are found in
 * ⌘K (§2.9). While files are dragged over the window the line says what a release does
 * ("Drop to open 2 files").
 */
import { Menu } from '@base-ui/react/menu';

import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import { MenuButton } from '../ui/MenuButton';
import { MoreWaysPopup } from './DeskMoreWays';
import { dropTitle } from './DropOverlay';
import styles from './DeskDropLine.module.css';

export function DeskDropLine({
  dragging,
  dragCount,
  more,
}: {
  readonly dragging: boolean;
  readonly dragCount: number | undefined;
  /** Show the "More ways…" link (the fourth intent is Scan); else that tile opens the menu. */
  readonly more: boolean;
}) {
  return (
    <div className={styles.line} data-dragging={dragging || undefined} data-testid="desk-dropline">
      <p className={styles.drop} aria-live={dragging ? 'off' : undefined}>
        <Icon name="tray-arrow-down" className={styles.icon} />
        <span>{dragging ? dropTitle(dragCount) : m.library_drop_hint()}</span>
      </p>
      {more ? (
        <Menu.Root>
          <MenuButton variant="quiet" data-testid="desk-more">
            {m.desk_more()}
          </MenuButton>
          <MoreWaysPopup />
        </Menu.Root>
      ) : null}
    </div>
  );
}
