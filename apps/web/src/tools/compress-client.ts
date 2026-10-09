/**
 * The app's compress worker: qpdf (repair, lossless rewrite, check), the compression
 * pipeline and the PDF → images encoder. One long-lived worker, created on first use.
 * This module is only ever imported dynamically, so the worker and both wasm files stay
 * out of the entry chunk (they load when a tool first needs them).
 */
import pdfiumWasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
import CompressWorker from '@pdf-editor/engine/compress.worker?worker';
import qpdfWasmUrl from '@pdf-editor/engine/qpdf.wasm?url';
import type { CompressProxy } from '@pdf-editor/engine';

let shared: Promise<CompressProxy> | undefined;
let pdfiumModule: Promise<WebAssembly.Module | undefined> | undefined;

/**
 * The PDFium worker's compiled wasm (PF-4), handed over by the engine service when the first
 * document opens (pushed rather than imported, so this module stays out of the start-up chunks).
 */
export function sharePdfiumModule(module: Promise<WebAssembly.Module | undefined>): void {
  pdfiumModule = module;
}

export function getCompressor(): Promise<CompressProxy> {
  if (shared === undefined) {
    // The light client entry (PF-2), and the PDFium worker's compiled wasm when this browser
    // can post it, so the image pass skips a second download and compile (PF-4).
    const created = Promise.all([import('@pdf-editor/engine/client'), pdfiumModule]).then(
      ([{ createCompressProxy, postableModule }, module]) => {
        const pdfiumWasm = postableModule(module);
        return createCompressProxy(new CompressWorker({ name: 'recto compress' }), {
          qpdfWasmUrl,
          pdfiumWasmUrl,
          ...(pdfiumWasm === undefined ? {} : { pdfiumWasm }),
        });
      },
    );
    created.catch(() => {
      if (shared === created) shared = undefined;
    });
    shared = created;
  }
  return shared;
}

/** Terminates the worker (tests, teardown). */
export async function disposeCompressor(): Promise<void> {
  const current = shared;
  shared = undefined;
  (await current)?.dispose();
}
