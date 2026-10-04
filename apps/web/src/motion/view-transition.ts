/**
 * View Transitions for view changes only, capped at 240 ms (language.md §7.4, §7.3 *view
 * change*; ADR-0026 §2 items 3b, 4; research 18 §4.5, MP-10; research 22 §5.5).
 *
 * Library ⇄ document, page ⇄ Pages grid (on release) and into and out of Compare. While a
 * transition runs, clicks land on `<html>` and are lost (22 §5.5), so it never runs longer than
 * `--vt-duration`: 240 ms after its animations start it is skipped to its end, whatever the
 * stylesheet asks (the pseudo-elements are meant to run 240 ms, so the skip only ever cuts a
 * longer one short). The update runs inside React's `flushSync`, because Zustand updates never
 * drive React's `<ViewTransition>` (§7.4), and is awaited; focus it loses with the old DOM is
 * restored inside the callback, where it is live at once (22 §5.5). Unsupported engines and
 * reduced motion just run the update (09-primitives §31: skip on reduced motion).
 */
import { flushSync } from 'react-dom';

import { reducedMotion } from './reduced-motion';

/** `--vt-duration` (language.md §7.1). */
export const VIEW_TRANSITION_MS = 240;

/**
 * Runs `update` as a View Transition. `name` becomes the transition's type for
 * `:active-view-transition-type()` where engines support types. Resolves once the update has
 * been applied, and rejects if it throws.
 */
export function viewTransition(
  update: () => void | Promise<void>,
  o: { readonly name?: string } = {},
): Promise<void> {
  const focused = document.activeElement as HTMLElement | null;
  const run = async () => {
    await flushSync(update);
    // Focus that went with the old DOM comes back if its element survived (22 §5.5).
    if (document.activeElement === document.body) focused?.focus({ preventScroll: true });
  };
  if (!document.startViewTransition || reducedMotion()) return run();
  const transition = document.startViewTransition(
    o.name && 'types' in ViewTransition.prototype ? { update: run, types: [o.name] } : run,
  );
  transition.ready.then(
    () => setTimeout(() => transition.skipTransition(), VIEW_TRANSITION_MS),
    () => undefined,
  );
  return transition.updateCallbackDone;
}
