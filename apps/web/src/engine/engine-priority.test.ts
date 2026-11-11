/**
 * Page renders go first (PF-24): with `gateCalls`, the renderer's other calls wait while a
 * Read-mode page render is queued or running, in a mock adapter that records the order the
 * service posts its calls in.
 */
import { type Rotation, sourceId } from '@pdf-editor/document-model';
import type { OpenedDocument, RenderOptions } from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import { EngineService, type RendererLike, RENDER_PRIORITY } from './engine-service';

const SRC = sourceId('page-src');
const OTHER = sourceId('other-src');

function mock() {
  const posted: string[] = [];
  const renders: { index: number; finish: () => void; options: RenderOptions }[] = [];
  const renderer: RendererLike = {
    open: (id) => {
      posted.push(`open ${id}`);
      return Promise.resolve({ pageCount: 1, pages: [] } as unknown as OpenedDocument);
    },
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

describe('EngineService with its calls gated', () => {
  it('posts the page render ahead of the reads made before it in the same tick', async () => {
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
    await Promise.all([text, other]);
    expect(posted).toEqual(['render 0', `text ${OTHER}:0`, `text ${SRC}:1`]);
    renders[0]?.finish();
    expect((await render).ok).toBe(true);
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
    await service.gateDrained();
    await text;
    expect(posted).toEqual(['render 0', `text ${SRC}:2`]);
    renders[0]?.finish();
    await render;
  });

  it('answers the text of the page now shown while page renders are still queued (a scroll)', async () => {
    // The compact reader's scroll: pages keep rendering, and each text layer asks for its text.
    // Reads used to be held for as long as a page render waited, so the visible text never came.
    const { renderer, posted } = mock();
    const service = new EngineService({
      createRenderer: () => renderer,
      gateCalls: true,
      timings: false,
    });
    const engine = await service.engine();
    for (let page = 0; page < 6; page++) {
      void service.renderPage(request(page, RENDER_PRIORITY.page));
    }
    const texts = Array.from({ length: 12 }, (_, page) => engine.getPageText(SRC, page));
    // Every text is answered with the renders still pending.
    await Promise.all(texts);
    expect(posted.filter((line) => line.startsWith('text'))).toHaveLength(12);
    expect(service.pendingJobs).toBeGreaterThan(0);
  });

  it('posts calls at once when gating is off, as before', async () => {
    const { renderer, posted } = mock();
    const service = new EngineService({ createRenderer: () => renderer, timings: false });
    const engine = await service.engine();
    void service.renderPage(request(0, RENDER_PRIORITY.page));
    await engine.getPageText(OTHER, 0);
    expect(posted).toContain(`text ${OTHER}:0`);
  });

  it("never holds the user's own open of another file behind thumbnails; a scratch open waits", async () => {
    const { renderer, posted, renders } = mock();
    const service = new EngineService({
      createRenderer: () => renderer,
      gateCalls: true,
      timings: false,
    });
    const engine = await service.engine();
    const render = service.renderPage(request(0, RENDER_PRIORITY.visible));
    const scratch = engine.open(sourceId('scratch'), new ArrayBuffer(1), {});
    const file = new File([new Uint8Array(4)], 'other.pdf', { type: 'application/pdf' });
    const opened = await service.open(file, undefined, OTHER);
    await service.gateDrained();
    expect(opened.ok).toBe(true);
    // The thumbnail is still rendering: the user's open went through, the scratch one did not.
    expect(posted).toEqual(['render 0', `open ${OTHER}`]);
    renders[0]?.finish();
    await render;
    await scratch;
    expect(posted).toEqual(['render 0', `open ${OTHER}`, 'open scratch']);
  });
});
