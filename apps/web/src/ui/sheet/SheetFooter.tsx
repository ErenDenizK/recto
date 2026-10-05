/**
 * The sheet's footer (components/07-sheets.md §2.2): Reset or a secondary action leading,
 * Cancel then the primary trailing, 60 px on a fine pointer and 72 on a coarse one, plus the
 * safe area at the bottom of a compact sheet. On a compact confirmation the two buttons share
 * the row (`fill`). The row is a bar for the control audit (`data-bar`, quality-bar Q-9):
 * every button is `--control-h` and shares one centre line.
 */
import type { ReactNode } from 'react';

import styles from './Sheet.module.css';

export function SheetFooter({
  secondary,
  cancel,
  primary,
  fill = false,
}: {
  readonly secondary?: ReactNode;
  readonly cancel?: ReactNode;
  readonly primary: ReactNode;
  readonly fill?: boolean;
}) {
  return (
    <div className={styles.footer} data-bar="sheet-footer" data-fill={fill ? '' : undefined}>
      {secondary ? <div className={styles.secondary}>{secondary}</div> : null}
      <div className={styles.actions}>
        {cancel}
        {primary}
      </div>
    </div>
  );
}
