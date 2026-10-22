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
 * Resolves true once a service worker controls the page: at once when one does, else after the
 * worker registered late (PF-20) has activated and claimed the page, false past `timeoutMs` or
 * without service worker support.
 */
export async function whenServiceWorkerControls(timeoutMs: number): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  const container = navigator.serviceWorker;
  if (container.controller !== null) return true;
  return new Promise((resolve) => {
    const done = (value: boolean) => {
      clearTimeout(timer);
      container.removeEventListener('controllerchange', onChange);
      resolve(value);
    };
    const onChange = () => done(container.controller !== null);
    const timer = setTimeout(() => done(false), timeoutMs);
    container.addEventListener('controllerchange', onChange);
    // `ready` resolves once a worker is active; check the controller again then.
    void container.ready.then(() => {
      if (container.controller !== null) done(true);
    });
  });
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
