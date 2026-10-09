/**
 * The web policy (PLAN ED-1, V1-P3; editions.md §4.1): a web build resolves `#platform` to the
 * web adapter, connects to its own origin only, and its shipped CSP says the same.
 * `tools/qa/bundle-budget.ts` checks the built files for desktop code.
 */
import { platform } from '#platform';
import { describe, expect, it } from 'vitest';

import indexHtml from '../../../index.html?raw';
import { documentCsp, parseCsp } from '../../privacy/csp';

describe('web target policy', () => {
  it('resolves #platform to the web adapter', () => {
    expect(__TARGET__).toBe('web');
    expect(platform.target).toBe('web');
    expect(platform.network).toBe('none');
  });

  it("connects to 'self' only, as the shipped CSP says", () => {
    const policy = documentCsp(new DOMParser().parseFromString(indexHtml, 'text/html'));
    if (policy === undefined) throw new Error('index.html has no CSP');
    expect(platform.connectSources).toEqual(["'self'"]);
    expect(parseCsp(policy).get('connect-src')).toEqual(platform.connectSources);
  });
});
