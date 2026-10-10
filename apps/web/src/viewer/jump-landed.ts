/**
 * Waiting for the page view's jumps to land (`jump.ts`, motion-2026-10 viewer.md §1): find
 * steps pulse their hit once the scroll is there (`search.ts`). Apart from `jump.ts` so that
 * waiting, which the compact edition does too, does not load the jump itself.
 */

/** Every element with a jump in flight, for `whenJumpsLanded`. */
const flying = new Set<HTMLElement>();
let idle: (() => void)[] = [];

/** `jump.ts`: a jump started on `el`. */
export function jumpStarted(el: HTMLElement): void {
  flying.add(el);
}

/**
 * `jump.ts`: the jump on `el` landed or stopped; `settle` tells its callers (who may start
 * another), then the waiting resolve if nothing is in flight any more.
 */
export function jumpEnded(el: HTMLElement, settle: () => void): void {
  flying.delete(el);
  settle();
  if (flying.size === 0) {
    const waiting = idle;
    idle = [];
    for (const resolve of waiting) resolve();
  }
}

/** Resolves once no jump is in flight (at once when none is). */
export function whenJumpsLanded(): Promise<void> {
  if (flying.size === 0) return Promise.resolve();
  return new Promise((resolve) => idle.push(resolve));
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Resolves once a jump just asked for through the view store has landed: the page view starts
 * it from an effect, so this gives it two frames to begin, then waits for every jump in flight.
 */
export async function afterJump(): Promise<void> {
  await frame();
  await frame();
  await whenJumpsLanded();
}
