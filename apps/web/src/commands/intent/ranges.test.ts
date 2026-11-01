/**
 * Page expressions (PRD-39, spec §2.3): every form of the table, Turkish and English, against a
 * 24-page document with page 7 in view and pages 3, 4 and 9 selected.
 */
import { describe, expect, it } from 'vitest';

import { FIXTURES } from './corpus/fixtures';
import { readPages } from './ranges';
import { tokenise } from './tokenise';
import type { IntentContext } from './types';

const CTX: IntentContext = FIXTURES.DOC24_SEL;
const read = (text: string, ctx: IntentContext = CTX) => readPages(tokenise(text).tokens, ctx);
const pagesOf = (text: string, ctx: IntentContext = CTX) => {
  const r = read(text, ctx);
  return r.kind === 'ok' ? r.pages : r.kind;
};
const run = (a: number, b: number): number[] => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('numbers, ranges and lists', () => {
  it.each([
    ['3', [3]],
    ['3-5', [3, 4, 5]],
    ['3–5', [3, 4, 5]],
    ['3..5', [3, 4, 5]],
    ['3 to 5', [3, 4, 5]],
    ['3 through 5', [3, 4, 5]],
    ['3, 5, 7', [3, 5, 7]],
    ['3 and 5', [3, 5]],
    ['1,3,5-7', [1, 3, 5, 6, 7]],
    ['3-7 and 5-9', run(3, 9)],
    ['3 ile 5', [3, 4, 5]],
    ["3'ten 5'e", [3, 4, 5]],
    ["3'ten 5'e kadar", [3, 4, 5]],
    ['3 ve 5', [3, 5]],
    ['4 ile 6 arası', [4, 5, 6]],
    ['pages 9, 2 and 4', [2, 4, 9]],
  ])('reads %s', (text, pages) => {
    expect(pagesOf(text)).toEqual(pages);
  });
});

describe('ordinals and number words', () => {
  it.each([
    ['3rd page', [3]],
    ['third page', [3]],
    ['tenth page', [10]],
    ['3. sayfa', [3]],
    ["3'üncü sayfa", [3]],
    ['üçüncü sayfa', [3]],
    ['birinci sayfa', [1]],
    ['onuncu sayfa', [10]],
    ['first two pages', [1, 2]],
    ['last three', [22, 23, 24]],
    ['ilk iki sayfa', [1, 2]],
    ['son üç sayfa', [22, 23, 24]],
    ['first twenty pages', run(1, 20)],
    ['ilk yirmi sayfa', run(1, 20)],
    ['first page', [1]],
    ['last page', [24]],
    ['ilk sayfa', [1]],
    ['son sayfa', [24]],
    ['first 3', [1, 2, 3]],
    ['ilk 3', [1, 2, 3]],
    ['last 2 pages', [23, 24]],
  ])('reads %s', (text, pages) => {
    expect(pagesOf(text)).toEqual(pages);
  });
});

describe('parity, everything, the page in view and the selection', () => {
  it.each([
    ['even', 'even'],
    ['odd', 'odd'],
    ['çift', 'even'],
    ['tek sayfaları', 'odd'],
    ['all', 'all'],
    ['every page', 'all'],
    ['whole document', 'all'],
    ['tüm sayfalar', 'all'],
    ['bütün', 'all'],
    ['hepsi', 'all'],
    ['hepsini', 'all'],
    ['this page', 'current'],
    ['current page', 'current'],
    ['bu sayfa', 'current'],
    ['mevcut sayfa', 'current'],
    ['selected pages', 'selection'],
    ['the selection', 'selection'],
    ['these pages', 'selection'],
    ['seçili sayfalar', 'selection'],
    ['seçtiklerim', 'selection'],
    ['bu sayfalar', 'selection'],
  ])('names %s as %s', (text, named) => {
    const r = read(text);
    expect(r.kind === 'ok' && r.named).toBe(named);
  });

  it('gives the pages of each', () => {
    expect(pagesOf('even')).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    expect(pagesOf('this page')).toEqual([7]);
    expect(pagesOf('selected pages')).toEqual([3, 4, 9]);
    expect(pagesOf('all')).toEqual(run(1, 24));
  });

  it('needs the page word for "this", as PRD-23 asked', () => {
    expect(pagesOf('this')).toBe('unknown');
    expect(pagesOf('bu')).toBe('unknown');
  });

  it('names a problem for an empty selection and a one-page even', () => {
    expect(read('selected pages', FIXTURES.DOC24)).toMatchObject({ problem: { kind: 'no-pages' } });
    expect(read('even', FIXTURES.DOC1)).toMatchObject({ problem: { kind: 'no-pages' } });
  });
});

describe('open ends, exceptions and pronouns', () => {
  it.each([
    ['5 to end', run(5, 24)],
    ['from 5 on', run(5, 24)],
    ['5 onwards', run(5, 24)],
    ["5'ten sona", run(5, 24)],
    ['5. sayfadan itibaren', run(5, 24)],
    ["5'ten sonrası", run(6, 24)],
    ['all except 3', [...run(1, 2), ...run(4, 24)]],
    ['all but 1-2', run(3, 24)],
    ['except 24', run(1, 23)],
    ['3 hariç', [...run(1, 2), ...run(4, 24)]],
    ['1-2 dışındaki', run(3, 24)],
    ['3 hariç tümü', [...run(1, 2), ...run(4, 24)]],
    ['even except 2', [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]],
  ])('reads %s', (text, pages) => {
    expect(pagesOf(text)).toEqual(pages);
  });

  it('hands a pronoun back for the previous clause', () => {
    for (const word of ['it', 'them', 'onu', 'onları']) expect(read(word).kind).toBe('pronoun');
  });
});

describe('what is not a page expression', () => {
  it.each([
    ['3a', ['3a']],
    ['yamuk', ['yamuk']],
    ['3 yamuk', ['yamuk']],
    ['delete', ['delete']],
  ])('hands back %s', (text, words) => {
    const r = read(text);
    expect(r.kind === 'unknown' && r.toks.map((t) => t.text)).toEqual(words);
  });

  it('keeps "3 pages" ambiguous, a count or a page', () => {
    expect(read('2 pages')).toMatchObject({ problem: { kind: 'ambiguous-count' } });
    expect(read('2-3 pages')).toMatchObject({ problem: null });
    expect(read('pages 2')).toMatchObject({ problem: null });
  });
});

describe('invalid expressions', () => {
  it.each([
    ['25', { kind: 'out-of-range', page: 25 }],
    ['0', { kind: 'out-of-range', page: 0 }],
    ['20-30', { kind: 'out-of-range', page: 30 }],
    ['7-3', { kind: 'reversed-range', page: 7 }],
    ['last 30', { kind: 'out-of-range', page: 30 }],
    ['first 0', { kind: 'out-of-range', page: 0 }],
  ])('names the problem of %s', (text, problem) => {
    expect(read(text)).toMatchObject({ problem });
  });

  it('says there is no document when none is open', () => {
    expect(read('3', FIXTURES.NODOC)).toMatchObject({ problem: { kind: 'no-document' } });
    expect(read('all', FIXTURES.NODOC)).toMatchObject({ problem: { kind: 'no-document' } });
  });
});

describe('number words and ordinals compose', () => {
  it.each([
    ['page twenty one', [21]],
    ['page twenty-one', [21]],
    ['twenty first page', [21]],
    ['eleventh page', [11]],
    ['sayfa on iki', [12]],
    ['on ikinci sayfa', [12]],
    ['yirmi birinci sayfa', [21]],
    ['ilk on iki sayfa', run(1, 12)],
    ['sayfa on', [10]],
    ['on page 3', [3]],
    ['from 5 on', run(5, 24)],
  ])('reads %s', (text, pages) => {
    expect(pagesOf(text)).toEqual(pages);
  });

  it.each(['page twenty twenty', 'sayfa bir iki', 'two', 'delete'])('does not read %s', (text) => {
    expect(read(text).kind).not.toBe('ok');
  });

  it('keeps "on" a filler when no Turkish word makes it ten', () => {
    expect(pagesOf('on page 3')).toEqual([3]);
    expect(pagesOf('on one')).toEqual('unknown');
  });
});

describe('counts, parity and "all" that would be misread', () => {
  it.each([
    'iki sayfayı',
    'bir sayfa',
    '3 sayfa',
    'on iki sayfayı',
    'two pages',
    'one page',
    '3 page',
    'all 3',
    'her ikinci sayfa',
    'everything on page 3',
  ])('refuses %s as ambiguous', (text) => {
    expect(read(text)).toMatchObject({ problem: { kind: 'ambiguous-count' } });
  });

  it('reads a cardinal as a page for "go to" only', () => {
    const toks = tokenise('7 sayfa').tokens;
    expect(readPages(toks, CTX, true)).toMatchObject({ pages: [7], problem: null });
    expect(readPages(toks, CTX)).toMatchObject({ problem: { kind: 'ambiguous-count' } });
  });

  it.each(['tek sayfayı', 'tek bir sayfa', 'çift sayfa', 'odd page', 'an even page'])(
    'does not read %s as parity',
    (text) => {
      expect(read(text).kind).toBe('unknown');
    },
  );

  it.each([
    ['tek sayfaları', 12],
    ['çift sayfalar', 12],
    ['tek numaralı sayfa', 12],
    ['odd pages', 12],
    ['even', 12],
  ])('reads %s as parity', (text, count) => {
    expect(pagesOf(text)).toHaveLength(count);
  });

  it('takes "her" only as a whole word', () => {
    expect(read('here').kind).toBe('unknown');
    expect(pagesOf('her sayfa')).toHaveLength(24);
  });
});

describe('range ends and edges counted from the end', () => {
  it.each([
    ["5'e kadar", run(1, 5)],
    ['5. sayfaya kadar', run(1, 5)],
    ['3 ve 5 arası', run(3, 5)],
    ['3 ile 5 arasını', run(3, 5)],
    ["5'ten sonra", run(6, 24)],
    ['5. sayfadan sonra', run(6, 24)],
    ["5'ten sona kadar", run(5, 24)],
    ['sondan ikinci sayfa', [23]],
    ['second to last page', [23]],
    ['page 3 of 24', [3]],
  ])('reads %s', (text, pages) => {
    expect(pagesOf(text)).toEqual(pages);
  });

  it.each(['page 3 of 30', 'first to last', '3 to last', 'sondan iki sayfa', '3 arası'])(
    'does not read %s',
    (text) => {
      expect(read(text).kind).toBe('unknown');
    },
  );

  it('says there is nothing after the last page', () => {
    expect(read("24'ten sonra")).toMatchObject({ problem: { kind: 'no-pages' } });
    expect(read("25'ten sonra")).toMatchObject({ problem: { kind: 'out-of-range', page: 25 } });
  });
});
