/**
 * The download manager (ADR-0035 §4) with small stand-in files: progress, the SHA-256 check,
 * storage as fetched, the marker, resuming, cancelling and a missing package.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfficeError } from './office-error';
import { markerUrl, OFFICE_CACHE, type PackageFile, STORED_ENCODING_HEADER } from './package';
import { installPackage, isPackageInstalled, sha256Hex } from './package-store';

async function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const base = new URL('/convert/lo-test/', location.href).href;

async function standIns() {
  const script = new TextEncoder().encode('self.soffice = true;');
  const wasm = new Uint8Array(4096).map((_, i) => i % 7);
  const wasmGz = await gzip(wasm);
  const files: PackageFile[] = [
    {
      name: 'soffice.js',
      downloadUrl: `${base}soffice.js`,
      storedUrl: `${base}soffice.js`,
      sha256: await sha256Hex(script),
      bytes: script.length,
      gzip: false,
      downloadBytes: script.length,
    },
    {
      name: 'soffice.wasm',
      downloadUrl: `${base}soffice.wasm.gz`,
      storedUrl: `${base}soffice.wasm`,
      sha256: await sha256Hex(wasm),
      bytes: wasm.length,
      gzip: true,
      downloadBytes: wasmGz.length,
    },
  ];
  const bodies = new Map<string, Uint8Array>([
    [`${base}soffice.js`, script],
    [`${base}soffice.wasm.gz`, wasmGz],
  ]);
  return { files, bodies };
}

function serve(bodies: Map<string, Uint8Array>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = bodies.get(url);
    return Promise.resolve(
      body === undefined
        ? new Response('not found', { status: 404 })
        : new Response(body as Uint8Array<ArrayBuffer>, { status: 200 }),
    );
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  await caches.delete(OFFICE_CACHE);
});

describe('the package download manager (ADR-0035 §4)', () => {
  it('downloads, checks and stores every file as fetched, then marks it installed', async () => {
    const { files, bodies } = await standIns();
    serve(bodies);
    const progress: number[] = [];
    await installPackage({ files, onProgress: ({ loaded }) => progress.push(loaded) });
    const total = files.reduce((sum, file) => sum + file.downloadBytes, 0);
    expect(progress.at(0)).toBe(0);
    expect(progress.at(-1)).toBe(total);

    const cache = await caches.open(OFFICE_CACHE);
    const wasm = await cache.match(`${base}soffice.wasm`);
    expect(wasm?.headers.get(STORED_ENCODING_HEADER)).toBe('gzip');
    expect(wasm?.headers.get('Content-Type')).toBe('application/wasm');
    expect(new Uint8Array((await wasm?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(
      bodies.get(`${base}soffice.wasm.gz`),
    );
    expect(await cache.match(markerUrl())).toBeDefined();
  });

  it('asks for persistent storage without waiting for the answer', async () => {
    // Firefox answers persist() only once its permission prompt is answered, maybe never.
    const { files, bodies } = await standIns();
    serve(bodies);
    const persist = vi
      .spyOn(navigator.storage, 'persist')
      .mockImplementation(() => new Promise<boolean>(() => undefined));
    await installPackage({ files });
    expect(persist).toHaveBeenCalledOnce();
    expect(await isPackageInstalled()).toBe(true);
  });

  it('refuses a file whose content does not match the lock', async () => {
    const { files, bodies } = await standIns();
    bodies.set(`${base}soffice.js`, new TextEncoder().encode('self.tampered = true;'));
    serve(bodies);
    await expect(installPackage({ files })).rejects.toMatchObject({ reason: 'corrupt' });
    expect(await isPackageInstalled()).toBe(false);
  });

  it('accepts a compressed file a host already inflated', async () => {
    const { files, bodies } = await standIns();
    const wasm = new Uint8Array(4096).map((_, i) => i % 7);
    bodies.set(`${base}soffice.wasm.gz`, wasm);
    serve(bodies);
    await installPackage({ files });
    const stored = await (await caches.open(OFFICE_CACHE)).match(`${base}soffice.wasm`);
    expect(stored?.headers.get(STORED_ENCODING_HEADER)).toBeNull();
  });

  it('resumes: a file already stored is not fetched again', async () => {
    const { files, bodies } = await standIns();
    const fetched = serve(bodies);
    await installPackage({ files });
    fetched.mockClear();
    await installPackage({ files });
    expect(fetched).not.toHaveBeenCalled();
  });

  it('says the package is missing when the build has none', async () => {
    const { files } = await standIns();
    serve(new Map());
    const error = await installPackage({ files }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OfficeError);
    expect((error as OfficeError).reason).toBe('missing');
  });

  it('stops when cancelled', async () => {
    const { files, bodies } = await standIns();
    serve(bodies);
    const controller = new AbortController();
    controller.abort();
    await expect(installPackage({ files, signal: controller.signal })).rejects.toMatchObject({
      reason: 'aborted',
    });
  });
});
