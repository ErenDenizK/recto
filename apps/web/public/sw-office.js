/**
 * The Office conversion's part of the service worker (ADR-0035 §4). The generated worker
 * (`vite.config.ts`, Workbox) loads this with `importScripts` before its own code, so these
 * listeners come first. It does two things, and nothing at all for someone who never agreed
 * to the conversion package:
 *
 * 1. **Serves `convert/**`** from the `pdf-editor-office` cache that the download manager
 *    (`src/office/package-store.ts`) fills: a file kept gzip-compressed (`X-Recto-Encoding:
 *    gzip`) is inflated on the way out, so LibreOffice reads `soffice.wasm` while the device
 *    keeps 50 MB instead of 147. What is not cached goes to the network; the compressed
 *    downloads (`*.gz`) are left alone, so cancelling one stops the transfer.
 *    Every response carries the isolation headers, so its workers may run in an isolated page.
 * 2. **Isolates the app once the package is installed** (the marker `convert/installed.json`
 *    is in the cache): the app's page gets `Cross-Origin-Opener-Policy: same-origin` and
 *    `Cross-Origin-Embedder-Policy: require-corp`, and every same-origin worker script gets the
 *    same, which `require-corp` asks of a dedicated worker. LibreOffice needs threads, threads
 *    need `SharedArrayBuffer`, and that needs `crossOriginIsolated`; GitHub Pages cannot send
 *    headers (ADR-0004), so the worker adds them. Each response is the one Workbox would have
 *    given (the precached page, the precached script, else the network) with headers added.
 *
 * Whether the package is installed is read from the cache when the worker starts. Until that
 * read lands a navigation is left to Workbox (not isolated: the page reloads once if it needs
 * to convert), but a worker script waits for it: an isolated page whose worker the browser
 * restarted must still get `require-corp` on its next worker, or the worker is refused. The
 * page asks again (`RECTO_OFFICE_REFRESH`) after an install or a removal.
 */
(function officeServiceWorker(sw) {
  'use strict';
  const CACHE = 'pdf-editor-office';
  const scope = sw.registration.scope;
  const convertRoot = new URL('convert/', scope).href;
  const marker = new URL('convert/installed.json', scope).href;
  const pending = new URL('convert/pending/', scope).href;
  const entries = [scope, new URL('index.html', scope).href];
  const ISOLATION = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };

  /** undefined until the first read lands; then whether the package is installed. */
  let installed;
  const read = () =>
    caches
      .open(CACHE)
      .then((cache) => cache.match(marker))
      .then(
        (response) => {
          installed = response !== undefined;
          return installed;
        },
        () => {
          installed = false;
          return false;
        },
      );
  let reading = read();

  sw.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'RECTO_OFFICE_REFRESH') return;
    reading = read();
    event.waitUntil(
      reading.then((on) => {
        const port = event.ports && event.ports[0];
        if (port) port.postMessage({ installed: on });
      }),
    );
  });

  /** The response with the isolation headers (opaque and error responses pass as they are). */
  function isolate(response) {
    if (response.type === 'opaque' || response.type === 'opaqueredirect' || response.status === 0)
      return response;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(ISOLATION)) headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  /** The precache entry for `url` (its revision is a search parameter), else the network. */
  async function precachedOrNetwork(url, request) {
    const names = await caches.keys();
    const name = names.find((n) => n.startsWith('workbox-precache') && n.endsWith(scope));
    if (name !== undefined) {
      const hit = await (await caches.open(name)).match(url, { ignoreSearch: true });
      if (hit !== undefined) return hit;
    }
    return fetch(request);
  }

  /** A `convert/` file: from the package cache (inflated when stored compressed), else fetched. */
  async function serveConvert(request) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request.url);
    if (hit === undefined) return isolate(await fetch(request));
    if (hit.headers.get('X-Recto-Encoding') !== 'gzip' || hit.body === null) return isolate(hit);
    const headers = new Headers(hit.headers);
    headers.delete('X-Recto-Encoding');
    headers.delete('Content-Length');
    const body = hit.body.pipeThrough(new DecompressionStream('gzip'));
    return isolate(new Response(body, { status: 200, headers }));
  }

  sw.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = request.url;
    if (url.startsWith(convertRoot)) {
      // The marker, stashed files and the compressed downloads go straight to the network
      // (or the cache's owner), so a cancelled download stops the transfer itself.
      if (url === marker || url.startsWith(pending) || url.endsWith('.gz')) return;
      event.respondWith(serveConvert(request));
      return;
    }
    if (installed === false || new URL(url).origin !== sw.location.origin) return;
    if (request.destination === 'worker' || request.destination === 'sharedworker') {
      event.respondWith(
        reading.then((on) =>
          precachedOrNetwork(url, request).then((response) => (on ? isolate(response) : response)),
        ),
      );
      return;
    }
    if (installed === true && request.mode === 'navigate') {
      const plain = url.split('#')[0].split('?')[0];
      if (!entries.includes(plain)) return;
      event.respondWith(precachedOrNetwork(entries[1], request).then(isolate));
    }
  });

  // Tests read the pieces; the worker itself never uses this.
  sw.__rectoOffice = { isolate, read: () => reading };
})(self);
