/**
 * The download manager for the Office conversion package (ADR-0035 §4): download with
 * progress and cancel, check, store, mark installed, remove.
 *
 * - **Download.** Each file of the lock is fetched from the app's origin with the caller's
 *   `AbortSignal`; progress counts body bytes against the lock's expected sizes (so it is one
 *   bar for the whole package, ~79 MB).
 * - **Check.** A file is accepted only when the SHA-256 of what it inflates to (or of itself,
 *   for the small files) equals the lock's, so a damaged transfer, a stale CDN copy or another
 *   build's package is never stored.
 * - **Store.** Cache Storage `pdf-editor-office`, as fetched (compressed), under the name the
 *   converter asks for. A file already stored is not fetched again, so a cancelled or failed
 *   download resumes at the file it stopped in. `navigator.storage.persist()` is asked for once
 *   the package is in, so the browser does not evict it under pressure.
 * - **Installed** when the marker is written, last; entries of an older package are removed
 *   then. The service worker reads the marker to isolate the app (`public/sw-office.js`).
 */
import { refreshServiceWorker } from './isolation';
import { OfficeError } from './office-error';
import {
  markerUrl,
  OFFICE_CACHE,
  OFFICE_LOCK,
  type PackageFile,
  packageFiles,
  STORED_ENCODING_HEADER,
} from './package';

export interface InstallProgress {
  readonly loaded: number;
  readonly total: number;
}

export interface InstallOptions {
  readonly signal?: AbortSignal | undefined;
  readonly onProgress?: ((progress: InstallProgress) => void) | undefined;
  /** The files to install; the lock's by default (tests pass small ones). */
  readonly files?: readonly PackageFile[] | undefined;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function isGzip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/**
 * Throws `corrupt` unless `bytes` (inflated when compressed) match the lock; resolves to
 * whether they arrived compressed. A host may inflate a `.gz` itself (`Content-Encoding:
 * gzip`, as Vite's preview server does), so the gzip magic is sniffed rather than assumed.
 */
export async function checkFile(file: PackageFile, bytes: Uint8Array): Promise<boolean> {
  const compressed = file.gzip && isGzip(bytes);
  let raw: Uint8Array;
  try {
    raw = compressed ? await gunzip(bytes) : bytes;
  } catch (cause) {
    throw new OfficeError('corrupt', `${file.name}: not a gzip stream`, { cause });
  }
  const actual = raw.length === file.bytes ? await sha256Hex(raw) : '';
  if (actual !== file.sha256) {
    throw new OfficeError('corrupt', `${file.name}: ${raw.length} bytes, SHA-256 ${actual}`);
  }
  return compressed;
}

function aborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new OfficeError('aborted', 'The download was cancelled');
}

/** Reads `response`'s body, reporting each chunk; resolves to all of it. */
async function readBody(
  response: Response,
  onChunk: (bytes: number) => void,
  signal: AbortSignal | undefined,
): Promise<Uint8Array> {
  if (response.body === null) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    aborted(signal);
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    onChunk(value.length);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

async function download(
  file: PackageFile,
  signal: AbortSignal | undefined,
  onChunk: (n: number) => void,
) {
  let response: Response;
  try {
    response = await fetch(file.downloadUrl, {
      credentials: 'same-origin',
      cache: 'no-cache',
      ...(signal ? { signal } : {}),
    });
  } catch (cause) {
    aborted(signal);
    throw new OfficeError('network', `${file.name}: ${String(cause)}`, { cause });
  }
  if (response.status === 404) throw new OfficeError('missing', `${file.downloadUrl}: 404`);
  if (!response.ok) throw new OfficeError('network', `${file.downloadUrl}: ${response.status}`);
  try {
    return await readBody(response, onChunk, signal);
  } catch (cause) {
    aborted(signal);
    if (cause instanceof OfficeError) throw cause;
    throw new OfficeError('network', `${file.name}: ${String(cause)}`, { cause });
  }
}

function storedResponse(file: PackageFile, bytes: Uint8Array, compressed: boolean): Response {
  const type = file.name.endsWith('.js')
    ? 'text/javascript'
    : file.name.endsWith('.wasm')
      ? 'application/wasm'
      : file.name.endsWith('.txt')
        ? 'text/plain; charset=utf-8'
        : 'application/octet-stream';
  const headers: Record<string, string> = { 'Content-Type': type };
  if (compressed) headers[STORED_ENCODING_HEADER] = 'gzip';
  else headers['Content-Length'] = String(bytes.length);
  return new Response(bytes as Uint8Array<ArrayBuffer>, { status: 200, headers });
}

async function put(cache: Cache, url: string, response: Response): Promise<void> {
  try {
    await cache.put(url, response);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'QuotaExceededError') {
      throw new OfficeError('quota', `${url}: the device refused to store it`, { cause });
    }
    throw cause;
  }
}

/** Whether this lock's package is installed on the device. */
export async function isPackageInstalled(): Promise<boolean> {
  try {
    const cache = await caches.open(OFFICE_CACHE);
    const marker = await cache.match(markerUrl());
    if (marker === undefined) return false;
    const { directory } = (await marker.json()) as { directory?: unknown };
    return directory === OFFICE_LOCK.directory;
  } catch {
    return false;
  }
}

/**
 * Downloads, checks and stores the package, then writes the marker. Rejects with an
 * `OfficeError` (`aborted` when the signal fired).
 */
export async function installPackage(options: InstallOptions = {}): Promise<void> {
  const { signal, onProgress } = options;
  const cache = await caches.open(OFFICE_CACHE);
  const files = options.files ?? packageFiles();
  const total = files.reduce((sum, file) => sum + file.downloadBytes, 0);
  let loaded = 0;
  const stored = await Promise.all(
    files.map(async (file) => (await cache.match(file.storedUrl)) !== undefined),
  );
  files.forEach((file, i) => {
    if (stored[i] === true) loaded += file.downloadBytes;
  });
  onProgress?.({ loaded, total });
  for (const [i, file] of files.entries()) {
    if (stored[i] === true) continue;
    aborted(signal);
    const before = loaded;
    let received = 0;
    const bytes = await download(file, signal, (n) => {
      // An inflating host sends more than the file's expected size: the bar stops at it.
      received += n;
      loaded = before + Math.min(received, file.downloadBytes);
      onProgress?.({ loaded, total });
    });
    // The bar ends each file on its expected size, whatever the transfer's own was.
    loaded = before + file.downloadBytes;
    // Check and store each file as it arrives, so the large ones are not all held at once.
    const compressed = await checkFile(file, bytes);
    await put(cache, file.storedUrl, storedResponse(file, bytes, compressed));
  }
  aborted(signal);
  // Old packages' files (and any stash left behind) go; this one's stay.
  const keep = new Set(files.map((file) => file.storedUrl));
  const marker = markerUrl();
  for (const request of await cache.keys()) {
    if (!keep.has(request.url) && request.url !== marker) await cache.delete(request);
  }
  await put(
    cache,
    marker,
    new Response(JSON.stringify({ directory: OFFICE_LOCK.directory }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  onProgress?.({ loaded: total, total });
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not granted or not offered: the package may be evicted under pressure and downloads again.
  }
}

/**
 * Removes the package from the device (Settings, phase 2; tests) and tells the service worker,
 * so the app's next load is no longer isolated.
 */
export async function removePackage(): Promise<void> {
  await caches.delete(OFFICE_CACHE);
  await refreshServiceWorker();
}

/**
 * Bytes the installed package takes on the device (Settings, phase 2): the lock's stored size
 * of each file present in the cache (the pinned gzip size when stored compressed, else the
 * file's own), so nothing is read back. Zero when nothing is stored.
 */
export async function packageStoredBytes(): Promise<number> {
  try {
    const cache = await caches.open(OFFICE_CACHE);
    let total = 0;
    for (const file of packageFiles()) {
      const stored = await cache.match(file.storedUrl);
      if (stored === undefined) continue;
      total +=
        stored.headers.get(STORED_ENCODING_HEADER) === 'gzip' ? file.downloadBytes : file.bytes;
    }
    return total;
  } catch {
    return 0;
  }
}
