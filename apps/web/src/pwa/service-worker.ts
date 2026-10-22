/**
 * Service worker lifecycle (ARCHITECTURE.md §7, ADR-0010): what happens once `register.ts` has
 * asked for the worker. This module loads right after the first paint, so the first paint
 * carries only the registration (V1-P1); its status reaches the privacy popover and Settings
 * a moment later.
 *
 * - `registerType: 'prompt'`: a new version installs in the background and waits. The
 *   shell shows the system toast "Update ready · Reload · Later" (`08-feedback` FB4 §2, §5);
 *   only its Reload activates the new worker (`updateSW(true)`). With session snapshots on
 *   (ADR-0032 §2.4) it says documents reopen where they were; when nothing is kept (a private
 *   window, storage refused) it says reloading closes them (FB4 issue 9). The toast lives in
 *   `update-toast.ts`, loaded when a worker waits, so the first paint does not carry the
 *   toast API and what it reaches (V1-P1, PRC-11).
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

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined;

/** Sets the worker's status (`register.ts`). */
export function setStatus(status: ServiceWorkerStatus): void {
  usePwaStore.setState({ status });
}

/** Keeps the plugin's update function for Reload (`register.ts`). */
export function setUpdater(update: (reloadPage?: boolean) => Promise<void>): void {
  updateServiceWorker = update;
}

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

/** The app shell is cached (`onOfflineReady`, or a worker active from an earlier visit). */
export function ready(): void {
  if (usePwaStore.getState().status === 'ready') return;
  usePwaStore.setState({ status: 'ready' });
  warmEngineCache();
}

/** The worker registered: ready if one was active already, and update checks on focus. */
export function registered(registration: ServiceWorkerRegistration): void {
  // Installed on an earlier visit: onOfflineReady does not fire again.
  if (registration.active) ready();
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
