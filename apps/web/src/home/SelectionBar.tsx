/**
 * The selection bar (`02-library` L6; RA-21, decision 02.11): what to do with the checked cards,
 * always the same five controls so the bar never reflows: "2 selected" · **Combine 2 files** ·
 * Compare · Pages · Close · ✕. Combine (two or more, the view's one lime in Select mode) and
 * Compare (exactly two) stay in place dimmed with their reason when the count does not fit; the
 * reason is the tooltip and the description, reachable by Tab (`aria-disabled`).
 *
 * - Combine asks nothing (INV-12): the new document in card order, its Pages grid, "Combined 2
 *   files · Undo" (`combineNow`).
 * - Compare: the older file as A (`compareSelected`). Pages: the grid over all open documents,
 *   the unchecked ones collapsed (06.9). Close: one step, "Closed 2 documents · changes kept ·
 *   Undo". ✕: clears and leaves Select mode, focus back on the card that had it.
 * - Keys: Tab and the arrows move inside; `4` with exactly two checked compares (the grid's
 *   own keys handle Delete and Esc).
 *
 * M2 glass (`mat mat-bar s8 c10`), 44 high around 32 px controls (56 / 44 coarse), bottom centre
 * 16 px above the view's edge; it floats over cards that scroll under it. Shown while one or
 * more cards are checked.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { type KeyboardEvent, useEffect } from 'react';

import { formatNumber, m } from '../i18n';
import { announce } from '../shell/announcer';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';
import {
  closeSelected,
  combineNow,
  compareSelected,
  focusCardSoon,
  pagesSelected,
} from './home-actions';
import { setSelecting } from './library-store';
import styles from './SelectionBar.module.css';

export function SelectionBar({ selection }: { readonly selection: readonly DocumentId[] }) {
  const count = selection.length;
  const canCombine = count >= 2;
  const canCompare = count === 2;

  // `4` with exactly two checked compares (L6 §6), as the key does in a document.
  useEffect(() => {
    if (!canCompare) return undefined;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '4' || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void compareSelected(selection);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [canCompare, selection]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button'));
    const index = buttons.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === 'ArrowLeft' ? -1 : 1;
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
  };

  const clear = () => {
    const had = selection[selection.length - 1];
    setSelecting(false);
    announce(m.library_announce_select_off());
    focusCardSoon(had);
  };

  return (
    <div
      role="toolbar"
      aria-label={m.library_bar_label()}
      className={styles.bar}
      data-testid="library-selection-bar"
      onKeyDown={onKeyDown}
    >
      <span className={styles.count} aria-live="polite">
        {m.home_selected_summary({ count: formatNumber(count) })}
      </span>
      <span className={styles.divider} aria-hidden="true" />
      <Button
        variant="prominent"
        icon={<Icon name="stack" />}
        disabled={!canCombine}
        reason={m.library_combine_reason()}
        data-testid="library-combine"
        onClick={() => combineNow(selection)}
      >
        <span className={styles.long}>
          {canCombine ? m.home_combine_count({ count }) : m.library_combine_short()}
        </span>
        <span className={styles.short}>{m.library_combine_short()}</span>
      </Button>
      <Button
        variant="quiet"
        icon={<Icon name="compare" />}
        disabled={!canCompare}
        reason={m.library_compare_reason()}
        data-testid="library-compare"
        onClick={() => void compareSelected(selection)}
      >
        {m.compare_mode()}
      </Button>
      <Button
        variant="quiet"
        icon={<Icon name="squares-four" />}
        data-testid="library-pages"
        onClick={() => pagesSelected(selection)}
      >
        {m.library_pages()}
      </Button>
      <Button
        variant="quiet"
        icon={<Icon name="x-circle" />}
        data-testid="library-close"
        onClick={() => closeSelected(selection)}
      >
        {m.common_close()}
      </Button>
      <span className={styles.divider} aria-hidden="true" />
      <IconButton
        label={m.library_clear_selection()}
        icon={<Icon name="x" />}
        tooltipSide="top"
        onClick={clear}
      />
    </div>
  );
}
