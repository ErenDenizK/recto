/**
 * Helpers for the find map's specs (R26 concept 3; DSN-65): where the hit ticks are drawn. The
 * ticks are pixels on one canvas (DSN-62), so a spec finds them the way a person does: it reads
 * the canvas's rows that carry ink and returns the screen points of their lane.
 */
import type { Page } from '@playwright/test';

export interface TickPoint {
  readonly x: number;
  readonly y: number;
}

/** The screen centre of every run of ticks on the canvas, top to bottom. */
export async function tickPoints(page: Page): Promise<TickPoint[]> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas[data-scroll-ticks]');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvas.hidden) return [];
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    // The lane is 7 px in from the canvas's right edge (4 px wide, 5 px in from the bar's end).
    const column = Math.round(canvas.width - 7 * dpr);
    const data = ctx.getImageData(column, 0, 1, canvas.height).data;
    const out: { x: number; y: number }[] = [];
    for (let row = 0; row < canvas.height; ) {
      if ((data[row * 4 + 3] ?? 0) === 0) {
        row++;
        continue;
      }
      let end = row;
      while (end + 1 < canvas.height && (data[(end + 1) * 4 + 3] ?? 0) > 0) end++;
      out.push({ x: rect.right - 7, y: rect.top + (row + end) / 2 / dpr });
      row = end + 1;
    }
    return out;
  });
}
