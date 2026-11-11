/**
 * The app-wide hosts of the engine's other workers: signature (M5 spec recognize-and-compare
 * §3, ADR-0013), analysis (§2, §4) and the OCR recognizer (§1.1, ADR-0012). Each starts on
 * first use and ends after an idle window. Split from `engine-service.ts`, which re-exports
 * everything here.
 */
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
// Vite's `?worker` constructor: the worker script is fetched only when one is constructed.
import AnalysisWorker from '@pdf-editor/engine/analysis.worker?worker';
import SignatureWorker from '@pdf-editor/engine/signature.worker?worker';
import type {
  AnalysisProxy,
  OcrPackStore,
  OcrRecognizer,
  SignatureProxy,
} from '@pdf-editor/engine';

import { sharedPdfiumModule } from './engine-startup';

// ---------------------------------------------------------------------------
// Signature worker (M5 spec recognize-and-compare §3, ADR-0013)
// ---------------------------------------------------------------------------

/** The shared signature worker ends after this long without a call (spec §3.2). */
export const SIGNATURE_IDLE_MS = 5 * 60_000;

/** A new signature worker (`@pdf-editor/engine/signature.worker`) behind its proxy. */
export async function createSignatureWorker(): Promise<SignatureProxy> {
  // Constructed first so the worker script loads while the engine chunk does.
  const worker = new SignatureWorker({ name: 'recto signature' });
  try {
    const [{ createSignatureProxy }, pdfiumWasm] = await Promise.all([
      import('@pdf-editor/engine/client'),
      sharedPdfiumModule(),
    ]);
    // The self-hosted PDFium lets the worker compare the signed revision's pages with the
    // file's (spec §3.1 step 6): a page that looks different is never "changed nothing". The
    // PDFium worker's compiled module spares it a second compile (PF-4).
    return createSignatureProxy(worker, {
      pdfiumWasmUrl: wasmUrl,
      ...(pdfiumWasm === undefined ? {} : { pdfiumWasm }),
    });
  } catch (error) {
    worker.terminate();
    throw error;
  }
}

/**
 * The signature worker's lifecycle. Validation on open and "View signed version" share one
 * long-lived worker (`run`), terminated `idleMs` after its last call ends; signing takes a
 * worker of its own (`dedicated`), which the caller terminates right after signing so the
 * imported key goes with it (ADR-0013 §2).
 */
export class SignatureWorkerHost {
  private shared: Promise<SignatureProxy> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private busy = 0;

  constructor(
    private readonly create: () => Promise<SignatureProxy> = createSignatureWorker,
    private readonly idleMs: number = SIGNATURE_IDLE_MS,
  ) {}

  /** True while the shared worker exists (started and not yet terminated). */
  get alive(): boolean {
    return this.shared !== undefined;
  }

  /** Runs `task` on the shared worker, starting it when needed. */
  async run<T>(task: (proxy: SignatureProxy) => Promise<T>): Promise<T> {
    this.busy += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    try {
      if (this.shared === undefined) {
        const created = this.create();
        created.catch(() => {
          if (this.shared === created) this.shared = undefined;
        });
        this.shared = created;
      }
      return await task(await this.shared);
    } finally {
      this.busy -= 1;
      if (this.busy === 0) {
        this.timer = setTimeout(() => {
          this.timer = undefined;
          this.terminate();
        }, this.idleMs);
      }
    }
  }

  /** A worker for one signing; the caller must `terminate()` it when done. */
  dedicated(): Promise<SignatureProxy> {
    return this.create();
  }

  /** Ends the shared worker now (idle timeout, tests). A later `run` starts a new one. */
  terminate(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const current = this.shared;
    this.shared = undefined;
    void current?.then(
      (proxy) => proxy.terminate(),
      () => undefined,
    );
  }
}

let signatureHost: SignatureWorkerHost | undefined;

/** The app-wide signature worker host (the worker itself starts on first use). */
export function getSignatureWorkers(): SignatureWorkerHost {
  signatureHost ??= new SignatureWorkerHost();
  return signatureHost;
}

// ---------------------------------------------------------------------------
// Analysis worker (M5 spec recognize-and-compare §2, §4): compare and convert
// ---------------------------------------------------------------------------

/** The analysis worker ends after this long with no lease held. */
export const ANALYSIS_IDLE_MS = 2 * 60_000;

/** A hold on the analysis worker: it stays alive until every lease is released. */
export interface AnalysisLease {
  readonly proxy: AnalysisProxy;
  /** Idempotent; the worker ends `ANALYSIS_IDLE_MS` after the last lease is released. */
  release(): void;
}

/**
 * The analysis worker (`@pdf-editor/engine/analysis.worker`, pure JS), started on first use
 * and terminated after `idleMs` without a lease. A comparison holds its lease while its
 * result (heat maps) is on screen; a conversion for the length of the run.
 */
export class AnalysisWorkerHost {
  private shared: Promise<AnalysisProxy> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private leases = 0;

  constructor(
    private readonly create: () => Promise<AnalysisProxy> = async () => {
      const worker = new AnalysisWorker({ name: 'recto analysis' });
      try {
        const { createAnalysisProxy } = await import('@pdf-editor/engine');
        return createAnalysisProxy(worker);
      } catch (error) {
        worker.terminate();
        throw error;
      }
    },
    private readonly idleMs: number = ANALYSIS_IDLE_MS,
  ) {}

  get alive(): boolean {
    return this.shared !== undefined;
  }

  async acquire(): Promise<AnalysisLease> {
    this.leases += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.leases -= 1;
      if (this.leases > 0) return;
      this.timer = setTimeout(() => this.terminate(), this.idleMs);
    };
    if (this.shared === undefined) {
      const created = this.create();
      created.catch(() => {
        if (this.shared === created) this.shared = undefined;
      });
      this.shared = created;
    }
    try {
      return { proxy: await this.shared, release };
    } catch (error) {
      release();
      throw error;
    }
  }

  /** Ends the worker now; calls in flight reject with `aborted`. */
  terminate(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    const current = this.shared;
    this.shared = undefined;
    void current?.then(
      (proxy) => proxy.dispose(),
      () => undefined,
    );
  }
}

let analysisHost: AnalysisWorkerHost | undefined;

/** The app-wide analysis worker host (the worker itself starts on first `acquire`). */
export function getAnalysisWorkers(): AnalysisWorkerHost {
  analysisHost ??= new AnalysisWorkerHost();
  return analysisHost;
}

// ---------------------------------------------------------------------------
// OCR recognizer (M5 spec recognize-and-compare §1.1, ADR-0012)
// ---------------------------------------------------------------------------

/** The recognizer pool is disposed this long after the last run released it (spec §1.1). */
export const OCR_RECOGNIZER_IDLE_MS = 60_000;

/** A hold on the recognizer: it stays alive until every lease is released. */
export interface OcrRecognizerLease {
  readonly recognizer: OcrRecognizer;
  /** Idempotent; the pool is disposed `OCR_RECOGNIZER_IDLE_MS` after the last release. */
  release(): void;
}

/** What the host creates on first use: the recognizer and the pack loader it reads from. */
export interface OcrRecognizerParts {
  readonly recognizer: OcrRecognizer;
  readonly packs: OcrPackStore;
}

/** The served `ocr/` directory (ADR-0012 §2): on the app's own origin, under the base path. */
export function ocrBaseUrl(): string {
  return `${import.meta.env.BASE_URL}ocr/`;
}

/**
 * The OCR recognizer's lifecycle. tesseract.js (a lazy chunk) posts pages to its own
 * classic workers, served from our origin; the pool of one or two recognizers is started by
 * the first run and kept `idleMs` after the last lease is released, so a second run right
 * after the first does not start the engine again. The pack loader (`OcrPackStore`) is
 * shared with the language manager, which never starts a recognizer.
 */
export class OcrRecognizerHost {
  private parts: Promise<OcrRecognizerParts> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private leases = 0;

  constructor(
    private readonly create: () => Promise<OcrRecognizerParts> = async () => {
      const { createOcrRecognizer, OcrPackStore } = await import('@pdf-editor/engine/client');
      const packs = new OcrPackStore({ baseUrl: ocrBaseUrl() });
      return { recognizer: createOcrRecognizer({ baseUrl: ocrBaseUrl(), packs }), packs };
    },
    private readonly idleMs: number = OCR_RECOGNIZER_IDLE_MS,
  ) {}

  private load(): Promise<OcrRecognizerParts> {
    if (this.parts === undefined) {
      const created = this.create();
      created.catch(() => {
        if (this.parts === created) this.parts = undefined;
      });
      this.parts = created;
    }
    return this.parts;
  }

  /** The language pack loader (no recognizer is started). */
  async packs(): Promise<OcrPackStore> {
    return (await this.load()).packs;
  }

  /** Whether a lease is held (a run is using the recognizer). */
  get busy(): boolean {
    return this.leases > 0;
  }

  async acquire(): Promise<OcrRecognizerLease> {
    this.leases += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      this.leases -= 1;
      if (this.leases > 0) return;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.dispose();
      }, this.idleMs);
    };
    try {
      return { recognizer: (await this.load()).recognizer, release };
    } catch (error) {
      release();
      throw error;
    }
  }

  /** Terminates the recognizers now (idle timeout, tests); the pack loader stays. */
  dispose(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    void this.parts?.then(
      (parts) => parts.recognizer.dispose(),
      () => undefined,
    );
  }
}

let ocrHost: OcrRecognizerHost | undefined;

/** The app-wide OCR recognizer host (tesseract.js loads on the first run). */
export function getOcrRecognizers(): OcrRecognizerHost {
  ocrHost ??= new OcrRecognizerHost();
  return ocrHost;
}
