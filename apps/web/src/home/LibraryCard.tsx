/**
 * A Library card (`02-library` L5): one open document, lit glass around an opaque first page.
 * The grid (`LibraryGrid`) owns what a press, a key or a drag does; the card draws its states:
 *
 * - **Rest** (fine pointer, not selecting): the ○ hidden; hover lifts the card 2 px with the e3
 *   shadow (no wash on lit glass) and shows the ○. **Pressed**: the large-surface press scale
 *   (02.5). **Focus**: the outset two-band ring, which follows the radius.
 * - **Select mode**: the ○ always shown; **selected**: the ○ filled and a 2 px ring 2 px out
 *   around the first page, as a Pages grid cell draws it (`ui/CheckBadge`, 06-navigation §2.2;
 *   owner feedback F4): the badge sits inside the page's top-trailing corner, so it never covers
 *   the card's text or hangs over the page's edge, and takes the page's selection blue, which
 *   leaves the selection bar's Combine the view's one lime; `aria-selected` carries it (the ○ is
 *   `aria-hidden`).
 * - **Edited** ● after the name and "Edited" in line 3; **locked**: line 3 leads with the lock
 *   glyph and "Locked", "Signed · locked" or "Restricted by the file" (no tint, A-19).
 * - **Dragging** (reorder): the source at 40 % opacity; the grid draws the insertion caret.
 *
 * Line 2 is "12 pages · 2.4 MB" (`formatFileSize`, locale decimals, tabular numerals). The
 * accessible name says all three lines ("report, 12 pages, 2.4 MB, edited, locked").
 */
import type { VirtualPage, Workspace } from '@pdf-editor/document-model';
import type { MouseEvent, PointerEvent, ReactNode, Ref } from 'react';

import { RENDER_PRIORITY } from '../engine/engine-service';
import { m, useLocale } from '../i18n';
import { PageCanvas } from '../pages/PageCanvas';
import { displaySize, fitInBox } from '../pages/page-geometry';
import { InlineTitleEditor } from '../stage/InlineTitleEditor';
import { contentFrame, ResizedContent } from '../stage/ResizedContent';
import type { LockReason } from '../state/lock-store';
import { pagesPhrase } from '../state/workspace-store';
import { CheckBadge } from '../ui/CheckBadge';
import { Icon, type IconName } from '../ui/Icon';
import { formatFileSize, type HomeCardData } from './home-model';
import styles from './LibraryCard.module.css';
import lit from './lit.module.css';

/** The thumbnail box (L5 §2): 160 × 200 fine, 176 × 220 coarse. */
export const THUMB_FINE = { width: 160, height: 200 } as const;
export const THUMB_COARSE = { width: 176, height: 220 } as const;

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
  readonly workspace: Workspace;
  readonly selected: boolean;
  readonly selecting: boolean;
  readonly tabbable: boolean;
  readonly edited: boolean;
  readonly lock: LockReason | undefined;
  readonly dragging: boolean;
  readonly renaming: boolean;
  readonly coarse: boolean;
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
  workspace,
  selected,
  selecting,
  tabbable,
  edited,
  lock,
  dragging,
  renaming,
  coarse,
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
  const details = [pagesPhrase(card.pageCount), size].filter(Boolean).join(' · ');
  const locked = lockState(lock);
  const state = [edited ? m.library_card_edited() : undefined, locked?.text].filter(Boolean);
  const label = [
    card.title,
    pagesPhrase(card.pageCount),
    size,
    edited ? m.library_card_name_edited() : undefined,
    locked?.text,
  ]
    .filter(Boolean)
    .join(', ');
  const thumb = coarse ? THUMB_COARSE : THUMB_FINE;
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
      data-lit=""
      className={`${lit.lit} ${styles.card}`}
      onClick={onClick}
      onFocus={onFocus}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
    >
      {/* The ○: the check badge in the page's corner, an S control whose hit area (32, 44 coarse)
          reaches the corner; the option carries the state, and Space is its key (the grid's). */}
      <div className={styles.thumbBox} style={{ height: thumb.height }}>
        {card.firstPage ? (
          <LibraryThumb workspace={workspace} page={card.firstPage} box={thumb}>
            <CardCheck selected={selected} onCheck={onCheck} />
          </LibraryThumb>
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
            <span className={styles.tag} data-tag={card.colorIndex} />
            {/* One end ellipsis, by CSS: a middle cut as well read "Combined – sim…t …". */}
            <span className={styles.nameText}>{card.title}</span>
            {edited ? <span className={styles.edited} data-testid="library-card-edited" /> : null}
          </span>
        )}
        <span className={styles.details} aria-hidden="true">
          {details}
        </span>
        <span className={styles.state} aria-hidden="true">
          {locked ? <Icon name={locked.icon} className={styles.stateIcon} /> : null}
          <span className={styles.stateText}>{state.join(' · ')}</span>
        </span>
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

/** The first page through the shared thumbnail renderer, fitted into the card's box. */
function LibraryThumb({
  workspace,
  page,
  box,
  children,
}: {
  readonly workspace: Workspace;
  readonly page: VirtualPage;
  readonly box: { readonly width: number; readonly height: number };
  readonly children?: ReactNode;
}) {
  const size = displaySize(workspace, page);
  const fitted = fitInBox(size, box.width, box.height);
  const frame = contentFrame(workspace, page);
  return (
    <div className={styles.sheet} style={{ width: fitted.width, height: fitted.height }}>
      <ResizedContent frame={frame}>
        <PageCanvas
          sourceId={page.ref.kind === 'source' ? page.ref.source : undefined}
          blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
          index={page.ref.kind === 'source' ? page.ref.index : 0}
          rotation={page.rotation}
          widthPt={frame?.widthPt ?? size.width}
          heightPt={frame?.heightPt ?? size.height}
          cssWidth={fitted.width * (frame?.width ?? 1)}
          priority={RENDER_PRIORITY.visible}
        />
      </ResizedContent>
      {children}
    </div>
  );
}
