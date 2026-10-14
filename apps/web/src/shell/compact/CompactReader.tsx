/**
 * The compact reader (ADR-0033 §2.3 "Reading"): the open document as one continuous column
 * of pages at fit width, with gaps, scrolled natively.
 *
 * - **Pinch** scales the page stage with a transform while the fingers move (no page is
 *   re-laid out or re-rendered during the gesture); when they lift, the stage settles onto
 *   the layout the new zoom gives, keeping the point between the fingers in place, and the
 *   layout is committed with nothing moving. The pages then render sharp at the new scale
 *   after a short debounce (`PageCanvas`).
 * - **Pinch out to see every page** (MOB-2): a pinch that starts at fit width and closes past
 *   it hands its progress to the page overview's morph (`overview/morph.ts`): the page follows
 *   the fingers down into its tile, armed 15 % below fit, and the release settles into the
 *   grid or back. A pinch from a zoom clamps at fit as before; while editing, or before the
 *   overview's chunk has arrived, or under reduced motion, the pinch rubber-bands and an armed
 *   release opens the overview by the button's path.
 * - **Double tap** toggles fit ⇄ 2× about the tapped point, through the same settle.
 * - **A single tap** on the page toggles the chrome, once the double-tap window has passed;
 *   a tap on a link, a note or a control is theirs, and a tap that clears a text selection
 *   is not a toggle.
 * - **Scrolling** down hides the chrome and up shows it (`gestures.ts`); while it is hidden a
 *   small page pill shows for 1.5 s after each scroll.
 * - **Editing** (`design/phone-2026-10/README.md` §5): the chrome stays; a press on a page with
 *   a tool armed is the tool's, never a tap (`tapRole`); two fingers still pinch, and the
 *   page layers that draw (`mark/`) load and mount only while editing.
 * - **Keys:** Ctrl/Cmd+F opens Find; the arrows and PageUp / PageDown scroll. Nothing else.
 *
 * A pinch that starts on the chrome never zooms the whole page either: two-finger touches are
 * the reader's anywhere inside it, and Safari's `gesture*` events are refused on the document
 * (`docs/research/phone-2026-10/pinch-overview.md` §1, §3.3).
 *
 * Pages outside the viewport (plus one screen) are not mounted. The scroller is the read
 * viewport (`data-read-viewport`), so the shared page parts (tiles, canvases) find it.
 */
import { type VirtualDocument, pageTotalRotation } from '@pdf-editor/document-model';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { m } from '../../i18n';
import { reducedMotion } from '../../motion/reduced-motion';
import { displaySize } from '../../pages/page-geometry';
import { useViewStore } from '../../state/view-store';
import { useActiveDocument, useWorkspaceStore } from '../../state/workspace-store';
import { userRectToCss } from '../../viewer/geometry';
import {
  documentFingerprint,
  documentLabels,
  recallPosition,
  rememberPosition,
} from '../../viewer/navigation';
import { pageFrame } from '../../viewer/page-frame';
import { watchFocusRing } from '../frame/focus-ring';
import { useSafeAreaInsets } from '../frame/frame-insets';
import { lastInput } from '../frame/input-modality';
import { CompactCapsule, CompactTopBar } from './CompactChrome';
import { CompactPage } from './CompactPage';
import styles from './CompactReader.module.css';
import { CompactSheets } from './CompactSheets';
import { openFind, setChromeHidden, setZoom, useCompactStore } from './compact-store';
import type { PinchMorph } from './overview';
import {
  canOpenOverview,
  overviewArmed,
  overviewCommits,
  overviewProgress,
  settleVelocity,
} from './overview-gesture';
import {
  loadOverview,
  openOverview,
  OverviewSlot,
  overviewModule,
  registerOverviewReader,
} from './overview-host';
import {
  DOUBLE_TAP_MS,
  type HideState,
  INITIAL_HIDE,
  isDoubleTap,
  isTap,
  onReaderScroll,
  PILL_LINGER_MS,
  type PressSample,
  type TapRecord,
  tapRole,
} from './gestures';
import {
  anchorAt,
  clampZoom,
  doubleTapZoom,
  IDENTITY,
  layoutPages,
  mostVisiblePage,
  nearlySame,
  PAGE_GAP,
  pinchTransform,
  type ReaderFrame,
  rubberZoom,
  scrollForAnchor,
  settleTransform,
  type StageTransform,
  transformCss,
  visibleRange,
  type ZoomAnchor,
} from './reader-layout';

/** The floating top bar's height, CSS px: the coarse --piece-h around 44 px controls (DSN-32). */
export const TOP_BAR_HEIGHT = 48;
/**
 * The top bar's least distance from the top edge, CSS px: the safe area, or this where there is
 * none, as the capsule's from the bottom (DSN-32), so a control's ring never meets the screen's
 * top edge (visual audit 2026-10, 7a).
 */
export const TOP_BAR_EDGE = 12;
/** The capsule's height, CSS px (Q-9: a 56 px bar of 44 px controls). */
export const CAPSULE_HEIGHT = 56;
/** The capsule's least distance from the bottom edge (01-frame F1 §2). */
export const CAPSULE_OFFSET = 12;
/** Remember the reading position after it has settled this long (as Read mode). */
const REMEMBER_DELAY_MS = 600;
/** Mod+wheel: this many pixels of wheel double or halve the zoom (desktop compact). */
const WHEEL_ZOOM_DOUBLING = 300;
/** A settle that has not reported its end by now is finished anyway. */
const SETTLE_TIMEOUT_MS = 320;
/** One arrow press scrolls this far, CSS px. */
const ARROW_STEP = 48;

/** Elements whose taps are theirs, not the page's. */
const INTERACTIVE =
  'button, a, input, textarea, select, [role="button"], [data-compact-interactive]';

export function CompactReader() {
  const doc = useActiveDocument();
  const readerRef = useRef<HTMLDivElement>(null);
  // The pages take focus on arrival (PageScroller), which Chromium rings as `:focus-visible`
  // when no pointer was used yet (a link or a restored session): the ring shows only after
  // Tab or F6, as on the full edition's stage.
  useEffect(() => watchFocusRing(() => readerRef.current), []);
  // Two fingers anywhere in the reader are its own, so a pinch that starts on the top bar or
  // the capsule never zooms the whole page; Safari's own pinch is refused on the document.
  const hasDoc = doc !== undefined;
  useEffect(() => {
    const root = readerRef.current;
    if (!root) return;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2 && event.cancelable) event.preventDefault();
    };
    const onGesture = (event: Event) => event.preventDefault();
    root.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('gesturestart', onGesture);
    document.addEventListener('gesturechange', onGesture);
    return () => {
      root.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('gesturestart', onGesture);
      document.removeEventListener('gesturechange', onGesture);
    };
  }, [hasDoc]);
  if (!doc) return null;
  return (
    <div ref={readerRef} className={styles.reader} data-testid="compact-reader">
      <PageScroller key={doc.id} doc={doc} />
      <CompactTopBar doc={doc} />
      <CompactCapsule doc={doc} />
      <CompactSheets doc={doc} />
      <OverviewSlot doc={doc} />
    </div>
  );
}

type Pending =
  | { readonly kind: 'scroll'; readonly left: number; readonly top: number }
  | {
      readonly kind: 'anchor';
      readonly anchor: ZoomAnchor;
      readonly vx: number;
      readonly vy: number;
    };

interface Pinch {
  readonly startDistance: number;
  readonly start: { readonly x: number; readonly y: number };
  readonly scroll: { readonly left: number; readonly top: number };
  readonly zoom: number;
  centre: { x: number; y: number };
  transform: StageTransform;
  /** The fingers' midpoint in client px (the overview's chip follows it). */
  client: { x: number; y: number };
  /** Started at fit, reading: closing past fit opens the overview (MOB-2). */
  readonly overview: boolean;
  /** The page under the fingers as they landed: the overview's anchor. */
  readonly anchor: number;
  /** The morph this pinch drives, once it went below fit. */
  morph: PinchMorph | null;
  /** Below fit without a morph (no chunk yet, reduced motion): rubber band and chip. */
  below: boolean;
  /** The finger zoom relative to fit, and its speed (per second) for the release. */
  raw: number;
  velocity: number;
  time: number;
}

interface Ranges {
  /** Pages mounted: the viewport plus one screen above and below. */
  readonly mounted: { readonly first: number; readonly last: number };
  /** Pages intersecting the viewport. */
  readonly visible: { readonly first: number; readonly last: number };
}

const sameRange = (a: Ranges['visible'], b: Ranges['visible']) =>
  a.first === b.first && a.last === b.last;

function PageScroller({ doc }: { readonly doc: VirtualDocument }) {
  const ws = useWorkspaceStore((s) => s.workspace);
  const zoom = useCompactStore((s) => s.zoom);
  const overviewOpen = useCompactStore((s) => s.overview === 'open');
  const chromeHidden = useCompactStore((s) => s.chromeHidden);
  const insets = useSafeAreaInsets();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const dpr = window.devicePixelRatio || 1;
  const sizes = doc.pages.map((page) => displaySize(ws, page));
  const frame: ReaderFrame = {
    width: size.width,
    height: size.height,
    insetLeft: insets.left,
    insetRight: insets.right,
    padTop: TOP_BAR_HEIGHT + Math.max(insets.top, TOP_BAR_EDGE) + PAGE_GAP,
    padBottom: CAPSULE_HEIGHT + Math.max(insets.bottom, CAPSULE_OFFSET) + PAGE_GAP,
  };
  const layout = layoutPages(sizes, frame, zoom, dpr);
  const [ranges, setRanges] = useState<Ranges>(() => ({
    mounted: visibleRange(layout.boxes, 0, size.height, size.height),
    visible: visibleRange(layout.boxes, 0, size.height),
  }));
  const [pill, setPill] = useState(false);
  const labels = documentLabels(ws, doc);
  const fingerprint = documentFingerprint(ws, doc);

  // What the handlers read: the latest layout, frame and sizes (set after each render).
  const latest = useRef({ layout, frame, sizes, dpr, doc });
  useLayoutEffect(() => {
    latest.current = { layout, frame, sizes, dpr, doc };
  });

  /** A scroll position the reader set itself: its scroll event is not a person's. */
  const expected = useRef<{ left: number; top: number } | null>(null);
  const hide = useRef<HideState>(INITIAL_HIDE);
  const pending = useRef<Pending | null>(null);
  const transform = useRef<StageTransform>(IDENTITY);
  const settling = useRef<(() => void) | null>(null);
  const [commit, setCommit] = useState(0);

  /** Scrolls to a position of the reader's choosing (jumps, zoom commits). */
  const scrollToPosition = (left: number, top: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    expected.current = { left, top };
    el.scrollLeft = left;
    el.scrollTop = top;
  };

  /** Ranges, current page and visible pages from the scroll position. */
  const measure = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const { layout: current, frame: f } = latest.current;
    const top = el.scrollTop;
    const height = el.clientHeight;
    const visible = visibleRange(current.boxes, top, height);
    const mounted = visibleRange(current.boxes, top, height, height);
    setRanges((r) =>
      sameRange(r.visible, visible) && sameRange(r.mounted, mounted) ? r : { visible, mounted },
    );
    const view = useViewStore.getState();
    view.setCurrentPage(
      mostVisiblePage(
        current.boxes,
        visible,
        top + f.padTop - PAGE_GAP,
        top + height - f.padBottom,
      ),
    );
    view.setVisibleRange(visible.first, Math.max(visible.first, visible.last));
  };

  // The scroller's size: a rotation or a window change keeps the line under the top bar.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      const { layout: current, frame: f } = latest.current;
      if (width === f.width && height === f.height) return;
      if (el.scrollTop > 0) {
        const vy = f.padTop - PAGE_GAP;
        const anchor = anchorAt(current, el.scrollLeft, el.scrollTop, f.width / 2, vy);
        if (anchor) pending.current = { kind: 'anchor', anchor, vx: width / 2, vy };
      }
      setSize({ width, height });
      setCommit((n) => n + 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A committed zoom or size: the new layout is in the DOM; put the anchor back in place and
  // drop the stage's transform in the same frame, before paint.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const stage = stageRef.current;
    const next = pending.current;
    if (!el || !stage || next === null) return;
    pending.current = null;
    const target =
      next.kind === 'scroll' ? next : scrollForAnchor(layout, frame, next.anchor, next.vx, next.vy);
    stage.style.transition = '';
    stage.style.transform = '';
    transform.current = IDENTITY;
    scrollToPosition(target.left, target.top);
    measure();
    // Runs for each commit; the layout and frame are this render's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);

  /** Commits a zoom with the scroll position that keeps its anchor in place. */
  const commitZoom = (nextZoom: number, scroll: { left: number; top: number }) => {
    pending.current = { kind: 'scroll', ...scroll };
    setZoom(nextZoom);
    setCommit((n) => n + 1);
  };

  /** Ends a running settle now (a new gesture began). */
  const finishSettle = () => {
    settling.current?.();
  };

  /** Animates the stage to `target`, then runs `done` (at once without motion). */
  const settle = (target: StageTransform, done: () => void) => {
    const stage = stageRef.current;
    finishSettle();
    if (!stage || nearlySame(transform.current, target) || reducedMotion()) {
      done();
      return;
    }
    let timer = 0;
    const finish = () => {
      if (settling.current !== finish) return;
      settling.current = null;
      stage.removeEventListener('transitionend', onEnd);
      window.clearTimeout(timer);
      done();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target === stage && event.propertyName === 'transform') finish();
    };
    settling.current = finish;
    stage.addEventListener('transitionend', onEnd);
    timer = window.setTimeout(finish, SETTLE_TIMEOUT_MS);
    stage.style.transition = 'transform var(--duration-base) var(--ease-out)';
    stage.style.transform = transformCss(target);
    transform.current = target;
  };

  /** Zooms to `nextZoom` keeping `anchor` at viewport point (vx, vy), animated. */
  const zoomAbout = (nextZoom: number, anchor: ZoomAnchor, vx: number, vy: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const { layout: current, frame: f, sizes: s, dpr: ratio } = latest.current;
    const next = layoutPages(s, f, clampZoom(nextZoom), ratio);
    const scroll = { left: el.scrollLeft, top: el.scrollTop };
    const nextScroll = scrollForAnchor(next, f, anchor, vx, vy);
    const target = settleTransform(current, scroll, next, nextScroll, anchor.page);
    settle(target, () => commitZoom(next.zoom, nextScroll));
  };

  // The page overview's morph moves the stage and reads the layout (MOB-2, `overview-host`).
  useEffect(() => {
    const el = scrollerRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    return registerOverviewReader({
      scroller: el,
      stage,
      settle: () => finishSettle(),
      pageBox: (index) => latest.current.layout.boxes[index] ?? null,
      reveal: (index) => {
        const page = latest.current.doc.pages[index];
        if (page) useViewStore.getState().scrollToPage(page.id);
      },
    });
  }, []);

  /** Whether scrolling may hide the chrome now (01-frame F12 §4). */
  const canHide = () => {
    const el = scrollerRef.current;
    const state = useCompactStore.getState();
    const focusInChrome = document.activeElement?.closest('[data-compact-chrome]') != null;
    return (
      el !== null &&
      !state.findOpen &&
      state.sheet === null &&
      !state.menuOpen &&
      lastInput() !== 'keyboard' &&
      !focusInChrome &&
      el.scrollHeight > el.clientHeight + 1
    );
  };

  // Scrolling: ranges, current page, hide on scroll, the pill.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frameId = 0;
    let pillTimer = 0;
    const update = () => {
      frameId = 0;
      measure();
      const top = el.scrollTop;
      const mine = expected.current;
      const programmatic =
        mine !== null && Math.abs(mine.top - top) < 1 && Math.abs(mine.left - el.scrollLeft) < 1;
      expected.current = null;
      const state = useCompactStore.getState();
      if (programmatic) {
        hide.current = { hidden: state.chromeHidden, travel: 0, lastTop: top };
        return;
      }
      hide.current = onReaderScroll(
        { ...hide.current, hidden: state.chromeHidden },
        { top, maxTop: el.scrollHeight - el.clientHeight, canHide: canHide() },
      );
      setChromeHidden(hide.current.hidden);
      if (hide.current.hidden) {
        setPill(true);
        window.clearTimeout(pillTimer);
        pillTimer = window.setTimeout(() => setPill(false), PILL_LINGER_MS);
      }
    };
    const onScroll = () => {
      if (frameId === 0) frameId = requestAnimationFrame(update);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frameId !== 0) cancelAnimationFrame(frameId);
      window.clearTimeout(pillTimer);
    };
  }, []);

  // Pinch (two touches), double tap and tap (pointer), Mod+wheel zoom.
  useEffect(() => {
    const el = scrollerRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;
    let pinch: Pinch | null = null;
    let pinchFrame = 0;
    /** A pinch happened since the primary pointer went down: its lift is no tap. */
    let pinched = false;
    let down:
      | (PressSample & { readonly target: EventTarget | null; readonly selecting: boolean })
      | null = null;
    let lastTap: TapRecord | null = null;
    let singleTimer = 0;

    const local = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const clientCentre = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      if (!a || !b) return { x: 0, y: 0 };
      return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
    };
    const touchCentre = (touches: TouchList) => {
      const a = touches[0];
      const b = touches[1];
      if (!a || !b) return null;
      return {
        centre: local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2),
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      };
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      event.preventDefault();
      const measured = touchCentre(event.touches);
      if (!measured || measured.distance <= 0) return;
      // A morph settling or on its way back keeps its own course.
      if (overviewModule()?.morphBusy()) return;
      finishSettle();
      window.clearTimeout(singleTimer);
      lastTap = null;
      pinched = true;
      stage.style.transition = 'none';
      const state = useCompactStore.getState();
      const scroll = { left: el.scrollLeft, top: el.scrollTop };
      const overview = canOpenOverview(state.zoom) && !state.editing && state.overview === 'closed';
      if (overview && !overviewModule()) void loadOverview().catch(() => undefined);
      const { centre } = measured;
      pinch = {
        startDistance: measured.distance,
        start: centre,
        scroll,
        zoom: state.zoom,
        centre,
        transform: IDENTITY,
        client: clientCentre(event.touches),
        overview,
        anchor:
          anchorAt(latest.current.layout, scroll.left, scroll.top, centre.x, centre.y)?.page ?? 0,
        morph: null,
        below: false,
        raw: state.zoom,
        velocity: 0,
        time: event.timeStamp,
      };
    };
    /** The overview's side of a pinch below fit (MOB-2); false while it is the zoom's. */
    const overviewPinch = (active: Pinch, raw: number): boolean => {
      if (!active.overview) return false;
      if (raw >= 1) {
        // Back above fit: the morph lets go and the pinch zooms again.
        if (active.morph && raw > 1.02) {
          active.morph.cancel();
          active.morph = null;
        }
        if (active.below) overviewModule()?.showChip(null);
        active.below = false;
        return active.morph !== null;
      }
      const module = overviewModule();
      if (!active.morph && !active.below && module) {
        stage.style.transform = '';
        transform.current = IDENTITY;
        active.morph = module.beginPinchMorph(active.anchor);
      }
      active.below = active.morph === null;
      if (active.morph) return true;
      module?.showChip(overviewArmed(raw) ? m.zoom_grid_chip() : null, active.client);
      return false;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pinch) return;
      if (event.touches.length < 2) return;
      event.preventDefault();
      const measured = touchCentre(event.touches);
      if (!measured) return;
      const active = pinch;
      const raw = active.zoom * (measured.distance / active.startDistance);
      const dt = (event.timeStamp - active.time) / 1000;
      if (dt > 0) {
        active.velocity = 0.6 * ((raw - active.raw) / dt) + 0.4 * active.velocity;
        active.time = event.timeStamp;
      }
      active.raw = raw;
      active.client = clientCentre(event.touches);
      if (overviewPinch(active, raw)) {
        if (pinchFrame === 0) {
          pinchFrame = requestAnimationFrame(() => {
            pinchFrame = 0;
            const now = pinch;
            if (!now?.morph) return;
            now.morph.scrub(overviewProgress(now.raw), overviewArmed(now.raw), now.client);
          });
        }
        return;
      }
      const visual = rubberZoom(raw);
      active.centre = measured.centre;
      active.transform = pinchTransform(
        active.scroll,
        active.start,
        measured.centre,
        visual / active.zoom,
      );
      if (pinchFrame === 0) {
        pinchFrame = requestAnimationFrame(() => {
          pinchFrame = 0;
          if (!pinch || pinch.morph) return;
          stage.style.transform = transformCss(pinch.transform);
          transform.current = pinch.transform;
        });
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (!pinch || event.touches.length >= 2) return;
      const ended = pinch;
      pinch = null;
      if (pinchFrame !== 0) {
        cancelAnimationFrame(pinchFrame);
        pinchFrame = 0;
      }
      // Released below fit: into the overview when armed (or thrown), else back (MOB-2).
      const opens = ended.overview && overviewCommits(ended.raw, ended.velocity);
      if (ended.morph) {
        const p = overviewProgress(ended.raw);
        ended.morph.release(opens, settleVelocity(ended.velocity, p, opens ? 1 : 0));
        return;
      }
      if (ended.below) {
        overviewModule()?.showChip(null);
        if (opens) {
          // No chunk yet, or reduced motion: the stage rests at fit and the button's way in runs.
          stage.style.transform = '';
          transform.current = IDENTITY;
          openOverview();
          return;
        }
      }
      stage.style.transform = transformCss(ended.transform);
      transform.current = ended.transform;
      const { layout: current } = latest.current;
      const t = ended.transform;
      // The document point under the fingers, in the current layout.
      const point = {
        x: (ended.centre.x + ended.scroll.left - t.x) / t.scale,
        y: (ended.centre.y + ended.scroll.top - t.y) / t.scale,
      };
      const anchor = anchorAt(current, 0, 0, point.x, point.y);
      if (!anchor) return;
      zoomAbout(ended.zoom * t.scale, anchor, ended.centre.x, ended.centre.y);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary) return;
      pinched = false;
      const selection = window.getSelection();
      down = {
        ...local(event.clientX, event.clientY),
        time: event.timeStamp,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
        target: event.target,
        selecting: selection !== null && !selection.isCollapsed,
      };
    };
    const onPointerCancel = () => {
      down = null;
    };
    const onPointerUp = (event: PointerEvent) => {
      const start = down;
      down = null;
      if (!event.isPrimary || !start || pinched || pinch) return;
      const up: PressSample = {
        ...local(event.clientX, event.clientY),
        time: event.timeStamp,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      };
      if (!isTap(start, up) || start.selecting) return;
      if (start.target instanceof Element && start.target.closest(INTERACTIVE)) return;
      const editing = useCompactStore.getState();
      const role = tapRole({
        editing: editing.editing,
        toolArmed: editing.tool !== null,
        onPage: start.target instanceof Element && start.target.closest('[data-page-id]') !== null,
      });
      if (role === 'none') {
        lastTap = null;
        return;
      }
      const tap = { x: up.x, y: up.y, time: up.time };
      if (isDoubleTap(lastTap, tap)) {
        window.clearTimeout(singleTimer);
        lastTap = null;
        const { layout: current } = latest.current;
        const anchor = anchorAt(current, el.scrollLeft, el.scrollTop, tap.x, tap.y);
        if (anchor) zoomAbout(doubleTapZoom(useCompactStore.getState().zoom), anchor, tap.x, tap.y);
        return;
      }
      lastTap = tap;
      window.clearTimeout(singleTimer);
      singleTimer = window.setTimeout(() => {
        lastTap = null;
        if (role === 'zoom') return;
        const state = useCompactStore.getState();
        if (state.chromeHidden) setChromeHidden(false);
        else if (!state.findOpen && state.sheet === null && !state.menuOpen) setChromeHidden(true);
      }, DOUBLE_TAP_MS);
    };

    // Mod+wheel and trackpad pinch (ctrlKey wheel): zoom about the pointer, committed per frame.
    let wheelFrame = 0;
    let wheelZoom = 0;
    let wheelPoint = { x: 0, y: 0 };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1;
      const delta = Math.max(-150, Math.min(150, event.deltaY * unit));
      wheelZoom = clampZoom(
        (wheelZoom || useCompactStore.getState().zoom) * 2 ** (-delta / WHEEL_ZOOM_DOUBLING),
      );
      wheelPoint = local(event.clientX, event.clientY);
      if (wheelFrame !== 0) return;
      wheelFrame = requestAnimationFrame(() => {
        wheelFrame = 0;
        const { layout: current, frame: f, sizes: s, dpr: ratio } = latest.current;
        const anchor = anchorAt(current, el.scrollLeft, el.scrollTop, wheelPoint.x, wheelPoint.y);
        const target = wheelZoom;
        wheelZoom = 0;
        if (!anchor || Math.abs(target - current.zoom) < 1e-3) return;
        const next = layoutPages(s, f, target, ratio);
        commitZoom(next.zoom, scrollForAnchor(next, f, anchor, wheelPoint.x, wheelPoint.y));
      });
    };
    // Safari's own pinch would zoom the whole page.
    const onGesture = (event: Event) => event.preventDefault();

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGesture);
    el.addEventListener('gesturechange', onGesture);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
      window.clearTimeout(singleTimer);
      if (pinchFrame !== 0) cancelAnimationFrame(pinchFrame);
      if (wheelFrame !== 0) cancelAnimationFrame(wheelFrame);
    };
    // Handlers read the latest layout through `latest` and the stores.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keys: Ctrl/Cmd+F opens Find; arrows and PageUp / PageDown scroll; a key shows the chrome
  // first, so focus never lands in a hidden bar (01-frame F12 §6).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = scrollerRef.current;
      if (!el || event.defaultPrevented) return;
      const state = useCompactStore.getState();
      const mod = event.ctrlKey || event.metaKey;
      if (mod && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        openFind();
        return;
      }
      if (state.chromeHidden && !['Control', 'Meta', 'Alt', 'Shift'].includes(event.key)) {
        flushSync(() => setChromeHidden(false));
      }
      if (state.sheet !== null || state.menuOpen || state.overview !== 'closed') return;
      if (mod || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, [role="dialog"]'))
      ) {
        return;
      }
      // The focused scroller scrolls itself with the arrows.
      const own = target === el;
      const page = Math.max(
        ARROW_STEP,
        el.clientHeight - latest.current.frame.padTop - latest.current.frame.padBottom,
      );
      let by: { left?: number; top?: number } | undefined;
      if (event.key === 'PageDown') by = { top: page };
      else if (event.key === 'PageUp') by = { top: -page };
      else if (!own && event.key === 'ArrowDown') by = { top: ARROW_STEP };
      else if (!own && event.key === 'ArrowUp') by = { top: -ARROW_STEP };
      else if (!own && event.key === 'ArrowRight') by = { left: ARROW_STEP };
      else if (!own && event.key === 'ArrowLeft') by = { left: -ARROW_STEP };
      if (!by) return;
      // Only from the pages or from nowhere: a focused button keeps its own keys.
      if (
        !own &&
        target instanceof HTMLElement &&
        target !== document.body &&
        target.closest(INTERACTIVE)
      ) {
        return;
      }
      event.preventDefault();
      el.scrollBy({ ...by, behavior: reducedMotion() ? 'auto' : 'smooth' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Jumps (Pages sheet, Go to page, Contents, links, Find): the page's top under the top
  // bar, or the smallest scroll that shows a region (a Find hit) in the free area.
  useEffect(
    () =>
      useViewStore.subscribe((state, previous) => {
        const request = state.scrollRequest;
        const el = scrollerRef.current;
        if (!request || request === previous.scrollRequest || !el) return;
        const { layout: current, frame: f, sizes: s, doc: d } = latest.current;
        const index = d.pages.findIndex((page) => page.id === request.pageId);
        const box = current.boxes[index];
        const page = d.pages[index];
        if (!box || !page) return;
        setChromeHidden(false);
        if (request.reveal === undefined) {
          scrollToPosition(el.scrollLeft, Math.max(0, box.top - f.padTop));
          return;
        }
        const pageWs = useWorkspaceStore.getState().workspace;
        const sourceId = page.ref.kind === 'source' ? page.ref.source : undefined;
        const region = userRectToCss(
          pageFrame({
            sourceId,
            sourceIndex: page.ref.kind === 'source' ? page.ref.index : 0,
            sizePt: s[index] ?? { width: 612, height: 792 },
            rotation: pageTotalRotation(pageWs, page),
            cssScale: current.scale,
            page,
          }),
          request.reveal,
        );
        const bandTop = f.padTop - PAGE_GAP;
        const bandBottom = f.padBottom - PAGE_GAP;
        const freeHeight = el.clientHeight - bandTop - bandBottom;
        const top = box.top + region.top;
        const left = box.left + region.left;
        let nextTop = el.scrollTop;
        if (region.height === 0) {
          // A zero-size region (a Contents entry's /XYZ top) aligns under the top bar.
          nextTop = Math.max(0, top - bandTop - PAGE_GAP);
        } else if (
          top < el.scrollTop + bandTop + 16 ||
          top + region.height > el.scrollTop + el.clientHeight - bandBottom - 16
        ) {
          nextTop = Math.max(0, top - bandTop - freeHeight / 3);
        }
        let nextLeft = el.scrollLeft;
        if (
          left < el.scrollLeft + 16 ||
          left + region.width > el.scrollLeft + el.clientWidth - 16
        ) {
          nextLeft = Math.max(0, left - el.clientWidth / 3);
        }
        scrollToPosition(nextLeft, nextTop);
      }),
    [],
  );

  // A zoom to a region (MOB-1, the field being filled): the region's centre lands near the
  // top of the band under the top bar (or stays where it is), its left edge in view.
  useEffect(
    () =>
      useCompactStore.subscribe((state, previous) => {
        const request = state.zoomRequest;
        const el = scrollerRef.current;
        if (!request || request === previous.zoomRequest || !el) return;
        const { layout: current, frame: f, sizes: s, doc: d } = latest.current;
        const index = d.pages.findIndex((page) => page.id === request.pageId);
        const box = current.boxes[index];
        const page = d.pages[index];
        if (!box || !page) return;
        const region = userRectToCss(
          pageFrame({
            sourceId: page.ref.kind === 'source' ? page.ref.source : undefined,
            sourceIndex: page.ref.kind === 'source' ? page.ref.index : 0,
            sizePt: s[index] ?? { width: 612, height: 792 },
            rotation: pageTotalRotation(useWorkspaceStore.getState().workspace, page),
            cssScale: current.scale,
            page,
          }),
          request.rect,
        );
        const zoom = clampZoom(request.zoom);
        const grow = zoom / current.zoom;
        const centre = { x: region.left + region.width / 2, y: region.top + region.height / 2 };
        const anchor = {
          page: index,
          fx: centre.x / Math.max(1, box.width),
          fy: centre.y / Math.max(1, box.height),
        };
        let vx = box.left + centre.x - el.scrollLeft;
        let vy = box.top + centre.y - el.scrollTop;
        if (request.place === 'band') {
          const wide = region.width * grow;
          vx = wide > el.clientWidth - 32 ? 16 + wide / 2 : el.clientWidth / 2;
          vy = f.padTop + Math.min(72, (region.height * grow) / 2 + 24);
        }
        setChromeHidden(false);
        zoomAbout(zoom, anchor, vx, vy);
      }),
    // Handlers read the latest layout through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Remember the reading position per document, and restore it once on open.
  useEffect(() => {
    if (fingerprint === undefined) return;
    const remembered = recallPosition(fingerprint);
    const box = remembered === undefined ? undefined : latest.current.layout.boxes[remembered];
    if (remembered !== undefined && remembered > 0 && box) {
      scrollToPosition(0, Math.max(0, box.top - latest.current.frame.padTop));
    }
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
    // Once per document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The pages take focus on arrival, so the arrows and a screen reader start there.
  useEffect(() => {
    scrollerRef.current?.focus({ preventScroll: true });
  }, []);

  const pages = [];
  for (let index = ranges.mounted.first; index <= ranges.mounted.last; index++) {
    const page = doc.pages[index];
    const box = layout.boxes[index];
    const pageSize = sizes[index];
    if (!page || !box || !pageSize) continue;
    const label = labels[index];
    pages.push(
      <CompactPage
        key={page.id}
        ws={ws}
        doc={doc}
        page={page}
        index={index}
        size={pageSize}
        box={box}
        scale={layout.scale}
        visible={index >= ranges.visible.first && index <= ranges.visible.last}
        label={label !== undefined && label !== String(index + 1) ? label : undefined}
      />,
    );
  }

  return (
    <>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        data-read-viewport=""
        data-testid="compact-pages"
        data-zoom={layout.zoom}
        // Hidden under the open page overview (MOB-2), which is the place then.
        data-overview={overviewOpen || undefined}
        inert={overviewOpen}
        role="region"
        aria-label={m.a11y_pages_viewport({ title: doc.title })}
        // A scrollable region takes focus (WCAG 2.1.1), so the arrows scroll it.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
      >
        <div className={styles.column} style={{ width: layout.width, height: layout.height }}>
          <div
            ref={stageRef}
            className={styles.stage}
            style={{ width: layout.width, height: layout.height }}
          >
            {pages}
          </div>
        </div>
      </div>
      <PagePill visible={pill && chromeHidden} total={doc.pages.length} />
    </>
  );
}

/** The page number that fades in while the chrome is hidden and the pages scroll. */
function PagePill({ visible, total }: { readonly visible: boolean; readonly total: number }) {
  const current = useViewStore((s) => s.currentPage);
  return (
    <div
      className={styles.pill}
      data-visible={visible || undefined}
      aria-hidden="true"
      data-testid="compact-page-pill"
    >
      {current + 1} / {total}
    </div>
  );
}
