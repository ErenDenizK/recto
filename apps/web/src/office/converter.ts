/**
 * The converter (ADR-0035 §5): an interface the flow converts through, and its one real
 * implementation, a host for the package's own worker (`browser.worker.global.js`, which loads
 * LibreOffice with `importScripts` and owns its LibreOfficeKit instance).
 *
 * - **One worker, one conversion at a time.** Requests queue; LibreOffice is not re-entrant.
 * - **Its protocol** is the package's: `{ type: 'init', id, sofficeJs, sofficeWasm, sofficeData,
 *   sofficeWorkerJs }` answered by `progress` messages and `ready` or `error`; then
 *   `{ type: 'convert', id, inputData, inputExt, outputFormat: 'pdf' }` answered by `progress`
 *   and `result` (the PDF bytes, transferred) or `error`.
 * - **Timeouts.** Starting gets 3 minutes (compiling 147 MB of wasm on a slow machine), each
 *   conversion 2; past that the worker is terminated, which also ends any deadlock (spike §3).
 * - **Warm-up (PRD-27).** A fresh LibreOffice sometimes stalls in its first document load: its
 *   start-up thread has not finished and the load waits for it, about 65 s on CI and longer
 *   when the release does not come (8 of 120 fresh workers in the r26 probe, always the first
 *   load, never a later one). So starting ends with a one-word text conversion, given 30 s
 *   (0.4–0.8 s normally on CI); a warm-up that does not answer ends that worker and
 *   starts a fresh one, up to three tries, the last with the full conversion budget. The
 *   user's file then gets its 2 minutes for its own work, not for LibreOffice's start.
 * - **Crashes.** A worker that dies (an uncaught pthread error) fails the file it was
 *   converting at once, and the next file starts a fresh worker.
 * - **Memory.** The worker holds about 1 GB while it lives; it is terminated after a minute
 *   idle and started again for the next file.
 */
import { OfficeError } from './office-error';
import type { OfficeExtension } from './office-files';
import { converterUrls } from './package';

export interface ConvertProgress {
  /** 'starting' while LibreOffice loads, then 'converting'. */
  readonly phase: 'starting' | 'converting';
  /** 0–100, or null when unknown. */
  readonly percent: number | null;
}

export interface OfficeConverter {
  /** Converts one Office document to PDF bytes. */
  convert(
    input: Uint8Array,
    ext: OfficeExtension,
    onProgress?: (progress: ConvertProgress) => void,
  ): Promise<Uint8Array>;
  /** Ends the worker now (a cancelled flow, tests). */
  dispose(): void;
}

export interface WorkerConverterOptions {
  readonly startTimeoutMs?: number;
  readonly warmUpTimeoutMs?: number;
  readonly convertTimeoutMs?: number;
  readonly idleMs?: number;
  /** Creates the worker (tests pass a fake). */
  readonly createWorker?: (url: string) => Worker;
}

type WorkerMessage =
  | { readonly type: 'ready'; readonly id: number }
  | { readonly type: 'error'; readonly id: number; readonly error?: string }
  | { readonly type: 'result'; readonly id: number; readonly data: Uint8Array }
  | {
      readonly type: 'progress';
      readonly id: number;
      readonly progress?: { readonly percent?: number };
    };

const START_TIMEOUT_MS = 180_000;
const WARM_UP_TIMEOUT_MS = 30_000;
const CONVERT_TIMEOUT_MS = 120_000;
const IDLE_MS = 60_000;
/** Fresh workers tried before starting fails (the warm-up above). */
const START_ATTEMPTS = 3;
/** The warm-up document: one word of plain text. */
const WARM_UP_TEXT = 'Recto';

export function createWorkerConverter(options: WorkerConverterOptions = {}): OfficeConverter {
  const startTimeout = options.startTimeoutMs ?? START_TIMEOUT_MS;
  const warmUpTimeout = options.warmUpTimeoutMs ?? WARM_UP_TIMEOUT_MS;
  const convertTimeout = options.convertTimeoutMs ?? CONVERT_TIMEOUT_MS;
  const idleMs = options.idleMs ?? IDLE_MS;
  const createWorker =
    options.createWorker ?? ((url: string) => new Worker(url, { name: 'office-converter' }));

  let worker: Worker | null = null;
  /** The start of the current worker (launch and warm-up); a new one once `worker` is gone. */
  let ready: Promise<void> | null = null;
  /** Bumped by `dispose`, so a start in progress gives up instead of launching again. */
  let generation = 0;
  let serial = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const waiting = new Map<number, (message: WorkerMessage) => void>();

  /** Ends the current worker; whatever waits on it gets an error answer. */
  const stop = (error = 'stopped') => {
    worker?.terminate();
    worker = null;
    for (const settle of waiting.values()) settle({ type: 'error', id: -1, error });
    waiting.clear();
  };

  const dispose = () => {
    clearTimeout(idleTimer);
    generation += 1;
    ready = null;
    stop();
  };

  /** Sends `message` and resolves with the matching final answer, reporting progress. */
  const request = (
    message: Record<string, unknown>,
    timeoutMs: number,
    onPercent: (percent: number | null) => void,
    transfer: Transferable[] = [],
  ): Promise<WorkerMessage> => {
    const id = ++serial;
    const current = worker;
    if (current === null) return Promise.reject(new OfficeError('convert', 'No converter worker'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        stop();
        reject(new OfficeError('timeout', `The converter did not answer within ${timeoutMs} ms`));
      }, timeoutMs);
      waiting.set(id, (answer) => {
        if (answer.type === 'progress') {
          onPercent(typeof answer.progress?.percent === 'number' ? answer.progress.percent : null);
          return;
        }
        clearTimeout(timer);
        waiting.delete(id);
        resolve(answer);
      });
      current.postMessage({ ...message, id }, transfer);
    });
  };

  /** A new worker with LibreOffice loaded into it. */
  const launch = async (onProgress: ((progress: ConvertProgress) => void) | undefined) => {
    const urls = converterUrls();
    const created = createWorker(urls.host);
    worker = created;
    created.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      // The worker's start-up progress carries the id of the `init` request.
      waiting.get(message.id)?.(message);
    };
    created.onerror = (event) => {
      event.preventDefault();
      // A crashed worker fails what it was doing at once; the next file starts a fresh one.
      if (worker === created) stop(event.message || 'The converter stopped');
    };
    const answer = await request(
      {
        type: 'init',
        sofficeJs: urls.sofficeJs,
        sofficeWasm: urls.sofficeWasm,
        sofficeData: urls.sofficeData,
        sofficeWorkerJs: urls.sofficeWorkerJs,
      },
      startTimeout,
      (percent) => onProgress?.({ phase: 'starting', percent }),
    );
    if (answer.type !== 'ready') {
      stop();
      throw new OfficeError('convert', `The converter did not start: ${errorText(answer)}`);
    }
  };

  /**
   * Launches LibreOffice and warms it up with a one-word conversion (the warm-up in the header):
   * a warm-up that does not answer in time, or a worker that dies during it, is replaced by a
   * fresh worker, up to START_ATTEMPTS; the last try gets the full conversion budget.
   */
  const boot = async (onProgress: ((progress: ConvertProgress) => void) | undefined) => {
    const own = generation;
    for (let attempt = 1; ; attempt += 1) {
      await launch(onProgress);
      const last = attempt === START_ATTEMPTS;
      const warmed = await request(
        {
          type: 'convert',
          inputData: new TextEncoder().encode(WARM_UP_TEXT),
          inputExt: 'txt',
          outputFormat: 'pdf',
        },
        last ? convertTimeout : warmUpTimeout,
        () => undefined,
      ).then(
        // Any answer, a refusal too, means LibreOffice is responsive, if its worker still lives.
        () => worker !== null,
        (error: unknown) => {
          if (last) throw error;
          return false;
        },
      );
      if (own !== generation) throw new OfficeError('aborted', 'The converter was stopped');
      if (warmed) return;
      if (last) throw new OfficeError('convert', 'The converter stopped while starting');
    }
  };

  const start = (onProgress: ((progress: ConvertProgress) => void) | undefined): Promise<void> => {
    if (ready === null || worker === null) ready = boot(onProgress);
    return ready;
  };

  const convertOne = async (
    input: Uint8Array,
    ext: OfficeExtension,
    onProgress?: (progress: ConvertProgress) => void,
  ): Promise<Uint8Array> => {
    clearTimeout(idleTimer);
    await start(onProgress);
    onProgress?.({ phase: 'converting', percent: null });
    const copy = input.slice();
    const answer = await request(
      { type: 'convert', inputData: copy, inputExt: ext, outputFormat: 'pdf' },
      convertTimeout,
      (percent) => onProgress?.({ phase: 'converting', percent }),
      [copy.buffer],
    );
    idleTimer = setTimeout(dispose, idleMs);
    if (answer.type !== 'result' || !(answer.data instanceof Uint8Array)) {
      throw new OfficeError('convert', `The file did not convert: ${errorText(answer)}`);
    }
    return answer.data;
  };

  return {
    convert(input, ext, onProgress) {
      const run = queue.then(() => convertOne(input, ext, onProgress));
      queue = run.catch(() => undefined);
      return run;
    },
    dispose,
  };
}

function errorText(answer: WorkerMessage): string {
  return answer.type === 'error' ? (answer.error ?? 'unknown error') : answer.type;
}
