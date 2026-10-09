/**
 * M1-d: every warning the engine's export can write reaches the summary in the reader's
 * language. The warnings are read from the engine's source (each `warnings.add(…)` and `warn(…)`
 * literal of the assembler and its helpers), so a new one fails here until it has a row in
 * engine-warnings.ts and a message in en.json and tr.json.
 */
import assemblerSource from '../../../../packages/engine/src/pdflib/pdflib-assembler.ts?raw';
import createdFieldsSource from '../../../../packages/engine/src/pdflib/created-fields.ts?raw';
import metadataSource from '../../../../packages/engine/src/pdflib/metadata.ts?raw';
import { afterEach, describe, expect, test } from 'vitest';

import { setLocale } from '../i18n';
import { engineWarningText, isTranslatedEngineWarning } from './engine-warnings';

/** A sample of each warning the source writes; `${…}` parts become sample values. */
function warningsIn(source: string): string[] {
  const calls = /(?:warnings\.add|\bwarn)\(\s*(['`])([\s\S]*?)\1\s*,?\s*\)/g;
  return [...source.matchAll(calls)].map((match) =>
    (match[2] as string).replace(/\$\{([^}]*)\}/g, (_, expression: string) => {
      if (expression.includes('?')) return '';
      if (/outside|count|length/i.test(expression)) return '3';
      return 'Sample';
    }),
  );
}

const ENGINE_WARNINGS = [
  ...warningsIn(assemblerSource),
  ...warningsIn(createdFieldsSource),
  ...warningsIn(metadataSource),
];

/** Warnings the summary shows with a line of its own (summary.ts `COVERED`). */
const COVERED = [
  /^Tagged PDF structure was removed/,
  /^XFA form data was removed/,
  /^Fields with equal names were joined/,
];

afterEach(() => {
  setLocale('en');
});

describe('engine warnings in the summary (M1-d)', () => {
  test('the engine source is read: its warnings are found', () => {
    expect(ENGINE_WARNINGS.length).toBeGreaterThanOrEqual(14);
  });

  test.each(ENGINE_WARNINGS.filter((w) => !COVERED.some((p) => p.test(w))))(
    'has a translation: %s',
    (warning) => {
      expect(isTranslatedEngineWarning(warning)).toBe(true);
      setLocale('tr');
      const turkish = engineWarningText(warning);
      expect(turkish).not.toBe(warning);
      expect(turkish).not.toMatch(/\b(the|was|were|and)\b/);
    },
  );

  test('numbers and names reach the sentence, in both languages', () => {
    const cut =
      '3 annotations fell outside resized pages (cut off by the new size) and are not visible';
    expect(engineWarningText(cut)).toBe(
      '3 annotations fell outside resized pages (cut off by the new size) and are not visible.',
    );
    expect(
      engineWarningText(
        '1 annotation fell outside resized pages (cut off by the new size) and are not visible',
      ),
    ).toBe(
      '1 annotation fell outside a resized page (cut off by the new size) and is not visible.',
    );
    setLocale('tr');
    expect(engineWarningText(cut)).toBe(
      '3 ek açıklama yeniden boyutlandırılan sayfaların dışında kaldı (yeni boyutla kesildi) ve görünmüyor.',
    );
    expect(
      engineWarningText(
        'Overlay text uses characters the standard Times-Roman font cannot encode; a bundled font was embedded instead',
      ),
    ).toContain('standart Times-Roman yazı tipinin');
  });

  test('a warning without a row is shown as the engine wrote it', () => {
    setLocale('tr');
    expect(engineWarningText('Something new happened')).toBe('Something new happened');
  });
});
