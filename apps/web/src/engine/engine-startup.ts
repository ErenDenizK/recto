/**
 * The start-up marks and the PDFium worker's compiled wasm (PF-2, PF-4). Split from
 * `engine-service.ts`, which re-exports `STARTUP_MARKS` and `sharedPdfiumModule`.
 */

/**
 * The start-up marks (docs/plan/v1/PLAN.md W1-g, PF-2 and PF-4; perf-audit.md item 2), as
 * `pdf-editor.startup.<name>` `performance` marks, each recorded once per session: the engine requested (the
 * first open; the wasm download starts here), the PDFium worker configured (its proxy made from
 * the client chunk; the configuration is posted as soon as the wasm is compiled), the wasm
 * compiled and the worker running on it, the document opened, and the first page's bitmap.
 * `e2e/startup.spec.ts` reports them beside the open time.
 */
export const STARTUP_MARKS = [
  'engine-requested',
  'worker-configured',
  'wasm-compiled',
  'document-opened',
  'first-page-bitmap',
] as const;

const marked = new Set<string>();

export function startupMark(name: (typeof STARTUP_MARKS)[number]): void {
  if (marked.has(name) || typeof performance?.mark !== 'function') return;
  marked.add(name);
  try {
    performance.mark(`pdf-editor.startup.${name}`);
  } catch {
    // Timing is best effort.
  }
}

/** The PDFium worker's compiled wasm (PF-4), once the renderer has asked for it. */
let pdfiumModule: Promise<WebAssembly.Module | undefined> | undefined;

/** Records the module the PDFium worker compiles, for `sharedPdfiumModule`. */
export function setPdfiumModule(module: Promise<WebAssembly.Module | undefined>): void {
  pdfiumModule = module;
}

/**
 * The compiled `pdfium.wasm` of the PDFium worker, to hand to the compress and signature workers
 * (PF-4), when this browser can post a module; `undefined` before the first document opens, or
 * where it cannot (the worker then loads the wasm from its URL).
 */
export async function sharedPdfiumModule(): Promise<WebAssembly.Module | undefined> {
  const module = await pdfiumModule;
  if (module === undefined) return undefined;
  const { postableModule } = await import('@pdf-editor/engine/client');
  return postableModule(module);
}
