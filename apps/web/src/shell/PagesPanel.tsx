/**
 * Left rail "Pages": a virtualized thumbnail list of the active document. Thumbnails render
 * from the engine at the list's cell width × devicePixelRatio; labels come from the model
 * (`effectiveLabel`).
 *
 * A navigating click never selects (S10; 06-navigation §4.6): a click, or Up/Down/Home/End,
 * moves the row focus and scrolls the page view to the page, and writes no selection, so
 * Delete after a click changes nothing. Selection is explicit: Shift-click or Shift+Up/Down
 * select a range, Mod-click or Space toggle a page, Esc clears. While the list is on screen
 * it tells the selection store which document it shows, so Delete acts on the selected pages
 * listed here and on nothing while the list is closed (`visibleSelection`).
 */
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  effectiveLabel,
  type PageId,
  type Size,
  type VirtualDocument,
  type Workspace,
} from '@pdf-editor/document-model';
import {
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import { currentPlatform } from '../commands/shortcuts';
import { RENDER_PRIORITY } from '../engine/engine-service';
import { m } from '../i18n';
import { PageCanvas } from '../pages/PageCanvas';
import { displaySize, fitInBox } from '../pages/page-geometry';
import {
  moveFocusIndex,
  navigatorClick,
  navigatorExtend,
  selectionSnapshot,
  type SelectionSnapshot,
  toggleSelection,
  useSelectionStore,
} from '../state/selection-store';
import { useStageView } from '../state/ui-store';
import { useViewStore } from '../state/view-store';
import { contentFrame, ResizedContent } from '../stage/ResizedContent';
import { useWorkspaceStore } from '../state/workspace-store';
import styles from './LeftRail.module.css';

/** Thumbnail box: share of the list width, with a portrait aspect. */
const BOX_WIDTH_RATIO = 0.6;
const BOX_ASPECT = 1.3;
const LABEL_HEIGHT = 20;
const ROW_GAP = 12;

export function PagesPanel({ doc }: { readonly doc: VirtualDocument }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // The selection is visible here while the list is mounted (S10).
  useEffect(() => {
    const store = useSelectionStore.getState();
    store.setNavigatorDocument(doc.id);
    return () => {
      if (useSelectionStore.getState().navigatorDocument === doc.id) {
        useSelectionStore.getState().setNavigatorDocument(null);
      }
    };
  }, [doc.id]);
  return (
    <div ref={scrollRef} className={styles.pagesScroll}>
      {width > 0 ? <PageList key={doc.id} doc={doc} width={width} scrollRef={scrollRef} /> : null}
    </div>
  );
}

function PageList({
  doc,
  width,
  scrollRef,
}: {
  readonly doc: VirtualDocument;
  readonly width: number;
  readonly scrollRef: RefObject<HTMLDivElement | null>;
}) {
  'use no memo'; // TanStack Virtual mutates its instance; the React Compiler must not cache it.
  const ws = useWorkspaceStore((s) => s.workspace);
  const files = useWorkspaceStore((s) => s.files);
  const pageView = useStageView() === 'page';
  const currentPage = useViewStore((s) => s.currentPage);
  const scrollToPage = useViewStore((s) => s.scrollToPage);
  const apply = useSelectionStore((s) => s.apply);
  const clear = useSelectionStore((s) => s.clear);
  // The row with keyboard focus (roving tabindex). The list's own: navigating writes nothing
  // to the selection store, not even the grid's `focused` (S10).
  const [cursor, setCursor] = useState<PageId | null>(null);

  const boxWidth = Math.max(48, Math.round(width * BOX_WIDTH_RATIO));
  const boxHeight = Math.round(boxWidth * BOX_ASPECT);
  const pages = doc.pages;
  const order = pages.map((p) => p.id);
  // Rows are as tall as their fitted thumbnail, so landscape pages leave no gaps.
  const fitted = pages.map((page) => {
    const size = displaySize(ws, page);
    return { size, box: fitInBox(size, boxWidth, boxHeight) };
  });
  const rowHeight = (i: number) => (fitted[i]?.box.height ?? boxHeight) + LABEL_HEIGHT + ROW_GAP;
  const el = scrollRef.current;
  const screenRows = Math.max(1, Math.ceil((el?.clientHeight ?? 600) / (boxHeight / 2)));

  // Opted out of the compiler above ('use no memo'), so the instance is read fresh.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: rowHeight,
    getItemKey: (i) => pages[i]?.id ?? i,
    paddingStart: 4,
    paddingEnd: 16,
    overscan: screenRows,
  });
  const layoutKey = `${boxWidth}:${fitted.map((f) => f.box.height).join(',')}`;
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, layoutKey]);

  // Follow the Read-mode current page.
  useEffect(() => {
    if (pageView) virtualizer.scrollToIndex(currentPage, { align: 'auto' });
  }, [virtualizer, pageView, currentPage]);

  const focusedIndex = cursor === null ? -1 : order.indexOf(cursor);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list || cursor === null || !list.contains(document.activeElement)) return;
    const option = list.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(cursor)}"]`);
    if (option && document.activeElement !== option) option.focus({ preventScroll: true });
  });

  const go = (id: PageId) => {
    scrollToPage(id);
    const index = order.indexOf(id);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' });
  };

  /** Writes an explicit selection; a navigating gesture hands back the state unchanged. */
  const select = (next: SelectionSnapshot, state: SelectionSnapshot) => {
    if (next !== state) apply(next);
  };

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const option = (event.target as Element).closest<HTMLElement>('[data-page-id]');
    const id = option?.dataset.pageId as PageId | undefined;
    if (id === undefined) return;
    const mod = currentPlatform === 'mac' ? event.metaKey : event.ctrlKey;
    const state = selectionSnapshot();
    const reading = pageView ? (order[currentPage] ?? null) : null;
    select(navigatorClick(state, order, id, { shift: event.shiftKey, mod }, reading), state);
    setCursor(id);
    go(id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = {
      ArrowUp: 'ArrowLeft',
      ArrowDown: 'ArrowRight',
      Home: 'Home',
      End: 'End',
    } as const;
    const state = selectionSnapshot();
    const current = focusedIndex >= 0 ? focusedIndex : Math.min(currentPage, pages.length - 1);
    if (event.key in keys && !event.altKey) {
      event.preventDefault();
      const next = moveFocusIndex(current, pages.length, keys[event.key as keyof typeof keys], 1);
      const id = order[next];
      const from = order[current];
      if (id === undefined || from === undefined) return;
      if (event.shiftKey) apply(navigatorExtend(state, order, from, id));
      setCursor(id);
      go(id);
      return;
    }
    if (event.key === ' ') {
      const id = order[current];
      if (id === undefined) return;
      event.preventDefault();
      apply({ ...toggleSelection(state, id), focused: state.focused });
      return;
    }
    // Esc clears the selection; with none it falls through to the app's Esc.
    if (event.key === 'Escape' && state.selected.size > 0) {
      event.preventDefault();
      clear();
    }
  };

  const rows = virtualizer.getVirtualItems();
  const viewTop = el?.scrollTop ?? 0;
  const viewBottom = viewTop + (el?.clientHeight ?? 0);
  const rovingIndex =
    focusedIndex >= 0 && rows.some((r) => r.index === focusedIndex)
      ? focusedIndex
      : rows.some((r) => r.index === currentPage)
        ? currentPage
        : (rows[0]?.index ?? 0);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={m.pages_list_label({ title: doc.title })}
      aria-multiselectable="true"
      tabIndex={-1}
      className={styles.pageList}
      style={{ height: virtualizer.getTotalSize() }}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {rows.map((row) => {
        const page = pages[row.index];
        if (!page) return null;
        return (
          <PageOption
            key={row.key}
            ws={ws}
            doc={doc}
            index={row.index}
            start={row.start}
            size={fitted[row.index]?.size ?? { width: 612, height: 792 }}
            box={fitted[row.index]?.box ?? { width: boxWidth, height: boxHeight }}
            current={pageView && row.index === currentPage}
            tabbable={row.index === rovingIndex}
            colorIndex={page.ref.kind === 'source' ? (files[page.ref.source]?.colorIndex ?? 0) : 0}
            priority={
              row.end > viewTop && row.start < viewBottom
                ? RENDER_PRIORITY.visible
                : RENDER_PRIORITY.offscreen
            }
          />
        );
      })}
    </div>
  );
}

function PageOption({
  ws,
  doc,
  index,
  start,
  size,
  box,
  current,
  tabbable,
  colorIndex,
  priority,
}: {
  readonly ws: Workspace;
  readonly doc: VirtualDocument;
  readonly index: number;
  readonly start: number;
  /** Displayed page size in points and its fitted thumbnail size in CSS pixels. */
  readonly size: Size;
  readonly box: Size;
  readonly current: boolean;
  readonly tabbable: boolean;
  readonly colorIndex: number;
  readonly priority: number;
}) {
  const page = doc.pages[index];
  const id = page?.id;
  const selected = useSelectionStore((s) => (id === undefined ? false : s.selected.has(id)));
  if (!page) return null;
  const label = effectiveLabel(ws, doc, index);
  // Resized pages: the bitmap covers the content box, placed as the export draws it.
  const frame = contentFrame(ws, page);
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-current={current ? 'page' : undefined}
      aria-label={
        label === String(index + 1)
          ? m.page_option_label({ label })
          : m.page_option_label_with_index({ position: index + 1, label })
      }
      tabIndex={tabbable ? 0 : -1}
      data-page-id={page.id}
      className={styles.pageOption}
      style={{ transform: `translateY(${start}px)` }}
    >
      <div className={styles.pageBox}>
        <div className={styles.pageSheet} style={{ width: box.width, height: box.height }}>
          <ResizedContent frame={frame}>
            <PageCanvas
              sourceId={page.ref.kind === 'source' ? page.ref.source : undefined}
              blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
              index={page.ref.kind === 'source' ? page.ref.index : 0}
              rotation={page.rotation}
              widthPt={frame?.widthPt ?? size.width}
              heightPt={frame?.heightPt ?? size.height}
              cssWidth={box.width * (frame?.width ?? 1)}
              priority={priority}
            />
          </ResizedContent>
        </div>
      </div>
      <span className={styles.pageLabel} aria-hidden="true">
        <span className={styles.fileTag} data-tag={colorIndex} />
        {label}
      </span>
    </div>
  );
}
