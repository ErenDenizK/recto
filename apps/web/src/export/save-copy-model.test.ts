/**
 * Save a copy as data (components/07-sheets.md §4.9): what the openers preset, the Size presets
 * as compression settings, the names in EN and TR, the primary by platform, and the share of
 * the ring per export phase.
 */
import {
  type CompressionAnalysis,
  estimateCompression,
  presetSettings,
  rasterFileName,
} from '@pdf-editor/engine';
import { describe, expect, it } from 'vitest';

import {
  applyPreset,
  buildKey,
  copyName,
  DEFAULT_CUSTOM,
  DEFAULT_DRAFT,
  defaultName,
  exportShare,
  imagesDpi,
  imagesName,
  percentOf,
  primaryKind,
  sizeEstimates,
  sizeSettings,
  sizeSuffix,
  stemOf,
} from './save-copy-model';

describe('presets', () => {
  it('Compress… opens on PDF with Smaller chosen, keeping a size already chosen', () => {
    expect(applyPreset({ ...DEFAULT_DRAFT, format: 'text' }, 'size')).toMatchObject({
      format: 'pdf',
      size: 'smaller',
    });
    expect(applyPreset({ ...DEFAULT_DRAFT, size: 'smallest' }, 'size').size).toBe('smallest');
  });

  it('images, text and repaired copies open on their format; the rest of the draft stays', () => {
    const draft = { ...DEFAULT_DRAFT, size: 'custom' as const };
    expect(applyPreset(draft, 'images')).toEqual({ ...draft, format: 'images' });
    expect(applyPreset(draft, 'text')).toEqual({ ...draft, format: 'text' });
    expect(applyPreset({ ...draft, format: 'images' }, 'pdf')).toEqual(draft);
    expect(applyPreset(draft, null)).toBe(draft);
    expect(applyPreset(draft, 'details')).toBe(draft);
  });
});

describe('size', () => {
  it('maps each preset to today’s compression (Smaller 150 dpi q75, Smallest 96 dpi q60)', () => {
    expect(sizeSettings('same', DEFAULT_CUSTOM, presetSettings)).toBeNull();
    expect(sizeSettings('smaller', DEFAULT_CUSTOM, presetSettings)).toMatchObject({
      preset: 'ebook',
      dpi: 150,
      quality: 75,
      images: true,
    });
    expect(sizeSettings('smallest', DEFAULT_CUSTOM, presetSettings)).toMatchObject({
      preset: 'screen',
      dpi: 96,
      quality: 60,
    });
  });

  it('Custom carries its own values, clamped, and its image switches', () => {
    expect(
      sizeSettings(
        'custom',
        { dpi: 5000, quality: 0, images: false, flattenAlpha: true },
        presetSettings,
      ),
    ).toEqual({
      preset: 'custom',
      dpi: 1200,
      quality: 1,
      images: false,
      flattenAlpha: true,
    });
  });

  it('estimates every preset from one analysis', () => {
    const analysis: CompressionAnalysis = {
      pageCount: 1,
      totalBytes: 1_000_000,
      losslessBytes: 900_000,
      objectCount: 10,
      images: [],
      fonts: [],
    } as unknown as CompressionAnalysis;
    const estimates = sizeEstimates(analysis, DEFAULT_CUSTOM, presetSettings, estimateCompression);
    expect(estimates.same).toBe(1_000_000);
    expect(estimates.smaller.after).toBe(900_000);
    expect(estimates.smallest.worthwhile).toBe(true);
  });
});

describe('names', () => {
  it('follow the format and the size, with an ASCII suffix in Turkish', () => {
    expect(sizeSuffix('smaller', 'en')).toBe('-small');
    expect(sizeSuffix('smallest', 'tr')).toBe('-kucuk');
    expect(sizeSuffix('same', 'tr')).toBe('');
    expect(defaultName(DEFAULT_DRAFT, 'report', 'en')).toBe('report.pdf');
    expect(defaultName({ ...DEFAULT_DRAFT, size: 'smaller' }, 'report', 'en')).toBe(
      'report-small.pdf',
    );
    expect(defaultName({ ...DEFAULT_DRAFT, size: 'smallest' }, 'rapor', 'tr')).toBe(
      'rapor-kucuk.pdf',
    );
    expect(defaultName({ ...DEFAULT_DRAFT, format: 'text' }, 'report', 'en')).toBe('report.md');
    expect(
      defaultName(
        { ...DEFAULT_DRAFT, format: 'text', text: { ...DEFAULT_DRAFT.text, format: 'text' } },
        'report',
        'en',
      ),
    ).toBe('report.txt');
  });

  it('keep what the person typed, made safe, with the format’s extension', () => {
    expect(copyName({ ...DEFAULT_DRAFT, name: 'final: v2' }, 'report', 'en')).toBe('final- v2.pdf');
    expect(copyName({ ...DEFAULT_DRAFT, name: '   ' }, 'report', 'en')).toBe('report.pdf');
    expect(copyName({ ...DEFAULT_DRAFT, format: 'text', name: 'notes.pdf' }, 'report', 'en')).toBe(
      'notes.md',
    );
    expect(stemOf('notes.final.zip')).toBe('notes.final');
  });

  it('name images as rasterize writes them: one page by template, several as a ZIP', () => {
    const images = { type: 'png' as const, template: '{title}-{page}' };
    expect(imagesName(images, 'report', [0], 12, rasterFileName)).toBe('report-01.png');
    expect(imagesName(images, 'a/b', [0, 1], 12, rasterFileName)).toBe('a_b-images.zip');
    expect(imagesDpi({ resolution: '300', customDpi: 1 })).toBe(300);
    expect(imagesDpi({ resolution: 'custom', customDpi: 5 })).toBe(18);
  });
});

describe('the primary', () => {
  it('shares on a coarse pointer that can share files, else saves, else downloads', () => {
    expect(primaryKind({ savePicker: true, coarse: true, shareFiles: true })).toBe('share');
    expect(primaryKind({ savePicker: true, coarse: false, shareFiles: true })).toBe('save');
    expect(primaryKind({ savePicker: true, coarse: true, shareFiles: false })).toBe('save');
    expect(primaryKind({ savePicker: false, coarse: false, shareFiles: false })).toBe('download');
    expect(primaryKind({ savePicker: false, coarse: true, shareFiles: true })).toBe('share');
  });
});

describe('progress', () => {
  it('fills the ring through the phases', () => {
    expect(exportShare(null)).toBe(0);
    expect(exportShare({ phase: 'reading', done: 1, total: 2 })).toBe(5);
    expect(exportShare({ phase: 'assembling', done: 2, total: 2 })).toBe(85);
    expect(exportShare({ phase: 'verifying', done: 1, total: 1 })).toBe(95);
    expect(exportShare({ phase: 'signing', done: 1, total: 1 })).toBe(100);
    expect(percentOf(40.4)).toBe(40);
    expect(percentOf(140)).toBe(100);
  });

  it('keys a prepared copy by its settings, not by which row is open', () => {
    const id = 'doc' as Parameters<typeof buildKey>[0];
    expect(buildKey(id, { ...DEFAULT_DRAFT, open: 'security' }, 1)).toBe(
      buildKey(id, DEFAULT_DRAFT, 1),
    );
    expect(buildKey(id, { ...DEFAULT_DRAFT, size: 'smaller' }, 1)).not.toBe(
      buildKey(id, DEFAULT_DRAFT, 1),
    );
  });
});
