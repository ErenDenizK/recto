/**
 * The Library (`02-library` L1; the place `destination === 'home'`, code name kept): the welcome
 * and the open documents, in one scroll column of at most 1184 px (six cards), centred.
 *
 *   empty            launcher (L2) · Recent (L7) · Try the sample (L10)
 *   with documents   launcher (L2) · head (L4) · cards (L5) · Recent (L7) · Try the sample
 *                    + the selection bar (L6) floating at the bottom while cards are checked
 *
 * Three tiers, in the order a tester needs them (DSN-50): bring a file in (open, combine, batch
 * or drop), go back to one (the open cards, then Recents), or try the sample. No heading
 * repeats the strip's "◆ Library" piece (B-13).
 *
 * No footer (DSN-46): its "Nothing is uploaded" chip repeated the promise and ◎, and its
 * language switch is Settings' alone. The column's edge keeps the strip's inset
 * (system-audit-2026-10 §3.1, §3.9): the column runs --piece-inset from the window's edges
 * until it reaches its cap, then centres.
 *
 * The view has no glass and no fill of its own (L1 §3); each part takes its tier. Behind the
 * column glows the aura (`Aura.tsx`), the CSS form of the Library field (L3) in the mark's
 * colours, slowly drifting; the shell lays it, fixed to the window behind the stage
 * (`AppShell.tsx`; owner feedback 2026-10-10, R15), so a side sheet or the sidebar narrowing the
 * stage never cuts it. The WebGL field stays D3-8's, and the head row publishes its text-safe
 * rect for it (`text-safe.ts`). The view reaches up under the top strip's pieces (owner feedback
 * 2026-10-09, G2), so its column scrolls under them. A file drag over the window lifts the launcher and
 * changes its headline (L9); the document view's overlay is `DropOverlay`.
 *
 * Esc ladder (L1 §6): Esc clears the checks, then leaves Select mode; it never navigates. First
 * focus: Open PDFs… when no document is open (the launcher), else the card of the document last
 * shown (`showHome` callers focus it). `scroll-padding-bottom` keeps a focused card clear of the
 * selection bar (A-12).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { lazy, Suspense, useEffect, useMemo } from 'react';

import { m } from '../i18n';
import { useResumeStore } from '../session/resume';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { HOME_CONTINUE_FLAG, homeFlagEnabled } from './home-flags';
import { type HomeCardData, homeCards, liveSelection } from './home-model';
import { Launcher } from './Launcher';
import { LibraryGrid } from './LibraryGrid';
import { LibraryHead } from './LibraryHead';
import { enterSelecting, setSelecting, useSelecting } from './library-store';
import styles from './LibraryView.module.css';
import { RecentList } from './RecentList';
import { SampleCard } from './SampleCard';
import { SelectionBarPresence } from './SelectionBar';
import { useDragFileCount } from './use-drag-file-count';

/** Continue, a chunk of its own that loads only behind `?home=continue` (DSN-66). */
const ContinueCard = lazy(() => import('./ContinueCard'));

function Continue() {
  if (!homeFlagEnabled(HOME_CONTINUE_FLAG)) return null;
  return (
    <Suspense fallback={null}>
      <ContinueCard />
    </Suspense>
  );
}

function useLibraryCards(): HomeCardData[] {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  const colors = useWorkspaceStore((s) => s.documentColors);
  const points = useResumeStore((s) => s.points);
  // Behind `?home=continue`: how far each document was read (DSN-66).
  const reached = useMemo(() => (homeFlagEnabled(HOME_CONTINUE_FLAG) ? points : {}), [points]);
  return useMemo(
    () => homeCards(workspace, files, colors, reached),
    [workspace, files, colors, reached],
  );
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
        <div className={styles.scroller}>
          <div className={`${styles.column} ${styles.empty}`}>
            <div className={styles.welcome}>
              <Continue />
              <Launcher variant="card" dragging={dragging} dragCount={dragCount} />
              <RecentList variant="empty" />
              <SampleCard align="centre" />
            </div>
          </div>
        </div>
      </section>
    );
  }
  return <LibraryWithCards cards={cards} dragging={dragging} dragCount={dragCount} />;
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
      <div className={styles.scroller}>
        <div className={styles.column}>
          <Continue />
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
          <SampleCard align="start" />
        </div>
      </div>
      <SelectionBarPresence selection={selection} />
    </section>
  );
}
