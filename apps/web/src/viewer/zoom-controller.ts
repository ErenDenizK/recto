/**
 * The zoom controller (05-canvas §4; spec D2-10; language.md §7.3 *pinch, smart zoom*, *zoom
 * step*; research 18 §9; MP-8, MO-7, MC-23, MC-24): zoom moves pixels, not layout.
 *
 * A pinch, a trackpad pinch, a Mod+wheel notch or a touch double tap scales one zoom layer by
 * `transform: translate(x, y) scale(s)` about an anchor, and the zoom and the page layout are
 * committed once, at rest (`ui-store`'s zoom, through the host). In between nothing lays out:
 * the layer is a transform on the compositor.
 *
 * - **Gesture.** 1:1 about the fingers' midpoint, which also pans. Past the hard limits (25 %,
 *   500 %) the zoom rubber-bands in log space with L = 0.25 (at most 19 % past). Below fit page
 *   the same rubber band holds a soft limit at fit page (or at the zoom the gesture started
 *   from, if that is lower); a pinch more than 15 % below it arms the Pages grid, shown by the
 *   detent chip "Release to see all pages" (05.11).
 * - **Release.** Armed: the Pages grid opens at the page under the fingers (*view change*).
 *   Otherwise the velocity of log2(zoom) is projected with r 0.99, clamped to the limits and
 *   snapped to fit width, fit page or 100 % within 6 %; the layer settles there on
 *   `--spring-fling` with the release velocity, and commits once.
 * - **Notch.** One ×1.26 step on `--spring-quick` about the pointer; further notches retarget
 *   from where the motion is. Zooming out stops at fit page; there, a notch after a 300 ms pause
 *   opens the Pages grid.
 * - **Double tap** (touch): fit width ⇄ 250 % about the tap, on `--spring-glide`.
 * - **Interruption.** A gesture that starts while a settle runs grabs the layer where it is.
 *
 * Coordinates are *layer* coordinates: CSS px in the zoom layer at rest, which is the page
 * column (the scroll content) at the committed zoom. A point `p` of the layer shows at layer
 * position `t + s · p` while the layer carries the transform `t`, `s`; the scroll position does
 * not change during a gesture, so a client point converts to layer coordinates by one offset.
 *
 * The pure maths (rubber band, the grid threshold, projection and detents, the anchor) is
 * exported for tests; `createZoomController()` drives a host that owns the DOM (the Read view).
 * Under reduced motion (§7.5) tracking stays 1:1, there is no rubber band and no momentum, and
 * the settle is instant.
 */
import { animate, type Motion } from '../motion/animate';
import { project, rubberBand } from '../motion/velocity';

/** A point in client or layer CSS px. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The zoom layer's transform: layer point `p` shows at `(x, y) + scale · p`. */
export interface LayerTransform {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** What the controller needs to know about the zoom, read at the start of each motion. */
export interface ZoomBounds {
  /** The committed zoom (1 = 100 %). */
  readonly zoom: number;
  /** The hard limits (`MIN_ZOOM`, `MAX_ZOOM`). */
  readonly min: number;
  readonly max: number;
  /** The zooms that fit the widest row's width, and the tallest page, in the free rectangle. */
  readonly fitWidth: number;
  readonly fitPage: number;
}

/** A zoom to rest at; `fit` names the detent it snapped to, so the fit follows resizes. */
export interface ZoomRest {
  readonly zoom: number;
  readonly fit: 'width' | 'page' | null;
}

/** The rubber band's limit past a zoom limit, in log2 units: 2^0.25 is 19 % (05-canvas §4). */
export const RUBBER_BAND_LOG2 = 0.25;
/** A pinch released this far below the soft limit opens the Pages grid (flows.md §7.1). */
export const GRID_THRESHOLD = 0.15;
/** A rest within this ratio of a detent snaps to it. */
export const DETENT_REACH = 0.06;
/** Per-millisecond deceleration of a released zoom (research 18 §9: 0.99 for zoom). */
export const ZOOM_DECELERATION = 0.99;
/** One Mod+wheel notch (05-canvas §4). */
export const NOTCH_FACTOR = 1.26;
/** At fit page, a notch out after this long without notches opens the grid. */
export const NOTCH_GRID_PAUSE_MS = 300;
/** The double tap's zoomed-in end (M-19). */
export const SMART_ZOOM = 2.5;

const IDENTITY: LayerTransform = { x: 0, y: 0, scale: 1 };

/** The soft lower limit of a gesture that starts at `from`: fit page, or `from` if lower. */
export function softFloor(bounds: ZoomBounds, from: number): number {
  return Math.min(bounds.max, Math.max(bounds.min, Math.min(bounds.fitPage, from)));
}

/**
 * The zoom shown for a finger zoom of `raw`: 1:1 between `floor` and `max`, rubber-banded in
 * log2 space past either (at most `RUBBER_BAND_LOG2` past; none under reduced motion).
 */
export function bandedZoom(raw: number, floor: number, max: number): number {
  const at = Math.log2(Math.max(raw, 1e-6));
  const lo = Math.log2(floor);
  const hi = Math.log2(max);
  if (at < lo) return 2 ** (lo + rubberBand(at - lo, RUBBER_BAND_LOG2));
  if (at > hi) return 2 ** (hi + rubberBand(at - hi, RUBBER_BAND_LOG2));
  return raw;
}

/** Whether a finger zoom of `raw` is far enough below `floor` to open the Pages grid. */
export function gridArmed(raw: number, floor: number): boolean {
  return raw < floor * (1 - GRID_THRESHOLD);
}

/** The detent `zoom` snaps to within `DETENT_REACH`, nearest first; null when none is near. */
export function detentOf(zoom: number, bounds: ZoomBounds): ZoomRest | null {
  const detents: ZoomRest[] = [
    { zoom: bounds.fitWidth, fit: 'width' },
    { zoom: bounds.fitPage, fit: 'page' },
    { zoom: 1, fit: null },
  ];
  let best: ZoomRest | null = null;
  let distance = Math.log(1 + DETENT_REACH) + 1e-9;
  for (const detent of detents) {
    if (detent.zoom < bounds.min - 1e-9 || detent.zoom > bounds.max + 1e-9) continue;
    const off = Math.abs(Math.log(zoom / detent.zoom));
    if (off <= distance) {
      best = detent;
      distance = off;
    }
  }
  return best;
}

/**
 * Where a release at finger zoom `raw` with log2-velocity `velocity` (per second) comes to
 * rest: projected with r 0.99, clamped to `floor` and the maximum, snapped to a detent.
 * Returns null when the release opens the Pages grid.
 */
export function releaseRest(
  raw: number,
  velocity: number,
  bounds: ZoomBounds,
  floor: number,
): ZoomRest | null {
  if (gridArmed(raw, floor)) return null;
  const projected = 2 ** (Math.log2(raw) + project(velocity, ZOOM_DECELERATION));
  const zoom = Math.min(bounds.max, Math.max(floor, projected));
  return detentOf(zoom, bounds) ?? { zoom, fit: null };
}

/** The transform that shows layer point `p` at layer position `at` with scale `scale`. */
export function transformAbout(p: Point, at: Point, scale: number): LayerTransform {
  return { x: at.x - scale * p.x, y: at.y - scale * p.y, scale };
}

/** The layer point shown at layer position `at` under transform `t`. */
export function pointUnder(at: Point, t: LayerTransform): Point {
  return { x: (at.x - t.x) / t.scale, y: (at.y - t.y) / t.scale };
}

/** The double tap's target from `zoom` (M-19): fit width ⇄ 250 %. */
export function smartZoomRest(zoom: number, bounds: ZoomBounds): ZoomRest {
  const atFitWidth = Math.abs(Math.log(zoom / bounds.fitWidth)) <= Math.log(1 + DETENT_REACH);
  return atFitWidth || zoom < bounds.fitWidth
    ? { zoom: Math.min(bounds.max, Math.max(SMART_ZOOM, bounds.fitWidth * 1.5)), fit: null }
    : { zoom: bounds.fitWidth, fit: 'width' };
}

/** The DOM side of the controller: the Read view (or what replaces it). */
export interface ZoomHost {
  /** The zoom and its limits now. */
  bounds(): ZoomBounds;
  /** A client point in layer coordinates. */
  toLayer(client: Point): Point;
  /**
   * A motion is about to start from rest: make the layer ready (`will-change`, a clip, rows
   * that cover the viewport down to `minScale`). The one layout of a gesture happens here,
   * before its first frame.
   */
  prepare(minScale: number): void;
  /** Writes the layer's transform; null removes it. Called every frame of a motion. */
  transform(t: LayerTransform | null): void;
  /**
   * Where layer point `p`, wanted at layer position `at`, will actually show once `zoom` is
   * committed (scroll positions clamp at the column's edges), in today's layer coordinates.
   */
  landing(zoom: number, p: Point, at: Point): Point;
  /**
   * Commits `rest` with layer point `p` at layer position `at`, and removes the transform in
   * the same frame (05-canvas §4 *Commit*).
   */
  commit(rest: ZoomRest, p: Point, at: Point): void;
  /** Shows or hides the detent chip near client point `at`; `haptic` once as it shows. */
  chip(shown: boolean, at: Point, haptic: boolean): void;
  /**
   * Opens the Pages grid at the page under layer point `p`. The layer keeps its transform
   * (the transition's old picture); the view that replaces the page view drops it.
   */
  enterGrid(p: Point): void;
}

export interface ZoomController {
  /**
   * Two fingers are down and may pinch: prepare the layer now, so the pinch's first frame lays
   * nothing out. `release()` undoes it if they lift without pinching.
   */
  ready(): void;
  /** Every finger lifted: a prepared layer that never moved goes back to rest. */
  release(): void;
  /** A pinch began about client point `origin`; `touch` when fingers (for the haptic). */
  start(origin: Point, touch?: boolean): void;
  /** Scale since the start and the current focal point (client). */
  change(scale: number, origin: Point): void;
  /** The pinch ended: last scale, velocity of log2(scale) per second, focal point (client). */
  end(scale: number, velocity: number, origin: Point): void;
  /** One Mod+wheel notch about client point `origin` at time `t` (ms). */
  notch(direction: 1 | -1, origin: Point, t: number): void;
  /** The touch double tap about client point `origin`. */
  smartZoom(origin: Point): void;
  /**
   * Ends whatever runs and commits the zoom it shows (a resize during a gesture ends it at the
   * current scale, 05-canvas §4 *edge cases*); with `commit` false, just forgets it (unmount).
   */
  stop(commit?: boolean): void;
  /** Whether the layer is away from rest (a gesture or a settle). */
  readonly busy: boolean;
}

interface Pinching {
  /** The layer point under the fingers. */
  readonly p: Point;
  /** The finger zoom when the pinch began (the committed zoom times the grabbed scale). */
  readonly from: number;
  readonly floor: number;
  readonly touch: boolean;
  raw: number;
  armed: boolean;
}

interface Settling {
  readonly motion: Motion<readonly number[]>;
  readonly rest: ZoomRest;
  readonly p: Point;
}

/** The controller over `host` (module header). */
export function createZoomController(host: ZoomHost): ZoomController {
  /** The committed zoom the layer's transform is relative to; null at rest. */
  let base: number | null = null;
  let t: LayerTransform = IDENTITY;
  let pinching: Pinching | null = null;
  let settling: Settling | null = null;
  let lastNotch = Number.NEGATIVE_INFINITY;

  const write = (next: LayerTransform) => {
    t = next;
    host.transform(next);
  };

  /** Makes the layer ready if it is at rest; returns the committed zoom. */
  const begin = (bounds: ZoomBounds, floor: number): number => {
    if (base !== null) return base;
    base = bounds.zoom;
    t = IDENTITY;
    // The lowest scale the motion can show: the floor, rubber-banded at most 19 % below.
    host.prepare((Math.min(floor, bounds.zoom) * 2 ** -RUBBER_BAND_LOG2) / bounds.zoom);
    return base;
  };

  /** Stops a running settle where it is; returns the scale velocity it had (per second). */
  const halt = (): number => {
    const run = settling;
    if (!run) return 0;
    settling = null;
    const { velocity } = run.motion.stop();
    return velocity[0] ?? 0;
  };

  const reset = () => {
    base = null;
    t = IDENTITY;
    pinching = null;
  };

  /** Settles to `rest` keeping layer point `p` on its way to where it will land. */
  const settle = (
    rest: ZoomRest,
    p: Point,
    at: Point,
    spring: 'fling' | 'quick' | 'glide',
    scaleVelocity: number,
  ) => {
    const from = base ?? rest.zoom;
    const landing = host.landing(rest.zoom, p, at);
    const shown = { x: t.x + t.scale * p.x, y: t.y + t.scale * p.y };
    let done = false;
    const motion = animate([t.scale, shown.x, shown.y], [rest.zoom / from, landing.x, landing.y], {
      spring,
      velocity: [scaleVelocity, 0, 0],
      onUpdate: ([scale = 1, x = 0, y = 0]) => write(transformAbout(p, { x, y }, scale)),
      onComplete: () => {
        done = true;
        settling = null;
        reset();
        host.commit(rest, p, landing);
      },
    });
    if (!done) settling = { motion, rest, p };
  };

  return {
    get busy() {
      return base !== null;
    },
    ready() {
      if (base !== null) return;
      const bounds = host.bounds();
      begin(bounds, softFloor(bounds, bounds.zoom));
    },
    release() {
      if (base === null || pinching || settling) return;
      reset();
      host.transform(null);
    },
    start(origin, touch = false) {
      const bounds = host.bounds();
      // A settle in flight is grabbed where it is (05-canvas §4 *Motion*).
      halt();
      const from = base === null ? bounds.zoom : base * t.scale;
      const floor = softFloor(bounds, from);
      const zoom = begin(bounds, floor);
      pinching = {
        p: pointUnder(host.toLayer(origin), t),
        from: zoom * t.scale,
        floor,
        touch,
        raw: zoom * t.scale,
        armed: false,
      };
    },
    change(scale, origin) {
      const g = pinching;
      if (!g || base === null) return;
      const bounds = host.bounds();
      g.raw = g.from * scale;
      const shown = bandedZoom(g.raw, g.floor, bounds.max);
      write(transformAbout(g.p, host.toLayer(origin), shown / base));
      const armed = gridArmed(g.raw, g.floor);
      if (armed !== g.armed) {
        g.armed = armed;
        host.chip(armed, origin, g.touch);
      }
    },
    end(scale, velocity, origin) {
      const g = pinching;
      if (!g || base === null) return;
      pinching = null;
      g.raw = g.from * scale;
      if (g.armed) host.chip(false, origin, false);
      const rest = releaseRest(g.raw, velocity, host.bounds(), g.floor);
      if (!rest) {
        reset();
        host.enterGrid(g.p);
        return;
      }
      settle(rest, g.p, host.toLayer(origin), 'fling', t.scale * Math.LN2 * velocity);
    },
    notch(direction, origin, now) {
      if (pinching) return;
      const bounds = host.bounds();
      const target = settling ? settling.rest.zoom : bounds.zoom;
      const floor = softFloor(bounds, target);
      const pause = now - lastNotch;
      lastNotch = now;
      const at = host.toLayer(origin);
      if (direction < 0 && target <= floor * (1 + 1e-3)) {
        if (pause < NOTCH_GRID_PAUSE_MS) return;
        halt();
        const p = pointUnder(at, t);
        reset();
        host.enterGrid(p);
        return;
      }
      const stepped = Math.min(bounds.max, Math.max(floor, target * NOTCH_FACTOR ** direction));
      const rest = detentOf(stepped, bounds) ?? { zoom: stepped, fit: null };
      const velocity = halt();
      begin(bounds, floor);
      settle(rest, pointUnder(at, t), at, 'quick', velocity);
    },
    smartZoom(origin) {
      if (pinching) return;
      const bounds = host.bounds();
      const shown = (base ?? bounds.zoom) * t.scale;
      const rest = smartZoomRest(settling ? settling.rest.zoom : shown, bounds);
      const velocity = halt();
      begin(bounds, softFloor(bounds, Math.min(shown, rest.zoom)));
      const at = host.toLayer(origin);
      settle(rest, pointUnder(at, t), at, 'glide', velocity);
    },
    stop(commit = true) {
      const run = settling;
      halt();
      const g = pinching;
      if (g?.armed) host.chip(false, { x: 0, y: 0 }, false);
      if (base === null) return;
      const p = run?.p ?? g?.p;
      const zoom = base * t.scale;
      const shown = p ? { x: t.x + t.scale * p.x, y: t.y + t.scale * p.y } : null;
      reset();
      if (!commit || !p || !shown) {
        host.transform(null);
        return;
      }
      host.commit({ zoom, fit: null }, p, shown);
    },
  };
}
