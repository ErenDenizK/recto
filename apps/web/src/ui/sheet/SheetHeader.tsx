/**
 * The sheet's header (components/07-sheets.md §2.2): ‹ Back when a page was pushed, the title
 * (title3; a centred dialog's is title2, §27.18), its description under it, and ✕. On a
 * compact tool sheet ✕ leads and the primary trails, so the primary shows at the 40 % detent
 * (§2.2). A bottom sheet's header is also its handle for the swipe (`data-sheet-handle`).
 * The row is a bar for the control audit (`data-bar`, quality-bar Q-9): ✕, ‹ Back and the
 * primary are one height and share one centre line.
 */
import { Dialog } from '@base-ui/react/dialog';
import { ChevronLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { m } from '../../i18n';
import { IconButton } from '../IconButton';
import styles from './Sheet.module.css';

export function SheetHeader({
  title,
  description,
  back,
  closeLabel,
  onClose,
  trailing,
  handle,
}: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly back?: (() => void) | undefined;
  /** ✕'s name; null leaves ✕ out (a confirmation answers with its buttons). */
  readonly closeLabel: string | null;
  readonly onClose: () => void;
  /** The primary, on a compact tool sheet. */
  readonly trailing?: ReactNode;
  /** The header takes the swipe (bottom sheets). */
  readonly handle: boolean;
}) {
  const close =
    closeLabel === null ? null : (
      <IconButton
        label={closeLabel}
        icon={<X aria-hidden="true" />}
        className={styles.headerButton}
        onClick={onClose}
      />
    );
  return (
    <div
      className={styles.header}
      data-bar="sheet-header"
      data-trailing={trailing ? '' : undefined}
      {...(handle ? { 'data-sheet-handle': '' } : {})}
    >
      {trailing ? close : null}
      {back ? (
        <IconButton
          label={m.sheet_back()}
          icon={<ChevronLeft aria-hidden="true" />}
          className={styles.headerButton}
          onClick={back}
        />
      ) : null}
      <div className={styles.heading}>
        <Dialog.Title className={styles.title}>{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className={styles.subtitle}>{description}</Dialog.Description>
        ) : null}
      </div>
      {trailing ?? close}
    </div>
  );
}
