/**
 * An open document on the Open shelf (`02-library` L5, DSN-93): the first page as a cover on the
 * shelf line and its serif title under it, nothing else visible. The grid (`LibraryGrid`) owns
 * what a press, a key or a drag does; the card draws its states:
 *
 * - **Rest** (fine pointer, not selecting): the ○ hidden; hover lifts the cover 2 px and shows
 *   the ○. **Pressed**: the large-surface press scale (02.5). **Focus**: the outset ring.
 * - **Select mode**: the ○ always shown; **selected**: the ○ filled and a 2 px ring 2 px out
 *   around the first page, as a Pages grid cell draws it (`ui/CheckBadge`, 06-navigation §2.2;
 *   owner feedback F4): the badge sits inside the page's top-trailing corner, and takes the
 *   page's selection blue; `aria-selected` carries it (the ○ is `aria-hidden`).
 * - **Edited**: the 6 px lime dot before the title. Pages, size, lock state and the page reached
 *   are not drawn; the accessible name says all of them ("report, 12 pages, 2.4 MB, edited,
 *   locked, page 3 of 12").
 * - **Dragging** (reorder): the source at 40 % opacity; the grid draws the insertion caret.
 */
import type { Workspace } from '@pdf-editor/document-model';
import type { CSSProperties, MouseEvent, PointerEvent, Ref } from 'react';

import { m, useLocale } from '../i18n';
import { InlineTitleEditor } from '../stage/InlineTitleEditor';
import type { LockReason } from '../state/lock-store';
import { pagesPhrase } from '../state/workspace-store';
import { CheckBadge } from '../ui/CheckBadge';
import { type IconName } from '../ui/Icon';
import type { HomeCardData } from './home-cards';
import { formatFileSize } from './home-model';
import styles from './LibraryCard.module.css';
import { PageThumb } from './PageThumb';

/** The widest a cover may stand (a landscape page at the shelf's height, never a banner). */
const COVER_MAX_W = 360;

/** The check badges come in 12 ms apart for at most ten steps (MP rule: ≤ 10 × 12 ms). */
const CHECK_STAGGER_STEPS = 10;
const CHECK_STAGGER_MS = 12;

/** Line 3's lock state (L5 §4): glyph and words, never a tint. */
function lockState(lock: LockReason | undefined): { icon: IconName; text: string } | undefined {
  switch (lock) {
    case undefined:
      return undefined;
    case 'signed':
      return { icon: 'seal-check', text: m.library_card_signed() };
    case 'restricted':
      return { icon: 'lock-simple', text: m.library_card_restricted() };
    default:
      return { icon: 'lock-simple', text: m.library_card_locked() };
  }
}

export interface LibraryCardProps {
  readonly card: HomeCardData;
  /** Its place in the grid, for the check badges' stagger (L5 §7). */
  readonly index?: number;
  readonly workspace: Workspace;
  readonly selected: boolean;
  readonly selecting: boolean;
  readonly tabbable: boolean;
  readonly edited: boolean;
  readonly lock: LockReason | undefined;
  readonly dragging: boolean;
  readonly renaming: boolean;
  /** The cover's height, from the window (`cover-size.ts`). */
  readonly coverHeight: number;
  readonly cardRef?: Ref<HTMLDivElement>;
  readonly onClick: (event: MouseEvent) => void;
  readonly onCheck: (event: MouseEvent) => void;
  readonly onFocus: () => void;
  readonly onContextMenu: (event: MouseEvent) => void;
  readonly onPointerDown: (event: PointerEvent) => void;
  readonly onRenamed: (committed: boolean) => void;
}

export function LibraryCard({
  card,
  index = 0,
  workspace,
  selected,
  selecting,
  tabbable,
  edited,
  lock,
  dragging,
  renaming,
  coverHeight,
  cardRef,
  onClick,
  onCheck,
  onFocus,
  onContextMenu,
  onPointerDown,
  onRenamed,
}: LibraryCardProps) {
  const locale = useLocale();
  const size = card.size === undefined ? undefined : formatFileSize(card.size, locale);
  const locked = lockState(lock);
  const label = [
    card.title,
    pagesPhrase(card.pageCount),
    size,
    edited ? m.library_card_name_edited() : undefined,
    locked?.text,
    card.reachedPage === undefined
      ? undefined
      : m.library_card_progress({ page: card.reachedPage, total: card.pageCount }),
  ]
    .filter(Boolean)
    .join(', ');
  const thumb = { width: COVER_MAX_W, height: coverHeight };
  // Behind `?home=continue` (DSN-66): the page the reader left, once past the first.
  const thumbPage = card.leftPage ?? card.firstPage;
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- the listbox owns the keys
    <div
      ref={cardRef}
      role="option"
      aria-selected={selected}
      aria-label={label}
      aria-keyshortcuts="F2 Alt+ArrowLeft Alt+ArrowRight"
      tabIndex={tabbable ? 0 : -1}
      data-document-id={card.id}
      data-selected={selected || undefined}
      data-selecting={selecting || undefined}
      data-dragging={dragging || undefined}
      className={styles.card}
      style={
        {
          '--check-delay': `${Math.min(index, CHECK_STAGGER_STEPS - 1) * CHECK_STAGGER_MS}ms`,
        } as CSSProperties
      }
      onClick={onClick}
      onFocus={onFocus}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
    >
      {/* The ○: the check badge in the page's corner, an S control whose hit area (32, 44 coarse)
          reaches the corner; the option carries the state, and Space is its key (the grid's). */}
      <div className={styles.stage} style={{ height: coverHeight }}>
        {thumbPage ? (
          <PageThumb workspace={workspace} page={thumbPage} box={thumb} className={styles.sheet}>
            <CardCheck selected={selected} onCheck={onCheck} />
          </PageThumb>
        ) : (
          <CardCheck selected={selected} onCheck={onCheck} />
        )}
      </div>
      <div className={styles.meta}>
        {renaming ? (
          <InlineTitleEditor
            documentId={card.id}
            title={card.title}
            className={styles.rename}
            onDone={onRenamed}
          />
        ) : (
          <span className={styles.name} aria-hidden="true">
            {edited ? <span className={styles.edited} data-testid="library-card-edited" /> : null}
            {/* One end ellipsis, by CSS: a middle cut as well read "Combined – sim…t …". */}
            <span className={styles.nameText}>{card.title}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function CardCheck({
  selected,
  onCheck,
}: {
  readonly selected: boolean;
  readonly onCheck: (event: MouseEvent) => void;
}) {
  return (
    <span
      className={styles.check}
      aria-hidden="true"
      data-testid="library-card-check"
      onClick={onCheck}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <CheckBadge checked={selected} className={styles.badge} />
    </span>
  );
}
