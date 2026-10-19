/**
 * An injected idle clock: `requestIdleCallback` held in a queue the test runs, in place of the
 * browser's idle periods.
 *
 * A real idle callback asked for without a `timeout` has no upper bound: Chromium runs it only
 * in an idle period, and a loaded runner (other test files rendering in the same browser, a busy
 * worker) can go well past a test's timeout without one. A test that awaited a bare
 * `requestIdleCallback` timed out that way on CI (R23-9, the render deferral of
 * `viewer/read-controller.ts`). With this clock, "idle time comes" is a step the test takes:
 *
 *     const clock = fakeIdle();
 *     deferPageRender(source, 0, run);
 *     expect(clock.pending()).toBe(1);
 *     clock.idle();
 *     expect(run).toHaveBeenCalledTimes(1);
 *
 * Callbacks asked for while `idle()` runs them wait for the next `idle()`, as a callback posted
 * during an idle period waits for the next period. Call `restore()` in `afterEach`.
 */
import { vi } from 'vitest';

export interface IdleClock {
  /** Idle callbacks asked for and not yet run or cancelled. */
  pending(): number;
  /** The options of every request so far, in order (the code's `timeout`). */
  readonly requests: readonly (IdleRequestOptions | undefined)[];
  /** One idle period: runs the callbacks pending now, with a deadline that has time left. */
  idle(): void;
  /** Puts the browser's `requestIdleCallback` and `cancelIdleCallback` back. */
  restore(): void;
}

export function fakeIdle(): IdleClock {
  const queue = new Map<number, IdleRequestCallback>();
  const requests: (IdleRequestOptions | undefined)[] = [];
  let next = 1;
  const request = vi
    .spyOn(window, 'requestIdleCallback')
    .mockImplementation((callback, options) => {
      const id = next++;
      queue.set(id, callback);
      requests.push(options);
      return id;
    });
  const cancel = vi.spyOn(window, 'cancelIdleCallback').mockImplementation((id) => {
    queue.delete(id);
  });
  return {
    pending: () => queue.size,
    requests,
    idle() {
      const due = [...queue];
      queue.clear();
      const start = performance.now();
      const deadline: IdleDeadline = {
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (performance.now() - start)),
      };
      for (const [, callback] of due) callback(deadline);
    },
    restore() {
      queue.clear();
      request.mockRestore();
      cancel.mockRestore();
    },
  };
}
