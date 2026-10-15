/**
 * The phone reader's top variant (DSN-34, DSN-37, `top-variant.ts`): the split top after iOS
 * Preview by default, `?top=capsule` for the capsule of DSN-32, the query over what the tab's
 * session kept.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { decideTopVariant, resetTopVariant, TOP_SESSION_KEY, topVariant } from './top-variant';

describe('the top variant (?top)', () => {
  afterEach(() => {
    resetTopVariant();
    sessionStorage.removeItem(TOP_SESSION_KEY);
  });

  it('the split top by default; the query wins over the session', () => {
    expect(decideTopVariant('', null)).toBe('split');
    expect(decideTopVariant('?sample&top=capsule', null)).toBe('capsule');
    expect(decideTopVariant('', 'capsule')).toBe('capsule');
    expect(decideTopVariant('?top=split', 'capsule')).toBe('split');
    expect(decideTopVariant('?top=bogus', 'nonsense')).toBe('split');
  });

  it('reads the tab’s kept choice once', () => {
    sessionStorage.setItem(TOP_SESSION_KEY, 'capsule');
    expect(topVariant()).toBe('capsule');
    sessionStorage.setItem(TOP_SESSION_KEY, 'split');
    // Read once: a later change of the session does not swap the top under the reader.
    expect(topVariant()).toBe('capsule');
    resetTopVariant();
    expect(topVariant()).toBe('split');
  });
});
