/** The Text view flag (text-view-flag.ts): the address, then Labs, off by default. */
import { afterEach, describe, expect, it } from 'vitest';

import { LABS_KEY } from '../labs/stored';
import { decideTextView, resetTextViewFlag, textViewOn } from './text-view-flag';

describe('the Text view flag (?textview)', () => {
  afterEach(() => {
    resetTextViewFlag();
    localStorage.removeItem(LABS_KEY);
  });

  it('is off by default; the address wins over the Labs toggle', () => {
    expect(decideTextView('', null)).toBe(false);
    expect(decideTextView('?textview=1', null)).toBe(true);
    expect(decideTextView('', '1')).toBe(true);
    expect(decideTextView('?textview=0', '1')).toBe(false);
    expect(decideTextView('?textview=1', '0')).toBe(true);
    expect(decideTextView('?textview=bogus', '1')).toBe(true);
    expect(decideTextView('?textview=bogus', null)).toBe(false);
  });

  it('reads the Labs toggle once per page', () => {
    localStorage.setItem(LABS_KEY, JSON.stringify({ shown: true, flags: { 'text-view': '1' } }));
    expect(textViewOn()).toBe(true);
    localStorage.removeItem(LABS_KEY);
    expect(textViewOn()).toBe(true);
    resetTextViewFlag();
    expect(textViewOn()).toBe(false);
  });
});
