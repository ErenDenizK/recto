/**
 * The intent bar's corpus is its test (PRD-39, spec §4.1): at least 200 new Turkish and English
 * rows plus PRD-23's 249, the owner's examples verbatim, and counts that keep the corpus honest
 * (chains, two readings, must-not-act, folk words, every family, every lexicon entry, every
 * problem). `show()` writes one parse as one line; a row is that line next to the sentence.
 */
import { describe, expect, it } from 'vitest';

import { traceLexicon } from '../grammar';
import { LEXICON } from '../lexicon';
import { parseIntent } from '../parse';
import { FAMILY } from '../types';
import type { Family, Problem } from '../types';
import { EN } from './corpus.en';
import { TR } from './corpus.tr';
import { FIXTURES, type Row } from './fixtures';
import { REGRESSION } from './regression';
import { show } from './show';

const fixtureOf = (row: Row) => FIXTURES[row[2] ?? 'DOC24'];
const run = (row: Row) => {
  const ctx = fixtureOf(row);
  return parseIntent(row[0], ctx);
};
const NEW_ROWS: readonly Row[] = [...Object.values(TR).flat(), ...Object.values(EN).flat()];
const section = (name: string): Row[] => [...(TR[name] ?? []), ...(EN[name] ?? [])];

/** The owner's examples, verbatim (spec §4.1). */
const OWNER: readonly Row[] = [
  ['3-5. sayfaları döndür ve 2 MB altına sıkıştır', 'rotate 3-5 +1 ; compress <2MB'],
  ['son sayfayı sil', 'delete 24'],
  ['jpg olarak kaydet', 'export jpeg all'],
  ['imzamı 2. sayfaya koy', 'sign 2'],
  ["IBAN'ları karart", 'redact iban'],
  ['split every 10 pages', 'split every 10 [1-10 11-20 21-24]'],
  ['çift sayfaları çıkar', '? delete 2,4,6… | extract 2,4,6…'],
];

describe('the corpus reads as written', () => {
  for (const [name, rows] of [...Object.entries(TR), ...Object.entries(EN)]) {
    const lang = rows === TR[name] ? 'tr' : 'en';
    it.each(rows)(`${lang} ${name}: %j reads as %s`, (...row) => {
      const r = row as unknown as Row;
      expect(show(run(r), fixtureOf(r).pageCount)).toBe(r[1]);
    });
  }

  it.each(REGRESSION)('PRD-23 regression: %j reads as %s', (...row) => {
    const [sentence, expected] = row as unknown as Row;
    expect(show(parseIntent(sentence, FIXTURES.DOC100), 100)).toBe(expected);
  });

  it.each(OWNER)("the owner's example %j reads as %s", (...row) => {
    const r = row as unknown as Row;
    expect(show(run(r), fixtureOf(r).pageCount)).toBe(r[1]);
  });
});

describe('what the corpus covers', () => {
  it('has the rows the spec asks for', () => {
    expect(Object.values(TR).flat().length).toBeGreaterThanOrEqual(110);
    expect(Object.values(EN).flat().length).toBeGreaterThanOrEqual(90);
    expect(NEW_ROWS.length).toBeGreaterThanOrEqual(200);
    expect(REGRESSION.length).toBeGreaterThanOrEqual(211);
  });

  it('has the counts of chains, two readings, must-not-act rows and folk words', () => {
    expect(section('chain').length).toBeGreaterThanOrEqual(25);
    expect(section('twoReadings').length).toBeGreaterThanOrEqual(15);
    expect(section('mustNotAct').length).toBeGreaterThanOrEqual(25);
    expect(section('folk').length).toBeGreaterThanOrEqual(15);
  });

  it('keeps every must-not-act row from running anything', () => {
    for (const row of section('mustNotAct')) {
      const result = run(row);
      if (result.kind === 'readings') {
        expect(
          result.readings.every((r) => r.problem !== null),
          row[0],
        ).toBe(true);
      }
    }
  });

  it('has at least ten rows for each family', () => {
    const count: Record<Family, number> = {
      navigate: 0,
      document: 0,
      handoff: 0,
      output: 0,
      unavailable: 0,
    };
    for (const row of NEW_ROWS) {
      const result = run(row);
      if (result.kind !== 'readings') continue;
      const families = new Set(
        result.readings.flatMap((r) => r.steps.map((s) => FAMILY[s.action])),
      );
      for (const family of families) count[family]++;
    }
    for (const family of Object.keys(count) as Family[]) {
      expect(count[family], family).toBeGreaterThanOrEqual(10);
    }
  });

  it('shows two readings only for the known two-way words', () => {
    const two = NEW_ROWS.filter((row) => row[1].startsWith('? '));
    const named = new Set(section('twoReadings').map((row) => row[0]));
    const stray = two.filter(
      (row) => !named.has(row[0]) && !row[1].includes('sign') && !row[1].includes('certify'),
    );
    expect(stray.map((row) => row[0])).toEqual([]);
    expect(two.length / NEW_ROWS.length).toBeLessThanOrEqual(0.1);
  });

  it('uses every lexicon entry at least once', () => {
    const { seen } = traceLexicon(() => {
      for (const row of [...NEW_ROWS, ...REGRESSION]) run(row);
    });
    const unused = LEXICON.filter((entry) => !seen.has(entry));
    expect(unused.map((e) => `${e.action}: ${e.words.join(', ')}`)).toEqual([]);
  });

  it('shows every problem at least once', () => {
    const problems: Problem[] = [
      'no-document',
      'out-of-range',
      'reversed-range',
      'no-pages',
      'all-pages',
      'ambiguous-count',
      'needs-pages',
      'not-a-run',
      'shifted',
      'two-finishing',
      'after-split',
      'single-part',
      'phone',
    ];
    const seen = new Set<Problem>();
    for (const row of NEW_ROWS) {
      const result = run(row);
      if (result.kind === 'readings')
        for (const r of result.readings) if (r.problem) seen.add(r.problem.kind);
    }
    expect(problems.filter((p) => !seen.has(p))).toEqual([]);
  });
});

describe('speed', () => {
  it('parses a sentence in a millisecond or less on average', () => {
    const rows = NEW_ROWS;
    const started = performance.now();
    let parses = 0;
    while (parses < 1000) for (const row of rows) if (parses++ < 1000) run(row);
    expect((performance.now() - started) / 1000).toBeLessThanOrEqual(1);
  });
});
