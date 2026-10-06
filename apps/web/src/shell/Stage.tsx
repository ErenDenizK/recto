/**
 * The stage: the page scroller layer of the frame (`components/01-frame.md` F1; redesign spec
 * D2-1). It sits in the free rectangle (`--free-*`, `frame/frame-insets.ts`), and shows the
 * Library (`home/LibraryView`), a document's page (`stage/ReadView`), its Pages grid
 * (`stage/ArrangeView`) or Compare (`compare/CompareView`, loaded on first use).
 *
 * There is no stage header and no Read · Edit · Arrange control any more (ADR-0029): a
 * document opens on its page, Markup opens from the dock, the grid from the dock's Pages and
 * the tab menu (and `3`), Compare from the title menu. The layout switch moved into the page
 * pill's menu, the document drop overlay (`home/DropOverlay`) into a frame layer over the free rectangle, the floating tool bar
 * into the dock band (`frame/DockBand.tsx`). The page view is keyed by document so switching
 * tabs starts fresh.
 *
 * The page view's focus ring shows only when the focus reached it by Tab or F6
 * (`watchStageFocusRing`, review finding 23): a click on the pages, or a key such as `2`
 * pressed while they have the focus, would otherwise turn on `:focus-visible` and frame the
 * whole stage as if the page were selected.
 */
import { lazy, Suspense, useEffect } from 'react';

import { LibraryView } from '../home/LibraryView';
import { m } from '../i18n';
import { ArrangeView } from '../stage/ArrangeView';
import { usePreparedPageView } from '../stage/grid/grid-transition';
import { ReadView } from '../stage/ReadView';
import { type StageView, useStageView } from '../state/ui-store';
import { useActiveDocument, useHasDocuments, useWorkspaceStore } from '../state/workspace-store';
import { EmptyNote } from '../ui/EmptyNote';
import { STAGE_ID, tabDomId } from './frame/ids';
import styles from './Stage.module.css';

// The Compare view (spec recognize-and-compare §2.2) loads with its first use.
const CompareView = lazy(() => import('../compare/CompareView'));

/** Keys after which the stage shows its focus ring: Tab (and Shift+Tab) and F6. */
const NAVIGATION_KEYS: ReadonlySet<string> = new Set(['Tab', 'F6']);
/** A focus change this soon after a navigation key came from it (ms). */
const NAVIGATION_FOCUS_MS = 500;
/** On the stage while the focus inside it arrived by Tab or F6 (ReadView.module.css). */
export const STAGE_FOCUS_RING_ATTR = 'data-focus-ring';

/**
 * Marks the stage with `data-focus-ring` while the focus in it arrived by Tab or F6, and
 * clears it on any other focus change and on a press, so the pages' ring shows only after
 * keyboard navigation (module header). Returns a disposer.
 */
export function watchStageFocusRing(doc: Document = document): () => void {
  let navigatedAt = Number.NEGATIVE_INFINITY;
  const stage = () => doc.getElementById(STAGE_ID);
  const onKeyDown = (event: globalThis.KeyboardEvent) => {
    navigatedAt = NAVIGATION_KEYS.has(event.key) ? performance.now() : Number.NEGATIVE_INFINITY;
  };
  const onFocusIn = (event: FocusEvent) => {
    const main = stage();
    if (!main || !(event.target instanceof Node) || !main.contains(event.target)) return;
    main.toggleAttribute(
      STAGE_FOCUS_RING_ATTR,
      performance.now() - navigatedAt <= NAVIGATION_FOCUS_MS,
    );
  };
  const onPointerDown = () => {
    navigatedAt = Number.NEGATIVE_INFINITY;
    stage()?.removeAttribute(STAGE_FOCUS_RING_ATTR);
  };
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.removeEventListener('focusin', onFocusIn, true);
    doc.removeEventListener('pointerdown', onPointerDown, true);
  };
}

export function Stage({ dragging }: { readonly dragging: boolean }) {
  useEffect(() => watchStageFocusRing(), []);
  const hasDocuments = useHasDocuments();
  const opening = useWorkspaceStore((s) => s.opening);
  const doc = useActiveDocument();
  const view = useStageView();
  // The grid's way out mounts the page view first, hidden under the grid, so the morph starts
  // over a page already drawn (`grid-transition.ts`). Same slot and key as the page view proper,
  // so the view change reveals it rather than mounting it.
  const preparedId = usePreparedPageView();
  const prepared = useWorkspaceStore((s) =>
    preparedId === null ? undefined : s.workspace.documents[preparedId],
  );
  const readDoc = view === 'page' ? doc : view === 'grid' ? prepared : undefined;

  if (!hasDocuments) {
    return (
      <main
        id={STAGE_ID}
        className={styles.stage}
        aria-label={m.stage_start_label()}
        aria-busy={opening > 0}
      >
        <LibraryView dragging={dragging} />
      </main>
    );
  }

  if (view === 'home') {
    return (
      <main
        id={STAGE_ID}
        className={styles.stage}
        aria-label={m.home_label()}
        aria-busy={opening > 0}
      >
        <h1 className="visually-hidden">{m.home_long()}</h1>
        <LibraryView dragging={dragging} />
      </main>
    );
  }

  return (
    // The main landmark, named by the active document's tab (which controls it). Not a
    // `tabpanel`: that role would take the landmark away (axe: landmark-one-main).
    <main
      id={STAGE_ID}
      aria-labelledby={doc ? tabDomId(doc.id) : undefined}
      aria-label={doc ? undefined : m.stage_start_label()}
      aria-busy={opening > 0}
      className={styles.stage}
    >
      <h1 className="visually-hidden">{VIEW_HEADINGS[view]()}</h1>
      {doc?.pages.length === 0 && view === 'page' ? (
        <div className={styles.emptyDocument}>
          <EmptyNote title={m.stage_no_pages_title()} body={m.stage_no_pages_body()} />
        </div>
      ) : null}
      {/* The grid is not keyed: it shows several documents (sections) and keeps its scroll. */}
      {view === 'grid' ? <ArrangeView /> : null}
      {readDoc && readDoc.pages.length > 0 ? (
        <ReadView key={readDoc.id} doc={readDoc} prepared={view !== 'page'} />
      ) : null}
      {view === 'compare' ? (
        <Suspense fallback={null}>
          <CompareView dragging={dragging} />
        </Suspense>
      ) : null}
    </main>
  );
}

/** The stage's heading, for screen readers: the view's long name. */
const VIEW_HEADINGS: Readonly<Record<StageView, () => string>> = {
  home: m.home_long,
  page: m.mode_read_long,
  grid: m.mode_arrange_long,
  compare: m.compare_mode_long,
};
