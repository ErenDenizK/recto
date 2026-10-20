/**
 * Cross-origin isolation for the converter (ADR-0035 §4), page side. LibreOffice runs on
 * threads, which need `SharedArrayBuffer`, which needs `crossOriginIsolated`; the service
 * worker grants it (`public/sw-office.js`) once the package is installed, on the next load.
 *
 * - `refreshServiceWorker` tells the worker to read the install marker again and waits for it.
 * - When the page is not isolated yet, the files are stashed in the package cache, the page
 *   reloads once (a `sessionStorage` flag guards the loop), and the flow resumes from the stash
 *   (`intake.ts`). Open documents come back through the session snapshots (ADR-0032 §2.4).
 * - A browser without a controlling service worker (Firefox private windows, some managed
 *   browsers) cannot be isolated: that is the `isolation` failure, never a reload.
 */
import { askServiceWorker, serviceWorkerControls } from '../pwa/office-worker';
import { OFFICE_RELOAD_KEY } from './flag';
import { OFFICE_CACHE, OFFICE_REFRESH_MESSAGE, pendingRoot } from './package';

const NAME_HEADER = 'X-Recto-Name';

export function isIsolated(): boolean {
  return (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

/** Whether a service worker controls the page, so a reload can be isolated. */
export function canIsolate(): boolean {
  return serviceWorkerControls();
}

/** Asks the service worker to read the install marker again; resolves to what it found. */
export function refreshServiceWorker(timeoutMs = 5_000): Promise<boolean> {
  return askServiceWorker(OFFICE_REFRESH_MESSAGE, timeoutMs);
}

/** Keeps `files` in the package cache across the reload. */
export async function stashFiles(files: readonly File[]): Promise<void> {
  const cache = await caches.open(OFFICE_CACHE);
  for (const [i, file] of files.entries()) {
    await cache.put(
      `${pendingRoot()}${i}`,
      new Response(file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          [NAME_HEADER]: encodeURIComponent(file.name),
          'Last-Modified': new Date(file.lastModified).toUTCString(),
        },
      }),
    );
  }
}

/** The stashed files, in order, removed from the cache. */
export async function takeStashedFiles(): Promise<File[]> {
  let cache: Cache;
  try {
    cache = await caches.open(OFFICE_CACHE);
  } catch {
    return [];
  }
  const root = pendingRoot();
  const requests = (await cache.keys()).filter((request) => request.url.startsWith(root));
  requests.sort((a, b) => Number(a.url.slice(root.length)) - Number(b.url.slice(root.length)));
  const files: File[] = [];
  for (const request of requests) {
    const response = await cache.match(request);
    await cache.delete(request);
    if (response === undefined) continue;
    const name = decodeURIComponent(response.headers.get(NAME_HEADER) ?? 'document');
    const modified = Date.parse(response.headers.get('Last-Modified') ?? '');
    files.push(
      new File([await response.blob()], name, {
        type: response.headers.get('Content-Type') ?? '',
        ...(Number.isFinite(modified) ? { lastModified: modified } : {}),
      }),
    );
  }
  return files;
}

/** Reloads into isolation once; the flag lets the next load resume and stops a loop. */
export function reloadIntoIsolation(): void {
  try {
    sessionStorage.setItem(OFFICE_RELOAD_KEY, '1');
  } catch {
    // Without session storage the next load cannot tell it reloaded; it still resumes from
    // the stash, and a second failure to isolate is reported, not retried (`office-flow.ts`).
  }
  location.reload();
}

/** Whether this load follows the reload into isolation; clears the flag. */
export function takeReloadFlag(): boolean {
  try {
    const set = sessionStorage.getItem(OFFICE_RELOAD_KEY) === '1';
    sessionStorage.removeItem(OFFICE_RELOAD_KEY);
    return set;
  } catch {
    return false;
  }
}
