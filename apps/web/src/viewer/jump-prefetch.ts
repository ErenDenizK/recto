/**
 * Content for a jump's landing (motion-2026-10 viewer.md §1): a far jump glides its last half
 * screen over pages that were never rendered, which used to show as white sheets. As the jump
 * starts, the target page is asked for at the exact scale its canvas will ask for (so the
 * canvas finds it in the cache and draws it on mount), and its neighbours at a quarter of it
 * (a soft preview the canvas draws at once and sharpens later), all at the page priority of the
 * render queue. A newer jump aborts what an older one still waits for; a bitmap already cached
 * costs nothing.
 */
import type { Rotation, SourceId } from '@pdf-editor/document-model';

import {
  chooseBucket,
  chooseScale,
  exactScale,
  getEngineService,
  RENDER_PRIORITY,
  sheetSize,
} from '../engine/engine-service';

/** A page to prefetch: its source page and its displayed size in points. */
export interface PrefetchPage {
  readonly sourceId: SourceId;
  readonly index: number;
  readonly rotation: Rotation;
  readonly widthPt: number;
  readonly heightPt: number;
}

/** Neighbours render at this fraction of the exact scale. */
const PREVIEW_FRACTION = 0.25;

let running: AbortController | null = null;

/**
 * Renders `target` at its exact scale and `neighbours` at a preview scale, for a Read view at
 * `cssScale` CSS px per point (module header). Returns how many renders it asked for.
 */
export function prefetchLanding(
  target: PrefetchPage | undefined,
  neighbours: readonly PrefetchPage[],
  cssScale: number,
  dpr = window.devicePixelRatio || 1,
): number {
  running?.abort();
  const controller = new AbortController();
  running = controller;
  const service = getEngineService();
  let asked = 0;
  const ask = (page: PrefetchPage, bucket: number) => {
    if (service.peek(page.sourceId, page.index, page.rotation, bucket)) return;
    asked += 1;
    void service.renderPage({
      sourceId: page.sourceId,
      index: page.index,
      rotation: page.rotation,
      bucket,
      priority: RENDER_PRIORITY.page,
      signal: controller.signal,
    });
  };
  const exactOf = (page: PrefetchPage) => {
    const { width } = sheetSize(page.widthPt, page.heightPt, cssScale, dpr);
    return chooseScale(exactScale(width, page.widthPt, dpr), page.widthPt, page.heightPt);
  };
  if (target) ask(target, exactOf(target));
  for (const page of neighbours) {
    ask(page, chooseBucket(exactOf(page) * PREVIEW_FRACTION, page.widthPt, page.heightPt));
  }
  return asked;
}
