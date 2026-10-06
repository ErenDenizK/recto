/**
 * The open-documents head (`02-library` L4): "Open · 3 documents · 16 pages" leading and
 * **Select** trailing; in Select mode **Done** and **Select all** (dimmed with "All documents are
 * selected" once every card is checked). Select toggles the mode (`aria-pressed`) and says so;
 * Done clears the selection and leaves it. Focus stays on the button.
 *
 * The row is the Library's one text on bare canvas, so it is the text-safe band of the field
 * (`data-text-safe`, `text-safe.ts`; D3-8 masks the light there).
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { formatNumber, m } from '../i18n';
import { announce } from '../shell/announcer';
import { useUiStore } from '../state/ui-store';
import { pagesPhrase } from '../state/workspace-store';
import { Button } from '../ui/Button';
import { liveSelection } from './home-model';
import { selectOnHome } from './home-actions';
import styles from './LibraryHead.module.css';
import { setSelecting, useSelecting } from './library-store';
import { TEXT_SAFE_ATTR } from './text-safe';

export function LibraryHead({
  order,
  pages,
}: {
  /** The open documents in card order. */
  readonly order: readonly DocumentId[];
  readonly pages: number;
}) {
  const selecting = useSelecting();
  const checked = useUiStore((s) => liveSelection(order, s.homeSelection).length);
  const all = checked === order.length && order.length > 0;
  const textSafe = { [TEXT_SAFE_ATTR]: '' };

  const toggle = () => {
    const next = !selecting;
    setSelecting(next);
    announce(next ? m.library_announce_select_on() : m.library_announce_select_off());
  };

  return (
    <div className={styles.head} {...textSafe} data-testid="library-head">
      <p className={styles.summary}>
        {selecting && checked > 0 ? (
          <span className={styles.count}>
            {m.home_selected_summary({ count: formatNumber(checked) })}
          </span>
        ) : (
          <>
            {m.library_head_open()} · {m.library_head_documents({ count: order.length })} ·{' '}
            {pagesPhrase(pages)}
          </>
        )}
      </p>
      <div className={styles.actions}>
        {selecting ? (
          <Button
            variant="quiet"
            disabled={all}
            reason={m.library_all_selected()}
            onClick={() => selectOnHome(order)}
          >
            {m.library_select_all()}
          </Button>
        ) : null}
        <Button
          variant="quiet"
          aria-pressed={selecting}
          data-testid="library-select"
          onClick={toggle}
        >
          {selecting ? m.library_done() : m.library_select()}
        </Button>
      </div>
    </div>
  );
}
