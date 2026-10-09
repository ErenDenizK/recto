/**
 * Service worker lifecycle (ARCHITECTURE.md §7, ADR-0010).
 *
 * - `registerType: 'prompt'`: a new version installs in the background and waits. The
 *   shell shows the system toast "Update ready · Reload · Later" (`08-feedback` FB4 §2, §5);
 *   only its Reload activates the new worker (`updateSW(true)`). With session snapshots on
 *   (ADR-0032 §2.4) it says documents reopen where they were; when nothing is kept (a private
 *   window, storage refused) it says reloading closes them (FB4 issue 9).
 * - Update checks run on window focus (throttled) in addition to the browser's own checks.
 * - Once the app shell is cached, the engine wasm is fetched in idle time so the runtime
 *   cache holds it (CacheFirst) and the first offline session can open files: PDFium first,
 *   then qpdf (Compress, Save repaired copy), so those jobs work offline too (PF-17, V1-F15).
 *   Skipped when the user asked the browser to save data.
 *
 * Status feeds the privacy popover; nothing here contacts another origin.
 */
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import qpdfWasmUrl from '@pdf-editor/engine/qpdf.wasm?url';
import { registerSW } from 'virtual:pwa-register';
import { create } from 'zustand';

import { m } from '../i18n';
import { useSessionStore } from '../session/session-store';
import { toast } from '../ui/Toast/toast';

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

/** The update toast's key: shown once however often the worker reports. */
const UPDATE_TOAST_KEY = 'pwa-update';

/** Hides the update notice for this session; the worker keeps waiting. */
export function dismissUpdate(): void {
  usePwaStore.setState({ updateAvailable: false });
}

/**
 * "Update ready" (FB4 system kind): stays until Reload or Later, no ✕; Later is the dismiss.
 * Exported for tests; the worker calls it when a new version waits.
 */
export function showUpdateReady(): void {
  usePwaStore.setState({ updateAvailable: true });
  const kept = useSessionStore.getState().keeping === 'available';
  toast.system(m.update_ready(), {
    key: UPDATE_TOAST_KEY,
    detail: kept ? m.update_kept() : m.update_not_kept(),
    testId: 'update-toast',
    action: { label: m.update_reload(), run: () => void applyUpdate() },
    secondary: { label: m.update_later(), run: dismissUpdate },
  });
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
 * Fetches the engine wasm (PDFium, then qpdf) through the service worker so it lands in the
 * runtime cache.
 * "Offline ready" can fire before the new worker has claimed the page; a fetch made then
 * bypasses the worker and caches nothing, so wait for control first.
 */
function warmEngineCache(): void {
  if (saveData()) return;
  const run = () => {
    void whenControlled()
      .then(async () => {
        for (const url of [wasmUrl, qpdfWasmUrl]) {
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
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh: showUpdateReady,
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
