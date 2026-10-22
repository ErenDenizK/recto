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

  document.body.append(layer);
  root.dataset.scrollThumbs = '';
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('pointerover', onOver, { passive: true });
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });
  return () => {
    delete root.dataset.scrollThumbs;
    document.removeEventListener('scroll', onScroll, { capture: true });
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onOut);
    for (const bar of bars) clearTimeout(bar.timer);
    resize.disconnect();
    layer.remove();
  };
}
