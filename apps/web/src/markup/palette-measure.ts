/**
 * What the palette's fold reads (`03-markup` MK-2 §2): the measured width of every item and
 * the room in the band, kept by the palette's measurer (`PaletteMeasurer`), which the dock
 * mounts whenever a document shows on its page.
 *
 * Measured ahead, so the palette folds right on the frame it arrives: the capsule measures
 * its content when the morph starts (`shell/capsule/Capsule.tsx`), and a palette that laid
 * itself out at full width first and folded a frame later would morph to the wrong size.
 */
import { useSyncExternalStore } from 'react';

import type { FoldMetrics } from './palette-fold';

/** One measuring of the full row, labels shown. */
export interface Measured {
  /** What it was measured for: language, density, the items and the frame's width class. */
  readonly key: string;
  readonly widths: Readonly<Record<string, number>>;
  readonly metrics: FoldMetrics;
  /** A bare labelled item: the round button's width. */
  readonly button: number;
}

export interface PaletteLayout {
  readonly measured: Measured | null;
  /** The band's width less the palette's margins (CSS px). */
  readonly available: number;
}

let layout: PaletteLayout = { measured: null, available: Number.POSITIVE_INFINITY };
const listeners = new Set<() => void>();

function publish(next: PaletteLayout): void {
  layout = next;
  for (const listener of listeners) listener();
}

function same(a: Measured | null, b: Measured): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b);
}

/** Stores a measuring when it differs from the last one. */
export function setMeasured(measured: Measured): void {
  if (!same(layout.measured, measured)) publish({ ...layout, measured });
}

/** Stores the room when it changed by half a pixel or more. */
export function setAvailable(available: number): void {
  if (Math.abs(layout.available - available) >= 0.5) publish({ ...layout, available });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePaletteLayout(): PaletteLayout {
  return useSyncExternalStore(
    subscribe,
    () => layout,
    () => layout,
  );
}

/** Tests: nothing measured. */
export function resetPaletteLayout(): void {
  publish({ measured: null, available: Number.POSITIVE_INFINITY });
}
