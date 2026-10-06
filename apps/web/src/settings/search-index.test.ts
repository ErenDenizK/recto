/**
 * The Settings search (components/07-sheets.md S3 §6, §9; spec redesign D0-10 acceptance:
 * "search finds each row in EN and TR"): every row by its title in both languages whichever
 * language the UI is in, by keywords with and without diacritics (`İ` / `ı`, `ğ`, `ç`), every
 * word of a query, and nothing for a query nothing holds.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { setLocale } from '../i18n';
import { landingOf, presetOf, targetOf } from './open-settings';
import {
  pageById,
  queryWords,
  rowById,
  SETTINGS_PAGES,
  SETTINGS_ROWS,
  searchSettings,
} from './search-index';

const ids = (query: string) => searchSettings(query).map((row) => row.id);

afterEach(() => {
  setLocale('en');
});

describe('settings search', () => {
  it('finds every row by its English and its Turkish title, in either UI language', () => {
    for (const ui of ['en', 'tr'] as const) {
      setLocale(ui);
      for (const row of SETTINGS_ROWS) {
        for (const locale of ['en', 'tr'] as const) {
          const title = row.title(locale);
          expect(ids(title), `${row.id} by "${title}" (${ui} UI)`).toContain(row.id);
        }
      }
    }
  });

  it('finds every row with keywords by one keyword in each language', () => {
    for (const row of SETTINGS_ROWS) {
      if (!row.keywords) continue;
      for (const locale of ['en', 'tr'] as const) {
        const first = row.keywords(locale).split(',')[0]?.trim() ?? '';
        expect(ids(first), `${row.id} by "${first}" (${locale})`).toContain(row.id);
      }
    }
  });

  it('folds case and Turkish diacritics as the palette does', () => {
    expect(ids('saydamlik')).toContain('glass');
    expect(ids('SAYDAMLIK')).toContain('glass');
    expect(ids('yari saydam')).toContain('glass');
    expect(ids('görünüm')).toEqual(expect.arrayContaining(['glass', 'reduceMotion']));
    expect(ids('gorunum')).toEqual(expect.arrayContaining(['glass', 'reduceMotion']));
    expect(ids('İPUÇLARI')).toContain('showTips');
    expect(ids('ipuclari')).toContain('showTips');
    expect(ids('turkce')).toContain('language');
    expect(ids('Türkçe')).toContain('language');
    expect(ids('surum')).toContain('aboutVersion');
  });

  it('needs every word of the query, and finds nothing for nonsense', () => {
    expect(ids('glass solid')).toEqual(['glass']);
    expect(ids('zzqx')).toEqual([]);
    expect(ids('   ')).toHaveLength(SETTINGS_ROWS.length);
    expect(queryWords('  Cam  PANEL ')).toEqual(['cam', 'panel']);
  });

  it('lists a page’s rows under that page, which a row of the main list pushes', () => {
    for (const page of SETTINGS_PAGES) {
      expect(rowById(page.row)?.opens).toBe(page.id);
    }
    for (const row of SETTINGS_ROWS.filter((r) => r.page)) {
      expect(pageById(row.page ?? 'about')).toBeDefined();
    }
    expect(ids('licence')).toEqual(expect.arrayContaining(['about', 'aboutLicence']));
  });
});

describe('opening at a target', () => {
  it('round-trips a target through the preset', () => {
    expect(targetOf(presetOf({ row: 'commentName' }))).toEqual({ row: 'commentName' });
    expect(targetOf(presetOf({ section: 'appearance' }))).toEqual({ section: 'appearance' });
    expect(targetOf('row:nothing')).toBeNull();
    expect(targetOf(null)).toBeNull();
  });

  it('lands a row on its page, and a row that pushes a page on that page', () => {
    expect(landingOf({ row: 'about' })).toEqual({ page: 'about', reveal: null });
    expect(landingOf({ row: 'aboutVersion' })).toEqual({
      page: 'about',
      reveal: { row: 'aboutVersion' },
    });
    expect(landingOf({ row: 'glass' })).toEqual({
      page: null,
      reveal: { row: 'glass' },
    });
    expect(landingOf(null)).toEqual({ page: null, reveal: null });
  });
});
