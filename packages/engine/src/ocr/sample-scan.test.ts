/**
 * The teaching sample's scanned letter is recognised (MOB-11; docs/design/sample-2026-10
 * design.md §4 page 6): the full cut's scan page, a 4-bit greyscale image with no text layer
 * (MOB-12), rendered by the PDFium worker at OCR's standard 200 dpi floor and read by
 * tesseract.js in the file's language, gives back the typed letter: the planted correction
 * ("1904") that the lesson asks people to find, the names, and most of its words.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import manifest from '../../../../apps/web/test/sample-manifest.json';
import enUrl from '../../../../apps/web/public/sample/recto-sample-en.pdf?url';
import trUrl from '../../../../apps/web/public/sample/recto-sample-tr.pdf?url';
import type { PdfiumProxy } from '../worker/pdfium-proxy';
import { createOcrRecognizer } from './recognizer';
import { createProxy, lcsMatches, normalizeWord, OCR_BASE, sid } from './test-helpers';

const URLS: Record<string, string> = {
  'recto-sample-en.pdf': enUrl,
  'recto-sample-tr.pdf': trUrl,
};

let engine: PdfiumProxy;
const recognizer = createOcrRecognizer({ baseUrl: OCR_BASE, poolSize: 1 });

beforeAll(() => {
  engine = createProxy('pdfium sample scan test');
});

afterAll(async () => {
  await recognizer.dispose();
  await engine.destroy();
});

const words = (text: string) => text.split(/\s+/u).map(normalizeWord).filter(Boolean);

describe.each(manifest.files.filter((f) => f.scanPages.length > 0))('$file', (entry) => {
  test('its scan page reads back as the typed letter', async () => {
    const id = sid(`sample-${entry.file}`);
    await engine.open(id, await (await fetch(URLS[entry.file] as string)).arrayBuffer());
    try {
      const page = (entry.scanPages[0] as number) - 1;
      const raster = await engine.renderForOcr(id, page, { dpi: 200 });
      const languages = entry.locale === 'tr' ? ['tur', 'eng'] : ['eng'];
      const result = await recognizer.recognize(raster, page, languages);
      const read = result.words.map((w) => normalizeWord(w.text));
      const truth = words(entry.scanText ?? '');
      const accuracy = lcsMatches(truth, read).size / truth.length;
      console.warn(
        `OCR ${entry.file}: ${Math.round(accuracy * 1000) / 10} % of ${truth.length} words, quality ${result.quality}`,
      );
      // "1904", or in Turkish "1904’te": what the try line asks people to find.
      expect(read.some((w) => w.startsWith('1904'))).toBe(true);
      expect(read).toContain('Mira');
      expect(read).toContain('Pusula');
      expect(accuracy).toBeGreaterThanOrEqual(0.9);
    } finally {
      await engine.close(id);
    }
  }, 120_000);
});
