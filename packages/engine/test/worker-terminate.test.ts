/**
 * Ending a worker leaves no call unanswered (R33 review): each proxy used to send Comlink's
 * RELEASE and then terminate the worker, so the release request, which only the worker can
 * answer, stayed open for good. The e2e `trackEngine` helper counts every Comlink request that
 * has an id until its reply (`quiet` waits for none), and read it as "N worker call(s)
 * unanswered". The check here is the same count, on an idle worker that is then ended.
 */
import { describe, expect, test, vi } from 'vitest';

import simpleTextUrl from '../../../test/fixtures/simple-text.pdf?url';
import { createAnalysisProxy } from '../src/worker/create-analysis-proxy';
import { createAssemblerProxy } from '../src/worker/create-assembler-proxy';
import { createCompressProxy } from '../src/worker/create-compress-proxy';
import { createPdfiumProxy } from '../src/worker/pdfium-proxy';
import { createSignatureProxy } from '../src/worker/signature-proxy';
import { sid, wasmUrl } from './helpers';

const REQUESTS = new Set(['GET', 'SET', 'APPLY', 'CONSTRUCT', 'ENDPOINT', 'RELEASE']);

/** A worker whose Comlink requests are counted until their replies, as `trackEngine` does. */
function tracked(path: URL): { worker: Worker; open: Set<string> } {
  const worker = new Worker(path, { type: 'module', name: 'terminate test' });
  const open = new Set<string>();
  const post = worker.postMessage.bind(worker) as (...args: unknown[]) => void;
  worker.postMessage = ((...args: unknown[]) => {
    const data = args[0] as { id?: unknown; type?: unknown } | null;
    if (typeof data?.id === 'string' && typeof data.type === 'string' && REQUESTS.has(data.type)) {
      open.add(data.id);
    }
    post(...args);
  }) as Worker['postMessage'];
  worker.addEventListener('message', (event: MessageEvent) => {
    const id = (event.data as { id?: unknown } | null)?.id;
    if (typeof id === 'string') open.delete(id);
  });
  return { worker, open };
}

describe('ending a worker', () => {
  test('the PDFium worker, after work, leaves no call open', async () => {
    const { worker, open } = tracked(new URL('../src/worker/pdfium.worker.ts', import.meta.url));
    const proxy = createPdfiumProxy(worker, { wasmUrl });
    const bytes = await (await fetch(simpleTextUrl)).arrayBuffer();
    await proxy.open(sid('terminate-1'), bytes);
    await proxy.close(sid('terminate-1'));
    expect(open.size).toBe(0);
    await proxy.destroy();
    expect(open.size).toBe(0);
  });

  test('the assembly, analysis, compress and signature workers, ended idle, leave no call open', async () => {
    const assembler = tracked(new URL('../src/worker/assembler.worker.ts', import.meta.url));
    const analysis = tracked(new URL('../src/worker/analysis.worker.ts', import.meta.url));
    const compress = tracked(new URL('../src/worker/compress.worker.ts', import.meta.url));
    const signature = tracked(new URL('../src/worker/signature.worker.ts', import.meta.url));
    const proxies = {
      assembler: createAssemblerProxy(assembler.worker),
      analysis: createAnalysisProxy(analysis.worker),
      compress: createCompressProxy(compress.worker, {
        qpdfWasmUrl: '/none',
        pdfiumWasmUrl: wasmUrl,
      }),
      signature: createSignatureProxy(signature.worker, { pdfiumWasmUrl: wasmUrl }),
    };
    // Idle: the configuration some of them send when they start has been answered.
    await vi.waitFor(() => {
      for (const { open } of [assembler, analysis, compress, signature]) expect(open.size).toBe(0);
    });
    proxies.assembler.dispose();
    proxies.analysis.dispose();
    proxies.compress.dispose();
    proxies.signature.terminate();
    const names = { assembler, analysis, compress, signature };
    expect(
      Object.fromEntries(Object.entries(names).map(([name, t]) => [name, [...t.open]])),
    ).toEqual({ assembler: [], analysis: [], compress: [], signature: [] });
  });
});
