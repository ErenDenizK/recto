/**
 * Engine service: the app's single entry point to the PDFium engine (ADR-0002, ADR-0011).
 *
 * - Lazily starts our own PDFium worker (`@pdf-editor/engine/pdfium.worker`, which hosts the
 *   `PdfiumAdapter`) on first use and talks to it through `createPdfiumProxy`, with a
 *   self-hosted wasm URL and font fallback disabled (no CDN; engine README).
 * - Renders through a small priority queue: Read-mode pages > visible thumbnails >
 *   offscreen thumbnails. Requests for the same bitmap share one job; a job is cancelled
 *   (AbortSignal) once every requester has lost interest.
 * - Caches `ImageBitmap`s in a byte-budgeted LRU (`bitmap-cache.ts`).
 * - Never rejects: every public method resolves to an `EngineResult`.
 * - Password-protected files call back into the UI through `setPasswordPrompt`.
 * - Keeps a copy of every open source's original bytes (a Blob, which the browser may page
 *   to disk) because the proxy transfers the buffer to the PDFium worker; export reads it
 *   back with `sourceBytes`. The copy is dropped on `close`.
 * - Page labels and /Lang are read by the assembly worker (`assembler-client.ts`), which
 *   the PDFium worker reaches through this thread as the adapter's inspector.
 *
 * - Clipped repaints (craft spec §5.3 item 9): a change confined to a box (a committed pen
 *   stroke) re-renders only that box, at every cached scale of the page, and composites it
 *   into the cached bitmaps instead of dropping them (`requestClippedRepaint`; the edit path
 *   announces such a change with `noteClippedChange` before its `invalidatePage`).
 *
 * Render timings are recorded in development with `performance.mark`/`measure` only
 * (entries named `render …`, `open …`). The start-up marks (`STARTUP_MARKS`, PF-2) are recorded
 * once per session in every build, so the start-up e2e reads where the open time goes.
 */
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';
// Vite's `?worker` constructor: the worker script is fetched only when one is constructed.
import PdfiumWorker from '@pdf-editor/engine/pdfium.worker?worker';
import {
  createRandomIdGenerator,
  type Rect,
  type Rotation,
  type SourceId,
} from '@pdf-editor/document-model';
import type {
  decideOverflow,
  EngineCallOptions,
  GlyphOutlineSegment,
  layoutParagraph,
  OpenedDocument,
  PdfEditor,
  PdfImageEditor,
  PdfiumProxy,
  PdfOcrLayer,
  PdfRedactor,
  PdfRenderer,
  PdfTextEditor,
  PdfVerifier,
  ParagraphBlock,
  ParagraphEdit,
  ParagraphEditOptions,
  ParagraphEditResult,
  ParagraphLayoutAnalysis,
  ParagraphPreview,
  ParagraphRef,
  SaveOptions,
  SearchHit,
  TextRun,
  VerificationExpectation,
  VerificationResult,
} from '@pdf-editor/engine';

import { endAssembler, getAssembler } from './assembler-client';
import { BitmapCache, type CachedBitmap, bitmapKey, pageKey } from './bitmap-cache';
import {
  clippedRepaintBox,
  intersects,
  MAX_CLIPPED_REPAINTS,
  type PageShape,
  unionRect,
} from './clipped-repaint';
import { CallGate } from './engine-gate';
import type * as Parking from './engine-parking';
import { type EngineResult, fail, ok, toFailure } from './engine-result';
import { setPdfiumModule, startupMark } from './engine-startup';
import {
  type Job,
  RenderQueue,
  type RenderRequest,
  type Subscriber,
  tileAwareKey,
  tileAwarePage,
  tileOf,
} from './render-queue';

// The public surface stays this module's: the pieces split out of it are re-exported here.
export type { CachedBitmap } from './bitmap-cache';
export { clippedRepaintBox, MAX_CLIPPED_REPAINTS } from './clipped-repaint';
export {
  type EngineFailure,
  type EngineFailureCode,
  type EngineResult,
  fail,
  ok,
  toFailure,
} from './engine-result';
export { STARTUP_MARKS, sharedPdfiumModule } from './engine-startup';
export { RENDER_PRIORITY, type RenderRequest } from './render-queue';
export {
  bitmapSide,
  chooseBucket,
  chooseScale,
  exactScale,
  exactScaleKey,
  isCapped,
  MAX_BITMAP_PIXELS,
  READ_BITMAP_PIXELS,
  scaleBucket,
  scaleBucketBelow,
  sheetSize,
} from './render-scale';
export {
  ANALYSIS_IDLE_MS,
  type AnalysisLease,
  AnalysisWorkerHost,
  createSignatureWorker,
  getAnalysisWorkers,
  getOcrRecognizers,
  getSignatureWorkers,
  ocrBaseUrl,
  OCR_RECOGNIZER_IDLE_MS,
  OcrRecognizerHost,
  type OcrRecognizerLease,
  type OcrRecognizerParts,
  SIGNATURE_IDLE_MS,
  SignatureWorkerHost,
} from './worker-hosts';

/** Options of `EngineService.search` (PdfRenderer.search). */
export interface SearchOptions {
  readonly matchCase?: boolean;
  readonly wholeWord?: boolean;
}

/** Text runs kept per page by `getPageText` (a small LRU; evicted on close). */
const TEXT_CACHE_PAGES = 400;

/** A bitmap the service cached, as it was requested (for clipped repaints). */
interface RenderedEntry {
  readonly key: string;
  /** The cache's page identity (`BitmapCache.set`). */
  readonly page: string;
  readonly rotation: Rotation;
  readonly bucket: number;
  readonly clip?: Rect;
  readonly tile?: string;
}

export type PasswordPrompt = (request: {
  readonly fileName: string;
  /** True when a password was already tried and rejected. */
  readonly incorrect: boolean;
}) => Promise<string | null>;

export interface OpenedSource {
  readonly id: SourceId;
  readonly name: string;
  readonly byteLength: number;
  readonly lastModified: number;
  readonly document: OpenedDocument;
}

/** The adapter surface the service needs; tests pass a mock. */
function isEditor(engine: RendererLike): engine is RendererLike & PdfEditor {
  return typeof (engine as Partial<PdfEditor>).createAnnotation === 'function';
}

function isTextEditor(engine: RendererLike): engine is RendererLike & PdfTextEditor {
  const candidate = engine as Partial<PdfTextEditor>;
  return (
    typeof candidate.locateRuns === 'function' &&
    typeof candidate.checkEditability === 'function' &&
    typeof candidate.applyTextEdit === 'function'
  );
}

function isImageEditor(engine: RendererLike): engine is RendererLike & PdfImageEditor {
  const candidate = engine as Partial<PdfImageEditor>;
  return (
    typeof candidate.locateImages === 'function' &&
    typeof candidate.extractImage === 'function' &&
    typeof candidate.transformImage === 'function' &&
    typeof candidate.removeImage === 'function' &&
    typeof candidate.replaceImage === 'function'
  );
}

export type RendererLike = Pick<PdfRenderer, 'open' | 'close' | 'renderPage' | 'getPageText'> &
  Partial<Pick<PdfRenderer, 'search'>> &
  Partial<Pick<PdfEditor, 'save'>> &
  Partial<PdfVerifier> & {
    destroy?: () => Promise<void>;
  };

export interface EngineServiceOptions {
  /** Called once, on first use; may load the adapter lazily. */
  readonly createRenderer: () => RendererLike | Promise<RendererLike>;
  readonly cacheBudgetBytes?: number;
  /** Render jobs in flight at once. PDFium has one worker; 2 keeps it busy. */
  readonly concurrency?: number;
  readonly newSourceId?: () => SourceId;
  /**
   * Gate the renderer's non-render calls behind Read-mode page renders (engine-gate.ts, PF-24).
   * Off by default, so a test double sees its calls at once; the app's service turns it on.
   */
  readonly gateCalls?: boolean;
  /** Record `performance` marks for renders (defaults to dev builds). */
  readonly timings?: boolean;
  /**
   * The engine worker ends this long after the last source closed or was parked, and starts
   * again on the next use (PF-18). Defaults to `WORKER_IDLE_MS`.
   */
  readonly idleMs?: number;
}

/** How long the engine worker lives with no source open (PF-18). */
export const WORKER_IDLE_MS = 10_000;

/** How long a pre-warmed worker (`prewarm`, PF-24) is kept for a first open before PF-18 ends it. */
export const PREWARM_HOLD_MS = 45_000;

type ParkingModule = typeof Parking;

let parkingLoaded: Promise<ParkingModule> | undefined;

/** The lazy module with parking, reopening and the idle end of the worker (PF-18). */
function parkingModule(): Promise<ParkingModule> {
  parkingLoaded ??= import('./engine-parking');
  return parkingLoaded;
}

export class EngineService {
  /** @internal engine-parking.ts */
  renderer: Promise<RendererLike> | undefined;
  private readonly createRenderer: () => RendererLike | Promise<RendererLike>;
  private readonly cache: BitmapCache;
  private readonly newSourceId: () => SourceId;
  private readonly timings: boolean;
  private readonly queue: RenderQueue;
  private readonly gate: CallGate | undefined;
  /** Sources the service opened: the user's documents, whose calls the gate never holds. */
  private readonly userSources = new Set<string>();
  /** Original bytes of every open source (see the module comment). */
  /** @internal engine-parking.ts */
  readonly retained = new Map<SourceId, Blob>();
  /** The password that opened an encrypted source (diagnostics read the original bytes). */
  /** @internal engine-parking.ts */
  readonly passwords = new Map<SourceId, string>();
  /** Memoized text runs per `${sourceId}:${index}` (insertion order = LRU order). */
  /** @internal engine-parking.ts */
  readonly texts = new Map<string, Promise<EngineResult<readonly TextRun[]>>>();
  /** CropBox per page of every open source, when the engine reports it. */
  /** @internal engine-parking.ts */
  readonly cropBoxes = new Map<SourceId, readonly (Rect | undefined)[]>();
  /** Render jobs running now (`canEnd`). @internal engine-parking.ts */
  get running(): number {
    return this.queue.running;
  }
  private passwordPrompt: PasswordPrompt | undefined;
  /** Content revision per `${sourceId}:${index}`, bumped by `invalidatePage`. */
  private readonly revisions = new Map<string, number>();
  private readonly revisionListeners = new Set<() => void>();
  private readonly closeListeners = new Set<(sourceId: SourceId) => void>();
  /** Per `${sourceId}:${index}`: the box the next `invalidatePage` changes (`noteClippedChange`). */
  private readonly clipNotes = new Map<string, Rect>();
  /** Per `${sourceId}:${index}`: the bitmaps this service cached for it, oldest first. */
  private readonly rendered = new Map<string, Map<string, RenderedEntry>>();
  /** Per `${sourceId}:${index}`: the clipped repaint running (one page's run in order). */
  private readonly repaints = new Map<string, Promise<void>>();
  /** Cache keys being repainted: `peek` misses them and `renderPage` waits for them. */
  private readonly repainting = new Map<string, Promise<void>>();
  /** Per `${sourceId}:${index}`: bumped by a full `invalidatePage` (a repaint then stops). */
  private readonly generations = new Map<string, number>();
  /** Page shapes of every open source (clipped repaints map user space to bitmap pixels). */
  /** @internal engine-parking.ts */
  readonly shapes = new Map<SourceId, readonly PageShape[]>();
  /** Sources open in the engine worker now (not parked, not closed). */
  /** @internal engine-parking.ts */
  readonly openSources = new Set<SourceId>();
  /**
   * Sources of closed documents that undo can bring back (PF-18): closed in the worker, with
   * their original bytes (`retained`), password, page facts and edits kept; `ensureOpen`
   * opens them again from those bytes.
   */
  /** @internal engine-parking.ts */
  readonly parked = new Set<SourceId>();
  /** @internal engine-parking.ts */
  readonly parking = new Map<SourceId, Promise<void>>();
  /** @internal engine-parking.ts */
  readonly reopening = new Map<SourceId, Promise<EngineResult<void>>>();
  /** @internal engine-parking.ts */
  opening = 0;
  /** @internal engine-parking.ts */
  holds = 0;
  /** @internal engine-parking.ts */
  lastUse = 0;
  /** @internal engine-parking.ts */
  idleTimer: ReturnType<typeof setTimeout> | undefined;
  /** @internal engine-parking.ts */
  readonly idleMs: number;
  /** @internal engine-parking.ts */
  readonly parkListeners = new Set<(sourceId: SourceId) => void>();
  /** @internal engine-parking.ts */
  readonly workerEndListeners = new Set<() => void>();

  constructor(options: EngineServiceOptions) {
    this.createRenderer = options.createRenderer;
    this.cache = new BitmapCache(options.cacheBudgetBytes);
    this.gate = options.gateCalls
      ? new CallGate({
          visibleSources: () => this.queue.visibleSources(),
          renderSources: () => this.queue.renderSources(),
          foreground: (source) => this.userSources.has(source),
        })
      : undefined;
    this.queue = new RenderQueue(
      Math.max(1, options.concurrency ?? 2),
      (job) => this.run(job),
      () => this.gate?.poke(),
    );
    this.idleMs = options.idleMs ?? WORKER_IDLE_MS;
    const ids = createRandomIdGenerator();
    this.newSourceId = options.newSourceId ?? (() => ids.source());
    this.timings =
      options.timings ?? (import.meta.env.DEV && typeof performance.mark === 'function');
  }

  /** The adapter, created on first use. A failed creation is retried on the next call. */
  /** @internal engine-parking.ts */
  engine(): Promise<RendererLike> {
    this.lastUse = Date.now();
    if (this.renderer === undefined) {
      const created = Promise.resolve()
        .then(() => this.createRenderer())
        .then((renderer) => this.gate?.wrap(renderer) ?? renderer);
      created.catch(() => {
        if (this.renderer === created) this.renderer = undefined;
      });
      this.renderer = created;
      this.armIdle();
    }
    return this.renderer;
  }

  /**
   * Starts the worker ahead of the first open (PF-24): its script, the wasm fetch and compile,
   * the instantiate. It is kept `PREWARM_HOLD_MS`, then PF-18's idle end applies as for any
   * worker with nothing open. A no-op while a worker is running.
   */
  prewarm(): void {
    if (this.renderer !== undefined) return;
    const release = this.hold();
    void this.engine().then(() => {
      setTimeout(release, PREWARM_HOLD_MS);
    }, release);
  }

  /** Called when the worker ended for idleness: holders of its proxies drop them. */
  onWorkerEnded(listener: () => void): () => void {
    this.workerEndListeners.add(listener);
    return () => this.workerEndListeners.delete(listener);
  }

  /** Called when a source is parked: its engine document is gone, its engine edits with it. */
  onSourceParked(listener: (sourceId: SourceId) => void): () => void {
    this.parkListeners.add(listener);
    return () => this.parkListeners.delete(listener);
  }

  /** Whether the source is parked (closed in the worker, kept for undo). */
  isParked(sourceId: SourceId): boolean {
    return this.parked.has(sourceId);
  }

  /**
   * Ends the worker once nothing is open in it, `idleMs` after the last use (PF-18): a wasm
   * heap never shrinks while its worker lives. The next use starts a new one (PF-4's shared
   * module keeps that cheap). The timer lives in the lazy `engine-parking` module, loaded only
   * once there is nothing open to wait for.
   */
  /** @internal engine-parking.ts */
  armIdle(): void {
    if (this.idleTimer !== undefined) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
    if (this.renderer === undefined || !this.canEnd()) return;
    void parkingModule().then((m) => m.scheduleEnd(this));
  }

  /**
   * A lease that keeps the worker alive while work that no open source shows runs through it
   * (a batch with its private sources and password prompts, a tool's scratch document, a save
   * or a verify, PF-18). Call the returned function once when the work is done.
   */
  hold(): () => void {
    this.holds += 1;
    this.lastUse = Date.now();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds -= 1;
      this.lastUse = Date.now();
      this.armIdle();
    };
  }

  /** @internal engine-parking.ts */
  canEnd(): boolean {
    return (
      this.openSources.size === 0 &&
      this.opening === 0 &&
      this.holds === 0 &&
      this.reopening.size === 0 &&
      this.parking.size === 0 &&
      this.running === 0
    );
  }

  /**
   * Parks a source of a closed document: closes it in the engine and frees its bitmaps, but
   * keeps its original bytes, password and page facts so undo can open it again
   * (`ensureOpen`, PF-18). The edit runner forgets what it applied to it. The work is in the
   * lazy `engine-parking` module: only closing a document needs it.
   */
  park(sourceId: SourceId): Promise<void> {
    if (!this.retained.has(sourceId) || this.parked.has(sourceId)) return Promise.resolve();
    return parkingModule().then((m) => m.park(this, sourceId));
  }

  /**
   * Opens a parked source again from its kept bytes (a no-op for any other source), once
   * however many callers wait. Renders, text reads and the edit runner's replay call this
   * before they use a source; with nothing parked or parking it answers at once.
   */
  ensureOpen(sourceId: SourceId): Promise<EngineResult<void>> {
    if (this.parked.size === 0 && this.parking.size === 0) return Promise.resolve(ok(undefined));
    return parkingModule().then((m) => m.ensureOpen(this, sourceId));
  }

  /**
   * The content editor (annotations, forms, redaction) behind the same adapter. Features
   * that edit sources go through this rather than reaching for the adapter directly, so
   * the service keeps a single instance and one lifecycle.
   */
  async editor(): Promise<PdfEditor> {
    const engine = await this.engine();
    if (!isEditor(engine)) throw new Error('The rendering engine has no content editor');
    return engine;
  }

  /**
   * The text editor (M4, spec redaction-and-text-editing §2) behind the same adapter: the
   * PDFium worker's `PdfTextEditor`, reached through the proxy. Text edits that change the
   * document go through the edit runner (annotations/edit-runner.ts); this accessor is for
   * locating runs and checking editability.
   */
  async textEditor(): Promise<PdfTextEditor> {
    const engine = await this.engine();
    if (!isTextEditor(engine)) throw new Error('The rendering engine has no text editor');
    return engine;
  }

  // -------------------------------------------------------------------------
  // Paragraph editing (craft spec §4, ADR-0020): the worker's `PdfParagraphEditor`. Reads
  // run at the lower raw-task priority; a committed edit goes through the edit runner
  // (`text.editParagraph`, text-edit/actions.ts), the dry run and its preview come here.
  // -------------------------------------------------------------------------

  /** The page's detected paragraphs (cached by the engine per page state). */
  async analyzeParagraphs(
    source: SourceId,
    pageIndex: number,
    options?: EngineCallOptions,
  ): Promise<readonly ParagraphBlock[]> {
    return (await this.textEditor()).analyzeParagraphs(source, pageIndex, options);
  }

  /** What the editor lays keystrokes out with: the layout input, overflow facts, styles. */
  async analyzeParagraphLayout(
    ref: ParagraphRef,
    options?: EngineCallOptions,
  ): Promise<ParagraphLayoutAnalysis> {
    return (await this.textEditor()).analyzeParagraphLayout(ref, options);
  }

  /** Em-unit outlines of `chars` in the page's font `fontId` (the editor's canvas). */
  async glyphPaths(
    source: SourceId,
    pageIndex: number,
    fontId: number,
    chars: readonly string[],
    options?: EngineCallOptions,
  ): Promise<Readonly<Record<string, readonly GlyphOutlineSegment[] | null>>> {
    return (await this.textEditor()).glyphPaths(source, pageIndex, fontId, chars, options);
  }

  /** A dry run (`commit: false`) of a paragraph edit; commits go through the edit runner. */
  async applyParagraphEdit(
    source: SourceId,
    pageIndex: number,
    edit: ParagraphEdit,
    options: ParagraphEditOptions,
  ): Promise<ParagraphEditResult> {
    return (await this.textEditor()).applyParagraphEdit(source, pageIndex, edit, options);
  }

  /** The dry run's paragraph area rendered at `scale` (device pixels per point). */
  async renderParagraphPreview(
    source: SourceId,
    pageIndex: number,
    edit: ParagraphEdit,
    scale: number,
    options?: EngineCallOptions,
  ): Promise<ParagraphPreview> {
    return (await this.textEditor()).renderParagraphPreview(
      source,
      pageIndex,
      edit,
      scale,
      options,
    );
  }

  /**
   * The pure paragraph layout (`layoutParagraph`, `decideOverflow`) for the main thread: the
   * editor re-lays the paragraph on every keystroke without a worker round trip (spec §4.8).
   * Loaded with the engine chunk.
   */
  async paragraphLayout(): Promise<{
    readonly layoutParagraph: typeof layoutParagraph;
    readonly decideOverflow: typeof decideOverflow;
  }> {
    const engine = await import('@pdf-editor/engine');
    return { layoutParagraph: engine.layoutParagraph, decideOverflow: engine.decideOverflow };
  }

  /**
   * The image-object editor (M4 §3) behind the same adapter: the PDFium worker's
   * `PdfImageEditor`, reached through the proxy. Image edits that change the document go
   * through the edit runner (`image.*` edits, image-objects/actions.ts); this accessor is for
   * locating and extracting images.
   */
  async imageEditor(): Promise<PdfImageEditor> {
    const engine = await this.engine();
    if (!isImageEditor(engine)) throw new Error('The rendering engine has no image editor');
    return engine;
  }

  /**
   * Redaction in the PDFium worker (`PdfRedactor`, ADR-0011 §3). Applying goes through the
   * edit runner (`redaction.apply` edits, redaction/apply.ts); the export uses this for its
   * self-check on the final bytes (`verifyRedactedOutput`).
   */
  async redactor(): Promise<PdfRedactor> {
    const engine = await this.engine();
    const candidate = engine as Partial<PdfRedactor>;
    if (
      typeof candidate.applyRedactionPlan !== 'function' ||
      typeof candidate.verifyRedactedOutput !== 'function'
    ) {
      throw new Error('The rendering engine cannot redact');
    }
    return engine as RendererLike & PdfRedactor;
  }

  /**
   * OCR in the PDFium worker (`PdfOcrLayer`, spec recognize-and-compare §1.2, §1.4): page
   * facts and greyscale rasters for the recognizer. Writing the layer goes through the edit
   * runner (`ocr.apply` edits, ocr/ocr-run.ts).
   */
  async ocrLayer(): Promise<PdfOcrLayer> {
    const engine = await this.engine();
    const candidate = engine as Partial<PdfOcrLayer>;
    if (
      typeof candidate.ocrPageFacts !== 'function' ||
      typeof candidate.renderForOcr !== 'function' ||
      typeof candidate.applyOcrLayer !== 'function'
    ) {
      throw new Error('The rendering engine cannot recognize text');
    }
    return engine as RendererLike & PdfOcrLayer;
  }

  /** The UI registers how to ask for a password; without one, locked files fail. */
  setPasswordPrompt(prompt: PasswordPrompt | undefined): void {
    this.passwordPrompt = prompt;
  }

  // -------------------------------------------------------------------------
  // Documents
  // -------------------------------------------------------------------------

  /**
   * Opens a file. On `password-required` / `password-incorrect` it asks the registered
   * prompt (again after a wrong password) until the file opens or the user cancels.
   */
  async open(
    file: File,
    password?: string,
    sourceId?: SourceId,
  ): Promise<EngineResult<OpenedSource>> {
    this.opening += 1;
    try {
      return await this.openFile(file, password, sourceId);
    } finally {
      this.opening -= 1;
      this.armIdle();
    }
  }

  private async openFile(
    file: File,
    password?: string,
    /**
     * Opens under this id instead of a new one: a session restore (session/restore.ts)
     * reopens a kept source under the id its snapshot's model and edits refer to.
     */
    sourceId?: SourceId,
  ): Promise<EngineResult<OpenedSource>> {
    const id = sourceId ?? this.newSourceId();
    // The user's document from here on (kept for undo's reopen, so never removed: ids are small).
    this.userSources.add(id);
    let attempt = password;
    let tries = 0;
    for (;;) {
      let bytes: ArrayBuffer;
      try {
        // Read per attempt: the adapter transfers the buffer to its worker.
        bytes = await file.arrayBuffer();
      } catch (error) {
        return fail('read-failed', `Could not read ${file.name}: ${toFailure(error).message}`);
      }
      const started = this.mark(`open-start:${id}`);
      // Copy before the adapter detaches the buffer.
      const retained = new Blob([bytes], { type: 'application/pdf' });
      try {
        const document = await (await this.engine()).open(
          id,
          bytes,
          attempt === undefined ? {} : { password: attempt },
        );
        this.retained.set(id, retained);
        this.openSources.add(id);
        if (attempt !== undefined) this.passwords.set(id, attempt);
        this.cropBoxes.set(id, readCropBoxes(document));
        this.shapes.set(id, readShapes(document));
        this.measure(`open ${file.name}`, started);
        startupMark('document-opened');
        return ok({
          id,
          name: file.name,
          byteLength: file.size,
          lastModified: file.lastModified,
          document,
        });
      } catch (error) {
        const failure = toFailure(error);
        const locked =
          failure.code === 'password-required' || failure.code === 'password-incorrect';
        if (!locked || this.passwordPrompt === undefined) return { ok: false, error: failure };
        let answer: string | null;
        try {
          answer = await this.passwordPrompt({ fileName: file.name, incorrect: tries > 0 });
        } catch {
          answer = null;
        }
        if (answer === null) {
          return fail('password-cancelled', `${file.name} needs a password; skipped`);
        }
        attempt = answer;
        tries += 1;
      }
    }
  }

  /**
   * Cancels a source's pending renders and drops its cached bitmaps; `close` does so for good,
   * `park` while undo can still bring the document back (PF-18).
   * @internal engine-parking.ts
   */
  dropRendering(sourceId: SourceId, reason: string): void {
    const prefix = `${sourceId}:`;
    for (const job of [...this.queue.jobs.values()]) {
      if (!job.key.startsWith(prefix)) continue;
      job.sourceClosed = true;
      this.queue.cancel(job, reason);
    }
    this.cache.removeSource(sourceId);
    this.forgetRendered(prefix);
  }

  /** Closes a source in the engine and drops its cached bitmaps and pending renders. */
  async close(sourceId: SourceId): Promise<EngineResult<void>> {
    const prefix = `${sourceId}:`;
    this.dropRendering(sourceId, 'Source closed');
    this.retained.delete(sourceId);
    this.passwords.delete(sourceId);
    this.cropBoxes.delete(sourceId);
    this.shapes.delete(sourceId);
    for (const key of [...this.texts.keys()]) {
      if (key.startsWith(prefix)) this.texts.delete(key);
    }
    for (const key of [...this.revisions.keys()]) {
      if (key.startsWith(prefix)) this.revisions.delete(key);
    }
    // Synchronous up to here, listeners included: views and the edit runner forget the source
    // at once (a content revision read right after `close` already differs).
    const wasParked = this.parked.delete(sourceId);
    this.openSources.delete(sourceId);
    for (const listener of this.closeListeners) listener(sourceId);
    await this.parking.get(sourceId);
    await this.reopening.get(sourceId);
    if (this.renderer === undefined || wasParked) {
      this.armIdle();
      return ok(undefined);
    }
    try {
      await (await this.renderer).close(sourceId);
      this.armIdle();
      return ok(undefined);
    } catch (error) {
      return { ok: false, error: toFailure(error) };
    }
  }

  /**
   * Opens a source's original bytes again in the engine, under the same id, dropping every
   * engine edit made to it (undo of edits without an inverse, such as text edits: spec
   * redaction-and-text-editing §2.5). Cached bitmaps and text of the source are dropped,
   * renders in flight are discarded and every page's revision bumps, so mounted views
   * render again. Close listeners are not called: the source stays open. The caller replays
   * the edits that should remain.
   */
  async reopenSource(sourceId: SourceId): Promise<EngineResult<void>> {
    // A parked source has no engine document to drop: opening it is the reopen.
    if (this.parked.has(sourceId)) return this.ensureOpen(sourceId);
    const blob = this.retained.get(sourceId);
    if (blob === undefined) return fail('internal', `Source ${sourceId} is not open`);
    let bytes: ArrayBuffer;
    try {
      bytes = await blob.arrayBuffer();
    } catch (error) {
      return fail('read-failed', `Could not read the kept copy: ${toFailure(error).message}`);
    }
    const password = this.passwords.get(sourceId);
    const prefix = `${sourceId}:`;
    try {
      const engine = await this.engine();
      await engine.close(sourceId);
      await engine.open(sourceId, bytes, password === undefined ? {} : { password });
    } catch (error) {
      return { ok: false, error: toFailure(error) };
    } finally {
      for (const job of [...this.queue.jobs.values()]) {
        if (!job.key.startsWith(prefix)) continue;
        if (!job.running) {
          this.queue.cancel(job, 'Source reopened');
          continue;
        }
        job.stale = true;
        if (this.queue.jobs.get(job.key) === job) this.queue.jobs.delete(job.key);
      }
      this.cache.removeSource(sourceId);
      this.forgetRendered(prefix);
      for (const key of [...this.texts.keys()]) {
        if (key.startsWith(prefix)) this.texts.delete(key);
      }
      const pages = this.cropBoxes.get(sourceId)?.length ?? 0;
      for (let index = 0; index < pages; index++) {
        const key = `${sourceId}:${index}`;
        this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
      }
      for (let index = 0; index < pages; index++) {
        const key = `${sourceId}:${index}`;
        this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
      }
      for (const listener of this.revisionListeners) listener();
    }
    return ok(undefined);
  }

  /** The password a source was opened with, if one was needed (kept in memory only). */
  sourcePassword(sourceId: SourceId): string | undefined {
    return this.passwords.get(sourceId);
  }

  /** A fresh copy of a source's original bytes (the caller may transfer it). */
  async sourceBytes(sourceId: SourceId): Promise<EngineResult<ArrayBuffer>> {
    const blob = this.retained.get(sourceId);
    if (blob === undefined) return fail('internal', `Source ${sourceId} is not open`);
    try {
      return ok(await blob.arrayBuffer());
    } catch (error) {
      return fail('read-failed', `Could not read the kept copy: ${toFailure(error).message}`);
    }
  }

  /** Serializes a source through the engine (edits applied, e.g. decrypted). */
  async saveSource(
    sourceId: SourceId,
    options: SaveOptions = {},
  ): Promise<EngineResult<ArrayBuffer>> {
    const release = this.hold();
    try {
      const engine = await this.engine();
      if (!engine.save) return fail('unsupported', 'The engine cannot save sources');
      return ok(await engine.save(sourceId, options));
    } catch (error) {
      return { ok: false, error: toFailure(error) };
    } finally {
      release();
    }
  }

  /** Re-opens `bytes` in PDFium and checks them against `expectation` (export step 5). */
  async verify(
    bytes: ArrayBuffer,
    expectation: VerificationExpectation,
    signal?: AbortSignal,
  ): Promise<EngineResult<VerificationResult>> {
    const release = this.hold();
    try {
      const engine = await this.engine();
      if (!engine.verify) return fail('unsupported', 'The engine cannot verify output');
      return ok(await engine.verify(bytes, expectation, signal === undefined ? {} : { signal }));
    } catch (error) {
      return { ok: false, error: toFailure(error) };
    } finally {
      release();
    }
  }

  /**
   * Text runs of a page, memoized per source page (dropped by `invalidatePageText` after a
   * text edit, and by `reopenSource`).
   * `signal` only abandons this caller's wait: the extraction still completes and is kept
   * for the next request. Failures are not cached.
   */
  getPageText(
    sourceId: SourceId,
    index: number,
    signal?: AbortSignal,
  ): Promise<EngineResult<readonly TextRun[]>> {
    const key = `${sourceId}:${index}`;
    let pending = this.texts.get(key);
    if (pending === undefined) {
      pending = this.extractText(sourceId, index);
      const stored = pending;
      this.texts.set(key, stored);
      void stored.then((result) => {
        if (!result.ok && this.texts.get(key) === stored) this.texts.delete(key);
      });
      while (this.texts.size > TEXT_CACHE_PAGES) {
        const oldest = this.texts.keys().next().value;
        if (oldest === undefined) break;
        this.texts.delete(oldest);
      }
    } else {
      // Mark recently used.
      this.texts.delete(key);
      this.texts.set(key, pending);
    }
    if (signal === undefined) return pending;
    if (signal.aborted) return Promise.resolve(fail('aborted', 'Text request aborted'));
    const shared = pending;
    return new Promise((resolve) => {
      const onAbort = () => resolve(fail('aborted', 'Text request aborted'));
      signal.addEventListener('abort', onAbort, { once: true });
      void shared.then((result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      });
    });
  }

  private async extractText(
    sourceId: SourceId,
    index: number,
  ): Promise<EngineResult<readonly TextRun[]>> {
    try {
      const reopened = await this.ensureOpen(sourceId);
      if (!reopened.ok) return reopened;
      return ok(await (await this.engine()).getPageText(sourceId, index));
    } catch (error) {
      return { ok: false, error: toFailure(error) };
    }
  }

  /**
   * The CropBox of a source page in unrotated user space, when the engine reports it
   * (`OpenedDocument.pages[i].cropBox`). Engine geometry (glyphs, hits, links, `clip`) is
   * absolute user space, so viewers subtract its lower-left corner; undefined means (0, 0).
   */
  pageCropBox(sourceId: SourceId, index: number): Rect | undefined {
    return this.cropBoxes.get(sourceId)?.[index];
  }

  /**
   * Searches one source in the engine worker. `onHits` receives hits as the engine reports
   * them page by page (when it streams); the resolved value is always the complete list.
   */
  async search(
    sourceId: SourceId,
    query: string,
    options: SearchOptions = {},
    signal?: AbortSignal,
    onHits?: (hits: readonly SearchHit[], pageIndex: number) => void,
  ): Promise<EngineResult<readonly SearchHit[]>> {
    try {
      const reopened = await this.ensureOpen(sourceId);
      if (!reopened.ok) return reopened;
      const engine = await this.engine();
      if (!engine.search) return fail('unsupported', 'The engine cannot search');
      if (signal?.aborted) return fail('aborted', 'Search aborted');
      const callOptions: Parameters<PdfRenderer['search']>[2] = {
        ...(options.matchCase ? { matchCase: true } : {}),
        ...(options.wholeWord ? { wholeWord: true } : {}),
        ...(signal === undefined ? {} : { signal }),
        ...(onHits === undefined
          ? {}
          : { onProgress: (hits, pageIndex) => onHits(hits, pageIndex) }),
      };
      const hits = await engine.search(sourceId, query, callOptions);
      if (signal?.aborted) return fail('aborted', 'Search aborted');
      return ok(hits);
    } catch (error) {
      return { ok: false, error: toFailure(error) };
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  /**
   * Drops every cached bitmap of one source page (all rotations and scales) after its
   * content changed in the engine (an annotation edit), discards renders in flight for it,
   * and bumps the page's revision so mounted canvases request a fresh render.
   */
  invalidatePage(sourceId: SourceId, index: number): void {
    const noted = this.clipNotes.get(`${sourceId}:${index}`);
    if (noted !== undefined) {
      this.clipNotes.delete(`${sourceId}:${index}`);
      this.requestClippedRepaint(sourceId, index, noted);
      return;
    }
    const prefix = `${sourceId}:${index}:`;
    this.generations.set(
      `${sourceId}:${index}`,
      (this.generations.get(`${sourceId}:${index}`) ?? 0) + 1,
    );
    this.forgetRendered(prefix);
    this.cache.removePrefix(prefix);
    for (const job of [...this.queue.jobs.values()]) {
      if (!job.key.startsWith(prefix)) continue;
      if (!job.running) {
        // Not started: nothing to wait for. Its requesters resolve as aborted and ask again
        // (PageCanvas re-requests on the revision change below).
        this.queue.cancel(job, 'Page changed');
        continue;
      }
      // Running: let it finish (PDFium cannot stop mid-page) but never cache or share its
      // result; new requests start a fresh job.
      job.stale = true;
      if (this.queue.jobs.get(job.key) === job) this.queue.jobs.delete(job.key);
    }
    const key = `${sourceId}:${index}`;
    this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
    for (const listener of this.revisionListeners) listener();
  }

  /**
   * Announces that the next `invalidatePage` of this page changes only `rect` (user space,
   * with the stroke's width and anti-aliasing margin): that invalidation then repaints the
   * rect into the cached bitmaps (`requestClippedRepaint`) instead of dropping them. Notes on
   * one page before its invalidation are united. The pen burst append notes the new path's box
   * right after its engine edit (craft spec §5.3 item 9).
   */
  noteClippedChange(sourceId: SourceId, index: number, rect: Rect): void {
    const key = `${sourceId}:${index}`;
    const previous = this.clipNotes.get(key);
    this.clipNotes.set(key, previous === undefined ? rect : unionRect(previous, rect));
  }

  /**
   * Repaints only `rectInPage` (user space) of a page whose content changed inside it, at
   * every scale the cache holds: each of the page's most recent whole-page bitmaps (at most
   * `MAX_CLIPPED_REPAINTS`) gets the rect rendered through `renderPage` with `clip`, aligned to
   * its pixels, and composited into a new bitmap in its place; tiles the rect touches are
   * dropped and render again; untouched tiles stay. Renders of the page in flight are
   * discarded (they began before the change). The page's revision bumps at once, as with
   * `invalidatePage`; until a bitmap is patched, `peek` misses it and `renderPage` waits for
   * it, so a view never shows the old pixels as the new revision. Repaints of one page run in
   * order. Full re-renders stay for zoom (another scale) and for every other edit.
   */
  requestClippedRepaint(sourceId: SourceId, index: number, rectInPage: Rect): void {
    const pageId = `${sourceId}:${index}`;
    const prefix = `${pageId}:`;
    for (const job of [...this.queue.jobs.values()]) {
      if (!job.key.startsWith(prefix) || !job.running) continue;
      job.stale = true;
      if (this.queue.jobs.get(job.key) === job) this.queue.jobs.delete(job.key);
    }
    const tracked = this.rendered.get(pageId);
    const pages: RenderedEntry[] = [];
    for (const [key, entry] of tracked ?? []) {
      if (!this.cache.has(key)) {
        tracked?.delete(key);
      } else if (entry.tile === undefined) {
        pages.push(entry);
      } else if (entry.clip === undefined || intersects(entry.clip, rectInPage)) {
        tracked?.delete(key);
        this.cache.remove(key);
      }
    }
    // The most recent scales are patched; older ones go (a full render if shown again).
    const patched = pages.slice(-MAX_CLIPPED_REPAINTS).reverse();
    for (const entry of pages.slice(0, -MAX_CLIPPED_REPAINTS)) {
      tracked?.delete(entry.key);
      this.cache.remove(entry.key);
    }
    const generation = this.generations.get(pageId) ?? 0;
    // The revision this change makes: each patched bitmap is labelled with it.
    const revision = (this.revisions.get(pageId) ?? 0) + 1;
    const waits = patched.map((entry) => {
      let done: (() => void) | undefined;
      const wait = new Promise<void>((resolve) => {
        done = resolve;
      });
      this.repainting.set(entry.key, wait);
      return { entry, wait, done: () => done?.() };
    });
    const run = (this.repaints.get(pageId) ?? Promise.resolve()).then(async () => {
      for (const { entry, wait, done } of waits) {
        try {
          if ((this.generations.get(pageId) ?? 0) === generation) {
            await this.patchBitmap(sourceId, index, entry, rectInPage, generation, revision);
          }
        } finally {
          if (this.repainting.get(entry.key) === wait) this.repainting.delete(entry.key);
          done();
        }
      }
    });
    this.repaints.set(pageId, run);
    void run.finally(() => {
      if (this.repaints.get(pageId) === run) this.repaints.delete(pageId);
    });
    this.revisions.set(pageId, revision);
    for (const listener of this.revisionListeners) listener();
  }

  /**
   * Renders `rect` of one cached bitmap's page at its scale and composites it in its place,
   * labelled with `revision` (the revision of the change it paints).
   */
  private async patchBitmap(
    sourceId: SourceId,
    index: number,
    entry: RenderedEntry,
    rect: Rect,
    generation: number,
    revision: number,
  ): Promise<void> {
    const pageId = `${sourceId}:${index}`;
    const base = this.cache.get(entry.key);
    const shape = this.shapes.get(sourceId)?.[index];
    if (base === undefined || base.bitmap.width === 0) return;
    const box =
      shape === undefined
        ? undefined
        : clippedRepaintBox(shape, entry.rotation, rect, base.width, base.height);
    if (box === undefined) {
      // Nothing of the page's shape is known: render it again whole. The rect misses the
      // page: the bitmap already shows the new revision.
      if (shape === undefined) this.cache.remove(entry.key);
      else this.cache.retag(entry.key, revision);
      return;
    }
    const started = this.mark(`render-start:${entry.key}#clip`);
    let piece: ImageBitmap | undefined;
    try {
      piece = (
        await (
          await this.engine()
        ).renderPage(sourceId, index, {
          scale: entry.bucket,
          rotation: entry.rotation,
          clip: box.clip,
        })
      ).bitmap;
      // The page changed again meanwhile (another edit, a close), or a newer render replaced
      // the bitmap: nothing to patch.
      if (
        this.cache.get(entry.key) !== base ||
        (this.generations.get(pageId) ?? 0) !== generation
      ) {
        return;
      }
      const canvas = new OffscreenCanvas(base.width, base.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D canvas for a clipped repaint');
      ctx.drawImage(base.bitmap, 0, 0);
      ctx.clearRect(box.left, box.top, box.width, box.height);
      ctx.drawImage(piece, box.left, box.top, box.width, box.height);
      this.cache.set(entry.page, { ...base, bitmap: canvas.transferToImageBitmap(), revision });
      this.measure(`render ${entry.key}#clip`, started);
    } catch {
      // A failed piece: the bitmap goes, and the page renders again whole when shown.
      if (this.cache.get(entry.key) === base) this.cache.remove(entry.key);
    } finally {
      piece?.close();
    }
  }

  /** Forgets the bitmaps tracked for clipped repaints under `prefix` (`${source}:` or a page). */
  private forgetRendered(prefix: string): void {
    for (const pageId of [...this.rendered.keys()]) {
      if (`${pageId}:`.startsWith(prefix)) this.rendered.delete(pageId);
    }
    for (const pageId of [...this.clipNotes.keys()]) {
      if (`${pageId}:`.startsWith(prefix)) this.clipNotes.delete(pageId);
    }
  }

  /**
   * Drops the memoized text of one source page after its text changed in the engine (a
   * text edit). Call before `invalidatePage`, whose revision bump makes views read again.
   */
  invalidatePageText(sourceId: SourceId, index: number): void {
    this.texts.delete(`${sourceId}:${index}`);
  }

  /** Content revision of a source page; changes whenever `invalidatePage` runs for it. */
  pageRevision(sourceId: SourceId, index: number): number {
    return this.revisions.get(`${sourceId}:${index}`) ?? 0;
  }

  /**
   * Subscribes to source closes, so features that cache per-source data (annotations,
   * links, edit logs) can drop it. Returns an unsubscribe function.
   */
  onSourceClosed(listener: (sourceId: SourceId) => void): () => void {
    this.closeListeners.add(listener);
    return () => {
      this.closeListeners.delete(listener);
    };
  }

  /** Subscribes to page revision changes (for `useSyncExternalStore`). */
  subscribeRevisions = (listener: () => void): (() => void) => {
    this.revisionListeners.add(listener);
    return () => {
      this.revisionListeners.delete(listener);
    };
  };

  /** A cached bitmap at exactly this scale, if any (marks it recently used). */
  peek(sourceId: SourceId, index: number, rotation: Rotation, bucket: number, bare = false) {
    const key = bare
      ? tileAwareKey(pageKey(sourceId, index, rotation), 'bare', bucket)
      : bitmapKey(sourceId, index, rotation, bucket);
    // Being repainted (`requestClippedRepaint`): the bitmap still shows the old content.
    if (this.repainting.has(key)) return undefined;
    return this.cache.get(key);
  }

  /**
   * The best cached bitmap of a page at or below `bucket` (or above, if nothing below),
   * whether it was rendered at an exact scale or a bucket. Bitmaps being repainted
   * (`requestClippedRepaint`) are passed over, as in `peek`: they still show the content of
   * an older revision. Whatever is returned shows the content of its own `revision`.
   */
  preview(
    sourceId: SourceId,
    index: number,
    rotation: Rotation,
    bucket: number,
    bare = false,
  ): CachedBitmap | undefined {
    const page = pageKey(sourceId, index, rotation);
    return this.cache.best(bare ? tileAwarePage(page, 'bare') : page, bucket, true, (key) =>
      this.repainting.has(key),
    );
  }

  /** Resolves once the call gate has decided the calls made so far (tests). */
  gateDrained(): Promise<void> {
    return this.gate?.drained() ?? Promise.resolve();
  }

  get cacheStats(): { readonly entries: number; readonly bytes: number; readonly budget: number } {
    return {
      entries: this.cache.size,
      bytes: this.cache.usedBytes,
      budget: this.cache.budgetBytes,
    };
  }

  /** Jobs queued or running; for tests and diagnostics. */
  get pendingJobs(): number {
    return this.queue.jobs.size;
  }

  renderPage(request: RenderRequest): Promise<EngineResult<CachedBitmap>> {
    const { sourceId, index, rotation, bucket, signal } = request;
    const tile = tileOf(request);
    const key = tileAwareKey(pageKey(sourceId, index, rotation), tile, bucket);
    const repainting = this.repainting.get(key);
    if (repainting !== undefined) return repainting.then(() => this.renderPage(request));
    const hit = this.cache.get(key);
    if (hit !== undefined) return Promise.resolve(ok(hit));
    if (signal?.aborted) return Promise.resolve(fail('aborted', 'Render aborted'));

    return new Promise((resolve) => {
      const job = this.queue.job(
        key,
        tileAwarePage(pageKey(sourceId, index, rotation), tile),
        request,
      );
      const subscriber: Subscriber = { priority: request.priority, resolve };
      job.subscribers.add(subscriber);
      signal?.addEventListener(
        'abort',
        () => {
          if (!job.subscribers.delete(subscriber)) return;
          resolve(fail('aborted', 'Render aborted'));
          if (job.subscribers.size === 0) this.queue.cancel(job, 'No longer needed');
        },
        { once: true },
      );
      this.queue.pump();
    });
  }

  private async run(job: Job): Promise<void> {
    const { sourceId, index, rotation, bucket, clip, bare } = job.request;
    const started = this.mark(`render-start:${job.key}`);
    // The content this render shows: any change after this point marks the job stale
    // (`invalidatePage`, `requestClippedRepaint`), and a stale result is never handed out.
    const revision = this.pageRevision(sourceId, index);
    let result: EngineResult<CachedBitmap>;
    try {
      const reopened = await this.ensureOpen(sourceId);
      if (!reopened.ok) {
        throw Object.assign(new Error(reopened.error.message), { code: reopened.error.code });
      }
      const rendered = await (await this.engine()).renderPage(sourceId, index, {
        scale: bucket,
        rotation,
        signal: job.controller.signal,
        ...(clip === undefined ? {} : { clip }),
        ...(bare === true ? { withAnnotations: false, withForms: false } : {}),
      });
      const entry: CachedBitmap = {
        key: job.key,
        bitmap: rendered.bitmap,
        width: rendered.width,
        height: rendered.height,
        bucket,
        revision,
      };
      if (job.sourceClosed || job.stale) {
        // The source was closed while PDFium rendered (the adapter finished before it saw
        // the abort), or the page changed meanwhile: nothing may be cached for it, or the
        // bitmap would outlive the source or show old content.
        rendered.bitmap.close();
        result = fail('aborted', job.stale ? 'Page changed' : 'Source closed');
      } else {
        // Cache even when nobody waits any more: scrolling back is common.
        this.cache.set(job.page, entry);
        this.track(job, entry);
        this.measure(`render ${job.key}`, started);
        startupMark('first-page-bitmap');
        result = ok(entry);
      }
    } catch (error) {
      result = { ok: false, error: toFailure(error) };
    }
    if (this.queue.jobs.get(job.key) === job) this.queue.jobs.delete(job.key);
    for (const s of job.subscribers) s.resolve(result);
    job.subscribers.clear();
  }

  /** Remembers a cached bitmap for clipped repaints of its page (most recent last). */
  private track(job: Job, entry: CachedBitmap): void {
    const { sourceId, index, rotation, bucket, clip } = job.request;
    // A bare bitmap counts as a tile here: a clipped repaint drops it rather than patching
    // the annotations into it.
    const tile = tileOf(job.request);
    const pageId = `${sourceId}:${index}`;
    const list = this.rendered.get(pageId) ?? new Map<string, RenderedEntry>();
    list.delete(entry.key);
    list.set(entry.key, {
      key: entry.key,
      page: job.page,
      rotation,
      bucket,
      ...(clip === undefined ? {} : { clip }),
      ...(tile === undefined ? {} : { tile }),
    });
    this.rendered.set(pageId, list);
  }

  // -------------------------------------------------------------------------
  // Dev timings
  // -------------------------------------------------------------------------

  private mark(name: string): string | undefined {
    if (!this.timings) return undefined;
    try {
      performance.mark(name);
      return name;
    } catch {
      return undefined;
    }
  }

  private measure(name: string, startMark: string | undefined): void {
    if (startMark === undefined) return;
    try {
      performance.measure(name, startMark);
      performance.clearMarks(startMark);
    } catch {
      // Timing is best effort.
    }
  }

  /** Terminates the worker and drops every cached bitmap. */
  async destroy(): Promise<void> {
    for (const job of [...this.queue.jobs.values()]) this.queue.cancel(job, 'Engine destroyed');
    this.cache.clear();
    this.retained.clear();
    this.passwords.clear();
    this.texts.clear();
    this.cropBoxes.clear();
    this.parked.clear();
    this.openSources.clear();
    if (this.idleTimer !== undefined) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
    const renderer = this.renderer;
    this.renderer = undefined;
    try {
      await (await renderer)?.destroy?.();
    } catch {
      // Nothing left to clean up.
    }
  }
}
/** Per-page CropBoxes when the engine reports them (see `pageCropBox`). */
export function readCropBoxes(document: OpenedDocument): readonly (Rect | undefined)[] {
  // Defensive: test doubles may omit `pages`.
  const pages: OpenedDocument['pages'] = Array.isArray(document.pages) ? document.pages : [];
  return pages.map(({ cropBox }) =>
    cropBox !== undefined && Number.isFinite(cropBox.x) && Number.isFinite(cropBox.y)
      ? cropBox
      : undefined,
  );
}

/** Per-page shapes for clipped repaints (unrotated CropBox size, /Rotate, CropBox origin). */
export function readShapes(document: OpenedDocument): readonly PageShape[] {
  const pages: OpenedDocument['pages'] = Array.isArray(document.pages) ? document.pages : [];
  return pages.map(({ size, rotation, cropBox }) => ({
    size,
    rotation,
    originX: cropBox?.x ?? 0,
    originY: cropBox?.y ?? 0,
  }));
}

let instance: EngineService | undefined;
/**
 * The app-wide engine service. The PDFium worker starts on first use (ARCHITECTURE.md §2:
 * loaded on first document open), and only the light client entry
 * (`@pdf-editor/engine/client`, PF-2) loads on the main thread for it: the worker is configured,
 * and its wasm fetched and compiled, as soon as that small chunk arrives, while the assembly
 * worker that inspects sources starts beside it.
 */
export function getEngineService(): EngineService {
  instance ??= new EngineService({
    gateCalls: true,
    createRenderer: async () => {
      startupMark('engine-requested');
      // The wasm download starts now, beside the worker's script and the client chunk (PF-2);
      // the proxy compiles it as it arrives and posts the module to the worker (PF-4).
      const wasmResponse = fetch(wasmUrl);
      wasmResponse.catch(() => undefined);
      // ADR-0011: our own PDFium worker; `destroy()` terminates it. Constructed first so its
      // script loads while the client chunk does.
      const worker = new PdfiumWorker({ name: 'recto pdfium' });
      try {
        // The assembly worker starts now, but the PDFium worker does not wait for it: the
        // inspector reaches it on first use (an open inspects sources).
        const assembler = getAssembler();
        assembler.catch(() => undefined);
        const { createPdfiumProxy } = await import('@pdf-editor/engine/client');
        const proxy = createPdfiumProxy(worker, {
          wasmUrl,
          wasmResponse,
          fontFallback: null,
          inspector: {
            inspect: async (bytes, options) => (await assembler).inspect(bytes, options),
            finalizeAnnotations: async (bytes, request, options) =>
              (await assembler).finalizeAnnotations(bytes, request, options),
            checkAnnotations: async (bytes, options, callOptions) =>
              (await assembler).checkAnnotations(bytes, options, callOptions),
          },
        });
        startupMark('worker-configured');
        const module = compiledModule(proxy);
        setPdfiumModule(module);
        void import('../tools/compress-client').then(({ sharePdfiumModule }) =>
          sharePdfiumModule(module),
        );
        return proxy;
      } catch (error) {
        worker.terminate();
        throw error;
      }
    },
  });
  instance.onWorkerEnded(endAssembler);
  return instance;
}

/** Waits for the worker's compile (the `wasm-compiled` mark) and keeps the module (PF-4). */
async function compiledModule(proxy: PdfiumProxy): Promise<WebAssembly.Module | undefined> {
  const module = await proxy.compiledWasm();
  if (module !== undefined) startupMark('wasm-compiled');
  return module;
}
