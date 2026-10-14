/**
 * The phone's page overview (MOB-2; `docs/research/phone-2026-10/pinch-overview.md` §2.1):
 * Pages as a place over the reader, not a drawer. Every page as a tile in 2 · 3 · 4 columns
 * over the aura, and one floating glass bar (the page count and Done).
 *
 * - **Ways in:** a pinch below fit width in the reader (the page follows the fingers down into
 *   its tile, `morph.ts`), or the capsule's Pages button (the same morph by itself).
 * - **Ways out:** a tap on a tile, a spread on it past the largest tiles (the chip says
 *   "Release to open page 7"), Done or Esc: the page grows back out of its tile.
 * - **Columns:** two fingers step 2 · 3 · 4 columns (proportionally more on a phone on its
 *   side, `columnsFor`), one step per ×1.4, keeping the tile under
 *   the fingers where it is (the grid's plane springs from the old place to the new on
 *   `smooth`, a FLIP; instant under reduced motion). The count is kept for the session.
 * - **Virtualised:** only the rows of the viewport and one screen above and below mount. The
 *   thumbnails draw the best bitmap the cache holds at once (the reader's own for the pages
 *   just read) and ask for their small render once the morph has landed.
 * - **Accessibility:** the tiles are buttons named "Page 3 of 12" in a list named Pages; focus
 *   lands on the current page's tile and returns to the pages on the way out; the column
 *   steps are announced. One finger scrolls natively (`touch-action: pan-y`).
 * - **Seams for MOB-3:** tiles carry their page id (`data-tile-page-id`) and their selected
 *   state from `selection.ts`, a tap asks `tileTap()` what it does, and the bar has the slot
 *   where the selection's actions and Add · Share go.
 */
import type { VirtualDocument, VirtualPage, Workspace } from '@pdf-editor/document-model';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { RENDER_PRIORITY } from '../../../engine/engine-service';
import { m } from '../../../i18n';
import { reducedMotion } from '../../../motion/reduced-motion';
import { springToLinear } from '../../../motion/springs';
import { PageCanvas } from '../../../pages/PageCanvas';
import { displaySize } from '../../../pages/page-geometry';
import chipStyles from '../../../stage/PinchDetentChip.module.css';
import { contentFrame, ResizedContent } from '../../../stage/ResizedContent';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { Button } from '../../../ui/Button';
import { CheckBadge } from '../../../ui/CheckBadge';
import { Icon } from '../../../ui/Icon';
import { Surface } from '../../../ui/Surface';
import { documentLabels } from '../../../viewer/navigation';
import { announce } from '../../announcer';
import { useSafeAreaInsets } from '../../frame/frame-insets';
import { type OverviewPhase, setOverviewColumns, useCompactStore } from '../compact-store';
import { type OverviewColumns, overviewPinch } from '../overview-gesture';
import styles from './CompactOverview.module.css';
import { OverviewBar } from './OverviewBar';
import { affineCss, fitOnto, IDENTITY, project } from './morph-geometry';
import {
  closeOverview,
  registerOverviewChip,
  registerOverviewDom,
  showChip,
  takeEntryY,
} from './morph';
import {
  type Box,
  columnsFor,
  type GridFrame,
  type GridLayout,
  gridLayout,
  pageAtPoint,
  rowsInView,
  scrollToCentre,
  slotBox,
  tileBox,
} from './overview-layout';
import {
  clearSelection,
  setSelecting,
  tileTap,
  togglePage,
  useOverviewSelection,
} from './selection';
import { takeSwallowedClick, watchTilePresses } from './tile-press';

/** The bar's height and its least distance from the bottom edge (the capsule's, Q-9). */
const BAR_HEIGHT = 56;
const BAR_OFFSET = 12;
/** Room between the grid's last row and the bar, and above its first row. */
const GRID_END = 16;
const GRID_TOP = 8;
/** Thumbnails wait this long for their own render while the morph moves, ms. */
const MORPH_RENDER_DELAY_MS = 400;

export function CompactOverview({ doc }: { readonly doc: VirtualDocument }) {
  const phase = useCompactStore((s) => s.overview);
  const rootRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  const chipTextRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const chip = chipRef.current;
    const text = chipTextRef.current;
    if (!root || !chip || !text) return;
    return registerOverviewChip({ root, chip, text });
  }, []);

  // The selection belongs to the overview: it clears when the overview closes.
  useEffect(() => {
    if (phase === 'closed') clearSelection();
  }, [phase]);

  return (
    <div ref={rootRef} className={styles.root} data-phase={phase} data-testid="compact-overview">
      {phase === 'closed' ? null : <OverviewPlace doc={doc} phase={phase} rootRef={rootRef} />}
      {/* The pinch chip (05-canvas §4): "Release to see all pages" in the reader's pinch,
          "Release to open page 7" in the overview's. Decorative: each way announces itself. */}
      <Surface
        tier="chip"
        sigma={7}
        coarse={8}
        ref={chipRef}
        className={chipStyles.chip}
        data-testid="compact-overview-chip"
        aria-hidden
        hidden
      >
        <Icon name="squares-four" className={chipStyles.icon} />
        <span ref={chipTextRef} />
      </Surface>
    </div>
  );
}

interface PendingStep {
  /** The tile the fingers hold, and its box on screen before the step. */
  readonly index: number;
  readonly before: Box;
  /** The fingers' height, which the tile's middle keeps. */
  readonly y: number;
}

function OverviewPlace({
  doc,
  phase,
  rootRef,
}: {
  readonly doc: VirtualDocument;
  readonly phase: OverviewPhase;
  readonly rootRef: RefObject<HTMLDivElement | null>;
}) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const columns = useCompactStore((s) => s.overviewColumns);
  const anchor = useCompactStore((s) => s.overviewAnchor);
  const selected = useOverviewSelection((s) => s.selected);
  const selecting = useOverviewSelection((s) => s.selecting);
  const insets = useSafeAreaInsets();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const othersRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const frame: GridFrame = {
    width: size.width,
    height: size.height,
    insetLeft: insets.left,
    insetRight: insets.right,
    padTop: Math.max(insets.top, BAR_OFFSET) + GRID_TOP,
    padBottom: BAR_HEIGHT + Math.max(insets.bottom, BAR_OFFSET) + GRID_END,
  };
  const count = doc.pages.length;
  const sizes = doc.pages.map((page) => displaySize(ws, page));
  const layout = gridLayout(count, frame, columnsFor(columns, size.width));
  const labels = documentLabels(ws, doc);
  // The grid opens with the anchor's tile where the morph asked (under the page or the
  // fingers), else in the middle.
  const [scrollTop, setScrollTop] = useState(() =>
    scrollToCentre(layout, anchor, takeEntryY() ?? size.height / 2, size.height),
  );

  const ids = doc.pages.map((page) => page.id);
  const latest = useRef({ layout, sizes, count, ids });
  useLayoutEffect(() => {
    latest.current = { layout, sizes, count, ids };
  });

  // The first position, before the first paint.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = scrollTop;
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lends the elements and the geometry to the morph.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const scroller = scrollerRef.current;
    const plane = planeRef.current;
    const others = othersRef.current;
    const bar = barRef.current;
    if (!root || !scroller || !plane || !others || !bar) return;
    return registerOverviewDom({
      root,
      scroller,
      plane,
      others,
      bar,
      tileBox: (index) => {
        const { layout: current, sizes: s } = latest.current;
        const pageSize = s[index];
        return pageSize ? tileBox(current, index, pageSize) : null;
      },
      tileButton: (index) =>
        plane.querySelector<HTMLElement>(`button[data-tile-index="${index}"]`) ?? null,
      pageCount: () => latest.current.count,
    });
  }, [rootRef]);

  // The scroller's size and scroll position: the rows to mount.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frameId = 0;
    const read = () => {
      frameId = 0;
      setScrollTop(el.scrollTop);
    };
    const onScroll = () => {
      if (frameId === 0) frameId = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(() => {
      setSize((s) =>
        s.width === el.clientWidth && s.height === el.clientHeight
          ? s
          : { width: el.clientWidth, height: el.clientHeight },
      );
    });
    observer.observe(el);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', onScroll);
      if (frameId !== 0) cancelAnimationFrame(frameId);
    };
  }, []);

  // Esc ends a selection, else goes back to the page that was read (as Done).
  useEffect(() => {
    if (phase !== 'open') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      if (useOverviewSelection.getState().selecting) setSelecting(false);
      else closeOverview();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase]);

  // A column step keeps the tile under the fingers: its middle stays at the fingers' height,
  // and the plane springs from the tile's old box to the new one (FLIP).
  const pending = useRef<PendingStep | null>(null);
  // The tiles the fingers landed on stay mounted until they lift, whatever the steps scroll
  // away: a touch whose target leaves the document stops reaching the grid's listeners.
  const [held, setHeld] = useState<readonly number[]>([]);
  const markerRef = useRef<HTMLDivElement>(null);

  // One finger on a tile: a tap, a long press (select) or a long press and move (drag).
  useEffect(() => {
    const scroller = scrollerRef.current;
    const plane = planeRef.current;
    const marker = markerRef.current;
    if (!scroller || !plane || !marker) return;
    return watchTilePresses({
      scroller,
      plane,
      marker,
      layout: () => latest.current.layout,
      pageIds: () => latest.current.ids,
      hold: (indexes) => setHeld(indexes),
    });
  }, []);
  useLayoutEffect(() => {
    const step = pending.current;
    const el = scrollerRef.current;
    const plane = planeRef.current;
    pending.current = null;
    if (!step || !el || !plane) return;
    const top = scrollToCentre(layout, step.index, step.y, size.height);
    el.scrollTop = top;
    setScrollTop(top);
    const pageSize = sizes[step.index];
    if (!pageSize || reducedMotion()) return;
    const tile = tileBox(layout, step.index, pageSize);
    const rect = plane.getBoundingClientRect();
    const from = fitOnto(tile, { x: rect.left, y: rect.top }, step.before);
    const curve = springToLinear('smooth');
    plane.animate([{ transform: affineCss(from) }, { transform: affineCss(IDENTITY) }], {
      duration: curve.duration,
      easing: curve.easing,
    });
    // Runs for each column step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]);

  // Two fingers step the columns; past the largest tiles a release dives into the page.
  useEffect(() => {
    const el = scrollerRef.current;
    const plane = planeRef.current;
    if (!el || !plane) return;
    let pinch: {
      readonly distance: number;
      readonly start: OverviewColumns;
      readonly index: number;
      dives: boolean;
    } | null = null;
    const measure = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      if (!a || !b) return null;
      return {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      };
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
      const targets: number[] = [];
      for (const touch of Array.from(event.touches)) {
        const tile =
          touch.target instanceof Element ? touch.target.closest('[data-tile-index]') : null;
        if (tile instanceof HTMLElement) targets.push(Number(tile.dataset.tileIndex));
      }
      setHeld(targets);
      const fingers = measure(event.touches);
      const state = useCompactStore.getState();
      if (!fingers || fingers.distance <= 0 || state.overview !== 'open') return;
      const rect = plane.getBoundingClientRect();
      pinch = {
        distance: fingers.distance,
        start: state.overviewColumns,
        index: pageAtPoint(latest.current.layout, fingers.x - rect.left, fingers.y - rect.top),
        dives: false,
      };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch || event.touches.length < 2) return;
      event.preventDefault();
      const fingers = measure(event.touches);
      if (!fingers) return;
      const { columns: next, dives } = overviewPinch(
        pinch.start,
        fingers.distance / pinch.distance,
      );
      pinch.dives = dives;
      showChip(dives ? m.grid_pinch_open({ page: pinch.index + 1 }) : null, fingers);
      if (next === useCompactStore.getState().overviewColumns) return;
      const { layout: current, sizes: s } = latest.current;
      const pageSize = s[pinch.index];
      if (pageSize) {
        const rect = plane.getBoundingClientRect();
        pending.current = {
          index: pinch.index,
          before: project(
            IDENTITY,
            { x: rect.left, y: rect.top },
            tileBox(current, pinch.index, pageSize),
          ),
          y: fingers.y - el.getBoundingClientRect().top,
        };
      }
      setOverviewColumns(next);
      const shown = columnsFor(next, el.clientWidth);
      announce(m.compact_overview_columns({ count: shown }), { key: 'overview-columns' });
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) setHeld([]);
      if (!pinch || event.touches.length >= 2) return;
      const ended = pinch;
      pinch = null;
      showChip(null);
      if (ended.dives) closeOverview(ended.index);
    };
    // Safari's own pinch would zoom the whole page.
    const onGesture = (event: Event) => event.preventDefault();
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('gesturestart', onGesture);
    el.addEventListener('gesturechange', onGesture);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
    };
  }, []);

  const rows = rowsInView(layout, scrollTop, size.height, size.height);
  const indexes: number[] = [];
  for (let i = rows.first * layout.columns; i < (rows.last + 1) * layout.columns; i++) {
    indexes.push(i);
  }
  for (const i of held) if (!indexes.includes(i)) indexes.push(i);
  const tiles = [];
  let anchorTile = null;
  for (const index of indexes) {
    const page = doc.pages[index];
    const pageSize = sizes[index];
    if (!page || !pageSize) continue;
    const tile = (
      <Tile
        key={page.id}
        ws={ws}
        page={page}
        index={index}
        count={count}
        label={labels[index] ?? String(index + 1)}
        current={index === anchor}
        selected={selected.has(page.id)}
        selecting={selecting}
        layout={layout}
        size={pageSize}
        settled={phase === 'open'}
      />
    );
    // While the morph moves, the anchor's tile stands apart from the fading tiles (the reader's
    // page covers it); at rest it is back in reading order.
    if (index === anchor && phase === 'morph') anchorTile = tile;
    else tiles.push(tile);
  }

  return (
    <>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        data-testid="compact-overview-grid"
        data-columns={columns}
      >
        <div
          ref={planeRef}
          className={styles.plane}
          role="list"
          aria-label={m.compact_pages()}
          data-testid="compact-overview-plane"
          style={{ height: layout.height }}
        >
          <div ref={othersRef} className={styles.others} role="none">
            {tiles}
          </div>
          {anchorTile}
          <div ref={markerRef} className={styles.dropBar} aria-hidden="true" hidden />
        </div>
      </div>
      <Surface
        tier="bar"
        sigma={10}
        ref={barRef}
        className={styles.bar}
        data-testid="compact-overview-bar"
      >
        <OverviewBar doc={doc} anchor={anchor} />
      </Surface>
    </>
  );
}

function Tile({
  ws,
  page,
  index,
  count,
  label,
  current,
  selected,
  selecting,
  layout,
  size,
  settled,
}: {
  readonly ws: Workspace;
  readonly page: VirtualPage;
  readonly index: number;
  readonly count: number;
  readonly label: string;
  readonly current: boolean;
  readonly selected: boolean;
  readonly selecting: boolean;
  readonly layout: GridLayout;
  readonly size: { readonly width: number; readonly height: number };
  readonly settled: boolean;
}) {
  const slot = slotBox(layout, index);
  const box = tileBox(layout, index, size);
  const frame = contentFrame(ws, page);
  const sourceId = page.ref.kind === 'source' ? page.ref.source : undefined;
  const name =
    label !== String(index + 1)
      ? m.cell_label_with_label({ position: index + 1, label, count })
      : m.cell_label({ position: index + 1, count });
  const onClick = () => {
    // A long press's click is the long press's (it selected the page).
    if (takeSwallowedClick()) return;
    if (tileTap() === 'toggle') {
      const turnedOn = !useOverviewSelection.getState().selected.has(page.id);
      togglePage(page.id);
      announce(
        turnedOn
          ? m.compact_overview_page_selected({ number: index + 1 })
          : m.compact_overview_page_unselected({ number: index + 1 }),
        { key: 'overview-selection' },
      );
    } else closeOverview(index);
  };
  return (
    <div
      role="listitem"
      className={styles.tile}
      data-anchor={current || undefined}
      style={{ left: slot.left, top: slot.top, width: slot.width }}
    >
      <Button
        variant="quiet"
        className={styles.tileButton}
        style={{ height: slot.height }}
        aria-label={name}
        aria-current={current ? 'page' : undefined}
        data-tile-index={index}
        data-tile-page-id={page.id}
        aria-pressed={selecting ? selected : undefined}
        data-selected={selected || undefined}
        onClick={onClick}
      >
        <span
          className={styles.thumb}
          style={{
            left: box.left - slot.left,
            top: box.top - slot.top,
            width: box.width,
            height: box.height,
          }}
        >
          <ResizedContent frame={frame}>
            <PageCanvas
              sourceId={sourceId}
              blobId={page.ref.kind === 'image' ? page.ref.blob : undefined}
              index={page.ref.kind === 'source' ? page.ref.index : 0}
              rotation={page.rotation}
              widthPt={frame?.widthPt ?? size.width}
              heightPt={frame?.heightPt ?? size.height}
              cssWidth={frame ? frame.width * box.width : box.width}
              priority={settled ? RENDER_PRIORITY.visible : RENDER_PRIORITY.offscreen}
              delayMs={settled ? 0 : MORPH_RENDER_DELAY_MS}
            />
          </ResizedContent>
          {selecting ? <CheckBadge checked={selected} className={styles.badge} /> : null}
        </span>
      </Button>
      <span className={styles.label} aria-hidden="true" data-current={current || undefined}>
        {label}
      </span>
    </div>
  );
}
