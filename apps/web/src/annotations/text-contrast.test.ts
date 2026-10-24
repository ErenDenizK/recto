/** The default text colour by the page under a new box (TXT-23). */
import { describe, expect, it } from 'vitest';

import { INK } from './palette';
import { explicitTextColor, LIGHT_TEXT, textColorOn } from './text-contrast';

describe('textColorOn', () => {
  it('keeps the ink black on light pages and goes white on dark ones', () => {
    expect(textColorOn([255, 255, 255])).toBe(INK.black);
    expect(textColorOn([240, 230, 200])).toBe(INK.black);
    expect(textColorOn([0, 0, 0])).toBe(LIGHT_TEXT);
    expect(textColorOn([20, 24, 40])).toBe(LIGHT_TEXT);
  });
});

describe('explicitTextColor', () => {
  it('lets a picked colour win, and treats the default as not chosen', () => {
    expect(explicitTextColor(false, INK.black)).toBe(false);
    expect(explicitTextColor(false, INK.blue)).toBe(true);
    expect(explicitTextColor(true, INK.black)).toBe(true);
  });
});
