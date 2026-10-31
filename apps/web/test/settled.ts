/**
 * Waits until an element has come to rest: no animation or transition is running on it, in its
 * subtree, or on any of its ancestors.
 *
 * V2 sheets, popovers, menus, toasts and pushed pages enter from opacity 0 (language.md §7.3,
 * the motion tokens; `ui/sheet/sheet-motion.ts`), and jest-dom's `toBeVisible()` counts an
 * ancestor at opacity 0 as hidden. A test that opens one and asks at once passes on a fast
 * machine, where a frame has already gone by, and fails on a slow CI runner, where the first
 * frame of the entrance is still to come. Call this between the action and the assertion:
 *
 *     await userEvent.click(opener);
 *     const dialog = await screen.findByRole('dialog');
 *     await settled(dialog);
 *     expect(within(dialog).getByText('…')).toBeVisible();
 *
 * It resolves with the element, so a found element can be asked in one line:
 * `expect(await settled(await screen.findByRole('menu'))).toBeVisible()`.
 *
 * Two frames go by first, so an entrance that starts on the next frame (Base UI drops
 * `data-starting-style` in a frame callback, and the transition starts then) is already
 * running when the check looks. Only finite, running animations count: a spinner's infinite
 * loop, a paused animation or a finished one held by `fill` never ends, and is not motion
 * that hides anything. Nothing is sped up or turned off, so the tests that assert motion
 * still see it.
 */
import { act, waitFor } from '@testing-library/react';

/**
 * How long a test waits for a closed sheet to leave the DOM. A side sheet exits on *smooth*
 * (530 ms) and Base UI unmounts it only once that has finished, which leaves too little of
 * `waitFor`'s 1 s default on a slow runner: `waitFor(() => …toBeNull(), { timeout: EXIT_TIMEOUT })`.
 */
export const EXIT_TIMEOUT = 3000;

/**
 * How long a test waits for a sheet's lazy chunk (PF-21) on first open: the dev server
 * transforms the module and its imports on the first request, which takes seconds on a cold run.
 */
export const CHUNK_LOAD_TIMEOUT = 10_000;

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The finite animations running on `el`, its subtree and its ancestors. */
export function moving(el: Element): Animation[] {
  const all = [...el.getAnimations({ subtree: true })];
  for (let up = el.parentElement; up; up = up.parentElement) all.push(...up.getAnimations());
  return all.filter(
    (a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity,
  );
}

/** The beat of the stall clock, ms. */
const BEAT_MS = 50;
/** A beat this late means the page was frozen, not merely busy, ms. */
const STALL_MS = 250;

/**
 * Counts the time the page spent frozen (a long task, a starved runner), which is not time the
 * element had to come to rest. Vitest runs the files of a worker as iframes of one page, so a
 * sibling file's long task, or a runner stalled for seconds, stops this file's frames, timers
 * and animation clock alike. An entrance that then ends just after the wall-clock budget has
 * gone fails as "still moving: background-color, box-shadow" with the glass settle (the last
 * ~230 ms of a sheet's entrance) on screen (CI, PR #143 run 41206269790 and run 41202702690).
 * Time is read as a gap between beats of a timer: the latest beat may not have run yet when the
 * stall ends, so the open gap since it counts too.
 */
function stallClock(): { frozen: () => number; stop: () => void } {
  let last = performance.now();
  let frozen = 0;
  const beat = setInterval(() => {
    const now = performance.now();
    if (now - last > STALL_MS) frozen += now - last - BEAT_MS;
    last = now;
  }, BEAT_MS);
  return {
    frozen: () => {
      const open = performance.now() - last;
      return frozen + (open > STALL_MS ? open - BEAT_MS : 0);
    },
    stop: () => clearInterval(beat),
  };
}

/**
 * Resolves with `el` once it and its ancestors have stopped moving (see above).
 *
 * Rest is read across a frame. A Web Animation can be `finished` (held at its last keyframe by
 * `fill`) before its `finish` event has run: on a loaded runner Chromium advances the animation
 * clock in a task between frames, so a check there sees the motion done while the event, which
 * the next frame dispatches, has yet to come. The motion core cleans up on that event
 * (`animateStyle()` cancels its held animation and drops `will-change`), so a test that read
 * the element straight after the check could still find the held animation (CI, PR #11:
 * Segmented's thumb, `getAnimations()` 1). One frame after the check the event has run;
 * anything that started meanwhile is waited out again.
 *
 * `timeout` is time the page ran: a freeze of the page (`stallClock()`) does not count.
 */
export async function settled<T extends Element>(el: T, { timeout = 5000 } = {}): Promise<T> {
  const clock = stallClock();
  try {
    await act(async () => {
      await frame();
      await frame();
    });
    const began = performance.now();
    const frozenAtStart = clock.frozen();
    // The budget is `timeout` of a page that ran: a freeze pushes the deadline out by its length.
    const remaining = () => began + timeout + (clock.frozen() - frozenAtStart) - performance.now();
    for (;;) {
      try {
        await waitFor(
          () => {
            const running = moving(el);
            if (running.length > 0) {
              const names = running.map((a) =>
                a instanceof CSSTransition
                  ? a.transitionProperty
                  : a instanceof CSSAnimation
                    ? a.animationName
                    : a.id || 'animation',
              );
              throw new Error(`still moving: ${names.join(', ')}`);
            }
          },
          { timeout: Math.max(0, remaining()) },
        );
      } catch (error) {
        // The wait ran out while the page was frozen: the freeze was the wait, not the element.
        if (remaining() > 0) continue;
        throw error;
      }
      await act(async () => {
        await frame();
      });
      if (moving(el).length === 0) return el;
    }
  } finally {
    clock.stop();
  }
}
