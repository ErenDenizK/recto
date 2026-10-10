/**
 * The Pages grid (`components/06-navigation.md` PG1–PG5; flows.md §2.1; spec D2-5): the
 * document's pages, or every open document as sections, at thumbnail size, to select, move,
 * rotate, delete, extract and combine. M8's light table (docs/specs/light-table.md) kept and
 * routed by `docUi[id].surface === 'grid'`; the file keeps its name (spec X25).
 *
 * One scroll container with a stack of sections (the active document in This document, each
 * open document in All open), each a virtualized grid of page cells; its controls float as
 * glass pieces over it (`grid/GridPieces.tsx`), with no header band. TanStack Virtual picks the
 * rendered range over a flat list of header / row / gap items; positions come from
 * `dnd/geometry.ts`, which also does hit testing, so drops and marquees work on rows that are
 * not in the DOM. The scroller reaches under the strip's pieces and the Pages bar; the first
 * row rests below the pieces and the last clears the bar by 16 px (PG1 §2).
 *
 * Interaction (PG1 §6, PG4 §6, owner feedback F4: the Photos model):
 * - Outside selection mode a click or a tap opens the page (`leaveGrid`), on its own tab, as
 *   Enter does. Selection mode (`gridSelecting`) starts from the Pages bar's Select, a long
 *   press released in place (touch), Shift- or Mod-click, the check circle a fine pointer's
 *   hover shows, Space, or a marquee; in it a click or a tap toggles, Shift ranges within a
 *   section, and Done or Esc ends it. Selection spans sections.
 * - A press on empty canvas draws a marquee (mouse and pen; additive with Shift or Mod) with
 *   edge auto-scroll.
 * - Keys: arrows move focus (wrapping across rows and sections), Shift+arrows extend, Space
 *   toggles, Home/End, Alt+arrows move pages one slot, Alt+Shift+arrows move to the row
 *   (left/right) or section (up/down) edge. Clipboard (Mod+X/C/V), Delete, Mod+D, Mod+A and
 *   Esc (clear the selection, then leave the grid) are commands.
 * - Mod+wheel (and a trackpad pinch) steps the cell size; a pinch steps it by detent and, past
 *   the largest size, opens the page under the fingers (`grid/pinch-in-grid.ts`).
 * - Drag and drop: the mouse on @atlaskit/pragmatic-drag-and-drop (pages between gaps, Alt
 *   copies; tabs onto the grid show All open; OS files onto a section insert at the gap or, on
 *   the background, open as documents through the shell's window-wide drop); touch and pen on
 *   the gesture core's pointer path after a lift (`grid/grid-pointer-drag.ts`, §2.4).
 * - Moves, drops, size steps and collapses reflow the cells by FLIP (`grid/flip-cells.tsx`).
 */
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { autoScrollForExternal } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/external';
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/adapter/drop-target-for-external';
import {
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter';
import { monitorForExternal } from '@atlaskit/pragmatic-drag-and-drop/adapter/monitor-for-external';
import type { DragLocation } from '@atlaskit/pragmatic-drag-and-drop/types';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/utils/combine';
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/utils/contains-files';
import { ContextMenu } from '@base-ui/react/context-menu';
import type { DocumentId, PageId, Size, Workspace } from '@pdf-editor/document-model';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { arrangeSizeMessage, moveSelectionBy } from '../commands/app-commands';
import { currentPlatform } from '../commands/shortcuts';
import {
  type DropHighlight,
  setDragSession,
  setDropHighlight,
  useDragSession,
  useDropHighlight,
} from '../dnd/drag-store';
import { insertFilesAt, showInArrange, transferPages } from '../dnd/drop';
import {
  type ArrangeLayout,
  boxAspectOf,
  cellsInRect,
  computeLayout,
  edgeScrollSpeed,
  gapAt,
  type GridMetrics,
  gridMetrics,
  normalizeRect,
  rowItemIndex,
} from '../dnd/geometry';
import { isPageDrag, isTabDrag } from '../dnd/page-drag';
import { filesFromItems, isOpenableFile } from '../files/open-files';
import { m } from '../i18n';
import { displaySize } from '../pages/page-geometry';
import { announce } from '../shell/announcer';
import {
  clickSelection,
  extendSelection,
  gridSelecting,
  marqueeSelection,
  sameSelection,
  type SelectionSnapshot,
  selectionSnapshot,
  toggleSelection,
  useSelectionStore,
} from '../state/selection-store';
import { ARRANGE_SIZES, useUiStore } from '../state/ui-store';
import { useSheetStore } from '../ui/sheet';
import { useViewStore } from '../state/view-store';
import { useActiveDocument, useWorkspaceStore } from '../state/workspace-store';
import { type MoveEdge, movePagesToEdge } from './arrange-actions';
import { provideArrangeColumns } from './arrange-commands';
import { pageIndexes, type ShownSection, useShownSections } from './arrange-data';
import { ArrangeContextMenuPopup } from './ArrangeContextMenu';
import { ArrangeSection } from './ArrangeSection';
import styles from './ArrangeView.module.css';
import { noteDropOrigin } from './grid/cells';
import { FlipCells, playCells } from './grid/flip-cells';
import { gridMotion } from './grid/grid-motion';
import { GridLockNotice } from './grid/grid-lock-notice';
import { attachGridPointerDrag } from './grid/grid-pointer-drag';
import { leaveGrid, takeGridReveal } from './grid/grid-transition';
import { GridPinchChip, useGridPinch } from './grid/pinch-in-grid';

/** Wheel delta that steps the cell size once with Mod+Scroll. */
const WHEEL_STEP = 60;
/** Pointer travel before a press on empty space becomes a marquee. */
const MARQUEE_THRESHOLD = 4;
/** Collapsed sections expand after hovering a drag over them this long (spec §3). */
const EXPAND_DELAY_MS = 600;
/** Room between the last row and the Pages bar (PG1 §2). */
const BAR_CLEARANCE = 16;
/** Room above the first row when no section header stands there (This document). */
const PAD_TOP_PLAIN = 24;

const NAV_KEYS: readonly string[] = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
];

function isMod(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return currentPlatform === 'mac' ? event.metaKey : event.ctrlKey;
}

/** How far the scroller reaches beyond the stage, under the strip's pieces and the dock band. */
interface Overhang {
  readonly top: number;
  readonly bottom: number;
}

/**
 * How far the scroller reaches under the strip's floating pieces and the dock band
 * (`ArrangeView.module.css`): the free rectangle's top and bottom insets, which the frame writes
 * on `:root` (01-frame F1 §2), so cells pass beneath the glass at both ends and rest clear of it.
 */
function useBandOverhang(viewport: RefObject<HTMLElement | null>): Overhang {
  const [overhang, setOverhang] = useState<Overhang>({ top: 0, bottom: 0 });
  useLayoutEffect(() => {
    const read = () => {
      const el = viewport.current;
      if (!el) return;
      const style = getComputedStyle(el);
      const reach = (margin: string) => {
        const value = Number.parseFloat(margin);
        return Number.isFinite(value) ? Math.max(0, -value) : 0;
      };
      const top = reach(style.marginTop);
      const bottom = reach(style.marginBottom);
      setOverhang((previous) =>
        previous.top === top && previous.bottom === bottom ? previous : { top, bottom },
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', read);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', read);
    };
  }, [viewport]);
  return overhang;
}

/**
 * How much of the grid's width a side tool sheet covers (Split, S13; spec X23): tool sheets
 * inset the free rectangle while at least 400 px of stage remain, so the columns re-centre in
 * what is left and no cell sits under the sheet.
 */
function useToolSheetInset(viewport: RefObject<HTMLElement | null>): number {
  const front = useSheetStore((s) => s.front);
  const [inset, setInset] = useState(0);
  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el || front === null) return;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let tries = 0;
    // The sheet's portal mounts it a frame or so after the store names it.
    const attach = () => {
      const sheet = document.querySelector<HTMLElement>(
        `[data-sheet="${CSS.escape(front)}"][data-kind="tool"][data-presentation="side"]`,
      );
      if (!sheet) {
        setInset(0);
        if (tries++ < 20) frame = requestAnimationFrame(attach);
        return;
      }
      const measure = () => {
        // Its layout width (a transform in flight is motion), its 8 px from the edge and 8 more.
        const covered = sheet.offsetWidth + 16;
        setInset(el.clientWidth - covered >= 400 ? covered : 0);
      };
      measure();
      observer = new ResizeObserver(measure);
      observer.observe(sheet);
      observer.observe(el);
    };
    frame = requestAnimationFrame(attach);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [viewport, front]);
  return front === null ? 0 : inset;
}

export function ArrangeView() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const stepArrangeSize = useUiStore((s) => s.stepArrangeSize);
  const backgroundTarget = useDropHighlight((s) => s.highlight?.kind === 'background');
  const scope = useUiStore((s) => s.gridScope);
  const documents = useWorkspaceStore((s) => s.workspace.documentOrder.length);
  const doc = useActiveDocument();
  const overhang = useBandOverhang(viewportRef);
  const inset = useToolSheetInset(viewportRef);
  const pinchChip = useRef<HTMLDivElement>(null);
  useGridPinch(viewportRef, pinchChip);

  // Measured in a layout effect so the grid's first rows are drawn in the commit that shows it:
  // the view change names a cell inside its update callback (grid-transition.ts).
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Mod+Scroll (and a trackpad pinch, which arrives as Ctrl+wheel) steps the cell size
  // (non-passive: it must cancel the browser's zoom).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let accumulated = 0;
    const onWheel = (event: WheelEvent) => {
      if (!isMod(event) && !event.ctrlKey) return;
      event.preventDefault();
      accumulated += event.deltaY;
      if (Math.abs(accumulated) < WHEEL_STEP) return;
      const direction = accumulated < 0 ? 1 : -1;
      accumulated = 0;
      if (stepArrangeSize(direction)) announce(arrangeSizeMessage());
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [stepArrangeSize]);

  const all = scope === 'all' && documents > 1;
  const label = all
    ? m.grid_region_label_all({ count: documents })
    : m.grid_region_label({ title: doc?.title ?? '' });

  return (
    <section className={styles.frame} aria-label={label} data-pages-grid="">
      <div
        ref={viewportRef}
        className={styles.viewport}
        data-testid="light-table"
        data-grid-viewport=""
      >
        {width - inset > 0 ? (
          <LightTable
            width={width - inset}
            viewportRef={viewportRef}
            padBottom={overhang.bottom + BAR_CLEARANCE}
            overTop={overhang.top}
            overBottom={overhang.bottom}
          />
        ) : null}
      </div>
      {backgroundTarget ? (
        <div className={styles.backgroundOutline} aria-hidden="true">
          <span className={styles.dropLabel}>{m.arrange_drop_background()}</span>
        </div>
      ) : null}
      <GridPinchChip ref={pinchChip} />
      <GridLockNotice />
    </section>
  );
}

interface TableState {
  readonly layout: ArrangeLayout<DocumentId>;
  readonly metrics: GridMetrics;
  readonly sections: readonly ShownSection[];
}

interface MarqueeDrag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly additive: boolean;
  readonly base: SelectionSnapshot;
  clientX: number;
  clientY: number;
  moved: boolean;
  frame: number;
}

/** Where a pointer at `location` would drop, for the given drag kind. */
function dropHighlightAt(
  location: DragLocation,
  state: TableState,
  kind: 'pages' | 'files' | 'tab',
): DropHighlight | null {
  const target = location.dropTargets[0];
  if (target === undefined) return null;
  if (target.data.type === 'background') return { kind: 'background' };
  if (target.data.type !== 'section') return null;
  const id = target.data.documentId as DocumentId;
  const section = state.layout.sections.find((s) => s.id === id);
  if (section === undefined) return null;
  if (kind === 'tab' || section.collapsed) return { kind: 'section', section: id };
  const rect = target.element.getBoundingClientRect();
  const gap = gapAt(
    state.metrics,
    section.count,
    location.input.clientX - rect.left,
    location.input.clientY - rect.top - (section.gridTop - section.top),
  );
  return {
    kind: 'gap',
    section: id,
    gap,
    duplicate: kind === 'pages' && location.input.altKey,
    files: kind === 'files',
  };
}

interface GridShape {
  readonly boxAspect: number;
  readonly items: number;
}

const shapes = new WeakMap<Workspace, Map<string, GridShape>>();

/**
 * What the grid's cells are sized to (plan E6a; system-audit-2026-10 I-34): the thumbnail box
 * from the tallest page shown (`boxAspectOf`), and the longest section, which the columns
 * centre on. Collapsed sections count too, so expanding one moves nothing sideways. Kept per
 * workspace, so a scroll's render does not walk every page again.
 */
function gridShape(ws: Workspace, sections: readonly ShownSection[]): GridShape {
  const key = sections.map((s) => s.doc.id).join(',');
  let byKey = shapes.get(ws);
  if (byKey === undefined) {
    byKey = new Map();
    shapes.set(ws, byKey);
  }
  const known = byKey.get(key);
  if (known) return known;
  let items = 0;
  const sizes: Size[] = [];
  for (const { doc } of sections) {
    items = Math.max(items, doc.pages.length);
    for (const page of doc.pages) sizes.push(displaySize(ws, page));
  }
  const shape = { boxAspect: boxAspectOf(sizes), items };
  byKey.set(key, shape);
  return shape;
}

/** The scroll offset that centres page `index` of section `section` (the entrance's reveal). */
function revealOffset(
  layout: ArrangeLayout<DocumentId>,
  metrics: GridMetrics,
  section: number,
  index: number,
  viewportHeight: number,
  over: Overhang,
): number {
  const sectionLayout = layout.sections[section];
  if (!sectionLayout) return 0;
  const row = sectionLayout.count === 0 ? 0 : Math.floor(index / Math.max(1, metrics.columns));
  const top = sectionLayout.gridTop + row * metrics.rowHeight;
  // Centred in what the glass leaves clear, not in the scroller that runs under it.
  const clear = viewportHeight - over.top - over.bottom;
  const centred = top - over.top - (clear - metrics.rowHeight) / 2;
  return Math.max(0, Math.min(centred, layout.totalHeight - viewportHeight));
}

function LightTable({
  width,
  viewportRef,
  padBottom,
  overTop,
  overBottom,
}: {
  readonly width: number;
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly padBottom: number;
  /** How far the scroller runs under the strip's pieces: the first row rests below them. */
  readonly overTop: number;
  readonly overBottom: number;
}) {
  'use no memo'; // TanStack Virtual mutates its instance; the React Compiler must not cache it.
  const sections = useShownSections();
  const ws = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  const setActive = useWorkspaceStore((s) => s.setActive);
  const arrangeSize = useUiStore((s) => s.arrangeSize);
  const focused = useSelectionStore((s) => s.focused);
  const apply = useSelectionStore((s) => s.apply);
  const currentIndex = useViewStore((s) => s.currentPage);
  const dragging = useDragSession((s) => s.session !== null);
  const tableRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<MarqueeDrag | null>(null);
  const scrollFocusPending = useRef(false);
  /** Selection mode (PG4 §6): taps toggle, the check circles show. */
  const selecting = useSelectionStore(gridSelecting);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null,
  );
  const [menuPage, setMenuPage] = useState<PageId | null>(null);

  const cellWidth = (ARRANGE_SIZES[arrangeSize] ?? ARRANGE_SIZES[1]).width;
  const shape = gridShape(ws, sections);
  const metrics = gridMetrics(width, cellWidth, {
    centre: true,
    items: shape.items,
    boxAspect: shape.boxAspect,
  });
  const specs = sections.map((s) => ({
    id: s.doc.id,
    count: s.doc.pages.length,
    collapsed: s.collapsed,
    header: s.header,
  }));
  // This document has no section header: the first row keeps a header's air above it.
  const padTop = overTop + (sections[0]?.header === false ? PAD_TOP_PLAIN : 8);
  const layout = computeLayout(specs, metrics, padBottom, padTop);
  const el = viewportRef.current;
  const viewportHeight = el?.clientHeight ?? 800;
  const screenRows = Math.max(1, Math.ceil(viewportHeight / metrics.rowHeight));

  const locate = (id: PageId): { section: number; index: number } | undefined => {
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const index = section ? pageIndexes(section.doc).get(id) : undefined;
      if (index !== undefined) return { section: i, index };
    }
    return undefined;
  };

  // The entrance (grid-transition.ts) asks for a page: the first render already draws its row,
  // centred, so the view change finds the cell in its update callback. The scroll is written
  // before the virtualizer reads it (this effect is declared first).
  const [initialOffset] = useState(() => {
    const page = takeGridReveal();
    const location = page === null ? undefined : locate(page);
    return location === undefined
      ? 0
      : revealOffset(layout, metrics, location.section, location.index, viewportHeight, {
          top: overTop,
          bottom: overBottom,
        });
  });
  useLayoutEffect(() => {
    if (initialOffset > 0 && viewportRef.current) viewportRef.current.scrollTop = initialOffset;
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opted out of the compiler above ('use no memo'), so the instance is read fresh.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: layout.items.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: (index) => layout.items[index]?.size ?? 0,
    paddingStart: padTop,
    paddingEnd: padBottom,
    initialOffset,
    initialRect: { width, height: viewportHeight },
    // A cell scrolled into view (keys, a reveal) lands clear of the glass at both ends.
    scrollPaddingStart: overTop + 8,
    scrollPaddingEnd: overBottom + 8,
    // Spec §7: render the visible range ± one screen (at low priority).
    overscan: screenRows + 1,
  });
  const layoutKey = `${metrics.rowHeight}:${metrics.columns}:${padTop}:${padBottom}:${specs
    .map((s) => `${s.id}/${s.count}/${s.collapsed ? 1 : 0}/${s.header ? 1 : 0}`)
    .join(',')}`;
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, layoutKey]);

  // Drag-and-drop handlers are registered once and read the latest geometry from here.
  const stateRef = useRef<TableState>({ layout, metrics, sections });
  useEffect(() => {
    stateRef.current = { layout, metrics, sections };
  });

  useEffect(() => provideArrangeColumns(() => stateRef.current.metrics.columns), []);
  // The selection ripple (grid/cell-motion.ts): pages that join the selection take their check
  // badge in reading order, outward from the range's anchor, so a range runs across the cells.
  useEffect(
    () =>
      useSelectionStore.subscribe((next, previous) => {
        if (next.selected === previous.selected || !tableRef.current) return;
        const added = [...next.selected].filter((id) => !previous.selected.has(id));
        if (added.length === 0) return;
        const order = new Map<PageId, number>();
        for (const section of stateRef.current.sections) {
          for (const page of section.doc.pages) order.set(page.id, order.size);
        }
        const from = order.get(next.anchor ?? (added[0] as PageId)) ?? 0;
        const rank = (id: PageId) => Math.abs((order.get(id) ?? 0) - from);
        gridMotion.now()?.rippleSelection(
          added.sort((a, b) => rank(a) - rank(b)),
          tableRef.current,
        );
      }),
    [],
  );
  // Select holds only inside the grid: leaving it ends the mode (the selection itself stays).
  useEffect(() => () => useSelectionStore.getState().setSelecting(false), []);

  const scrollToCell = (section: number, index: number) => {
    const sectionLayout = layout.sections[section];
    if (!sectionLayout) return;
    virtualizer.scrollToIndex(rowItemIndex(sectionLayout, index, metrics.columns), {
      align: 'auto',
    });
  };

  const activateSectionOf = (id: PageId) => {
    const location = locate(id);
    const doc = location === undefined ? undefined : sections[location.section]?.doc;
    if (doc && useWorkspaceStore.getState().workspace.activeDocument !== doc.id) setActive(doc.id);
  };

  // ------------------------------------------------------------------ drag and drop
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let hoverSection: DocumentId | null = null;
    let hoverTimer: number | undefined;
    const hover = (highlight: DropHighlight | null) => {
      const id = highlight?.kind === 'section' ? highlight.section : null;
      const collapsed =
        id !== null && stateRef.current.layout.sections.find((s) => s.id === id)?.collapsed;
      const next = collapsed ? id : null;
      if (next === hoverSection) return;
      window.clearTimeout(hoverTimer);
      hoverSection = next;
      if (next !== null) {
        hoverTimer = window.setTimeout(() => {
          useUiStore.getState().setArrangeCollapsed(next, false);
          hoverSection = null;
        }, EXPAND_DELAY_MS);
      }
    };
    const update = (location: DragLocation, kind: 'pages' | 'files' | 'tab') => {
      const highlight = dropHighlightAt(location, stateRef.current, kind);
      hover(highlight);
      setDropHighlight(highlight);
      return highlight;
    };
    const finish = () => {
      window.clearTimeout(hoverTimer);
      hoverSection = null;
      setDropHighlight(null);
      setDragSession(null);
    };
    const insertionIndex = (highlight: DropHighlight): number | undefined => {
      if (highlight.kind === 'gap') return highlight.gap.index;
      if (highlight.kind === 'section') {
        return stateRef.current.layout.sections.find((s) => s.id === highlight.section)?.count;
      }
      return undefined;
    };
    const elementKind = (data: Record<string | symbol, unknown>) =>
      isTabDrag(data) ? ('tab' as const) : ('pages' as const);
    const background = { type: 'background' };

    return combine(
      dropTargetForElements({
        element: viewport,
        getData: () => background,
        canDrop: ({ source }) => isTabDrag(source.data),
      }),
      dropTargetForExternal({
        element: viewport,
        getData: () => background,
        canDrop: containsFiles,
      }),
      autoScrollForElements({
        element: viewport,
        canScroll: ({ source }) => isPageDrag(source.data) || isTabDrag(source.data),
      }),
      autoScrollForExternal({ element: viewport, canScroll: containsFiles }),
      monitorForElements({
        canMonitor: ({ source }) => isPageDrag(source.data) || isTabDrag(source.data),
        onDragStart: ({ source, location }) => {
          const data = source.data;
          setDragSession({
            kind: elementKind(data),
            pageIds: new Set(isPageDrag(data) ? data.pageIds : []),
          });
          update(location.current, elementKind(data));
          requestAnimationFrame(() => {
            try {
              performance.measure('light-table:drag-start', 'light-table:drag-start');
            } catch {
              // The mark is missing when the drag did not start on a page cell.
            }
          });
        },
        onDrag: ({ source, location }) => {
          update(location.current, elementKind(source.data));
        },
        onDropTargetChange: ({ source, location }) => {
          update(location.current, elementKind(source.data));
        },
        onDrop: ({ source, location }) => {
          const data = source.data;
          const highlight = dropHighlightAt(location.current, stateRef.current, elementKind(data));
          finish();
          if (highlight === null) return; // Escape, or dropped outside any gap.
          if (isTabDrag(data)) {
            showInArrange(data.documentId);
            return;
          }
          if (!isPageDrag(data) || highlight.kind === 'background') return;
          const index = insertionIndex(highlight);
          if (index === undefined) return;
          // The pages settle from under the pointer, where the drag image was
          // (grid/cell-motion.ts): the source cell's box, its page centred on the pointer. A
          // copy (Alt) leaves them in place and grows the copies in where they land.
          const { clientX, clientY, altKey } = location.current.input;
          const cell = source.element.getBoundingClientRect();
          const sheet = source.element.querySelector('[data-thumb]')?.getBoundingClientRect();
          if (!altKey && sheet && cell.width > 0) {
            const dx = clientX - (sheet.left + sheet.width / 2);
            const dy = clientY - (sheet.top + sheet.height / 2);
            noteDropOrigin(
              data.pageIds,
              new DOMRect(cell.left + dx, cell.top + dy, cell.width, cell.height),
            );
          }
          const moved = transferPages({
            pageIds: data.pageIds,
            target: { document: highlight.section, index },
            duplicate: altKey,
            select: false,
          });
          // Dropped where it was: nothing reflows, so the page settles back from the pointer.
          if (moved === undefined && tableRef.current) playCells(tableRef.current, new Map());
        },
      }),
      monitorForExternal({
        canMonitor: containsFiles,
        onDragStart: ({ location }) => {
          setDragSession({ kind: 'files', pageIds: new Set() });
          update(location.current, 'files');
        },
        onDrag: ({ location }) => {
          update(location.current, 'files');
        },
        onDropTargetChange: ({ location }) => {
          update(location.current, 'files');
        },
        onDrop: ({ source, location }) => {
          const highlight = dropHighlightAt(location.current, stateRef.current, 'files');
          finish();
          // The background (and anything else) is the shell's window-wide drop.
          if (highlight === null || highlight.kind === 'background') return;
          const index = insertionIndex(highlight);
          if (index === undefined) return;
          // Must run synchronously: the item list dies when the drop handler returns.
          const pending = filesFromItems(source.items, [], isOpenableFile);
          void pending.then((found) => {
            if (found.length === 0) {
              announce(m.drop_no_pdfs());
              return;
            }
            void insertFilesAt(found, { document: highlight.section, index });
          });
        },
      }),
      () => {
        finish();
      },
    );
  }, [viewportRef]);

  // Touch and pen lift pages on the pointer path (§2.4); the mouse keeps the native drag above.
  useEffect(() => {
    const table = tableRef.current;
    const viewport = viewportRef.current;
    if (!table || !viewport) return;
    return attachGridPointerDrag(table, viewport, () => stateRef.current);
  }, [viewportRef]);

  // The cells beside the insertion bar step apart while a page is over the gap (make-way.ts).
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    let detach: (() => void) | undefined;
    let live = true;
    gridMotion.run(({ attachMakeWay }) => {
      if (!live) return;
      detach = attachMakeWay(table, () => ({
        columns: stateRef.current.metrics.columns,
        pages: (id) =>
          stateRef.current.sections
            .find((section) => section.doc.id === id)
            ?.doc.pages.map((p) => p.id),
      }));
    });
    return () => {
      live = false;
      detach?.();
    };
  }, []);

  // ------------------------------------------------------------------ focus
  // Keep DOM focus on the focused cell while the table has focus (roving tabindex).
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    if (scrollFocusPending.current && focused !== null) {
      scrollFocusPending.current = false;
      const location = locate(focused);
      if (location) scrollToCell(location.section, location.index);
    }
    if (focused === null || !table.contains(document.activeElement)) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && !active.matches('[role="gridcell"], [role="grid"]')) {
      return;
    }
    const cell = table.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(focused)}"]`);
    if (cell && document.activeElement !== cell) cell.focus({ preventScroll: true });
  });

  // ------------------------------------------------------------------ keyboard
  const navigate = (
    sectionIndex: number,
    index: number,
    key: string,
  ): { section: number; index: number } | null => {
    const cols = metrics.columns;
    const count = sections[sectionIndex]?.doc.pages.length ?? 0;
    const open = (i: number) => {
      const s = sections[i];
      return s !== undefined && !s.collapsed && s.doc.pages.length > 0;
    };
    const previous = () => {
      for (let i = sectionIndex - 1; i >= 0; i--) if (open(i)) return i;
      return -1;
    };
    const next = () => {
      for (let i = sectionIndex + 1; i < sections.length; i++) if (open(i)) return i;
      return -1;
    };
    const countOf = (i: number) => sections[i]?.doc.pages.length ?? 0;
    const column = index % cols;
    switch (key) {
      case 'ArrowLeft': {
        if (index > 0) return { section: sectionIndex, index: index - 1 };
        const p = previous();
        return p < 0 ? null : { section: p, index: countOf(p) - 1 };
      }
      case 'ArrowRight': {
        if (index < count - 1) return { section: sectionIndex, index: index + 1 };
        const n = next();
        return n < 0 ? null : { section: n, index: 0 };
      }
      case 'ArrowUp': {
        if (index - cols >= 0) return { section: sectionIndex, index: index - cols };
        const p = previous();
        if (p < 0) return null;
        const c = countOf(p);
        const lastRowStart = Math.floor((c - 1) / cols) * cols;
        return { section: p, index: Math.min(lastRowStart + column, c - 1) };
      }
      case 'ArrowDown': {
        if (index + cols < count) return { section: sectionIndex, index: index + cols };
        if (Math.floor(index / cols) < Math.floor((count - 1) / cols)) {
          return { section: sectionIndex, index: count - 1 };
        }
        const n = next();
        return n < 0 ? null : { section: n, index: Math.min(column, countOf(n) - 1) };
      }
      case 'Home':
        return { section: sectionIndex, index: 0 };
      case 'End':
        return { section: sectionIndex, index: count - 1 };
      default:
        return null;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cell =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[role="gridcell"][data-page-id]')
        : null;
    if (cell === null) return;
    const id = cell.dataset.pageId as PageId;
    const location = locate(id);
    if (location === undefined) return;
    const section = sections[location.section];
    if (!section) return;
    const order = section.doc.pages.map((p) => p.id);
    const state = selectionSnapshot();

    if (NAV_KEYS.includes(event.key)) {
      if (event.altKey && !isMod(event)) {
        event.preventDefault();
        activateSectionOf(id);
        scrollFocusPending.current = true;
        if (event.shiftKey) {
          const edges: Partial<Record<string, MoveEdge>> = {
            ArrowLeft: 'row-start',
            ArrowRight: 'row-end',
            ArrowUp: 'section-start',
            ArrowDown: 'section-end',
          };
          const edge = edges[event.key];
          if (edge) movePagesToEdge(edge, metrics.columns);
          return;
        }
        const step = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -metrics.columns,
          ArrowDown: metrics.columns,
        }[event.key as 'ArrowLeft'];
        if (step !== undefined) moveSelectionBy(step);
        return;
      }
      if (isMod(event)) return;
      event.preventDefault();
      const target = navigate(location.section, location.index, event.key);
      if (target === null) return;
      const targetSection = sections[target.section];
      const targetId = targetSection?.doc.pages[target.index]?.id;
      if (targetSection === undefined || targetId === undefined) return;
      scrollToCell(target.section, target.index);
      if (event.shiftKey && target.section === location.section) {
        apply(extendSelection(state, order, targetId));
      } else {
        apply({
          ...state,
          focused: targetId,
          anchor: state.selected.size === 0 ? targetId : state.anchor,
        });
      }
      activateSectionOf(targetId);
      return;
    }
    if (event.key === ' ' && !event.altKey && !isMod(event)) {
      event.preventDefault();
      apply(toggleSelection(state, id));
      return;
    }
    if (event.key === 'Enter' && !event.altKey && !isMod(event) && !event.shiftKey) {
      event.preventDefault();
      leaveGrid({ page: id });
    }
  };

  // ------------------------------------------------------------------ pointer
  const cellFrom = (event: MouseEvent): PageId | undefined => {
    const cell = (event.target as Element).closest<HTMLElement>('[data-page-id]');
    return (cell?.dataset.pageId as PageId | undefined) ?? undefined;
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const id = cellFrom(event);
    if (id === undefined) return;
    const shift = event.shiftKey;
    const mod = isMod(event);
    const circle = (event.target as Element).closest('[data-select-toggle]') !== null;
    // Outside selection mode a plain click or tap opens the page (PG4 §6, the Photos model), so
    // someone who came to look and jump never selects by accident.
    if (!gridSelecting(useSelectionStore.getState()) && !shift && !mod && !circle) {
      leaveGrid({ page: id });
      return;
    }
    const location = locate(id);
    const order = location ? (sections[location.section]?.doc.pages.map((p) => p.id) ?? []) : [];
    const state = selectionSnapshot();
    // In selection mode a click or a tap toggles, so a finger selects many without modifiers
    // (INV-R8); Shift ranges from the anchor and Mod toggles, as on the desktop.
    const next = shift
      ? clickSelection(state, order, id, { shift, mod })
      : toggleSelection(state, id);
    apply(next);
    activateSectionOf(id);
    announce(m.status_selected({ count: next.selected.size }));
  };

  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const id = cellFrom(event);
    setMenuPage(id ?? null);
    if (id === undefined) return;
    const state = selectionSnapshot();
    // Outside selection mode the menu acts on the page under it (`targetPages` takes the
    // focused cell) and selects nothing; in it, on the selection that holds the page.
    if (!gridSelecting(useSelectionStore.getState())) apply({ ...state, focused: id, anchor: id });
    else if (!state.selected.has(id)) apply({ selected: new Set([id]), anchor: id, focused: id });
    else apply({ ...state, focused: id });
    activateSectionOf(id);
  };

  const updateMarquee = () => {
    const drag = marqueeRef.current;
    const table = tableRef.current;
    if (!drag || !table) return;
    const rect = table.getBoundingClientRect();
    const x2 = drag.clientX - rect.left;
    const y2 = drag.clientY - rect.top;
    setMarquee({ x1: drag.startX, y1: drag.startY, x2, y2 });
    const { layout: currentLayout, metrics: currentMetrics, sections: current } = stateRef.current;
    const hits = cellsInRect(
      currentLayout,
      currentMetrics,
      normalizeRect(drag.startX, drag.startY, x2, y2),
    ).flatMap(({ section, indices }) => {
      const doc = current.find((s) => s.doc.id === section)?.doc;
      return doc ? indices.flatMap((i) => (doc.pages[i] ? [doc.pages[i].id] : [])) : [];
    });
    const next = marqueeSelection(drag.base, hits, drag.additive);
    if (!sameSelection(next.selected, useSelectionStore.getState().selected)) {
      useSelectionStore.getState().apply(next);
    }
  };

  const autoScroll = () => {
    const drag = marqueeRef.current;
    const viewport = viewportRef.current;
    if (!drag || !viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const speed = edgeScrollSpeed(drag.clientY, bounds.top, bounds.bottom);
    if (speed === 0) {
      drag.frame = 0;
      return;
    }
    viewport.scrollTop += speed;
    updateMarquee();
    drag.frame = requestAnimationFrame(autoScroll);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Touch never marquees: a finger scrolls, taps toggle, a long press lifts (PG5 §6).
    if (event.button !== 0 || event.pointerType === 'touch') return;
    const target = event.target as Element;
    if (
      target.closest(
        '[data-page-id], [data-section-header], [data-context-bar], button, a, input, [role="menu"]',
      )
    ) {
      return;
    }
    const table = event.currentTarget;
    const rect = table.getBoundingClientRect();
    marqueeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      additive: event.shiftKey || isMod(event),
      base: selectionSnapshot(),
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
      frame: 0,
    };
    table.setPointerCapture(event.pointerId);
    table.focus({ preventScroll: true });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = marqueeRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    if (!drag.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const dx = event.clientX - rect.left - drag.startX;
      const dy = event.clientY - rect.top - drag.startY;
      if (Math.hypot(dx, dy) < MARQUEE_THRESHOLD) return;
      drag.moved = true;
    }
    updateMarquee();
    if (drag.frame === 0) drag.frame = requestAnimationFrame(autoScroll);
  };

  const endMarquee = (event: PointerEvent<HTMLDivElement>) => {
    const drag = marqueeRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    marqueeRef.current = null;
    if (drag.frame !== 0) cancelAnimationFrame(drag.frame);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setMarquee(null);
    if (!drag.moved) {
      // A plain click on empty space clears the selection (Shift / Mod keep it).
      if (!drag.additive) useSelectionStore.getState().clear();
      return;
    }
    const count = useSelectionStore.getState().selected.size;
    announce(m.status_selected({ count }));
  };

  // ------------------------------------------------------------------ render
  const virtualItems = virtualizer.getVirtualItems();
  const rowsBySection = new Map<number, number[]>();
  for (const item of virtualItems) {
    const layoutItem = layout.items[item.index];
    if (!layoutItem) continue;
    const rows = rowsBySection.get(layoutItem.section) ?? [];
    if (layoutItem.kind === 'row') rows.push(layoutItem.row);
    rowsBySection.set(layoutItem.section, rows);
  }
  const viewTop = el?.scrollTop ?? initialOffset;
  const viewBottom = viewTop + viewportHeight;
  const marqueeRect =
    marquee === null ? null : normalizeRect(marquee.x1, marquee.y1, marquee.x2, marquee.y2);
  // The page that was current on the page view: the lime ring (§2.2).
  const activeId = ws.activeDocument;
  const activeDoc = activeId === undefined ? undefined : ws.documents[activeId];
  const currentId = activeDoc?.pages[Math.min(currentIndex, activeDoc.pages.length - 1)]?.id;

  return (
    <ContextMenu.Root>
      {/* Reflow on what a person did (a move, a size step, a collapse), never on a resize. */}
      <FlipCells
        root={tableRef}
        flipKey={`${arrangeSize}|${specs
          .map((s) => `${s.id}/${s.collapsed ? 1 : 0}/${s.header ? 1 : 0}`)
          .join(',')}|${sectionsSignature(sections)}`}
      >
        <ContextMenu.Trigger
          ref={tableRef}
          className={styles.table}
          style={{ height: layout.totalHeight }}
          tabIndex={-1}
          data-dragging={dragging || undefined}
          data-selecting={selecting || undefined}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onContextMenu={onContextMenu}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endMarquee}
          onPointerCancel={endMarquee}
          // A finger's hold lifts the page (grid-pointer-drag.ts); Base UI's own 500 ms touch
          // menu is not used for pages (spec X5), so its handler is kept out.
          onTouchStart={(event: { preventBaseUIHandler?: () => void }) =>
            event.preventBaseUIHandler?.()
          }
        >
          {sections.map((section, i) => {
            const rows = rowsBySection.get(i);
            const sectionLayout = layout.sections[i];
            if (rows === undefined || sectionLayout === undefined) return null;
            const first = rows[0];
            const focusedIndex =
              focused === null ? undefined : pageIndexes(section.doc).get(focused);
            const focusedRendered =
              focusedIndex !== undefined &&
              rows.includes(Math.floor(focusedIndex / metrics.columns));
            const tabbableId = focusedRendered
              ? (focused ?? undefined)
              : first === undefined
                ? undefined
                : section.doc.pages[first * metrics.columns]?.id;
            return (
              <ArrangeSection
                key={section.doc.id}
                section={section}
                layout={sectionLayout}
                metrics={metrics}
                rows={rows}
                ws={ws}
                files={files}
                viewTop={viewTop}
                viewBottom={viewBottom}
                tabbableId={tabbableId}
                currentId={section.doc.id === activeId ? currentId : undefined}
              />
            );
          })}
          {marqueeRect ? (
            <div
              className={styles.marquee}
              data-testid="marquee"
              aria-hidden="true"
              style={{
                left: marqueeRect.left,
                top: marqueeRect.top,
                width: marqueeRect.right - marqueeRect.left,
                height: marqueeRect.bottom - marqueeRect.top,
              }}
            />
          ) : null}
        </ContextMenu.Trigger>
      </FlipCells>
      <ArrangeContextMenuPopup pageId={menuPage} sectionIds={sections.map((s) => s.doc.id)} />
    </ContextMenu.Root>
  );
}

/**
 * What the cells' places depend on beyond the layout key: each section's page order. A
 * reorder within a section keeps its count, so the order itself is part of the FLIP key.
 */
const signatures = new WeakMap<ShownSection['doc']['pages'], string>();
function sectionsSignature(sections: readonly ShownSection[]): string {
  return sections
    .map((s) => {
      let signature = signatures.get(s.doc.pages);
      if (signature === undefined) {
        signature = s.doc.pages.map((p) => p.id).join(',');
        signatures.set(s.doc.pages, signature);
      }
      return signature;
    })
    .join('|');
}
