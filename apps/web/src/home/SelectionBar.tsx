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
 * M2 glass (`mat mat-bar s8 c9`), one piece high around M controls (--piece-h 40 / 48, G1),
 * bottom centre --piece-inset above the view's edge; it floats over cards that scroll under it. Shown while one or
 * more cards are checked.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { type KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { formatNumber, m } from '../i18n';
import { springWidth } from '../motion/resize';
import { announce } from '../shell/announcer';
import { useFloatingBottomChrome } from '../shell/frame/frame-insets';
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

/** The longest a leaving bar waits for its fade to end before it unmounts anyway (ms). */
const LEAVE_MAX_MS = 400;

/**
 * The bar while cards are checked, and on its way out once none are (motion-2026-10
 * library-capsule.md §3): it rises from the capsule's place at the bottom centre and sinks back
 * into it, `inert` from its first leaving frame (A-13), showing the last selection it had.
 */
export function SelectionBarPresence({ selection }: { readonly selection: readonly DocumentId[] }) {
  const [last, setLast] = useState(selection);
  if (selection.length > 0 && last !== selection) setLast(selection);
  if (last.length === 0) return null;
  const leaving = selection.length === 0;
  return <SelectionBar selection={last} leaving={leaving} onGone={() => setLast(selection)} />;
}

export function SelectionBar({
  selection,
  leaving = false,
  onGone,
}: {
  readonly selection: readonly DocumentId[];
  readonly leaving?: boolean;
  readonly onGone?: () => void;
}) {
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

  // The toast stack keeps above the bar ("Restored 3 documents" after a reload; FB4 §2).
  const barRef = useRef<HTMLDivElement>(null);
  useFloatingBottomChrome(barRef);
  // A count and a Combine label that change width move it on a spring (Q-6), never a cut.
  useLayoutEffect(() => {
    const bar = barRef.current;
    return bar ? springWidth(bar) : undefined;
  }, []);
  // Leaving: gone once its fade ends (or a transition never runs), then unmounted.
  useEffect(() => {
    if (!leaving) return undefined;
    const bar = barRef.current;
    const done = (event?: TransitionEvent) => {
      if (event && (event.target !== bar || event.propertyName !== 'opacity')) return;
      onGone?.();
    };
    bar?.addEventListener('transitionend', done);
    const timer = window.setTimeout(done, LEAVE_MAX_MS);
    return () => {
      bar?.removeEventListener('transitionend', done);
      window.clearTimeout(timer);
    };
  }, [leaving, onGone]);

  return (
    <div
      ref={barRef}
      role="toolbar"
      aria-label={m.library_bar_label()}
      className={styles.bar}
      data-testid={leaving ? undefined : 'library-selection-bar'}
      data-leaving={leaving || undefined}
      aria-hidden={leaving || undefined}
      inert={leaving}
      onKeyDown={onKeyDown}
    >
      <span className={styles.count} aria-live={leaving ? 'off' : 'polite'}>
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
