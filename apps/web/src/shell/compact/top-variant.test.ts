/**
 * The phone reader's top variant (DSN-34, `top-variant.ts`): the capsule of DSN-32 by default,
 * `?top=split` for the split top after iOS Preview, the query over what the tab's session kept.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { decideTopVariant, resetTopVariant, TOP_SESSION_KEY, topVariant } from './top-variant';

describe('the top variant (?top)', () => {
  afterEach(() => {
    resetTopVariant();
    sessionStorage.removeItem(TOP_SESSION_KEY);
  });

  it('the capsule by default; the query wins over the session', () => {
    expect(decideTopVariant('', null)).toBe('capsule');
    expect(decideTopVariant('?sample&top=split', null)).toBe('split');
    expect(decideTopVariant('', 'split')).toBe('split');
    expect(decideTopVariant('?top=capsule', 'split')).toBe('capsule');
    expect(decideTopVariant('?top=bogus', 'nonsense')).toBe('capsule');
  });

  it('reads the tab’s kept choice once', () => {
    sessionStorage.setItem(TOP_SESSION_KEY, 'split');
    expect(topVariant()).toBe('split');
    sessionStorage.setItem(TOP_SESSION_KEY, 'capsule');
    // Read once: a later change of the session does not swap the top under the reader.
    expect(topVariant()).toBe('split');
    resetTopVariant();
    expect(topVariant()).toBe('capsule');
  });
});
