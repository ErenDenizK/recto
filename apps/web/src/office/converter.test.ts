/**
 * The converter host (ADR-0035 §5) against a stand-in for the package's worker that speaks its
 * protocol: start once, convert one file at a time, time out a worker that never answers.
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
    onerror: null,
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
  return { worker: worker as unknown as Worker, sent, terminated: () => terminated };
}

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
    expect(fake.sent.map((m) => m.type)).toEqual(['init', 'convert', 'convert']);
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
      message.type === 'init' ? [{ type: 'ready', id: message.id }] : undefined,
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
});
