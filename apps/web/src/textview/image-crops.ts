/**
 * The crop of a page behind an image block (PRD-36): `renderPage` with `clip` draws exactly the
 * block's box at the column's width in device pixels, capped at `READ_BITMAP_PIXELS` (4 MP,
 * PF-19) so a large figure on a phone stays within the canvas memory budget. The crop is a PNG
 * the view shows in an `<img>`, so the Dim pages filter (`--page-filter`) applies to it like any
 * page. Annotations and forms are drawn as on the page.
 */
import type { Rect } from '@pdf-editor/document-model';
import type { PdfRenderer } from '@pdf-editor/engine';
import { EngineError } from '@pdf-editor/engine/client';

import { getEngineService, READ_BITMAP_PIXELS } from '../engine/engine-service';
import type { ImageCrops } from './contract';
import type { DocumentTextLoader } from './loader';
import { displayToUser } from './position';

/**
 * The scale (device pixels per point) that makes `bbox` `widthPx` wide, lowered to keep the crop
 * within `maxPixels`.
 */
export function cropScale(bbox: Rect, widthPx: number, maxPixels = READ_BITMAP_PIXELS): number {
  const wanted = Math.max(1, widthPx) / Math.max(1e-3, bbox.width);
  const cap = Math.sqrt(maxPixels / Math.max(1e-3, bbox.width * bbox.height));
  return Math.min(wanted, cap);
}

/** Crops of the pages `pages` knows. `renderer` defaults to the app's PDFium worker. */
export function createImageCrops(
  pages: Pick<DocumentTextLoader, 'pageRef'>,
  renderer: () => Promise<Pick<PdfRenderer, 'renderPage'>> = async () =>
    (await getEngineService().editor()) as unknown as Pick<PdfRenderer, 'renderPage'>,
): ImageCrops {
  return {
    async render(page, bbox, widthPx, signal) {
      if (signal.aborted) throw new EngineError('aborted', 'The crop was cancelled');
      const ref = pages.pageRef(page);
      const engine = await renderer();
      const { bitmap, width, height } = await engine.renderPage(ref.sourceId, ref.index, {
        scale: cropScale(bbox, widthPx),
        rotation: ref.delta,
        clip: displayToUser(ref.frame, bbox),
        signal,
      });
      try {
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2D canvas for an image crop');
        context.drawImage(bitmap, 0, 0);
        if (signal.aborted) throw new EngineError('aborted', 'The crop was cancelled');
        return await canvas.convertToBlob({ type: 'image/png' });
      } finally {
        bitmap.close();
      }
    },
  };
}
