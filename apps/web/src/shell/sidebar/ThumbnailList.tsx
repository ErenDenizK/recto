/**
 * N2 Thumbnail list (`components/06-navigation.md` N2, §2.2, §2.4; redesign spec D2-4): every
 * page of the active document, to go to one, drag one to move it (RA-7) and act on an
 * explicit selection. Virtualized (TanStack Virtual), thumbnails rendered by the engine at the
 * box width × devicePixelRatio, labels from the model (`effectiveLabel`).
 *
 * - **A navigating click never selects** (S10, INV-3): a click or tap, Up / Down, Home / End
 *   move the row focus and the page view with it, and write no selection, so Delete after a
 *   click changes nothing. Selection is explicit: Shift-click or Shift+Up / Down (a range from
 *   the anchor, else the current page), Mod-click or Space (one page), Select in the touch
 *   menu; Mod+A selects every page; Esc clears. While the list is on screen it tells the
 *   selection store which document it shows (`visibleSelection`), so Delete acts on the
 *   selected pages listed here.
 * - **Marks** (§2.2, the Pages grid's, PageCell.tsx): the current page has its label at 600 and
 *   a 1 px neutral ring 3 px out, `aria-current="page"`; a selected page a light `--select`
 *   wash with its edge and a check badge, never colour alone (A-19); both when both hold.
 * - **Drag** (§2.4) on the pointer path (`dnd/pointer-drag.ts`): a mouse or pen lifts after 4 px,
 *   a finger after a 450 ms hold and then movement, so a finger that moves first scrolls the
 *   list (S13). It moves the page under the pointer, or the selection when it holds that page,
 *   and never selects; the guard asks `canChange(id, 'pages')` at the lift and a refusal shows
 *   the Lock notice at the row. A gap bar shows where it lands, the edges scroll by depth, Alt
 *   copies, Esc cancels; the drop is one move, one undo step, announced.
 * - **Keys** (listbox, roving tabindex): Enter goes to the page and moves focus to it;
 *   Alt+Up / Alt+Down move the focused page (or the selection) by one; Shift+F10 or the Menu
 *   key open the thumbnail menu (right-click and a still long press too). Delete, R and Mod+A
 *   are the app's page commands, which act on the visible selection.
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

import { currentPlatform } from '../../commands/shortcuts';
import { edgeScrollSpeed } from '../../dnd/geometry';
import { renderDragPreview } from '../../dnd/page-drag';
import { attachPointerDrag } from '../../dnd/pointer-drag';
import { RENDER_PRIORITY } from '../../engine/engine-service';
import { formatNumber, m } from '../../i18n';
import { PageCanvas } from '../../pages/PageCanvas';
import { displaySize, fitInBox } from '../../pages/page-geometry';
import { changeRefusal, refusalReason } from '../../state/guard';
import {
  moveFocusIndex,
  navigatorClick,
  navigatorExtend,
  selectionSnapshot,
  type SelectionSnapshot,
  toggleSelection,
  useSelectionStore,
} from '../../state/selection-store';
import { useStageView } from '../../state/ui-store';
import { useViewStore } from '../../state/view-store';
import { useWorkspaceStore } from '../../state/workspace-store';
import { contentFrame, ResizedContent } from '../../stage/ResizedContent';
import { Icon } from '../../ui/Icon';
import { announce } from '../announcer';
import { movePagesTo, pagesFor, stepTarget } from './thumbnail-actions';
import styles from './ThumbnailList.module.css';
import { ThumbnailMenu, type ThumbnailMenuRequest } from './ThumbnailMenu';
import { dropIndexAt, gapOffset, rowOffsets, thumbnailBox } from './thumbnail-layout';

/** Arrow keys move the page view after this pause, so a held key does not render every page. */
const KEY_SCROLL_DELAY_MS = 150;
/** The Lock notice at a refused row stays this long. */
const LOCK_NOTICE_MS = 3000;

export function ThumbnailList({ doc }: { readonly doc: VirtualDocument }) {
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
    useSelectionStore.getState().setNavigatorDocument(doc.id);
    return () => {
      if (useSelectionStore.getState().navigatorDocument === doc.id) {
        useSelectionStore.getState().setNavigatorDocument(null);
      }
    };
  }, [doc.id]);
  return (
    <div ref={scrollRef} className={styles.scroll} data-testid="thumbnail-scroll">
      {width > 0 ? <PageList key={doc.id} doc={doc} width={width} scrollRef={scrollRef} /> : null}
    </div>
  );
}

/** A drag in progress: what moves, and where it would land. */
interface DragState {
  readonly pageIds: ReadonlySet<PageId>;
  readonly gap: number | null;
  readonly duplicate: boolean;
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
  const pageView = useStageView() === 'page';
  const currentPage = useViewStore((s) => s.currentPage);
  const apply = useSelectionStore((s) => s.apply);
  const clear = useSelectionStore((s) => s.clear);
  // The row with keyboard focus (roving tabindex). The list's own: navigating writes nothing
  // to the selection store, not even the grid's `focused` (S10).
  const [cursor, setCursor] = useState<PageId | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [held, setHeld] = useState<PageId | null>(null);
  const [menu, setMenu] = useState<ThumbnailMenuRequest | null>(null);
  const [locked, setLocked] = useState<{ readonly pageId: PageId; readonly text: string } | null>(
    null,
  );

  const box = thumbnailBox(width);
  const pages = doc.pages;
  const order = pages.map((p) => p.id);
  // Rows are as tall as their fitted thumbnail, so landscape pages leave no gaps.
  const fitted = pages.map((page) => {
    const size = displaySize(ws, page);
    return { size, box: fitInBox(size, box.width, box.height) };
  });
  const offsets = rowOffsets(fitted.map((f) => f.box.height));
  const el = scrollRef.current;
  const screenRows = Math.max(1, Math.ceil((el?.clientHeight ?? 600) / (box.height / 2)));

  // Opted out of the compiler above ('use no memo'), so the instance is read fresh.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: pages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => offsets.rows[i]?.size ?? box.height,
    getItemKey: (i) => pages[i]?.id ?? i,
    paddingStart: offsets.paddingStart,
    paddingEnd: offsets.paddingEnd,
    overscan: screenRows,
  });
  const layoutKey = `${box.width}:${fitted.map((f) => f.box.height).join(',')}`;
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, layoutKey]);

  // Follow the page being read; the list keeps the current row in view unless focus is in it.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pageView) return;
    if (listRef.current?.contains(document.activeElement)) return;
    virtualizer.scrollToIndex(currentPage, { align: 'auto' });
  }, [virtualizer, pageView, currentPage]);

  const focusedIndex = cursor === null ? -1 : order.indexOf(cursor);
  useEffect(() => {
    const list = listRef.current;
    if (!list || cursor === null || !list.contains(document.activeElement)) return;
    const option = list.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(cursor)}"]`);
    if (option && document.activeElement !== option) option.focus({ preventScroll: true });
  });

  const keyTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(keyTimer.current), []);
  const go = (id: PageId, delay = 0) => {
    const index = order.indexOf(id);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' });
    window.clearTimeout(keyTimer.current);
    const scroll = () => useViewStore.getState().scrollToPage(id);
    if (delay > 0) keyTimer.current = window.setTimeout(scroll, delay);
    else scroll();
    announce(
      m.thumb_announce_page({ page: formatNumber(index + 1), total: formatNumber(order.length) }),
      {
        key: 'thumbnail-page',
      },
    );
  };

  /** Writes an explicit selection; a navigating gesture hands back the state unchanged. */
  const select = (next: SelectionSnapshot, state: SelectionSnapshot) => {
    if (next !== state) apply(next);
  };

  const rowOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>('[data-page-id]') : null;

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const id = rowOf(event.target)?.dataset.pageId as PageId | undefined;
    if (id === undefined) return;
    const mod = currentPlatform === 'mac' ? event.metaKey : event.ctrlKey;
    const state = selectionSnapshot();
    const reading = pageView ? (order[currentPage] ?? null) : null;
    select(navigatorClick(state, order, id, { shift: event.shiftKey, mod }, reading), state);
    setCursor(id);
    go(id);
  };

  const openMenu = (pageId: PageId, point: { x: number; y: number }, touch: boolean) => {
    setCursor(pageId);
    setMenu({ pageId, point, touch });
  };

  const onContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const id = rowOf(event.target)?.dataset.pageId as PageId | undefined;
    if (id === undefined || event.defaultPrevented) return;
    event.preventDefault();
    openMenu(id, { x: event.clientX, y: event.clientY }, false);
  };

  /** Moves `ids` by one place (Alt+Up / Alt+Down), the guard first. */
  const step = (ids: readonly PageId[], direction: 1 | -1) => {
    const refusal = changeRefusal(doc.id, 'pages');
    const first = ids[0];
    if (refusal) {
      if (first !== undefined) setLocked({ pageId: first, text: refusalReason(refusal) });
      announce(refusalReason(refusal));
      return;
    }
    const index = stepTarget(order, ids, direction);
    if (index === undefined) return;
    movePagesTo(ids, doc.id, index, { coalesceKey: `thumb-move:${[...ids].sort().join(',')}` });
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
    const here = order[current];
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      if (here === undefined) return;
      event.preventDefault();
      step(pagesFor(here, order), event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (event.key in keys && !event.altKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      const next = moveFocusIndex(current, pages.length, keys[event.key as keyof typeof keys], 1);
      const id = order[next];
      if (id === undefined || here === undefined) return;
      if (event.shiftKey) apply(navigatorExtend(state, order, here, id));
      setCursor(id);
      go(id, KEY_SCROLL_DELAY_MS);
      return;
    }
    if (event.key === 'Enter' && here !== undefined) {
      event.preventDefault();
      go(here);
      document.querySelector<HTMLElement>('[data-read-viewport]')?.focus({ preventScroll: true });
      return;
    }
    if (event.key === ' ' && here !== undefined) {
      event.preventDefault();
      apply({ ...toggleSelection(state, here), focused: state.focused });
      return;
    }
    const menuKey =
      event.key === 'ContextMenu' ||
      (event.key === 'F10' && event.shiftKey && !event.ctrlKey && !event.altKey);
    if (menuKey && here !== undefined) {
      event.preventDefault();
      const row = listRef.current?.querySelector<HTMLElement>(
        `[data-page-id="${CSS.escape(here)}"]`,
      );
      const rect = row?.getBoundingClientRect();
      openMenu(here, { x: (rect?.left ?? 0) + 24, y: (rect?.top ?? 0) + 24 }, false);
      return;
    }
    // Esc clears the selection; with none it falls through to the sidebar's and the app's Esc.
    if (event.key === 'Escape' && state.selected.size > 0) {
      event.preventDefault();
      clear();
    }
  };

  // --- Drag on the pointer path (§2.4) ---------------------------------------------------

  /** What the drag callbacks read: this render's values (they are attached once). */
  const live = useRef({ doc, order, offsets, cursor });
  live.current = { doc, order, offsets, cursor };
  const dragRef = useRef<{
    pageIds: PageId[];
    preview: HTMLElement;
    grab: { x: number; y: number };
    gap: number | null;
    duplicate: boolean;
    pointerY: number;
    frame: number;
  } | null>(null);

  useEffect(() => {
    const list = listRef.current;
    const scroller = scrollRef.current;
    if (!list || !scroller) return;

    const gapAt = (clientY: number): number => {
      const y = clientY - list.getBoundingClientRect().top;
      return dropIndexAt(live.current.offsets, y);
    };
    const place = (clientX: number, clientY: number) => {
      const state = dragRef.current;
      if (!state) return;
      state.preview.style.transform = `translate(${Math.round(clientX - state.grab.x)}px, ${Math.round(clientY - state.grab.y)}px)`;
    };
    const update = (e: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      state.pointerY = e.clientY;
      place(e.clientX, e.clientY);
      const box = scroller.getBoundingClientRect();
      const inside = e.clientX >= box.left - 24 && e.clientX <= box.right + 24;
      const gap = inside ? gapAt(e.clientY) : null;
      const duplicate = e.altKey;
      if (gap !== state.gap || duplicate !== state.duplicate) {
        state.gap = gap;
        state.duplicate = duplicate;
        setDrag({ pageIds: new Set(state.pageIds), gap, duplicate });
      }
    };
    // Edge auto-scroll by depth (48 px zones, `edgeScrollSpeed`), while the pointer rests.
    const tick = () => {
      const state = dragRef.current;
      if (!state) return;
      const box = scroller.getBoundingClientRect();
      const speed = edgeScrollSpeed(state.pointerY, box.top, box.bottom);
      if (speed !== 0) {
        scroller.scrollTop += speed;
        const gap = gapAt(state.pointerY);
        if (gap !== state.gap) {
          state.gap = gap;
          setDrag({ pageIds: new Set(state.pageIds), gap, duplicate: state.duplicate });
        }
      }
      state.frame = requestAnimationFrame(tick);
    };
    const finish = () => {
      const state = dragRef.current;
      if (!state) return;
      cancelAnimationFrame(state.frame);
      state.preview.remove();
      dragRef.current = null;
      setDrag(null);
    };

    return attachPointerDrag(list, {
      shouldStart: (e) => rowOf(e.target) !== null,
      onHold: (e) => {
        const id = rowOf(e.target)?.dataset.pageId as PageId | undefined;
        if (id !== undefined) setHeld(id);
      },
      onEnd: () => setHeld(null),
      onHoldRelease: (e) => {
        const id = rowOf(e.target)?.dataset.pageId as PageId | undefined;
        if (id !== undefined) openMenu(id, { x: e.clientX, y: e.clientY }, true);
      },
      onLift: (e, start) => {
        const row = rowOf(start.target);
        const id = row?.dataset.pageId as PageId | undefined;
        if (!row || id === undefined) return false;
        const refusal = changeRefusal(live.current.doc.id, 'pages');
        if (refusal) {
          setLocked({ pageId: id, text: refusalReason(refusal) });
          announce(refusalReason(refusal));
          return false;
        }
        setHeld(null);
        const pageIds = pagesFor(id, live.current.order);
        const sheet = row.querySelector<HTMLElement>('[data-thumb]');
        const rect = (sheet ?? row).getBoundingClientRect();
        const preview = document.createElement('div');
        preview.className = styles.preview ?? '';
        preview.setAttribute('aria-hidden', 'true');
        preview.dataset.testid = 'thumbnail-drag-preview';
        renderDragPreview(preview, sheet, pageIds.length);
        document.body.append(preview);
        dragRef.current = {
          pageIds,
          preview,
          grab: { x: start.clientX - rect.left, y: start.clientY - rect.top },
          gap: null,
          duplicate: false,
          pointerY: e.clientY,
          frame: requestAnimationFrame(tick),
        };
        place(e.clientX, e.clientY);
        announce(m.thumb_announce_lift({ count: pageIds.length }));
        setCursor(id);
        return true;
      },
      onMove: update,
      onDrop: (e) => {
        const state = dragRef.current;
        if (!state) return;
        const gap = gapAt(e.clientY);
        const box = scroller.getBoundingClientRect();
        const inside = e.clientX >= box.left - 24 && e.clientX <= box.right + 24;
        const pageIds = state.pageIds;
        const duplicate = e.altKey;
        finish();
        if (!inside) return;
        movePagesTo(pageIds, live.current.doc.id, gap, { duplicate });
        list
          .querySelector<HTMLElement>(`[data-page-id="${CSS.escape(pageIds[0] ?? '')}"]`)
          ?.focus({ preventScroll: true });
      },
      onCancel: finish,
    });
    // Attached once per document list; the callbacks read `live`.
  }, [scrollRef]);

  // The Lock notice at a refused row goes after a while.
  useEffect(() => {
    if (!locked) return;
    const timer = window.setTimeout(() => setLocked(null), LOCK_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [locked]);

  const rows = virtualizer.getVirtualItems();
  const viewTop = el?.scrollTop ?? 0;
  const viewBottom = viewTop + (el?.clientHeight ?? 0);
  const rovingIndex =
    focusedIndex >= 0 && rows.some((r) => r.index === focusedIndex)
      ? focusedIndex
      : rows.some((r) => r.index === currentPage)
        ? currentPage
        : (rows[0]?.index ?? 0);
  const gapY = drag?.gap === null || drag === null ? null : gapOffset(offsets, drag.gap);

  return (
    <>
      <div
        ref={listRef}
        role="listbox"
        aria-label={m.pages_list_label({ title: doc.title })}
        aria-multiselectable="true"
        tabIndex={-1}
        className={styles.list}
        style={{ height: virtualizer.getTotalSize() }}
        data-dragging={drag ? '' : undefined}
        onClick={onClick}
        onContextMenu={onContextMenu}
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
              box={fitted[row.index]?.box ?? box}
              current={pageView && row.index === currentPage}
              tabbable={row.index === rovingIndex}
              dragged={drag?.pageIds.has(page.id) ?? false}
              held={held === page.id}
              outline={doc.outline.length > 0 && outlineTargets(doc.outline).has(page.id)}
              priority={
                row.end > viewTop && row.start < viewBottom
                  ? RENDER_PRIORITY.visible
                  : RENDER_PRIORITY.offscreen
              }
            />
          );
        })}
        {gapY !== null ? (
          <div
            className={styles.gap}
            style={{ transform: `translateY(${Math.round(gapY)}px)` }}
            data-duplicate={drag?.duplicate ? '' : undefined}
            data-testid="thumbnail-gap"
            aria-hidden="true"
          />
        ) : null}
        {locked ? (
          <LockNotice
            text={locked.text}
            top={(() => {
              const i = order.indexOf(locked.pageId);
              return i < 0 ? 0 : (offsets.rows[i]?.start ?? 0);
            })()}
          />
        ) : null}
      </div>
      <ThumbnailMenu
        request={menu}
        documentId={doc.id}
        order={order}
        onClose={() => setMenu(null)}
        restoreFocus={() =>
          cursor === null
            ? null
            : (listRef.current?.querySelector<HTMLElement>(
                `[data-page-id="${CSS.escape(cursor)}"]`,
              ) ?? null)
        }
      />
    </>
  );
}

type Outline = VirtualDocument['outline'];
const outlineCache = new WeakMap<Outline, ReadonlySet<PageId>>();

/** Pages an outline entry points at (a bookmark glyph follows their label, §2.2). */
function outlineTargets(outline: Outline): ReadonlySet<PageId> {
  const known = outlineCache.get(outline);
  if (known) return known;
  const found = new Set<PageId>();
  const walk = (nodes: Outline) => {
    for (const node of nodes) {
      const destination = node.destination;
      if (destination?.kind === 'page') found.add(destination.page);
      walk(node.children);
    }
  };
  walk(outline);
  outlineCache.set(outline, found);
  return found;
}

function LockNotice({ text, top }: { readonly text: string; readonly top: number }) {
  return (
    <div
      role="status"
      className={styles.lockNotice}
      style={{ transform: `translateY(${Math.round(top)}px)` }}
      data-testid="thumbnail-lock-notice"
    >
      <Icon name="lock-simple" className={styles.lockIcon} />
      <span>{text}</span>
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
  dragged,
  held,
  outline,
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
  readonly dragged: boolean;
  readonly held: boolean;
  readonly outline: boolean;
  readonly priority: number;
}) {
  const page = doc.pages[index];
  const id = page?.id;
  const selected = useSelectionStore((s) => (id === undefined ? false : s.selected.has(id)));
  if (!page) return null;
  const label = effectiveLabel(ws, doc, index);
  const total = doc.pages.length;
  // Resized pages: the bitmap covers the content box, placed as the export draws it.
  const frame = contentFrame(ws, page);
  return (
    <div
      role="option"
      aria-selected={selected}
      aria-current={current ? 'page' : undefined}
      aria-posinset={index + 1}
      aria-setsize={total}
      aria-label={
        label === String(index + 1)
          ? m.page_option_label({ label })
          : m.page_option_label_with_index({ position: index + 1, label })
      }
      tabIndex={tabbable ? 0 : -1}
      data-page-id={page.id}
      data-sidebar-current={tabbable ? '' : undefined}
      data-dragged={dragged ? '' : undefined}
      data-held={held ? '' : undefined}
      className={styles.option}
      style={{ transform: `translateY(${start}px)` }}
    >
      <div className={styles.box}>
        <div
          className={styles.sheet}
          style={{ width: box.width, height: box.height }}
          data-thumb=""
          data-current={current ? '' : undefined}
          data-selected={selected ? '' : undefined}
        >
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
          {selected ? (
            <span className={styles.badge} aria-hidden="true">
              <Icon name="check" />
            </span>
          ) : null}
        </div>
      </div>
      <span className={styles.label} aria-hidden="true">
        <span className={styles.labelText}>{label}</span>
        {outline ? <Icon name="bookmark-simple" className={styles.mark} /> : null}
      </span>
    </div>
  );
}
