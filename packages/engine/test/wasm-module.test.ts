/**
 * PF-4 (docs/plan/v1/PLAN.md §3.2; perf-audit.md item 4): `pdfium.wasm` is stream-compiled once
 * per realm, and the PDFium worker's compiled module is handed to the compress and signature
 * workers instead of each downloading and compiling its own. Same bytes, same imports, so the
 * outputs are identical: the checks below compare them byte for byte with the URL path.
 */
import simpleTextUrl from '../../../test/fixtures/simple-text.pdf?url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { commands } from 'vitest/browser';

import qpdfWasmUrl from '../qpdf/dist/qpdf.wasm?url';
import { presetSettings } from '../src/compress/presets';
import { createHostedEngine } from '../src/pdfium/host/hosted-engine';
import { compilePdfiumWasm, postableModule } from '../src/pdfium/wasm-module';
import { createCompressProxy } from '../src/worker/create-compress-proxy';
import { createPdfiumProxy, type PdfiumProxy } from '../src/worker/pdfium-proxy';
import { createSignatureProxy } from '../src/worker/signature-proxy';
import { flateRgbPdf } from './compress-helpers';
import { sid, wasmUrl } from './helpers';

/** A URL that does not serve the wasm: a worker that still works used the shared module. */
const NO_WASM = '/no-such-pdfium.wasm';

const fetchBytes = async (url: string) => (await fetch(url)).arrayBuffer();

function fromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
const signedFixture = async (name: string) =>
  fromBase64(await commands.readFile(`../../test/fixtures/${name}`, 'base64'));

const worker = (path: string) =>
  new Worker(new URL(path, import.meta.url), { type: 'module', name: 'pf-4 test' });

let pdfium: PdfiumProxy;
let shared: WebAssembly.Module;

beforeAll(async () => {
  pdfium = createPdfiumProxy(worker('../src/worker/pdfium.worker.ts'), { wasmUrl });
  const module = await pdfium.compiledWasm();
  expect(module).toBeInstanceOf(WebAssembly.Module);
  shared = module as WebAssembly.Module;
});

afterAll(async () => {
  await pdfium.destroy();
});

describe('compiling pdfium.wasm (PF-4)', () => {
  test('a URL is compiled once per realm', async () => {
    const first = compilePdfiumWasm(wasmUrl);
    expect(compilePdfiumWasm(wasmUrl)).toBe(first);
    const module = await first;
    expect(WebAssembly.Module.exports(module).length).toBeGreaterThan(100);
  });

  test('a compiled module instantiates a working engine, as the URL does', async () => {
    const host = await createHostedEngine({ wasm: await compilePdfiumWasm(wasmUrl) });
    const doc = await host.engine
      .openDocumentBuffer({ id: 'pf4', content: await fetchBytes(simpleTextUrl) })
      .toPromise();
    expect(doc.pageCount).toBe(3);
    await host.engine.closeDocument(doc).toPromise();
  });

  test('the PDFium worker hands out its module, and this browser can post it on', async () => {
    // The worker still serves documents while its module is shared.
    const opened = await pdfium.open(sid('pf4-open'), await fetchBytes(simpleTextUrl));
    expect(opened.pageCount).toBe(3);
    await pdfium.close(sid('pf4-open'));
    expect(postableModule(shared)).toBe(shared);
  });

  test('a download the caller started is compiled here and runs the worker (PF-2)', async () => {
    // The worker's own URL serves nothing: it can only be running on the posted module.
    const early = createPdfiumProxy(worker('../src/worker/pdfium.worker.ts'), {
      wasmUrl: NO_WASM,
      wasmResponse: fetch(wasmUrl),
    });
    // A failed early download falls back to the worker's own fetch of the URL.
    const fallback = createPdfiumProxy(worker('../src/worker/pdfium.worker.ts'), {
      wasmUrl,
      wasmResponse: Promise.reject(new Error('offline')),
    });
    try {
      for (const [proxy, id] of [
        [early, 'pf2-early'],
        [fallback, 'pf2-fallback'],
      ] as const) {
        const opened = await proxy.open(sid(id), await fetchBytes(simpleTextUrl));
        expect(opened.pageCount).toBe(3);
        const render = await proxy.renderPage(sid(id), 0, { scale: 0.25 });
        expect(render.width).toBeGreaterThan(0);
        render.bitmap.close();
      }
    } finally {
      await early.destroy();
      await fallback.destroy();
    }
  });

  test('the compress worker decodes images with the shared module, to the same bytes', async () => {
    const settings = presetSettings('screen');
    const withUrl = createCompressProxy(worker('../src/worker/compress.worker.ts'), {
      qpdfWasmUrl,
      pdfiumWasmUrl: wasmUrl,
    });
    const withModule = createCompressProxy(worker('../src/worker/compress.worker.ts'), {
      qpdfWasmUrl,
      pdfiumWasmUrl: NO_WASM,
      pdfiumWasm: shared,
    });
    try {
      // A 600 dpi photo: the screen preset decodes and downsamples it through PDFium.
      const source = await flateRgbPdf(2400, 1800, 4);
      const a = await withUrl.compress(source.slice(0), settings);
      const b = await withModule.compress(source.slice(0), settings);
      expect(b.images.map((image) => image.action)).toEqual(['downsampled']);
      expect(new Uint8Array(b.bytes)).toEqual(new Uint8Array(a.bytes));
    } finally {
      withUrl.dispose();
      withModule.dispose();
    }
  });

  test('the signature worker compares revisions with the shared module, as with the URL', async () => {
    const withUrl = createSignatureProxy(worker('../src/worker/signature.worker.ts'), {
      pdfiumWasmUrl: wasmUrl,
    });
    const withModule = createSignatureProxy(worker('../src/worker/signature.worker.ts'), {
      pdfiumWasmUrl: NO_WASM,
      pdfiumWasm: shared,
    });
    try {
      const [a] = await withUrl.validateSignatures(await signedFixture('signed-then-changed.pdf'));
      const [b] = await withModule.validateSignatures(
        await signedFixture('signed-then-changed.pdf'),
      );
      expect(b?.visuallyChangedPages).toEqual([0]);
      expect(b?.visuallyChangedPages).toEqual(a?.visuallyChangedPages);
      expect(b?.status).toBe(a?.status);
    } finally {
      withUrl.terminate();
      withModule.terminate();
    }
  });
});
