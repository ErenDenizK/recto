/**
 * N1 Sidebar shell and section switch (`components/06-navigation.md` N1; redesign spec D2-4):
 * the one side surface for a document, Pages (thumbnails or Contents) · Find · Review. It
 * replaces M8's rail and navigator panel; the Files tab went to the Library and the tabs (L5,
 * F4), and Compare's Changes list stays in this slot, alone and without a tab, until the
 * Compare place docks its own (CP5, D2-6).
 *
 * - **Shown** only in a document, and only once opened: closed by default on every size,
 *   remembered per device once changed (`ui-store`, 06.17); the width too (240–400, 06.18).
 *   ▤, Mod+B, Find's ↓ and "All results", the pill's "All contents…" and ⌘K open it on their
 *   section.
 * - **Forms** (01-frame F1 §2): docked from expanded up (it insets the free rectangle and the
 *   page re-centres), a 320 px overlay inset 8 on medium, a 360 px side sheet under the top bar
 *   on compact-height. Laid over the page, it is light-dismissed by a press outside and by Esc,
 *   which returns focus to ▤. Phones keep it in the Pages sheet (M10, ADR-0033): not mounted.
 * - **In the Pages grid** the Pages section is not offered (the grid is it): a sidebar open on
 *   thumbnails hides for the grid and returns after; one on Contents, Find or Review stays
 *   (06.1).
 * - **Switch:** APG tabs drawn as the segmented control (`ui/Segmented`, Base UI Tabs):
 *   Left / Right move and show (automatic activation), Tab enters the body; names carry the
 *   counts ("Review, 3 items", "Find, 41 matches").
 * - **Focus:** Mod+B lands on the section's current item (`sidebar-focus.ts`), ▤ keeps it;
 *   F6 stop 2 lands there too (`data-region-landing`).
 * - **Splitter:** drag, or Left / Right 16 px, Home / End; the width is announced once it
 *   rests ("Sidebar 320 pixels").
 */
import { lazy, Suspense, useEffect, useRef } from 'react';

import { formatNumber, m } from '../../i18n';
import {
  LEFT_PANEL_WIDTH,
  type LeftPanelView,
  useStageView,
  useUiStore,
} from '../../state/ui-store';
import { useActiveDocument, useHasDocuments, useWorkspaceStore } from '../../state/workspace-store';
import { ResizeHandle } from '../../ui/ResizeHandle';
import { Segmented, SegmentedPanel } from '../../ui/Segmented';
import { useSearchStore } from '../../viewer/search';
import { announce } from '../announcer';
import { showOverlaySidebar, useFrameStore } from '../frame/frame-store';
import { SIDEBAR_ID } from '../frame/ids';
import { countItems, useReadReviewData, useReviewData } from '../review/review-items';
import { ReviewPanel } from '../review/ReviewPanel';
import { FindSection } from './FindSection';
import { PagesSection } from './PagesSection';
import styles from './Sidebar.module.css';
import { focusSidebarItem, takeSidebarFocusRequest } from './sidebar-focus';
import { textlessPages } from './textless';

/** Compare's Changes list loads with Compare. */
const ChangesPanel = lazy(() => import('../../compare/ChangesPanel'));

/** The form the sidebar takes in this window class (01-frame F1 §2). */
export type SidebarForm = 'docked' | 'overlay' | 'sheet';

/** Widths of the forms laid over the page (06.18: the overlay stays fixed). */
export const OVERLAY_WIDTH = 320;
export const SHEET_WIDTH = 360;

/** After the splitter rests this long, the width is said once. */
const RESIZE_ANNOUNCE_MS = 600;

type Section = Exclude<LeftPanelView, 'changes'>;

const SECTIONS: readonly { readonly value: Section; readonly label: () => string }[] = [
  { value: 'pages', label: m.nav_tab_pages },
  { value: 'find', label: m.nav_tab_find },
  { value: 'review', label: m.nav_tab_review },
];

/** The section a stored view shows; Compare's Changes is never a section. */
export function sectionOf(view: LeftPanelView): Section {
  return view === 'changes' ? 'pages' : view;
}

/**
 * Whether the sidebar shows at all: in a document (not the Library), open, and on the grid not
 * while it would show thumbnails (06.1). Compare shows its Changes list in the slot.
 */
export function sidebarVisible(state: {
  readonly open: boolean;
  readonly hasDocuments: boolean;
  readonly stage: ReturnType<typeof useStageView>;
  readonly section: Section;
  readonly pagesView: 'thumbnails' | 'bookmarks';
}): boolean {
  if (!state.open || !state.hasDocuments || state.stage === 'home') return false;
  if (state.stage === 'grid' && state.section === 'pages' && state.pagesView === 'thumbnails') {
    return false;
  }
  return true;
}

/**
 * On a document with no text at all, focusing Find opens the Find section on its "No text on
 * these pages · Recognize text…" prompt (06 N4 §4; flows.md J11 3 by this prompt): nothing can
 * match there, and the prompt says why and offers the fix.
 */
function useTextlessFindDoor(): void {
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('[data-find-entry] input')) return;
      const ws = useWorkspaceStore.getState().workspace;
      const doc = ws.activeDocument === undefined ? undefined : ws.documents[ws.activeDocument];
      if (!doc || doc.pages.length === 0) return;
      void textlessPages(doc).then(({ pages, targets }) => {
        if (pages.length === 0 || pages.length < targets) return;
        if (useWorkspaceStore.getState().workspace.activeDocument !== doc.id) return;
        const ui = useUiStore.getState();
        if (!(ui.leftPanelOpen && ui.leftPanelView === 'find')) ui.showNavigator('find');
        showOverlaySidebar(true);
      });
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);
}

export function Sidebar({ form = 'docked' }: { readonly form?: SidebarForm }) {
  useTextlessFindDoor();
  const stored = useUiStore((s) => s.leftPanelOpen);
  const view = useUiStore((s) => s.leftPanelView);
  const pagesView = useUiStore((s) => s.pagesView);
  const hasDocuments = useHasDocuments();
  const stage = useStageView();
  // Laid over the page, it shows only once asked for in this window (frame-store).
  const asked = useFrameStore((s) => form === 'docked' || s.overlaySidebarShown);
  const comparing = stage === 'compare';
  const section = sectionOf(view);
  const open =
    asked &&
    sidebarVisible({ open: stored, hasDocuments, stage, section, pagesView }) &&
    (!comparing || view === 'changes');
  if (!open) return null;
  return <SidebarFrame form={form} comparing={comparing} section={section} />;
}

function SidebarFrame({
  form,
  comparing,
  section,
}: {
  readonly form: SidebarForm;
  readonly comparing: boolean;
  readonly section: Section;
}) {
  const width = useUiStore((s) => s.leftPanelWidth);
  const setWidth = useUiStore((s) => s.setLeftPanelWidth);
  const asideRef = useRef<HTMLElement>(null);
  const resting = useRef<number | undefined>(undefined);

  // Mod+B: the section's current item takes focus once it is laid out.
  useEffect(() => {
    if (!takeSidebarFocusRequest()) return;
    const frame = requestAnimationFrame(() => {
      if (!focusSidebarItem()) requestAnimationFrame(() => focusSidebarItem());
    });
    return () => cancelAnimationFrame(frame);
  });

  // Laid over the page: a press outside it (but on ▤, which toggles it) or Esc puts it away,
  // Esc returning focus to ▤.
  useEffect(() => {
    if (form === 'docked') return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (asideRef.current?.contains(target)) return;
      if (target.closest('[data-testid="sidebar-toggle"], [role="dialog"], [role="menu"]')) return;
      showOverlaySidebar(false);
    };
    // Bubbling, so an Esc a field, a list or a menu inside uses (and prevents) stays theirs.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      showOverlaySidebar(false);
      document.querySelector<HTMLElement>('[data-testid="sidebar-toggle"]')?.focus();
    };
    const aside = asideRef.current;
    document.addEventListener('pointerdown', onPointerDown, true);
    aside?.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      aside?.removeEventListener('keydown', onKeyDown);
    };
  }, [form]);

  useEffect(() => () => window.clearTimeout(resting.current), []);
  const resize = (next: number) => {
    setWidth(next);
    window.clearTimeout(resting.current);
    resting.current = window.setTimeout(() => {
      announce(m.nav_resized({ width: formatNumber(useUiStore.getState().leftPanelWidth) }), {
        key: 'sidebar-width',
      });
    }, RESIZE_ANNOUNCE_MS);
  };

  const shownWidth = form === 'docked' ? width : form === 'overlay' ? OVERLAY_WIDTH : SHEET_WIDTH;
  return (
    <nav
      id={SIDEBAR_ID}
      ref={asideRef}
      className={styles.sidebar}
      aria-label={m.nav_label()}
      data-region="navigator"
      data-frame-layer="sidebar"
      data-form={form}
      data-overlay={form === 'docked' ? undefined : ''}
      data-section={comparing ? 'changes' : section}
      style={{ width: shownWidth }}
    >
      {comparing ? (
        <div className={styles.changes} data-sidebar-body="">
          <Suspense fallback={null}>
            <ChangesPanel />
          </Suspense>
        </div>
      ) : (
        <Sections section={section} />
      )}
      {form === 'docked' ? (
        <ResizeHandle
          label={m.nav_resize()}
          controls={SIDEBAR_ID}
          value={width}
          min={LEFT_PANEL_WIDTH.min}
          max={LEFT_PANEL_WIDTH.max}
          direction={1}
          onChange={resize}
        />
      ) : null}
    </nav>
  );
}

/** Review items, and matches once there is a query: the counts the switch shows. */
function useSectionCounts(): { readonly find: number | undefined; readonly review: number } {
  const doc = useActiveDocument();
  const matches = useSearchStore((s) =>
    s.documentId === (doc?.id ?? null) && s.query.trim() !== '' ? s.hits.length : undefined,
  );
  useReadReviewData();
  const review = countItems(useReviewData().items).all;
  return { find: matches, review };
}

function Sections({ section }: { readonly section: Section }) {
  const showView = useUiStore((s) => s.showNavigator);
  const counts = useSectionCounts();
  const options = SECTIONS.map(({ value, label }) => {
    const count = value === 'find' ? counts.find : value === 'review' ? counts.review : undefined;
    const name =
      count === undefined || count === 0
        ? label()
        : value === 'find'
          ? m.nav_find_count_name({ label: label(), count })
          : m.nav_count_name({ label: label(), count });
    return {
      value,
      label: label(),
      ...(count !== undefined && count > 0 ? { count } : {}),
      name,
    };
  });
  return (
    <Segmented<Section>
      semantics="tabs"
      label={m.nav_views_label()}
      value={section}
      onValueChange={(next) => showView(next)}
      options={options}
      frameClassName={styles.switch}
      tabsClassName={styles.tabs}
    >
      {SECTIONS.map(({ value }) => (
        <SegmentedPanel key={value} value={value} className={styles.body}>
          <div className={styles.section} data-sidebar-body="" data-view={value}>
            {value === 'pages' ? <PagesSection /> : null}
            {value === 'find' ? <FindSection /> : null}
            {value === 'review' ? <ReviewPanel /> : null}
          </div>
        </SegmentedPanel>
      ))}
    </Segmented>
  );
}
