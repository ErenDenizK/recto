/**
 * The door to phone editing's lazy chunk (`design/phone-2026-10/README.md` §7;
 * `research/phone-2026-10/code-audit.md` §4): everything that edits on a phone lives in
 * `./mark/` and loads by `import()`, so the static compact path gains only this loader, the ✎
 * button, the mode fields and the page overlay slot (PRC-11's 320 KB gate). The chunk is
 * loads on intent (EDN-21), never on idle: at ✎ pointerdown (or tap), at the first text
 * selection (`selection-host.tsx`), and when the open document has form fields. The island
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
 * Loads the chunk when `doc` has form fields (EDN-21): the fields mount in reading (MOB-1), so
 * their layer must be here. The probe asks the engine already open for the page renders; the
 * form store is not loaded for it, being part of the chunk.
 */
export function useLoadMarkForForms(doc: VirtualDocument): void {
  const sources = [
    ...new Set(doc.pages.flatMap((p) => (p.ref.kind === 'source' ? [p.ref.source] : []))),
  ].join();
  useEffect(() => {
    if (loaded || sources === '') return;
    let live = true;
    void (async () => {
      const editor = await getEngineService().editor();
      for (const source of sources.split(',')) {
        if (!live) return;
        if ((await editor.listFormFields(source as SourceId)).length > 0) {
          await loadMark();
          return;
        }
      }
    })().catch(() => undefined);
    return () => {
      live = false;
    };
  }, [sources]);
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
