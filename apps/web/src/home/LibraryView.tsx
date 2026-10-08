/**
 * The Library (`02-library` L1; the place `destination === 'home'`, code name kept): the welcome
 * and the open documents, in one scroll column of at most 1184 px (six cards), centred.
 *
 *   empty            launcher card (L2) · Recent (L7) · footer (L12)
 *   with documents   launcher row (L2) · head (L4) · cards (L5) · Recent (L7) · footer (L12)
 *                    + the selection bar (L6) floating at the bottom while cards are checked
 *
 * The view is the canvas with no glass of its own (L1 §3); each part takes its tier. Behind the
 * column glows the aura (`LibraryAura`), the static CSS form of the Library field (L3) in the
 * mark's colours; the WebGL field stays D3-8's, and the head row publishes its text-safe rect
 * for it (`text-safe.ts`). A file drag over the window lifts the launcher and
 * changes its headline (L9); the document view's overlay is `DropOverlay`.
 *
 * Esc ladder (L1 §6): Esc clears the checks, then leaves Select mode; it never navigates. First
 * focus: Open PDFs… when no document is open (the launcher), else the card of the document last
 * shown (`showHome` callers focus it). `scroll-padding-bottom` keeps a focused card clear of the
 * selection bar (A-12).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { useEffect, useMemo } from 'react';

import { m } from '../i18n';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { type HomeCardData, homeCards, liveSelection } from './home-model';
import { Launcher } from './Launcher';
import { LibraryFooter } from './LibraryFooter';
import { LibraryGrid } from './LibraryGrid';
import { LibraryHead } from './LibraryHead';
import { enterSelecting, setSelecting, useSelecting } from './library-store';
import styles from './LibraryView.module.css';
import { RecentList } from './RecentList';
import { SelectionBar } from './SelectionBar';
import { useDragFileCount } from './use-drag-file-count';

function useLibraryCards(): HomeCardData[] {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  const colors = useWorkspaceStore((s) => s.documentColors);
  return useMemo(() => homeCards(workspace, files, colors), [workspace, files, colors]);
}

export function LibraryView({ dragging }: { readonly dragging: boolean }) {
  const cards = useLibraryCards();
  const dragCount = useDragFileCount(dragging);
  if (cards.length === 0) {
    return (
      <section
        className={styles.library}
        aria-label={m.library_label()}
        data-testid="home"
        data-variant="empty"
        data-dragging={dragging || undefined}
      >
        <LibraryAura />
        <div className={styles.scroller}>
          <div className={`${styles.column} ${styles.empty}`}>
            <div className={styles.welcome}>
              <Launcher variant="card" dragging={dragging} dragCount={dragCount} />
              <RecentList variant="empty" />
            </div>
            <LibraryFooter />
          </div>
        </div>
      </section>
    );
  }
  return <LibraryWithCards cards={cards} dragging={dragging} dragCount={dragCount} />;
}

/**
 * The aura (owner feedback 2026-10-08, "missing aura"; the CSS form of L3's field): four soft
 * lobes in the mark's mint, lime and yellow lime behind the column, fixed to the view while the
 * column scrolls. Static (Q-10: no frames at rest), no blur and no grain (Q-1): each lobe is
 * one eased radial gradient, painted once. Decorative and pointer-transparent.
 */
function LibraryAura() {
  return (
    <div className={styles.aura} aria-hidden="true" data-testid="library-aura">
      <span className={styles.lobe} data-lobe="mint" />
      <span className={styles.lobe} data-lobe="lime" />
      <span className={styles.lobe} data-lobe="yellow" />
      <span className={styles.lobe} data-lobe="low" />
    </div>
  );
}

function LibraryWithCards({
  cards,
  dragging,
  dragCount,
}: {
  readonly cards: readonly HomeCardData[];
  readonly dragging: boolean;
  readonly dragCount: number | undefined;
}) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const order = useMemo<readonly DocumentId[]>(() => cards.map((c) => c.id), [cards]);
  const rawSelection = useUiStore((s) => s.homeSelection);
  const selection = useMemo(() => liveSelection(order, rawSelection), [order, rawSelection]);
  const selecting = useSelecting();
  const pages = cards.reduce((sum, c) => sum + c.pageCount, 0);

  // The Esc ladder from anywhere in the Library (L1 §6): the checks first, then Select mode.
  // The grid handles its own Esc and marks it handled.
  useEffect(() => {
    if (!selecting) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('[role="dialog"], [role="menu"]')) {
        return;
      }
      if (selection.length > 0) {
        enterSelecting();
        useUiStore.getState().setHomeSelection([], null);
      } else setSelecting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting, selection]);

  return (
    <section
      className={styles.library}
      aria-label={m.library_label()}
      data-testid="home"
      data-dragging={dragging || undefined}
      data-selecting={selecting || undefined}
    >
      <LibraryAura />
      <div className={styles.scroller}>
        <div className={styles.column}>
          <Launcher
            variant="row"
            dragging={dragging}
            dragCount={dragCount}
            selecting={selecting && selection.length >= 2}
          />
          <div className={styles.documents}>
            <LibraryHead order={order} pages={pages} />
            <LibraryGrid cards={cards} workspace={workspace} />
          </div>
          <RecentList variant="cards" />
          <LibraryFooter />
        </div>
      </div>
      {selection.length > 0 ? <SelectionBar selection={selection} /> : null}
    </section>
  );
}
