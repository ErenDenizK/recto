/**
 * The door to phone editing's lazy chunk (`design/phone-2026-10/README.md` §7;
 * `research/phone-2026-10/code-audit.md` §4): everything that edits on a phone lives in
 * `./mark/` and loads by `import()`, so the static compact path gains only this loader, the ✎
 * button, the mode fields and the page overlay slot (PRC-11's 320 KB gate). The chunk is
 * loads on intent (EDN-21), never on idle: at ✎ pointerdown (or tap), at the first text
 * selection (`selection-host.tsx`), and when a page with form fields comes near the view. The island
 * shows once it is here.
 */
import { type ComponentType, useEffect, useSyncExternalStore } from 'react';

import type { SourceId, VirtualDocument } from '@pdf-editor/document-model';

import { getEngineService } from '../../engine/engine-service';
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

/**
 * Loads the chunk when a page of `doc` that has form fields comes near the view (EDN-21): the
 * fields mount in reading (MOB-1), so their layer must be here when the reader reaches them.
 * The probe asks the engine already open, once per document, which pages have fields (the form
 * store lives in the chunk); "near" is the reader's mounted window of pages, checked after the
 * probe and whenever pages mount. A document without fields never loads it.
 */
export function useLoadMarkForForms(doc: VirtualDocument): void {
  // The pages' sources, by position: the effect re-runs when these change, not on every edit.
  const refs = doc.pages
    .map((p) => (p.ref.kind === 'source' ? `${p.ref.source}:${p.ref.index}` : '-'))
    .join();
  useEffect(() => {
    if (loaded) return;
    const pages = refs.split(',').map((ref) => {
      const cut = ref.lastIndexOf(':');
      return cut < 0
        ? null
        : { source: ref.slice(0, cut) as SourceId, index: Number(ref.slice(cut + 1)) };
    });
    let live = true;
    let stop: () => void = () => undefined;
    void (async () => {
      const editor = await getEngineService().editor();
      const withFields = new Map<SourceId, Set<number>>();
      for (const page of pages) if (page) withFields.set(page.source, new Set());
      for (const [source, indexes] of withFields) {
        for (const field of await editor.listFormFields(source)) {
          for (const w of field.widgets ?? [{ pageIndex: field.pageIndex }])
            indexes.add(w.pageIndex);
        }
      }
      const positions = pages.flatMap((page, position) =>
        page && withFields.get(page.source)?.has(page.index) ? [position] : [],
      );
      if (!live || positions.length === 0) return;
      let frame = 0;
      const near = () =>
        positions.some((p) => document.querySelector(`[data-page-index="${p}"]`) !== null);
      const check = () => {
        frame = 0;
        if (!live || !near()) return;
        stop();
        void loadMark().catch(() => undefined);
      };
      const onMount = () => {
        if (frame === 0) frame = requestAnimationFrame(check);
      };
      const observer = new MutationObserver(onMount);
      observer.observe(document.body, { childList: true, subtree: true });
      stop = () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      };
      check();
    })().catch(() => undefined);
    return () => {
      live = false;
      stop();
    };
  }, [refs]);
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

/** ✎ pointerdown: starts the load a tap later needs (EDN-21). */
export function prepareEditing(): void {
  void loadMark().catch(() => undefined);
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
 * compact path does not load. A layer registered with `reading` mounts in reading too, once
 * the chunk is here (the form fields, MOB-1: a tap fills without ✎).
 */
export interface CompactOverlay {
  readonly Layer: ComponentType<PageOverlayProps>;
  readonly reading: boolean;
}

let overlays: readonly CompactOverlay[] = [];
const overlayListeners = new Set<() => void>();

/** Adds a page layer for editing (and reading, with `reading`); returns its removal. */
export function registerCompactOverlay(
  layer: ComponentType<PageOverlayProps>,
  options: { readonly reading?: boolean } = {},
): () => void {
  const entry: CompactOverlay = { Layer: layer, reading: options.reading === true };
  overlays = [...overlays, entry];
  for (const listener of overlayListeners) listener();
  return () => {
    overlays = overlays.filter((o) => o !== entry);
    for (const listener of overlayListeners) listener();
  };
}

const subscribeOverlays = (listener: () => void) => {
  overlayListeners.add(listener);
  return () => overlayListeners.delete(listener);
};
const overlaySnapshot = () => overlays;

/** The page layers, followed. */
export function useCompactOverlays(): readonly CompactOverlay[] {
  return useSyncExternalStore(subscribeOverlays, overlaySnapshot, overlaySnapshot);
}
