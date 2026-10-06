/**
 * The sidebar's slot in the frame (`components/01-frame.md` F1 §2; redesign spec D2-1): the
 * navigator's panel as a layer under the top strip, toggled by ▤ and Mod+B. The rail is gone
 * (D2-1 removes it): its views — Pages (thumbnails, or the outline under "Bookmarks"), Find,
 * Review (comments, redaction marks and form fields in one list) and Files, plus Compare's
 * Changes in the Compare view — are a row of labelled tabs with live counts at the top of the
 * panel, and its shortcuts footer went to the title menu (More with D2-2). The sidebar of
 * D2-4 (`shell/sidebar/`, 06-navigation N1–N6) replaces this panel in the same slot.
 *
 * - **Docked** from expanded up: it insets the free rectangle, so the page re-centres beside
 *   it. **Laid over** the stage on medium (`overlay`): the page does not reflow.
 * - Only in a document: the Library lists the open files itself, so it has no sidebar (and
 *   its strip no ▤). The open state and width persist (`ui:v3`); choosing the open view's tab
 *   again closes the panel, as before.
 * - **Keyboard:** a horizontal tablist with a roving tabindex; Left / Right (Home / End) move
 *   between tabs, Enter / Space choose; Tab moves into the panel. The accessible name carries
 *   the count ("Review, 3 items"). F6 lands on the selected tab (`frame/regions.ts`).
 */
import { type KeyboardEvent, lazy, Suspense, useRef, useState } from 'react';

import { currentPlatform, toAriaKeyShortcut } from '../commands/shortcuts';
import { formatNumber, m } from '../i18n';
import { LEFT_PANEL_WIDTH, type LeftPanelView, useUiStore } from '../state/ui-store';
import { useActiveDocument, useHasDocuments, useWorkspaceStore } from '../state/workspace-store';
import { ResizeHandle } from '../ui/ResizeHandle';
import { useSearchStore } from '../viewer/search';
import { FilesList } from './files/FilesList';
import { SIDEBAR_ID } from './frame/ids';
import styles from './LeftRail.module.css';
import { PagesTab } from './panels/PagesTab';
import { ReviewPanel } from './review/ReviewPanel';
import { countItems, useReadReviewData, useReviewData } from './review/review-items';
import { SearchPanel } from './SearchPanel';
import { useCommandShortcut } from './use-command-shortcut';

interface Tab {
  readonly id: LeftPanelView;
  readonly label: () => string;
}

const TABS: readonly Tab[] = [
  { id: 'pages', label: m.nav_tab_pages },
  { id: 'find', label: m.nav_tab_find },
  { id: 'review', label: m.nav_tab_review },
  { id: 'files', label: m.nav_tab_files },
];

/** Shown only in the Compare view, after the four (spec recognize-and-compare §2.2). */
const CHANGES_TAB: Tab = { id: 'changes', label: m.compare_changes };

// The Changes list loads with the Compare view.
const ChangesPanel = lazy(() => import('../compare/ChangesPanel'));

const TABBABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], summary, [tabindex]';

/** The panel's first control in the Tab order, if any. */
function firstTabbable(panel: HTMLElement | null): HTMLElement | undefined {
  return Array.from(panel?.querySelectorAll<HTMLElement>(TABBABLE) ?? []).find(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0,
  );
}

/** Badge text: hidden at 0, "99+" above 99. */
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count > 99 ? `${formatNumber(99)}+` : formatNumber(count);
}

/** Live counts per tab: pages, matches of the current search, review items, open files. */
function useTabCounts(): Readonly<Partial<Record<LeftPanelView, number>>> {
  const doc = useActiveDocument();
  const files = useWorkspaceStore((s) => s.workspace.documentOrder.length);
  const matches = useSearchStore((s) => (s.documentId === doc?.id ? s.hits.length : 0));
  useReadReviewData();
  const review = countItems(useReviewData().items).all;
  return { pages: doc?.pages.length ?? 0, find: matches, review, files };
}

export function LeftRail({ overlay = false }: { readonly overlay?: boolean }) {
  const stored = useUiStore((s) => s.leftPanelOpen);
  const view = useUiStore((s) => s.leftPanelView);
  const hasDocuments = useHasDocuments();
  const onLibrary = useUiStore((s) => s.destination === 'home');
  const comparing = useUiStore((s) => s.destination === 'compare');
  const open = stored && hasDocuments && !onLibrary;
  if (!open) return null;
  return <Sidebar view={view} comparing={comparing} overlay={overlay} />;
}

function Sidebar({
  view,
  comparing,
  overlay,
}: {
  readonly view: LeftPanelView;
  readonly comparing: boolean;
  readonly overlay: boolean;
}) {
  const width = useUiStore((s) => s.leftPanelWidth);
  const showView = useUiStore((s) => s.showLeftPanelView);
  const setWidth = useUiStore((s) => s.setLeftPanelWidth);
  const toggleShortcut = useCommandShortcut('view.toggleLeftPanel');
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabs = comparing ? [...TABS, CHANGES_TAB] : TABS;
  // A view only Compare offers falls back to Pages outside it.
  const shown = tabs.some((t) => t.id === view) ? view : 'pages';
  const counts = useTabCounts();

  // Roving tabindex: the tab last moved to with the arrows, else the shown view's tab.
  const [roving, setRoving] = useState<LeftPanelView | null>(null);
  const stop = [roving, shown].find((id) => tabs.some((t) => t.id === id)) ?? tabs[0]?.id;
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    // Tab from a tab goes into the panel (APG tabs).
    if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey) {
      const first = firstTabbable(document.getElementById(`${SIDEBAR_ID}-body`));
      if (!first) return;
      event.preventDefault();
      first.focus();
      return;
    }
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const index = tabs.findIndex((t) => `rail-${t.id}` === event.currentTarget.id);
    if (index < 0) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    const id = tabs[next]?.id;
    if (id === undefined) return;
    setRoving(id);
    tabsRef.current?.querySelector<HTMLElement>(`#rail-${id}`)?.focus();
  };

  const keys = toggleShortcut ? toAriaKeyShortcut(toggleShortcut, currentPlatform) : undefined;

  return (
    <aside
      id={SIDEBAR_ID}
      className={styles.sidebar}
      aria-label={m.nav_label()}
      data-region="navigator"
      data-frame-layer="sidebar"
      data-overlay={overlay || undefined}
      style={{ width }}
    >
      <div
        ref={tabsRef}
        role="tablist"
        aria-orientation="horizontal"
        aria-label={m.nav_views_label()}
        className={styles.tabs}
      >
        {tabs.map(({ id, label }) => {
          const selected = shown === id;
          const count = counts[id] ?? 0;
          // Matches and review items show as counts; the page count is the pill's and the
          // file count the tabs' (both stay in the tab's name).
          const badge = id === 'find' || id === 'review' ? badgeText(count) : '';
          return (
            <button
              key={id}
              type="button"
              id={`rail-${id}`}
              role="tab"
              aria-label={count > 0 ? m.nav_count_name({ label: label(), count }) : label()}
              aria-selected={selected}
              aria-controls={selected ? `${SIDEBAR_ID}-body` : undefined}
              aria-keyshortcuts={selected ? keys : undefined}
              tabIndex={stop === id ? 0 : -1}
              className={styles.tab}
              data-tab={id}
              onKeyDown={onTabKeyDown}
              onClick={() => {
                setRoving(null);
                showView(id);
              }}
            >
              <span aria-hidden="true">{label()}</span>
              {badge !== '' ? (
                <span className={styles.badge} aria-hidden="true" data-testid={`rail-count-${id}`}>
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <section
        id={`${SIDEBAR_ID}-body`}
        role="tabpanel"
        aria-labelledby={`rail-${shown}`}
        className={styles.panelBody}
        data-view={shown}
      >
        {shown === 'pages' ? <PagesTab /> : null}
        {shown === 'find' ? <SearchPanel /> : null}
        {shown === 'review' ? <ReviewPanel /> : null}
        {shown === 'files' ? <FilesList /> : null}
        {shown === 'changes' && comparing ? (
          <Suspense fallback={null}>
            <ChangesPanel />
          </Suspense>
        ) : null}
      </section>
      <ResizeHandle
        label={m.nav_resize()}
        controls={SIDEBAR_ID}
        value={width}
        min={LEFT_PANEL_WIDTH.min}
        max={LEFT_PANEL_WIDTH.max}
        direction={1}
        onChange={setWidth}
      />
    </aside>
  );
}
