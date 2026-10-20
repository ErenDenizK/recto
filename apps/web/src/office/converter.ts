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
const CONVERT_TIMEOUT_MS = 120_000;
const IDLE_MS = 60_000;

export function createWorkerConverter(options: WorkerConverterOptions = {}): OfficeConverter {
  const startTimeout = options.startTimeoutMs ?? START_TIMEOUT_MS;
  const convertTimeout = options.convertTimeoutMs ?? CONVERT_TIMEOUT_MS;
  const idleMs = options.idleMs ?? IDLE_MS;
  const createWorker =
    options.createWorker ?? ((url: string) => new Worker(url, { name: 'office-converter' }));

  let worker: Worker | null = null;
  let ready: Promise<void> | null = null;
  let serial = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const waiting = new Map<number, (message: WorkerMessage) => void>();

  const dispose = () => {
    clearTimeout(idleTimer);
    worker?.terminate();
    worker = null;
    ready = null;
    for (const settle of waiting.values()) settle({ type: 'error', id: -1, error: 'stopped' });
    waiting.clear();
  };

  /** Sends `message` and resolves with the matching final answer, reporting progress. */
  const request = (
    message: Record<string, unknown>,
    timeoutMs: number,
    reason: 'timeout',
    onPercent: (percent: number | null) => void,
    transfer: Transferable[] = [],
  ): Promise<WorkerMessage> => {
    const id = ++serial;
    const current = worker;
    if (current === null) return Promise.reject(new OfficeError('convert', 'No converter worker'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        waiting.delete(id);
        dispose();
        reject(new OfficeError(reason, `The converter did not answer within ${timeoutMs} ms`));
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

  const start = (onProgress: ((progress: ConvertProgress) => void) | undefined): Promise<void> => {
    if (ready !== null) return ready;
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
      for (const settle of waiting.values()) {
        settle({ type: 'error', id: -1, error: event.message || 'The converter failed' });
      }
      waiting.clear();
      dispose();
    };
    ready = request(
      {
        type: 'init',
        sofficeJs: urls.sofficeJs,
        sofficeWasm: urls.sofficeWasm,
        sofficeData: urls.sofficeData,
        sofficeWorkerJs: urls.sofficeWorkerJs,
      },
      startTimeout,
      'timeout',
      (percent) => onProgress?.({ phase: 'starting', percent }),
    ).then(
      (answer) => {
        if (answer.type !== 'ready') {
          dispose();
          throw new OfficeError('convert', `The converter did not start: ${errorText(answer)}`);
        }
      },
      (error: unknown) => {
        ready = null;
        throw error;
      },
    );
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
      'timeout',
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
