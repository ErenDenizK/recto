/**
 * Text to PDF (conversion memo step 2, PRD-19): decoding, pagination, form feeds, the empty
 * file, and that the text is real (PDFium extracts it back, Turkish letters included).
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { sid } from '../../test/helpers';
import { createHarness, type Harness, pageText } from '../text-edit/test-helpers';
import { decodeTextBytes, normalizeText } from './decode';
import { textToPdf } from './text-to-pdf';

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.adapter.destroy();
});

const encode = (text: string) => new TextEncoder().encode(text);

let counter = 0;

async function convert(bytes: Uint8Array) {
  const pdf = await textToPdf(bytes);
  const id = sid(`t2p-${++counter}`);
  const opened = await h.adapter.open(id, pdf.slice().buffer);
  return { id, pageCount: opened.pageCount };
}

async function pagesOf(bytes: Uint8Array): Promise<string[][]> {
  const { id, pageCount } = await convert(bytes);
  const pages: string[][] = [];
  for (let i = 0; i < pageCount; i++) pages.push(await pageText(h, id, i));
  return pages;
}

/** The text of a page with whitespace between runs and line ends folded away. */
const words = (page: readonly string[]) => page.join(' ').split(/\s+/).filter(Boolean);

describe('decoding', () => {
  test('strips a UTF-8 BOM and reads UTF-8', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('ğüşıöçİ')]);
    expect(decodeTextBytes(bytes)).toBe('ğüşıöçİ');
  });

  test('falls back to windows-1254 for a legacy Turkish file', () => {
    // "ğüşıöçİ" in windows-1254: not valid UTF-8.
    const bytes = new Uint8Array([0xf0, 0xfc, 0xfe, 0xfd, 0xf6, 0xe7, 0xdd]);
    expect(decodeTextBytes(bytes)).toBe('ğüşıöçİ');
  });

  test('valid UTF-8 that contains U+FFFD stays UTF-8', () => {
    expect(decodeTextBytes(encode('a \uFFFD ğüşıöçİ'))).toBe('a \uFFFD ğüşıöçİ');
  });

  test('reads UTF-16 with a BOM, little and big endian', () => {
    const text = 'Işık ğüş';
    const units = Array.from(text, (c) => c.charCodeAt(0));
    const le = new Uint8Array([0xff, 0xfe, ...units.flatMap((u) => [u & 255, u >> 8])]);
    const be = new Uint8Array([0xfe, 0xff, ...units.flatMap((u) => [u >> 8, u & 255])]);
    expect(decodeTextBytes(le)).toBe(text);
    expect(decodeTextBytes(be)).toBe(text);
  });

  test('keeps the replacement characters when the bytes are not windows-1254 either', () => {
    const bytes = new Uint8Array([0x41, 0x81, 0x42]);
    expect(decodeTextBytes(bytes)).toContain('�');
  });

  test('normalises line ends and tabs, and keeps form feeds', () => {
    expect(normalizeText('a\r\nb\rc\td\fe')).toBe('a\nb\nc    d\fe');
  });
});

describe('layout', () => {
  test('a long file paginates, and no line runs past the page', async () => {
    const lines = Array.from({ length: 120 }, (_, i) => `Line number ${i + 1}`);
    const pages = await pagesOf(encode(lines.join('\n')));
    // 45 lines fit between 72 pt margins on A4 at 11 pt x 1.4.
    expect(pages.map((p) => p.length)).toEqual([45, 45, 30]);
    expect(pages.flat()).toEqual(lines);
  });

  test('Turkish characters come back as typed', async () => {
    const lines = ['ğüşıöçİ ĞÜŞIÖÇ', 'İstanbul çarşısında şeker', 'Işık ve ağaç'];
    const [page] = await pagesOf(encode(lines.join('\r\n')));
    expect(page).toEqual(lines);
  });

  test('a legacy windows-1254 file converts to the same text', async () => {
    const bytes = new Uint8Array([0xf0, 0xfc, 0xfe, 0xfd, 0xf6, 0xe7, 0xdd]);
    const [page] = await pagesOf(bytes);
    expect(page).toEqual(['ğüşıöçİ']);
  });

  test('a form feed starts a new page', async () => {
    const pages = await pagesOf(encode('first page\fsecond page\f\ffourth page'));
    expect(pages.map(words)).toEqual([
      ['first', 'page'],
      ['second', 'page'],
      [],
      ['fourth', 'page'],
    ]);
  });

  test('an empty file is one blank page', async () => {
    expect(await pagesOf(new Uint8Array())).toEqual([[]]);
  });

  test('long paragraphs wrap at word boundaries and keep every word', async () => {
    const paragraph = Array.from({ length: 200 }, (_, i) => `word${i}`).join(' ');
    const [page] = await pagesOf(encode(paragraph));
    expect(page?.length).toBeGreaterThan(5);
    expect(words(page ?? [])).toEqual(paragraph.split(' '));
  });

  test('a word longer than the line breaks by character', async () => {
    const long = 'x'.repeat(300);
    const [page] = await pagesOf(encode(long));
    expect(page?.length).toBeGreaterThan(1);
    expect(page?.join('')).toBe(long);
  });

  test('blank lines are kept', async () => {
    const { id } = await convert(encode('a\n\n\nb'));
    const glyphs = (await h.adapter.getPageText(id, 0)).flatMap((run) => run.glyphs);
    const ys = glyphs.filter((g) => g.text === 'a' || g.text === 'b').map((g) => g.rect.y);
    expect(ys).toHaveLength(2);
    // Three line heights between the baselines: two blank lines in between.
    expect(Math.abs((ys[0] ?? 0) - (ys[1] ?? 0))).toBeGreaterThan(3 * 15.4 - 2);
  });
});
