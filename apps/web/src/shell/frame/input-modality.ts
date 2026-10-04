/**
 * Input modality (ADR-0031 §2 item 1, `components/01-frame.md` F12 §6; research 19 M-2,
 * research 22 A-15): what pointers the device has, and what the person used last.
 *
 * - **Pointer capabilities** come from media queries: the primary pointer's precision
 *   (`pointer: coarse | fine | none`), whether any pointer is coarse or fine, and whether
 *   the primary pointer and any pointer can hover. Density follows the pointer, not the
 *   width: 44 px targets on a coarse pointer in every class.
 * - **The last input** is `mouse`, `touch`, `pen` (from `pointerdown`) or `keyboard` (from
 *   `keydown`), tracked on the window in the capture phase so a handler that stops the
 *   event cannot hide it. Hide on scroll never hides the bars while the last input was a key
 *   (F12 §4, A-12).
 *
 * The edition (`edition.ts`) reads the primary pointer once at launch; everything else here
 * may change at any time (a mouse plugged into a tablet, a keyboard on a phone).
 */
import { useSyncExternalStore } from 'react';

export type PointerPrecision = 'coarse' | 'fine' | 'none';
export type InputType = 'mouse' | 'touch' | 'pen' | 'keyboard';

export interface PointerCapabilities {
  /** The primary pointer's precision (`pointer:`). */
  readonly primary: PointerPrecision;
  /** Some pointer is coarse (`any-pointer: coarse`): a touch screen on a laptop. */
  readonly anyCoarse: boolean;
  /** Some pointer is fine (`any-pointer: fine`): a mouse on a tablet. */
  readonly anyFine: boolean;
  /** The primary pointer can hover (`hover: hover`). */
  readonly hover: boolean;
  /** Some pointer can hover (`any-hover: hover`). */
  readonly anyHover: boolean;
}

/** `window.matchMedia`, or a test's stand-in. */
export type MatchMedia = (query: string) => { readonly matches: boolean };

function browserMatchMedia(): MatchMedia {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? (query) => window.matchMedia(query)
    : () => ({ matches: false });
}

/** The device's pointers, read from media queries. */
export function readPointerCapabilities(
  matchMedia: MatchMedia = browserMatchMedia(),
): PointerCapabilities {
  const primary: PointerPrecision = matchMedia('(pointer: coarse)').matches
    ? 'coarse'
    : matchMedia('(pointer: fine)').matches
      ? 'fine'
      : 'none';
  return {
    primary,
    anyCoarse: matchMedia('(any-pointer: coarse)').matches,
    anyFine: matchMedia('(any-pointer: fine)').matches,
    hover: matchMedia('(hover: hover)').matches,
    anyHover: matchMedia('(any-hover: hover)').matches,
  };
}

/** The input an event stands for; an unknown pointer type counts as a mouse. */
export function inputTypeOf(event: Event): InputType | undefined {
  if (event.type === 'keydown') return 'keyboard';
  if (event.type !== 'pointerdown') return undefined;
  const type = (event as PointerEvent).pointerType;
  return type === 'touch' || type === 'pen' ? type : 'mouse';
}

export interface InputTracker {
  /** The last input, or undefined before the first one. */
  get(): InputType | undefined;
  /** Calls back when the last input changes kind (not on every event). */
  subscribe(listener: () => void): () => void;
  /** Stops listening. */
  dispose(): void;
}

/** Tracks the last input on `target` (the window), from `pointerdown` and `keydown`. */
export function createInputTracker(target: EventTarget, initial?: InputType): InputTracker {
  let last = initial;
  const listeners = new Set<() => void>();
  const onInput = (event: Event) => {
    const type = inputTypeOf(event);
    if (type === undefined || type === last) return;
    last = type;
    for (const listener of listeners) listener();
  };
  const options = { capture: true, passive: true } as const;
  target.addEventListener('pointerdown', onInput, options);
  target.addEventListener('keydown', onInput, options);
  return {
    get: () => last,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      target.removeEventListener('pointerdown', onInput, options);
      target.removeEventListener('keydown', onInput, options);
      listeners.clear();
    },
  };
}

let windowTracker: InputTracker | undefined;

/** The window's input tracker, started on first use and kept for the page's life. */
export function inputTracker(): InputTracker {
  windowTracker ??= createInputTracker(window);
  return windowTracker;
}

/** The last input type, without subscribing (event handlers). */
export function lastInput(): InputType | undefined {
  return inputTracker().get();
}

const subscribeInput = (listener: () => void) => inputTracker().subscribe(listener);
const getInput = () => inputTracker().get();

/** The last input type; re-renders when it changes kind. */
export function useLastInput(): InputType | undefined {
  return useSyncExternalStore(subscribeInput, getInput, () => undefined);
}

const POINTER_QUERIES = [
  '(pointer: coarse)',
  '(pointer: fine)',
  '(any-pointer: coarse)',
  '(any-pointer: fine)',
  '(hover: hover)',
  '(any-hover: hover)',
];

let capabilities: PointerCapabilities | undefined;

function subscribeCapabilities(listener: () => void): () => void {
  const lists = POINTER_QUERIES.map((query) => window.matchMedia(query));
  const onChange = () => {
    capabilities = undefined;
    listener();
  };
  for (const list of lists) list.addEventListener('change', onChange);
  return () => {
    for (const list of lists) list.removeEventListener('change', onChange);
  };
}

function getCapabilities(): PointerCapabilities {
  capabilities ??= readPointerCapabilities();
  return capabilities;
}

/** The device's pointers; re-renders when one is added or removed. */
export function usePointerCapabilities(): PointerCapabilities {
  return useSyncExternalStore(subscribeCapabilities, getCapabilities, getCapabilities);
}
