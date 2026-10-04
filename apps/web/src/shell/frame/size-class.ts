/**
 * Size classes (ADR-0031 §2 item 1, `components/01-frame.md` F1 §9; research 19 M-1): the
 * window's width picks one of five classes, and a short window (a phone on its side) is
 * flagged apart. Classes move surfaces, never meanings.
 *
 * | Class    | Width (CSS px) |
 * |----------|----------------|
 * | compact  | < 600          |
 * | medium   | 600–839        |
 * | expanded | 840–1199       |
 * | large    | 1200–1599      |
 * | xlarge   | ≥ 1600         |
 *
 * - **compact-height** (`short`): height < 480 and width < 1000.
 * - **tight**: height < 352 at any width, where 88 px of chrome would reach A-20's 25 %
 *   (01-frame F1 §6, "Short viewports").
 *
 * Everything is in CSS px (`innerWidth` / `innerHeight`), so browser zoom moves the class:
 * a desktop at 400 % zoom is compact (A-20, WCAG 1.4.10) and keeps every function. The
 * class is a layout fact only. It never picks the edition (`edition.ts`, ADR-0033 §2.1),
 * and density follows the pointer, not the width (`input-modality.ts`, M-2, A-15).
 *
 * `useSizeClass()` mirrors the class on `:root` as `data-size`, `data-short` and
 * `data-tight`, so CSS and container queries can follow it. No stylesheet reads them yet:
 * setting them changes nothing on screen (spec D0-2).
 */
import { useLayoutEffect, useSyncExternalStore } from 'react';

export type SizeClass = 'compact' | 'medium' | 'expanded' | 'large' | 'xlarge';

/** Lower bounds of each class above compact, in CSS px. */
export const SIZE_CLASS_MIN_WIDTH = {
  medium: 600,
  expanded: 840,
  large: 1200,
  xlarge: 1600,
} as const;

/** compact-height: a window lower than this … */
export const COMPACT_HEIGHT_MAX_HEIGHT = 480;
/** … and narrower than this (a phone on its side, not a short desktop window). */
export const COMPACT_HEIGHT_MAX_WIDTH = 1000;
/** Below this height the top bar folds into the dock (`data-tight`, 01-frame F1 §6). */
export const TIGHT_MAX_HEIGHT = 352;

/** The width class of a viewport `width` CSS px wide. */
export function sizeClassOf(width: number): SizeClass {
  if (width >= SIZE_CLASS_MIN_WIDTH.xlarge) return 'xlarge';
  if (width >= SIZE_CLASS_MIN_WIDTH.large) return 'large';
  if (width >= SIZE_CLASS_MIN_WIDTH.expanded) return 'expanded';
  if (width >= SIZE_CLASS_MIN_WIDTH.medium) return 'medium';
  return 'compact';
}

/** compact-height: lower than 480 and narrower than 1000 CSS px. */
export function isCompactHeight(width: number, height: number): boolean {
  return height < COMPACT_HEIGHT_MAX_HEIGHT && width < COMPACT_HEIGHT_MAX_WIDTH;
}

/** Lower than 352 CSS px, at any width. */
export function isTight(height: number): boolean {
  return height < TIGHT_MAX_HEIGHT;
}

export interface FrameClass {
  readonly size: SizeClass;
  /** compact-height (`data-short`). */
  readonly short: boolean;
  /** `data-tight`. */
  readonly tight: boolean;
}

/** The frame class of a viewport. */
export function frameClassOf(width: number, height: number): FrameClass {
  return {
    size: sizeClassOf(width),
    short: isCompactHeight(width, height),
    tight: isTight(height),
  };
}

/**
 * Writes the class on `root`: `data-size="compact|…"`, and `data-short` / `data-tight` as
 * present-or-absent flags.
 */
export function applyFrameClass(root: HTMLElement, frame: FrameClass): void {
  if (root.dataset.size !== frame.size) root.dataset.size = frame.size;
  root.toggleAttribute('data-short', frame.short);
  root.toggleAttribute('data-tight', frame.tight);
}

export function sameFrameClass(a: FrameClass, b: FrameClass): boolean {
  return a.size === b.size && a.short === b.short && a.tight === b.tight;
}

/** The window's layout viewport in CSS px (what width media queries read). */
export interface ViewportSource {
  readonly innerWidth: number;
  readonly innerHeight: number;
  addEventListener(type: 'resize', listener: () => void): void;
  removeEventListener(type: 'resize', listener: () => void): void;
}

/**
 * A subscribable frame class for one window: `get()` answers the same object while the
 * class is unchanged (React's `useSyncExternalStore` needs a stable snapshot), and
 * `subscribe` calls back on every resize, rotation or zoom that may change it.
 */
export function createFrameClassSource(win: ViewportSource) {
  let cached: FrameClass | undefined;
  const get = (): FrameClass => {
    const next = frameClassOf(win.innerWidth, win.innerHeight);
    if (!cached || !sameFrameClass(cached, next)) cached = next;
    return cached;
  };
  const subscribe = (listener: () => void): (() => void) => {
    // A rotation and a browser zoom both fire `resize` on the window.
    win.addEventListener('resize', listener);
    return () => win.removeEventListener('resize', listener);
  };
  return { get, subscribe };
}

let windowSource: ReturnType<typeof createFrameClassSource> | undefined;
const source = () => (windowSource ??= createFrameClassSource(window));
const subscribeWindow = (listener: () => void) => source().subscribe(listener);
const getWindow = () => source().get();

/**
 * The window's frame class, kept current across resizes, rotations and zoom, and mirrored
 * on `:root` (`data-size`, `data-short`, `data-tight`) before paint.
 */
export function useSizeClass(): FrameClass {
  const frame = useSyncExternalStore(subscribeWindow, getWindow, getWindow);
  useLayoutEffect(() => {
    applyFrameClass(document.documentElement, frame);
  }, [frame]);
  return frame;
}
