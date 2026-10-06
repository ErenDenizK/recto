/**
 * Wheel zoom: the trackpad pinch and the Mod+wheel notch (05-canvas §4 *Behaviour*; research 19
 * M-16; spec X5, D2-10). The browser reports both as `wheel` events: a trackpad pinch arrives as
 * a stream of small, fractional `deltaY`s with `ctrlKey` set (Chromium and Firefox synthesise
 * it; Safari sends its `gesture*` events instead, which `attachPinch` hears), a mouse wheel
 * with Mod held as whole notches. This module tells them apart and drives the same callbacks
 * as the pointer pinch, so the zoom controller has one gesture to follow.
 *
 * - **Trackpad.** 1:1: the scale is `exp(−deltaY / 100)` per event (the mapping Chromium uses
 *   to synthesise the wheel from the trackpad's own scale, which Firefox copies), accumulated
 *   from the first event. The gesture ends `WHEEL_ZOOM.endMs` after the last event, with the
 *   velocity of log2(scale) at that event from `velocityTracker()`.
 * - **Notch.** A wheel in lines or pages, or a whole pixel delta of at least
 *   `WHEEL_ZOOM.notchPx` (Windows and Linux mice send 100 or 120 per detent), is one step in
 *   or out; the consumer animates it (*zoom step*) and applies the pause rule into the grid.
 *   Within a trackpad gesture every event stays trackpad, so a fast pinch is never a notch.
 *
 * Every zoom wheel is `preventDefault`ed: the browser would otherwise zoom the whole page.
 * Recognition never reads reduced motion (language.md §7.5).
 */
import { velocityTracker } from '../velocity';
import type { Point } from './pinch';

export const WHEEL_ZOOM = {
  /** A trackpad pinch ends this long after its last event (05-canvas §4). */
  endMs: 150,
  /** A whole pixel delta at least this large is a mouse notch, not a trackpad. */
  notchPx: 50,
  /** `deltaY` per factor e of scale in a trackpad pinch (Chromium's synthesis). */
  pxPerE: 100,
} as const;

/** The fields of a `WheelEvent` the recogniser reads; a real event satisfies it. */
export interface WheelLike {
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

export interface WheelZoomOptions {
  /** A trackpad pinch began about `origin` (client px). */
  onStart?(origin: Point): void;
  /** Scale since the start (1 = unchanged) and the pointer. */
  onChange?(scale: number, origin: Point): void;
  /** The pinch ended: the last scale, the velocity of log2(scale) per second, the pointer. */
  onEnd?(scale: number, velocity: number, origin: Point): void;
  /** One notch: +1 zooms in, −1 out, about `origin`, at `t` (the event's `timeStamp`). */
  onNotch?(direction: 1 | -1, origin: Point, t: number): void;
}

/** Whether a zoom wheel is a mouse notch or part of a trackpad pinch (module header). */
export function wheelZoomKind(e: Pick<WheelLike, 'deltaY' | 'deltaMode'>): 'notch' | 'trackpad' {
  if (e.deltaMode !== 0) return 'notch';
  return Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= WHEEL_ZOOM.notchPx
    ? 'notch'
    : 'trackpad';
}

export interface WheelZoom {
  /** Feeds one wheel event; returns whether it was a zoom wheel (Mod or a trackpad pinch). */
  wheel(e: WheelLike): boolean;
  /** Whether a trackpad pinch is under way. */
  readonly active: boolean;
  /** Ends a trackpad pinch at once, with no momentum; clears the timer. */
  dispose(): void;
}

/** The recogniser on wheel events (module header). */
export function wheelZoom(options: WheelZoomOptions): WheelZoom {
  let active = false;
  let scale = 1;
  let origin: Point = { x: 0, y: 0 };
  let lastT = 0;
  let tracker = velocityTracker();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const end = (momentum: boolean) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!active) return;
    active = false;
    options.onEnd?.(scale, momentum ? tracker.velocity(lastT).x : 0, origin);
  };

  return {
    get active() {
      return active;
    },
    wheel(e) {
      if (!e.ctrlKey && !e.metaKey) return false;
      origin = { x: e.clientX, y: e.clientY };
      if (!active && wheelZoomKind(e) === 'notch') {
        if (e.deltaY !== 0) options.onNotch?.(e.deltaY < 0 ? 1 : -1, origin, e.timeStamp);
        return true;
      }
      if (!active) {
        active = true;
        scale = 1;
        tracker = velocityTracker();
        tracker.add(e.timeStamp, 0, 0);
        options.onStart?.(origin);
      }
      scale *= Math.exp(-e.deltaY / WHEEL_ZOOM.pxPerE);
      lastT = e.timeStamp;
      tracker.add(e.timeStamp, Math.log2(scale), 0);
      options.onChange?.(scale, origin);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => end(true), WHEEL_ZOOM.endMs);
      return true;
    },
    dispose() {
      end(false);
    },
  };
}

/**
 * Wheel zoom on `target`: a non-passive `wheel` listener that `preventDefault`s every zoom
 * wheel (Mod or a trackpad pinch) and feeds the recogniser; returns the removal.
 */
export function attachWheelZoom(target: EventTarget, options: WheelZoomOptions): () => void {
  const recogniser = wheelZoom(options);
  const onWheel = (event: Event) => {
    if (recogniser.wheel(event as WheelEvent)) event.preventDefault();
  };
  target.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    target.removeEventListener('wheel', onWheel);
    recogniser.dispose();
  };
}
