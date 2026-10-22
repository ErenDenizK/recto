/**
 * Registers the service worker (ARCHITECTURE.md §7, ADR-0010), in the first paint. Everything
 * that follows the registration (status, update checks, the update toast, warming the engine
 * wasm) is `service-worker.ts`, loaded once the plugin calls back, so the first paint carries
 * only this (V1-P1).
 */
import { registerSW } from 'virtual:pwa-register';

let started = false;

const later = () => import('./service-worker');

/** Registers the service worker once. Safe to call more than once. */
export function startServiceWorker(): void {
  if (started) return;
  started = true;
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) {
    const status = import.meta.env.DEV ? 'development' : 'unsupported';
    void later().then((worker) => worker.setStatus(status));
    return;
  }
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
