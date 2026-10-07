import { describe, expect, it } from 'vitest';

import aboutHtml from '../../about/index.html?raw';
import indexHtml from '../../index.html?raw';
import { documentCsp, externalSources, parseCsp } from './csp';

function shippedPolicy(html = indexHtml): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const policy = documentCsp(doc);
  if (policy === undefined) throw new Error('the page has no CSP meta tag');
  return policy;
}

describe('index.html Content Security Policy', () => {
  it('allows no external origins in any directive', () => {
    expect(externalSources(parseCsp(shippedPolicy()))).toEqual([]);
  });

  it("limits connect-src to 'self'", () => {
    expect(parseCsp(shippedPolicy()).get('connect-src')).toEqual(["'self'"]);
  });

  it('has a restrictive default and blocks plugins', () => {
    const csp = parseCsp(shippedPolicy());
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
  });

  // Browsers ignore these in a meta policy and log an error on every load (CSP3 §6.1);
  // GitHub Pages cannot send them as headers (ADR-0004).
  it.each([
    ['index.html', indexHtml],
    ['about/index.html', aboutHtml],
  ])('%s carries no header-only directive', (_name, html) => {
    const csp = parseCsp(shippedPolicy(html));
    for (const directive of ['frame-ancestors', 'sandbox', 'report-uri']) {
      expect(csp.has(directive)).toBe(false);
    }
  });
});

describe('parseCsp / externalSources', () => {
  it('flags hosts, network schemes and wildcards', () => {
    const csp = parseCsp(
      "default-src 'self'; img-src 'self' blob: data: https://cdn.example.com; connect-src *; font-src https:",
    );
    expect(externalSources(csp)).toEqual(['https://cdn.example.com', '*', 'https:']);
  });

  it('keeps the first occurrence of a repeated directive', () => {
    expect(parseCsp("connect-src 'self'; connect-src *").get('connect-src')).toEqual(["'self'"]);
  });
});
