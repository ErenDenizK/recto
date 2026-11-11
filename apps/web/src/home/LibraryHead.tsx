/**
 * The Open shelf's controls (`02-library` L4, DSN-93): **Select** on the right of the shelf's
 * header, a 13 px tertiary text button; in Select mode **Done** and **Select all** (dimmed with
 * "All documents are selected" once every document is checked), and the count while some are.
 * Select toggles the mode (`aria-pressed`) and says so; Done clears the selection and leaves it.
 * Focus stays on the button. The label "Open" is the shelf's own (`Shelf`).
 *
 * The row is bare canvas text, so the shelf's header is the text-safe band of the field
 * (`data-text-safe`, `text-safe.ts`; D3-8 masks the light there).
 */
import type { DocumentId } from '@pdf-editor/document-model';

import { formatNumber, m } from '../i18n';
import { announce } from '../shell/announcer';
import { useUiStore } from '../state/ui-store';
import { selectOnHome } from './home-actions';
import { liveSelection } from './home-model';
import styles from './LibraryHead.module.css';
import { setSelecting, useSelecting } from './library-store';
import { ShelfText } from './Shelf';

export function LibraryHead({ order }: { readonly order: readonly DocumentId[] }) {
  const selecting = useSelecting();
  const checked = useUiStore((s) => liveSelection(order, s.homeSelection).length);
  const all = checked === order.length && order.length > 0;

  const toggle = () => {
    const next = !selecting;
    setSelecting(next);
    announce(next ? m.library_announce_select_on() : m.library_announce_select_off());
  };

  return (
    <div className={styles.head} data-testid="library-head">
      {selecting && checked > 0 ? (
        <span className={styles.count}>
          {m.home_selected_summary({ count: formatNumber(checked) })}
        </span>
      ) : null}
      {selecting ? (
        <ShelfText
          aria-disabled={all || undefined}
          title={all ? m.library_all_selected() : undefined}
          onClick={() => {
            if (!all) selectOnHome(order);
          }}
        >
          {m.library_select_all()}
        </ShelfText>
      ) : null}
      <ShelfText aria-pressed={selecting} data-testid="library-select" onClick={toggle}>
        {selecting ? m.library_done() : m.library_select()}
      </ShelfText>
    </div>
  );
}
