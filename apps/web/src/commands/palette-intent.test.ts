/**
 * What the palette says an intent will do, before it runs (Epic 4, R12 E10: nothing runs
 * unseen), in both languages.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { setLocale } from '../i18n';
import { describeIntent } from './palette-intent';
import { parseQuery, type QueryContext } from './query';

const ctx: QueryContext = {
  pageCount: 12,
  currentPage: 4,
  headings: [{ title: 'Methods', page: 12 }],
  recents: [{ id: 'r', name: 'report.pdf' }],
};

function rows(query: string) {
  const intent = parseQuery(query, ctx);
  if (!intent) throw new Error(`no intent for ${query}`);
  return describeIntent(intent, query).map((r) => [r.label, r.detail, r.runnable]);
}

afterEach(() => {
  setLocale('en');
});

describe('intent rows', () => {
  it('says what will happen and which pages', () => {
    setLocale('en');
    expect(rows('p 9')).toEqual([['Go to page 9', undefined, true]]);
    expect(rows('rotate 3-7 right')).toEqual([['Rotate pages 3–7 right', '5 pages', true]]);
    expect(rows('delete 4-6')).toEqual([['Delete pages 4–6', '3 pages', true]]);
    expect(rows('delete page 4')).toEqual([['Delete page 4', '1 page', true]]);
    expect(rows('go to methods')).toEqual([['Go to ‘Methods’', 'Page 12', true]]);
    expect(rows('open report')).toEqual([['Open ‘report.pdf’', undefined, true]]);
  });

  it('gives a quiet reason for what cannot run', () => {
    setLocale('en');
    expect(rows('120')).toEqual([['Go to page 120', 'This document has 12 pages', false]]);
    expect(rows('delete 2 pages')).toEqual([['delete 2 pages', 'Say a range, like 2–3', false]]);
    expect(rows('delete 7-3')[0]?.[2]).toBe(false);
  });

  it('reads in Turkish', () => {
    setLocale('tr');
    expect(rows('120')).toEqual([['120. sayfaya git', 'Bu belgede 12 sayfa var', false]]);
    expect(rows('sayfa 5')).toEqual([['5. sayfaya git', undefined, true]]);
  });
});
