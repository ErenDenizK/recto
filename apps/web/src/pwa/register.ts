/**
 * Service worker lifecycle (ARCHITECTURE.md §7, ADR-0010).
 *
 * - `registerType: 'prompt'`: a new version installs in the background and waits. The
 *   shell shows the system toast "Update ready · Reload · Later" (`08-feedback` FB4 §2, §5);
 *   only its Reload activates the new worker (`updateSW(true)`). With session snapshots on
 *   (ADR-0032 §2.4) it says documents reopen where they were; when nothing is kept (a private
 *   window, storage refused) it says reloading closes them (FB4 issue 9). The toast lives in
 *   `update-toast.ts`, loaded when a worker waits, so the first paint does not carry the
 *   toast API and what it reaches (V1-P1, PRC-11).
 * - The worker registers in an idle moment after the first document's first page has drawn, or
 *   `REGISTER_FALLBACK_MS` after the edition has loaded and the Library shows, whichever comes
 *   first, not at boot: its precache would otherwise share a phone's link with the sample that
 *   is opening (PF-20, docs/research/perf/phone-first-load-2026-10.md P5). Offline-ready and
 *   the update toast behave as before, only later on a first visit.
 * - Update checks run on window focus (throttled) in addition to the browser's own checks.
 * - Once the app shell is cached, the engine wasm is fetched in idle time so the runtime
 *   cache holds it (CacheFirst) and the first offline session can open files: PDFium first,
 *   then qpdf (Compress, Save repaired copy), so those jobs work offline too (PF-17, V1-F15).
 *   The compact edition warms PDFium only: none of its surfaces runs qpdf (Compress and the
 *   repaired copy are full-edition tools), so a phone's first visit does not fetch its ~3 MB
 *   (docs/research/perf/phone-first-load-2026-10.md); were it ever needed, the engine fetches
 *   it on first use into the same runtime cache. Skipped when the user asked the browser to
 *   save data.
 *
 * Status feeds the privacy popover; nothing here contacts another origin.
 */
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import qpdfWasmUrl from '@pdf-editor/engine/qpdf.wasm?url';
import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';

import { type Edition, getEdition } from '../shell/frame/edition';

export type ServiceWorkerStatus =
  /** No service worker support (or blocked, e.g. some private modes). */
  | 'unsupported'
  /** `vite dev`: the plugin does not generate a worker. */
  | 'development'
  | 'installing'
  /** App shell cached; works offline. */
  | 'ready'
  | 'error';

interface PwaState {
  readonly status: ServiceWorkerStatus;
  /** A new version is installed and waiting for the user. */
  readonly updateAvailable: boolean;
}

export const usePwaStore = create<PwaState>()(() => ({
  status: 'installing',
  updateAvailable: false,
}));

/** Minimum time between focus-triggered update checks. */
const UPDATE_CHECK_INTERVAL_MS = 60_000;

let started = false;
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

/** Activates the waiting worker and reloads the page (the user pressed Reload). */
export async function applyUpdate(): Promise<void> {
  if (updateServiceWorker) await updateServiceWorker(true);
  else location.reload();
}

/** Hides the update notice for this session; the worker keeps waiting. */
export function dismissUpdate(): void {
  usePwaStore.setState({ updateAvailable: false });
}

/**
 * "Update ready" (FB4 system kind): stays until Reload or Later, no ✕; Later is the dismiss.
 * Exported for tests; the worker calls it when a new version waits. Resolves once the toast
 * is shown: its module loads on demand (precached like every chunk, PF-17).
 */
export async function showUpdateReady(): Promise<void> {
  usePwaStore.setState({ updateAvailable: true });
  const { showUpdateToast } = await import('./update-toast');
  showUpdateToast(() => void applyUpdate(), dismissUpdate);
}

function saveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Resolves once a service worker controls this page (after `clientsClaim` on first visit). */
function whenControlled(): Promise<void> {
  if (navigator.serviceWorker.controller !== null) return Promise.resolve();
  return new Promise((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
  });
}

/**
 * The engine wasm an edition warms into the runtime cache, in fetch order: PDFium for both,
 * qpdf only for the full edition, the one with qpdf's tools (Compress, Save repaired copy).
 */
export function warmWasmUrls(edition: Edition): readonly string[] {
  return edition === 'compact' ? [wasmUrl] : [wasmUrl, qpdfWasmUrl];
}

/**
 * Fetches the edition's engine wasm (`warmWasmUrls`) through the service worker so it lands in
 * the runtime cache.
 * "Offline ready" can fire before the new worker has claimed the page; a fetch made then
 * bypasses the worker and caches nothing, so wait for control first.
 */
function warmEngineCache(): void {
  if (saveData()) return;
  const run = () => {
    void whenControlled()
      .then(async () => {
        for (const url of warmWasmUrls(getEdition())) {
          await (await fetch(url, { credentials: 'same-origin' })).arrayBuffer();
        }
      })
      .catch(() => {
        // Offline or evicted: the engine fetches it on first use instead.
      });
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 10_000 });
  else setTimeout(run, 2_000);
}

function watchForUpdates(registration: ServiceWorkerRegistration): void {
  let lastCheck = Date.now();
  const check = () => {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    if (registration.installing || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastCheck = Date.now();
    registration.update().catch(() => {
      // Network hiccup: the next focus retries.
    });
  };
  window.addEventListener('focus', check);
  document.addEventListener('visibilitychange', check);
}

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
  if (import.meta.env.DEV) {
    usePwaStore.setState({ status: 'development' });
    return;
  }
  if (!('serviceWorker' in navigator)) {
    usePwaStore.setState({ status: 'unsupported' });
    return;
  }
  const ready = () => {
    if (usePwaStore.getState().status === 'ready') return;
    usePwaStore.setState({ status: 'ready' });
    warmEngineCache();
  };
  const deferred = runAfterFirstPage(register, REGISTER_FALLBACK_MS);
  armRegistration = deferred.arm;
  registerNow = deferred.now;
  setTimeout(deferred.now, REGISTER_CEILING_MS);

  function register(): void {
    updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => void showUpdateReady(),
      onOfflineReady: ready,
      onRegisteredSW: (_url, registration) => {
        if (!registration) return;
        // Installed on an earlier visit: onOfflineReady does not fire again.
        if (registration.active) ready();
        watchForUpdates(registration);
      },
      onRegisterError: () => usePwaStore.setState({ status: 'error' }),
    });
  }
}
