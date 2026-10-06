/**
 * Safe-area insets as numbers for layout code (`components/01-frame.md` F1 §2, §8; research
 * 19 M-3, M-4). CSS reads `env(safe-area-inset-*)` directly; code that lays pages out (fit
 * width, the compact reader's margins, scroll targets) needs the same values in CSS px, so
 * a hidden probe element carries them as padding and the computed style is read back.
 *
 * - The insets are zero unless the page opts into the full screen with `viewport-fit=cover`
 *   (the compact edition does, ADR-0033; the full edition's `index.html` does not yet).
 * - They change on rotation and when browser chrome shows or hides, so the hook re-reads on
 *   `resize`, `orientationchange` and the visual viewport's `resize`.
 * - `withMinimum(insets, 8)` is the frame's side rule, `max(env(safe-area-inset-*), 8px)`.
 *
 * The free rectangle (F1 §2, §9; flows.md §6.2's rest rule) is the second half of this module:
 * `freeInsets` derives it from the frame's layers, and `useFreeRect` measures them and writes
 * `--free-top|right|bottom|left` on `:root`, which the stage (`shell/Stage.module.css`), the
 * dock band, the soft scroll edge and the toast region read. Jumps, fits and focus then land
 * inside it through the Read view's scroll padding (`stage/ReadView.tsx`, A-12).
 */
import { type RefObject, useLayoutEffect, useSyncExternalStore } from 'react';

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export const ZERO_INSETS: Insets = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

const SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** A computed padding (`"47px"`) as a number; anything unreadable is 0. */
function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** The insets an element carries as its padding (the probe's, or a test's). */
export function insetsFromPadding(element: Element): Insets {
  const style = getComputedStyle(element);
  return {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  };
}

/** Each inset raised to at least `minimum` (the frame's `max(env(…), 8px)` rule). */
export function withMinimum(insets: Insets, minimum: number): Insets {
  return {
    top: Math.max(insets.top, minimum),
    right: Math.max(insets.right, minimum),
    bottom: Math.max(insets.bottom, minimum),
    left: Math.max(insets.left, minimum),
  };
}

export function sameInsets(a: Insets, b: Insets): boolean {
  return SIDES.every((side) => a[side] === b[side]);
}

let probe: HTMLElement | undefined;

/** The hidden element whose padding is the safe area (created once, on first read). */
function safeAreaProbe(doc: Document): HTMLElement {
  if (probe?.isConnected && probe.ownerDocument === doc) return probe;
  const element = doc.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.dataset.safeAreaProbe = '';
  element.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 0',
    'height: 0',
    'visibility: hidden',
    'pointer-events: none',
    'padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
  ].join(';');
  doc.body.append(element);
  probe = element;
  return element;
}

/** The safe-area insets now, in CSS px (zero without `viewport-fit=cover`). */
export function readSafeAreaInsets(doc: Document = document): Insets {
  if (!doc.body) return ZERO_INSETS;
  return insetsFromPadding(safeAreaProbe(doc));
}

let cached: Insets = ZERO_INSETS;

function snapshot(): Insets {
  const next = readSafeAreaInsets();
  if (!sameInsets(next, cached)) cached = next;
  return cached;
}

function subscribe(listener: () => void): () => void {
  const viewport = window.visualViewport;
  window.addEventListener('resize', listener);
  window.addEventListener('orientationchange', listener);
  viewport?.addEventListener('resize', listener);
  return () => {
    window.removeEventListener('resize', listener);
    window.removeEventListener('orientationchange', listener);
    viewport?.removeEventListener('resize', listener);
  };
}

const serverSnapshot = (): Insets => ZERO_INSETS;

/** The safe-area insets, kept current across rotation and browser-chrome changes. */
export function useSafeAreaInsets(): Insets {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

// ---------------------------------------------------------------------------------------------
// The free rectangle (01-frame F1 §2)
// ---------------------------------------------------------------------------------------------

/** The dock band's offset from the window's bottom edge, medium and up (F1 §2, F10 §2). */
export const BAND_OFFSET = 16;
/** The same on compact and compact-height (`max(safe-bottom, 12px)`). */
export const BAND_OFFSET_COMPACT = 12;
/** A side panel insets the free rectangle only while this much stage stays beside it (X23). */
export const MIN_STAGE_BESIDE_SHEET = 400;
/** The soft scroll edge under the strip, and how far below the strip jumps land (01.9). */
export const SOFT_EDGE = 24;

/** What the frame's layers measure, in CSS px (transforms ignored: they are motion). */
export interface FrameMeasure {
  /** The window's width. */
  readonly width: number;
  /** Height of the top layer (the strip, or the compact bar); 0 without one. */
  readonly top: number;
  /** Width of the sidebar while it shows; 0 while closed. */
  readonly sidebar: number;
  /** The sidebar is docked (expanded and up) rather than laid over the stage (medium). */
  readonly sidebarDocked: boolean;
  /** Width of a side panel on the right (the inspector until D2-9, tool side sheets); 0 if none. */
  readonly side: number;
  /** Height of the tallest resting item of the dock band (dock, palette, pill); 0 if none. */
  readonly band: number;
  /** The band's offset from the bottom edge (16, or 12 on compact). */
  readonly offset: number;
  /** Focus (F13): the dock and pill are away, so the bottom inset falls to the offset alone. */
  readonly focus: boolean;
}

/**
 * The free rectangle's insets from the window's edges (F1 §2): top is the top layer; left the
 * docked sidebar (an overlay sidebar insets nothing); right a side panel while at least 400 px
 * of stage remain beside it (X23), else it overlays; bottom the band with its offset, the
 * offset alone in Focus, and nothing while no band item shows (the Library).
 *
 * Hide on scroll (F12) changes nothing here: the bars move by transform and the page keeps
 * its place ("the page does not reflow"); a jump is made from visible chrome, so it starts
 * shown.
 */
export function freeInsets(measure: FrameMeasure): Insets {
  const left = measure.sidebarDocked ? measure.sidebar : 0;
  const right =
    measure.side > 0 && measure.width - left - measure.side >= MIN_STAGE_BESIDE_SHEET
      ? measure.side
      : 0;
  const bottom = measure.focus
    ? measure.offset
    : measure.band > 0
      ? measure.offset + measure.band
      : 0;
  return { top: measure.top, right, bottom, left };
}

/** `--free-*` custom properties for `insets`. */
export function freeInsetVars(insets: Insets): Readonly<Record<string, string>> {
  return {
    '--free-top': `${insets.top}px`,
    '--free-right': `${insets.right}px`,
    '--free-bottom': `${insets.bottom}px`,
    '--free-left': `${insets.left}px`,
  };
}

/** Layer markers inside the shell, read by `measureFrame`. */
export const FRAME_LAYER = {
  top: '[data-frame-layer="top"]',
  sidebar: '[data-frame-layer="sidebar"]',
  side: '[data-frame-layer="side"]',
  band: '[data-frame-layer="band"]',
  // The page pill marks itself; the dock (today's floating tool bar, D2-2's capsule) is the
  // band's toolbar.
  bandItem: '[data-band-item], [data-frame-layer="band"] [data-region="toolbar"]',
} as const;

/** The element if it takes space (present and not `display: none`), else null. */
function laidOut(element: HTMLElement | null): HTMLElement | null {
  return element && element.getClientRects().length > 0 ? element : null;
}

export interface FrameOptions {
  readonly sidebarDocked: boolean;
  readonly offset: number;
  readonly focus: boolean;
}

/** Reads the shell's layers (offset sizes, so a transform in flight changes nothing). */
export function measureFrame(shell: HTMLElement, options: FrameOptions): FrameMeasure {
  const top = laidOut(shell.querySelector<HTMLElement>(FRAME_LAYER.top));
  const sidebar = laidOut(shell.querySelector<HTMLElement>(FRAME_LAYER.sidebar));
  const side = laidOut(shell.querySelector<HTMLElement>(FRAME_LAYER.side));
  let band = 0;
  for (const item of shell.querySelectorAll<HTMLElement>(FRAME_LAYER.bandItem)) {
    if (laidOut(item)) band = Math.max(band, item.offsetHeight);
  }
  return {
    width: shell.clientWidth,
    top: top?.offsetHeight ?? 0,
    sidebar: sidebar?.offsetWidth ?? 0,
    sidebarDocked: options.sidebarDocked,
    side: side?.offsetWidth ?? 0,
    band,
    offset: options.offset,
    focus: options.focus,
  };
}

/** Writes the free rectangle on `root` (only the properties that changed). */
export function applyFreeInsets(root: HTMLElement, insets: Insets): void {
  for (const [name, value] of Object.entries(freeInsetVars(insets))) {
    if (root.style.getPropertyValue(name) !== value) root.style.setProperty(name, value);
  }
}

/**
 * Measures the frame inside `shell` and keeps `--free-*` on `:root` current: on every size
 * change of the shell or a layer (a panel opening, a sidebar dragged wider, the dock becoming
 * the palette), on layers mounting and unmounting, and when an option changes (Focus, the
 * size class). One `ResizeObserver`, measured before paint.
 */
export function useFreeRect(shell: RefObject<HTMLElement | null>, options: FrameOptions): void {
  const { sidebarDocked, offset, focus } = options;
  useLayoutEffect(() => {
    const element = shell.current;
    if (!element) return;
    const root = element.ownerDocument.documentElement;
    const measure = () =>
      applyFreeInsets(root, freeInsets(measureFrame(element, { sidebarDocked, offset, focus })));
    const resize = new ResizeObserver(measure);
    const observe = () => {
      resize.disconnect();
      resize.observe(element);
      for (const selector of Object.values(FRAME_LAYER)) {
        for (const layer of element.querySelectorAll<HTMLElement>(selector)) resize.observe(layer);
      }
    };
    observe();
    measure();
    // Layers mount and unmount: the shell's own children (sidebar, side panel), and the band's
    // items (the dock leaves on the Library, the pill in the grid).
    const mutation = new MutationObserver(() => {
      observe();
      measure();
    });
    mutation.observe(element, { childList: true });
    const band = element.querySelector(FRAME_LAYER.band);
    if (band) mutation.observe(band, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [shell, sidebarDocked, offset, focus]);
}
