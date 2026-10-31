/**
 * Every reading of N1's corpus has a preview in both languages (decision PRD-39; spec niyet
 * §4.2): words for the sentence and each step, pages on the page-taking steps, parts on a split,
 * an undo story, and a key that moves with the workspace version and the text.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { setLocale } from '../../i18n';
import { EN } from './corpus/corpus.en';
import { FIXTURES, type Row } from './corpus/fixtures';
import { TR } from './corpus/corpus.tr';
import { parseIntent } from './parse';
import { previewOf } from './preview';
import { stepPages } from './plan';
import type { Reading } from './types';

const ROWS: readonly Row[] = [...Object.values(TR).flat(), ...Object.values(EN).flat()];

const readingsOf = (): { sentence: string; reading: Reading; row: Row }[] =>
  ROWS.flatMap((row) => {
    const result = parseIntent(row[0], FIXTURES[row[2] ?? 'DOC24']);
    return result.kind === 'readings'
      ? result.readings.map((reading) => ({ sentence: row[0], reading, row }))
      : [];
  });

afterEach(() => setLocale('en'));

describe('the corpus has previews', () => {
  const all = readingsOf();
  it('has readings to preview', () => {
    expect(all.length).toBeGreaterThan(150);
  });

  for (const locale of ['en', 'tr'] as const) {
    it(`gives every reading words, pages and an undo story in ${locale}`, () => {
      setLocale(locale);
      for (const { sentence, reading, row } of all) {
        const ctx = FIXTURES[row[2] ?? 'DOC24'];
        const preview = previewOf(reading, ctx, 1, sentence);
        const where = `${locale}: ${sentence}`;
        expect(preview.sentence, where).not.toBe('');
        expect(preview.steps, where).toHaveLength(reading.steps.length);
        expect(['one', 'separate', 'none'], where).toContain(preview.undo);
        reading.steps.forEach((step, i) => {
          const shown = preview.steps[i];
          expect(shown?.label, where).toBeTruthy();
          if (
            reading.problem === null &&
            stepPages(step) !== undefined &&
            step.action !== 'watermark'
          ) {
            expect(shown?.pages?.length, `${where} ${step.action}`).toBeGreaterThan(0);
          }
          if (reading.problem === null && step.action === 'split' && step.how !== 'choose') {
            expect(shown?.parts?.length, where).toBeGreaterThan(1);
          }
        });
        if (reading.problem !== null) {
          expect(preview.runnable, where).toBe(false);
          expect(preview.reason, where).toBeTruthy();
        }
      }
    });
  }

  it('speaks both languages differently', () => {
    const rotate = all.find((r) => r.reading.steps[0]?.action === 'rotate');
    if (!rotate) throw new Error('no rotate row');
    const ctx = FIXTURES.DOC24;
    setLocale('en');
    const en = previewOf(rotate.reading, ctx, 1).sentence;
    setLocale('tr');
    const tr = previewOf(rotate.reading, ctx, 1).sentence;
    expect(en).not.toBe(tr);
  });
});

describe('the key', () => {
  const ctx = FIXTURES.DOC24;
  const parsed = parseIntent('rotate 3-5 right', ctx);
  if (parsed.kind !== 'readings') throw new Error('no reading');
  const reading = parsed.readings[0];

  it('changes with the workspace version and with the typed text', () => {
    const a = previewOf(reading, ctx, 1, 'rotate 3-5 right').key;
    expect(previewOf(reading, ctx, 2, 'rotate 3-5 right').key).not.toBe(a);
    expect(previewOf(reading, ctx, 1, 'rotate 3-5 right ').key).toBe(a);
    expect(previewOf(reading, ctx, 1, 'rotate 3-5 left').key).not.toBe(a);
    expect(previewOf(reading, ctx, 1, 'rotate 3-5 right').key).toBe(a);
  });

  it('writes a chain in run order and says one undo takes it all back', () => {
    setLocale('en');
    const chain = parseIntent('rotate 3-5 and delete 8', ctx);
    if (chain.kind !== 'readings') throw new Error('no chain');
    const preview = previewOf(chain.readings[0], ctx, 1);
    expect(preview.sentence).toBe('Rotate pages 3–5 right, then delete page 8');
    expect(preview.undo).toBe('one');
    expect(preview.runnable).toBe(true);
  });

  it('puts an output after the document steps and keeps the undo for them', () => {
    setLocale('en');
    const chain = parseIntent('compress under 2 MB and rotate 3', ctx);
    if (chain.kind !== 'readings') throw new Error('no chain');
    const preview = previewOf(chain.readings[0], ctx, 1);
    expect(preview.steps.map((s) => s.family)).toEqual(['document', 'output']);
    expect(preview.undo).toBe('one');
  });

  it('offers the nearest command under an honest no', () => {
    setLocale('en');
    const word = parseIntent("pdf'i word'e çevir", ctx);
    if (word.kind !== 'readings') throw new Error('no reading');
    const preview = previewOf(word.readings[0], ctx, 1);
    expect(preview.runnable).toBe(false);
    expect(preview.nearest?.commandId).toBe('document.exportMarkdown');
  });
});
