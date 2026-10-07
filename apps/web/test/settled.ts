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

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The finite animations running on `el`, its subtree and its ancestors. */
export function moving(el: Element): Animation[] {
  const all = [...el.getAnimations({ subtree: true })];
  for (let up = el.parentElement; up; up = up.parentElement) all.push(...up.getAnimations());
  return all.filter(
    (a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity,
  );
}

/** Resolves with `el` once it and its ancestors have stopped moving (see above). */
export async function settled<T extends Element>(el: T, { timeout = 5000 } = {}): Promise<T> {
  await act(async () => {
    await frame();
    await frame();
  });
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
    { timeout },
  );
  return el;
}
