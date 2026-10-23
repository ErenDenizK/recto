/**
 * The app's scroll bar, everywhere (owner, R22 brief C-10; decisions GLS-26, which amends
 * GLS-24): one overlay thumb for every scroller of both editions (the reader's stand-in bars
 * of `stage/ScrollProxies`, the Pages grid, the sidebar lists, menus, popovers, sheets, Settings,
 * the Library), drawn over the scroller's trailing edge in a fixed layer of its own. The native
 * bars are hidden (`styles/scrollbars.css`, under `:root[data-scroll-thumbs]`), so no scroller
 * takes a gutter on any engine and WebKit needs no special case any more.
 *
 * - **Look** (`scroll-thumbs.module.css`): a slim
 *   capsule of the glass's tone with GLS-22's rim unblurred (it moves), no track. Under the
 *   pointer it grows into a groove of the same glass, the lens seated in its bezel (GLS-25);
 *   dragged it is brightest, and the reader names the page under it.
 * - **Shown** while its scroller scrolls, and while a fine pointer is within `HIT` px of the
 *   scroller's trailing (or bottom) edge; it fades out `SCROLL_THUMB_LINGER_MS` after the last
 *   scroll or once the pointer leaves (MOT-4). At rest nothing runs: no frame loop, one timer.
 * - **No layout per scroll frame** (A-23): a scroller is measured when its bar appears, when it
 *   resizes (`ResizeObserver`) and when the pointer enters it; a scroll reads `scrollTop` and
 *   writes one `transform`. The thumb is its own compositor layer, so a move repaints nothing.
 * - **Pointer.** While shown under the pointer the bar takes it: a press on the thumb drags it,
 *   a press beside it jumps there and keeps dragging (the scroller scrolls `instant`, so a smooth
 *   `scroll-behavior` never lags the hand). A press elsewhere never reaches it.
 * - **Keyboard and assistive technology** keep native scrolling: the layer is `aria-hidden` and
 *   takes no focus.
 * - **Opting out**: `--scroll-bar: none` on a scroller that needs none (a property that does not
 *   inherit, `styles/scrollbars.css`): the reader's full-bleed viewport, whose stand-ins carry
 *   the bar; the tab list and the Review chips, which mark their overflowing edge instead. `--scroll-inset-top` / `--scroll-inset-bottom` on a
 *   scroller that reaches under the chrome keep its bar in the free rectangle (the Pages grid).
 * - **Forced colours**: not installed; the system's bars come back.
 *
 * Both editions install it (`app.tsx`, `CompactApp.tsx`): on the phone it is drawn on scroll
 * only (no hover), over the pages inside the safe area and over every list and sheet.
 */
import styles from './scroll-thumbs.module.css';

/** A bar fades out this long after the last scroll. */
export const SCROLL_THUMB_LINGER_MS = 900;

type Axis = 'y' | 'x';

interface Bar {
  readonly axis: Axis;
  readonly el: HTMLDivElement;
  readonly thumb: HTMLDivElement;
  readonly label: HTMLSpanElement;
  target: HTMLElement | null;
  shown: boolean;
  hot: boolean;
  /** Scroll range, thumb travel and size, and where the track starts on screen, CSS px. */
  range: number;
  travel: number;
  size: number;
  start: number;
  timer: number;
  drag: { readonly pointerId: number; readonly grab: number } | null;
  text: string;
}

/** The bar's width under the pointer, and the edge zone that shows it, CSS px. */
const HIT = 14;
/** The track keeps this far from the scroller's ends. */
const END = 3;
/** The shortest thumb, however long the content. */
const MIN_THUMB = 32;
const OVERFLOW = /auto|scroll|overlay/;

const labels = new WeakMap<Element, (scrollTop: number) => string>();

/**
 * Names what lies under the thumb at a scroll position while it is dragged (the reader's page
 * number); `null` takes the label away.
 */
export function setScrollLabel(el: Element, label: ((scrollTop: number) => string) | null): void {
  if (label) labels.set(el, label);
  else labels.delete(el);
}

/**
 * Where Find's hits lie along the reader's scroll range (DSN-62): fractions 0..1 of the track,
 * and the current hit's, or `null`. Drawn as ticks on one canvas beside the reader's vertical
 * bar, however many hits (ticks closer than a device pixel merge), static at rest.
 */
export interface ScrollTicks {
  readonly at: readonly number[];
  readonly current: number | null;
  /**
   * The find map (R26, DSN-65; `?findmap=1`): larger ticks, and where the reader has no stand-in
   * bar (the phone) they ride the reader's own scroller on a rail wide enough for a finger.
   */
  readonly map?: boolean;
}

/** Where the ticks' canvas lies, CSS px: its left edge, the track's top and height, its width. */
export interface TickGeometry {
  readonly left: number;
  readonly top: number;
  readonly room: number;
  readonly width: number;
}

/** A finger's extra width on the rail, left of the 14 px lane (coarse pointers, the map only). */
const RAIL = 12;

/** Draws a larger tick at a fraction of the track: width and height in CSS px. */
/** `solid` is all lime inside a thin dark edge, with no dark core (the hovered tick). */
export type TickMark = (at: number, width: number, height: number, solid?: boolean) => void;

let ticks: ScrollTicks | null = null;
let redrawTicks: ((force?: boolean) => void) | null = null;
let ticksAt: TickGeometry | null = null;
let painter: ((mark: TickMark) => void) | null = null;

/**
 * Takes over the marks over the ticks (the current hit's, and the find map's hovered one): it is
 * handed `mark` on every draw, so the map can slide the current tick on a spring and mark the
 * tick the pointer is on without any of that living here. `null` gives the plain current tick back.
 */
export function setTickPainter(next: ((mark: TickMark) => void) | null): void {
  painter = next;
  redrawTicks?.(true);
}

/** The ticks' canvas as last drawn, or `null` while it is hidden (the find map's hit-test). */
export function tickGeometry(): TickGeometry | null {
  return ticksAt;
}

/** Redraws the ticks where the reader's bar now is (its stand-in mounted, unmounted or moved). */
export function refreshScrollTicks(force = false): void {
  redrawTicks?.(force);
}

/** Shows (or, with `null`, clears) hit ticks along the reader's bar. */
export function setScrollTicks(next: ScrollTicks | null): void {
  ticks = next;
  redrawTicks?.();
}

let uninstall: (() => void) | null = null;

/** Starts the app-wide bar (once; a second call returns the first one's stop). */
export function installScrollThumbs(): () => void {
  if (uninstall) return uninstall;
  const forced = matchMedia('(forced-colors: active)');
  let stop: (() => void) | null = null;
  const sync = () => {
    if (forced.matches) {
      stop?.();
      stop = null;
    } else stop ??= start();
  };
  sync();
  forced.addEventListener('change', sync);
  uninstall = () => {
    forced.removeEventListener('change', sync);
    stop?.();
    stop = null;
    uninstall = null;
  };
  return uninstall;
}

function start(): () => void {
  const root = document.documentElement;
  const layer = document.createElement('div');
  layer.className = styles.layer ?? '';
  layer.setAttribute('aria-hidden', 'true');
  // Computed styles are cached for one animation frame only: a cache that outlives it (a WeakMap
  // from an element to its style, which refers back to the element) kept a closed document's
  // page canvases alive (R25 memory baseline, heap snapshot after three closes).
  const frameStyles = new Map<Element, CSSStyleDeclaration>();
  const computed = (el: Element) => {
    let style = frameStyles.get(el);
    if (!style) {
      if (frameStyles.size === 0) requestAnimationFrame(() => frameStyles.clear());
      style = getComputedStyle(el);
      frameStyles.set(el, style);
    }
    return style;
  };

  /** Whether `el` scrolls along `axis` now (its extent first: most elements stop there). */
  const scrolls = (el: Element, axis: Axis): boolean => {
    const extent =
      axis === 'y' ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth;
    if (extent < 1) return false;
    const style = computed(el);
    return OVERFLOW.test(axis === 'y' ? style.overflowY : style.overflowX);
  };
  const eligible = (el: EventTarget | null): el is HTMLElement =>
    el instanceof HTMLElement && el !== root && el !== document.body && !layer.contains(el);
  const optedOut = (el: Element) => computed(el).getPropertyValue('--scroll-bar').trim() === 'none';

  const resize = new ResizeObserver((entries) => {
    // A removed scroller reports its collapse here: let go of it (`letGoOfDetached`).
    for (const bar of bars) if (bar.target && !bar.target.isConnected) hide(bar);
    for (const bar of bars) {
      if (!bar.shown || !bar.target) continue;
      const target = bar.target;
      if (entries.some((entry) => entry.target === target || entry.target.parentElement === target))
        measure(bar);
    }
  });

  const make = (axis: Axis): Bar => {
    const el = document.createElement('div');
    el.className = styles.bar ?? '';
    el.dataset.axis = axis;
    const thumb = document.createElement('div');
    thumb.className = styles.thumb ?? '';
    thumb.dataset.scrollThumbPart = 'thumb';
    const label = document.createElement('span');
    label.className = styles.label ?? '';
    label.hidden = true;
    if (axis === 'y') thumb.append(label);
    el.append(thumb);
    layer.append(el);
    const bar: Bar = {
      axis,
      el,
      thumb,
      label,
      target: null,
      shown: false,
      hot: false,
      range: 0,
      travel: 0,
      size: 0,
      start: 0,
      timer: 0,
      drag: null,
      text: '',
    };
    el.addEventListener('pointerdown', (event) => press(bar, event));
    el.addEventListener('pointermove', (event) => {
      if (bar.drag?.pointerId === event.pointerId) scrollTo(bar, along(bar, event) - bar.drag.grab);
    });
    const release = (event: PointerEvent) => {
      if (bar.drag?.pointerId !== event.pointerId) return;
      bar.drag = null;
      delete el.dataset.drag;
      bar.label.hidden = true;
      linger(bar);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    return bar;
  };

  const along = (bar: Bar, event: PointerEvent) =>
    (bar.axis === 'y' ? event.clientY : event.clientX) - bar.start;
  const offset = (bar: Bar) => {
    const target = bar.target;
    if (!target || bar.range <= 0) return 0;
    const at = (bar.axis === 'y' ? target.scrollTop : Math.abs(target.scrollLeft)) / bar.range;
    return Math.round(Math.min(1, Math.max(0, at)) * bar.travel);
  };

  /** Where the scroller is and how long its content: the one place a bar reads layout. */
  const measure = (bar: Bar) => {
    const target = bar.target;
    if (!target) return;
    const y = bar.axis === 'y';
    const rect = target.getBoundingClientRect();
    const style = computed(target);
    const view = y ? target.clientHeight : target.clientWidth;
    bar.range = (y ? target.scrollHeight : target.scrollWidth) - view;
    let room: number;
    let left: number;
    let top: number;
    if (y) {
      const before = parseFloat(style.getPropertyValue('--scroll-inset-top')) || 0;
      const after = parseFloat(style.getPropertyValue('--scroll-inset-bottom')) || 0;
      room = Math.max(0, rect.height - before - after - 2 * END);
      left = style.direction === 'rtl' ? rect.left : rect.right - HIT;
      top = rect.top + before + END;
      bar.el.style.height = `${room}px`;
      bar.start = top;
    } else {
      // Clear of the vertical bar's corner when both scroll.
      room = Math.max(0, rect.width - 2 * END - (scrolls(target, 'y') ? HIT : 0));
      left = rect.left + END;
      top = rect.bottom - HIT;
      bar.el.style.width = `${room}px`;
      bar.start = left;
    }
    bar.el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    bar.size =
      bar.range > 0 ? Math.min(room, Math.max(MIN_THUMB, (room * view) / (bar.range + view))) : 0;
    bar.travel = room - bar.size;
    bar.thumb.style[y ? 'height' : 'width'] = `${bar.size}px`;
    place(bar);
  };

  /** One transform per scroll; while dragged, the label follows what lies under the thumb. */
  const place = (bar: Bar) => {
    const at = offset(bar);
    bar.thumb.style.transform = bar.axis === 'y' ? `translateY(${at}px)` : `translateX(${at}px)`;
    if (!bar.drag || !bar.target) return;
    const text = labels.get(bar.target)?.(bar.target.scrollTop) ?? '';
    if (text !== bar.text) {
      bar.text = text;
      bar.label.textContent = text;
    }
    bar.label.hidden = text === '';
  };

  const bind = (bar: Bar, target: HTMLElement) => {
    if (bar.target === target) return;
    if (bar.target) resize.unobserve(bar.target);
    bar.target = target;
    bar.text = '';
    resize.observe(target);
    const first = target.firstElementChild;
    if (first) resize.observe(first);
    measure(bar);
  };

  // A scroller removed from the page (a closed document's viewport) is let go of, or the bar and
  // the pointer's `under` list keep its whole subtree, page canvases included, alive.
  const letGoOfDetached = (bar: Bar) => {
    if (!bar.target || bar.target.isConnected) return;
    resize.unobserve(bar.target);
    bar.target = null;
    bar.hot = false;
    bar.drag = null;
    under = under.filter((entry) => entry.el.isConnected);
  };
  const hide = (bar: Bar) => {
    bar.shown = false;
    delete bar.el.dataset.shown;
    letGoOfDetached(bar);
  };
  const linger = (bar: Bar) => {
    clearTimeout(bar.timer);
    if (bar.hot || bar.drag) return;
    bar.timer = window.setTimeout(() => hide(bar), SCROLL_THUMB_LINGER_MS);
  };
  const reveal = (bar: Bar) => {
    if (!bar.shown) {
      measure(bar);
      if (bar.range <= 0) return;
      bar.shown = true;
      bar.el.dataset.shown = '';
    }
    linger(bar);
  };

  const scrollTo = (bar: Bar, at: number) => {
    const target = bar.target;
    if (!target || bar.travel <= 0) return;
    const value = (Math.min(1, Math.max(0, at / bar.travel)) * bar.range) | 0;
    target.scrollTo(
      bar.axis === 'y' ? { top: value, behavior: 'instant' } : { left: value, behavior: 'instant' },
    );
  };

  const press = (bar: Bar, event: PointerEvent) => {
    if (event.button !== 0 || !bar.target || !bar.shown) return;
    event.preventDefault();
    event.stopPropagation();
    const at = along(bar, event);
    const thumbAt = offset(bar);
    const grab = at >= thumbAt && at <= thumbAt + bar.size ? at - thumbAt : bar.size / 2;
    bar.drag = { pointerId: event.pointerId, grab };
    bar.el.dataset.drag = '';
    bar.el.setPointerCapture(event.pointerId);
    clearTimeout(bar.timer);
    scrollTo(bar, at - grab);
    place(bar);
  };

  const bars = [make('y'), make('x')] as const;

  const onScroll = (event: Event) => {
    const el = event.target;
    if (!eligible(el)) return;
    for (const bar of bars) {
      if (bar.target === el) {
        if (bar.shown) place(bar);
        reveal(bar);
      } else if (scrolls(el, bar.axis) && !optedOut(el)) {
        bind(bar, el);
        reveal(bar);
      }
    }
  };

  // The scrollers under a fine pointer, innermost first, measured as it entered them.
  let under: { readonly el: HTMLElement; readonly rect: DOMRect }[] = [];
  const onOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !(event.target instanceof Element)) return;
    if (layer.contains(event.target)) return;
    under = [];
    for (let el: Element | null = event.target; el && under.length < 3; el = el.parentElement) {
      if (eligible(el) && (scrolls(el, 'y') || scrolls(el, 'x')) && !optedOut(el)) {
        under.push({ el, rect: el.getBoundingClientRect() });
        for (const bar of bars) if (bar.target === el && bar.shown) measure(bar);
      }
    }
  };
  const setHot = (bar: Bar, el: HTMLElement | null) => {
    if (el) {
      bind(bar, el);
      if (!bar.hot) {
        bar.hot = true;
        bar.el.dataset.hot = '';
      }
      reveal(bar);
    } else if (bar.hot) {
      bar.hot = false;
      delete bar.el.dataset.hot;
      linger(bar);
    }
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || bars.some((bar) => bar.drag)) return;
    const over = event.target instanceof Node ? event.target : null;
    const onBar = over !== null && layer.contains(over);
    let hitY: HTMLElement | null = null;
    let hitX: HTMLElement | null = null;
    for (const { el, rect } of under) {
      // Only where the pointer is over the scroller itself, never over something laid on it
      // (a resize handle at a panel's edge keeps its pointer).
      if (!el.isConnected || (!onBar && !(over && el.contains(over)))) continue;
      const { clientX: x, clientY: y } = event;
      const inY = y >= rect.top && y <= rect.bottom;
      const inX = x >= rect.left && x <= rect.right;
      const fromEnd = computed(el).direction === 'rtl' ? x - rect.left : rect.right - x;
      if (!hitY && inY && fromEnd >= 0 && fromEnd <= HIT && scrolls(el, 'y')) hitY = el;
      else if (!hitX && inX && rect.bottom - y >= 0 && rect.bottom - y <= HIT && scrolls(el, 'x'))
        hitX = el;
    }
    setHot(bars[0], hitY);
    setHot(bars[1], hitX);
  };
  const onOut = (event: PointerEvent) => {
    if (event.relatedTarget !== null || bars.some((bar) => bar.drag)) return;
    under = [];
    for (const bar of bars) setHot(bar, null);
  };

  // Hit ticks (DSN-62): one canvas under the bars, over the reader's vertical stand-in bar.
  const canvas = document.createElement('canvas');
  canvas.className = styles.ticks ?? '';
  canvas.hidden = true;
  canvas.dataset.scrollTicks = '';
  layer.prepend(canvas);
  let tickKey = '';
  let drawn: ScrollTicks | null = null;
  const tickSize = new ResizeObserver(() => drawTicks());
  const drawTicks = (force = false) => {
    // The reader's stand-in bar; the find map also rides the phone reader's own scroller.
    const proxy = ticks
      ? (document.querySelector<HTMLElement>('[data-scroll-proxy="vertical"]') ??
        (ticks.map ? document.querySelector<HTMLElement>('[data-read-viewport]') : null))
      : null;
    const ctx = ticks && proxy ? canvas.getContext('2d') : null;
    if (!ticks || !proxy || !ctx || ticks.at.length === 0) {
      canvas.hidden = true;
      tickKey = '';
      drawn = null;
      ticksAt = null;
      tickSize.disconnect();
      return;
    }
    tickSize.observe(proxy);
    const rect = proxy.getBoundingClientRect();
    const style = getComputedStyle(proxy);
    const before = parseFloat(style.getPropertyValue('--scroll-inset-top')) || 0;
    const after = parseFloat(style.getPropertyValue('--scroll-inset-bottom')) || 0;
    const room = Math.max(0, rect.height - before - after - 2 * END);
    const dpr = window.devicePixelRatio || 1;
    const px = Math.floor(room * dpr);
    const pad = ticks.map && matchMedia('(pointer: coarse)').matches ? RAIL : 0;
    const left = (style.direction === 'rtl' ? rect.left : rect.right - HIT) - pad;
    const top = rect.top + before + END;
    const key = `${left}|${top}|${room}|${dpr}`;
    if (px < 1 || (!force && key === tickKey && drawn === ticks)) return;
    tickKey = key;
    drawn = ticks;
    ticksAt = { left, top, room: px / dpr, width: HIT + pad };
    canvas.hidden = false;
    canvas.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    canvas.style.width = `${HIT + pad}px`;
    canvas.style.height = `${px / dpr}px`;
    canvas.width = Math.round((HIT + pad) * dpr);
    canvas.height = px;
    const tone = getComputedStyle(root);
    const ring = tone.getPropertyValue('--find-current-ring').trim();
    const halo = tone.getPropertyValue('--find-current-halo').trim();
    // One row per device pixel: marks closer than a pixel merge, so any number of hits draws a
    // bounded number of rects.
    const rows = new Uint8Array(px);
    for (const f of ticks.at) rows[Math.min(px - 1, Math.max(0, Math.floor(f * px)))] = 1;
    // In the thumb's own lane (4 px, 5 px in from the bar's end), under it; a little larger in
    // the map, where the tick is something to point at (6 px, 3 px).
    const big = ticks.map ? 1 : 0;
    const w = (4 + 2 * big) * dpr;
    const x = (5 - big + pad) * dpr;
    const h = Math.max(2 + big, Math.round(dpr * (2 + big)));
    const runs: number[] = [];
    for (let r = 0; r < px; ) {
      if (!rows[r]) {
        r++;
        continue;
      }
      let end = r;
      while (end + 1 < px && rows[end + 1]) end++;
      runs.push(r, end - r + 1);
      r = end + 1;
    }
    const edge = Math.max(1, Math.round(dpr / 2));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = ring;
    for (let i = 0; i < runs.length; i += 2) {
      const y = runs[i] as number;
      ctx.fillRect(x - edge, y - edge, w + 2 * edge, Math.max(h, runs[i + 1] as number) + 2 * edge);
    }
    ctx.fillStyle = halo;
    for (let i = 0; i < runs.length; i += 2) {
      ctx.fillRect(x, runs[i] as number, w, Math.max(h, runs[i + 1] as number));
    }
    // The current hit, and the tick the pointer is on (the map): wider and taller, dark with a
    // lime edge (distinct from the rest), centred on the lane.
    const mark: TickMark = (at, width, height, solid) => {
      const y = Math.min(px - 1, Math.max(0, Math.floor(at * px)));
      const cw = width * dpr;
      const ch = Math.round(height * dpr);
      const cx = x + w / 2 - cw / 2;
      ctx.fillStyle = solid ? ring : halo;
      ctx.fillRect(cx - edge, y - edge - dpr, cw + 2 * edge, ch + 2 * edge + 2 * dpr);
      ctx.fillStyle = solid ? halo : ring;
      ctx.fillRect(cx, y - dpr, cw, ch + 2 * dpr);
    };
    if (painter) painter(mark);
    else if (ticks.current !== null) mark(ticks.current, 8, 4);
  };
  redrawTicks = drawTicks;
  // The reader's bar moves only when it resizes (the observer) or the window does: no layout
  // read per scroll frame (A-23).
  const tickResize = () => drawTicks();
  window.addEventListener('resize', tickResize, { passive: true });
  drawTicks();

  document.body.append(layer);
  root.dataset.scrollThumbs = '';
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  return () => {
    delete root.dataset.scrollThumbs;
    document.removeEventListener('scroll', onScroll, { capture: true });
    tickSize.disconnect();
    window.removeEventListener('resize', tickResize);
    redrawTicks = null;
    ticksAt = null;
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onOut);
    for (const bar of bars) clearTimeout(bar.timer);
    resize.disconnect();
    layer.remove();
  };
}
