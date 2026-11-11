/**
 * Starts the engine in an idle moment of the first screen (PF-24, perf audit R33 item 1), so
 * the first open finds its worker running: the wasm fetched and compiled and the worker
 * instantiated were 340 ms of the sample's first page, paid after the open began. `app.tsx`
 * (the full edition's chunk) calls it, so it is outside the first paint's closure (V1-P1).
 *
 * Only where it is cheap, and never ahead of the first paint. Not on the phone's compact
 * edition (its caller decides), not with `deviceMemory` under 4 GB (a worker with its wasm
 * heap is 100 to 200 MB), not under `saveData` or on a slow connection (the wasm is 4.6 MB
 * raw), not in a hidden tab.
 */

import { deskEnabled } from '../home/desk-flag';
import { getEngineService } from './engine-service';

interface NetworkInformation {
  readonly saveData?: boolean;
  readonly effectiveType?: string;
}

/** The browser's hints that the engine should wait for a real open. */
export function prewarmAllowed(
  nav: Navigator & { deviceMemory?: number; connection?: NetworkInformation } = navigator,
): boolean {
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  const link = nav.connection;
  if (link?.saveData === true) return false;
  return link?.effectiveType === undefined || !/^(slow-2g|2g|3g)$/.test(link.effectiveType);
}

/** True when the address already says a document is about to open (`?sample`). */
function openComing(search: string): boolean {
  return new URLSearchParams(search).has('sample');
}

/** The desk's paint mark (`home/desk-painted.ts`, DSN-87), by name to keep this module tiny. */
const DESK_PAINTED = 'desk:painted';

/** Whether a performance entry of `type` and `name` exists, or one arrives (`PerformanceObserver`). */
function whenEntry(type: 'paint' | 'mark', name: string, run: () => void): void {
  if (performance.getEntriesByName(name).length > 0) {
    run();
    return;
  }
  try {
    const observer = new PerformanceObserver((list) => {
      if (list.getEntriesByName(name).length === 0) return;
      observer.disconnect();
      run();
    });
    observer.observe({ type, buffered: true });
  } catch {
    // No such timing here: the caller's timer decides.
  }
}

/**
 * Calls `run` once the first content has painted and, with the desk on, the desk has (its mark
 * is the paint budget, so nothing starts ahead of it); after 3 s anyway where nothing tells.
 */
function afterFirstPaint(run: () => void): void {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    run();
  };
  setTimeout(go, 3_000);
  whenEntry('paint', 'first-contentful-paint', () => {
    if (deskEnabled()) whenEntry('mark', DESK_PAINTED, go);
    else go();
  });
}

/**
 * Schedules the pre-warm for an idle moment: right away when a document is about to open
 * (the engine then starts beside the editor's own scripts), else once the first screen has
 * painted, so it never competes with the first paint.
 */
export function scheduleEnginePrewarm(): void {
  if (!prewarmAllowed()) return;
  const run = () => {
    if (document.visibilityState === 'hidden') return;
    getEngineService().prewarm();
  };
  const idle = () => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1_500 });
    else setTimeout(run, 500);
  };
  if (openComing(location.search)) idle();
  else afterFirstPaint(idle);
}
