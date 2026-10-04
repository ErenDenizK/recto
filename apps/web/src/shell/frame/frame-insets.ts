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
 * The free rectangle (`useFreeRect`, `revealInFree`, `--free-*`, 01-frame F1 §9) builds on
 * these when the D2 shell lands; this module only measures.
 */
import { useSyncExternalStore } from 'react';

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
