/**
 * The service worker's Office part (`public/sw-office.js`, ADR-0035 §4), run in the page with
 * a stand-in `self`: it changes nothing until the package is installed, then isolates the
 * app's page and workers, and serves the package inflated from its cache.
 */
import { afterEach, describe, expect, it } from 'vitest';

import source from '../../public/sw-office.js?raw';
import { OFFICE_CACHE, OFFICE_REFRESH_MESSAGE, STORED_ENCODING_HEADER } from './package';

type Listener = (event: unknown) => void;

interface FakeWorker {
  readonly fetch: (request: Request) => Promise<Response> | undefined;
  readonly refresh: () => Promise<boolean>;
}

const scope = new URL('/sw-office-test/', location.href).href;

async function startWorker({
  settle = true,
  network = (request: Request) => fetch(request),
}: {
  readonly settle?: boolean;
  readonly network?: (request: Request) => Promise<Response>;
} = {}): Promise<FakeWorker> {
  const listeners = new Map<string, Listener>();
  const self = {
    registration: { scope },
    location: { origin: location.origin },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  } as { __rectoOffice?: { read: () => Promise<boolean> } };
  // The script reads `self`; the browser's own caches, Response and streams stand in.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the worker script as shipped
  (new Function('self', 'fetch', source) as (scope: unknown, net: unknown) => void)(self, network);
  if (settle) await self.__rectoOffice?.read();
  return {
    fetch(request) {
      let answer: Promise<Response> | undefined;
      listeners.get('fetch')?.({
        request,
        respondWith: (response: Promise<Response>) => {
          answer = response;
        },
      });
      return answer;
    },
    refresh() {
      const channel = new MessageChannel();
      const answer = new Promise<boolean>((resolve) => {
        channel.port1.onmessage = (event: MessageEvent<{ installed: boolean }>) =>
          resolve(event.data.installed);
      });
      listeners.get('message')?.({
        data: { type: OFFICE_REFRESH_MESSAGE },
        ports: [channel.port2],
        waitUntil: () => undefined,
      });
      return answer;
    },
  };
}

/** A navigation-like request (`mode` and `destination` cannot be set on a page's Request). */
function asNavigation(url: string): Request {
  const request = new Request(url);
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  Object.defineProperty(request, 'destination', { value: 'document' });
  return request;
}

function asWorkerScript(url: string): Request {
  const request = new Request(url);
  Object.defineProperty(request, 'destination', { value: 'worker' });
  return request;
}

async function gzipped(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const OCR_CACHE = 'pdf-editor-ocr';

afterEach(async () => {
  await caches.delete(OFFICE_CACHE);
  await caches.delete(OCR_CACHE);
});

/** The network is off: every fetch fails. */
const offline = () => Promise.reject(new TypeError('Failed to fetch'));

describe('sw-office.js (ADR-0035 §4)', () => {
  it('uses the names the page uses', () => {
    expect(source).toContain(`'${OFFICE_CACHE}'`);
    expect(source).toContain(`'${OFFICE_REFRESH_MESSAGE}'`);
    expect(source).toContain(`'${STORED_ENCODING_HEADER}'`);
  });

  it('leaves the page and its workers to Workbox until the package is installed', async () => {
    const worker = await startWorker();
    expect(worker.fetch(asNavigation(scope))).toBeUndefined();
    expect(worker.fetch(asWorkerScript(`${scope}assets/pdfium.worker-abc.js`))).toBeUndefined();
  });

  it('isolates the app page and its workers once the marker is in, and only those', async () => {
    const worker = await startWorker();
    const cache = await caches.open(OFFICE_CACHE);
    await cache.put(`${scope}convert/installed.json`, new Response('{"directory":"x"}'));
    expect(await worker.refresh()).toBe(true);

    const page = await worker.fetch(asNavigation(`${scope}?office=1`));
    expect(page?.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(page?.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');

    const script = await worker.fetch(asWorkerScript(`${scope}assets/pdfium.worker-abc.js`));
    expect(script?.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');

    // Other pages beside the app (the about page) and ordinary subresources are left alone.
    expect(worker.fetch(asNavigation(`${scope}about/`))).toBeUndefined();
    expect(worker.fetch(new Request(`${scope}assets/app-abc.js`))).toBeUndefined();

    await cache.delete(`${scope}convert/installed.json`);
    expect(await worker.refresh()).toBe(false);
    expect(worker.fetch(asNavigation(scope))).toBeUndefined();
  });

  it('serves a stored package file inflated, with the isolation headers', async () => {
    const worker = await startWorker();
    const cache = await caches.open(OFFICE_CACHE);
    const url = `${scope}convert/lo-test/soffice.data`;
    await cache.put(
      url,
      new Response(await gzipped('LibreOffice data'), {
        headers: { 'Content-Type': 'application/octet-stream', [STORED_ENCODING_HEADER]: 'gzip' },
      }),
    );
    const response = await worker.fetch(new Request(url));
    expect(await response?.text()).toBe('LibreOffice data');
    expect(response?.headers.get(STORED_ENCODING_HEADER)).toBeNull();
    expect(response?.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
  });

  it('holds a worker script until the install read lands, then answers as Workbox would', async () => {
    const cache = await caches.open(OFFICE_CACHE);
    await cache.put(`${scope}convert/installed.json`, new Response('{"directory":"x"}'));
    const worker = await startWorker({ settle: false });
    // Not on the network either way: the precache, else a fetch of the same URL.
    const answer = worker.fetch(
      asWorkerScript(new URL('/sw-office-test/none.js', location.href).href),
    );
    expect(answer).toBeDefined();
    const response = await answer;
    expect(response?.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
  });

  describe('an OCR worker kept only in its runtime cache, offline', () => {
    const ocrWorker = `${scope}ocr/tesseract-7.0.0/worker.min.js`;
    const keepOcrWorker = async () => {
      const cache = await caches.open(OCR_CACHE);
      await cache.put(ocrWorker, new Response('/* tesseract worker */'));
    };

    it('loads without the marker, settled or while the marker is still being read', async () => {
      await keepOcrWorker();
      const settled = await startWorker({ network: offline });
      // Known absent: Workbox serves it from its runtime cache, as before.
      expect(settled.fetch(asWorkerScript(ocrWorker))).toBeUndefined();
      const waking = await startWorker({ settle: false, network: offline });
      const response = await waking.fetch(asWorkerScript(ocrWorker));
      expect(await response?.text()).toBe('/* tesseract worker */');
      expect(response?.headers.get('Cross-Origin-Embedder-Policy')).toBeNull();
    });

    it('loads isolated with the marker', async () => {
      await keepOcrWorker();
      const cache = await caches.open(OFFICE_CACHE);
      await cache.put(`${scope}convert/installed.json`, new Response('{"directory":"x"}'));
      for (const settle of [true, false]) {
        const worker = await startWorker({ settle, network: offline });
        const response = await worker.fetch(asWorkerScript(ocrWorker));
        expect(await response?.text()).toBe('/* tesseract worker */');
        expect(response?.headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
      }
    });
  });

  it('lets the compressed downloads go to the network untouched', async () => {
    const worker = await startWorker();
    expect(worker.fetch(new Request(`${scope}convert/lo-test/soffice.wasm.gz`))).toBeUndefined();
    expect(worker.fetch(new Request(`${scope}convert/pending/0`))).toBeUndefined();
  });
});
