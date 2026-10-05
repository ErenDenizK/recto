/**
 * DOM wiring for the gesture core (09-primitives §31; 04-context §2.3; spec X5): one arena per
 * element (or the document), fed by Pointer Events, and the attach functions behind the hooks.
 *
 * Presses are heard on the element in the capture phase, so no layer below can hide a second
 * finger from the arbitration (the pen layer stops the palms it ignores); moves and releases on
 * the window, so a pointer that leaves the element still ends its gesture. Every listener is
 * passive except the long press's echo guards: a recogniser never `preventDefault`s a scroll it
 * did not claim, and the element's `touch-action` decides what the browser keeps (see pinch.ts).
 */
import { type Arena, createArena, type PointerPhase, type Recogniser } from './arena';
import { GESTURE } from './constants';
import { type LongPressOptions, longPress } from './long-press';
import { type MultiFingerTapOptions, multiFingerTap } from './multi-finger-tap';
import { type PinchOptions, pinch } from './pinch';
import { type TapOptions, taps } from './taps';

/** Where gestures are heard: an element, or the whole document. */
export type GestureTarget = Element | Document;

interface Wiring {
  readonly arena: Arena<PointerEvent>;
  readonly detach: () => void;
}

const wirings = new WeakMap<GestureTarget, Wiring>();

function windowOf(target: GestureTarget): Window {
  const doc = target instanceof Document ? target : target.ownerDocument;
  return doc.defaultView ?? window;
}

const PASSIVE_CAPTURE = { capture: true, passive: true } as const;

/** The arena of `target`, wired on first use and unwired when its last recogniser leaves. */
function arenaOf(target: GestureTarget): Wiring {
  const known = wirings.get(target);
  if (known) return known;
  const arena = createArena<PointerEvent>();
  const view = windowOf(target);
  const feed = (phase: PointerPhase) => (event: Event) =>
    arena.dispatch(phase, event as PointerEvent);
  const onDown = feed('down');
  const onMove = feed('move');
  const onUp = feed('up');
  const onCancel = feed('cancel');
  const onBlur = () => arena.reset();
  target.addEventListener('pointerdown', onDown, PASSIVE_CAPTURE);
  view.addEventListener('pointermove', onMove, PASSIVE_CAPTURE);
  view.addEventListener('pointerup', onUp, PASSIVE_CAPTURE);
  view.addEventListener('pointercancel', onCancel, PASSIVE_CAPTURE);
  view.addEventListener('blur', onBlur);
  const wiring: Wiring = {
    arena,
    detach: () => {
      target.removeEventListener('pointerdown', onDown, PASSIVE_CAPTURE);
      view.removeEventListener('pointermove', onMove, PASSIVE_CAPTURE);
      view.removeEventListener('pointerup', onUp, PASSIVE_CAPTURE);
      view.removeEventListener('pointercancel', onCancel, PASSIVE_CAPTURE);
      view.removeEventListener('blur', onBlur);
      wirings.delete(target);
    },
  };
  wirings.set(target, wiring);
  return wiring;
}

/** Adds `recogniser` to `target`'s arena; returns its removal. */
export function attachRecogniser(
  target: GestureTarget,
  recogniser: Recogniser<PointerEvent>,
): () => void {
  const wiring = arenaOf(target);
  const remove = wiring.arena.add(recogniser);
  return () => {
    remove();
    if (wiring.arena.size === 0) wiring.detach();
  };
}

/** The arena on `target`, if any (tests). */
export function gestureArena(target: GestureTarget): Arena<PointerEvent> | undefined {
  return wirings.get(target)?.arena;
}

/**
 * Long press on `target` (04-context §2.3), with the platform parts the pure recogniser leaves
 * out:
 * - **WebKit's callout and selection.** While a press may become a long press, and after it
 *   fired until the finger lifts, the pressed element gets `-webkit-touch-callout: none` and
 *   `user-select: none` and `selectstart` is cancelled, so iOS shows neither its link or image
 *   callout nor a word selection over the menu. A consumer whose text should select natively
 *   refuses text targets in `shouldStart`, so text spans are never touched.
 * - **Scroll.** A scroll anywhere during the press cancels it (the browser usually also sends
 *   `pointercancel`).
 * - **Echoes.** Android's `contextmenu` from the same touch is `preventDefault`ed and stopped
 *   within `GESTURE.contextMenuEchoMs` of a fire; if it arrives first, it counts as the fire.
 *   The `click` of the fired press's release is swallowed (capture, `GESTURE.clickEchoMs`).
 */
export function attachLongPress(
  target: GestureTarget,
  options: LongPressOptions<PointerEvent>,
): () => void {
  const view = windowOf(target);
  let styled: { el: HTMLElement | SVGElement; saved: [string, string, string][] } | null = null;
  /** The pointer of a fired press, until it lifts. */
  let firedPointer: number | null = null;
  let echoUntil = Number.NEGATIVE_INFINITY;
  let clickUntil = Number.NEGATIVE_INFINITY;

  const SUPPRESS = ['-webkit-touch-callout', '-webkit-user-select', 'user-select'] as const;
  const suppress = (node: EventTarget | null) => {
    if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;
    const style = node.style;
    styled = {
      el: node,
      saved: SUPPRESS.map((p) => [p, style.getPropertyValue(p), style.getPropertyPriority(p)]),
    };
    for (const p of SUPPRESS) style.setProperty(p, 'none', 'important');
  };
  const restore = () => {
    if (!styled) return;
    for (const [p, value, priority] of styled.saved) {
      if (value) styled.el.style.setProperty(p, value, priority);
      else styled.el.style.removeProperty(p);
    }
    styled = null;
  };

  const recogniser = longPress<PointerEvent>({
    // Forwarded, not spread: the hooks pass getters that must be read at each press.
    get types() {
      return options.types;
    },
    shouldStart: (e) => options.shouldStart?.(e) ?? true,
    onPressStart(e) {
      suppress(e.target);
      view.addEventListener('scroll', onScroll, PASSIVE_CAPTURE);
      options.onPressStart?.(e);
    },
    onPressEnd(fired) {
      view.removeEventListener('scroll', onScroll, PASSIVE_CAPTURE);
      if (!fired) restore();
      options.onPressEnd?.(fired);
    },
    onFire(e) {
      firedPointer = e.pointerId;
      echoUntil = performance.now() + GESTURE.contextMenuEchoMs;
      options.onFire(e);
    },
  });

  const onScroll = () => recogniser.cancel();
  const onRelease = (event: PointerEvent) => {
    if (event.pointerId !== firedPointer) return;
    firedPointer = null;
    restore();
    if (event.type === 'pointerup') clickUntil = performance.now() + GESTURE.clickEchoMs;
  };
  const onContextMenu = (event: Event) => {
    if (recogniser.pending) {
      event.preventDefault();
      event.stopPropagation();
      recogniser.fire();
    } else if (performance.now() < echoUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const onClick = (event: Event) => {
    if (performance.now() >= clickUntil) return;
    clickUntil = Number.NEGATIVE_INFINITY;
    event.preventDefault();
    event.stopPropagation();
  };
  const onSelectStart = (event: Event) => {
    if (styled) event.preventDefault();
  };

  const capture = { capture: true } as const;
  target.addEventListener('contextmenu', onContextMenu, capture);
  target.addEventListener('selectstart', onSelectStart, capture);
  view.addEventListener('click', onClick, capture);
  view.addEventListener('pointerup', onRelease, PASSIVE_CAPTURE);
  view.addEventListener('pointercancel', onRelease, PASSIVE_CAPTURE);
  const remove = attachRecogniser(target, recogniser);
  return () => {
    remove();
    restore();
    target.removeEventListener('contextmenu', onContextMenu, capture);
    target.removeEventListener('selectstart', onSelectStart, capture);
    view.removeEventListener('click', onClick, capture);
    view.removeEventListener('pointerup', onRelease, PASSIVE_CAPTURE);
    view.removeEventListener('pointercancel', onRelease, PASSIVE_CAPTURE);
    view.removeEventListener('scroll', onScroll, PASSIVE_CAPTURE);
  };
}

/** Taps and double taps on `target` (taps.ts). */
export function attachTaps(target: GestureTarget, options: TapOptions<PointerEvent>): () => void {
  return attachRecogniser(target, taps(options));
}

/** Two- and three-finger taps on `target` (multi-finger-tap.ts). */
export function attachMultiFingerTap(
  target: GestureTarget,
  options: MultiFingerTapOptions,
): () => void {
  return attachRecogniser(target, multiFingerTap<PointerEvent>(options));
}

/** Safari's non-standard gesture event (a trackpad or touch pinch). */
interface GestureEventLike extends UIEvent {
  readonly scale: number;
  readonly clientX: number;
  readonly clientY: number;
}

/**
 * Pinch on `target` (pinch.ts): pointer pairs, and Safari's `gesture*` events for a trackpad
 * pinch. While two touch pointers are down the pointer path owns the pinch and the gesture
 * events are left alone (iOS sends both); otherwise `gesturestart` and `gesturechange` are
 * `preventDefault`ed so Safari does not zoom the whole page under the app's own zoom.
 */
export function attachPinch(target: GestureTarget, options: PinchOptions): () => void {
  const recogniser = pinch<PointerEvent>(options);
  const remove = attachRecogniser(target, recogniser);
  const arena = arenaOf(target).arena;
  const onGesture = (event: Event) => {
    if (arena.touches() >= 2) return;
    const e = event as GestureEventLike;
    if (event.type !== 'gestureend') event.preventDefault();
    const phase =
      event.type === 'gesturestart' ? 'start' : event.type === 'gesturechange' ? 'change' : 'end';
    recogniser.external(phase, e.scale, { x: e.clientX, y: e.clientY }, e.timeStamp);
  };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    target.addEventListener(type, onGesture);
  }
  return () => {
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      target.removeEventListener(type, onGesture);
    }
    remove();
  };
}
