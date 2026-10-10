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
 * - **Forms** (01-frame F1 §2; owner decision 2026-10-10, DSN-22): one floating glass panel,
 *   inset from the window on the piece inset under the strip and above the dock band, with the
 *   sheet radius, laid over the canvas: it never pushes or resizes the document (the free
 *   rectangle keeps its full width and the page does not reflow). From expanded up it is
 *   `floating`: it stays until ▤ or Mod+B puts it away, at its stored width. On medium it is the
 *   320 px `overlay` and on compact-height the 360 px side `sheet` under the top bar; those two
 *   are light-dismissed by a press outside and by Esc, which returns focus to ▤. Phones keep it
 *   in the Pages sheet (M10, ADR-0033): not mounted.
 * - **One layer** (DSN-22): the section tabs are the only row of navigation; Pages holds the
 *   thumbnails with Contents as a collapsible group above them (`PagesSection.tsx`).
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
 * - **Motion** (docs/design/motion-2026-10/frame.md §1): it slides in from the leading edge, from
 *   under ▤, on `smooth` with its contents 12 px behind (they follow on `glide` and fade in), and
 *   slides back out the same way, drawn `inert` until it is gone (`useSidebarMotion`). Nothing
 *   else moves: it floats over the canvas. A reversal mid-flight turns from where the panel is.
 *   Reduced motion: opacity only, on the fade token (100 ms, language.md §7.5).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { formatNumber, m } from '../../i18n';
import {
  LEFT_PANEL_WIDTH,
  type LeftPanelView,
  useStageView,
  useUiStore,
} from '../../state/ui-store';
import { useSelectionStore } from '../../state/selection-store';
import { useActiveDocument, useHasDocuments, useWorkspaceStore } from '../../state/workspace-store';
import { ResizeHandle } from '../../ui/ResizeHandle';
import { Segmented, SegmentedPanel } from '../../ui/Segmented';
import { useSearchStore } from '../../viewer/search';
import { animateStyle, type Motion } from '../../motion/animate';
import { reducedMotion } from '../../motion/reduced-motion';
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
export type SidebarForm = 'floating' | 'overlay' | 'sheet';

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

/** What a shown sidebar was drawn with, kept while it slides out. */
interface FrameProps {
  readonly form: SidebarForm;
  readonly comparing: boolean;
  readonly section: Section;
}

const sameFrame = (a: FrameProps | null, b: FrameProps) =>
  a !== null && a.form === b.form && a.comparing === b.comparing && a.section === b.section;

export function Sidebar({ form = 'floating' }: { readonly form?: SidebarForm }) {
  useTextlessFindDoor();
  const stored = useUiStore((s) => s.leftPanelOpen);
  const view = useUiStore((s) => s.leftPanelView);
  const pagesView = useUiStore((s) => s.pagesView);
  const hasDocuments = useHasDocuments();
  const stage = useStageView();
  // Laid over the page, it shows only once asked for in this window (frame-store).
  const asked = useFrameStore((s) => form === 'floating' || s.overlaySidebarShown);
  const comparing = stage === 'compare';
  const section = sectionOf(view);
  const open =
    asked &&
    sidebarVisible({ open: stored, hasDocuments, stage, section, pagesView }) &&
    (!comparing || view === 'changes');
  // Closed in a document, it slides out first (frame.md §1); leaving the document (the Library,
  // the grid, which is Pages itself) or a change of form takes it at once.
  const current: FrameProps = { form, comparing, section };
  const [shown, setShown] = useState<FrameProps | null>(open ? current : null);
  if (open && !sameFrame(shown, current)) setShown(current);
  const slides = hasDocuments && stage !== 'home' && stage !== 'grid' && shown?.form === form;
  if (!open && shown !== null && !slides) setShown(null);
  const drawn = open ? current : slides ? shown : null;
  if (!drawn) return null;
  return (
    <SidebarFrame
      form={drawn.form}
      comparing={drawn.comparing}
      section={drawn.section}
      leaving={!open}
      onGone={() => setShown(null)}
    />
  );
}

/** How far the contents trail the panel as it slides (frame.md §1), px. */
const PARALLAX_PX = 12;

/**
 * The sidebar's slide (frame.md §1): in from its leading edge on `smooth` as it mounts, out the
 * same way while `leaving`, then `onGone`; its contents trail by `PARALLAX_PX` (on `glide` in,
 * so they arrive a beat after the panel) and fade. Each move starts from where the panel is
 * drawn, so a reversal turns smoothly. Reduced motion: the panel fades on the fade token and
 * nothing moves.
 */
function useSidebarMotion(
  ref: { readonly current: HTMLElement | null },
  form: SidebarForm,
  leaving: boolean,
  onGone: () => void,
): void {
  const slide = useRef<Motion<readonly number[]> | null>(null);
  const body = useRef<Motion<readonly number[]> | null>(null);
  const fade = useRef<Motion | null>(null);
  const gone = useRef(onGone);
  useLayoutEffect(() => {
    gone.current = onGone;
  });
  const entered = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const first = !entered.current;
    entered.current = true;
    // Mounted with its document (a restored session, a document opened with it showing): laid
    // out with it from the start, nothing slides.
    const withDocument = first && !document.querySelector('[data-read-viewport] [data-page-id]');
    if (withDocument) {
      if (leaving) gone.current();
      return undefined;
    }
    if (reducedMotion()) {
      const atFade = fade.current?.value ?? (leaving ? 1 : 0);
      // A fade under reduced motion keeps to REDUCED_FADE, inside 150 ms (motion/animate.ts).
      const opacity = animateStyle(el, 'opacity', atFade, leaving ? 0 : 1, {
        spring: 'quick',
        keep: leaving,
      });
      fade.current = opacity;
      void opacity.finished.then(() => {
        if (fade.current !== opacity) return;
        fade.current = null;
        if (leaving) gone.current();
      });
      return undefined;
    }
    const content = el.firstElementChild as HTMLElement | null;
    const box = el.getBoundingClientRect();
    const away = -(box.width + Math.max(0, box.left)) - 4;
    const at = slide.current?.value[0] ?? (leaving ? 0 : away);
    const velocity = slide.current?.velocity[0] ?? 0;
    const atBody = body.current?.value[0] ?? (leaving ? 0 : -PARALLAX_PX);
    const atFade = fade.current?.value ?? (leaving ? 1 : 0);
    const move = animateStyle(el, 'transform', [at, 0], [leaving ? away : 0, 0], {
      spring: 'smooth',
      velocity: [velocity, 0],
      keep: leaving,
    });
    slide.current = move;
    if (content) {
      body.current = animateStyle(
        content,
        'transform',
        [atBody, 0],
        [leaving ? -PARALLAX_PX : 0, 0],
        { spring: leaving ? 'smooth' : 'glide', keep: leaving },
      );
      fade.current = animateStyle(content, 'opacity', atFade, leaving ? 0 : 1, {
        spring: leaving ? 'quick' : 'smooth',
        keep: leaving,
      });
    }
    void move.finished.then(() => {
      if (slide.current !== move) return;
      slide.current = null;
      body.current = null;
      fade.current = null;
      if (leaving) gone.current();
    });
    return undefined;
  }, [ref, form, leaving]);
}

function SidebarFrame({
  form,
  comparing,
  section,
  leaving,
  onGone,
}: {
  readonly form: SidebarForm;
  readonly comparing: boolean;
  readonly section: Section;
  readonly leaving: boolean;
  readonly onGone: () => void;
}) {
  const width = useUiStore((s) => s.leftPanelWidth);
  const setWidth = useUiStore((s) => s.setLeftPanelWidth);
  const asideRef = useRef<HTMLElement>(null);
  const resting = useRef<number | undefined>(undefined);
  useSidebarMotion(asideRef, form, leaving, onGone);
  // Sliding out, it no longer shows the page selection (S10): Delete and the bars stop acting
  // on it at once, as they did when it unmounted; turned back mid-slide, it shows it again.
  const hidden = useRef<DocumentId | null>(null);
  useLayoutEffect(() => {
    const selection = useSelectionStore.getState();
    if (leaving && selection.navigatorDocument !== null) {
      hidden.current = selection.navigatorDocument;
      selection.setNavigatorDocument(null);
    } else if (!leaving && hidden.current !== null) {
      if (selection.navigatorDocument === null) selection.setNavigatorDocument(hidden.current);
      hidden.current = null;
    }
  }, [leaving]);

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
    if (form === 'floating' || leaving) return;
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
  }, [form, leaving]);

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

  const shownWidth = form === 'floating' ? width : form === 'overlay' ? OVERLAY_WIDTH : SHEET_WIDTH;
  return (
    // Leaving, it is drawn only: inert and out of the regions while it slides away.
    <nav
      id={leaving ? undefined : SIDEBAR_ID}
      ref={asideRef}
      className={styles.sidebar}
      aria-label={m.nav_label()}
      aria-hidden={leaving || undefined}
      inert={leaving}
      data-leaving={leaving ? '' : undefined}
      data-region={leaving ? undefined : 'navigator'}
      data-frame-layer={leaving ? undefined : 'sidebar'}
      data-form={form}
      data-overlay={form === 'floating' ? undefined : ''}
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
      {form === 'floating' ? (
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
        <SegmentedPanel key={value} value={value} className={styles.body} tabIndex={-1}>
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
