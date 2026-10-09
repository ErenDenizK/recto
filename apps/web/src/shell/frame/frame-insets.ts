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
  /** Height of the tallest resting item of the dock band (dock, palette, pill); 0 if none. */
  readonly band: number;
  /** The band's offset from the bottom edge (16, or 12 on compact). */
  readonly offset: number;
  /** Focus (F13): the dock and pill are away, so the bottom inset falls to the offset alone. */
  readonly focus: boolean;
  /**
   * What an open side sheet covers at the window's trailing edge: its width and the gap
   * outside it (0 with none open). Optional for callers that measure no sheet.
   */
  readonly sideSheet?: number;
}

/** A side sheet insets the free rectangle only while this much stage remains (F1 §2). */
export const SIDE_SHEET_MIN_STAGE = 400;

/**
 * The free rectangle's insets from the window's edges (F1 §2): top is the top layer; left the
 * docked sidebar (an overlay sidebar insets nothing); right an open side sheet (a tool or task
 * sheet, 07-sheets §2.2) while at least 400 px of stage remains beside it, else it overlays, so
 * the dock band, the pill and the pages keep clear of it (V2 review item 6: the OCR sheet covered
 * the dock's More); bottom the band with its offset, the offset alone in Focus, and nothing while
 * no band item shows (the Library).
 *
 * Hide on scroll (F12) changes nothing here: the bars move by transform and the page keeps
 * its place ("the page does not reflow"); a jump is made from visible chrome, so it starts
 * shown.
 */
export function freeInsets(measure: FrameMeasure): Insets {
  const left = measure.sidebarDocked ? measure.sidebar : 0;
  const sheet = measure.sideSheet ?? 0;
  const right = sheet > 0 && measure.width - left - sheet >= SIDE_SHEET_MIN_STAGE ? sheet : 0;
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
  band: '[data-frame-layer="band"]',
  // The page pill marks itself; the dock (today's floating tool bar, D2-2's capsule) is the
  // band's toolbar.
  bandItem: '[data-band-item], [data-frame-layer="band"] [data-region="toolbar"]',
} as const;

/** An open side sheet's panel (ui/sheet/Sheet.tsx portals it outside the shell). */
const SIDE_SHEET = '[data-sheet][data-presentation="side"]:not([inert])';

/**
 * How much of the window's trailing edge an open side sheet covers: from its leading edge to the
 * window's (its layout box, so its entrance in flight changes nothing). 0 with none open.
 */
export function sideSheetCover(doc: Document): number {
  const width = doc.documentElement.clientWidth;
  let cover = 0;
  for (const panel of doc.querySelectorAll<HTMLElement>(SIDE_SHEET)) {
    if (!laidOut(panel)) continue;
    cover = Math.max(cover, width - panel.offsetLeft);
  }
  return Math.max(0, Math.round(cover));
}

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
  let band = 0;
  for (const item of shell.querySelectorAll<HTMLElement>(FRAME_LAYER.bandItem)) {
    if (laidOut(item)) band = Math.max(band, item.offsetHeight);
  }
  return {
    width: shell.clientWidth,
    top: top?.offsetHeight ?? 0,
    sidebar: sidebar?.offsetWidth ?? 0,
    sidebarDocked: options.sidebarDocked,
    band,
    offset: options.offset,
    focus: options.focus,
    sideSheet: sideSheetCover(shell.ownerDocument),
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
    // Layers mount and unmount: the shell's own children (the sidebar), and the band's
    // items (the dock leaves on the Library, the pill in the grid).
    const mutation = new MutationObserver(() => {
      observe();
      measure();
    });
    mutation.observe(element, { childList: true });
    const band = element.querySelector(FRAME_LAYER.band);
    if (band) mutation.observe(band, { childList: true, subtree: true });
    // A layer that stops being one while it is still drawn (the sidebar sliding out, frame.md
    // §1) gives its inset back at once: its marker going is a change of the frame.
    const markers = new MutationObserver(() => {
      observe();
      measure();
    });
    markers.observe(element, {
      attributes: true,
      attributeFilter: ['data-frame-layer'],
      subtree: true,
    });
    // Side sheets portal into the body: a portal coming or going, and a panel turning inert
    // as it closes, re-measure (the body's own subtree, the app, is not watched).
    const body = element.ownerDocument.body;
    const portals = new MutationObserver(measure);
    const watchPortals = () => {
      portals.disconnect();
      for (const child of Array.from(body.children)) {
        if (child.contains(element)) continue;
        portals.observe(child, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['inert', 'data-presentation'],
        });
      }
    };
    const bodyWatch = new MutationObserver(() => {
      watchPortals();
      measure();
    });
    bodyWatch.observe(body, { childList: true });
    watchPortals();
    window.addEventListener('resize', measure);
    return () => {
      resize.disconnect();
      mutation.disconnect();
      markers.disconnect();
      portals.disconnect();
      bodyWatch.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [shell, sidebarDocked, offset, focus]);
}

// ---------------------------------------------------------------------------------------------
// The visual viewport (owner feedback 2026-10-08, F2: pop-ups must fit)
// ---------------------------------------------------------------------------------------------

/**
 * Writes the visual viewport's height as `--visual-h` on `:root` and keeps it current. The
 * layout viewport (`100dvh`, and the room Base UI's positioners measure) stays tall while an
 * on-screen keyboard, a pinch zoom or the browser's own bars cover part of the window, so every
 * popover, menu and sheet also caps its height to this, less its insets, and scrolls inside
 * (ui/Popover.module.css, ui/Menu.module.css, ui/sheet/Sheet.module.css).
 */
export function useVisualViewportHeight(): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const write = () => {
      const height = Math.round(viewport?.height ?? window.innerHeight);
      const value = `${height}px`;
      if (root.style.getPropertyValue('--visual-h') !== value) {
        root.style.setProperty('--visual-h', value);
      }
    };
    write();
    window.addEventListener('resize', write);
    viewport?.addEventListener('resize', write);
    return () => {
      window.removeEventListener('resize', write);
      viewport?.removeEventListener('resize', write);
      root.style.removeProperty('--visual-h');
    };
  }, []);
}

// ---------------------------------------------------------------------------------------------
// Floating bottom chrome outside the band (08-feedback FB4 §2, 01-frame F13 §2)
// ---------------------------------------------------------------------------------------------

/**
 * Bars that float at the foot of a view but are not band items: the Library's selection bar
 * (02-library L6), which sits 16 px above the view's edge inside the stage. They must not move
 * the free rectangle (the Library would lay out again under a selection, and the bar, inside
 * the stage, would ride up on its own inset), but the toast stack keeps above them all the
 * same: toasts stack above the dock band and every bar in it, never over one (FB4 §2).
 *
 * Each such bar registers its element; the most any of them rises above the window's bottom
 * edge is written as `--chrome-float` on `:root` (0 px, and removed, when none shows), which
 * the toast region takes with `--free-bottom` (`ui/Toast/Toast.module.css`).
 */
const floating = new Map<HTMLElement, number>();

/** How far `element`'s layout box rises above the viewport's bottom edge (transforms ignored). */
function riseOf(element: HTMLElement): number {
  let top = 0;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.offsetParent as HTMLElement | null
  ) {
    top += node.offsetTop;
  }
  return Math.max(0, element.ownerDocument.documentElement.clientHeight - top);
}

function writeFloating(root: HTMLElement): void {
  const rise = Math.max(0, ...floating.values());
  if (rise > 0) root.style.setProperty('--chrome-float', `${Math.round(rise)}px`);
  else root.style.removeProperty('--chrome-float');
}

/** Registers a floating bottom bar (see above) while it is mounted. */
export function useFloatingBottomChrome(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = element.ownerDocument.documentElement;
    const measure = () => {
      floating.set(element, element.getClientRects().length > 0 ? riseOf(element) : 0);
      writeFloating(root);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', measure);
      floating.delete(element);
      writeFloating(root);
    };
  }, [ref]);
}
