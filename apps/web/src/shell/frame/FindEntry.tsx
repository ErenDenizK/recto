/**
 * Find (`components/01-frame.md` F6): one press to search the document (J15a), in the strip
 * where people look for it, in place of the command field that looked like Find (INV-11).
 * Results, options and the full list stay in the sidebar's Find section (family 05), which
 * shares the query and hits (`viewer/search.ts`).
 *
 * - **Forms.** From 1280 px (fine pointer): a 280 px field (32 high, Q-9) in the strip, an opaque well with
 *   the magnifier leading and the count trailing. Below that, and on coarse pointers below
 *   1280 px, a ⌕ button; pressing it (or Mod+F) lays the same field over the strip's tab area,
 *   anchored to the ⌕'s trailing edge, 280 px wide (240 at medium): a well inside the strip's
 *   glass, never a second glass surface. The compact bar uses the button form.
 * - **Keys.** Mod+F focuses and selects the field. Enter / Shift+Enter (and F3 / Shift+F3)
 *   step through hits, each landing in the free rectangle; the first Enter shows the current
 *   hit. Down arrow opens the sidebar on Find with the list. Esc clears the query; a second Esc
 *   closes the laid-over field and returns focus to ⌕, or to the page when Mod+F opened it.
 * - **Count** "3 of 41" (tabular) in a polite live region, "No matches" once a search found
 *   nothing; ‹ › once there is a query. The search restarts 150 ms after typing stops, unless
 *   the sidebar's Find section is showing (it runs the same search).
 * - Guard: none (reading).
 */
import { type KeyboardEvent, useEffect, useId, useRef } from 'react';

import { currentPlatform, toAriaKeyShortcut } from '../../commands/shortcuts';
import { formatNumber, m } from '../../i18n';
import { useUiStore } from '../../state/ui-store';
import { useViewStore } from '../../state/view-store';
import { useActiveDocument } from '../../state/workspace-store';
import { IconButton } from '../../ui/IconButton';
import {
  clearSearch,
  openSearchPanel,
  revealHit,
  runSearch,
  searchStep,
  selectHit,
  setFindEntryOpener,
  setSearchQuery,
  useSearchStore,
} from '../../viewer/search';
import { useCommandShortcut } from '../use-command-shortcut';
import { closeFindOverlay, focusFindEntry, useFrameStore } from './frame-store';
import styles from './TopStrip.module.css';
import { Icon } from '../../ui/Icon';

/** Pause after typing before the search restarts (as the sidebar's field). */
const TYPING_DELAY_MS = 150;

/** The page the reader shows, so focus can go back to it. */
const focusPage = () => document.querySelector<HTMLElement>('[data-read-viewport]')?.focus();

export function FindEntry({ form = 'auto' }: { readonly form?: 'auto' | 'button' }) {
  const doc = useActiveDocument();
  const query = useSearchStore((s) => s.query);
  const hits = useSearchStore((s) => s.hits.length);
  const current = useSearchStore((s) => s.current);
  const status = useSearchStore((s) => s.status);
  const searchedDoc = useSearchStore((s) => s.documentId);
  const open = useFrameStore((s) => s.findOpen);
  const focusSerial = useFrameStore((s) => s.findFocus);
  // The sidebar's Find section runs the search while it shows (laid over the page on medium,
  // it shows only once asked for).
  const findShown = useUiStore((s) => s.leftPanelOpen && s.leftPanelView === 'find');
  const sidebarUp = useFrameStore((s) => !s.sidebarOverlay || s.overlaySidebarShown);
  const panelRuns = findShown && sidebarUp;
  const shortcut = useCommandShortcut('search.open');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /** Opened by Mod+F (focus returns to the page) or by ⌕ (focus returns to ⌕). */
  const byKey = useRef(false);
  const countId = useId();

  // Mod+F reaches this field while it is mounted.
  useEffect(() => {
    setFindEntryOpener(() => {
      byKey.current = true;
      focusFindEntry();
    });
    return () => setFindEntryOpener(undefined);
  }, []);

  // Each Mod+F (or ⌕) focuses and selects the field, once it shows.
  useEffect(() => {
    if (focusSerial === 0) return;
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusSerial]);

  // Restart after typing, unless the sidebar's Find section runs the same search.
  useEffect(() => {
    if (panelRuns || !doc) return;
    const timer = window.setTimeout(() => {
      void runSearch(doc, useViewStore.getState().currentPage);
    }, TYPING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [doc, query, panelRuns]);

  const hasQuery = query.trim() !== '';
  const ours = searchedDoc === (doc?.id ?? null);
  let count = '';
  if (hasQuery && ours) {
    if (hits > 0) {
      count = m.search_count({
        current: formatNumber(Math.max(0, current) + 1),
        total: formatNumber(hits),
      });
    } else if (status === 'done') count = m.frame_find_no_matches();
    else if (status === 'searching') count = '…';
  }

  /** Enter pressed before the first hit arrived: show it as soon as it does. */
  const pending = useRef(false);
  useEffect(() => {
    if (!pending.current || current < 0) return;
    pending.current = false;
    revealHit(selectHit(current));
  }, [current]);

  const step = (direction: 1 | -1) => {
    const state = useSearchStore.getState();
    // The first Enter shows the hit the search picked (from the reader's page); typed fast,
    // before the search has found it, the hit shows when it arrives.
    if (!state.currentChosen && state.current >= 0) revealHit(selectHit(state.current));
    else if (state.hits.length === 0 && state.query.trim() !== '') pending.current = true;
    else searchStep(direction);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      step(event.shiftKey ? -1 : 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      openSearchPanel();
    } else if (event.key === 'Escape') {
      pending.current = false;
      event.preventDefault();
      event.stopPropagation();
      if (useSearchStore.getState().query !== '') {
        clearSearch();
        return;
      }
      closeFindOverlay();
      inputRef.current?.blur();
      if (byKey.current) focusPage();
      else buttonRef.current?.focus();
      byKey.current = false;
    }
  };

  const disabled = !doc || doc.pages.length === 0;

  return (
    <div className={styles.find} data-form={form} data-open={open || undefined} data-find-entry="">
      <IconButton
        ref={buttonRef}
        className={styles.findButton}
        label={m.frame_find()}
        icon={<Icon name="magnifying-glass" />}
        shortcut={shortcut}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          byKey.current = false;
          focusFindEntry();
        }}
      />
      <div role="search" className={styles.findWell}>
        <Icon name="magnifying-glass" className={styles.findIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className={styles.findInput}
          placeholder={disabled && doc ? m.frame_find_no_pages() : m.search_placeholder()}
          aria-label={m.search_label()}
          aria-describedby={countId}
          aria-keyshortcuts={shortcut ? toAriaKeyShortcut(shortcut, currentPlatform) : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={query}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={(event) => {
            // The laid-over field folds back once focus leaves it with nothing typed.
            if (
              useSearchStore.getState().query === '' &&
              !event.currentTarget.parentElement?.parentElement?.contains(event.relatedTarget)
            ) {
              closeFindOverlay();
            }
          }}
        />
        <span id={countId} className={styles.findCount} aria-live="polite" data-testid="find-count">
          {count}
        </span>
        {hasQuery ? (
          <>
            <IconButton
              size="bar"
              className={styles.findStep}
              label={m.search_previous()}
              icon={<Icon name="caret-up" />}
              disabled={hits === 0}
              onClick={() => step(-1)}
            />
            <IconButton
              size="bar"
              className={styles.findStep}
              label={m.search_next()}
              icon={<Icon name="caret-down" />}
              disabled={hits === 0}
              onClick={() => step(1)}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
