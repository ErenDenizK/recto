/**
 * The desk (DSN-87, Masa; PRC-25, behind Labs' "Desk (new Home)"): Home on desktop and tablet,
 * the place where you were, then what you can start, then what you had (`masa.md` §2).
 *
 *   hero (Continue, or the sample)  ·  intents (Open, Sign, Combine, Scan)   8 / 4 columns
 *   the drop line and "More ways…"
 *   the open documents (the Library's head and grid, unchanged), only while some are open
 *   Recent as a shelf of covers (`RecentShelf`), the sample its last tile while off screen
 *
 * - **First visit** (Recents read and empty, nothing open, nothing to continue): the identity
 *   (mark, headline, promise) a third of the way down as the Library had it, and the sample
 *   hero in the slot Continue takes later, the same size, so nothing re-flows.
 * - **Returning**: no identity (the strip's "◆ Library" names the place, DSN-50), a visually
 *   hidden `h1`; the slot holds Continue, else the sample while it is not on screen, else
 *   collapses and the intents run as one row.
 * - **Loading** (Recents not read yet): the slot holds its size as an empty lit card; after
 *   300 ms with no answer it falls back to the first-visit sample hero.
 * - **Nothing on the first paint needs the engine**: covers are stored images, the sample a
 *   drawing, Continue's page a cover (the open grid's live thumbnails exist only when documents
 *   are open, so the engine is running). Recents and covers are read by `desk-prefetch.ts`.
 * - **First focus** (quiet focus, no ring until a key, as the launcher had it): Continue when it
 *   shows, else Open files… One primary per view (ADR-0023): Continue, else Open files….
 * - **Heading**: the section is the Library landmark; `h2`s are "Where you left off", "Ways to
 *   start" (the group's label), "Open" (the head) and "Recent".
 *
 * Esc ladder, Select mode and the selection bar are the Library's (`useSelectionEscape`).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { useEffect, useMemo, useRef, useState } from 'react';

import { BrandMark } from '../brand/BrandMark';
import { loadRecents, useRecentsStore } from '../files/recents';
import { m } from '../i18n';
import { scanEnabled } from '../scan/scan-flag';
import { useUiStore } from '../state/ui-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { useCovers } from './covers';
import { useDeskContinue } from './DeskContinue';
import { DeskDropLine } from './DeskDropLine';
import { DeskHero } from './DeskHero';
import { DeskIntents } from './DeskIntents';
import { heroKind, isFirstVisit, LOADING_FALLBACK_MS } from './desk-model';
import styles from './Desk.module.css';
import { dropTitle } from './DropOverlay';
import type { HomeCardData } from './home-cards';
import { liveSelection, sampleOnScreen, visibleRecents } from './home-model';
import { LibraryGrid } from './LibraryGrid';
import { LibraryHead } from './LibraryHead';
import { useSelecting } from './library-store';
import view from './LibraryView.module.css';
import { RecentShelf } from './RecentShelf';
import { useOpenFiles } from './RecentList';
import { SelectionBarPresence } from './SelectionBar';
import { useHasCamera } from './use-camera';
import { useSelectionEscape } from './use-selection-escape';

export default function Desk({
  cards,
  dragging,
  dragCount,
}: {
  readonly cards: readonly HomeCardData[];
  readonly dragging: boolean;
  readonly dragCount: number | undefined;
}) {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  const entries = useRecentsStore((s) => s.entries);
  const loaded = useRecentsStore((s) => s.loaded);
  const open = useOpenFiles();
  const covers = useCovers();
  const continueSource = useDeskContinue(covers);
  const selecting = useSelecting();
  const rawSelection = useUiStore((s) => s.homeSelection);
  const order = useMemo<readonly DocumentId[]>(() => cards.map((c) => c.id), [cards]);
  const selection = useMemo(() => liveSelection(order, rawSelection), [order, rawSelection]);
  const pages = cards.reduce((sum, c) => sum + c.pageCount, 0);
  useSelectionEscape(selecting, selection);

  // The early read (`desk-prefetch.ts`) normally has Recents already; this is the same read.
  useEffect(() => {
    void loadRecents();
  }, []);

  // Recents answer within a frame or two on a warm start; after 300 ms the slot stops waiting.
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (loaded) return undefined;
    const timer = window.setTimeout(() => setWaited(true), LOADING_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  // The first paint has no entrance; a Continue card that arrives later rises (§4 rule 4).
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const listed = useMemo(() => visibleRecents(entries, open), [entries, open]);
  const hasContinue = continueSource !== undefined;
  const sampleFree = !sampleOnScreen(Object.values(files), entries);
  const hero = heroKind({ loaded, waited, hasContinue, sampleFree });
  const firstVisit = isFirstVisit({
    loaded,
    recents: entries.length,
    open: cards.length,
    hasContinue,
  });
  const sampleTile = sampleFree && hero !== 'sample' && hero !== 'holding';
  const camera = useHasCamera(scanEnabled());

  // First focus: Continue when it shows, else Open files… Placed by the page, not by a key, so
  // it draws no ring until a key is pressed.
  const rootRef = useRef<HTMLElement>(null);
  const focusedOn = useRef<'open' | 'continue' | null>(null);
  const ready = loaded || waited;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready || focusedOn.current === 'continue') return undefined;
    const wanted = hero === 'continue' ? 'continue' : 'open';
    if (focusedOn.current === wanted) return undefined;
    const target = root.querySelector<HTMLElement>(
      wanted === 'continue' ? '[data-testid="continue-resume"]' : '[data-library-open]',
    );
    const active = document.activeElement;
    const ours = focusedOn.current !== null && root.contains(active);
    if (!target || (!ours && active !== null && active !== document.body)) return undefined;
    focusedOn.current = wanted;
    target.setAttribute('data-quiet-focus', '');
    target.focus({ preventScroll: true });
    const loud = () => target.removeAttribute('data-quiet-focus');
    window.addEventListener('keydown', loud, { capture: true, once: true });
    target.addEventListener('blur', loud, { once: true });
    return () => {
      window.removeEventListener('keydown', loud, { capture: true });
      target.removeEventListener('blur', loud);
    };
  }, [ready, hero]);

  const top = (
    <div className={styles.top} data-hero={hero}>
      {hero === 'none' ? null : (
        <div className={styles.hero}>
          <DeskHero kind={hero} source={continueSource} rise={settled} />
        </div>
      )}
      <div className={styles.intents}>
        <DeskIntents
          scan={camera}
          dragging={dragging}
          selecting={selecting && selection.length >= 2}
          wide={hero === 'none'}
        />
      </div>
    </div>
  );

  return (
    <section
      ref={rootRef}
      className={view.library}
      aria-label={m.library_label()}
      data-testid="home"
      data-desk=""
      data-variant={firstVisit ? 'empty' : undefined}
      data-dragging={dragging || undefined}
      data-selecting={selecting || undefined}
    >
      <div className={view.scroller}>
        <div className={firstVisit ? `${view.column} ${view.empty}` : view.column}>
          {/* One wrapper, one order of slots in both states, so a first visit turning into a
              returning desk (or Continue arriving) never remounts the intents or loses focus. */}
          <div className={firstVisit ? `${view.welcome} ${styles.welcome}` : styles.stack}>
            {firstVisit ? (
              <div className={styles.identity} data-dragging={dragging || undefined}>
                <BrandMark size={56} className={styles.mark} />
                <h1 className={styles.headline}>
                  {dragging ? dropTitle(dragCount) : m.library_headline()}
                </h1>
                <p className={styles.promise}>{m.library_line()}</p>
              </div>
            ) : (
              <h1 className="visually-hidden">{m.library_label()}</h1>
            )}
            {top}
            <DeskDropLine dragging={dragging} dragCount={dragCount} more={camera} />
            {cards.length > 0 ? (
              <div className={view.documents}>
                <LibraryHead order={order} pages={pages} />
                <LibraryGrid cards={cards} workspace={workspace} />
              </div>
            ) : null}
            <RecentShelf entries={listed} covers={covers} sampleTile={sampleTile} />
          </div>
        </div>
      </div>
      <SelectionBarPresence selection={selection} />
    </section>
  );
}
