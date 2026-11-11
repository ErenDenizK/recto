/** The phone capsule flag (phone-capsule-flag.ts): on by default, `?phonebar=0` keeps the drawer. */
import { afterEach, describe, expect, it } from 'vitest';

import { decidePhoneCapsule, phoneCapsule, resetPhoneCapsule } from './phone-capsule-flag';

describe('the phone capsule flag (?phonebar)', () => {
  afterEach(() => {
    resetPhoneCapsule();
    window.history.replaceState(null, '', '/');
  });

  it('is on by default; only ?phonebar=0 turns it off', () => {
    expect(decidePhoneCapsule('')).toBe(true);
    expect(decidePhoneCapsule('?phonebar=1')).toBe(true);
    expect(decidePhoneCapsule('?phonebar=0')).toBe(false);
    expect(decidePhoneCapsule('?phonebar=bogus')).toBe(true);
  });

  it('reads the address once per page', () => {
    window.history.replaceState(null, '', '/?phonebar=0');
    expect(phoneCapsule()).toBe(false);
    window.history.replaceState(null, '', '/');
    expect(phoneCapsule()).toBe(false);
    resetPhoneCapsule();
    expect(phoneCapsule()).toBe(true);
  });
});
