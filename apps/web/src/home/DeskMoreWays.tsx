/**
 * The "More ways…" menu's popup (DSN-87, `masa.md` §2.2): Batch…, Images to PDF…, PDF to
 * images…, Text to PDF…, Markdown to PDF…. Every row runs a registered command, so the same
 * names are found in ⌘K (§2.9). Opened by the fourth intent tile when Scan is not offered, else
 * by the quiet "More ways…" link on the drop line (`DeskDropLine`).
 */
import { Menu } from '@base-ui/react/menu';

import { commandRegistry } from '../commands/registry';
import { m } from '../i18n';
import menuStyles from '../ui/Menu.module.css';
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

export function MoreWaysPopup({ align = 'start' }: { readonly align?: 'start' | 'end' }) {
  return (
    <Menu.Portal>
      <Menu.Positioner side="bottom" align={align} sideOffset={4} collisionPadding={8}>
        <Menu.Popup className={menuStyles.popup} data-testid="desk-more-menu">
          {WAYS.map((way) => (
            <Menu.Item
              key={way.id}
              className={menuStyles.item}
              data-testid={way.id === 'document.batch' ? 'library-batch' : `desk-way-${way.id}`}
              onClick={() => void commandRegistry.execute(way.id)}
            >
              <span className={menuStyles.label}>{way.title()}</span>
              {way.hint === undefined ? null : <span className={styles.hint}>{way.hint()}</span>}
            </Menu.Item>
          ))}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}
