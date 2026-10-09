/**
 * The OCR pool (docs/plan/v1/PLAN.md PF-10): how many recognizers run at once, and proof that
 * the number never changes what is recognised. Every scan fixture page is recognised with
 * pools of 1, 2 and 4, all pages in flight at once, and the results are deep-equal apart from
 * the timing. The wall times print for perf-results.md.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { createOcrRecognizer, ocrPoolSize } from './recognizer';
import { createProxy, fixtureBytes, OCR_BASE, type ScanName, sid, truth } from './test-helpers';
import type { OcrPageResult, OcrRaster } from '../types';
import type { PdfiumProxy } from '../worker/pdfium-proxy';

describe('ocrPoolSize', () => {
  test('up to four recognizers, half the cores, where 8 GB are reported', () => {
    expect(ocrPoolSize({ cores: 16, deviceMemory: 8 })).toBe(4);
    expect(ocrPoolSize({ cores: 8, deviceMemory: 8 })).toBe(4);
    expect(ocrPoolSize({ cores: 6, deviceMemory: 8 })).toBe(3);
    expect(ocrPoolSize({ cores: 4, deviceMemory: 8 })).toBe(2);
    expect(ocrPoolSize({ cores: 2, deviceMemory: 8 })).toBe(1);
  });

  test('the earlier rule, at most two, with less memory, none reported, or on WebKit', () => {
    expect(ocrPoolSize({ cores: 16, deviceMemory: 4 })).toBe(2);
    expect(ocrPoolSize({ cores: 16 })).toBe(2);
    expect(ocrPoolSize({ cores: 16, deviceMemory: 8, webkit: true })).toBe(2);
    expect(ocrPoolSize({ cores: 3 })).toBe(1);
    expect(ocrPoolSize({})).toBe(1);
  });

  test('the default reads this browser', () => {
    const size = ocrPoolSize();
    expect(size).toBeGreaterThanOrEqual(1);
    expect(size).toBeLessThanOrEqual(4);
  });
});

describe('the pool size does not change the recognised text', () => {
  let engine: PdfiumProxy;
  const pages: { raster: OcrRaster; pageIndex: number; languages: readonly string[] }[] = [];

  beforeAll(async () => {
    engine = createProxy('pdfium ocr pool test');
    const files: ScanName[] = [
      'scan-text.pdf',
      'scan-turkish.pdf',
      'scan-rotated.pdf',
      'scan-foreign-ocr.pdf',
    ];
    for (const file of files) {
      const id = sid(`pool:${file}`);
      await engine.open(id, await fixtureBytes(file));
      const expected = truth(file);
      for (const page of expected.pages) {
        const raster = await engine.renderForOcr(id, page.page - 1, { dpi: 200 });
        pages.push({ raster, pageIndex: page.page - 1, languages: expected.languages });
      }
      await engine.close(id);
    }
  }, 120_000);

  afterAll(async () => {
    await engine.destroy();
  });

  /** Everything a result says about the page, without its timing. */
  const content = (result: OcrPageResult): Omit<OcrPageResult, 'durationMs'> => {
    const { durationMs: _durationMs, ...rest } = result;
    return rest;
  };

  test('pools of 1, 2 and 4 return the same words, lines and boxes', async () => {
    const byPool = new Map<number, Omit<OcrPageResult, 'durationMs'>[]>();
    const wallMs: Record<number, number> = {};
    for (const poolSize of [1, 2, 4]) {
      const recognizer = createOcrRecognizer({ baseUrl: OCR_BASE, poolSize });
      try {
        const started = performance.now();
        const results = await Promise.all(
          pages.map(({ raster, pageIndex, languages }) =>
            recognizer.recognize({ ...raster, bytes: raster.bytes.slice(0) }, pageIndex, languages),
          ),
        );
        wallMs[poolSize] = Math.round(performance.now() - started);
        byPool.set(poolSize, results.map(content));
      } finally {
        await recognizer.dispose();
      }
    }
    // eslint-disable-next-line no-console -- benchmark output for perf-results.md
    console.info(
      `[timing] OCR ${pages.length} pages by pool size, wall ms: ${JSON.stringify(wallMs)}`,
    );
    const one = byPool.get(1);
    expect(one?.length).toBe(pages.length);
    expect(one?.every((page) => page.words.length > 0)).toBe(true);
    expect(byPool.get(2)).toEqual(one);
    expect(byPool.get(4)).toEqual(one);
  }, 300_000);
});
