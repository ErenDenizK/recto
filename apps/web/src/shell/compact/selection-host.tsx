/**
 * The phone's text selection watch (`design/phone-2026-10/README.md` §4 "Long-press on text";
 * code-audit §2 Highlight, §4c): a long press selects words natively in the page's text layer
 * (`CompactTextLayer`); once the selection has settled and no finger is down, the compact
 * selection bar (`selection-bar.tsx`) shows above it. The bar is split again: it loads on the
 * first selection, never on the static compact path nor with the edit chunk itself. Mounted
 * whenever the edit chunk is here (`CompactChrome`), reading and editing alike, since Highlight
 * and Copy work in both.
 *
 * The bar stays while it offers to undo a Highlight made while reading (`onKeep`), after the
 * selection that made it has gone. It never shows with the tool drawer open.
 */
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';

import { TEXT_LAYER_ATTR } from '../../viewer/text-model';
import { useCompactStore } from './compact-store';

const SelectionBar = lazy(() => import('./mark/selection-bar'));

/** The selection must hold this long without change before the bar shows, ms. */
export const SELECTION_SETTLE_MS = 250;

/** Whether `selection` is a non-empty range that starts in a page's text layer. */
export function isPageTextSelection(selection: Selection | null): boolean {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  if (selection.toString().trim() === '') return false;
  const node = selection.anchorNode;
  const el = node instanceof Element ? node : (node?.parentElement ?? null);
  return el?.closest(`[${TEXT_LAYER_ATTR}]`) != null;
}

let selected = false;
let pressing = false;
let timer: number | undefined;
const listeners = new Set<() => void>();

function publish(next: boolean): void {
  if (next === selected) return;
  selected = next;
  for (const listener of listeners) listener();
}

/** Re-reads the selection: it hides at once, and shows after it has settled. */
function check(): void {
  window.clearTimeout(timer);
  const now = !pressing && isPageTextSelection(globalThis.getSelection?.() ?? null);
  if (!now) {
    publish(false);
    return;
  }
  timer = window.setTimeout(() => {
    publish(!pressing && isPageTextSelection(globalThis.getSelection?.() ?? null));
  }, SELECTION_SETTLE_MS);
}

const onDown = (event: PointerEvent) => {
  if (!event.isPrimary) return;
  // A press on the bar itself keeps it (its buttons act on the selection).
  if (event.target instanceof Element && event.target.closest('[data-compact-selection-bar]')) {
    return;
  }
  pressing = true;
  check();
};
const onUp = () => {
  if (!pressing) return;
  pressing = false;
  check();
};

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    document.addEventListener('selectionchange', check);
    window.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointerup', onUp, { capture: true });
    window.addEventListener('pointercancel', onUp, { capture: true });
    // A long press on touch ends in `touchend` without a `pointerup` when the browser took it.
    window.addEventListener('touchend', onUp, { capture: true });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.clearTimeout(timer);
    document.removeEventListener('selectionchange', check);
    window.removeEventListener('pointerdown', onDown, { capture: true });
    window.removeEventListener('pointerup', onUp, { capture: true });
    window.removeEventListener('pointercancel', onUp, { capture: true });
    window.removeEventListener('touchend', onUp, { capture: true });
    pressing = false;
    selected = false;
  };
}

const snapshot = () => selected;

/** A settled text selection on a page, followed. */
export function useTextSelection(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function SelectionHost() {
  const has = useTextSelection();
  const drawerOpen = useCompactStore((s) => s.drawerOpen);
  const [kept, setKept] = useState(false);
  // Read once on mount: a selection made before the chunk arrived counts.
  useEffect(check, []);
  if ((!has && !kept) || drawerOpen) return null;
  return (
    <Suspense fallback={null}>
      <SelectionBar selected={has} onKeep={setKept} />
    </Suspense>
  );
}
