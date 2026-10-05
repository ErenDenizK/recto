/**
 * React hooks over the attach functions (09-primitives §31): each attaches once per element
 * and always calls the latest options, so a consumer passes inline callbacks without
 * re-wiring on every render. Hit-testing stays in the consumer (`shouldStart`, the callbacks).
 */
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';

import {
  attachLongPress,
  attachMultiFingerTap,
  attachPinch,
  attachTaps,
  type GestureTarget,
} from './dom';
import type { LongPressOptions } from './long-press';
import type { MultiFingerTapOptions } from './multi-finger-tap';
import type { PinchOptions } from './pinch';
import type { TapOptions } from './taps';

type TargetRef = RefObject<GestureTarget | null>;

/** The latest `value`, readable from listeners attached once. */
function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** Runs `attach` for the element in `ref` once it is mounted; detaches on unmount. */
function useAttached(ref: TargetRef, attach: (target: GestureTarget) => () => void): void {
  const latestAttach = useLatest(attach);
  useEffect(() => {
    const target = ref.current;
    return target ? latestAttach.current(target) : undefined;
  }, [ref, latestAttach]);
}

/** Long press (04-context §2.3): `onFire` with the press event after 450 ms held still. */
export function useLongPress(ref: TargetRef, options: LongPressOptions<PointerEvent>): void {
  const latest = useLatest(options);
  useAttached(ref, (target) =>
    attachLongPress(target, {
      get types() {
        return latest.current.types;
      },
      shouldStart: (e) => latest.current.shouldStart?.(e) ?? true,
      onFire: (e) => latest.current.onFire(e),
      onPressStart: (e) => latest.current.onPressStart?.(e),
      onPressEnd: (fired) => latest.current.onPressEnd?.(fired),
    }),
  );
}

/** Taps and double taps (taps.ts). */
export function useTaps(ref: TargetRef, options: TapOptions<PointerEvent>): void {
  const latest = useLatest(options);
  useAttached(ref, (target) =>
    attachTaps(target, {
      get types() {
        return latest.current.types;
      },
      get exclusive() {
        return latest.current.exclusive;
      },
      onTap: (e) => latest.current.onTap?.(e),
      // Read at each tap: a consumer that drops `onDoubleTap` also drops the pairing.
      get onDoubleTap() {
        const handler = latest.current.onDoubleTap;
        return handler ? (e: PointerEvent) => handler(e) : undefined;
      },
    }),
  );
}

/** Two- and three-finger taps (multi-finger-tap.ts); `enabled` is read at each tap. */
export function useMultiFingerTap(ref: TargetRef, options: MultiFingerTapOptions): void {
  const latest = useLatest(options);
  useAttached(ref, (target) =>
    attachMultiFingerTap(target, {
      enabled: () => {
        const { enabled } = latest.current;
        return typeof enabled === 'function' ? enabled() : enabled !== false;
      },
      onTwo: () => latest.current.onTwo?.(),
      onThree: () => latest.current.onThree?.(),
    }),
  );
}

/** Pinch (pinch.ts): pointer pairs and Safari's gesture events. */
export function usePinch(ref: TargetRef, options: PinchOptions): void {
  const latest = useLatest(options);
  useAttached(ref, (target) =>
    attachPinch(target, {
      onStart: (origin) => latest.current.onStart?.(origin),
      onChange: (scale, origin) => latest.current.onChange?.(scale, origin),
      onEnd: (scale, velocity, origin) => latest.current.onEnd?.(scale, velocity, origin),
    }),
  );
}
