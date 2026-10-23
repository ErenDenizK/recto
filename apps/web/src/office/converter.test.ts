/**
 * The converter host (ADR-0035 §5) against a stand-in for the package's worker that speaks its
 * protocol: start once and warm up, convert one file at a time, time out a worker that never
 * answers, replace a worker whose first LibreOffice call stalls (PRD-27), fail at once on a crash.
 */
import { describe, expect, it } from 'vitest';

import { createWorkerConverter } from './converter';
import { OfficeError } from './office-error';

interface Message {
  readonly type: string;
  readonly id: number;
  readonly inputData?: Uint8Array;
  readonly inputExt?: string;
}

/** A fake worker: `answer` decides each reply (undefined: never answers). */
function fakeWorker(answer: (message: Message) => Record<string, unknown>[] | undefined) {
  const sent: Message[] = [];
  let terminated = false;
  const worker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    postMessage(message: Message) {
      sent.push(message);
      const replies = answer(message);
      if (replies === undefined) return;
      setTimeout(() => {
        for (const reply of replies)
          worker.onmessage?.(new MessageEvent('message', { data: reply }));
      }, 0);
    },
    terminate() {
      terminated = true;
    },
  };
  /** The worker dies the way a pthread crash ends it: an uncaught error event. */
  const crash = (message: string) =>
    worker.onerror?.(new ErrorEvent('error', { message, cancelable: true }));
  return { worker: worker as unknown as Worker, sent, terminated: () => terminated, crash };
}

/** The file conversions a worker received (the warm-up is a text conversion). */
const files = (sent: readonly Message[]) =>
  sent.filter((m) => m.type === 'convert' && m.inputExt !== 'txt');

const protocol = (message: Message) => {
  if (message.type === 'init') {
    return [
      { type: 'progress', id: message.id, progress: { percent: 40, phase: 'compile' } },
      { type: 'ready', id: message.id },
    ];
  }
  return [
    { type: 'progress', id: message.id, progress: { percent: 70 } },
    { type: 'result', id: message.id, data: new TextEncoder().encode(`%PDF ${message.inputExt}`) },
  ];
};

describe('the converter host (ADR-0035 §5)', () => {
  it('starts the worker once and converts each file to PDF bytes', async () => {
    const fake = fakeWorker(protocol);
    const urls: string[] = [];
    const converter = createWorkerConverter({
      createWorker: (url) => {
        urls.push(url);
        return fake.worker;
      },
    });
    const progress: string[] = [];
    const first = await converter.convert(new Uint8Array([1]), 'docx', (p) =>
      progress.push(`${p.phase}:${p.percent}`),
    );
    const second = await converter.convert(new Uint8Array([2]), 'pptx');
    expect(new TextDecoder().decode(first)).toBe('%PDF docx');
    expect(new TextDecoder().decode(second)).toBe('%PDF pptx');
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/convert\/lo-[^/]+\/browser\.worker\.global\.js$/);
    // init, the one-word warm-up, then the two files.
    expect(fake.sent.map((m) => `${m.type}:${m.inputExt ?? ''}`)).toEqual([
      'init:',
      'convert:txt',
      'convert:docx',
      'convert:pptx',
    ]);
    expect(progress).toEqual(['starting:40', 'converting:null', 'converting:70']);
    converter.dispose();
    expect(fake.terminated()).toBe(true);
  });

  it('passes the paths Emscripten asks for', async () => {
    const fake = fakeWorker(protocol);
    const converter = createWorkerConverter({ createWorker: () => fake.worker });
    await converter.convert(new Uint8Array([1]), 'xlsx');
    const init = fake.sent[0] as unknown as Record<string, string>;
    expect(init.sofficeWasm).toMatch(/\/soffice\.wasm$/);
    expect(init.sofficeData).toMatch(/\/soffice\.data$/);
    expect(init.sofficeWorkerJs).toMatch(/\/soffice\.worker\.js$/);
    converter.dispose();
  });

  it('reports a conversion LibreOffice refused', async () => {
    const fake = fakeWorker((message) =>
      message.type === 'init'
        ? [{ type: 'ready', id: message.id }]
        : [{ type: 'error', id: message.id, error: 'Failed to load document' }],
    );
    const converter = createWorkerConverter({ createWorker: () => fake.worker });
    await expect(converter.convert(new Uint8Array([1]), 'docx')).rejects.toMatchObject({
      reason: 'convert',
    });
    converter.dispose();
  });

  it('ends a worker that never answers and says it timed out', async () => {
    const fake = fakeWorker((message) =>
      message.type === 'init' || message.inputExt === 'txt'
        ? [{ type: 'ready', id: message.id }]
        : undefined,
    );
    const converter = createWorkerConverter({
      createWorker: () => fake.worker,
      convertTimeoutMs: 50,
    });
    const error = await converter.convert(new Uint8Array([1]), 'docx').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OfficeError);
    expect((error as OfficeError).reason).toBe('timeout');
    expect(fake.terminated()).toBe(true);
  });

  // PRD-27, r26 probe: a fresh LibreOffice sometimes stalls in its first document load (about
  // 65 s on CI, sometimes past the file's 2 minutes); the next load, or a fresh worker, is fast.
  it('replaces a worker whose first LibreOffice call stalls, so the file keeps its budget', async () => {
    /** Each worker answers init, never its first conversion when `stalls`, then every other. */
    const workers = [true, false].map((stalls) => {
      let first = true;
      return fakeWorker((message) => {
        if (message.type === 'init') return [{ type: 'ready', id: message.id }];
        if (first && stalls) {
          first = false;
          return undefined;
        }
        first = false;
        return [{ type: 'result', id: message.id, data: new TextEncoder().encode('%PDF') }];
      });
    });
    let created = 0;
    const converter = createWorkerConverter({
      createWorker: () => {
        const next = workers[created++];
        if (next === undefined) throw new Error('a third worker');
        return next.worker;
      },
      warmUpTimeoutMs: 20,
      // Shorter than the stall: had the file met the stalled first load, it would time out.
      convertTimeoutMs: 200,
    });
    const pdf = await converter.convert(new Uint8Array([1]), 'docx');
    expect(new TextDecoder().decode(pdf)).toBe('%PDF');
    expect(created).toBe(2);
    expect(workers[0]?.terminated()).toBe(true);
    expect(files(workers[0]?.sent ?? [])).toEqual([]);
    expect(files(workers[1]?.sent ?? [])).toHaveLength(1);
    converter.dispose();
  });

  it('gives up after three stalled starts and says it timed out', async () => {
    const stalled = () =>
      fakeWorker((message) =>
        message.type === 'init' ? [{ type: 'ready', id: message.id }] : undefined,
      );
    const fakes: ReturnType<typeof stalled>[] = [];
    const converter = createWorkerConverter({
      createWorker: () => {
        const fake = stalled();
        fakes.push(fake);
        return fake.worker;
      },
      warmUpTimeoutMs: 10,
      convertTimeoutMs: 30,
    });
    const error = await converter.convert(new Uint8Array([1]), 'docx').catch((e: unknown) => e);
    expect((error as OfficeError).reason).toBe('timeout');
    expect(fakes).toHaveLength(3);
    expect(fakes.every((fake) => fake.terminated() && files(fake.sent).length === 0)).toBe(true);
  });

  it('fails the file at once when the worker crashes, and the next file starts afresh', async () => {
    const fakes: ReturnType<typeof fakeWorker>[] = [];
    const converter = createWorkerConverter({
      createWorker: () => {
        const fake = fakeWorker((message) => {
          if (message.type === 'init') return [{ type: 'ready', id: message.id }];
          if (message.inputExt === 'txt' || fakes.length > 1) return protocol(message);
          // The first worker dies during its first file, as after the pthread std::length_error.
          setTimeout(() => fake.crash('Uncaught [object WebAssembly.Exception]'), 0);
          return undefined;
        });
        fakes.push(fake);
        return fake.worker;
      },
      convertTimeoutMs: 60_000,
    });
    const started = Date.now();
    const error = await converter.convert(new Uint8Array([1]), 'docx').catch((e: unknown) => e);
    expect((error as OfficeError).reason).toBe('convert');
    expect((error as OfficeError).message).toMatch(/WebAssembly\.Exception/);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(fakes[0]?.terminated()).toBe(true);
    const pdf = await converter.convert(new Uint8Array([2]), 'xlsx');
    expect(new TextDecoder().decode(pdf)).toBe('%PDF xlsx');
    expect(fakes).toHaveLength(2);
    converter.dispose();
  });

  it('starts nothing more once disposed during a stalled start', async () => {
    const fakes: ReturnType<typeof fakeWorker>[] = [];
    const converter = createWorkerConverter({
      createWorker: () => {
        const fake = fakeWorker((message) =>
          message.type === 'init' ? [{ type: 'ready', id: message.id }] : undefined,
        );
        fakes.push(fake);
        return fake.worker;
      },
      warmUpTimeoutMs: 50,
    });
    const run = converter.convert(new Uint8Array([1]), 'docx').catch((e: unknown) => e);
    await new Promise((resolve) => setTimeout(resolve, 10));
    converter.dispose();
    await run;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fakes).toHaveLength(1);
    expect(fakes[0]?.terminated()).toBe(true);
  });
});
