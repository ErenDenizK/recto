/**
 * Markdown to PDF (PRD-28): the text is real and clean of syntax, headings are larger, code is
 * set in the mono face and wrapped, long lists paginate, links carry a URI annotation, and the
 * PDF reads back as Markdown (H1 to H4, list items, links).
 */
import { bundledFace, loadBundledFont } from '../fonts';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { sid } from '../../test/helpers';
import { createLocalAnalysisBackend } from '../analysis/backend';
import { convertDocument, pdfiumConvertSource } from '../convert/pipeline';
import { createImageHarness, type ImageHarness } from '../image-objects/test-helpers';
import type { TextRun } from '../types';
import { inflatedContent } from '../text-edit/test-helpers';
import { markdownToPdf, wrapCode } from './markdown-to-pdf';
import { TEXT_MARGIN, TEXT_PAGE_SIZE } from './text-to-pdf';

let h: ImageHarness;

beforeAll(async () => {
  h = await createImageHarness();
});

afterAll(async () => {
  await h.adapter.destroy();
});

const encode = (text: string) => new TextEncoder().encode(text);
let counter = 0;

async function open(md: string) {
  const pdf = await markdownToPdf(encode(md));
  const id = sid(`md2pdf-${++counter}`);
  const opened = await h.adapter.open(id, pdf.slice().buffer);
  return { id, pageCount: opened.pageCount, opened, pdf };
}

async function runsOf(md: string): Promise<(readonly TextRun[])[]> {
  const { id, pageCount } = await open(md);
  const pages: (readonly TextRun[])[] = [];
  for (let i = 0; i < pageCount; i++) pages.push(await h.adapter.getPageText(id, i));
  return pages;
}

const SAMPLE = [
  '# Title',
  '',
  'Some **bold**, *italic* and `code` text with [a link](https://example.com/a).',
  '',
  '## Section',
  '',
  '- one',
  '- two',
  '',
  '```',
  'const x = 1;',
  '```',
].join('\n');

describe('markdownToPdf', () => {
  test('text is real, syntax is gone, Turkish letters survive', async () => {
    const [page] = await runsOf(`# Başlık\n\nağaç **ğüşıöçİ** \`kod\` *eğik*`);
    const text = (page ?? []).map((r) => r.text).join(' ');
    expect(text).toContain('ağaç');
    expect(text).toContain('ğüşıöçİ');
    expect(text).not.toMatch(/[#`]|\*\*/);
  });

  test('the H1 is larger than the body, and the sizes follow the scale', async () => {
    const [page] = await runsOf('# H1\n\n## H2\n\n### H3\n\n#### H4\n\nbody');
    const runSize = (word: string) =>
      (page ?? []).find((r) => r.text.includes(word))?.glyphs[0]?.fontSize ?? 0;
    expect(runSize('H1')).toBeCloseTo(24, 0);
    expect(runSize('H2')).toBeCloseTo(18.5, 0);
    expect(runSize('H3')).toBeCloseTo(14.5, 0);
    expect(runSize('H4')).toBeCloseTo(13, 0);
    expect(runSize('body')).toBeCloseTo(11, 0);
  });

  test('code is set in the mono face', async () => {
    const [page] = await runsOf('plain\n\n```\ncode here\n```\n\nand `inline`');
    const glyphs = (page ?? []).flatMap((r) => r.glyphs);
    const fontOf = (text: string) => {
      const run = (page ?? []).find((r) => r.text.includes(text));
      return run?.glyphs[run.text.indexOf(text)]?.fontName ?? '';
    };
    expect(glyphs.length).toBeGreaterThan(0);
    expect(fontOf('code here')).toMatch(/JetBrains/);
    expect(fontOf('inline')).toMatch(/JetBrains/);
    expect(fontOf('plain')).not.toMatch(/JetBrains/);
  });

  test('a long code line wraps inside the margins', async () => {
    const [page] = await runsOf(`\`\`\`\n${'x'.repeat(400)}\n\`\`\``);
    const glyphs = (page ?? []).flatMap((r) => r.glyphs);
    expect(glyphs.filter((g) => g.text === 'x')).toHaveLength(400);
    for (const g of glyphs) {
      expect(g.rect.x + g.rect.width).toBeLessThanOrEqual(TEXT_PAGE_SIZE.width - TEXT_MARGIN + 0.5);
    }
    expect((page ?? []).length).toBeGreaterThan(1);
  });

  test('a 300 item list paginates and nothing is lost', async () => {
    const md = Array.from({ length: 300 }, (_, i) => `- item${i + 1}x`).join('\n');
    const pages = await runsOf(md);
    expect(pages.length).toBeGreaterThan(1);
    const all = pages
      .flat()
      .map((r) => r.text)
      .join(' ');
    for (let i = 1; i <= 300; i++) expect(all).toContain(`item${i}x`);
    const bullets = all.split('•').length - 1;
    expect(bullets).toBe(300);
  });

  test('a link carries one URI annotation; unsafe hrefs get none', async () => {
    const { id } = await open('see [Recto](https://example.com/a) and [rel](docs/x.md)');
    const links = (await h.adapter.listAnnotations(id, 0)).filter((a) => a.kind === 'link');
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ kind: 'link', uri: 'https://example.com/a' });
  });

  test('an empty file is one blank page; a form feed starts a page', async () => {
    expect((await open('')).pageCount).toBe(1);
    expect((await open('a\fb')).pageCount).toBe(2);
  });

  test('a heading at the page bottom moves with its paragraph', async () => {
    const filler = Array.from({ length: 41 }, (_, i) => `line${i}`).join('\n\n');
    const pages = await runsOf(`${filler}\n\n## Moved\n\nafter text`);
    const last = pages[pages.length - 1] ?? [];
    expect(pages.flat().some((r) => r.text.includes('Moved'))).toBe(true);
    expect(last.some((r) => r.text.includes('after text'))).toBe(true);
  });

  test('Noto Sans has the bullet and en dash the lists use', async () => {
    const fontkit = (await import('@cantoo/fontkit')).default;
    const bytes = await loadBundledFont(bundledFace('noto-sans', 400));
    const font = fontkit.create(bytes) as { hasGlyphForCodePoint(c: number): boolean };
    expect(font.hasGlyphForCodePoint(0x2022)).toBe(true);
    expect(font.hasGlyphForCodePoint(0x2013)).toBe(true);
  });

  test('round trip: PDF to Markdown reads the structure back', async () => {
    const { id, opened } = await open(SAMPLE);
    const engine = {
      getPageText: h.adapter.getPageText.bind(h.adapter),
      listAnnotations: h.adapter.listAnnotations.bind(h.adapter),
      locateImages: h.editor.locateImages.bind(h.editor),
      extractImage: h.editor.extractImage.bind(h.editor),
    };
    const result = await convertDocument(
      createLocalAnalysisBackend(),
      pdfiumConvertSource(engine, id, opened),
      {},
    );
    const lines = result.text.split('\n');
    expect(lines).toContain('# Title');
    expect(lines).toContain('## Section');
    expect(lines).toContain('- one');
    expect(result.text).toContain('[a link](https://example.com/a)');
  });
});

describe('code wrapping and block gaps', () => {
  test('wrapCode breaks at the last space and indents continuations like the source', () => {
    const line = Array.from('    return the quick brown fox jumps over');
    expect(wrapCode(line, 20)).toEqual(['    return the quick', '    brown fox jumps', '    over']);
    expect(wrapCode(Array.from('aaaaaaaaaaaa bb'), 5)).toEqual(['aaaaa', 'aaaaa', 'aa bb']);
    expect(wrapCode([], 5)).toEqual(['']);
  });

  test('a wrapped code line keeps whole words and the indent', async () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`);
    const [page] = await runsOf(`\`\`\`\n    ${words.join(' ')}\n\`\`\``);
    const lines = (page ?? []).filter((r) => r.text.includes('word'));
    expect(lines.length).toBeGreaterThan(1);
    const got = lines
      .map((r) => r.text)
      .join(' ')
      .split(/\s+/)
      .filter(Boolean);
    expect(got).toEqual(words);
    const firstInk = (run: TextRun) => run.glyphs.find((g) => g.text !== ' ')?.rect.x ?? 0;
    expect(firstInk(lines[1] as TextRun)).toBeCloseTo(firstInk(lines[0] as TextRun), 0);
  });

  test('code box, quote bar and rule are 8 pt apart, edge to edge', async () => {
    const { pdf } = await open('```\ncode\n```\n\n> quote\n\n---\n\nafter');
    const content = (await inflatedContent(pdf.slice().buffer, 0)).page;
    // pdf-lib sets a rectangle as a flipped path under a translating `cm`: top = its y.
    const rects = [
      ...content.matchAll(
        /1 0 0 1 [\d.]+ ([\d.]+) cm[\s\S]*?\n0 0 m\n[\d.]+ 0 l\n[\d.]+ ([\d.]+) l/g,
      ),
    ].map((m) => ({ top: Number(m[1]), bottom: Number(m[1]) - Number(m[2]), h: Number(m[2]) }));
    const lines = [...content.matchAll(/([\d.]+) ([\d.]+) m\n\1 \2 m\n/g)].map((m) => Number(m[2]));
    const box = rects.find((r) => r.h > 20);
    const bar = rects.find((r) => r !== box);
    if (!box || !bar || lines.length === 0) throw new Error(content.slice(0, 1500));
    expect(box.bottom - bar.top).toBeCloseTo(8, 1);
    expect(bar.bottom - (lines[0] as number)).toBeCloseTo(8, 1);
  });
});
