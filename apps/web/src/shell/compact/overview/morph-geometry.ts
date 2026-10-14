/**
 * The overview morph's geometry (MOB-2; `docs/research/phone-2026-10/pinch-overview.md` §3.2),
 * as pure functions. Two layers move, each by one `translate() scale()` with its origin at its
 * top-left, and only by that:
 *
 * - the **grid plane** (every tile) starts scaled up so the anchor page's tile lies exactly on
 *   the page as the reader shows it, and comes to rest untransformed: the grid grows around
 *   the page;
 * - the **reader stage** starts untransformed and ends with the anchor page lying exactly on
 *   its tile, while the reader's other pages fade.
 *
 * Both are interpolated linearly in their translate and scale, so the anchor page's box is the
 * same linear blend of the reader's box and the tile's box on both layers at every progress:
 * the page and its tile stay one through the whole move, whatever easing drives it.
 */
import type { Box } from './overview-layout';

/** `translate(x, y) scale(scale)` about the element's top-left. */
export interface Affine {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export const IDENTITY: Affine = { x: 0, y: 0, scale: 1 };

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function affineCss(t: Affine): string {
  return `translate(${t.x}px, ${t.y}px) scale(${t.scale})`;
}

export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

export function lerpAffine(a: Affine, b: Affine, p: number): Affine {
  return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), scale: lerp(a.scale, b.scale, p) };
}

export function lerpBox(a: Box, b: Box, p: number): Box {
  return {
    left: lerp(a.left, b.left, p),
    top: lerp(a.top, b.top, p),
    width: lerp(a.width, b.width, p),
    height: lerp(a.height, b.height, p),
  };
}

/**
 * Where a layer whose top-left shows at viewport point `origin` draws `local` (a box in its
 * own coordinates) under transform `t`, in viewport coordinates.
 */
export function project(t: Affine, origin: Point, local: Box): Box {
  return {
    left: origin.x + t.x + t.scale * local.left,
    top: origin.y + t.y + t.scale * local.top,
    width: t.scale * local.width,
    height: t.scale * local.height,
  };
}

/**
 * The transform that draws `local` (a box in a layer's own coordinates, the layer's top-left
 * at viewport point `origin`) exactly over `target` (viewport). Pages and their tiles share an
 * aspect, so one scale fits both sides; it is taken from the widths.
 */
export function fitOnto(local: Box, origin: Point, target: Box): Affine {
  const scale = target.width / Math.max(1e-6, local.width);
  return {
    x: target.left - origin.x - scale * local.left,
    y: target.top - origin.y - scale * local.top,
    scale,
  };
}

/** One sampled keyframe value: a function of the morph's progress p. */
export type Track<T> = (p: number) => T;

/** An opacity that rises from 0 at `from` to 1 at `to` of the progress. */
export function rise(from: number, to: number): Track<number> {
  return (p) => Math.min(1, Math.max(0, (p - from) / Math.max(1e-6, to - from)));
}

/** An opacity that falls from 1 at `from` to 0 at `to` of the progress. */
export function fall(from: number, to: number): Track<number> {
  const up = rise(from, to);
  return (p) => 1 - up(p);
}

/**
 * Keyframe offsets and values for a move of progress `from` → `to` along `track`: two
 * keyframes for a linear track (a transform), `steps + 1` samples for a bent one (a fade that
 * waits), so the effect's easing maps time to progress and the keyframes map progress to value.
 */
export function sample<T>(
  track: Track<T>,
  from: number,
  to: number,
  steps: number,
): { readonly offset: number; readonly value: T }[] {
  const n = Math.max(1, Math.round(steps));
  return Array.from({ length: n + 1 }, (_, i) => ({
    offset: i / n,
    value: track(lerp(from, to, i / n)),
  }));
}
