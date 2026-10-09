/**
 * Read mode: the active document as a virtualized column of rows rendered by the engine at
 * zoom × devicePixelRatio. A row is one page (continuous), a spread of two pages side by
 * side (two-up), or only the current page (single page). Placeholder sheets are sized from
 * the model (`pageDisplaySize`) so the layout never jumps; bitmaps fill in as they arrive.
 * On zoom the sheets resize at once (the current bitmap stretches) and a sharper render is
 * requested after a short debounce; above the single-bitmap cap, visible tiles render at
 * full resolution (`TiledPage`).
 *
 * Zoom keeps a stable anchor: the point under the viewport centre (buttons, keys) stays in
 * place. Pinch, trackpad pinch, Mod+wheel and the touch double tap go through the canvas zoom
 * (`use-canvas-zoom.ts`, `viewer/zoom-controller.ts`; 05-canvas §4): the column is the zoom
 * layer, scaled by `transform` while the gesture runs, and the zoom is committed once at rest
 * with the point under the fingers kept where it showed. The trailing page scrubber
 * (`PageScrubber`, 05-canvas §5) shows on coarse pointers for long documents.
 *
 * Every page hosts the registered overlays (text layer, search highlights, links, …).
 * With a text layer the page is a `region` whose content is its text; the canvas is
 * decorative.
 *
 * Full bleed (craft spec §7; 01-frame F1): the scroll container covers the whole app shell,
 * under the top strip, the sidebar, the inspector and the dock band, while fit, centring, the
 * current page and scroll-into-view use the free rectangle (`view`, measured by `stage-bleed.ts`
 * as the stage's box, which `shell/frame/frame-insets.ts` places in the free rectangle, with
 * the stand-in scroll bars' room). Pages pass beneath the glass while scrolling and rest clear
 * of it: fit, jumps and focus land inside the free rectangle (A-12).
 */
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type Rect,
  type Size,
  type VirtualDocument,
  type VirtualPage,
  pageTotalRotation,
  type Workspace,
} from '@pdf-editor/document-model';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { RENDER_PRIORITY, sheetSize } from '../engine/engine-service';
import { animate, type Motion } from '../motion/animate';
import { reducedMotion } from '../motion/reduced-motion';
import { m } from '../i18n';
import { PageCanvas } from '../pages/PageCanvas';
import { CSS_PX_PER_PT, displaySize, rotationPhrase } from '../pages/page-geometry';
import { needsTiles, TiledPage } from '../pages/TiledPage';
import { useSelectionStore } from '../state/selection-store';
import { clamp, MAX_ZOOM, MIN_ZOOM, useUiStore } from '../state/ui-store';
import { type ReadLayout, type ScrollMotion, useViewStore } from '../state/view-store';
import { useWorkspaceStore } from '../state/workspace-store';
import { SOFT_EDGE } from '../shell/frame/frame-insets';
import { SIZE_CLASS_MIN_WIDTH } from '../shell/frame/size-class';
import styles from '../shell/Stage.module.css';
import { type Box, userRectToCss } from '../viewer/geometry';
import {
  documentFingerprint,
  documentLabels,
  recallPosition,
  rememberPosition,
} from '../viewer/navigation';
import { cancelJump, jumpScroll, jumpTarget } from '../viewer/jump';
import { clearLandings, flashLanding } from '../viewer/landing';
import { pageFrame } from '../viewer/page-frame';
import { setReadController } from '../viewer/read-controller';
import type { Point, ZoomRest } from '../viewer/zoom-controller';
import '../viewer/register';
import { installCopyHandler } from '../viewer/TextLayer';
import { PageOverlays } from './page-overlays';
import { enterPagesGrid } from './pages-grid-door';
import { PageScrubber } from './PageScrubber';
import { PinchDetentChip } from './PinchDetentChip';
import readStyles from './ReadView.module.css';
import { type ContentFrame, contentFrame, ResizedContent } from './ResizedContent';
import { ScrollProxies } from './ScrollProxies';
import { type Insets, scrollbarSize, scrollbarsNeeded, useStageBleed } from './stage-bleed';
import { useCanvasZoom, type ZoomColumn } from './use-canvas-zoom';

const PAD_X = 48;
/** The widest fitted row of pages from xlarge, CSS px (01-frame F1 §2). */
const XLARGE_FIT_CAP = 1100;
/**
 * The first page rests, and jumps land, 24 px below the strip: clear of the soft scroll edge
 * (01-frame F1 §3, spec 01.9).
 */
const PAD_TOP = SOFT_EDGE;
/**
 * The last page rests 16 px above the dock band: the free rectangle already leaves the band
 * out (F1 §2: the scroller's bottom padding equals the bottom inset + 16).
 */
const PAD_BOTTOM = 16;
const GAP = 16;
/** Debounce before a zoom change requests sharper bitmaps. */
const ZOOM_RENDER_DELAY_MS = 160;
/** At most this many extra rows render while a zoom gesture shrinks the column. */
const MAX_EXTRA_ROWS = 60;
/** A programmatic scroll has settled after this long without scroll events. */
const NAV_SETTLE_MS = 180;
/** Remember the reading position after it has settled for this long. */
const REMEMBER_DELAY_MS = 600;
/** Scroll requests this soon after the column mounts land at once (a view change brought it). */
const MOUNT_INSTANT_MS = 300;
/** How many frames a landing highlight waits for its page to be laid out. */
const LANDING_WAIT_FRAMES = 10;

/**
 * A resized page in Read mode (`VirtualPage.resize`): where its content bitmap goes on the
 * sheet (the model's `pageContentPlacement`, via `contentFrame`), in CSS pixels snapped to
 * device pixels, and the content's scale for the canvas and tiles. The overlays use the
 * page's resized frame (`pageFrame` with the page), which maps engine geometry to the same
 * place through the resize matrix; read-resize.test.tsx checks the two agree.
 */
interface ResizedLayout {
  readonly box: Box;
  /** Displayed content size in points (after rotation). */
  readonly contentPt: Size;
  /** CSS pixels per content point (horizontally, for a stretch). */
  readonly contentScale: number;
  /** Non-uniform (stretch): the bitmap is stretched by CSS, never drawn 1:1 or tiled. */
  readonly stretched: boolean;
  /** Content reaches past the sheet (scale to cover, shrinking canvas): clip the sheet. */
  readonly overflows: boolean;
}

/** Exported for tests. */
export function resizedLayout(
  frame: ContentFrame,
  stretched: boolean,
  sheet: Size,
  dpr: number,
): ResizedLayout {
  const raw = {
    left: frame.left * sheet.width,
    top: frame.top * sheet.height,
    width: frame.width * sheet.width,
    height: frame.height * sheet.height,
  };
  const contentPt = { width: frame.widthPt, height: frame.heightPt };
  const contentScale = raw.width / Math.max(1e-6, contentPt.width);
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  // Uniform: the same snapping as a sheet, so the exact-scale bitmap maps 1:1.
  const size = stretched
    ? { width: raw.width, height: raw.height }
    : sheetSize(contentPt.width, contentPt.height, contentScale, dpr);
  const box = { left: snap(raw.left), top: snap(raw.top), ...size };
  const overflows =
    box.left < -0.5 ||
    box.top < -0.5 ||
    box.left + box.width > sheet.width + 0.5 ||
    box.top + box.height > sheet.height + 0.5;
  return { box, contentPt, contentScale, stretched, overflows };
}

function resizedLayoutOf(
  ws: Workspace,
  page: VirtualPage,
  sheet: Size,
  dpr: number,
): ResizedLayout | undefined {
  const frame = contentFrame(ws, page);
  if (frame === undefined) return undefined;
  const stretched = page.resize?.mode === 'scale' && page.resize.stretch === true;
  return resizedLayout(frame, stretched, sheet, dpr);
}

/** Documents whose remembered position was already applied this session. */
const restored = new Set<string>();

interface Row {
  /** Page indices, left to right. */
  readonly pages: readonly number[];
  /** Points: sum of the page widths (gaps excluded) and the tallest page. */
  readonly width: number;
  readonly height: number;
}

interface Layout {
  readonly sizes: readonly Size[];
  readonly rows: readonly Row[];
  /** Row index of every page (-1 when the layout does not show it). */
  readonly rowOf: readonly number[];
  /** Widest row in points, and whether any row has two pages (one gap). */
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly maxGaps: number;
}

function rowOfPages(pages: readonly number[], sizes: readonly Size[]): Row {
  let width = 0;
  let height = 0;
  for (const i of pages) {
    width += sizes[i]?.width ?? 0;
    height = Math.max(height, sizes[i]?.height ?? 0);
  }
  return { pages, width, height };
}

/** Rows for a layout. Exported for tests. */
export function computeRows(
  sizes: readonly Size[],
  layout: ReadLayout,
  currentPage: number,
): Row[] {
  const count = sizes.length;
  if (count === 0) return [];
  if (layout === 'single') {
    return [rowOfPages([Math.min(Math.max(0, currentPage), count - 1)], sizes)];
  }
  if (layout === 'two-up') {
    const rows: Row[] = [];
    for (let i = 0; i < count; i += 2) {
      rows.push(rowOfPages(i + 1 < count ? [i, i + 1] : [i], sizes));
    }
    return rows;
  }
  return sizes.map((_, i) => rowOfPages([i], sizes));
}

function computeLayout(
  ws: Workspace,
  doc: VirtualDocument,
  layout: ReadLayout,
  currentPage: number,
): Layout {
  const sizes = doc.pages.map((page) => displaySize(ws, page));
  const rows = computeRows(sizes, layout, currentPage);
  const rowOf = new Array<number>(sizes.length).fill(-1);
  rows.forEach((row, r) => {
    for (const i of row.pages) rowOf[i] = r;
  });
  // Fit modes use every page, so the zoom does not change from page to page.
  const all = computeRows(sizes, layout === 'single' ? 'continuous' : layout, 0);
  let maxWidth = 1;
  let maxHeight = 1;
  let maxGaps = 0;
  for (const row of all) {
    maxWidth = Math.max(maxWidth, row.width);
    maxHeight = Math.max(maxHeight, row.height);
    maxGaps = Math.max(maxGaps, row.pages.length - 1);
  }
  return { sizes, rows, rowOf, maxWidth, maxHeight, maxGaps };
}

/**
 * The zooms that fit the widest row's width, and the tallest page whole, in the unobscured
 * rectangle of `el` (fit width and fit page). Exported for tests.
 */
export function fitZooms(
  el: { readonly clientWidth: number; readonly clientHeight: number },
  view: Insets,
  layout: Pick<Layout, 'maxWidth' | 'maxHeight' | 'maxGaps'>,
): { width: number; page: number } {
  const width = el.clientWidth - view.left - view.right;
  const height = el.clientHeight - view.top - view.bottom;
  // From the xlarge class (the viewport spans the window) a fitted row is at most 1100 px of
  // page: a line stays readable on a wide screen (01-frame F1 §2, research 19 M-11).
  const room = width - PAD_X * 2 - layout.maxGaps * GAP;
  const row = el.clientWidth >= SIZE_CLASS_MIN_WIDTH.xlarge ? Math.min(room, XLARGE_FIT_CAP) : room;
  const byWidth = row / (layout.maxWidth * CSS_PX_PER_PT);
  const byHeight = (height - PAD_TOP - GAP) / (layout.maxHeight * CSS_PX_PER_PT);
  return {
    width: clamp(byWidth, MIN_ZOOM, MAX_ZOOM),
    page: clamp(Math.min(byWidth, byHeight), MIN_ZOOM, MAX_ZOOM),
  };
}

export function ReadView({
  doc,
  prepared = false,
}: {
  readonly doc: VirtualDocument;
  /**
   * Mounted ahead of the view change out of the Pages grid (`grid-transition.ts`): laid out
   * and drawn in the stage's place, but hidden and inert under the grid until it is revealed.
   */
  readonly prepared?: boolean;
}) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const zoom = useUiStore((s) => s.zoom);
  const fitMode = useUiStore((s) => s.fitMode);
  const applyFitZoom = useUiStore((s) => s.applyFitZoom);
  const readLayout = useViewStore((s) => s.layout);
  const currentPage = useViewStore((s) => s.currentPage);
  const viewportRef = useRef<HTMLDivElement>(null);
  // The viewport is the page column's scroll element, and the column mounts only once it
  // exists. A child's layout effects run before React attaches its parent's ref, so a
  // column mounted with the viewport would give its virtualizer a null scroll element on
  // mount; the virtualizer then observes nothing and lays out no rows until something else
  // re-renders the column (Read mode stayed blank until a window resize). Setting state
  // from the ref callback re-renders synchronously during the same commit, before paint.
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const attachViewport = useCallback((el: HTMLDivElement | null) => {
    viewportRef.current = el;
    setViewport(el);
  }, []);
  const layout = computeLayout(ws, doc, readLayout, currentPage);
  const cssScale = zoom * CSS_PX_PER_PT;

  // The unobscured rectangle (the frame) and the bars the page column needs inside it, as the
  // old viewport of the frame's size would have shown them.
  const frameRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const bleed = useStageBleed(frameRef);
  const barSize = scrollbarSize();
  const content = readContentSize(layout, cssScale);
  const bars = scrollbarsNeeded(content, bleed, barSize);
  const view: Insets = {
    top: bleed.insets.top,
    left: bleed.insets.left,
    right: bleed.insets.right + (bars.vertical ? barSize : 0),
    bottom: bleed.insets.bottom + (bars.horizontal ? barSize : 0),
  };

  // Fit width / fit page follow the unobscured rectangle: the window and the panels' sizes.
  // Choosing a fit animates the zoom (motion-2026-10 viewer.md §2); following a resize does not.
  const quietZoom = useRef<number | null>(null);
  const lastFitMode = useRef(fitMode);
  useEffect(() => {
    const el = viewportRef.current;
    const chosen = lastFitMode.current !== fitMode;
    lastFitMode.current = fitMode;
    if (!el || fitMode === null) return;
    const fit = (follow: boolean) => {
      const fits = fitZooms(
        el,
        { top: view.top, right: view.right, bottom: view.bottom, left: view.left },
        { maxWidth: layout.maxWidth, maxHeight: layout.maxHeight, maxGaps: layout.maxGaps },
      );
      const next = clamp(fitMode === 'width' ? fits.width : fits.page, MIN_ZOOM, MAX_ZOOM);
      quietZoom.current = follow ? next : null;
      applyFitZoom(next);
    };
    fit(!chosen);
    const observer = new ResizeObserver(() => fit(true));
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    fitMode,
    applyFitZoom,
    layout.maxWidth,
    layout.maxHeight,
    layout.maxGaps,
    view.left,
    view.right,
    view.top,
    view.bottom,
  ]);

  // Copy from the text layer assembles lines and pages (TextLayer.tsx).
  useEffect(() => installCopyHandler(), []);

  // Remember the reading position per document fingerprint (localStorage, guarded).
  const fingerprint = documentFingerprint(ws, doc);
  useEffect(() => {
    if (fingerprint === undefined) return;
    let timer = 0;
    const unsubscribe = useViewStore.subscribe((state, previous) => {
      if (state.currentPage === previous.currentPage) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => rememberPosition(fingerprint, state.currentPage),
        REMEMBER_DELAY_MS,
      );
    });
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [fingerprint]);

  return (
    <div
      ref={frameRef}
      className={readStyles.frame}
      data-prepared={prepared ? '' : undefined}
      inert={prepared}
      aria-hidden={prepared ? true : undefined}
    >
      <div
        ref={attachViewport}
        className={readStyles.viewport}
        data-read-viewport
        data-layout={readLayout}
        // A Tab stop, so the pages scroll from the keyboard (the canvases hold no focusable
        // content); named for the document.
        role="region"
        aria-label={m.a11y_pages_viewport({ title: doc.title })}
        // A scrollable region must take focus (WCAG 2.1.1; axe scrollable-region-focusable).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        style={{
          // Out to the edges of the shell, under the docked frame.
          top: -bleed.insets.top,
          right: -bleed.insets.right,
          bottom: -bleed.insets.bottom,
          left: -bleed.insets.left,
          // Focus and scrollIntoView keep targets inside the unobscured rectangle.
          scrollPadding: `${view.top}px ${view.right}px ${view.bottom}px ${view.left}px`,
        }}
      >
        {viewport ? (
          <PageColumn
            doc={doc}
            ws={ws}
            layout={layout}
            readLayout={readLayout}
            cssScale={cssScale}
            scrollElement={viewport}
            viewportRef={viewportRef}
            fingerprint={fingerprint}
            fitting={fitMode !== null}
            view={view}
            chipRef={chipRef}
            prepared={prepared}
            quietZoom={quietZoom}
          />
        ) : null}
      </div>
      <PinchDetentChip ref={chipRef} />
      <PageScrubber doc={doc} viewport={viewport} />
      <ScrollProxies
        target={viewport}
        content={content}
        vertical={bars.vertical}
        horizontal={bars.horizontal}
        size={barSize}
      />
    </div>
  );
}

/**
 * The page column's size inside the unobscured rectangle (the old viewport's scroll content):
 * the widest row with its side padding, and every row with the top and bottom padding.
 * Exported for tests.
 */
export function readContentSize(
  layout: Pick<Layout, 'rows' | 'maxWidth' | 'maxGaps'>,
  cssScale: number,
): { width: number; height: number } {
  let height = PAD_TOP + PAD_BOTTOM - GAP;
  for (const row of layout.rows) height += row.height * cssScale + GAP;
  return {
    width: layout.maxWidth * cssScale + layout.maxGaps * GAP + PAD_X * 2,
    height,
  };
}

/** A zoom anchor: a point of a row that must stay under a viewport position. */
interface Anchor {
  readonly row: number;
  /** Position inside the row, 0 = top, 1 = bottom. */
  readonly fraction: number;
  /** Viewport position (CSS px from the viewport's top-left) that keeps the point. */
  readonly viewportX: number;
  readonly viewportY: number;
  /** Horizontal distance of the point from the canvas centre, CSS px, at `scale`. */
  readonly fromCentre: number;
  readonly scale: number;
  /** Taken with the view scrolled to the very top. */
  readonly atTop?: boolean;
}

function PageColumn({
  doc,
  ws,
  layout,
  readLayout,
  cssScale,
  scrollElement,
  viewportRef,
  fingerprint,
  fitting,
  view,
  chipRef,
  prepared,
  quietZoom,
}: {
  readonly doc: VirtualDocument;
  readonly ws: Workspace;
  readonly layout: Layout;
  readonly readLayout: ReadLayout;
  readonly cssScale: number;
  /**
   * The Read viewport, already attached: the virtualizer observes its size and scroll from
   * its first layout effect. (A hidden viewport has no size; the virtualizer's
   * ResizeObserver lays the rows out once it is shown.)
   */
  readonly scrollElement: HTMLDivElement;
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  readonly fingerprint: string | undefined;
  /**
   * The zoom follows the viewport (fit width / fit page): a resize keeps the line at the
   * viewport's top in place, not the centre, so a page read from its top stays at its top
   * (1440 → 1024 → 1440 px left page 1's only text scrolled out of view).
   */
  readonly fitting: boolean;
  /**
   * The unobscured rectangle's insets in the full-bleed viewport: the docked frame and the
   * stage header, plus the stand-in scroll bars' room. Rows are laid out, centred and scrolled
   * to inside it.
   */
  readonly view: Insets;
  /** The pinch detent chip (05.11), beside the viewport. */
  readonly chipRef: RefObject<HTMLDivElement | null>;
  /** Mounted hidden ahead of a view change: scroll requests land at once. */
  readonly prepared: boolean;
  /** The zoom a resize made the fit follow to, which lands without the zoom morph. */
  readonly quietZoom: RefObject<number | null>;
}) {
  'use no memo'; // TanStack Virtual mutates its instance; the React Compiler must not cache it.
  const setCurrentPage = useViewStore((s) => s.setCurrentPage);
  const setVisibleRange = useViewStore((s) => s.setVisibleRange);
  const scrollRequest = useViewStore((s) => s.scrollRequest);
  const { sizes, rows } = layout;
  const pages = doc.pages;
  const heightOf = (r: number) => (rows[r]?.height ?? 792) * cssScale;
  const rowCssWidth = (r: number) => {
    const row = rows[r];
    return row ? row.width * cssScale + (row.pages.length - 1) * GAP : 0;
  };
  const canvasWidthAt = (scale: number) =>
    layout.maxWidth * scale + layout.maxGaps * GAP + PAD_X * 2 + view.left + view.right;
  const canvasWidth = canvasWidthAt(cssScale);
  /** Rows rendered beyond the overscan while a zoom gesture shrinks the column. */
  const [extraRows, setExtraRows] = useState(0);

  // Opted out of the compiler above ('use no memo'), so the instance is read fresh.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: (r) => heightOf(r) + GAP,
    getItemKey: (r) => {
      const first = rows[r]?.pages[0];
      return `${readLayout}:${(first === undefined ? undefined : pages[first]?.id) ?? r}`;
    },
    paddingStart: view.top + PAD_TOP,
    paddingEnd: view.bottom + PAD_BOTTOM - GAP,
    // Rows scrolled to the start or end stop at the unobscured rectangle's edges.
    scrollPaddingStart: view.top,
    scrollPaddingEnd: view.bottom,
    overscan: 2 + extraRows,
  });

  /** Canvas width as laid out (at least the viewport). */
  const laidOutWidth = (el: HTMLElement, width: number) => Math.max(el.clientWidth, width);
  /** The horizontal centre of the column the rows are centred in, between the side insets. */
  const columnCentre = (el: HTMLElement, width = canvasWidth) =>
    view.left + (laidOutWidth(el, width) - view.left - view.right) / 2;
  /** Height of the unobscured rectangle. */
  const visibleHeightOf = (el: HTMLElement) => el.clientHeight - view.top - view.bottom;
  /** Content offset of a row's top (`getOffsetForIndex` answers in scroll offsets). */
  const rowTopOf = (r: number) => {
    const offset = virtualizer.getOffsetForIndex(r, 'start')?.[0];
    return offset === undefined ? undefined : offset + view.top;
  };

  /** An anchor for the point at viewport position (vx, vy). */
  const anchorAt = (vx: number, vy: number): Anchor | null => {
    const el = viewportRef.current;
    if (!el) return null;
    const y = el.scrollTop + vy;
    let found: Anchor | null = null;
    for (const item of virtualizer.getVirtualItems()) {
      if (item.start <= y || found === null) {
        const height = Math.max(1, heightOf(item.index));
        found = {
          row: item.index,
          fraction: Math.min(1, Math.max(0, (y - item.start) / height)),
          viewportX: vx,
          viewportY: vy,
          fromCentre: el.scrollLeft + vx - columnCentre(el),
          scale: cssScale,
        };
      }
    }
    return found;
  };

  // Pending navigation target: cleared once the programmatic scroll goes quiet.
  const settleTimer = useRef(0);
  const armSettle = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      useViewStore.getState().setNavTarget(null);
    }, NAV_SETTLE_MS);
  };

  // Keep the anchored point in place across zoom changes: the pointer's, else the
  // viewport centre's (zoom buttons and keys), or its top edge while the zoom fits the
  // viewport (a window or panel resize); a view scrolled to the very top stays there.
  const anchor = useRef<Anchor | null>(null);
  const topAnchor = useRef<Anchor | null>(null);
  const pointerAnchor = useRef<Anchor | null>(null);
  /** The canvas zoom's `settled`, called once its zoom is laid out (use-canvas-zoom.ts). */
  const zoomSettled = useRef<(() => void) | null>(null);
  /** The zoom layer's clip and the layer (the column), for the canvas zoom and the morph. */
  const zoomFrameRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  /** The zoom morph in flight: its motion and the scale it was laid out at. */
  const morph = useRef<{ motion: Motion<readonly number[]>; scale: number } | null>(null);
  /** Ends the zoom morph where it is: the layer back to rest (a gesture takes over). */
  const endMorph = () => {
    const run = morph.current;
    if (!run) return;
    morph.current = null;
    run.motion.stop();
    const layer = layerRef.current;
    layer?.style.removeProperty('transform');
    layer?.style.removeProperty('transform-origin');
    zoomFrameRef.current?.removeAttribute('data-zooming');
    setExtraRows(0);
  };
  /**
   * The zoom morph (motion-2026-10 viewer.md §2): a zoom step, a zoom key or a chosen fit lays
   * the new zoom out at once, then the column, shown at the old size about the anchor by
   * `transform`, grows or shrinks into it on `--spring-quick`. A morph that interrupts another
   * starts from the size on screen. Only the transform moves (the canvas zoom's clip holds the
   * scroll extent); at rest nothing is left on the layer.
   */
  const startMorph = (el: HTMLElement, a: Anchor, from: number) => {
    const layer = layerRef.current;
    const frame = zoomFrameRef.current;
    if (!layer || !frame) return;
    let shown = from / cssScale;
    const running = morph.current;
    if (running) {
      shown = ((running.motion.value[0] ?? 1) * running.scale) / cssScale;
      running.motion.stop();
      morph.current = null;
    }
    if (Math.abs(shown - 1) < 1e-3) {
      endMorph();
      return;
    }
    // The anchored point at the new zoom, and where it showed before.
    const p = {
      x: columnCentre(el) + a.fromCentre * (cssScale / a.scale),
      y: (rowTopOf(a.row) ?? 0) + a.fraction * heightOf(a.row),
    };
    const at = { x: el.scrollLeft + a.viewportX, y: el.scrollTop + a.viewportY };
    const write = ([scale = 1, x = 0, y = 0]: readonly number[]) => {
      layer.style.transform = `translate(${x - scale * p.x}px, ${y - scale * p.y}px) scale(${scale})`;
    };
    frame.setAttribute('data-zooming', '');
    layer.style.transformOrigin = '0 0';
    if (shown < 1) {
      // Shrunk, the column must still cover the viewport: rows for the smallest scale shown.
      let shortest = Number.POSITIVE_INFINITY;
      for (const row of rows) shortest = Math.min(shortest, row.height * cssScale + GAP);
      const uncovered = el.clientHeight * (1 / Math.max(shown, 0.05) - 1);
      setExtraRows(Math.min(MAX_EXTRA_ROWS, Math.ceil(uncovered / Math.max(1, shortest))));
    }
    // Before paint: the first frame already shows the old size.
    write([shown, at.x, at.y]);
    const motion = animate([shown, at.x, at.y], [1, p.x, p.y], {
      spring: 'quick',
      onUpdate: write,
      onComplete: () => {
        if (morph.current?.motion === motion) endMorph();
      },
    });
    morph.current = { motion, scale: cssScale };
  };
  const lastScale = useRef(cssScale);
  useLayoutEffect(() => {
    if (lastScale.current === cssScale) return;
    const from = lastScale.current;
    lastScale.current = cssScale;
    virtualizer.measure();
    const el = viewportRef.current;
    // A jump's target was measured at the old zoom.
    if (el) cancelJump(el);
    const gesture = pointerAnchor.current !== null;
    const quiet =
      quietZoom.current !== null && Math.abs(quietZoom.current * CSS_PX_PER_PT - cssScale) < 1e-9;
    quietZoom.current = null;
    const fromTop = !gesture && fitting;
    const a = pointerAnchor.current ?? (fromTop ? topAnchor.current : anchor.current);
    pointerAnchor.current = null;
    // The canvas zoom's own motion holds the layer until this frame, or still runs.
    const held = zoomFrameRef.current?.hasAttribute('data-zooming') && morph.current === null;
    // The zoom layer drops its transform in this frame, the one that lays out the new zoom.
    zoomSettled.current?.();
    zoomSettled.current = null;
    if (!el || !a) return;
    if (fromTop && a.atTop) el.scrollTop = 0;
    else {
      const start = rowTopOf(a.row);
      if (start === undefined) return;
      el.scrollTop = start + a.fraction * heightOf(a.row) - a.viewportY;
      const ratio = cssScale / a.scale;
      el.scrollLeft = columnCentre(el) + a.fromCentre * ratio - a.viewportX;
    }
    if (gesture || quiet || held || prepared || reducedMotion()) endMorph();
    else startMorph(el, a, from);
  });
  useEffect(
    () => () => {
      morph.current?.motion.stop();
    },
    [],
  );

  // Current page, visible pages and the zoom anchor from the scroll position.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let frameId = 0;
    const update = () => {
      frameId = 0;
      // What the docked frame leaves free: the current page is the most visible one there.
      const top = el.scrollTop + view.top;
      const bottom = el.scrollTop + el.clientHeight - view.bottom;
      const items = virtualizer.getVirtualItems();
      // Current: the most visible row (the first on ties, so short pages read 1, 2, …).
      let current: (typeof items)[number] | undefined;
      let currentVisible = -1;
      let first = Number.POSITIVE_INFINITY;
      let last = -1;
      for (const item of items) {
        const visible = Math.min(item.end - GAP, bottom) - Math.max(item.start, top);
        if (visible > currentVisible + 0.5) {
          current = item;
          currentVisible = visible;
        }
        if (visible > 0) {
          for (const page of rows[item.index]?.pages ?? []) {
            first = Math.min(first, page);
            last = Math.max(last, page);
          }
        }
      }
      const midX = view.left + (el.clientWidth - view.left - view.right) / 2;
      const centre = anchorAt(midX, (top + bottom) / 2 - el.scrollTop);
      if (centre) anchor.current = centre;
      const edge = anchorAt(midX, view.top);
      if (edge) topAnchor.current = { ...edge, atTop: el.scrollTop <= 0 };
      const page = current ? rows[current.index]?.pages[0] : undefined;
      if (page === undefined) return;
      setCurrentPage(page);
      if (last >= 0) setVisibleRange(first, last);
      else setVisibleRange(page, page);
    };
    const onScroll = () => {
      if (frameId === 0) frameId = requestAnimationFrame(update);
      // A programmatic scroll is still moving: wait for it to go quiet.
      if (useViewStore.getState().navTarget !== null) armSettle();
    };
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frameId !== 0) cancelAnimationFrame(frameId);
    };
  });

  // The user scrolling by hand abandons a pending navigation target (see view-store).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const abandon = () => {
      cancelJump(el);
      endMorph();
      window.clearTimeout(settleTimer.current);
      useViewStore.getState().setNavTarget(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // Only keys that scroll natively; `[` `]` PageUp PageDown Space Home End are commands.
      if (event.key.startsWith('Arrow')) abandon();
    };
    el.addEventListener('wheel', abandon, { passive: true });
    el.addEventListener('touchstart', abandon, { passive: true });
    el.addEventListener('pointerdown', abandon);
    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('wheel', abandon);
      el.removeEventListener('touchstart', abandon);
      el.removeEventListener('pointerdown', abandon);
      el.removeEventListener('keydown', onKeyDown);
    };
  });
  useEffect(
    () => () => {
      window.clearTimeout(settleTimer.current);
      useViewStore.getState().setNavTarget(null);
    },
    [],
  );

  // The canvas zoom (05-canvas §4): pinch, trackpad pinch, Mod+wheel and the touch double tap
  // scale the column by transform, and commit here once at rest.
  /** Where scroll offsets must go for anchor `a` at `scale`, and where the browser clamps them. */
  const scrollFor = (el: HTMLElement, a: Anchor, scale: number) => {
    let rowTop = view.top + PAD_TOP;
    let total = rowTop + view.bottom + PAD_BOTTOM - GAP;
    rows.forEach((row, r) => {
      const step = row.height * scale + GAP;
      if (r < a.row) rowTop += step;
      total += step;
    });
    const width = canvasWidthAt(scale);
    const wantTop = rowTop + a.fraction * (rows[a.row]?.height ?? 792) * scale - a.viewportY;
    const wantLeft = columnCentre(el, width) + a.fromCentre * (scale / a.scale) - a.viewportX;
    return {
      wantTop,
      wantLeft,
      top: clamp(wantTop, 0, Math.max(0, total - el.clientHeight)),
      left: clamp(wantLeft, 0, Math.max(0, laidOutWidth(el, width) - el.clientWidth)),
    };
  };
  /** The anchor of column point `p` (CSS px at this zoom), wanted at column position `at`. */
  const anchorOf = (el: HTMLElement, p: Point, at: Point): Anchor | null => {
    const a = anchorAt(p.x - el.scrollLeft, p.y - el.scrollTop);
    return a && { ...a, viewportX: at.x - el.scrollLeft, viewportY: at.y - el.scrollTop };
  };
  const zoomColumn = useRef<ZoomColumn | null>(null);
  useLayoutEffect(() => {
    zoomColumn.current = {
      bounds() {
        const { zoom } = useUiStore.getState();
        const el = viewportRef.current;
        const fits = el ? fitZooms(el, view, layout) : { width: zoom, page: zoom };
        return { zoom, min: MIN_ZOOM, max: MAX_ZOOM, fitWidth: fits.width, fitPage: fits.page };
      },
      landing(zoom, p, at) {
        const el = viewportRef.current;
        const a = el ? anchorOf(el, p, at) : null;
        if (!el || !a) return at;
        const next = scrollFor(el, a, zoom * CSS_PX_PER_PT);
        return { x: at.x + next.wantLeft - next.left, y: at.y + next.wantTop - next.top };
      },
      commit(rest: ZoomRest, p, at, settled) {
        const el = viewportRef.current;
        const ui = useUiStore.getState();
        const a = el ? anchorOf(el, p, at) : null;
        const nextScale = clamp(rest.zoom, MIN_ZOOM, MAX_ZOOM) * CSS_PX_PER_PT;
        if (!el || !a || Math.abs(nextScale - cssScale) < 1e-9) {
          // The zoom does not change: no layout to wait for.
          if (el && a) {
            const next = scrollFor(el, a, cssScale);
            el.scrollTop = next.top;
            el.scrollLeft = next.left;
          }
          settled();
        } else {
          pointerAnchor.current = a;
          zoomSettled.current = settled;
        }
        // One update: the zoom, and the fit it snapped to, so the fit follows resizes.
        if (rest.fit === null) ui.setZoom(rest.zoom);
        else {
          ui.applyFitZoom(rest.zoom);
          if (rest.fit === 'width') ui.zoomFit();
          else ui.zoomFitPage();
        }
      },
      extend(minScale) {
        const el = viewportRef.current;
        if (!el || minScale >= 1) {
          setExtraRows(0);
          return;
        }
        let shortest = Number.POSITIVE_INFINITY;
        for (const row of rows) shortest = Math.min(shortest, row.height * cssScale + GAP);
        const uncovered = el.clientHeight * (1 / Math.max(minScale, 0.05) - 1);
        setExtraRows(Math.min(MAX_EXTRA_ROWS, Math.ceil(uncovered / Math.max(1, shortest))));
      },
      enterGrid(p) {
        const el = viewportRef.current;
        const a = el ? anchorAt(p.x - el.scrollLeft, p.y - el.scrollTop) : null;
        const row = rows[a?.row ?? -1];
        const index = row?.pages[0] ?? useViewStore.getState().currentPage;
        const page = pages[index];
        if (page) enterPagesGrid(page.id);
      },
    };
  });
  useCanvasZoom(
    { viewport: viewportRef, frame: zoomFrameRef, layer: layerRef, chip: chipRef },
    zoomColumn as RefObject<ZoomColumn>,
  );

  /** A page to show once the single-page layout has switched to it. */
  const pendingReveal = useRef<{
    index: number;
    reveal: Rect | undefined;
    motion: ScrollMotion;
  } | null>(null);
  /** When the column mounted: a request in its first moments lands at once (a view change). */
  const mountedAt = useRef(performance.now());

  /**
   * Brings page `index` into view; `reveal` (user space) scrolls minimally to a region. A jump
   * or a step travels there on the eased jump (`viewer/jump.ts`, motion-2026-10 viewer.md §1),
   * and a jump then highlights the page or the region it landed on (`viewer/landing.ts`).
   */
  const showPage = (index: number, reveal?: Rect, motion: ScrollMotion = 'instant') => {
    const el = viewportRef.current;
    if (!el) return;
    if (readLayout === 'single' && layout.rowOf[index] !== 0) {
      // The single row shows the current page: switch it, then scroll once laid out.
      setCurrentPage(index);
      pendingReveal.current = { index, reveal, motion };
      return;
    }
    const r = layout.rowOf[index] ?? -1;
    if (r < 0) return;
    const page = pages[index];
    const size = sizes[index];
    const row = rows[r];
    const rowTop = rowTopOf(r);
    if (!page || !size || !row || rowTop === undefined) return;
    let target = { top: rowTop - view.top, left: el.scrollLeft };
    let box: Box | undefined;
    if (reveal !== undefined) {
      const frame = pageFrame({
        sourceId: page.ref.kind === 'source' ? page.ref.source : undefined,
        sourceIndex: page.ref.kind === 'source' ? page.ref.index : 0,
        sizePt: size,
        rotation: pageTotalRotation(ws, page),
        cssScale,
        page,
      });
      box = userRectToCss(frame, reveal);
      target = revealScroll(el, r, index, box);
    }
    const instant =
      motion === 'instant' || prepared || performance.now() - mountedAt.current < MOUNT_INSTANT_MS;
    if (instant) {
      cancelJump(el);
      el.scrollTop = target.top;
      el.scrollLeft = target.left;
      return;
    }
    void jumpScroll(el, target, { layer: layerRef.current }).then((landed) => {
      if (landed && motion === 'jump') void landOn(page.id, box);
    });
  };

  /** The scroll position that shows `box` (CSS px on page `index` of row `r`), minimally. */
  const revealScroll = (el: HTMLElement, r: number, index: number, box: Box) => {
    const row = rows[r];
    const top = (rowTopOf(r) ?? 0) + box.top;
    const bottom = top + box.height;
    // Inside the unobscured rectangle.
    const visibleHeight = visibleHeightOf(el);
    const visibleWidth = el.clientWidth - view.left - view.right;
    // Measured from where a running jump is heading, so a second reveal composes.
    const viewTop = el.scrollTop + view.top;
    const margin = Math.min(96, visibleHeight / 4);
    let scrollTop = el.scrollTop;
    if (top < viewTop + margin || bottom > viewTop + visibleHeight - margin) {
      scrollTop = Math.max(0, top - view.top - visibleHeight / 3);
    }
    // Horizontally: rows are centred in the column between the side insets.
    let x = columnCentre(el) - rowCssWidth(r) / 2;
    for (const i of row?.pages ?? []) {
      if (i === index) break;
      x += (sizes[i]?.width ?? 0) * cssScale + GAP;
    }
    const left = x + box.left;
    const right = left + box.width;
    const viewLeft = el.scrollLeft + view.left;
    let scrollLeft = el.scrollLeft;
    if (left < viewLeft + 16 || right > viewLeft + visibleWidth - 16) {
      scrollLeft = Math.max(0, left - view.left - visibleWidth / 3);
    }
    return { top: scrollTop, left: scrollLeft };
  };

  /** Highlights the landed page (or its `box`) once its row is laid out. */
  const landOn = async (pageId: string, box: Box | undefined) => {
    for (let frame = 0; frame < LANDING_WAIT_FRAMES; frame++) {
      const sheet = zoomFrameRef.current?.querySelector<HTMLElement>(
        `[data-page-id="${CSS.escape(pageId)}"]`,
      );
      if (sheet) {
        flashLanding(sheet, box);
        return;
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  };

  // An undo or redo flashes what it changed (`recto:history-applied`, frame.md §6): the landing
  // of the jump that brought it into view gives way.
  useEffect(() => {
    const onApplied = () => {
      const frame = zoomFrameRef.current;
      if (frame) clearLandings(frame);
    };
    window.addEventListener('recto:history-applied', onApplied);
    return () => window.removeEventListener('recto:history-applied', onApplied);
  }, []);

  useEffect(() => {
    const pending = pendingReveal.current;
    if (!pending || layout.rowOf[pending.index] !== 0) return;
    pendingReveal.current = null;
    if (pending.reveal) showPage(pending.index, pending.reveal, pending.motion);
    else {
      viewportRef.current?.scrollTo({ top: 0 });
      const page = pages[pending.index];
      if (page && pending.motion === 'jump' && !prepared) void landOn(page.id, undefined);
    }
  });

  // Scroll-to-page requests (Pages panel, outline, links, search, go to page).
  const handledRequest = useRef(scrollRequest?.serial ?? 0);
  useEffect(() => {
    if (!scrollRequest || scrollRequest.serial === handledRequest.current) return;
    handledRequest.current = scrollRequest.serial;
    const index = pages.findIndex((p) => p.id === scrollRequest.pageId);
    if (index < 0) return;
    showPage(index, scrollRequest.reveal, scrollRequest.motion ?? 'jump');
    // Relative moves step from here until the scroll settles (navigation.ts).
    useViewStore.getState().setNavTarget(index);
    armSettle();
  });

  // A layout switch keeps the current page in view.
  const lastLayout = useRef(readLayout);
  useLayoutEffect(() => {
    if (lastLayout.current === readLayout) return;
    lastLayout.current = readLayout;
    const current = useViewStore.getState().currentPage;
    if (viewportRef.current) cancelJump(viewportRef.current);
    virtualizer.measure();
    if (readLayout === 'single') viewportRef.current?.scrollTo({ top: 0 });
    else {
      const r = layout.rowOf[current] ?? 0;
      virtualizer.scrollToIndex(r, { align: 'start' });
    }
  });

  // On mount: a selection shows its first page; otherwise the remembered position. The page is
  // chosen once per mount and kept in a ref: React's development StrictMode runs this effect,
  // cleans up and runs it again on the same instance, and the second run must show the page
  // again (the first run's scroll is undone), not find the position already applied.
  const firstPage = useRef<number | null>(null);
  useEffect(() => {
    if (firstPage.current === null) {
      const { selected } = useSelectionStore.getState();
      const selectedIndex = selected.size > 0 ? pages.findIndex((p) => selected.has(p.id)) : -1;
      let index = selectedIndex > 0 ? selectedIndex : -1;
      if (index < 0 && fingerprint !== undefined && !restored.has(doc.id)) {
        const remembered = recallPosition(fingerprint);
        if (remembered !== undefined && remembered > 0 && remembered < pages.length) {
          index = remembered;
        }
      }
      firstPage.current = index;
      restored.add(doc.id);
    }
    if (firstPage.current > 0) showPage(firstPage.current);
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Commands that act on the viewport (PageUp / PageDown / Space).
  useEffect(() => {
    setReadController({
      scrollByScreen: (direction) => {
        const el = viewportRef.current;
        if (!el) return;
        const step = Math.max(40, visibleHeightOf(el) - 48);
        // A screen step in flight composes: the next one starts from where it is heading.
        let from = jumpTarget(el)?.top ?? el.scrollTop;
        const view = useViewStore.getState();
        const pending = view.navTarget;
        if (readLayout === 'single') {
          const atEnd =
            direction > 0
              ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2
              : el.scrollTop <= 1;
          const current = pending ?? view.currentPage;
          const target = current + direction;
          if (atEnd && target >= 0 && target < pages.length) {
            cancelJump(el);
            setCurrentPage(target);
            view.setNavTarget(target);
            armSettle();
            pendingReveal.current = { index: target, reveal: undefined, motion: 'instant' };
            requestAnimationFrame(() => {
              if (direction < 0) el.scrollTop = el.scrollHeight;
            });
            return;
          }
        } else if (pending !== null) {
          // A page jump is in flight: move a screen from its target.
          const r = layout.rowOf[pending] ?? -1;
          const start = r >= 0 ? virtualizer.getOffsetForIndex(r, 'start')?.[0] : undefined;
          if (start !== undefined) from = start;
        }
        window.clearTimeout(settleTimer.current);
        view.setNavTarget(null);
        void jumpScroll(el, { top: from + direction * step, left: el.scrollLeft });
      },
      ownsFocus: () => {
        // The pages themselves or nowhere; never a control (a focused link hotspot keeps
        // Space and Enter).
        const active = document.activeElement;
        return !active || active === document.body || active === viewportRef.current;
      },
    });
    return () => setReadController(null);
  });

  const items = virtualizer.getVirtualItems();
  const el = viewportRef.current;
  const viewTop = el?.scrollTop ?? 0;
  const viewBottom = viewTop + (el?.clientHeight ?? 0);
  const labels = documentLabels(ws, doc);
  const dpr = window.devicePixelRatio || 1;

  return (
    // The zoom layer (the column) inside its clip (ReadView.module.css `.zoomFrame`).
    <div
      ref={zoomFrameRef}
      className={readStyles.zoomFrame}
      data-zoom-frame
      style={{ height: virtualizer.getTotalSize(), width: canvasWidth }}
    >
      <div
        ref={layerRef}
        className={styles.readCanvas}
        style={{ height: virtualizer.getTotalSize(), width: canvasWidth }}
      >
        {items.map((item) => {
          const row = rows[item.index];
          if (!row) return null;
          const rowVisible = item.end > viewTop && item.start < viewBottom;
          return (
            <div
              key={item.key}
              className={styles.readItem}
              data-row={item.index}
              style={{
                // On whole device pixels: a fractional offset left the page bitmaps, drawn 1:1,
                // and any glass on a page between pixels (quality-bar Q-2).
                transform: `translateY(${Math.round(item.start * dpr) / dpr}px)`,
                left: view.left,
                width: `calc(100% - ${view.left + view.right}px)`,
                height: heightOf(item.index),
                gap: GAP,
              }}
            >
              {row.pages.map((index) => {
                const page = pages[index];
                const size = sizes[index];
                if (!page || !size) return null;
                // Whole device pixels, matching the exact-scale bitmap (drawn 1:1).
                const { width, height } = sheetSize(size.width, size.height, cssScale, dpr);
                const total = pageTotalRotation(ws, page);
                const sourceId = page.ref.kind === 'source' ? page.ref.source : undefined;
                const sourceIndex = page.ref.kind === 'source' ? page.ref.index : 0;
                const name = `${m.cell_label({ position: index + 1, count: pages.length })}${rotationPhrase(total)}`;
                const label = labels[index];
                const textual = sourceId !== undefined;
                const resized = resizedLayoutOf(ws, page, { width, height }, dpr);
                // The bitmap covers the content box: the page's own, or the resized one's.
                const contentPt = resized?.contentPt ?? size;
                const contentScale = resized?.contentScale ?? cssScale;
                const tiled =
                  textual &&
                  rowVisible &&
                  resized?.stretched !== true &&
                  needsTiles(contentScale, contentPt.width, contentPt.height);
                return (
                  <div
                    key={page.id}
                    role={textual ? 'region' : 'img'}
                    aria-label={
                      label !== undefined && label !== String(index + 1)
                        ? `${name} (${m.viewer_page_label({ label })})`
                        : name
                    }
                    className={styles.page}
                    data-page-id={page.id}
                    data-page-index={index}
                    data-resized={resized === undefined ? undefined : ''}
                    style={{ width, height, ...(resized?.overflows ? { overflow: 'hidden' } : {}) }}
                  >
                    <ResizedContent frame={resized?.box} unit="px">
                      <PageCanvas
                        sourceId={sourceId}
                        blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
                        index={sourceIndex}
                        rotation={page.rotation}
                        widthPt={contentPt.width}
                        heightPt={contentPt.height}
                        cssWidth={resized?.box.width ?? width}
                        exact={resized?.stretched !== true}
                        priority={rowVisible ? RENDER_PRIORITY.page : RENDER_PRIORITY.offscreen}
                        delayMs={ZOOM_RENDER_DELAY_MS}
                      />
                      {tiled && sourceId !== undefined ? (
                        <TiledPage
                          sourceId={sourceId}
                          index={sourceIndex}
                          rotation={page.rotation}
                          frame={pageFrame({
                            sourceId,
                            sourceIndex,
                            sizePt: contentPt,
                            rotation: total,
                            cssScale: contentScale,
                          })}
                        />
                      ) : null}
                    </ResizedContent>
                    <PageOverlays
                      page={page}
                      pageId={page.id}
                      pageIndex={index}
                      sourceId={sourceId}
                      sourceIndex={sourceIndex}
                      sizePt={size}
                      cssScale={cssScale}
                      rotation={total}
                      visible={rowVisible}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
