/**
 * Clauses, ellipsis, run order and chain problems (PRD-39, spec §2.8, §2.9).
 */
import { describe, expect, it } from 'vitest';

import { FIXTURES, type FixtureName } from './corpus/fixtures';
import { show } from './corpus/show';
import { actionWords, splitClauses } from './grammar';
import { parseIntent } from './parse';
import { tokenise } from './tokenise';

const read = (text: string, ctx: FixtureName = 'DOC24') =>
  show(parseIntent(text, FIXTURES[ctx]), FIXTURES[ctx].pageCount);
const clausesOf = (text: string): string[] => {
  const { tokens, original } = tokenise(text);
  return splitClauses(tokens, actionWords(tokens).idx).map((c) =>
    original.slice((c[0] as { start: number }).start, (c.at(-1) as { end: number }).end),
  );
};

describe('where a sentence is cut', () => {
  it('cuts at a conjunction only when both sides have a verb', () => {
    expect(clausesOf('3 ve 5. sayfaları döndür')).toEqual(['3 ve 5. sayfaları döndür']);
    expect(clausesOf('3. sayfayı döndür ve 5. sayfayı sil')).toEqual([
      '3. sayfayı döndür',
      '5. sayfayı sil',
    ]);
    expect(clausesOf('rotate 3 and 5 and delete 7')).toEqual(['rotate 3 and 5', 'delete 7']);
    expect(clausesOf('rotate 3, 5, 7')).toEqual(['rotate 3, 5, 7']);
    expect(clausesOf('rotate 3; delete 5')).toEqual(['rotate 3', 'delete 5']);
  });

  it('counts a bare format or size as a verb', () => {
    expect(clausesOf('rotate 3 and jpg')).toEqual(['rotate 3', 'jpg']);
    expect(clausesOf('rotate 3 and 2 MB')).toEqual(['rotate 3', '2 MB']);
  });

  it('cuts at then and sonra', () => {
    expect(clausesOf('rotate 3 then delete 5')).toEqual(['rotate 3', 'delete 5']);
    expect(clausesOf('3. sayfayı döndür sonra sil')).toEqual(['3. sayfayı döndür', 'sil']);
  });
});

describe('ellipsis', () => {
  it('lets a trailing page join the clause (verb ellipsis)', () => {
    expect(read("3'ü döndür ve 5'i")).toBe('rotate 3,5 +1');
    expect(read('delete 3 and 5')).toBe('delete 3,5');
  });

  it("takes the previous clause's pages when a clause has none (page ellipsis)", () => {
    expect(read('3. sayfayı döndür ve çoğalt')).toBe('rotate 3 +1 ; duplicate 3 (inherited)');
    expect(read('3-5 ayıkla ve çoğalt')).toBe('duplicate 3-5 (inherited) ; extract 3-5');
  });

  it('also through a pronoun, which needs something to point at', () => {
    expect(read('rotate 3 and duplicate it')).toBe('rotate 3 +1 ; duplicate 3 (inherited)');
    expect(read('3. sayfayı döndür ve onu sil')).toBe('rotate 3 +1 ; delete 3 (inherited)');
    expect(read('duplicate it')).toBe('none');
  });

  it('does not inherit a default', () => {
    expect(read('sil ve döndür')).toBe('! needs-pages delete ; rotate 7 +1');
  });

  it("fills the next clause's page from a go to, and drops the go to", () => {
    expect(read('son sayfaya git ve imzala')).toBe('sign 24');
    expect(read('5. sayfaya git ve sil')).toBe('delete 5');
    expect(read('go to 5 and rotate')).toBe('rotate 5 +1');
  });

  it('lets a navigation step stand alone only', () => {
    expect(read('rotate 3 and go to 5')).toBe('none');
    expect(read('find invoice and rotate 3')).toBe('none');
    expect(read('go to 5 and 3. sayfayı sil')).toBe('none');
  });
});

describe('run order', () => {
  it('runs document steps in typed order and the one finishing step last', () => {
    expect(read('sıkıştır ve döndür')).toBe('rotate 7 +1 ; compress');
    expect(read('compress and rotate 3 and delete 5')).toBe('rotate 3 +1 ; delete 5 ; compress');
    expect(read('print and delete 3')).toBe('delete 3 ; print');
  });

  it('reads every page number against the document as it is', () => {
    expect(read('son sayfayı sil ve 1. sayfayı döndür')).toBe('delete 24 ; rotate 1 +1');
    expect(read('delete 1 and rotate 24')).toBe('delete 1 ; rotate 24 +1');
  });
});

describe('chain problems', () => {
  it.each([
    ['rotate 3 and compress and print', '! two-finishing rotate 3 +1 ; compress ; print'],
    ['print and extract 3-5', '! two-finishing print ; extract 3-5'],
    [
      'split every 10 and rotate 3',
      '! after-split split every 10 [1-10 11-20 21-24] ; rotate 3 +1',
    ],
    ['delete 3 and add page numbers to 5', '! shifted delete 3 ; numbers 5'],
    ['reverse and add page numbers to 3-5', '! shifted reverse all ; numbers 3-5'],
    ['delete 3 and add page numbers', 'delete 3 ; numbers all'],
    ['delete 3 and add page numbers to even pages', 'delete 3 ; numbers even'],
    ['add page numbers to 3 and 5', '! not-a-run numbers 3,5'],
    ['add watermark DRAFT to 2 and 4', '! not-a-run watermark "DRAFT" 2,4'],
    ['delete 1-12 and delete 13-24', '! all-pages delete 1-12 ; delete 13-24'],
    ['delete 1-12 and 12-24', '! all-pages delete 1-24'],
    ['delete 3 and duplicate 3', '! shifted delete 3 ; duplicate 3'],
    ['extract 3-5 and delete 3', '! shifted delete 3 ; extract 3-5'],
    ['split every 30', '! single-part split every 30 [1-24]'],
    ['delete', '! needs-pages delete'],
    ['duplicate', '! needs-pages duplicate'],
  ])('%s', (text, expected) => {
    expect(read(text)).toBe(expected);
  });

  it('puts the problem on the step it belongs to, in run order', () => {
    const result = parseIntent('compress and delete 1-24', FIXTURES.DOC24);
    expect(result.kind === 'readings' && result.readings[0].problem).toMatchObject({
      kind: 'all-pages',
      step: 0,
    });
    const phone = parseIntent('rotate 3 and ocr', FIXTURES.PHONE);
    expect(phone.kind === 'readings' && phone.readings[0].problem).toMatchObject({
      kind: 'phone',
      step: 1,
    });
  });

  it('never leaves a chain half-read: any problem means none of it runs', () => {
    const result = parseIntent('rotate 3 and delete 1-24', FIXTURES.DOC24);
    expect(result.kind === 'readings' && result.readings.every((r) => r.problem !== null)).toBe(
      true,
    );
  });
});

describe('every word understood', () => {
  it('rejects a clause with a word no slot takes, and says which when it is unknown', () => {
    expect(read('rotate 3 yamuk')).toBe('partial rotate "yamuk"');
    expect(read('delete 3 yamuk and rotate 4')).toBe('partial delete "yamuk"');
  });

  it('gives a known word of another action the command list, not a partial row', () => {
    expect(read('delete annotation')).toBe('none');
    expect(read('compress 3-5')).toBe('none');
    expect(read('print 3')).toBe('none');
  });

  it('keeps negation and "-daki" from ever acting, in a chain too', () => {
    expect(read('rotate 3 and don’t delete 5')).toBe('none');
    expect(read('3. sayfayı döndür ve 5. sayfadaki resmi sil')).toBe('none');
    expect(read('döndür ve silme')).toBe('none');
  });

  it('keeps the object words for the actions that take them', () => {
    expect(read('dosyayı sil')).toBe('none');
    expect(read('delete the file')).toBe('none');
    expect(read("pdf'i böl")).toBe('split choose');
    expect(read('dosyayı küçült')).toBe('compress');
    expect(read('make it smaller')).toBe('compress');
  });
});

describe('typos', () => {
  it('corrects a word of five letters or more, at a lower score, and says so', () => {
    const r = parseIntent('döndr 3', FIXTURES.DOC24);
    expect(r.kind === 'readings' && r.readings[0].corrected).toEqual([
      { typed: 'döndr', read: 'dondur' },
    ]);
    const exact = parseIntent('döndür 3', FIXTURES.DOC24);
    const score = (x: typeof r): number => (x.kind === 'readings' ? x.readings[0].score : 0);
    expect(score(r)).toBeGreaterThan(0);
    expect(score(r)).toBeLessThan(score(exact));
  });

  it('leaves shorter words alone', () => {
    expect(read('delt 3')).toBe('none');
    expect(read('sill 3')).toBe('none');
  });
});
