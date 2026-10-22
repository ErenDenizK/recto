import { describe, expect, it } from 'vitest';

import { cutLeading, cutSnippet, cutTrailing } from './snippet';

const LONG = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo ';

describe('cutLeading / cutTrailing', () => {
  it('leave short text alone', () => {
    expect(cutLeading('a short bit')).toBe('a short bit');
    expect(cutTrailing('a short bit')).toBe('a short bit');
  });

  it('cut at a word, about 40 characters from the match', () => {
    const lead = cutLeading(LONG);
    expect(lead.startsWith('…')).toBe(true);
    expect(lead.length).toBeLessThanOrEqual(41);
    expect(lead.length).toBeGreaterThan(30);
    // Every word of the cut is a whole word of the text.
    for (const word of lead.slice(1).split(' ').filter(Boolean)) {
      expect(LONG.split(' ')).toContain(word);
    }
    const trail = cutTrailing(LONG);
    expect(trail.endsWith('…')).toBe(true);
    expect(trail.length).toBeLessThanOrEqual(41);
    for (const word of trail.slice(0, -1).split(' ').filter(Boolean)) {
      expect(LONG.split(' ')).toContain(word);
    }
  });

  it('cut a single long word where it stands', () => {
    const word = 'x'.repeat(100);
    expect(cutLeading(word)).toBe(`…${'x'.repeat(40)}`);
    expect(cutTrailing(word)).toBe(`${'x'.repeat(40)}…`);
  });

  it('do not split a surrogate pair', () => {
    const emoji = '😀'.repeat(60);
    expect(cutLeading(emoji)).not.toMatch(/^…[\uDC00-\uDFFF]/);
    expect(cutTrailing(emoji)).not.toMatch(/[\uD800-\uDBFF]…$/);
  });
});

describe('cutSnippet', () => {
  it('uses the engine offsets', () => {
    const s = cutSnippet(
      { context: 'Go to page 4 now', matchStart: 6, matchLength: 4 },
      'x',
      false,
    );
    expect(s).toEqual({ before: 'Go to ', match: 'page', after: ' 4 now' });
  });

  it('trims a long English line on both sides of the match', () => {
    const context =
      'In the beginning of the long and winding road there stood the quick brown fox, who jumped over the lazy dog every single morning without fail.';
    const start = context.indexOf('fox');
    const s = cutSnippet({ context, matchStart: start, matchLength: 3 }, 'fox', false);
    expect(s.match).toBe('fox');
    expect(s.before.startsWith('…')).toBe(true);
    expect(s.after.endsWith('…')).toBe(true);
    expect(s.before.length).toBeLessThanOrEqual(41);
    expect(s.after.length).toBeLessThanOrEqual(41);
  });

  it('finds the query by Turkish case folding without shifting offsets', () => {
    // "İ" lower-cases to two code units; the match must still land on the right word.
    const first = cutSnippet({ context: 'İSTANBUL ve İZMİR' }, 'istanbul', false);
    expect(first).toEqual({ before: '', match: 'İSTANBUL', after: ' ve İZMİR' });
    const later = cutSnippet({ context: 'İZMİR İSTANBUL' }, 'istanbul', false);
    expect(later).toEqual({ before: 'İZMİR ', match: 'İSTANBUL', after: '' });
  });

  it('keeps Turkish words whole when it cuts', () => {
    const context =
      'Şeker, çay ve ığdır’dan gelen güzel kayısılar için öğrencilerin Çağrı Merkezi’ni aradığı gün hava çok güzeldi.';
    const start = context.indexOf('Çağrı');
    const s = cutSnippet({ context, matchStart: start, matchLength: 5 }, 'çağrı', false);
    expect(s.match).toBe('Çağrı');
    expect(s.before).toBe('…gelen güzel kayısılar için öğrencilerin ');
    expect(s.after).toBe(' Merkezi’ni aradığı gün hava çok…');
  });

  it('with no match shows the start of the line', () => {
    expect(cutSnippet({ context: 'abc' }, 'zzz', true)).toEqual({
      before: '',
      match: '',
      after: 'abc',
    });
  });
});
