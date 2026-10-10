/**
 * The sidebar's Pages section (`components/06-navigation.md` N1 §2, N2, N3; owner decision
 * 2026-10-10, DSN-22): one layer under the section tabs. The thumbnails fill the section and
 * Contents (spec X27, the outline) is a collapsible group above them, as a sidebar section of
 * iPadOS and macOS is: its header row is a disclosure ("Contents", `aria-expanded`) with the
 * one bookmark action, Add bookmark, as a small icon button at its trailing end. No second row
 * of view tabs and no full-width button (the owner's "too many buttons, too nested").
 *
 * - **Open or closed** is the remembered Pages view (`pagesView`, `ui:v3`): `bookmarks` means
 *   Contents is expanded, so every route that opens the sidebar on Contents (the pill's "All
 *   contents…", ⌘K's Show contents) expands it, and a stored value keeps its meaning.
 * - **Expanded**, Contents takes what it needs up to half the section and scrolls inside; the
 *   thumbnails keep the rest, so both stay in reach.
 * - **Add bookmark** expands Contents first, so the new item shows as it goes into renaming.
 *   Locked, it dims and stays focusable with the reason as its tooltip (N3 §4).
 * - **In the Pages grid** only Contents is offered (06.1): the grid is the thumbnails, so the
 *   group shows alone, its header a plain heading rather than a disclosure.
 */
import { useId } from 'react';

import { m } from '../../i18n';
import { addBookmark } from '../../outline/outline-actions';
import { refusalReason, useChangeRefusal } from '../../state/guard';
import { useStageView, useUiStore } from '../../state/ui-store';
import { useActiveDocument } from '../../state/workspace-store';
import { EmptyNote } from '../../ui/EmptyNote';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { RowButton } from '../../ui/RowButton';
import { OutlinePanel } from '../OutlinePanel';
import styles from './PagesSection.module.css';
import { ThumbnailList } from './ThumbnailList';

export function PagesSection() {
  const expanded = useUiStore((s) => s.pagesView === 'bookmarks');
  const inGrid = useStageView() === 'grid';
  const open = inGrid || expanded;
  return (
    <div className={styles.section} data-pages-view={open ? 'bookmarks' : 'thumbnails'}>
      <ContentsGroup open={open} collapsible={!inGrid} />
      {inGrid ? null : (
        <div className={styles.thumbnails}>
          <Thumbnails />
        </div>
      )}
    </div>
  );
}

/** The Contents group: its header row (disclosure or heading, Add bookmark) and the outline. */
export function ContentsGroup({
  open,
  collapsible,
}: {
  readonly open: boolean;
  readonly collapsible: boolean;
}) {
  const setView = useUiStore((s) => s.setPagesView);
  const bodyId = useId();
  const headingId = useId();
  return (
    <section
      className={styles.contents}
      data-open={open || undefined}
      data-alone={collapsible ? undefined : ''}
      aria-labelledby={headingId}
    >
      <div className={styles.header}>
        {collapsible ? (
          <RowButton
            id={headingId}
            className={styles.disclosure}
            aria-expanded={open}
            aria-controls={open ? bodyId : undefined}
            onClick={() => setView(open ? 'thumbnails' : 'bookmarks')}
          >
            <Icon name="caret-right" className={styles.caret} />
            <span className={styles.label}>{m.nav_pages_bookmarks()}</span>
          </RowButton>
        ) : (
          <h2 id={headingId} className={styles.heading}>
            {m.nav_pages_bookmarks()}
          </h2>
        )}
        <AddBookmark onAdd={() => setView('bookmarks')} />
      </div>
      {open ? (
        <div id={bodyId} className={styles.outline}>
          <OutlinePanel />
        </div>
      ) : null}
    </section>
  );
}

/** Add bookmark (N3 §4) as the group's trailing icon button. */
function AddBookmark({ onAdd }: { readonly onAdd: () => void }) {
  const doc = useActiveDocument();
  // Bookmarks are a `document` act: dimmed (focusable, with the reason) while locked.
  const refusal = useChangeRefusal(doc?.id, 'document');
  if (!doc) return null;
  const unavailable = refusal !== undefined || doc.pages.length === 0;
  return (
    <IconButton
      size="row"
      label={m.outline_add()}
      tooltip={refusal ? refusalReason(refusal) : m.outline_add_tooltip()}
      tooltipSide="right"
      icon={<Icon name="plus" />}
      aria-disabled={unavailable || undefined}
      data-locked={refusal ? '' : undefined}
      onClick={() => {
        if (unavailable) return;
        onAdd();
        addBookmark(doc.id);
      }}
    />
  );
}

function Thumbnails() {
  const doc = useActiveDocument();
  if (!doc) {
    return (
      <div className={styles.empty}>
        <EmptyNote title={m.no_document_title()} body={m.pages_empty_body()} />
      </div>
    );
  }
  if (doc.pages.length === 0) {
    return (
      <div className={styles.empty}>
        <EmptyNote title={m.pages_none_title()} body={m.pages_none_body()} />
      </div>
    );
  }
  return <ThumbnailList doc={doc} />;
}
