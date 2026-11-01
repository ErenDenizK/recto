/**
 * Targets other than pages (PRD-39, spec §2.3): sizes, degrees and direction, formats, the
 * finder's patterns, languages, where pages move to, and how a document splits.
 */
import { describe, expect, it } from 'vitest';

import {
  formatOf,
  readLanguage,
  readPatterns,
  readRelation,
  readSize,
  readSplit,
  readTurn,
  splitParts,
  turnsOf,
} from './targets';
import { tokenise } from './tokenise';

const toks = (text: string) => tokenise(text).tokens;
const MB = 1024 ** 2;

describe('sizes', () => {
  it.each([
    ['2 MB', 2 * MB],
    ['2MB', 2 * MB],
    ['1,5 MB', 1.5 * MB],
    ['1.5 mb', 1.5 * MB],
    ['500 KB', 500 * 1024],
    ['500kb', 500 * 1024],
    ['2 megabayt', 2 * MB],
    ['3 megabyte', 3 * MB],
    ['100 kilobayt', 100 * 1024],
    ['1 GB', 1024 ** 3],
    ['700k', 700 * 1024],
    ['2m', 2 * MB],
    ['under 2 MB', 2 * MB],
    ['below 2 MB', 2 * MB],
    ['less than 2 MB', 2 * MB],
    ['smaller than 2 MB', 2 * MB],
    ['at most 2 MB', 2 * MB],
    ['max 2 MB', 2 * MB],
    ['<2MB', 2 * MB],
    ['2 MB altına', 2 * MB],
    ['2 MB altında', 2 * MB],
    ['en fazla 2 MB', 2 * MB],
    ['en çok 2 MB', 2 * MB],
    ['maksimum 2 MB', 2 * MB],
    ['2 MB geçmesin', 2 * MB],
    ["2 MB'dan küçük", 2 * MB],
    ["2 MB'dan az", 2 * MB],
    ["2 MB'a", 2 * MB],
  ])('reads %s', (text, bytes) => {
    const found = readSize(toks(text));
    expect(found?.value).toBe(bytes);
    expect(found?.rest).toEqual([]);
  });

  it.each([
    "2 MB'den fazla",
    'fazla 2 MB',
    "en az 2 MB'a",
    'at least 2 MB',
    'more than 2 MB',
    'larger than 2 MB',
  ])('does not take %s for a ceiling', (text) => {
    expect(readSize(toks(text))).toBeNull();
  });

  it('is not a size without a unit or with two', () => {
    expect(readSize(toks('2'))).toBeNull();
    expect(readSize(toks('2 MB 3 MB'))).toBeNull();
    expect(readSize(toks('3 m b'))).toBeNull();
  });
});

describe('degrees and direction', () => {
  it.each([
    ['90 derece', 90, 0],
    ['180°', 180, 0],
    ['270 degrees', 270, 0],
    ['right', null, 1],
    ['clockwise', null, 1],
    ['cw', null, 1],
    ['sağa', null, 1],
    ['saat yönünde', null, 1],
    ['left', null, -1],
    ['ccw', null, -1],
    ['counterclockwise', null, -1],
    ['anticlockwise', null, -1],
    ['sola', null, -1],
    ['saatin tersine', null, -1],
    ['90 derece sola', 90, -1],
  ])('reads %s', (text, deg, dir) => {
    expect(readTurn(toks(text))?.value).toEqual({ deg, dir });
  });

  it('refuses a turn that is not a quarter', () => {
    expect(readTurn(toks('135°'))).toBeNull();
    expect(readTurn(toks('90° 180°'))).toBeNull();
  });

  it('turns quarters the way PRD-23 did', () => {
    expect(turnsOf(0, null)).toBe(1);
    expect(turnsOf(1, 90)).toBe(1);
    expect(turnsOf(-1, 90)).toBe(-1);
    expect(turnsOf(0, 270)).toBe(-1);
    expect(turnsOf(1, 180)).toBe(2);
    expect(turnsOf(-1, 180)).toBe(2);
  });
});

describe('formats', () => {
  it.each([
    ['jpg', 'img', 'jpeg'],
    ['JPEG', 'img', 'jpeg'],
    ["JPG'ye", 'img', 'jpeg'],
    ['png', 'img', 'png'],
    ['webp', 'img', 'webp'],
    ['resim', 'img', 'jpeg'],
    ['resme', 'img', 'jpeg'],
    ['görsel', 'img', 'jpeg'],
    ['fotoğraf', 'img', 'jpeg'],
    ['image', 'img', 'jpeg'],
    ['picture', 'img', 'jpeg'],
    ['txt', 'txt', 'text'],
    ['text', 'txt', 'text'],
    ['metne', 'txt', 'text'],
    ['md', 'txt', 'markdown'],
    ['markdown', 'txt', 'markdown'],
  ])('knows %s', (text, kind, fmt) => {
    expect(formatOf(toks(text)[0] as never)).toMatchObject({ kind, fmt });
  });

  it.each([
    ['word', 'word'],
    ['docx', 'word'],
    ['Excel', 'excel'],
    ['xlsx', 'excel'],
    ['PowerPoint', 'powerpoint'],
    ['pptx', 'powerpoint'],
    ['sunum', 'powerpoint'],
    ["Word'e", 'word'],
  ])('knows %s as an office format', (text, which) => {
    expect(formatOf(toks(text)[0] as never)).toMatchObject({ kind: 'off', which });
  });

  it('needs a verb for the plain nouns but not for the file types', () => {
    expect(formatOf(toks('jpg')[0] as never)).toMatchObject({ generic: false });
    expect(formatOf(toks('resim')[0] as never)).toMatchObject({ generic: true });
    expect(formatOf(toks('text')[0] as never)).toMatchObject({ generic: true });
  });
});

describe('redaction patterns', () => {
  it.each([
    ['iban', ['iban']],
    ["IBAN'ları", ['iban']],
    ['email', ['email']],
    ['e-posta', ['email']],
    ['mail', ['email']],
    ['phone', ['phone']],
    ['telefon', ['phone']],
    ['gsm', ['phone']],
    ['tckn', ['tckn']],
    ['tc kimlik', ['tckn']],
    ['kimlik no', ['tckn']],
    ['tc no', ['tckn']],
    ['card', ['card']],
    ['kredi kartı', ['card']],
    ['credit card', ['card']],
    ['date', ['date']],
    ['tarih', ['date']],
    ['iban and email', ['email', 'iban']],
  ])('reads %s', (text, ids) => {
    expect(readPatterns(toks(text))?.value).toEqual(ids);
  });

  it.each(['personal', 'sensitive', 'pii', 'kişisel', 'hassas'])(
    'reads %s as every pattern but the date',
    (word) => {
      expect(readPatterns(toks(word))?.value).toEqual(['email', 'iban', 'card', 'tckn', 'phone']);
    },
  );
});

describe('languages and moves', () => {
  it('knows the languages translation would be asked for', () => {
    for (const w of ['türkçeye', 'ingilizceye', 'English', 'german', "Almanca'ya"]) {
      expect(readLanguage(toks(w)), w).not.toBeNull();
    }
    expect(readLanguage(toks('pages'))).toBeNull();
  });

  it.each([
    ['before 2', { before: 2 }],
    ['before page 2', { before: 2 }],
    ["2'nin önüne", { before: 2 }],
    ['2. sayfanın önüne', { before: 2 }],
    ['after 8', { after: 8 }],
    ["8'in arkasına", { after: 8 }],
    ['to the end', 'end'],
    ['sona', 'end'],
    ['en sona', 'end'],
    ['to the start', 'start'],
    ['başa', 'start'],
  ])('reads %s', (text, to) => {
    expect(readRelation(toks(text))?.value).toEqual(to);
  });

  it('keeps the page being moved', () => {
    expect(readRelation(toks("5'i 2'nin önüne"))?.rest.map((t) => t.n)).toEqual([5]);
    expect(readRelation(toks('5 before 2'))?.rest.map((t) => t.n)).toEqual([5]);
  });
});

describe('splitting', () => {
  it.each([
    ['every 10 pages', { every: 10 }],
    ['her 10 sayfada', { every: 10 }],
    ['10 sayfada bir', { every: 10 }],
    ['at 10', { at: [10] }],
    ['10. sayfadan', { at: [10] }],
    ['into 3 parts', { parts: 3 }],
    ['3 parçaya', { parts: 3 }],
    ['after 10', { at: [11] }],
    ['10. sayfadan sonra', { at: [11] }],
    ["10'dan sonra", { at: [11] }],
    ['at 10 and 20', { at: [10, 20] }],
    ['at 10, 20', { at: [10, 20] }],
    ['10 ve 20', { at: [10, 20] }],
    ['after 10 and 20', { at: [11, 21] }],
  ])('reads %s', (text, how) => {
    const reads = readSplit(toks(text));
    expect(reads).toHaveLength(1);
    expect(reads?.[0]?.how).toEqual(how);
  });

  it('refuses cut points that are not joined or mix with a count', () => {
    expect(readSplit(toks('10 20'))).toBeNull();
    expect(readSplit(toks('every 10 and 20'))).toBeNull();
  });

  it('reads a bare number two ways: every N, or a new part at N', () => {
    const reads = readSplit(toks('10'));
    expect(reads?.map((r) => r.how)).toEqual([{ every: 10 }, { at: [10] }]);
    expect(reads?.map((r) => r.weight)).toEqual([1, 0.8]);
  });

  it('makes the parts of a split', () => {
    expect(splitParts(24, { every: 10 })).toEqual([
      [1, 10],
      [11, 20],
      [21, 24],
    ]);
    expect(splitParts(24, { at: [10] })).toEqual([
      [1, 9],
      [10, 24],
    ]);
    expect(splitParts(24, { parts: 3 })).toEqual([
      [1, 8],
      [9, 16],
      [17, 24],
    ]);
    expect(splitParts(10, { parts: 3 })).toEqual([
      [1, 3],
      [4, 6],
      [7, 10],
    ]);
    expect(splitParts(24, { every: 30 })).toEqual([[1, 24]]);
    expect(splitParts(24, { parts: 30 })).toEqual([]);
    expect(splitParts(24, 'choose')).toEqual([]);
  });
});
