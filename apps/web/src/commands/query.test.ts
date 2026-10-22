/**
 * The query parser's corpus (Epic 4, R12 E10: at least 200 EN/TR queries for the owner to read
 * through; the command half of the corpus is in `keywords.test.ts`). Each row is a query and
 * what the parser must make of it, written as a short string (`show`).
 */
import { describe, expect, it } from 'vitest';

import { formatPages, parseQuery, type QueryContext, type QueryIntent } from './query';

const ctx: QueryContext = {
  pageCount: 100,
  currentPage: 12,
  headings: [
    { title: 'Introduction', page: 1 },
    { title: 'Methods', page: 14 },
    { title: 'Results', page: 30 },
    { title: 'Contributor agreement', page: 88 },
    { title: 'Yöntem', page: 40 },
    { title: 'İçindekiler', page: 2 },
    { title: 'Işık ve gölge', page: 51 },
  ],
  recents: [
    { id: 'a', name: 'Annual report 2025.pdf' },
    { id: 'b', name: 'Lease agreement.pdf' },
    { id: 'c', name: 'Fatura Ocak.pdf' },
    { id: 'd', name: 'Işıklı tablo.pdf' },
  ],
};

/** One line per intent: what the palette would show. */
function show(intent: QueryIntent | null): string {
  if (!intent) return 'none';
  switch (intent.kind) {
    case 'page':
      return `page ${intent.page}`;
    case 'pages': {
      const turns = intent.turns === undefined ? '' : ` ${intent.turns}`;
      return `${intent.action} ${intent.pagesLabel}${turns} -> ${intent.commandId}`;
    }
    case 'heading':
      return `heading "${intent.text}" ${intent.matches[0]?.title ?? '-'}`;
    case 'recent':
      return `recent "${intent.text}" ${intent.matches[0]?.name ?? '-'}`;
    case 'invalid':
      return `invalid ${intent.for} ${intent.reason}${intent.page === undefined ? '' : ` ${intent.page}`}`;
  }
}

const R = 'rotate';
const cases: readonly (readonly [string, string])[] = [
  // Page jumps.
  ['120', 'invalid page out-of-range 120'],
  ['42', 'page 42'],
  ['1', 'page 1'],
  ['100', 'page 100'],
  ['101', 'invalid page out-of-range 101'],
  ['0', 'invalid page out-of-range 0'],
  ['p 7', 'page 7'],
  ['p7', 'page 7'],
  ['P 7', 'page 7'],
  ['pg 7', 'page 7'],
  ['page 7', 'page 7'],
  ['Page 7', 'page 7'],
  ['PAGE 7', 'page 7'],
  ['page7', 'page 7'],
  ['go to 7', 'page 7'],
  ['go to page 7', 'page 7'],
  ['goto 7', 'page 7'],
  ['jump to 33', 'page 33'],
  ['  58  ', 'page 58'],
  ['sayfa 7', 'page 7'],
  ['Sayfa 7', 'page 7'],
  ['SAYFA 7', 'page 7'],
  ['sayfa7', 'page 7'],
  ['7. sayfa', 'page 7'],
  ['7 sayfa', 'page 7'],
  ['7. sayfaya git', 'page 7'],
  ['sayfa 7e git', 'page 7'],
  ["sayfa 7'ye git", 'page 7'],
  ["7'ye git", 'page 7'],
  ['git 7', 'page 7'],
  ['7 git', 'page 7'],
  ['sayfayı 7', 'page 7'],
  ['sayfa 120', 'invalid page out-of-range 120'],
  ['page 250', 'invalid page out-of-range 250'],
  // Page-range actions: English.
  ['rotate 3-7 right', `${R} 3-7 1 -> pages.rotateRight`],
  ['rotate 3-7 left', `${R} 3-7 -1 -> pages.rotateLeft`],
  ['rotate 3-7', `${R} 3-7 1 -> pages.rotateRight`],
  ['rotate pages 3-7 right', `${R} 3-7 1 -> pages.rotateRight`],
  ['rotate pages 3 to 7 right', `${R} 3-7 1 -> pages.rotateRight`],
  ['rotate 3 through 7 clockwise', `${R} 3-7 1 -> pages.rotateRight`],
  ['rotate 3..7 ccw', `${R} 3-7 -1 -> pages.rotateLeft`],
  ['rotate 3–7 counterclockwise', `${R} 3-7 -1 -> pages.rotateLeft`],
  ['rotate 5 left', `${R} 5 -1 -> pages.rotateLeft`],
  ['rotate page 5', `${R} 5 1 -> pages.rotateRight`],
  ['rotate 5 180', `${R} 5 2 -> pages.rotateRight`],
  ['rotate 5 180°', `${R} 5 2 -> pages.rotateRight`],
  ['rotate 5 90 degrees', `${R} 5 1 -> pages.rotateRight`],
  ['rotate all right', `${R} 1-100 1 -> pages.rotateRight`],
  ['rotate even pages left', `${R} ${formatPages(evens())} -1 -> pages.rotateLeft`],
  ['rotate odd pages', `${R} ${formatPages(odds())} 1 -> pages.rotateRight`],
  ['rotate this page left', `${R} 12 -1 -> pages.rotateLeft`],
  ['rotate current page', `${R} 12 1 -> pages.rotateRight`],
  ['rotate last page right', `${R} 100 1 -> pages.rotateRight`],
  ['rotate first 3 pages right', `${R} 1-3 1 -> pages.rotateRight`],
  ['rotate last 2 pages left', `${R} 99-100 -1 -> pages.rotateLeft`],
  ['turn 3-7 right', `${R} 3-7 1 -> pages.rotateRight`],
  ['Rotate 3-7 Right', `${R} 3-7 1 -> pages.rotateRight`],
  ['rotate 1,3,5-7', `${R} 1, 3, 5-7 1 -> pages.rotateRight`],
  ['rotate 5-7 and 1', `${R} 1, 5-7 1 -> pages.rotateRight`],
  ['rotate 3-7 and 5-9 left', `${R} 3-9 -1 -> pages.rotateLeft`],
  ['delete 4-6', 'delete 4-6 -> pages.delete'],
  ['delete 4', 'delete 4 -> pages.delete'],
  ['delete page 4', 'delete 4 -> pages.delete'],
  ['delete pages 4-6', 'delete 4-6 -> pages.delete'],
  ['delete pages 4 to 6', 'delete 4-6 -> pages.delete'],
  ['delete 4-6 pages', 'delete 4-6 -> pages.delete'],
  ['remove pages 4-6', 'delete 4-6 -> pages.delete'],
  ['remove 4-6', 'delete 4-6 -> pages.delete'],
  ['DELETE 4-6', 'delete 4-6 -> pages.delete'],
  ['delete 2,4,6', 'delete 2, 4, 6 -> pages.delete'],
  ['delete 2, 4, 6', 'delete 2, 4, 6 -> pages.delete'],
  ['delete 2 and 4', 'delete 2, 4 -> pages.delete'],
  ['delete 10-12 and 20', 'delete 10-12, 20 -> pages.delete'],
  ['delete last page', 'delete 100 -> pages.delete'],
  ['delete first page', 'delete 1 -> pages.delete'],
  ['delete last 3 pages', 'delete 98-100 -> pages.delete'],
  ['delete this page', 'delete 12 -> pages.delete'],
  ['delete even pages', `delete ${formatPages(evens())} -> pages.delete`],
  ['delete odd pages', `delete ${formatPages(odds())} -> pages.delete`],
  ['delete all', 'invalid pages all-pages'],
  ['delete pages 1-100', 'invalid pages all-pages'],
  ['delete 90-120', 'invalid pages out-of-range 120'],
  ['delete 120', 'invalid pages out-of-range 120'],
  ['delete 0', 'invalid pages out-of-range 0'],
  ['delete 7-3', 'invalid pages reversed-range 7'],
  ['rotate 9-2 right', 'invalid pages reversed-range 9'],
  ['duplicate 3-4', 'duplicate 3-4 -> pages.duplicate'],
  ['duplicate page 9', 'duplicate 9 -> pages.duplicate'],
  ['copy pages 3-4', 'duplicate 3-4 -> pages.duplicate'],
  ['extract 5-8', 'extract 5-8 -> pages.extract'],
  ['extract pages 5 to 8', 'extract 5-8 -> pages.extract'],
  ['extract odd pages', `extract ${formatPages(odds())} -> pages.extract`],
  // Page-range actions: Turkish.
  ['çift sayfaları sil', `delete ${formatPages(evens())} -> pages.delete`],
  ['Çift Sayfaları Sil', `delete ${formatPages(evens())} -> pages.delete`],
  ['ÇİFT SAYFALARI SİL', `delete ${formatPages(evens())} -> pages.delete`],
  ['CIFT SAYFALARI SIL', `delete ${formatPages(evens())} -> pages.delete`],
  ['cift sayfalari sil', `delete ${formatPages(evens())} -> pages.delete`],
  ['çift sayfayı sil', `delete ${formatPages(evens())} -> pages.delete`],
  ['çift sayfaları kaldır', `delete ${formatPages(evens())} -> pages.delete`],
  ['tek sayfaları sil', `delete ${formatPages(odds())} -> pages.delete`],
  ['TEK SAYFALARI SİL', `delete ${formatPages(odds())} -> pages.delete`],
  ['tek sayfalari sil', `delete ${formatPages(odds())} -> pages.delete`],
  ['tek sayfaları döndür', `${R} ${formatPages(odds())} 1 -> pages.rotateRight`],
  ['çift sayfaları sola döndür', `${R} ${formatPages(evens())} -1 -> pages.rotateLeft`],
  ['sil 4-6', 'delete 4-6 -> pages.delete'],
  ['4-6 sil', 'delete 4-6 -> pages.delete'],
  ['4-6. sayfaları sil', 'delete 4-6 -> pages.delete'],
  ['4-6 sayfaları sil', 'delete 4-6 -> pages.delete'],
  ['sayfa 4-6 sil', 'delete 4-6 -> pages.delete'],
  ['sayfaları 4-6 sil', 'delete 4-6 -> pages.delete'],
  ['4 ile 6 arası sayfaları sil', 'delete 4-6 -> pages.delete'],
  ["4'ten 6'ya kadar sayfaları sil", 'delete 4-6 -> pages.delete'],
  ['4. sayfayı sil', 'delete 4 -> pages.delete'],
  ['sayfa 4 sil', 'delete 4 -> pages.delete'],
  ['sayfayı sil 4', 'delete 4 -> pages.delete'],
  ['son sayfayı sil', 'delete 100 -> pages.delete'],
  ['son 3 sayfayı sil', 'delete 98-100 -> pages.delete'],
  ['ilk sayfayı sil', 'delete 1 -> pages.delete'],
  ['ilk 2 sayfayı sil', 'delete 1-2 -> pages.delete'],
  ['bu sayfayı sil', 'delete 12 -> pages.delete'],
  ['tüm sayfaları sil', 'invalid pages all-pages'],
  ['hepsini sil', 'invalid pages all-pages'],
  ['tüm sayfaları sağa döndür', `${R} 1-100 1 -> pages.rotateRight`],
  ['3-7 döndür', `${R} 3-7 1 -> pages.rotateRight`],
  ['3-7 sağa döndür', `${R} 3-7 1 -> pages.rotateRight`],
  ['3-7 sola döndür', `${R} 3-7 -1 -> pages.rotateLeft`],
  ['3-7 sayfaları sola döndür', `${R} 3-7 -1 -> pages.rotateLeft`],
  ['3-7 saat yönünde döndür', `${R} 3-7 1 -> pages.rotateRight`],
  ['3-7 saatin tersine döndür', `${R} 3-7 -1 -> pages.rotateLeft`],
  ['sayfa 5 çevir', `${R} 5 1 -> pages.rotateRight`],
  ['5. sayfayı sola çevir', `${R} 5 -1 -> pages.rotateLeft`],
  ['3-4 çoğalt', 'duplicate 3-4 -> pages.duplicate'],
  ['sayfa 9 kopyala', 'duplicate 9 -> pages.duplicate'],
  ['5-8 ayıkla', 'extract 5-8 -> pages.extract'],
  ['5-8. sayfaları çıkar', 'delete 5-8 -> pages.delete'],
  ['sil 120', 'invalid pages out-of-range 120'],
  ['sil 7-3', 'invalid pages reversed-range 7'],
  // Headings.
  ['go to Methods', 'heading "Methods" Methods'],
  ['go to methods', 'heading "methods" Methods'],
  ['Go To Methods', 'heading "Methods" Methods'],
  ['goto Results', 'heading "Results" Results'],
  ['jump to introduction', 'heading "introduction" Introduction'],
  ['go to Contributor agreement', 'heading "Contributor agreement" Contributor agreement'],
  ['go to contributor', 'heading "contributor" Contributor agreement'],
  ['go to Nonexistent chapter', 'none'],
  ['Yöntem git', 'heading "Yöntem" Yöntem'],
  ['yöntem git', 'heading "yöntem" Yöntem'],
  ['YÖNTEM GİT', 'heading "YÖNTEM" Yöntem'],
  ['yontem git', 'heading "yontem" Yöntem'],
  ["Yöntem'e git", 'heading "Yöntem" Yöntem'],
  ['Yöntem bölümüne git', 'heading "Yöntem" Yöntem'],
  ['içindekiler git', 'heading "içindekiler" İçindekiler'],
  ['İÇİNDEKİLER git', 'heading "İÇİNDEKİLER" İçindekiler'],
  ['icindekiler git', 'heading "icindekiler" İçindekiler'],
  ['ışık git', 'heading "ışık" Işık ve gölge'],
  ['ISIK git', 'heading "ISIK" Işık ve gölge'],
  ['Results git', 'heading "Results" Results'],
  // Recent files.
  ['open annual', 'recent "annual" Annual report 2025.pdf'],
  ['open Annual report', 'recent "Annual report" Annual report 2025.pdf'],
  ['open lease', 'recent "lease" Lease agreement.pdf'],
  ['OPEN LEASE', 'recent "LEASE" Lease agreement.pdf'],
  ['open agreement', 'recent "agreement" Lease agreement.pdf'],
  ['aç fatura', 'recent "fatura" Fatura Ocak.pdf'],
  ['AÇ FATURA', 'recent "FATURA" Fatura Ocak.pdf'],
  ['ac fatura', 'recent "fatura" Fatura Ocak.pdf'],
  ['aç Fatura Ocak', 'recent "Fatura Ocak" Fatura Ocak.pdf'],
  ['aç ışıklı', 'recent "ışıklı" Işıklı tablo.pdf'],
  ['aç ISIKLI', 'recent "ISIKLI" Işıklı tablo.pdf'],
  ['fatura aç', 'recent "fatura" Fatura Ocak.pdf'],
  // Degrees, edges, stop words and the rest of the review (R25 Epic 4).
  ['rotate 90', `${R} 12 1 -> pages.rotateRight`],
  ['rotate 180', `${R} 12 2 -> pages.rotateRight`],
  ['rotate 270', `${R} 12 -1 -> pages.rotateLeft`],
  ['rotate 90 right', `${R} 12 1 -> pages.rotateRight`],
  ['rotate 90 left', `${R} 12 -1 -> pages.rotateLeft`],
  ['rotate 180 left', `${R} 12 2 -> pages.rotateRight`],
  ['180 döndür', `${R} 12 2 -> pages.rotateRight`],
  ['90 sola döndür', `${R} 12 -1 -> pages.rotateLeft`],
  ['rotate 5 270', `${R} 5 -1 -> pages.rotateLeft`],
  ['rotate 3-7 90', `${R} 3-7 1 -> pages.rotateRight`],
  ['rotate page 180', 'invalid pages out-of-range 180'],
  ['rotate page 90', `${R} 90 1 -> pages.rotateRight`],
  ['rotate 5 135', 'invalid pages out-of-range 135'],
  ['last page', 'page 100'],
  ['go to last page', 'page 100'],
  ['first page', 'page 1'],
  ['son sayfa', 'page 100'],
  ['son sayfaya git', 'page 100'],
  ['ilk sayfa', 'page 1'],
  ['ILK SAYFAYA GIT', 'page 1'],
  ['go to settings', 'none'],
  ['go to next page', 'none'],
  ['show section numbers', 'none'],
  ['Yöntem BAŞLIĞINA git', 'heading "Yöntem" Yöntem'],
  ['YÖNTEM BAŞLIĞINA GİT', 'heading "YÖNTEM" Yöntem'],
  ['Yöntem’e git', 'heading "Yöntem" Yöntem'],
  ['open pdf', 'none'],
  ['open file', 'none'],
  ['open recent', 'none'],
  ['aç dosya', 'none'],
  ['aç son', 'none'],
  ['delete this', 'none'],
  ['remove this', 'none'],
  ['bu sil', 'none'],
  ['rotate this', 'none'],
  ['delete 2 pages', 'invalid pages ambiguous-count'],
  ['rotate 3 pages left', 'invalid pages ambiguous-count'],
  ['delete 2-3 pages', 'delete 2-3 -> pages.delete'],
  ['3a', 'none'],
  ['delete 3a', 'none'],
  ['3. sayfayı çıkar', 'delete 3 -> pages.delete'],
  ['sayfa 3 çıkar', 'delete 3 -> pages.delete'],
  ['5-8 ayıkla', 'extract 5-8 -> pages.extract'],
  ['5-8 ayrı dosya olarak çıkar', 'extract 5-8 -> pages.extract'],
  ['5-8 sayfaları ayrı dosya olarak çıkar', 'extract 5-8 -> pages.extract'],
  // Not intents: left to the command list.
  ['open', 'none'],
  ['open files', 'none'],
  ['open nothing-like-that', 'none'],
  ['aç', 'none'],
  ['go to', 'none'],
  ['go to page', 'none'],
  ['git', 'none'],
  ['rotate', 'none'],
  ['rotate right', 'none'],
  ['rotate pages', 'none'],
  ['delete', 'none'],
  ['delete pages', 'none'],
  ['delete annotation', 'none'],
  ['delete image', 'none'],
  ['remove password', 'none'],
  ['remove page numbers', 'none'],
  ['sil', 'none'],
  ['sayfa', 'none'],
  ['sayfaları sil', 'none'],
  ['sayfayı döndür', 'none'],
  ['copy', 'none'],
  ['extract', 'none'],
  ['pages', 'none'],
  ['compress', 'none'],
  ['küçült', 'none'],
  ['print', 'none'],
  ['zoom 150', 'none'],
  ['merge', 'none'],
  ['', 'none'],
  ['   ', 'none'],
  ['ink', 'none'],
  ['kalem', 'none'],
  ['12x', 'none'],
  ['3-7', 'none'],
  ['1.5', 'none'],
];

function evens(): number[] {
  return Array.from({ length: 50 }, (_, i) => 2 * i + 2);
}
function odds(): number[] {
  return Array.from({ length: 50 }, (_, i) => 2 * i + 1);
}

describe('query corpus', () => {
  it('has at least 200 queries in both languages', () => {
    expect(cases.length).toBeGreaterThanOrEqual(200);
  });

  it.each(cases)('%j reads as %s', (query, expected) => {
    expect(show(parseQuery(query, ctx))).toBe(expected);
  });
});

describe('what an intent carries', () => {
  it('hands the palette the resolved pages, ascending and without duplicates', () => {
    const intent = parseQuery('delete 7-9 and 8 and 2', ctx);
    expect(intent).toMatchObject({ kind: 'pages', pages: [2, 7, 8, 9], pagesLabel: '2, 7-9' });
  });

  it('names the failing page and the page count of an invalid phrase', () => {
    expect(parseQuery('delete 90-120', ctx)).toEqual({
      kind: 'invalid',
      reason: 'out-of-range',
      for: 'pages',
      pageCount: 100,
      page: 120,
      action: 'delete',
      turns: undefined,
      pagesLabel: '90-120',
    });
  });

  it('carries the verb and the typed pages of an invalid rotation', () => {
    expect(parseQuery('rotate 2-99 right', { ...ctx, pageCount: 50 })).toMatchObject({
      kind: 'invalid',
      action: 'rotate',
      turns: 1,
      pagesLabel: '2-99',
    });
    expect(parseQuery('rotate 2-99 180', { ...ctx, pageCount: 50 })).toMatchObject({ turns: 2 });
    expect(parseQuery('delete all', ctx)).toMatchObject({
      action: 'delete',
      pagesLabel: undefined,
    });
  });

  it('says there is no document when none is open', () => {
    const none: QueryContext = { pageCount: 0 };
    expect(parseQuery('42', none)).toMatchObject({ kind: 'invalid', reason: 'no-document' });
    expect(parseQuery('delete 4-6', none)).toMatchObject({
      kind: 'invalid',
      reason: 'no-document',
    });
  });

  it('reports an even selection of a one-page document as no pages', () => {
    expect(parseQuery('delete even pages', { pageCount: 1 })).toMatchObject({
      reason: 'no-pages',
    });
  });

  it('gives a heading intent its pages and keeps the text as typed', () => {
    expect(parseQuery('go to Contributor agreement', ctx)).toMatchObject({
      kind: 'heading',
      text: 'Contributor agreement',
      pages: [88],
    });
    expect(parseQuery('go to Anything', { pageCount: 5 })).toBeNull();
  });

  it('reads a bare 90, 180 or 270 as degrees only when the pages are named otherwise', () => {
    const long: QueryContext = { pageCount: 200, currentPage: 12 };
    expect(show(parseQuery('rotate 180', long))).toBe('rotate 12 2 -> pages.rotateRight');
    expect(show(parseQuery('rotate page 180', long))).toBe('rotate 180 1 -> pages.rotateRight');
    expect(show(parseQuery('rotate 5 180', long))).toBe('rotate 5 2 -> pages.rotateRight');
    expect(show(parseQuery('rotate 150 180', long))).toBe('rotate 150 2 -> pages.rotateRight');
    expect(show(parseQuery('rotate 180 sağa', long))).toBe('rotate 12 2 -> pages.rotateRight');
  });

  it('formats page lists', () => {
    expect(formatPages([1, 2, 3, 7, 9, 10])).toBe('1-3, 7, 9-10');
    expect(formatPages([])).toBe('');
  });
});
