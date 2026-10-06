/**
 * The canvas zoom's DOM side (05-canvas §4; spec D2-10): wires the gestures of the page view to
 * the zoom controller (`viewer/zoom-controller.ts`) and writes what it decides onto the zoom
 * layer and the detent chip. The page view (today `ReadView`'s column; D2-1 re-hosts it) gives
 * the geometry through `ZoomColumn`: the fits, where a point lands after a commit, the commit
 * itself and the page under a point.
 *
 * - **Gestures** (heard on the viewport): the pointer pinch and Safari's `gesture*` events
 *   (`attachPinch`), the trackpad pinch and the Mod+wheel notch (`attachWheelZoom`), the touch
 *   double tap (`attachTaps`, smart zoom on the paper while no tool is armed). Two touches
 *   `preventDefault` their touch events, so the browser neither pans nor zooms the page under
 *   the app's own pinch (the viewport keeps `touch-action: pan-x pan-y`, M-18).
 * - **The layer.** At rest it carries nothing. When a second finger lands, or a motion starts,
 *   the frame gets `data-zooming` (a clip, so the transformed column never changes the scroll
 *   extent; `will-change: transform` and no pointer on the layer), the chip is shown hidden and
 *   the column extends its rows to cover the viewport at the smallest scale the motion can
 *   reach: the one layout of a gesture, before its first frame. Every frame then writes only
 *   `transform` (zero layouts during a pinch). The commit removes all of it in the frame that
 *   lays out the new zoom.
 * - **Announcement.** After a commit, debounced 500 ms, polite: "Zoom 150 %", or "Fit width" /
 *   "Fit page" at those detents (05-canvas §4 *Content and copy*).
 *
 * A window resize during a motion ends it at the zoom it shows (05-canvas §4 edge cases).
 */
import { type RefObject, useEffect } from 'react';

import { formatPercent, m } from '../i18n';
import { attachPinch, attachTaps, attachWheelZoom } from '../motion/gesture';
import { announce } from '../shell/announcer';
import { useToolStore } from '../viewer/tool-store';
import {
  createZoomController,
  type LayerTransform,
  type Point,
  type ZoomBounds,
  type ZoomRest,
} from '../viewer/zoom-controller';

/** What the page view knows about its column (module header). */
export interface ZoomColumn {
  /** The zoom and its limits now. */
  bounds(): ZoomBounds;
  /** Where column point `p`, wanted at column position `at`, shows after committing `zoom`. */
  landing(zoom: number, p: Point, at: Point): Point;
  /**
   * Commits `rest` with column point `p` at column position `at`; calls `settled` in the frame
   * that lays out the new zoom (or at once when the zoom does not change).
   */
  commit(rest: ZoomRest, p: Point, at: Point, settled: () => void): void;
  /** Renders extra rows so the viewport stays covered down to `minScale`; 1 drops them. */
  extend(minScale: number): void;
  /** Opens the Pages grid at the page under column point `p`. */
  enterGrid(p: Point): void;
}

export interface CanvasZoomElements {
  /** The scroll container (the gestures' target). */
  readonly viewport: RefObject<HTMLElement | null>;
  /** The clip around the layer, which carries `data-zooming`. */
  readonly frame: RefObject<HTMLElement | null>;
  /** The zoom layer: the page column. */
  readonly layer: RefObject<HTMLElement | null>;
  /** The detent chip, positioned in the page view's frame. */
  readonly chip: RefObject<HTMLElement | null>;
}

/** Above the fingers' midpoint by this much (05-canvas §4 *Anatomy*). */
const CHIP_ABOVE_PX = 24;
/** The Android haptic on arming (snap, M-37). */
const HAPTIC_MS = 8;

const transformCss = ({ x, y, scale }: LayerTransform) =>
  `translate(${x}px, ${y}px) scale(${scale})`;

/** Targets a double tap leaves to themselves: controls, fields, links, editors. */
const OWN_TAP = 'input, textarea, select, button, a[href], [contenteditable], [role="textbox"]';

/** Attaches the canvas zoom to the page view; `column` is read at each event. */
export function useCanvasZoom(elements: CanvasZoomElements, column: RefObject<ZoomColumn>): void {
  useEffect(() => {
    const viewport = elements.viewport.current;
    if (!viewport) return;
    const view = viewport.ownerDocument.defaultView ?? window;

    /** Drops the layer's gesture state: transform, clip, chip and the extra rows. */
    const clear = () => {
      const layer = elements.layer.current;
      if (layer) {
        layer.style.removeProperty('transform');
        layer.style.removeProperty('transform-origin');
      }
      elements.frame.current?.removeAttribute('data-zooming');
      const chip = elements.chip.current;
      if (chip) {
        chip.removeAttribute('data-shown');
        chip.hidden = true;
      }
      column.current.extend(1);
    };

    const controller = createZoomController({
      bounds: () => column.current.bounds(),
      toLayer: (client) => {
        const rect = viewport.getBoundingClientRect();
        return {
          x: client.x - rect.left + viewport.scrollLeft,
          y: client.y - rect.top + viewport.scrollTop,
        };
      },
      prepare(minScale) {
        elements.frame.current?.setAttribute('data-zooming', '');
        elements.layer.current?.style.setProperty('transform-origin', '0 0');
        const chip = elements.chip.current;
        if (chip) chip.hidden = false;
        column.current.extend(minScale);
      },
      transform(t) {
        if (!t) {
          clear();
          return;
        }
        elements.layer.current?.style.setProperty('transform', transformCss(t));
      },
      landing: (zoom, p, at) => column.current.landing(zoom, p, at),
      commit(rest, p, at) {
        column.current.commit(rest, p, at, clear);
        announce(
          rest.fit === 'width'
            ? m.zoom_fit_width()
            : rest.fit === 'page'
              ? m.zoom_fit_page()
              : m.zoom_value_label({ percent: formatPercent(rest.zoom) }),
          { key: 'zoom', debounceMs: 500 },
        );
      },
      chip(shown, at, haptic) {
        const chip = elements.chip.current;
        const frame = chip?.offsetParent;
        if (!chip || !frame) return;
        if (!shown) {
          chip.removeAttribute('data-shown');
          return;
        }
        // Placed once as it shows, by transform (no layout), inside the frame.
        const box = frame.getBoundingClientRect();
        const width = chip.offsetWidth;
        const height = chip.offsetHeight;
        const x = Math.min(Math.max(at.x - box.left - width / 2, 8), box.width - width - 8);
        const y = Math.max(at.y - box.top - CHIP_ABOVE_PX - height, 8);
        chip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        chip.setAttribute('data-shown', '');
        if (haptic) navigator.vibrate?.(HAPTIC_MS);
      },
      enterGrid: (p) => column.current.enterGrid(p),
    });

    // Two touches: the app's pinch, not the browser's pan or zoom.
    const guard = (event: TouchEvent) => {
      if (event.touches.length >= 2 && event.cancelable) event.preventDefault();
    };
    // A second finger lands: prepare now, so the pinch's first frame lays nothing out.
    const touches = new Set<number>();
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      touches.add(event.pointerId);
      if (touches.size === 2) controller.ready();
    };
    const onLift = (event: PointerEvent) => {
      if (!touches.delete(event.pointerId)) return;
      // Two fingers that lifted without pinching leave the layer as it was.
      if (touches.size === 0) controller.release();
    };
    const onResize = () => {
      if (controller.busy) controller.stop();
    };

    const detachPinch = attachPinch(viewport, {
      onStart: (origin) => controller.start(origin, touches.size >= 2),
      onChange: (scale, origin) => controller.change(scale, origin),
      onEnd: (scale, velocity, origin) => controller.end(scale, velocity, origin),
    });
    const detachWheel = attachWheelZoom(viewport, {
      onStart: (origin) => controller.start(origin),
      onChange: (scale, origin) => controller.change(scale, origin),
      onEnd: (scale, velocity, origin) => controller.end(scale, velocity, origin),
      onNotch: (direction, origin, t) => controller.notch(direction, origin, t),
    });
    const detachTaps = attachTaps(viewport, {
      types: ['touch'],
      onDoubleTap: (event) => {
        if (useToolStore.getState().mode !== 'select') return;
        if (event.target instanceof Element && event.target.closest(OWN_TAP)) return;
        controller.smartZoom({ x: event.clientX, y: event.clientY });
      },
    });
    const capture = { capture: true, passive: true } as const;
    viewport.addEventListener('touchstart', guard, { passive: false });
    viewport.addEventListener('touchmove', guard, { passive: false });
    viewport.addEventListener('pointerdown', onDown, capture);
    view.addEventListener('pointerup', onLift, capture);
    view.addEventListener('pointercancel', onLift, capture);
    view.addEventListener('resize', onResize);
    return () => {
      detachPinch();
      detachWheel();
      detachTaps();
      viewport.removeEventListener('touchstart', guard);
      viewport.removeEventListener('touchmove', guard);
      viewport.removeEventListener('pointerdown', onDown, capture);
      view.removeEventListener('pointerup', onLift, capture);
      view.removeEventListener('pointercancel', onLift, capture);
      view.removeEventListener('resize', onResize);
      controller.stop(false);
    };
  }, [elements.viewport, elements.frame, elements.layer, elements.chip, column]);
}
