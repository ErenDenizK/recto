/**
 * The split top's menu motion's ref callback (DSN-39, MOT-13) without its weight:
 * `liquid-menu.ts` is fetched once the browser is idle after the split top shows
 * (`prefetchLiquidMenu`), as the container transform is (DSN-36), so the compact chunk carries
 * only this. A menu opened before it arrives keeps its CSS entrance.
 */
import type { liquidPopupFor } from './liquid-menu';

/** How long the idle fetch may wait for an idle moment, ms. */
const PREFETCH_TIMEOUT_MS = 3000;

let serve: typeof liquidPopupFor | null = null;
let asked = false;

/** Fetches the liquid menu once the browser is idle (idempotent). */
export function prefetchLiquidMenu(): void {
  if (asked || typeof window === 'undefined') return;
  asked = true;
  const load = () => {
    import('./liquid-menu')
      .then((module) => {
        serve = module.liquidPopupFor;
      })
      .catch(() => {
        asked = false;
      });
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(load, { timeout: PREFETCH_TIMEOUT_MS });
  } else {
    window.setTimeout(load, PREFETCH_TIMEOUT_MS);
  }
}

/**
 * The ref callback for a menu popup that comes out of its trigger as liquid glass: one function
 * for every render, so React attaches it once per popup, and React 19's ref cleanup ends it.
 */
export function liquidPopupRef(popup: HTMLElement | null): (() => void) | undefined {
  if (!popup || !serve) return undefined;
  return serve(popup);
}
