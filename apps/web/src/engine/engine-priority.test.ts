/**
 * Page renders go first (PF-24): with `gateCalls`, the renderer's other calls wait while a
 * Read-mode page render is queued or running, in a mock adapter that records the order the
 * service posts its calls in.
 */
import { type Rotation, sourceId } from '@pdf-editor/document-model';
import type { RenderOptions } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import { EngineService, type RendererLike, RENDER_PRIORITY } from './engine-service';

const SRC = sourceId('page-src');
const OTHER = sourceId('other-src');

function mock() {
  const posted: string[] = [];
  const renders: { index: number; finish: () => void; options: RenderOptions }[] = [];
  const renderer: RendererLike = {
    open: () => Promise.reject(new Error('not used')),
    close: () => Promise.resolve(),
    getPageText: (id, index) => {
      posted.push(`text ${id}:${index}`);
      return Promise.resolve([]);
    },
    renderPage: (_id, index, options) =>
      new Promise((resolve, reject) => {
        posted.push(`render ${index}`);
        renders.push({
          index,
          options,
          finish: () => {
            resolve({
              bitmap: { width: 4, height: 4, close: () => undefined } as unknown as ImageBitmap,
              width: 4,
              height: 4,
            });
          },
        });
        options.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      }),
  };
  return { renderer, posted, renders };
}

const request = (index: number, priority: number, signal?: AbortSignal, source = SRC) => ({
  sourceId: source,
  index,
  rotation: 0 as Rotation,
  bucket: 1,
  priority,
  ...(signal === undefined ? {} : { signal }),
});

/** Lets the gate's macrotask and the queue's promise chains settle. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('EngineService with its calls gated', () => {
  it('posts text reads only after the page render that was queued before them', async () => {
    const { renderer, posted, renders } = mock();
    const service = new EngineService({
      createRenderer: () => renderer,
      gateCalls: true,
      timings: false,
    });
    const engine = await service.engine();
    // The reads are made first, as the first page's text layer does, then the render.
    const text = engine.getPageText(OTHER, 0);
    const other = engine.getPageText(SRC, 1);
    const render = service.renderPage(request(0, RENDER_PRIORITY.page));
    await tick();
    expect(posted).toEqual(['render 0']);
    renders[0]?.finish();
    expect((await render).ok).toBe(true);
    await Promise.all([text, other]);
    expect(posted).toEqual(['render 0', `text ${OTHER}:0`, `text ${SRC}:1`]);
  });

  it('does not hold reads for thumbnails', async () => {
    const { renderer, posted, renders } = mock();
    const service = new EngineService({
      createRenderer: () => renderer,
      gateCalls: true,
      timings: false,
    });
    const engine = await service.engine();
    const render = service.renderPage(request(0, RENDER_PRIORITY.visible));
    const text = engine.getPageText(SRC, 2);
    await tick();
    await text;
    expect(posted).toEqual(['render 0', `text ${SRC}:2`]);
    renders[0]?.finish();
    await render;
  });

  it('lets a read go when the page render is cancelled', async () => {
    const { renderer, posted } = mock();
    const service = new EngineService({
      createRenderer: () => renderer,
      gateCalls: true,
      timings: false,
    });
    const engine = await service.engine();
    const controller = new AbortController();
    const render = service.renderPage(request(0, RENDER_PRIORITY.page, controller.signal));
    const text = engine.getPageText(OTHER, 0);
    await tick();
    expect(posted).toEqual(['render 0']);
    controller.abort();
    expect((await render).ok).toBe(false);
    await text;
    expect(posted).toEqual(['render 0', `text ${OTHER}:0`]);
  });

  it('posts calls at once when gating is off, as before', async () => {
    const { renderer, posted } = mock();
    const service = new EngineService({ createRenderer: () => renderer, timings: false });
    const engine = await service.engine();
    void service.renderPage(request(0, RENDER_PRIORITY.page));
    await engine.getPageText(OTHER, 0);
    expect(posted).toContain(`text ${OTHER}:0`);
  });
});
