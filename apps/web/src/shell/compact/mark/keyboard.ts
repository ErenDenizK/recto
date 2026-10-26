/**
 * The on-screen keyboard on phones (`design/phone-2026-10/README.md` §4: "the box is kept above
 * the keyboard"; code-audit §2 "Keyboard"; ux-references §5 rows 5, 8). The layout viewport
 * stays tall while the iOS keyboard is up (iOS has no VirtualKeyboard API and ignores
 * `interactive-widget`); only the visual viewport shrinks, and Safari may pan it. So one
 * watcher reads `visualViewport` (its `resize` and `scroll`, re-read on `focusin`/`focusout`
 * after a frame and after the keyboard's animation, since iOS may report only at its end) and:
 *
 * - writes `--kb-inset` on `:root`: how much of the layout viewport's foot the keyboard covers
 *   (0 on Android, where `interactive-widget=resizes-content` shrinks the layout itself), which
 *   the keyboard's Done reads to sit above it by layout, never per-frame JS;
 * - writes the free rectangle (`--free-top|right|bottom|left`, 01-frame F1 §2) that the full
 *   edition's editors place their chrome in (`text-edit/header-place.ts` through
 *   `ParagraphEditor`): under the top bar, above the island, or, while typing, above the
 *   keyboard's Done;
 * - tells its listeners, so `keepInView` scrolls the reader (`[data-read-viewport]`, the one
 *   scroller: the document never scrolls) until the field is in the band between the top bar
 *   and the keyboard's Done.
 *
 * The geometry is pure (`keyboardInset`, `revealDelta`) and tested without a browser.
 */
import { useCompactStore } from '../compact-store';

/** The keyboard's Done bar: 44 px targets in 4 px of padding (Q-9). */
export const ACCESSORY_HEIGHT = 52;
/** Space between the keyboard (or the screen's foot) and the Done bar, and above it. */
export const ACCESSORY_GAP = 8;
/** Space kept between the field and the band's edges, CSS px. */
export const REVEAL_MARGIN = 12;
/** iOS's keyboard animation: the viewport is read again once it has run. */
const KEYBOARD_SETTLE_MS = 350;

export interface ViewportLike {
  readonly height: number;
  readonly offsetTop: number;
  readonly scale?: number;
}

export interface Band {
  readonly top: number;
  readonly bottom: number;
}

/**
 * How much of the layout viewport's foot (`layoutHeight` tall) the keyboard covers, CSS px.
 * The visual viewport's `offsetTop` is clamped (on iOS 26 it may not return to 0 after the
 * keyboard closes, Apple forums 800125); a pinch-zoomed viewport reports none, as it is not
 * the keyboard that made it short.
 */
export function keyboardInset(layoutHeight: number, viewport: ViewportLike | null): number {
  if (!viewport || (viewport.scale ?? 1) > 1.01) return 0;
  const top = Math.min(
    Math.max(0, viewport.offsetTop),
    Math.max(0, layoutHeight - viewport.height),
  );
  return Math.max(0, Math.round(layoutHeight - viewport.height - top));
}

/**
 * How far to scroll (positive: down) so that `target` lies inside `band` with `margin` to
 * spare; a target taller than the band keeps its top in view. 0 when it is inside already.
 */
export function revealDelta(target: Band, band: Band, margin: number = REVEAL_MARGIN): number {
  const top = band.top + margin;
  const bottom = band.bottom - margin;
  if (target.top < top) return target.top - top;
  if (target.bottom > bottom) return Math.min(target.bottom - bottom, target.top - top);
  return 0;
}

export interface KeyboardState {
  /** `keyboardInset` now. */
  readonly inset: number;
  /** The visible band in client coordinates: under the top bar, above the keyboard's Done. */
  readonly band: Band;
}

type Listener = (state: KeyboardState) => void;

const listeners = new Set<Listener>();
let stopWatching: (() => void) | null = null;
let current: KeyboardState = { inset: 0, band: { top: 0, bottom: 0 } };

/** The keyboard and the band as last read. */
export function keyboardState(): KeyboardState {
  return current;
}

function bottomOf(selector: string): number {
  const el = document.querySelector(selector);
  if (!el || el.closest('[data-hidden]')) return 0;
  return Math.max(0, el.getBoundingClientRect().bottom);
}

/**
 * The top of the highest piece of the bottom chrome: the capsule, and what stands above it (the
 * single capsule's tray and Redo chip, `[data-compact-above-capsule]`, EDN-24).
 */
function chromeTop(): number | undefined {
  const tops = ['[data-testid="compact-capsule"]', '[data-compact-above-capsule]']
    .flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((el) => !el.hasAttribute('data-hidden'))
    .map((el) => el.getBoundingClientRect().top);
  return tops.length === 0 ? undefined : Math.min(...tops);
}

/** Reads the viewport and the chrome; writes the variables. */
function read(): KeyboardState {
  const root = document.documentElement;
  const layoutHeight = window.innerHeight;
  const viewport = window.visualViewport;
  const inset = keyboardInset(layoutHeight, viewport);
  const viewTop = viewport ? Math.max(0, layoutHeight - inset - viewport.height) : 0;
  const typing = useCompactStore.getState().typing;
  const top = Math.max(viewTop, bottomOf('[data-testid="compact-top-bar"]'));
  // Typing: the band ends above the keyboard's Done; else above the island, if it shows.
  const doneTop = layoutHeight - Math.max(inset, 0) - ACCESSORY_GAP - ACCESSORY_HEIGHT;
  const islandTop = chromeTop() ?? layoutHeight;
  const bottom = typing ? doneTop - ACCESSORY_GAP : Math.min(layoutHeight - inset, islandTop);
  const set = (name: string, value: string) => {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  };
  set('--kb-inset', `${inset}px`);
  set('--free-top', `${Math.round(top)}px`);
  set('--free-bottom', `${Math.max(0, Math.round(layoutHeight - bottom))}px`);
  set('--free-left', '0px');
  set('--free-right', '0px');
  return { inset, band: { top, bottom } };
}

function start(): () => void {
  const viewport = window.visualViewport;
  const timers = new Set<number>();
  let frame = 0;
  const update = () => {
    current = read();
    for (const listener of listeners) listener(current);
  };
  // focusin/focusout: now, after a frame and after the keyboard's animation (iOS may report
  // only once it ends, and a few pixels late after it closes, WebKit 300523).
  const settle = () => {
    update();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      update();
    }, KEYBOARD_SETTLE_MS);
    timers.add(timer);
  };
  const unsubscribe = useCompactStore.subscribe((state, previous) => {
    if (state.typing !== previous.typing) settle();
  });
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  window.addEventListener('resize', update);
  window.addEventListener('focusin', settle);
  window.addEventListener('focusout', settle);
  update();
  return () => {
    unsubscribe();
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
    window.removeEventListener('focusin', settle);
    window.removeEventListener('focusout', settle);
    cancelAnimationFrame(frame);
    for (const timer of timers) window.clearTimeout(timer);
    const root = document.documentElement;
    for (const name of [
      '--kb-inset',
      '--free-top',
      '--free-bottom',
      '--free-left',
      '--free-right',
    ]) {
      root.style.removeProperty(name);
    }
    current = { inset: 0, band: { top: 0, bottom: 0 } };
  };
}

/**
 * Follows the keyboard: `listener` hears every reading, the first at once. The variables are
 * written while anyone watches and removed when the last stops.
 */
export function watchKeyboard(listener: Listener): () => void {
  listeners.add(listener);
  if (stopWatching) listener(current);
  else stopWatching = start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && stopWatching) {
      const stop = stopWatching;
      stopWatching = null;
      stop();
    }
  };
}

/**
 * Keeps `field` inside the band: on every keyboard reading, on input (the box grows) and on
 * `selectionchange` (WebKit does not keep a caret in a nested scroller in view, bug 191185),
 * the reader scrolls by `revealDelta`. While the keyboard is up the scroller's foot is padded
 * by its height, so a box on the last page can rise above it too.
 */
export function keepInView(field: HTMLElement): () => void {
  const scroller = field.closest<HTMLElement>('[data-read-viewport]');
  if (!scroller) return () => undefined;
  const padding = scroller.style.paddingBottom;
  let frame = 0;
  const reveal = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!field.isConnected) return;
      const { inset, band } = keyboardState();
      scroller.style.paddingBottom = inset > 0 ? `${inset + ACCESSORY_HEIGHT}px` : padding;
      const box = field.getBoundingClientRect();
      const delta = revealDelta({ top: box.top, bottom: box.bottom }, band);
      if (delta !== 0) scroller.scrollTop += delta;
    });
  };
  const onSelection = () => {
    if (document.activeElement === field) reveal();
  };
  const stop = watchKeyboard(reveal);
  field.addEventListener('input', reveal);
  document.addEventListener('selectionchange', onSelection);
  return () => {
    stop();
    cancelAnimationFrame(frame);
    field.removeEventListener('input', reveal);
    document.removeEventListener('selectionchange', onSelection);
    scroller.style.paddingBottom = padding;
  };
}
