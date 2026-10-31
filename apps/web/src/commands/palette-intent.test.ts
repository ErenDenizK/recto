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
import { announcementOf, readIntent, stillShown } from './palette-intent';

beforeEach(async () => {
  setLocale('en');
  resetWorkspace();
  await useWorkspaceStore.getState().openFiles([await fixtureFile(manyUrl, 'many.pdf')]);
});
afterEach(() => {
  setLocale('en');
});

describe('readIntent', () => {
  it('reads a sentence into a row that carries the exact typed text', () => {
    const read = readIntent('rotate 2-3 right');
    if (read.kind !== 'readings') throw new Error('no readings');
    const [row] = read.rows;
    expect(row?.text).toBe('rotate 2-3 right');
    expect(row?.preview.sentence).toBe('Rotate pages 2–3 right');
    expect(row?.preview.runnable).toBe(true);
    expect(row?.key).toBe(row?.preview.key);
  });

  it('gives an honest row and no reading for what it did not understand', () => {
    expect(readIntent('zzzz qqqq').kind).toBe('none');
    const read = readIntent('rotate yamuk');
    expect(read.kind).toBe('partial');
  });

  it('keeps a problem legible with its reason', () => {
    const read = readIntent('rotate 2-999 right');
    if (read.kind !== 'readings') throw new Error('no readings');
    expect(read.rows[0]?.preview.runnable).toBe(false);
    expect(read.rows[0]?.preview.reason).toBeTruthy();
  });

  it('reads in Turkish', () => {
    setLocale('tr');
    const read = readIntent('2-3. sayfaları sağa döndür');
    if (read.kind !== 'readings') throw new Error('no readings');
    expect(read.rows[0]?.preview.sentence).toContain('döndür');
  });
});

describe('stillShown', () => {
  it('holds until the document changes underneath (§2.13 c)', () => {
    const read = readIntent('delete 2');
    if (read.kind !== 'readings' || !read.rows[0]) throw new Error('no readings');
    expect(stillShown(read.rows[0])).toBe(true);
    useWorkspaceStore.setState((state) => ({ workspace: { ...state.workspace } }));
    expect(stillShown(read.rows[0])).toBe(false);
  });

  it('is false for a row drawn from other text', () => {
    const read = readIntent('delete 2');
    if (read.kind !== 'readings' || !read.rows[0]) throw new Error('no readings');
    expect(stillShown({ ...read.rows[0], text: 'delete 3' })).toBe(false);
  });
});

describe('announcementOf', () => {
  it('says one reading as its sentence, with the reason when it cannot run', () => {
    const ok = readIntent('delete 2');
    expect(announcementOf(ok)).toBe('Delete page 2');
    const bad = announcementOf(readIntent('rotate 2-999 right'));
    expect(bad).toMatch(/^Rotate pages\s+right\. /);
  });

  it('says two readings together', () => {
    const doc = getActiveDocument(useWorkspaceStore.getState().workspace);
    expect(doc?.pages.length).toBeGreaterThan(4);
    const read = readIntent('imzala');
    if (read.kind !== 'readings') return;
    if (read.rows.length === 2) expect(announcementOf(read)).toMatch(/^Two readings: /);
  });

  it('says nothing for text that is not a sentence', () => {
    expect(announcementOf(readIntent('zzzz qqqq'))).toBeUndefined();
  });
});
