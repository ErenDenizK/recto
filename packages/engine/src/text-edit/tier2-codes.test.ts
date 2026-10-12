/**
 * Tier-2 code choice (review M3; tier2-codes.ts): one code per character, ambiguity refused,
 * and the space written as the font's code 32 when other codes also read as a space.
 */
import { describe, expect, test } from 'vitest';

import type { ObjectAnalysis } from './analysis';
import type { CodeProbe, CodeProbes } from './probe';
import { chooseTier2Codes } from './tier2-codes';

const SIMPLE = { type0: false } as ObjectAnalysis;

function probes(list: readonly CodeProbe[], same = (a: number, b: number) => a === b): CodeProbes {
  return {
    results: new Map(list.map((p) => [p.code, p])),
    sameRendering: same,
    dispose: () => undefined,
  };
}

const probe = (code: number, text: string, width: number, advance = 10): CodeProbe => ({
  code,
  text,
  mapError: false,
  advance,
  box: { x: 0, y: 0, width, height: 10 },
});

describe('chooseTier2Codes', () => {
  test('two different glyphs reading as one letter are ambiguous', () => {
    const choice = chooseTier2Codes(probes([probe(65, 'A', 7), probe(200, 'A', 9)]), SIMPLE, 'A');
    expect(choice).toEqual({ ok: false, reason: 'ambiguous-encoding', chars: ['A'] });
  });

  test('a subset whose no-break space (160) has no glyph still writes its space as 32', () => {
    // WinAnsi 160 reads as a space on the text page; in a subset without it, it draws nothing
    // and its box differs from the space glyph's (as in Word's and Inter subset exports).
    const list = [
      probe(32, ' ', 6.7, Number.NaN),
      probe(160, ' ', 0, Number.NaN),
      probe(97, 'a', 5),
    ];
    const choice = chooseTier2Codes(
      probes(list, () => false),
      SIMPLE,
      'a a',
    );
    expect(choice).toEqual({ ok: true, codes: [97, 32, 97] });
  });
});
