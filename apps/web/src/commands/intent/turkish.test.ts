/**
 * Turkish word forms (PRD-39, spec §2.4): a token matches a stem only with an allowed suffix
 * chain; apostrophes split; "-daki" and any negation never act; verb forms need their particle.
 */
import { describe, expect, it } from 'vitest';

import { tokenise } from './tokenise';
import {
  isLocativeAdjective,
  isNegator,
  isNoun,
  NOUN_CHAINS,
  oneStepApart,
  verbOf,
} from './turkish';

const tok = (text: string) =>
  tokenise(text).tokens[0] as ReturnType<typeof tokenise>['tokens'][number];

describe('noun chains', () => {
  it('builds a few hundred endings, once', () => {
    expect(NOUN_CHAINS.size).toBeGreaterThan(200);
    expect(NOUN_CHAINS.size).toBeLessThan(1500);
    expect(NOUN_CHAINS.has('')).toBe(true);
  });

  it.each([
    ['sayfa', 'sayfa'],
    ['sayfayı', 'sayfa'],
    ['sayfalar', 'sayfa'],
    ['sayfaları', 'sayfa'],
    ['sayfalarını', 'sayfa'],
    ['sayfaya', 'sayfa'],
    ['sayfadan', 'sayfa'],
    ['sayfanın', 'sayfa'],
    ['sayfamız', 'sayfa'],
    ["IBAN'ları", 'iban'],
    ["PDF'i", 'pdf'],
    ["JPG'ye", 'jpg'],
    ["Word'ü", 'word'],
    ['filigranı', 'filigran'],
    ['imzamı', 'imza'],
    ['imzayla', 'imza'],
    ['dosyayı', 'dosya'],
    ['boyutunu', 'boyut'],
    ['belgelerini', 'belge'],
  ])('accepts %s as %s', (typed, stem) => {
    expect(isNoun(tok(typed), stem)).toBe(true);
  });

  it.each([
    ['sayfax', 'sayfa'],
    ['sayfalarx', 'sayfa'],
    ['sayfaz', 'sayfa'],
    ['sayfayıne', 'sayfa'],
    ['sayfalık', 'sayfa'],
    ['ibanx', 'iban'],
    ['dosyalarlarla', 'dosya'],
  ])('rejects %s as %s', (typed, stem) => {
    expect(isNoun(tok(typed), stem)).toBe(false);
  });

  it('splits at an apostrophe and checks the suffix like any other', () => {
    const t = tok("PDF'i");
    expect([t.text, t.suf]).toEqual(['pdf', 'i']);
    expect(isNoun(tok("PDF'xyz"), 'pdf')).toBe(false);
  });

  it('reads a stem with its consonant alternant when the lexicon lists both', () => {
    expect(verbOf(tok('kaydedin'), 'kayded')).toMatchObject({ negated: false });
    expect(verbOf(tok('kaydetmek'), 'kaydet')).toMatchObject({ form: 'nom' });
  });
});

describe('verb forms', () => {
  it.each([
    ['sil', 'imp'],
    ['silin', 'imp'],
    ['silini', undefined],
    ['siliniz', 'imp'],
    ['silelim', 'imp'],
    ['silmek', 'nom'],
    ['silmeyi', 'nom'],
    ['silmesi', 'nom'],
    ['silir', 'aor'],
    ['silebilir', 'aor'],
    ['döndürün', 'imp'],
    ['döndürelim', 'imp'],
    ['döndürmek', 'nom'],
    ['döndürür', 'aor'],
    ['koyun', 'imp'],
    ['koyabilir', 'aor'],
  ])('reads %s as %s', (typed, form) => {
    const stem = typed.startsWith('d') ? 'dondur' : typed.startsWith('k') ? 'koy' : 'sil';
    const match = verbOf(tok(typed), stem);
    if (form === undefined) expect(match).toBeNull();
    else expect(match).toEqual({ form, negated: false });
  });

  it.each([
    'silme',
    'silmeyin',
    'silmeden',
    'silmesin',
    'silmiyorum'.replace('mi', 'me'),
    'döndürme',
    'döndürmeyin',
  ])('treats %s as a negation', (typed) => {
    const stem = typed.startsWith('d') ? 'dondur' : 'sil';
    expect(verbOf(tok(typed), stem)?.negated).toBe(true);
  });

  it('leaves words that only start like the stem', () => {
    for (const word of ['silgi', 'silah', 'siluet']) expect(verbOf(tok(word), 'sil')).toBeNull();
  });
});

describe('words that never act', () => {
  it.each(['sayfadaki', 'sayfalardaki', 'belgedeki', 'tablodaki'])('%s is "the thing on…"', (w) => {
    expect(isLocativeAdjective(tok(w))).toBe(true);
  });
  it("sees the locative adjective after a number's apostrophe", () => {
    expect(isLocativeAdjective(tok("3'teki"))).toBe(true);
    expect(isLocativeAdjective(tok("3'ten"))).toBe(false);
  });
  it('lets the one -ki word that is not about a place through', () => {
    expect(isLocativeAdjective(tok('dışındaki'))).toBe(false);
  });
  it.each(["don't", 'dont', 'do not'.split(' ')[1] as string, 'never', 'not', "can't", 'without'])(
    'knows %s as a negator',
    (w) => {
      expect(isNegator(tok(w))).toBe(true);
    },
  );
  it('does not mistake other words for a negator', () => {
    for (const w of ['note', 'nothing', 'done', 'delete']) expect(isNegator(tok(w))).toBe(false);
  });
});

describe('ordinals and number endings', () => {
  it.each([
    ['3.', true],
    ["3'üncü", true],
    ["3'ncü", true],
    ['3rd', true],
    ['3üncü', false],
    ['3', false],
    ["3'ten", false],
  ])('reads %s as ordinal: %s', (typed, ord) => {
    const t = tok(typed);
    if (typed === '3üncü') expect(t.kind).toBe('word');
    else expect(t.ord).toBe(ord);
  });
  it('drops a case ending after an apostrophe', () => {
    expect(tok("7'ye").n).toBe(7);
    expect(tok("5'i").suf).toBe('i');
  });
  it('is not a page number when letters are glued on', () => {
    for (const w of ['3a', '12x', '3rdx']) expect(tok(w).kind).toBe('word');
  });
});

describe('typo distance', () => {
  it.each([
    ['dondr', 'dondur', true],
    ['rotat', 'rotate', true],
    ['rotaet', 'rotate', true],
    ['rotare', 'rotate', true],
    ['rotate', 'rotate', false],
    ['rota', 'rotate', false],
  ])('%s vs %s: %s', (a, b, near) => {
    expect(oneStepApart(a, b)).toBe(near);
  });
});
