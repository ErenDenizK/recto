/** The phone capsule flag (phone-capsule-flag.ts): the address, then Labs, off by default. */
import { afterEach, describe, expect, it } from 'vitest';

import { LABS_KEY } from '../../labs/stored';
import { decidePhoneCapsule, phoneCapsule, resetPhoneCapsule } from './phone-capsule-flag';

describe('the phone capsule flag (?phonebar)', () => {
  afterEach(() => {
    resetPhoneCapsule();
    localStorage.removeItem(LABS_KEY);
  });

  it('is off by default; the address wins over the Labs toggle', () => {
    expect(decidePhoneCapsule('', null)).toBe(false);
    expect(decidePhoneCapsule('?phonebar=1', null)).toBe(true);
    expect(decidePhoneCapsule('', '1')).toBe(true);
    expect(decidePhoneCapsule('?phonebar=0', '1')).toBe(false);
    expect(decidePhoneCapsule('?phonebar=1', '0')).toBe(true);
    expect(decidePhoneCapsule('?phonebar=bogus', '1')).toBe(true);
    expect(decidePhoneCapsule('?phonebar=bogus', null)).toBe(false);
  });

  it('reads the Labs toggle once per page', () => {
    localStorage.setItem(
      LABS_KEY,
      JSON.stringify({ shown: true, flags: { 'phone-capsule': '1' } }),
    );
    expect(phoneCapsule()).toBe(true);
    localStorage.removeItem(LABS_KEY);
    expect(phoneCapsule()).toBe(true);
    resetPhoneCapsule();
    expect(phoneCapsule()).toBe(false);
  });
});
