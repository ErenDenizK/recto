/**
 * Compiling `pdfium.wasm` once (docs/plan/v1/PLAN.md PF-4; perf-audit.md item 4).
 *
 * - **Streaming compile.** `WebAssembly.compileStreaming` compiles while the 4.6 MB download is
 *   still arriving, instead of after it (`fetch → arrayBuffer → init({ wasmBinary })`), and it is
 *   the path on which browsers keep a code cache of the compiled module, so a later session
 *   skips most of the compile. A server that does not send `application/wasm`, or a browser
 *   without streaming, falls back to compiling the downloaded bytes, as before.
 * - **One compile per realm, one module for every worker.** The compiled `WebAssembly.Module` is
 *   cached per URL, and Emscripten instantiates it through its `instantiateWasm` hook
 *   (`initFromModule`). A module is structured-cloneable to dedicated workers: the app compiles
 *   the download it starts with the first open and posts the module to the PDFium worker
 *   (`PdfiumProxyOptions.wasmResponse`, PF-2), and the PDFium worker hands its module on to the
 *   compress and signature workers (`PdfiumProxy.compiledWasm`), which then skip their own
 *   download and compile. `postableModule` checks first that this browser can post one.
 *
 * Same bytes, same imports: the instance is the one `init({ wasmBinary })` made.
 */
import { EngineError } from '../types';

/** `pdfium.wasm` as a URL, its bytes, or an already compiled module. */
export type PdfiumWasm = string | ArrayBuffer | WebAssembly.Module;

const byUrl = new Map<string, Promise<WebAssembly.Module>>();

function absolute(url: string): string {
  const base = (globalThis as { location?: { href: string } }).location?.href;
  return base === undefined ? url : new URL(url, base).href;
}

function compileUrl(url: string): Promise<WebAssembly.Module> {
  return compileResponse(fetch(url));
}

/**
 * Compiles a `pdfium.wasm` download as it arrives: streaming where the browser can and the
 * server sends `application/wasm` (which streaming requires), else from the downloaded bytes.
 * Also for a caller that started the fetch itself (PF-2).
 */
export async function compileResponse(download: Promise<Response>): Promise<WebAssembly.Module> {
  const response = await download;
  if (!response.ok) {
    throw new EngineError('internal', `Could not load pdfium.wasm (HTTP ${response.status})`);
  }
  const type = response.headers.get('content-type') ?? '';
  if (typeof WebAssembly.compileStreaming === 'function' && type.startsWith('application/wasm')) {
    return WebAssembly.compileStreaming(response);
  }
  return WebAssembly.compile(await response.arrayBuffer());
}

/** The compiled module of `wasm`; a URL is fetched and compiled once per realm. */
export function compilePdfiumWasm(wasm: PdfiumWasm): Promise<WebAssembly.Module> {
  if (wasm instanceof WebAssembly.Module) return Promise.resolve(wasm);
  if (typeof wasm !== 'string') return WebAssembly.compile(wasm.slice(0));
  const url = absolute(wasm);
  let found = byUrl.get(url);
  if (!found) {
    found = compileUrl(url);
    found.catch(() => byUrl.delete(url));
    byUrl.set(url, found);
  }
  return found;
}

/**
 * Runs Emscripten's `init` (`@embedpdf/pdfium`, passed in so this module stays light) on the
 * compiled module of `wasm`, through `Module.instantiateWasm` instead of its own fetch and
 * compile. A failed instantiation rejects (Emscripten would wait for it forever).
 */
export async function initFromModule<T>(
  init: (overrides: never) => Promise<T>,
  wasm: PdfiumWasm,
): Promise<T> {
  const module = await compilePdfiumWasm(wasm);
  let fail: (error: unknown) => void = () => undefined;
  const failed = new Promise<never>((_, reject) => {
    fail = reject;
  });
  const overrides = {
    instantiateWasm(
      imports: WebAssembly.Imports,
      receive: (instance: WebAssembly.Instance, module: WebAssembly.Module) => void,
    ): Record<string, never> {
      WebAssembly.instantiate(module, imports).then((instance) => receive(instance, module), fail);
      return {};
    },
  };
  return Promise.race([init(overrides as never), failed]);
}

/**
 * `module` when this browser can post a `WebAssembly.Module` to a worker, else `undefined`
 * (the receiver then loads the wasm from its URL). Checked once, on a local channel.
 */
export function postableModule(
  module: WebAssembly.Module | undefined,
): WebAssembly.Module | undefined {
  if (module === undefined) return undefined;
  postable ??= (() => {
    try {
      const channel = new MessageChannel();
      channel.port1.postMessage(module);
      channel.port1.close();
      channel.port2.close();
      return true;
    } catch {
      return false;
    }
  })();
  return postable ? module : undefined;
}

let postable: boolean | undefined;
