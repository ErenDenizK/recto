/**
 * Registers the service worker (ARCHITECTURE.md §7, ADR-0010), in the first paint. Everything
 * that follows the registration (status, update checks, the update toast, warming the engine
 * wasm) is `service-worker.ts`, loaded once the plugin calls back, so the first paint carries
 * only this (V1-P1).
 *
 * The worker registers in an idle moment after the first document's first page has drawn, or
 * `REGISTER_FALLBACK_MS` after the edition has loaded and the Library shows, whichever comes
 * first, not at boot: its precache would otherwise share a phone's link with the sample that
 * is opening (PF-20, docs/research/perf/phone-first-load-2026-10.md P5). Offline-ready and
 * the update toast behave as before, only later on a first visit.
 */
import { registerSW } from 'virtual:pwa-register';

let started = false;

const later = () => import('./service-worker');

/** How long the Library may sit with no document before the worker registers anyway (PF-20). */
const REGISTER_FALLBACK_MS = 5_000;

/** Settling time after the first page: the capsule morph and first touches run in it (PF-20). */
const IDLE_AFTER_RENDER_MS = 1_500;

/** Runs `fn` in an idle moment after the first page: `requestIdleCallback`, else a short timer. */
function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    // Idle callbacks can fire in the first quiet frame; wait out the settling time first.
    setTimeout(() => requestIdleCallback(fn, { timeout: 3_000 }), IDLE_AFTER_RENDER_MS);
  } else setTimeout(fn, IDLE_AFTER_RENDER_MS);
}

/**
 * Calls `run` once: in an idle moment after a page canvas first reaches `data-state="rendered"`
 * (the first document's first page, `PageCanvas`/`TiledPage`), or `fallbackMs` after the
 * returned `arm` is called, whichever comes first; `now` runs it at once. Watching the attribute keeps this module free of the
 * viewer's components.
 */
export function runAfterFirstPage(
  run: () => void,
  fallbackMs: number,
): { readonly arm: () => void; readonly now: () => void } {
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      const target = record.target;
      if (target instanceof HTMLCanvasElement && target.dataset.state === 'rendered') {
        observer.disconnect();
        whenIdle(go);
        return;
      }
    }
  });
  function go(): void {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(timer);
    run();
  }
  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-state'],
  });
  return {
    arm: () => {
      if (!done) timer ??= setTimeout(go, fallbackMs);
    },
    now: go,
  };
}

/** The latest the worker registers, even if no edition loads and no page draws (PF-20). */
const REGISTER_CEILING_MS = 30_000;

let armRegistration: (() => void) | undefined;
let registerNow: (() => void) | undefined;

/** Registers the worker now: Office conversion needs it to isolate the page (ADR-0035, PF-20). */
export function registerServiceWorkerNow(): void {
  registerNow?.();
}

/** The Library is showing: start the fallback clock for the worker's registration (PF-20). */
export function armServiceWorkerRegistration(): void {
  armRegistration?.();
}

/** Registers the service worker once. Safe to call more than once. */
export function startServiceWorker(): void {
  if (started) return;
  started = true;
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    const status = import.meta.env.DEV ? 'development' : 'unsupported';
    void later().then((worker) => worker.setStatus(status));
    return;
  }
  const deferred = runAfterFirstPage(register, REGISTER_FALLBACK_MS);
  armRegistration = deferred.arm;
  registerNow = deferred.now;
  setTimeout(deferred.now, REGISTER_CEILING_MS);

  function register(): void {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => void later().then((worker) => worker.showUpdateReady()),
      onOfflineReady: () => void later().then((worker) => worker.ready()),
      onRegisteredSW: (_url, registration) => {
        if (registration) void later().then((worker) => worker.registered(registration));
      },
      onRegisterError: () => void later().then((worker) => worker.setStatus('error')),
    });
    void later().then((worker) => worker.setUpdater(update));
  }
}
