/**
 * The door to phone editing's lazy chunk (`design/phone-2026-10/README.md` §7;
 * `research/phone-2026-10/code-audit.md` §4): everything that edits on a phone lives in
 * `./mark/` and loads by `import()`, so the static compact path gains only this loader, the ✎
 * button, the mode fields and the page overlay slot (PRC-11's 320 KB gate). The chunk is
 * fetched when the browser is idle after the reader opens (as the on-demand sheets, EDN-10),
 * and at the latest when ✎ is tapped; the island shows once it is here.
 */
import { type ComponentType, useEffect, useSyncExternalStore } from 'react';

import type { PageOverlayProps } from '../../stage/page-overlays';
import type * as MarkModule from './mark';

export type Mark = typeof MarkModule;

let loading: Promise<Mark> | undefined;
let loaded: Mark | null = null;
const listeners = new Set<() => void>();

/** Fetches the chunk once; a failed fetch (offline before the precache filled) is retried. */
export function loadMark(): Promise<Mark> {
  loading ??= import('./mark').then(
    (module) => {
      loaded = module;
      for (const listener of listeners) listener();
      return module;
    },
    (error: unknown) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => loaded;

/** The chunk once it has loaded, else null; re-renders when it arrives. */
export function useMark(): Mark | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** How long the idle prefetch may wait for an idle moment, ms (as the sheets'). */
const PREFETCH_TIMEOUT_MS = 4000;

/** Prefetches the chunk when the browser is idle while the reader shows. */
export function usePrefetchMark(): void {
  useEffect(() => {
    if (loaded) return;
    const load = () => void loadMark().catch(() => undefined);
    const idle = typeof window.requestIdleCallback === 'function';
    const handle = idle
      ? window.requestIdleCallback(load, { timeout: PREFETCH_TIMEOUT_MS })
      : window.setTimeout(load, PREFETCH_TIMEOUT_MS);
    return () => {
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
}

/**
 * The capsule's box as it was before a change of content, read by the island's morph
 * (`mark/capsule-morph.ts`) after React has swapped the content.
 */
let capsuleBefore: DOMRect | null = null;

/** Remembers the capsule's box now, before its content changes. */
export function snapshotCapsule(): void {
  capsuleBefore =
    document.querySelector('[data-testid="compact-capsule"]')?.getBoundingClientRect() ?? null;
}

/** The box `snapshotCapsule` remembered, once. */
export function takeCapsuleSnapshot(): DOMRect | null {
  const box = capsuleBefore;
  capsuleBefore = null;
  return box;
}

/** ✎: loads the chunk if needed, then enters editing through its bridge. */
export function startEditing(): void {
  void loadMark()
    .then((mark) => {
      snapshotCapsule();
      mark.enterEditing();
    })
    .catch(() => undefined);
}

/**
 * The page overlay slot (`CompactPage`): the layers the chunk mounts over each page while
 * editing, in drawing order (the dry ink, then the annotation layer, then a lane's own). Kept
 * here rather than in the full edition's `stage/page-overlays` registry, which the static
 * compact path does not load.
 */
let overlays: readonly ComponentType<PageOverlayProps>[] = [];
const overlayListeners = new Set<() => void>();

/** Adds a page layer for editing; returns its removal. */
export function registerCompactOverlay(layer: ComponentType<PageOverlayProps>): () => void {
  overlays = [...overlays, layer];
  for (const listener of overlayListeners) listener();
  return () => {
    overlays = overlays.filter((l) => l !== layer);
    for (const listener of overlayListeners) listener();
  };
}

const subscribeOverlays = (listener: () => void) => {
  overlayListeners.add(listener);
  return () => overlayListeners.delete(listener);
};
const overlaySnapshot = () => overlays;

/** The editing page layers, followed. */
export function useCompactOverlays(): readonly ComponentType<PageOverlayProps>[] {
  return useSyncExternalStore(subscribeOverlays, overlaySnapshot, overlaySnapshot);
}
