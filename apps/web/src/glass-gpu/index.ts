/**
 * GPU glass, the part in the compact chunk (decisions GLS-7, GLS-12…GLS-15): the registration
 * API and the host that loads the renderer. Everything that draws is in `renderer.ts`, its own
 * chunk, fetched once the reader is idle and only on a device that passes (`gpuGlassEligible`).
 *
 * - **Pieces** opt in by the attribute `data-gpu-glass="capsule" | "circle" | "rect" | "edge"`
 *   inside the host's root (a one-attribute hook in the chrome's markup), or from script with
 *   `registerGpuGlass(el, { shape, radius, tone })`, which returns its unregister. A piece keeps
 *   its content and its hit area; under GPU glass the renderer gives it the class `gpu-glass`,
 *   which drops its own CSS backdrop and fill, and draws the material underneath on one shared
 *   canvas. Everywhere else the piece is CSS+ as it ships.
 * - **Paused** (`useGpuGlassHost(root, active, paused)`): moments whose layers the GPU cannot
 *   see (the phone's editing layers, Find's highlights) hand the pieces back to CSS until they
 *   end (GLS-14).
 * - **Fallback** (GLS-13): any failure (context lost, a shader that does not compile, a texture
 *   too large, slow frames) ends GPU glass for the session; the pieces stay CSS+.
 */
import { type RefObject, useEffect, useRef } from 'react';

import { useGlassTier } from '../state/render-quality';

export type GpuGlassShape = 'capsule' | 'circle' | 'rect' | 'edge';

export interface GpuGlassOptions {
  readonly shape: GpuGlassShape;
  /** A `rect`'s corner radius, CSS px; default: the element's own border radius. */
  readonly radius?: number;
  /**
   * The legibility floor's contrast (GLS-14): `text` 4.5:1 for labels (the default), `icon`
   * 3:1 for a glyph-only control.
   */
  readonly tone?: 'text' | 'icon';
}

/** The attribute a piece in the host's root opts in with; its value is the shape. */
export const GPU_GLASS_ATTRIBUTE = 'data-gpu-glass';

const registered = new Map<HTMLElement, GpuGlassOptions>();
const listeners = new Set<() => void>();

/** Opts `el` in; returns its unregister. */
export function registerGpuGlass(el: HTMLElement, options: GpuGlassOptions): () => void {
  registered.set(el, options);
  for (const listener of listeners) listener();
  return () => {
    if (registered.get(el) !== options) return;
    registered.delete(el);
    for (const listener of listeners) listener();
  };
}

/** The pieces registered from script (the renderer adds the attribute's own). */
export function registeredPieces(): ReadonlyMap<HTMLElement, GpuGlassOptions> {
  return registered;
}

/** Follows registrations; returns the unsubscribe. */
export function onRegistered(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Set once GPU glass failed: the session stays on CSS+ (GLS-13). */
let failed = false;

export function gpuGlassFailed(): boolean {
  return failed;
}

export function markGpuGlassFailed(): void {
  failed = true;
}

/** What the host holds of a started renderer. */
export interface GpuGlassHandle {
  setPaused(paused: boolean): void;
  stop(): void;
}

/** How long the renderer's idle fetch may wait for an idle moment, ms. */
const LOAD_TIMEOUT_MS = 3000;

/**
 * Hosts GPU glass over `root` (the reader): on the GPU tier, once the browser is idle, fetches
 * the renderer and starts it; leaving the tier, or unmounting, stops it and gives the pieces
 * their CSS back.
 */
export function useGpuGlassHost(
  root: RefObject<HTMLElement | null>,
  active: boolean,
  paused: boolean,
): void {
  const tier = useGlassTier();
  const handle = useRef<GpuGlassHandle | null>(null);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
    handle.current?.setPaused(paused);
  }, [paused]);
  useEffect(() => {
    const el = root.current;
    if (tier !== 'gpu' || failed || !active || !el) return;
    let cancelled = false;
    const start = () => {
      import('./renderer')
        .then((module) => {
          if (cancelled || failed) return;
          handle.current = module.startGpuGlass(el, pausedRef.current);
        })
        .catch(() => undefined);
    };
    const idle = typeof window.requestIdleCallback === 'function';
    const wait = idle
      ? window.requestIdleCallback(start, { timeout: LOAD_TIMEOUT_MS })
      : window.setTimeout(start, LOAD_TIMEOUT_MS);
    return () => {
      cancelled = true;
      if (idle) window.cancelIdleCallback(wait);
      else window.clearTimeout(wait);
      handle.current?.stop();
      handle.current = null;
    };
  }, [root, tier, active]);
}
