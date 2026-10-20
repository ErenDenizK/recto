/**
 * The page's side of the service worker's Office part (`public/sw-office.js`, ADR-0035 §4),
 * kept in `pwa/` with the rest of the worker's API (ED-2, editions.md §5.1). Imported only by
 * the lazy Office flow (`office/isolation.ts`).
 */

/** Whether a service worker controls the page, so a reload can be cross-origin isolated. */
export function serviceWorkerControls(): boolean {
  return 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null;
}

/**
 * Posts `{ type }` to the controlling worker and resolves with its `installed` answer; false
 * without a worker or when it does not answer in time.
 */
export function askServiceWorker(type: string, timeoutMs: number): Promise<boolean> {
  const controller = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;
  if (controller === null) return Promise.resolve(false);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), timeoutMs);
    channel.port1.onmessage = (event: MessageEvent<{ installed?: unknown }>) => {
      clearTimeout(timer);
      resolve(event.data.installed === true);
    };
    controller.postMessage({ type }, [channel.port2]);
  });
}
