/**
 * The desk's one quiet line (DSN-87, `masa.md` §2.2): "or drop files anywhere", and the
 * "More ways…" menu (Base UI `Menu`) after it: Batch…, Images to PDF…, PDF to images…, Text to
 * PDF…, Markdown to PDF…. Every row runs a registered command, so the same names are found in
 * ⌘K (§2.9). While files are dragged over the window the line says what a release does
 * ("Drop to open 2 files").
 */
import { Menu } from '@base-ui/react/menu';

import { commandRegistry } from '../commands/registry';
import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import { MenuButton } from '../ui/MenuButton';
import menuStyles from '../ui/Menu.module.css';
import { dropTitle } from './DropOverlay';
import styles from './DeskDropLine.module.css';

interface Way {
  readonly id: string;
  readonly title: () => string;
  readonly hint?: () => string;
}

const WAYS: readonly Way[] = [
  { id: 'document.batch', title: m.cmd_batch },
  { id: 'file.imagesToPdf', title: m.cmd_images_to_pdf, hint: m.desk_images_to_pdf_hint },
  { id: 'file.pdfToImages', title: m.cmd_pdf_to_images, hint: m.desk_pdf_to_images_hint },
  { id: 'file.textToPdf', title: m.cmd_text_to_pdf },
  { id: 'file.markdownToPdf', title: m.cmd_markdown_to_pdf },
];

export function DeskDropLine({
  dragging,
  dragCount,
}: {
  readonly dragging: boolean;
  readonly dragCount: number | undefined;
}) {
  return (
    <div className={styles.line} data-dragging={dragging || undefined} data-testid="desk-dropline">
      <p className={styles.drop} aria-live={dragging ? 'off' : undefined}>
        <Icon name="tray-arrow-down" className={styles.icon} />
        <span>{dragging ? dropTitle(dragCount) : m.library_drop_hint()}</span>
      </p>
      <Menu.Root>
        <MenuButton variant="quiet" data-testid="desk-more">
          {m.desk_more()}
        </MenuButton>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={4} collisionPadding={8}>
            <Menu.Popup className={menuStyles.popup} data-testid="desk-more-menu">
              {WAYS.map((way) => (
                <Menu.Item
                  key={way.id}
                  className={menuStyles.item}
                  data-testid={way.id === 'document.batch' ? 'library-batch' : `desk-way-${way.id}`}
                  onClick={() => void commandRegistry.execute(way.id)}
                >
                  <span className={menuStyles.label}>{way.title()}</span>
                  {way.hint === undefined ? null : (
                    <span className={styles.hint}>{way.hint()}</span>
                  )}
                </Menu.Item>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
