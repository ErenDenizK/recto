/**
 * The drop overlay over a document (`02-library` L9; replaces the stage's dashed overlay, 3.12,
 * and the drag states of 14.8): files dragged from the desktop dim the page under a scrim and a
 * lit card says what a release does, "Drop to open 2 files" when the drag tells its count, with
 * the privacy line under it. On the Library there is no overlay: the launcher lifts and its
 * headline changes instead (`Launcher`). The Pages grid and Compare draw their own targets.
 *
 * The field behind the scrim (L9 §3: the only time the light enters a document view) is D3-8's;
 * until it lands the scrim and the card are the static form. Pointer-only, so `aria-hidden`; the
 * open's result is announced (A-14).
 */
import { m } from '../i18n';
import { Icon } from '../ui/Icon';
import styles from './DropOverlay.module.css';
import lit from './lit.module.css';
import { useDragFileCount } from './use-drag-file-count';

export function dropTitle(count: number | undefined): string {
  return count === undefined ? m.library_drop() : m.library_drop_count({ count });
}

export function DropOverlay({ count }: { readonly count: number | undefined }) {
  return (
    <div className={styles.overlay} aria-hidden="true" data-testid="drop-overlay">
      <div className={`${lit.lit} ${styles.card}`} data-lit="">
        <Icon name="tray-arrow-down" size={24} className={styles.glyph} />
        <p className={styles.title}>{dropTitle(count)}</p>
        <p className={styles.body}>{m.empty_body_local()}</p>
      </div>
    </div>
  );
}

/**
 * The stage's overlay while files are dragged over a document (Stage mounts it always, so the
 * drag's count is read from its first `dragenter`); nothing renders until `dragging`.
 */
export function DocumentDropOverlay({ dragging }: { readonly dragging: boolean }) {
  const count = useDragFileCount(dragging);
  return dragging ? <DropOverlay count={count} /> : null;
}
