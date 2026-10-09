/**
 * The document tabs (`components/01-frame.md` F4): switch between open documents and show
 * each one's state, in one order with the Library's cards (`documentOrder`, INV-19). APG Tabs
 * with automatic activation, as before (XD-3's strip carries over: the tab list never narrower
 * than one tab at its minimum, names ending in an ellipsis with the full name as tooltip and
 * accessible name, the faded edges of `use-tablist-edges.ts` should the list ever scroll).
 *
 * - **The active tab is the title menu's trigger** (RA-9): a click, Enter or Space on it opens
 *   the title menu (F5); on an inactive tab they activate it and focus stays there. On the
 *   Library no tab is selected and a click shows the document. F2 opens the title menu with
 *   its name field focused; a double-click no longer renames (spec 01.4).
 * - **Keys:** Left / Right, Home / End move focus and activate, across every open document,
 *   overflowed ones included (they come into the strip as they become active); Delete closes.
 *   Right-click, a long press or Shift+F10 opens the tab menu (`TabMenu.tsx`).
 * - **State:** ● after the name while the changes are not yet in the file (kept on this
 *   device, X13); a lock glyph while locked (the reason is in the tab's name and the title
 *   menu, A-19: never a tint); the signature glyph on signed files; ▾ on the active tab.
 * - **Names** truncate gracefully (owner feedback F4): a name ending in a parenthetical or a
 *   number ("report (extract)", "scan 2") keeps that ending and cuts its middle, "report…
 *   (extract)", so two tabs of one family stay told apart; others end in an ellipsis. In a
 *   strip short of room (tabs in "N more"), the grid's page count leaves the active tab first.
 * - **Overflow** (01.Q1): the visible tabs are measured against the room the strip leaves;
 *   when they would fall under 112 px (128 coarse), the rest go into "N more ▾"
 *   (`TabOverflow.tsx`, `tab-overflow.ts`).
 * - **Drag** a tab along the strip to reorder: it lifts, its neighbours slide aside, and the
 *   tabs FLIP into their new order on drop (`tab-reorder.ts`).
 * - **Close** asks nothing; focus goes to the next tab to the right, else the left, else the
 *   Library's first focus; announced, with the changes kept (F4 §6).
 */
import type { DocumentId } from '@pdf-editor/document-model';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { openFilesFromPicker } from '../../commands/app-commands';
import { showTab } from '../../home/home-actions';
import { m } from '../../i18n';
import { restingWidth } from '../../motion/resize';
import { SignatureTabGlyph } from '../../signatures/SignatureBadge';
import { useLockStore } from '../../state/lock-store';
import { matchesMark, useSavedStore } from '../../state/saved-store';
import {
  pagesPhrase,
  type TabItem,
  useTabItems,
  useWorkspaceStore,
} from '../../state/workspace-store';
import { IconButton } from '../../ui/IconButton';
import { announce } from '../announcer';
import { useCommandShortcut } from '../use-command-shortcut';
import { useTablistEdges } from '../use-tablist-edges';
import { openTitleMenu, useFrameStore } from './frame-store';
import { STAGE_ID, tabDomId } from './ids';
import { nameEnding, splitTabs, TAB_GAP_FINE, tabCapacity } from './tab-overflow';
import { closedTabs, type LeavingTab, useTabMotion, withLeaving } from './tab-motion';
import { useTabReorder } from './tab-reorder';
import { TabMenu } from './TabMenu';
import { TabOverflow } from './TabOverflow';
import styles from './TopStrip.module.css';
import { Icon } from '../../ui/Icon';
import { reducedMotion } from '../../motion/reduced-motion';

/** The active tab's description: it opens the document menu (F4 §5). */
const MENU_HINT_ID = 'tab-document-menu-hint';

/** Until the overflow chip has rendered once, its width is taken as this (EN "3 more ▾"). */
const CHIP_ESTIMATE = 96;

/** Reads a length custom property (`--tab-min`) of `element` in CSS px. */
function lengthVar(element: Element, name: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * The widest the tab region may grow inside the leading piece (TopStrip.module.css): the piece
 * at its maximum (`--lead-max`, and never closer to the trailing piece than the strip's gap)
 * less what else the piece holds (◆ ▤, the grid's page count, its padding and gaps).
 */
function tabRoom(
  region: HTMLElement,
  piece: HTMLElement,
  strip: HTMLElement,
  trail: HTMLElement | null,
): number {
  const style = getComputedStyle(strip);
  const inner =
    strip.clientWidth -
    (Number.parseFloat(style.paddingLeft) || 0) -
    (Number.parseFloat(style.paddingRight) || 0);
  const between = Number.parseFloat(style.columnGap) || 0;
  const widest = Math.min(
    lengthVar(strip, '--lead-max', inner),
    inner - (trail ? restingWidth(trail) + between : 0),
  );
  // A piece whose width is moving (motion/resize.ts) is read where it is going.
  return widest - (restingWidth(piece) - region.offsetWidth);
}

/** Whether two runs of tabs show the same documents in the same order. */
const sameTabs = (a: readonly TabItem[], b: readonly TabItem[]): boolean =>
  a.length === b.length && a.every((t, i) => t.id === b[i]?.id);

/** Focus the Library's first focus after the last tab closes (F4 §6). */
function focusLibrary(): void {
  requestAnimationFrame(() =>
    document.querySelector<HTMLElement>('[data-testid="home-button"], #open-files-button')?.focus(),
  );
}

export function DocumentTabs({
  onLibrary,
  pageCount,
  after,
}: {
  readonly onLibrary: boolean;
  /**
   * The Pages grid's title (owner feedback 2026-10-08, F1; 06-navigation PG2 §2): the selected
   * tab carries the page count after its name, where the grid's header band showed it.
   */
  readonly pageCount?: number | undefined;
  /** A note after the tabs, before + (the grid's "Sources: …" of a Combine's result). */
  readonly after?: ReactNode;
}) {
  const documents = useTabItems();
  const activeId = useWorkspaceStore((s) => s.workspace.activeDocument ?? null);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const closeDocument = useWorkspaceStore((s) => s.closeDocument);
  const workspace = useWorkspaceStore((s) => s.workspace);
  const marks = useSavedStore((s) => s.marks);
  const locks = useLockStore((s) => s.locks);
  const menuOpen = useFrameStore((s) => s.titleMenu !== null);
  const edgesRef = useTablistEdges();
  const listRef = useRef<HTMLDivElement | null>(null);
  const tablistRef = useCallback(
    (list: HTMLDivElement | null) => {
      listRef.current = list;
      const off = edgesRef(list);
      return () => {
        listRef.current = null;
        off?.();
      };
    },
    [edgesRef],
  );
  const regionRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(Number.POSITIVE_INFINITY);

  // How many tabs fit: the room the floating pieces leave the region (TopStrip.module.css),
  // less + (and the chip when it shows). The region hugs its tabs, so its own width is not the
  // room: that is the leading piece at its widest less the piece's other parts (`tabRoom`).
  useLayoutEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const piece = region.closest<HTMLElement>('[data-top-piece]');
    const strip = piece?.parentElement ?? null;
    const trail = strip?.querySelector<HTMLElement>('[data-top-piece="trail"]') ?? null;
    const measure = () => {
      const plus = region.querySelector<HTMLElement>('[data-strip-open]');
      const chip = region.querySelector<HTMLElement>('[data-testid="tab-overflow"]');
      const gap = lengthVar(region, '--tab-gap', TAB_GAP_FINE);
      const width = piece && strip ? tabRoom(region, piece, strip, trail) : region.clientWidth;
      const note = region.querySelector<HTMLElement>('[data-strip-note]');
      const room =
        width - (plus ? plus.offsetWidth + 8 : 0) - (note ? note.offsetWidth + 4 : 0) - 4;
      const fit = tabCapacity(
        documents.length,
        room,
        lengthVar(region, '--tab-min', 112),
        gap,
        chip ? chip.offsetWidth : CHIP_ESTIMATE,
      );
      // All fit: no limit, so a tab opened next shows in the commit that opens it (and grows
      // in, tab-motion.ts) instead of first pushing another into "N more" until this re-measures.
      const next = fit >= documents.length ? Number.POSITIVE_INFINITY : fit;
      setCapacity((previous) => (previous === next ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(region);
    for (const el of [piece, strip, trail]) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [documents.length]);

  const activeIndex = documents.findIndex((d) => d.id === activeId);
  const { visible, overflow } = splitTabs(documents, activeIndex, capacity);
  const edited = new Set(
    documents.filter((d) => !matchesMark(workspace, d.id, marks[d.id])).map((d) => d.id),
  );

  // A closed tab stays drawn while it collapses (tab-motion.ts; G6): derived as the tabs
  // change, during render, so its first frame out is already in the commit that closed it.
  const [shown, setShown] = useState<readonly TabItem[]>(visible);
  const [leaving, setLeaving] = useState<readonly LeavingTab<TabItem>[]>([]);
  if (!sameTabs(shown, visible)) {
    setShown(visible);
    const closed = reducedMotion() ? [] : closedTabs(shown, visible, documents);
    const kept = leaving.filter((t) => !visible.some((v) => v.id === t.item.id));
    if (closed.length > 0 || kept.length !== leaving.length) setLeaving([...kept, ...closed]);
  }
  const selectedId = onLibrary ? null : activeId;
  useTabMotion(listRef, selectedId, (id) =>
    setLeaving((current) => current.filter((t) => t.item.id !== id)),
  );
  // A tab dragged along the strip reorders the tabs (motion-2026-10 frame.md §7).
  useTabReorder(listRef, documents.length > 1);

  // Keep the active tab in view should the list scroll (XD-3).
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(tabDomId(activeId))?.scrollIntoView?.({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeId]);

  const focusTab = (id: DocumentId) => {
    setActive(id);
    requestAnimationFrame(() => document.getElementById(tabDomId(id))?.focus());
  };

  const closeTab = (id: DocumentId, refocus: boolean) => {
    const index = documents.findIndex((d) => d.id === id);
    const doc = documents[index];
    if (!doc) return;
    closeDocument(id);
    announce(m.frame_closed_kept({ name: doc.title }));
    if (!refocus) return;
    const next = documents[index + 1] ?? documents[index - 1];
    if (next) focusTab(next.id);
    else focusLibrary();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: DocumentId) => {
    const index = documents.findIndex((d) => d.id === id);
    if (index < 0) return;
    let target: number | null = null;
    if (event.key === 'ArrowRight') target = (index + 1) % documents.length;
    else if (event.key === 'ArrowLeft') target = (index - 1 + documents.length) % documents.length;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = documents.length - 1;
    else if (event.key === 'F2') {
      event.preventDefault();
      showTab(id);
      openTitleMenu('name');
      return;
    } else if (event.key === 'Delete') {
      event.preventDefault();
      closeTab(id, true);
      return;
    }
    if (target === null) return;
    event.preventDefault();
    const doc = documents[target];
    if (doc) focusTab(doc.id);
  };

  const onClick = (id: DocumentId) => {
    // The active tab is the document menu's trigger (RA-9); on the Library it shows the
    // document, in the view it was last shown in.
    if (id === activeId && !onLibrary) {
      openTitleMenu('menu');
      return;
    }
    showTab(id);
  };

  const onMouseDown = (event: MouseEvent, id: DocumentId) => {
    // Middle click closes, as in browsers.
    if (event.button !== 1) return;
    event.preventDefault();
    closeTab(id, false);
  };

  return (
    <div
      ref={regionRef}
      className={styles.tabsRegion}
      data-empty={documents.length === 0 || undefined}
    >
      {documents.length > 0 ? (
        <div ref={tablistRef} role="tablist" aria-label={m.tabs_label()} className={styles.tablist}>
          {withLeaving(visible, leaving).map(({ item: doc, leaving: gone }) => {
            if (gone) return <LeavingTabView key={`leaving-${doc.id}`} doc={doc} />;
            const active = doc.id === activeId;
            const selected = active && !onLibrary;
            const isEdited = edited.has(doc.id);
            const lock = locks[doc.id];
            const name =
              isEdited && lock
                ? m.frame_tab_name_edited_locked({ name: doc.title })
                : lock
                  ? m.frame_tab_name_locked({ name: doc.title })
                  : isEdited
                    ? m.tab_name_edited({ name: doc.title })
                    : undefined;
            return (
              <TabMenu
                key={doc.id}
                documentId={doc.id}
                title={doc.title}
                onClose={(id) => closeTab(id, true)}
              >
                <div
                  className={styles.tabWrap}
                  data-selected={selected || undefined}
                  data-tab-id={doc.id}
                >
                  {/* The selection's fill, which slides from tab to tab (tab-motion.ts). */}
                  <span className={styles.tabFill} data-tab-fill="" aria-hidden="true" />
                  {/* A `tab` (APG tabs, F4), which ui/Button is not: the strip's own control. */}
                  <button
                    type="button"
                    role="tab"
                    id={tabDomId(doc.id)}
                    aria-selected={selected}
                    aria-controls={STAGE_ID}
                    aria-keyshortcuts="Delete F2"
                    aria-label={name}
                    aria-describedby={selected ? MENU_HINT_ID : undefined}
                    aria-haspopup={selected ? 'dialog' : undefined}
                    aria-expanded={selected ? menuOpen : undefined}
                    tabIndex={active ? 0 : -1}
                    // eslint-disable-next-line recto/q9-controls
                    className={styles.tab}
                    title={doc.title}
                    data-edited={isEdited || undefined}
                    data-locked={lock}
                    // The active tab opens the document menu (RA-9): today's test hook.
                    data-testid={selected ? 'document-menu' : undefined}
                    onKeyDown={(event) => onKeyDown(event, doc.id)}
                    onClick={() => onClick(doc.id)}
                    onMouseDown={(event) => onMouseDown(event, doc.id)}
                  >
                    <span className={styles.tag} data-tag={doc.colorIndex} aria-hidden="true" />
                    {/* A new name fades in (G6): keyed by it, so a rename draws it afresh. */}
                    <TabName key={doc.title} title={doc.title} />
                    {/* The grid's count gives way first when the strip runs short of room
                        (owner feedback F4): the name is what tells the tabs apart. */}
                    {selected && pageCount !== undefined && overflow.length === 0 ? (
                      <span
                        className={styles.count}
                        aria-hidden="true"
                        data-testid="grid-title-count"
                      >
                        {pagesPhrase(pageCount)}
                      </span>
                    ) : null}
                    {isEdited ? (
                      <span
                        className={styles.edited}
                        title={m.tab_edited_hint()}
                        aria-hidden="true"
                        data-testid="tab-edited"
                      />
                    ) : null}
                    {lock ? (
                      <Icon
                        name="lock-simple"
                        className={styles.lock}
                        aria-hidden="true"
                        data-testid="tab-lock"
                      />
                    ) : null}
                    <SignatureTabGlyph documentId={doc.id} />
                    {selected ? (
                      <Icon name="caret-down" className={styles.caret} aria-hidden="true" />
                    ) : null}
                    {/* Closing by keyboard is Delete or the tab menu; ✕ is the pointer's (APG):
                        hidden from assistive technology and never focusable, so it may sit in
                        the tab's own row, right after the name, where every tab puts it. */}
                    <span
                      aria-hidden="true"
                      className={styles.close}
                      title={m.frame_close_name({ name: doc.title })}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeTab(doc.id, false);
                      }}
                    >
                      <Icon name="x" />
                    </span>
                  </button>
                </div>
              </TabMenu>
            );
          })}
        </div>
      ) : null}
      <span id={MENU_HINT_ID} className="visually-hidden">
        {m.frame_document_menu()}
      </span>
      <TabOverflow tabs={overflow} edited={edited} />
      {after ? (
        <span data-strip-note="" className={styles.note}>
          {after}
        </span>
      ) : null}
      <div data-strip-open="" className={styles.openSlot}>
        <OpenButton />
      </div>
    </div>
  );
}

/**
 * A closed tab while it collapses (tab-motion.ts): its tag and name only, `inert` and hidden
 * from assistive technology from its first frame, so the tab list names only open documents.
 */
function LeavingTabView({ doc }: { readonly doc: TabItem }) {
  return (
    <div className={styles.tabWrap} data-tab-id={doc.id} data-leaving="" aria-hidden="true" inert>
      <span className={styles.tab}>
        <span className={styles.tag} data-tag={doc.colorIndex} />
        <TabName title={doc.title} />
      </span>
    </div>
  );
}

/** The tab's name: one end ellipsis, or a middle cut that keeps its ending (`nameEnding`). */
function TabName({ title }: { readonly title: string }) {
  const split = nameEnding(title);
  if (split === null) return <span className={styles.name}>{title}</span>;
  return (
    <span className={styles.nameSplit}>
      <span className={styles.name}>{split.head}</span>
      <span className={styles.nameTail}>{split.tail}</span>
    </span>
  );
}

/** + Open (F3): the file picker, Mod+O. */
function OpenButton() {
  const shortcut = useCommandShortcut('file.open');
  return (
    <IconButton
      id="open-files-button"
      label={m.open_files()}
      icon={<Icon name="plus" />}
      shortcut={shortcut}
      onClick={() => void openFilesFromPicker()}
    />
  );
}
