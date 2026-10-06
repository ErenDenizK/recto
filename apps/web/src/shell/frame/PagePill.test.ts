import { afterEach, describe, expect, it } from 'vitest';

import { setLocale } from '../../i18n';
import { pillMinChars, pillText } from './PagePill';
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

  it('rises above a bar that comes within 12 px of it (spec 01.6)', () => {
    expect(pillMustRise(1000, 1013)).toBe(false);
    expect(pillMustRise(1000, 1011)).toBe(true);
  });
});
