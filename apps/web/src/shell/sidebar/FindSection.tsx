/**
 * N4 Find section (`components/06-navigation.md` N4; 01-frame F6; spec 06.20): the options
 * and every result of the query typed in the strip's Find entry. One query, one input from
 * 1280 px: there the strip holds the field (fine pointers), so the section shows none of its
 * own; below it (and on coarse pointers) the section shows its field. Both edit the same
 * `viewer/search.ts` store, so the strip's ↓ (`openSearchPanel`) lands here.
 *
 * - **Options and stepping:** Match case and Whole word as text chips (`aria-pressed`), the
 *   count "3 of 41" in a polite live region, ‹ › (Enter / Shift+Enter and F3 / Shift+F3 in the
 *   field). Typing searches after 150 ms; each hit lands in the free rectangle.
 * - **Results:** a `listbox` grouped by page (a `group` per page, named by its heading),
 *   virtualized; the hit word is set in 600, never a wash (washes are for the page). A click
 *   or Up / Down jumps and makes the hit current; focus stays in the list.
 * - **Textless pages:** "No text on these pages · Recognize text…" opens the OCR sheet on
 *   them (J11 3 by this prompt). On a document with no text at all, focusing Find opens the
 *   section on this prompt (`useTextlessFindDoor`), since nothing can match there.
 * - **Results ⋯:** "Mark all 41 for redaction" (`targeted`, one undo step, a toast with
 *   Undo); dimmed while locked.
 * - Esc in the field clears the query; a second Esc returns focus to the page.
 */
import { Menu } from '@base-ui/react/menu';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { VirtualDocument } from '@pdf-editor/document-model';
import { type KeyboardEvent, type RefObject, useEffect, useId, useRef, useState } from 'react';

import { formatNumber, m } from '../../i18n';
import { openOcrDialog } from '../../ocr/ocr-store';
import { markSearchHits } from '../../redaction/review';
import { useViewStore } from '../../state/view-store';
import { useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { Button } from '../../ui/Button';
import { Chip } from '../../ui/Chip';
import { EmptyNote } from '../../ui/EmptyNote';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import menuStyles from '../../ui/Menu.module.css';
import { toast } from '../../ui/Toast/toast';
import { useCanChangeActive } from '../../viewer/input-state';
import { documentLabels, hasCustomLabels } from '../../viewer/navigation';
import {
  clearSearch,
  type DocumentHit,
  groupHitsByPage,
  revealHit,
  runSearch,
  searchStep,
  selectHit,
  setSearchOptions,
  setSearchQuery,
  splitContext,
  useSearchStore,
} from '../../viewer/search';
import { useCommandShortcut } from '../use-command-shortcut';
import styles from './FindSection.module.css';
import { useTextless } from './textless';

/** Pause after typing before the search restarts. */
const TYPING_DELAY_MS = 150;
const HEADER_HEIGHT = 32;
const HIT_HEIGHT = 52;

export function FindSection() {
  const doc = useActiveDocument();
  if (!doc) {
    return (
      <div className={styles.empty}>
        <EmptyNote title={m.no_document_title()} body={m.search_empty_no_document_body()} />
      </div>
    );
  }
  return <FindView doc={doc} />;
}

function FindView({ doc }: { readonly doc: VirtualDocument }) {
  const query = useSearchStore((s) => s.query);
  const matchCase = useSearchStore((s) => s.matchCase);
  const wholeWord = useSearchStore((s) => s.wholeWord);
  const status = useSearchStore((s) => s.status);
  const hits = useSearchStore((s) => s.hits);
  const current = useSearchStore((s) => s.current);
  const focusSerial = useSearchStore((s) => s.focusSerial);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const nextShortcut = useCommandShortcut('search.next');
  const previousShortcut = useCommandShortcut('search.previous');
  const statusId = useId();
  const textless = useTextless(doc);

  // The strip's ↓ and Mod+F without a strip field: the field here when it shows, else the list.
  useEffect(() => {
    if (focusSerial === 0) return;
    const input = inputRef.current;
    if (input && input.getClientRects().length > 0) {
      input.focus();
      input.select();
      return;
    }
    const row = listRef.current?.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
    row?.focus();
  }, [focusSerial]);

  // Restart after typing (debounced), on option changes and when the document changes.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch(doc, useViewStore.getState().currentPage);
    }, TYPING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [doc, query, matchCase, wholeWord]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchStep(event.shiftKey ? -1 : 1);
    } else if (event.key === 'ArrowDown' && hits.length > 0) {
      event.preventDefault();
      listRef.current?.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (useSearchStore.getState().query !== '') {
        clearSearch();
        return;
      }
      document.querySelector<HTMLElement>('[data-read-viewport]')?.focus();
    }
  };

  const hasQuery = query.trim() !== '';
  const ours = useSearchStore((s) => s.documentId === doc.id);
  // The count in the field, as the strip's (01-frame F6 §5).
  let count = '';
  if (hasQuery && ours) {
    if (hits.length > 0) {
      count = m.search_count({
        current: formatNumber(Math.max(0, current) + 1),
        total: formatNumber(hits.length),
      });
    } else if (status === 'searching') count = '…';
    else if (status === 'error') count = m.search_failed();
    else if (status === 'done') count = m.frame_find_no_matches();
  }
  const noMatches = hasQuery && ours && status === 'done' && hits.length === 0;
  const textlessCount = textless?.pages.length ?? 0;
  const allTextless =
    textless !== undefined && textlessCount > 0 && textlessCount >= textless.targets;

  return (
    <div className={styles.root} data-testid="find-section">
      <div className={styles.controls}>
        {/* Below 1280 px (and on coarse pointers) the section's own field, laid out as the
            strip's: the count and ‹ › inside the well (01-frame F6 §2). */}
        <div role="search" className={styles.well}>
          <Icon name="magnifying-glass" className={styles.wellIcon} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className={styles.input}
            placeholder={m.search_placeholder()}
            aria-label={m.search_label()}
            aria-describedby={statusId}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <span
            id={statusId}
            className={styles.count}
            aria-live="polite"
            data-testid="search-status"
            data-state={status}
          >
            {count}
          </span>
          {hasQuery ? (
            <>
              <IconButton
                size="row"
                label={m.search_previous()}
                icon={<Icon name="caret-up" />}
                shortcut={previousShortcut}
                disabled={hits.length === 0}
                onClick={() => searchStep(-1)}
              />
              <IconButton
                size="row"
                label={m.search_next()}
                icon={<Icon name="caret-down" />}
                shortcut={nextShortcut}
                disabled={hits.length === 0}
                onClick={() => searchStep(1)}
              />
            </>
          ) : null}
          {hits.length > 0 ? (
            <span className={styles.wellMenu}>
              <ResultsMenu count={hits.length} busy={status === 'searching'} />
            </span>
          ) : null}
        </div>
        <div className={styles.row}>
          <Chip
            label={m.find_match_case_chip()}
            name={m.search_match_case()}
            pressed={matchCase}
            className={styles.option}
            onClick={() => setSearchOptions({ matchCase: !matchCase })}
          />
          <Chip
            label={m.search_whole_word()}
            pressed={wholeWord}
            className={styles.option}
            onClick={() => setSearchOptions({ wholeWord: !wholeWord })}
          />
          <span className={styles.spacer} />
          {/* From 1280 px the strip holds the field, so the results ⋯ sits on this row. */}
          {hits.length > 0 ? (
            <span className={styles.rowMenu}>
              <ResultsMenu count={hits.length} busy={status === 'searching'} />
            </span>
          ) : null}
        </div>
      </div>
      {textlessCount > 0 ? (
        <div className={styles.textless} data-testid="find-textless">
          <Icon name="scan" className={styles.textlessIcon} />
          <p className={styles.textlessText}>
            {allTextless ? m.find_no_text() : m.find_no_text_pages({ count: textlessCount })}
          </p>
          <Button
            size="sm"
            variant="quiet"
            className={styles.recognize}
            onClick={() => openOcrDialog(doc.id)}
          >
            {m.find_recognize()}
          </Button>
        </div>
      ) : null}
      {noMatches ? <p className={styles.hint}>{m.find_no_matches({ title: doc.title })}</p> : null}
      {hits.length > 0 && ours ? (
        <ResultList doc={doc} hits={hits} current={current} listRef={listRef} />
      ) : hasQuery || textlessCount > 0 ? null : (
        <p className={styles.hint} data-testid="search-hint">
          {m.search_hint()}
        </p>
      )}
    </div>
  );
}

/** Results ⋯: Mark all for redaction (06 N4 §5; INV-11 ends the separate button). */
function ResultsMenu({ count, busy }: { readonly count: number; readonly busy: boolean }) {
  const editable = useCanChangeActive('targeted');
  const [marking, setMarking] = useState(false);
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <IconButton
            size="row"
            label={m.find_results_more()}
            icon={<Icon name="dots-three" />}
            data-testid="find-results-more"
          />
        }
      />
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} collisionPadding={8}>
          <Menu.Popup className={menuStyles.popup}>
            <Menu.Item
              className={menuStyles.item}
              disabled={!editable || busy || marking || count === 0}
              data-testid="search-mark-all"
              onClick={() => {
                setMarking(true);
                const documentId = useSearchStore.getState().documentId ?? undefined;
                void markSearchHits()
                  .then((marked) => {
                    if (marked > 0) {
                      toast.undo(m.find_marked({ count: marked }), {
                        ...(documentId === undefined ? {} : { documentId }),
                      });
                    }
                  })
                  .finally(() => setMarking(false));
              }}
            >
              <Icon name="redact" />
              <span className={menuStyles.label}>
                {m.redaction_mark_matches({ count, countText: formatNumber(count) })}
              </span>
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

type Row =
  | {
      readonly kind: 'page';
      readonly key: string;
      readonly pageIndex: number;
      readonly count: number;
    }
  | {
      readonly kind: 'hit';
      readonly key: string;
      readonly index: number;
      readonly hit: DocumentHit;
    };

function ResultList({
  doc,
  hits,
  current,
  listRef,
}: {
  readonly doc: VirtualDocument;
  readonly hits: readonly DocumentHit[];
  readonly current: number;
  readonly listRef: RefObject<HTMLDivElement | null>;
}) {
  'use no memo'; // TanStack Virtual mutates its instance; the React Compiler must not cache it.
  const ws = useWorkspaceStore((s) => s.workspace);
  const query = useSearchStore((s) => s.query);
  const matchCase = useSearchStore((s) => s.matchCase);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const labels = documentLabels(ws, doc);
  const showLabels = hasCustomLabels(labels);

  const rows: Row[] = [];
  for (const group of groupHitsByPage(hits)) {
    rows.push({
      kind: 'page',
      key: `p${group.pageIndex}`,
      pageIndex: group.pageIndex,
      count: group.hits.length,
    });
    for (const { index, hit } of group.hits)
      rows.push({ kind: 'hit', key: `h${hit.seq}`, index, hit });
  }
  const currentRow = rows.findIndex((row) => row.kind === 'hit' && row.index === current);
  const tabbable = current >= 0 ? current : 0;

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: (i) => (rows[i]?.kind === 'page' ? HEADER_HEIGHT : HIT_HEIGHT),
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 10,
  });

  // Keep the current hit in view as it moves.
  useEffect(() => {
    if (currentRow >= 0) virtualizer.scrollToIndex(currentRow, { align: 'auto' });
  }, [currentRow, virtualizer]);

  // Focus follows the current hit while it is in the list.
  useEffect(() => {
    const list = listRef.current;
    if (!list?.contains(document.activeElement)) return;
    list
      .querySelector<HTMLElement>(`[data-hit-index="${current}"]`)
      ?.focus({ preventScroll: true });
  });

  const choose = (index: number) => revealHit(selectHit(index));
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = Math.min(hits.length - 1, Math.max(0, current) + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, current - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = hits.length - 1;
    else if (event.key === 'Enter' && current >= 0) next = current;
    if (next === null) return;
    event.preventDefault();
    choose(next);
  };

  return (
    <div ref={setScrollElement} className={styles.scroll}>
      <div
        ref={listRef}
        role="listbox"
        aria-label={m.search_results_label()}
        tabIndex={-1}
        className={styles.list}
        style={{ height: virtualizer.getTotalSize() }}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          const row = (event.target as Element).closest<HTMLElement>('[data-hit-index]');
          if (row) choose(Number(row.dataset.hitIndex));
        }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          const style = { transform: `translateY(${item.start}px)` };
          if (row.kind === 'page') {
            const label = labels[row.pageIndex] ?? String(row.pageIndex + 1);
            const heading = showLabels
              ? m.search_page_label({ label, number: row.pageIndex + 1 })
              : m.search_page({ number: row.pageIndex + 1 });
            return (
              <div
                key={row.key}
                role="presentation"
                className={styles.pageHeader}
                style={style}
                data-page-heading=""
              >
                <span>{heading}</span>
                <span className={styles.pageCount}>{formatNumber(row.count)}</span>
              </div>
            );
          }
          const parts = splitContext(row.hit, query, matchCase);
          const isCurrent = row.index === current;
          return (
            <div
              key={row.key}
              role="option"
              aria-selected={isCurrent}
              tabIndex={row.index === tabbable ? 0 : -1}
              className={styles.hit}
              style={style}
              data-hit-index={row.index}
              data-sidebar-current={row.index === tabbable ? '' : undefined}
              data-testid="search-hit"
              aria-label={`${m.search_page({ number: row.hit.pageIndex + 1 })}: ${parts.before}${parts.match}${parts.after}`}
            >
              <span className={styles.context}>
                {parts.before}
                {parts.match ? <strong className={styles.match}>{parts.match}</strong> : null}
                {parts.after}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
