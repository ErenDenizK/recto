/** Image crops (image-crops.ts): the clip in user space, the 4 MP cap, a cancelled signal. */
import type { PdfRenderer } from '@pdf-editor/engine';
import { describe, expect, it, vi } from 'vitest';

import { READ_BITMAP_PIXELS } from '../engine/engine-service';
import { createImageCrops, cropScale } from './image-crops';

describe('cropScale', () => {
  it('fits the width when that stays under the cap', () => {
    expect(cropScale({ x: 0, y: 0, width: 200, height: 100 }, 600)).toBe(3);
  });

  it('lowers the scale so the crop stays within 4 MP', () => {
    const box = { x: 0, y: 0, width: 600, height: 800 };
    const scale = cropScale(box, 20_000);
    expect(box.width * scale * (box.height * scale)).toBeLessThanOrEqual(READ_BITMAP_PIXELS + 1);
    expect(scale).toBeLessThan(20_000 / 600);
  });
});

describe('render', () => {
  const pages = {
    pageRef: () => ({
      sourceId: 's' as never,
      index: 3,
      delta: 90 as const,
      frame: {
        size: { width: 600, height: 800 },
        originX: 0,
        originY: 0,
        rotation: 90 as const,
        scale: 1,
      },
    }),
  };

  it('renders the box as a clip in user space with the view rotation, as a PNG', async () => {
    const bitmap = await createImageBitmap(new ImageData(40, 20));
    const renderPage = vi
      .fn<PdfRenderer['renderPage']>()
      .mockResolvedValue({ bitmap, width: 40, height: 20 });
    const crops = createImageCrops(pages, () => Promise.resolve({ renderPage }));
    const blob = await crops.render(
      1,
      { x: 100, y: 50, width: 40, height: 20 },
      80,
      new AbortController().signal,
    );
    expect(blob.type).toBe('image/png');
    const call = renderPage.mock.calls[0];
    expect(call?.slice(0, 2)).toEqual(['s', 3]);
    expect(call?.[2]).toMatchObject({ scale: 2, rotation: 90 });
    // Turned a quarter, the display box (100, 50, 40 × 20) is user (50, 100, 20 × 40).
    expect(call?.[2].clip).toEqual({ x: 50, y: 100, width: 20, height: 40 });
  });

  it('rejects at once when the signal has fired', async () => {
    const renderPage = vi.fn<PdfRenderer['renderPage']>();
    const crops = createImageCrops(pages, () => Promise.resolve({ renderPage }));
    const controller = new AbortController();
    controller.abort();
    await expect(
      crops.render(0, { x: 0, y: 0, width: 10, height: 10 }, 10, controller.signal),
    ).rejects.toMatchObject({ code: 'aborted' });
    expect(renderPage).not.toHaveBeenCalled();
  });
});
