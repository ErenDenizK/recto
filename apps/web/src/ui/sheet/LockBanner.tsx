/**
 * The lock banner (components/07-sheets.md §2.4 "Locked document"): `lock` + "report.pdf is
 * locked · Unlock" at the top of a sheet whose document is locked. The sheet still opens and
 * previews; its primary reads "Locked" and offers to unlock. Unlock opens the Unlock popover
 * (04-context §19) once D1 brings it; until then the caller's `onUnlock` does what unlocking
 * means today.
 */
import { Lock } from 'lucide-react';

import { m } from '../../i18n';
import { Button } from '../Button';
import styles from './Sheet.module.css';

export function LockBanner({
  name,
  onUnlock,
}: {
  readonly name: string;
  readonly onUnlock: () => void;
}) {
  return (
    <div className={styles.lockBanner} data-testid="sheet-lock-banner">
      <Lock aria-hidden="true" className={styles.lockGlyph} />
      <span className={styles.lockText}>{m.sheet_locked({ name })}</span>
      <Button variant="quiet" onClick={onUnlock}>
        {m.sheet_unlock()}
      </Button>
    </div>
  );
}
