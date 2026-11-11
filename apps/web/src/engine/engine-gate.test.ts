import { describe, expect, it, vi } from 'vitest';

import { CallGate, type CallGateOptions, sourceOf } from './engine-gate';

/**
 * A renderer double that records the order its calls are posted in. Reads stay in flight until
 * the test settles them (`finish`), writes and the rest answer at once.
 */
function recorder() {
  const posted: string[] = [];
  const finish = new Map<string, () => void>();
  const read = (label: string) =>
    new Promise<string>((resolve) => {
      posted.push(label);
      finish.set(label, () => resolve(label));
    });
  const renderer = {
    getPageText: (id: string, index: number) => read(`text ${id}:${index}`),
    listAnnotations: (id: string, index: number, options?: { signal?: AbortSignal }) => {
      if (options?.signal?.aborted) return Promise.reject(new Error('aborted'));
      return read(`annots ${id}:${index}`);
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
    verify: (bytes: Uint8Array) => read(`verify ${bytes.length}`),
    destroy: () => {
      posted.push('destroy');
      return Promise.resolve();
    },
    compiledWasm: () => {
      posted.push('wasm');
      return Promise.resolve('module');
    },
  };
  return { renderer, posted, finish };
}

/** A gate with thumbnails (or tiles) rendering for the sources in `waiting`, no page. */
function gateWith(waiting: Set<string>, extra: Partial<CallGateOptions> = {}) {
  return new CallGate({
    visibleSources: () => new Set(),
    renderSources: () => waiting,
    ...extra,
  });
}

/** A gate with a Read-mode page render queued or running for the sources in `waiting`. */
function pageGateWith(waiting: Set<string>, extra: Partial<CallGateOptions> = {}) {
  return new CallGate({ visibleSources: () => waiting, renderSources: () => waiting, ...extra });
}

describe('CallGate: order and the render queue', () => {
  it('posts calls in the order they were made once no render waits', async () => {
    const { renderer, posted, finish } = recorder();
    const gate = gateWith(new Set());
    const gated = gate.wrap(renderer);
    const calls = [gated.open('a'), gated.getPageText('a', 0), gated.createAnnotation('a')];
    expect(posted).toEqual([]);
    await gate.drained();
    finish.get('text a:0')?.();
    await Promise.all(calls);
    expect(posted).toEqual(['open a', 'text a:0', 'create a']);
  });

  it('posts a render ahead of the reads made before it in the same tick', async () => {
    const { renderer, posted } = recorder();
    const waiting = new Set(['a']);
    const gate = pageGateWith(waiting);
    const gated = gate.wrap(renderer);
    void gated.getPageText('a', 0);
    void gated.listAnnotations('a', 0);
    await gated.renderPage('a', 0);
    await gate.drained();
    expect(posted).toEqual(['render a:0', 'text a:0', 'annots a:0']);
  });

  it('posts the held writes of a source, and the reads before them, ahead of its render', async () => {
    const waiting = new Set(['b']);
    const gate = gateWith(waiting, { readTrickle: 1 });
    const { renderer, posted, finish } = recorder();
    const gated = gate.wrap(renderer);
    // `b`'s read is the newest and takes the one slot, so the rest stay held behind it.
    void gated.getPageText('a', 0);
    void gated.createAnnotation('a');
    void gated.getPageText('a', 1);
    void gated.getPageText('b', 9);
    await gate.drained();
    expect(posted).toEqual(['text b:9']);
    waiting.add('a');
    await gated.renderPage('a', 0);
    expect(posted).toEqual(['text b:9', 'text a:0', 'create a', 'render a:0']);
    // The read made after the write is still held, and goes when a slot frees.
    finish.get('text b:9')?.();
    finish.get('text a:0')?.();
    await vi.waitFor(() => expect(posted.at(-1)).toBe('text a:1'));
  });

  it('posts an interactive call at once, after the calls held on its source', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting, { readTrickle: 1 });
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    void gated.getPageText('a', 0);
    void gated.getPageText('b', 0);
    await gate.drained();
    expect(posted).toEqual(['text b:0']);
    await gated.renderParagraphPreview('a');
    expect(posted).toEqual(['text b:0', 'text a:0', 'preview a']);
  });

  it('destroy posts every held call first, whatever its source', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting, { readTrickle: 1 });
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    void gated.getPageText('b', 0);
    void gated.open('scratch');
    void gated.listAnnotations('c', 1);
    await gate.drained();
    expect(posted).toEqual(['annots c:1']);
    await gated.destroy();
    expect(posted).toEqual(['annots c:1', 'text b:0', 'open scratch', 'destroy']);
    expect(gate.heldCount).toBe(0);
  });

  it('holds and releases a call that names no source, with no order to keep', async () => {
    const waiting = new Set(['a']);
    const gate = gateWith(waiting, { readTrickle: 1 });
    const { renderer, posted, finish } = recorder();
    const gated = gate.wrap(renderer);
    void gated.getPageText('b', 0);
    const checked = gated.verify(new Uint8Array(3));
    await gate.drained();
    // The newest read took the slot, the other waits for it.
    expect(posted).toEqual(['verify 3']);
    finish.get('verify 3')?.();
    await checked;
    await vi.waitFor(() => expect(posted).toEqual(['verify 3', 'text b:0']));
  });
});

describe('CallGate: reads while renders wait', () => {
  it('posts every read right behind a page render, uncapped: a scroll does not starve the page it stops on', async () => {
    const waiting = new Set(['a']);
    const gate = pageGateWith(waiting, { readTrickle: 2 });
    const { renderer, posted, finish } = recorder();
    const gated = gate.wrap(renderer);
    // A scroll: the text layers of pages 0..11 ask while page renders stay queued.
    const calls = Array.from({ length: 12 }, (_, page) => gated.getPageText('a', page));
    await gate.drained();
    // All posted at once, none held for the render, none waiting for another to settle: the
    // reads used to be held (then capped) for as long as a page render waited, and the text of
    // the page the reader stopped on never came.
    expect(posted.length).toBe(12);
    expect(gate.heldCount).toBe(0);
    for (const done of finish.values()) done();
    await Promise.all(calls);
  });

  it('goes a few at a time while only thumbnails render, newest first, and the rest at once when they end', async () => {
    let thumbnails = true;
    const gate = new CallGate({
      visibleSources: () => new Set(),
      renderSources: () => (thumbnails ? new Set(['a']) : new Set()),
      readTrickle: 2,
    });
    const { renderer, posted, finish } = recorder();
    const gated = gate.wrap(renderer);
    const calls = [0, 1, 2, 3, 4].map((page) => gated.listAnnotations('a', page));
    await gate.drained();
    expect(posted).toEqual(['annots a:3', 'annots a:4']);
    finish.get('annots a:4')?.();
    await vi.waitFor(() => expect(posted.at(-1)).toBe('annots a:2'));
    thumbnails = false;
    finish.get('annots a:3')?.();
    await vi.waitFor(() => expect(posted.length).toBe(5));
    for (const done of finish.values()) done();
    await Promise.all(calls);
  });

  it('a read at the cap goes when one settles, without a timer to poll', async () => {
    const waiting = new Set(['a']);
    let clock = 0;
    const gate = gateWith(waiting, { maxHoldMs: 750, now: () => clock, readTrickle: 1 });
    const { renderer, posted, finish } = recorder();
    const gated = gate.wrap(renderer);
    const calls = [0, 1, 2].map((page) => gated.listAnnotations('b', page));
    await gate.drained();
    expect(posted).toEqual(['annots b:2']);
    clock = 5_000;
    const timers = vi.spyOn(globalThis, 'setTimeout');
    gate.poke();
    expect(posted).toEqual(['annots b:2']);
    expect(timers).not.toHaveBeenCalled();
    finish.get('annots b:2')?.();
    await vi.waitFor(() => expect(posted).toEqual(['annots b:2', 'annots b:1']));
    finish.get('annots b:1')?.();
    await vi.waitFor(() => expect(posted.length).toBe(3));
    expect(timers).not.toHaveBeenCalled();
    timers.mockRestore();
    for (const done of finish.values()) done();
    await Promise.all(calls);
  });

  it('a read released at the cap takes the held writes of its source before it', async () => {
    const gate = new CallGate({
      visibleSources: () => new Set(),
      renderSources: () => new Set(['shown']),
    });
    const { renderer, posted, finish } = recorder();
    const gated = gate.wrap(renderer);
    void gated.createAnnotation('scratch');
    void gated.getPageText('scratch', 0);
    await gate.drained();
    finish.get('text scratch:0')?.();
    expect(posted).toEqual(['create scratch', 'text scratch:0']);
  });

  it('posts a held call at once when its signal aborts, so the proxy can reject it', async () => {
    const gate = gateWith(new Set(['a']), { readTrickle: 1 });
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const controller = new AbortController();
    const call = gated.listAnnotations('b', 1, { signal: controller.signal });
    void gated.getPageText('b', 0);
    await gate.drained();
    expect(posted).toEqual(['text b:0']);
    controller.abort();
    await expect(call).rejects.toThrow('aborted');
    expect(gate.heldCount).toBe(0);
  });
});

describe('CallGate: writes while renders wait', () => {
  it("holds a scratch document's writes, not those on a rendered source, and posts them when the renders end", async () => {
    const shown = new Set(['a']);
    const gate = new CallGate({ visibleSources: () => new Set(), renderSources: () => shown });
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const scratch = gated.open('scratch');
    await gated.createAnnotation('a');
    await gate.drained();
    expect(posted).toEqual(['create a']);
    expect(gate.heldCount).toBe(1);
    shown.clear();
    gate.poke();
    await scratch;
    expect(posted).toEqual(['create a', 'open scratch']);
  });

  it('releases a held write after maxHoldMs, by the injected clock', async () => {
    const waiting = new Set(['a']);
    let clock = 0;
    const gate = gateWith(waiting, { maxHoldMs: 750, now: () => clock });
    const { renderer, posted } = recorder();
    const write = gate.wrap(renderer).open('scratch');
    await gate.drained();
    expect(posted).toEqual([]);
    clock = 749;
    gate.poke();
    expect(posted).toEqual([]);
    clock = 750;
    gate.poke();
    expect(await write).toBe('opened');
    expect(waiting.size).toBe(1);
  });

  it("never holds the user's own writes: a foreground source goes at once, a scratch one waits", async () => {
    const shown = new Set(['a']);
    const gate = new CallGate({
      visibleSources: () => new Set(),
      renderSources: () => shown,
      foreground: (source) => source === 'opened-by-user',
    });
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    const scratch = gated.open('scratch');
    await gated.open('opened-by-user');
    await gate.drained();
    expect(posted).toEqual(['open opened-by-user']);
    shown.clear();
    gate.poke();
    await scratch;
    expect(posted).toEqual(['open opened-by-user', 'open scratch']);
  });

  it('keeps a source in order: a released write takes the reads held before it first', async () => {
    const shown = new Set(['x']);
    let clock = 0;
    const gate = new CallGate({
      visibleSources: () => new Set(),
      renderSources: () => shown,
      readTrickle: 1,
      now: () => clock,
    });
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    void gated.getPageText('y', 1);
    void gated.getPageText('s', 0);
    void gated.createAnnotation('s');
    await gate.drained();
    // `s`'s read is not at the front of the cap and its write is a scratch one: both held.
    expect(posted).toEqual(['text s:0']);
    clock = 750;
    gate.poke();
    expect(posted).toEqual(['text s:0', 'create s']);
  });
});

describe('CallGate: the wrapper', () => {
  it('leaves methods it does not list alone, and invents none', async () => {
    const gate = gateWith(new Set(['a']));
    const { renderer, posted } = recorder();
    const gated = gate.wrap(renderer);
    expect(await gated.compiledWasm()).toBe('module');
    expect(posted).toEqual(['wasm']);
    expect('save' in gated).toBe(false);
    expect((gated as { save?: unknown }).save).toBeUndefined();
  });

  it('gates a method replaced after its first use (a spy), not the one it replaced', async () => {
    const { renderer, posted, finish } = recorder();
    const gate = gateWith(new Set());
    const gated = gate.wrap(renderer);
    const first = gated.getPageText('a', 0);
    await gate.drained();
    finish.get('text a:0')?.();
    await first;
    const original = renderer.getPageText;
    renderer.getPageText = (id: string, index: number) => {
      posted.push(`spy ${id}:${index}`);
      return original(id, index);
    };
    void gated.getPageText('a', 1);
    await gate.drained();
    expect(posted).toEqual(['text a:0', 'spy a:1', 'text a:1']);
  });

  it('reads the source off an id, a ref or a run', () => {
    expect(sourceOf(['s1', 2])).toBe('s1');
    expect(sourceOf([{ source: 's2', pageIndex: 0 }])).toBe('s2');
    expect(sourceOf([{ run: { source: 's3' }, replacement: 'x' }])).toBe('s3');
    expect(sourceOf([new Uint8Array(2)])).toBeUndefined();
    expect(sourceOf([])).toBeUndefined();
  });
});
