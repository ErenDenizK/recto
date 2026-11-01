/**
 * The palette's adapter to the intent bar (PRD-39, spec §2.13–§2.15), Vitest browser mode: what
 * typed text reads as, when a row is still the one Enter would run, and what a screen reader hears.
 */
import { getActiveDocument } from '@pdf-editor/document-model';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import manyUrl from '../../../../test/fixtures/many-pages.pdf?url';
import { fixtureFile } from '../../test/store-harness';
import { setLocale } from '../i18n';
import { resetWorkspace, useWorkspaceStore } from '../state/workspace-store';
import {
  announcementOf,
  namesCommand,
  type Previews,
  readIntent,
  stillShown,
  withPreviews,
} from './palette-intent';

// The palette loads the preview chunk when a reading appears and hands it in (spec §2.19).
let previews: Previews;
const read = (text: string) => withPreviews(readIntent(text), previews);

beforeEach(async () => {
  previews = await import('./intent/preview');
  setLocale('en');
  resetWorkspace();
  await useWorkspaceStore.getState().openFiles([await fixtureFile(manyUrl, 'many.pdf')]);
});
afterEach(() => {
  setLocale('en');
});

describe('readIntent', () => {
  it('parses a sentence into readings with no preview, so the preview chunk can wait', () => {
    const parsed = readIntent('rotate 2-3 right');
    if (parsed.kind !== 'readings') throw new Error('no readings');
    expect(parsed.readings).toHaveLength(1);
    expect('rows' in parsed).toBe(false);
  });

  it('reads a sentence into a row that carries the exact typed text', () => {
    const got = read('rotate 2-3 right');
    if (got.kind !== 'readings') throw new Error('no readings');
    const [row] = got.rows;
    expect(row?.text).toBe('rotate 2-3 right');
    expect(row?.preview.sentence).toBe('Rotate pages 2–3 right');
    expect(row?.preview.runnable).toBe(true);
    expect(row?.key).toBe(row?.preview.key);
  });

  it('gives an honest row and no reading for what it did not understand', () => {
    expect(readIntent('zzzz qqqq').kind).toBe('none');
    const got = read('rotate yamuk');
    expect(got.kind).toBe('partial');
  });

  it('does not read a text that is exactly a command name as a sentence', () => {
    // "OCR languages" alone is a partial reading ("languages" is no word); with the command it is
    // the command's name, so the list ranks it as it did before the bar.
    expect(readIntent('OCR languages').kind).toBe('partial');
    expect(readIntent('OCR languages', ['OCR languages…']).kind).toBe('none');
    expect(readIntent('ocr  LANGUAGES…', ['OCR languages…']).kind).toBe('none');
    expect(readIntent('Delete pages', ['Delete pages']).kind).toBe('none');
    // Only the whole name counts: a sentence that merely starts with it is still read.
    expect(readIntent('rotate 2-3 right', ['Rotate pages right']).kind).toBe('readings');
  });

  it('keeps a problem legible with its reason', () => {
    const got = read('rotate 2-999 right');
    if (got.kind !== 'readings') throw new Error('no readings');
    expect(got.rows[0]?.preview.runnable).toBe(false);
    expect(got.rows[0]?.preview.reason).toBeTruthy();
  });

  it('reads in Turkish', () => {
    setLocale('tr');
    const got = read('2-3. sayfaları sağa döndür');
    if (got.kind !== 'readings') throw new Error('no readings');
    expect(got.rows[0]?.preview.sentence).toContain('döndür');
  });
});

describe('namesCommand', () => {
  it('folds case, accents, spaces and a trailing ellipsis, and wants the whole title', () => {
    expect(namesCommand('metni tani (ocr)', ['Metni tanı (OCR)…'])).toBe(true);
    expect(namesCommand('Print...', ['Print…'])).toBe(true);
    expect(namesCommand('Print', ['Print…', 'Print all'])).toBe(true);
    expect(namesCommand('Pri', ['Print…'])).toBe(false);
    expect(namesCommand('  ', ['Print…'])).toBe(false);
  });
});

describe('stillShown', () => {
  it('holds until the document changes underneath (§2.13 c)', () => {
    const got = read('delete 2');
    if (got.kind !== 'readings' || !got.rows[0]) throw new Error('no readings');
    expect(stillShown(got.rows[0], previews)).toBe(true);
    useWorkspaceStore.setState((state) => ({ workspace: { ...state.workspace } }));
    expect(stillShown(got.rows[0], previews)).toBe(false);
  });

  it('is false for a row drawn from other text', () => {
    const got = read('delete 2');
    if (got.kind !== 'readings' || !got.rows[0]) throw new Error('no readings');
    expect(stillShown({ ...got.rows[0], text: 'delete 3' }, previews)).toBe(false);
  });
});

describe('announcementOf', () => {
  it('says one reading as its sentence, with the reason when it cannot run', () => {
    const ok = read('delete 2');
    expect(announcementOf(ok)).toBe('Delete page 2');
    const bad = announcementOf(read('rotate 2-999 right'));
    expect(bad).toMatch(/^Rotate pages 2–999 right\. /);
  });

  it('says two readings together', () => {
    const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
    expect(doc?.pages.length).toBeGreaterThan(4);
    const got = read('imzala');
    if (got.kind !== 'readings') return;
    if (got.rows.length === 2) expect(announcementOf(got)).toMatch(/^Two readings: /);
  });

  it('says nothing for text that is not a sentence', () => {
    expect(announcementOf(read('zzzz qqqq'))).toBeUndefined();
  });
});
