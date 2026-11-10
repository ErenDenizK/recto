import { describe, expect, it, vi } from 'vitest';

import { CallGate, sourceOf } from './engine-gate';

/** A renderer double that records the order its calls are posted in. */
function recorder() {
  const posted: string[] = [];
  const renderer = {
    getPageText: (id: string, index: number) => {
      posted.push(`text ${id}:${index}`);
      return Promise.resolve(`text ${id}:${index}`);
    },
    listAnnotations: (id: string, index: number, options?: { signal?: AbortSignal }) => {
      posted.push(`annots ${id}:${index}`);
      if (options?.signal?.aborted) return Promise.reject(new Error('aborted'));
      return Promise.resolve([]);
    },
    createAnnotation: (id: string) => {
      posted.push(`create ${id}`);
      return Promise.resolve('created');
    },
    open: (id: string) => {
      posted.push(`open ${id}`);
      return Promise.resolve('opened');
    },
    renderParagraphPreview: (id: string) => {
      posted.push(`preview ${id}`);
      return Promise.resolve('preview');
    },
    renderPage: (id: string, index: number) => {
      posted.push(`render ${id}:${index}`);
      return Promise.resolve('bitmap');
    },
    compiledWasm: () => {
      posted.push('wasm');
      return Promise.resolve('module');
    },
  };
  return { renderer, posted };
}

/** A gate whose waiting set the test controls. */
function gateWith(waiting: Set<string>, maxHoldMs?: number) {
  return new CallGate({
    visibleSources: () => waiting,
    ...(maxHoldMs === undefined ? {} : { maxHoldMs }),
  });
}

/** A gate with nothing waiting: every call is posted at the next drain. */
const gate0 = () => gateWith(new Set());

describe('CallGate', () => {
  it('posts calls in the order they were made once no page render waits', async () => {
    const { renderer, posted } = recorder();
    const gated = gateWith(new Set()).wrap(renderer);
    const calls = [gated.open('a'), gated.getPageText('a', 0), gated.createAnnotation('a')];
    expect(posted).toEqual([]);
    await Promise.all(calls);
    expect(posted).toEqual(['open a', 'text a:0', 'create a']);
  });

  it('holds reads and writes on other sources while a page render waits, and posts them in order when it ends', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting);
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const held = [
      gated.getPageText('a', 0),
      gated.open('scratch'),
      gated.listAnnotations('a', 0),
      gated.createAnnotation('scratch'),
    ];
    // The page's render is posted ahead of all of them.
    await gated.renderPage('a', 0);
    // Let the gate decide (one macrotask) with the render still waiting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(posted).toEqual(['render a:0']);
    expect(gate.heldCount).toBe(4);
    waiting.clear();
    gate.poke();
    await Promise.all(held);
    expect(posted).toEqual([
      'render a:0',
      'text a:0',
      'open scratch',
      'annots a:0',
      'create scratch',
    ]);
    expect(gate.heldCount).toBe(0);
  });

  it('does not hold a write on a source whose page waits, and posts the reads held before it first', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting);
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const read = gated.getPageText('a', 3);
    const other = gated.getPageText('b', 1);
    const write = gated.createAnnotation('a');
    await Promise.all([read, write]);
    expect(posted).toEqual(['text a:3', 'create a']);
    // The read on the other source is still held.
    expect(gate.heldCount).toBe(1);
    waiting.clear();
    gate.poke();
    await other;
    expect(posted).toEqual(['text a:3', 'create a', 'text b:1']);
  });

  it('posts the held writes of a source, and the reads before them, ahead of its render; later reads stay held', async () => {
    const waiting = new Set<string>(['b']);
    const gate = gateWith(waiting);
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const first = gated.getPageText('a', 0);
    const write = gated.createAnnotation('a');
    const later = gated.getPageText('a', 1);
    // A page of `a` is asked for after all three: the write must be posted before it.
    waiting.add('a');
    await gated.renderPage('a', 0);
    await Promise.all([first, write]);
    expect(posted).toEqual(['text a:0', 'create a', 'render a:0']);
    expect(gate.heldCount).toBe(1);
    waiting.clear();
    gate.poke();
    await later;
    expect(posted.at(-1)).toBe('text a:1');
  });

  it('posts an interactive call at once, after the calls held on its source', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting);
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const read = gated.getPageText('a', 0);
    const elsewhere = gated.getPageText('b', 0);
    await gated.renderParagraphPreview('a');
    await read;
    expect(posted).toEqual(['text a:0', 'preview a']);
    expect(gate.heldCount).toBe(1);
    waiting.clear();
    gate.poke();
    await elsewhere;
  });

  it('releases a call held longer than maxHoldMs without a render ending', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting, 20);
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    expect(await gated.getPageText('b', 0)).toBe('text b:0');
    expect(posted).toEqual(['text b:0']);
    // Still waiting: the call went out because it had been held long enough.
    expect(waiting.size).toBe(1);
  });

  it('posts a held call at once when its signal aborts, so the proxy can reject it', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting);
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const controller = new AbortController();
    const call = gated.listAnnotations('b', 0, { signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(posted).toEqual([]);
    controller.abort();
    await expect(call).rejects.toThrow('aborted');
    expect(posted).toEqual(['annots b:0']);
    expect(gate.heldCount).toBe(0);
  });

  it('leaves methods it does not list alone, and invents none', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting);
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    expect(await gated.compiledWasm()).toBe('module');
    expect(posted).toEqual(['wasm']);
    expect('save' in gated).toBe(false);
    expect((gated as { save?: unknown }).save).toBeUndefined();
  });

  it('reads the source off an id, a ref or a run', () => {
    expect(sourceOf(['s1', 2])).toBe('s1');
    expect(sourceOf([{ source: 's2', pageIndex: 0 }])).toBe('s2');
    expect(sourceOf([{ run: { source: 's3' }, replacement: 'x' }])).toBe('s3');
    expect(sourceOf([new Uint8Array(2)])).toBeUndefined();
    expect(sourceOf([])).toBeUndefined();
  });

  it('trickles reads while only thumbnails wait: a few in flight, the rest as they finish', async () => {
    let thumbnails = true;
    const gate = new CallGate({
      visibleSources: () => new Set(),
      renderSources: () => (thumbnails ? new Set(['a']) : new Set()),
      readTrickle: 2,
    });
    const started: number[] = [];
    const finish: (() => void)[] = [];
    const renderer = {
      listAnnotations: (_id: string, index: number) =>
        new Promise<number>((resolve) => {
          started.push(index);
          finish.push(() => resolve(index));
        }),
    };
    const gated = gate.wrap(renderer);
    const calls = [0, 1, 2, 3, 4].map((index) => gated.listAnnotations('a', index));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual([0, 1]);
    finish[0]?.();
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));
    // The thumbnails are done: everything left goes at once.
    thumbnails = false;
    finish[1]?.();
    await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3, 4]));
    for (const done of finish) done();
    expect(await Promise.all(calls)).toEqual([0, 1, 2, 3, 4]);
  });

  it("holds a scratch document's writes while thumbnails render, but not those on the rendered source", async () => {
    const shown = new Set(['a']);
    const gate = new CallGate({ visibleSources: () => new Set(), renderSources: () => shown });
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const scratch = gated.open('scratch');
    const edit = gated.createAnnotation('a');
    await edit;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(posted).toEqual(['create a']);
    expect(gate.heldCount).toBe(1);
    shown.clear();
    gate.poke();
    await scratch;
    expect(posted).toEqual(['create a', 'open scratch']);
  });

  it('gates a method replaced after its first use (a spy), not the one it replaced', async () => {
    const { renderer, posted } = recorder();
    const gated = gate0().wrap(renderer);
    await gated.getPageText('a', 0);
    const original = renderer.getPageText;
    renderer.getPageText = (id: string, index: number) => {
      posted.push(`spy ${id}:${index}`);
      return original(id, index);
    };
    await gated.getPageText('a', 1);
    expect(posted).toEqual(['text a:0', 'spy a:1', 'text a:1']);
  });
});
