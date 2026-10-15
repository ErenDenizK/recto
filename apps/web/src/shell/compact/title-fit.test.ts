/** The split top's title cut in its middle (DSN-38, `title-fit.ts`). */
import { describe, expect, it } from 'vitest';

import { ELLIPSIS, middleEllipsis } from './title-fit';

/** Every character 8 px wide. */
const measure = (value: string) => Array.from(value).length * 8;

describe('the middle cut', () => {
  it('keeps a name that fits whole', () => {
    expect(middleEllipsis('Recto sample', 200, measure)).toBe('Recto sample');
  });

  it('keeps the start and the end of a long name around one ellipsis', () => {
    const name = 'Serway_Physics_for_Scientists_and_Engineers_Jewett';
    const cut = middleEllipsis(name, 20 * 8, measure);
    expect(measure(cut)).toBeLessThanOrEqual(160);
    expect(Array.from(cut)).toHaveLength(20);
    expect(cut.startsWith('Serway_Ph')).toBe(true);
    expect(cut.endsWith('_Jewett')).toBe(true);
    expect(cut.split(ELLIPSIS)).toHaveLength(2);
  });

  it('tells names apart that differ only at the end', () => {
    const a = middleEllipsis('Invoice_2026_quarterly_statement_03', 16 * 8, measure);
    const b = middleEllipsis('Invoice_2026_quarterly_statement_04', 16 * 8, measure);
    expect(a).not.toBe(b);
  });

  it('drops the spaces beside the ellipsis and falls back to the ellipsis alone', () => {
    expect(middleEllipsis('aaaa bbbb cccc dddd', 10 * 8, measure)).not.toMatch(/ …|… /);
    expect(middleEllipsis('abcdef', 4, measure)).toBe(ELLIPSIS);
  });
});
