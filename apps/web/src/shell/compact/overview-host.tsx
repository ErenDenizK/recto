/**
 * The door to the page overview's lazy chunk (MOB-2; `docs/research/phone-2026-10/
 * pinch-overview.md` §3.5): the grid, its tiles, the morph and its own pinch live in
 * `./overview/` and load by `import()`, so the static compact path gains only this loader, the
 * pure gesture maths (`overview-gesture.ts`) and the reader's port. The chunk is fetched when
 * the browser is idle after the reader opens (as the editing chunk, `mark-host.ts`), and at the
 * latest when Pages is tapped or a pinch arms; a pinch before it has arrived rubber-bands as
 * before and its armed release opens the overview by the button's morph once it is here.
 *
 * The reader registers its port (`OverviewReader`): the elements the morph moves and the
 * geometry it reads, so the chunk never reaches into the reader's internals.
 */
import type { VirtualDocument } from '@pdf-editor/document-model';
import { useEffect, useSyncExternalStore } from 'react';

import type * as OverviewModule from './overview';

export type Overview = typeof OverviewModule;

let loading: Promise<Overview> | undefined;
let loaded: Overview | null = null;
const listeners = new Set<() => void>();

/** Fetches the chunk once; a failed fetch (offline before the precache filled) is retried. */
export function loadOverview(): Promise<Overview> {
  loading ??= import('./overview').then(
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

/** The chunk if it has loaded, else null (for the reader's gesture, which cannot wait). */
export function overviewModule(): Overview | null {
  return loaded;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => loaded;

/** How long the idle prefetch may wait for an idle moment, ms (as the editing chunk's). */
const PREFETCH_TIMEOUT_MS = 4000;

/**
 * The overview's slot in the reader: nothing until the chunk is here (prefetched when idle),
 * then the overview, which renders nothing but its pinch chip while closed.
 */
export function OverviewSlot({ doc }: { readonly doc: VirtualDocument }) {
  const module = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    if (loaded) return;
    const load = () => void loadOverview().catch(() => undefined);
    const idle = typeof window.requestIdleCallback === 'function';
    const handle = idle
      ? window.requestIdleCallback(load, { timeout: PREFETCH_TIMEOUT_MS })
      : window.setTimeout(load, PREFETCH_TIMEOUT_MS);
    return () => {
      if (idle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
  return module ? <module.CompactOverview doc={doc} /> : null;
}

/** A box in viewport CSS px. */
export interface ViewportBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** What the reader lends the morph (`CompactReader.tsx`). */
export interface OverviewReader {
  /** The page stage (the layer a pinch transforms) and its scroller. */
  readonly stage: HTMLElement;
  readonly scroller: HTMLElement;
  /** Ends a running zoom settle, so the stage rests untransformed. */
  settle(): void;
  /** Page `index`'s box at rest in the stage's own coordinates (null without one). */
  pageBox(index: number): ViewportBox | null;
  /** Scrolls the reader so page `index` shows under the top bar (a jump). */
  reveal(index: number): void;
}

let reader: OverviewReader | null = null;

/** Lends the reader to the morph; returns the withdrawal. */
export function registerOverviewReader(port: OverviewReader): () => void {
  reader = port;
  return () => {
    if (reader === port) reader = null;
  };
}

/** The reader the morph moves, while one shows. */
export function overviewReader(): OverviewReader | null {
  return reader;
}

/**
 * Pages (the capsule's first button, MOB-2): opens the overview with the same morph as the
 * pinch, played by itself, loading the chunk first if it has not arrived.
 */
export function openOverview(): void {
  void loadOverview()
    .then((module) => module.openOverview())
    .catch(() => undefined);
}
