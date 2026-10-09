import { afterEach, describe, expect, it } from 'vitest';

import { setLocale } from '../../i18n';
import { pillMinChars, pillParts, pillText } from './PagePill';
import { rollDirection } from './PillRoll';
import { pillMustRise } from './DockBand';

afterEach(() => setLocale('en'));

describe('the page pill (01-frame F11 §5)', () => {
  it('reads "3 / 12 · 96%", and names page, total and zoom', () => {
    expect(pillText('3', 2, 12, 0.96)).toEqual({
      text: '3 / 12 · 96%',
      name: 'Page 3 of 12, zoom 96%. Page and view options',
    });
  });

  it('leads with a page label that differs from the number', () => {
    expect(pillText('iii', 2, 12, 1).text).toBe('iii (3 / 12) · 100%');
  });

  it('says "– / 0" with no pages', () => {
    expect(pillText(undefined, 0, 0, 1).text).toBe('– / 0 · 100%');
  });

  it('puts the percent sign first in Turkish', () => {
    setLocale('tr');
    expect(pillText('3', 2, 12, 0.96).text).toBe('3 / 12 · %96');
  });

  it('keeps room for the digits of the total, so scrolling never changes its width', () => {
    expect(pillMinChars(9, 4)).toBe(8);
    expect(pillMinChars(400, 4)).toBe(12);
    expect(pillMinChars(400, 4)).toBe(pillMinChars(999, 4));
  });

  it('splits the text into runs whose page rolls and whose percentage fades (frame.md §4)', () => {
    const join = (parts: ReturnType<typeof pillParts>) => parts.map((p) => p.value).join('');
    for (const locale of ['en', 'tr'] as const) {
      setLocale(locale);
      expect(join(pillParts('3', 2, 12, 0.96))).toBe(pillText('3', 2, 12, 0.96).text);
      expect(join(pillParts('iii', 2, 12, 1))).toBe(pillText('iii', 2, 12, 1).text);
      expect(join(pillParts(undefined, 0, 0, 1))).toBe(pillText(undefined, 0, 0, 1).text);
    }
    setLocale('en');
    expect(pillParts('3', 2, 12, 0.96).map((p) => p.kind)).toEqual(['page', 'text', 'percent']);
  });

  it('rolls up as the page number rises and down as it falls', () => {
    expect(rollDirection('9', '10')).toBe(1);
    expect(rollDirection('10', '9')).toBe(-1);
    expect(rollDirection('ii', 'iii')).toBe(1);
  });

  it('rises above a bar that comes within 12 px of it (spec 01.6)', () => {
    expect(pillMustRise(1000, 1013)).toBe(false);
    expect(pillMustRise(1000, 1011)).toBe(true);
  });
});
