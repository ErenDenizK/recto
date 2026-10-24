/**
 * The door to phone editing's lazy chunk (`design/phone-2026-10/README.md` §7;
 * `research/phone-2026-10/code-audit.md` §4): everything that edits on a phone lives in
 * `./mark/` and loads by `import()`, so the static compact path gains only this loader, the ✎
 * button, the mode fields and the page overlay slot (PRC-11's 320 KB gate). The chunk loads on
 * intent (EDN-21), never on idle: at ✎ pointerdown (or tap) and at the first text selection
 * (`selection-host.tsx`). The island shows once it is here. Form filling is a chunk of its own,
 * `./mark/fields`, which loads when a page with form fields comes near the view and does not
 * bring the editing chunk (`loadFields`).
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

let loadingFields: Promise<unknown> | undefined;

/** Fetches the form fields' chunk once, without the editing chunk; a failed fetch is retried. */
export function loadFields(): Promise<unknown> {
  loadingFields ??= import('./mark/fields').catch((error: unknown) => {
    loadingFields = undefined;
    throw error;
  });
  return loadingFields;
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
 * Loads the form fields' chunk when a page of `doc` that has form fields comes near the view
 * (EDN-21): the fields mount in reading (MOB-1), so their layer must be here when the reader
 * reaches them. The probe asks the engine already open, once per document, which pages have
 * fields; "near" is the reader's mounted window of pages, checked after the probe and whenever
 * pages mount. A document without fields never loads it, and it never loads the editing chunk.
 */
export function useLoadFieldsForForms(doc: VirtualDocument): void {
  // The pages' sources, by position: the effect re-runs when these change, not on every edit.
  const refs = doc.pages
    .map((p) => (p.ref.kind === 'source' ? `${p.ref.source}:${p.ref.index}` : '-'))
    .join();
  useEffect(() => {
    const pages = refs.split(',').map((ref) => {
      const cut = ref.lastIndexOf(':');
      return cut < 0
        ? null
        : { source: ref.slice(0, cut) as SourceId, index: Number(ref.slice(cut + 1)) };
    });
    let live = true;
    let stop: () => void = () => undefined;
    void (async () => {
      const engine = getEngineService();
      const editor = await engine.editor();
      const withFields = new Map<SourceId, Set<number>>();
      for (const page of pages) if (page) withFields.set(page.source, new Set());
      for (const [source, indexes] of withFields) {
        await engine.ensureOpen(source);
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
        positions.some(
          (p) => document.querySelector(`[data-read-viewport] [data-page-index="${p}"]`) !== null,
        );
      const check = () => {
        frame = 0;
        if (!live || !near()) return;
        stop();
        void loadFields().catch(() => undefined);
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
    })().catch(() => {
      // A failed probe must not hide the fields: load for the page (EDN-21).
      if (live) void loadFields().catch(() => undefined);
    });
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
 * editing, in drawing order (`order`, lowest first: dry ink 10, annotation layer 20, form fields
 * 30; the same order whichever chunk arrives first). Kept
 * here rather than in the full edition's `stage/page-overlays` registry, which the static
 * compact path does not load. A layer registered with `reading` mounts in reading too, once
 * the chunk is here (the form fields, MOB-1: a tap fills without ✎).
 */
export interface CompactOverlay {
  readonly Layer: ComponentType<PageOverlayProps>;
  readonly reading: boolean;
  readonly order: number;
}

let overlays: readonly CompactOverlay[] = [];
const overlayListeners = new Set<() => void>();

/** Adds a page layer for editing (and reading, with `reading`); returns its removal. */
export function registerCompactOverlay(
  layer: ComponentType<PageOverlayProps>,
  options: { readonly reading?: boolean; readonly order?: number } = {},
): () => void {
  const entry: CompactOverlay = {
    Layer: layer,
    reading: options.reading === true,
    order: options.order ?? 40,
  };
  overlays = [...overlays, entry].sort((a, b) => a.order - b.order);
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
