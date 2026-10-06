/**
 * The document drop overlay (`components/01-frame.md` F13 §2–§8; inventory 3.12): while files
 * are dragged over a document's page, a dim scrim over the free rectangle and a centred
 * 320 × 160 card, "Drop to open in new tabs". `aria-hidden` (the drop is a pointer act; the
 * open picker is the keyboard's). The light field behind the card (the one time light enters a
 * document view) is D3-8's; until then the card is the solid raised surface. Moved out of
 * `Stage.tsx`; the grid and Compare outline their own drop targets.
 */
import { FilePlus2 } from 'lucide-react';

import { m } from '../../i18n';
import styles from './DockBand.module.css';

export function DropOverlay() {
  return (
    <div className={styles.drop} aria-hidden="true" data-testid="drop-overlay">
      <div className={styles.dropCard}>
        <FilePlus2 className={styles.dropIcon} />
        <span>{m.stage_drop_overlay()}</span>
      </div>
    </div>
  );
}
