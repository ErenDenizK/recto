/**
 * Save a copy, S2, as data (components/07-sheets.md §4; ADR-0032 §2 item 3; flows §5.1): the
 * sheet's draft, what each opener presets, the Size presets as compression settings, the
 * copy's name, the primary by platform, and the share of the progress ring per export phase.
 * Pure, so the sheet and the runner agree and the unit tests drive it directly.
 *
 * - **One sheet for every output.** Format PDF · Images · Text; under PDF the Size presets
 *   (absorbing Compress: Smaller = 150 dpi q75, Smallest = 96 dpi q60, and Print 300 dpi q85
 *   inside Custom, §4.9), then Security, Flatten and the name. Images and Text carry what the
 *   image export and the Markdown conversion asked for.
 * - **The name** follows the format and the size ("-small", Turkish "-kucuk": ASCII so every
 *   share target accepts it) until the person types one; theirs is kept for the session.
 * - **The primary** (§4.6): a coarse pointer with Web Share for files shares; else the save
 *   picker where File System Access exists; else a download.
 */
import type { DocumentId } from '@pdf-editor/document-model';
import {
  type CompressionAnalysis,
  type CompressionEstimate,
  type CompressionSettings,
  type RasterBackground,
  type RasterFormat,
  WORTHWHILE_RATIO,
} from '@pdf-editor/engine';

import { type ConvertChoice, DEFAULT_CHOICE } from '../convert/convert-run';
import type { SaveCopyPreset } from './export-store';
import type { ExportProgress } from './export-service';
import { exportFileName } from './filename';

export type SaveCopyFormat = 'pdf' | 'images' | 'text';
export type SizeChoice = 'same' | 'smaller' | 'smallest' | 'custom';
/** Security for this copy only (§4.6 "values apply only to this copy"). */
export type SecurityChoice = 'document' | 'none' | 'password';
/** The disclosures under PDF; one open at a time on compact (§4.6). */
export type Disclosure = 'security' | 'metadata' | 'flatten' | 'signature' | 'names' | 'options';
/** Image resolutions offered (§4.2: 72 · 150 · 300 · Custom). */
export type Resolution = '72' | '150' | '300' | 'custom';
export type TextPages = ConvertChoice['scope'];

export interface CustomSize {
  readonly dpi: number;
  readonly quality: number;
  /** Downsample and re-encode images; off is the lossless rewrite only. */
  readonly images: boolean;
  readonly flattenAlpha: boolean;
}

export interface ImagesChoice {
  readonly type: RasterFormat;
  readonly resolution: Resolution;
  readonly customDpi: number;
  /** JPEG and WebP quality, 1–100. */
  readonly quality: number;
  readonly background: RasterBackground;
  /** 1-based page range, empty for all. */
  readonly range: string;
  /** File names, `{title}`, `{page}`, `{label}`. */
  readonly template: string;
}

/** What a person chose in the sheet, per document for the session (07 §1.1 rule 5). */
export interface SaveCopyDraft {
  readonly format: SaveCopyFormat;
  readonly size: SizeChoice;
  readonly custom: CustomSize;
  readonly security: SecurityChoice;
  readonly flattenAnnotations: boolean;
  readonly includeComments: boolean;
  readonly compatibility: boolean;
  readonly images: ImagesChoice;
  readonly text: ConvertChoice;
  /** A name the person typed, or null to follow the format and size. */
  readonly name: string | null;
  /** The open disclosure. */
  readonly open: Disclosure | null;
}

export const DEFAULT_CUSTOM: CustomSize = {
  dpi: 200,
  quality: 80,
  images: true,
  flattenAlpha: false,
};
/** Custom's "Print (300 dpi)" (§4.9). */
export const PRINT_SIZE = { dpi: 300, quality: 85 } as const;

export const DEFAULT_IMAGES: ImagesChoice = {
  type: 'png',
  resolution: '150',
  customDpi: 200,
  quality: 90,
  background: 'white',
  range: '',
  template: '{title}-{page}',
};

export const DEFAULT_DRAFT: SaveCopyDraft = {
  format: 'pdf',
  size: 'same',
  custom: DEFAULT_CUSTOM,
  security: 'document',
  flattenAnnotations: false,
  includeComments: true,
  compatibility: false,
  images: DEFAULT_IMAGES,
  text: DEFAULT_CHOICE,
  name: null,
  open: null,
};

/** The draft as an opener leaves it; the rest of what the person chose stays. */
export function applyPreset(draft: SaveCopyDraft, preset: SaveCopyPreset | null): SaveCopyDraft {
  switch (preset) {
    case 'size':
      return { ...draft, format: 'pdf', size: draft.size === 'same' ? 'smaller' : draft.size };
    case 'images':
      return { ...draft, format: 'images' };
    case 'text':
      return { ...draft, format: 'text' };
    case 'pdf':
      return { ...draft, format: 'pdf' };
    default:
      return draft;
  }
}

// ---------------------------------------------------------------------------
// Size
// ---------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min));

/**
 * The compression a size choice runs (§4.9, from today's presets): null for Same as
 * original. `presetSettings` is the engine's (passed in, so this module stays free of the
 * engine's runtime).
 */
export function sizeSettings(
  size: SizeChoice,
  custom: CustomSize,
  presetSettings: (
    preset: 'screen' | 'ebook' | 'custom',
    custom?: { readonly dpi: number; readonly quality: number },
  ) => CompressionSettings,
): CompressionSettings | null {
  switch (size) {
    case 'same':
      return null;
    case 'smaller':
      return presetSettings('ebook');
    case 'smallest':
      return presetSettings('screen');
    case 'custom':
      return {
        ...presetSettings('custom', {
          dpi: clamp(custom.dpi, 36, 1200),
          quality: clamp(custom.quality, 1, 100),
        }),
        images: custom.images,
        flattenAlpha: custom.flattenAlpha,
      };
  }
}

export interface SizeEstimates {
  /** The copy as it is today, uncompressed. */
  readonly same: number;
  readonly smaller: CompressionEstimate;
  readonly smallest: CompressionEstimate;
  readonly custom: CompressionEstimate;
}

/** The estimate beside every preset (§4.4, INV-18), from one analysis. */
export function sizeEstimates(
  analysis: CompressionAnalysis,
  custom: CustomSize,
  presetSettings: Parameters<typeof sizeSettings>[2],
  estimate: (analysis: CompressionAnalysis, settings: CompressionSettings) => CompressionEstimate,
): SizeEstimates {
  const of = (size: Exclude<SizeChoice, 'same'>) =>
    estimate(analysis, sizeSettings(size, custom, presetSettings) as CompressionSettings);
  return {
    same: analysis.totalBytes,
    smaller: of('smaller'),
    smallest: of('smallest'),
    custom: of('custom'),
  };
}

/**
 * "Already compact" beside a preset (§4.4 Little to gain: a saving under 3 %). Smaller and
 * Custom are measured against the copy as it is. Smallest is measured against Smaller as well:
 * a document with nothing to resample (no images, or images already at the target) gets the
 * same lossless pass from both, and two presets promising the same size with nothing said
 * read as a fault. Smallest then says it gains nothing more, and stays selectable.
 */
export function littleToGain(estimates: SizeEstimates, size: Exclude<SizeChoice, 'same'>): boolean {
  const estimate = estimates[size];
  if (!estimate.worthwhile) return true;
  if (size !== 'smallest') return false;
  const smaller = estimates.smaller.after;
  return smaller > 0 && (smaller - estimate.after) / smaller < WORTHWHILE_RATIO;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** "-small" for Smaller and Smallest; Turkish "-kucuk", ASCII for every share target (§4.5). */
export function sizeSuffix(size: SizeChoice, locale: string): string {
  if (size !== 'smaller' && size !== 'smallest') return '';
  return locale === 'tr' ? '-kucuk' : '-small';
}

/** The file's stem: the name without its extension. */
export function stemOf(name: string): string {
  return name.replace(/\.(pdf|md|txt|zip|png|jpe?g|webp)$/i, '');
}

/**
 * The name the Name field shows by default: `report.pdf`, `report-small.pdf`, `report.md` or
 * `report.txt` (a Markdown copy with images becomes a ZIP of the same stem when it is built).
 */
export function defaultName(
  draft: Pick<SaveCopyDraft, 'format' | 'size' | 'text'>,
  title: string,
  locale: string,
): string {
  if (draft.format === 'text') {
    const stem = stemOf(exportFileName(title));
    return `${stem}.${draft.text.format === 'markdown' ? 'md' : 'txt'}`;
  }
  return exportFileName(`${stemOf(title)}${sizeSuffix(draft.size, locale)}`);
}

/** The name the copy gets: what the person typed, else the default, made safe. */
export function copyName(draft: SaveCopyDraft, title: string, locale: string): string {
  const typed = draft.name?.trim();
  const name = typed !== undefined && typed !== '' ? typed : defaultName(draft, title, locale);
  if (draft.format === 'text') {
    const stem = stemOf(exportFileName(stemOf(name)));
    return `${stem}.${draft.text.format === 'markdown' ? 'md' : 'txt'}`;
  }
  return exportFileName(name);
}

/**
 * The images' output name, as `rasterize.ts` writes it: one page is one image named by the
 * template, several are `{title}-images.zip`.
 */
export function imagesName(
  images: Pick<ImagesChoice, 'type' | 'template'>,
  title: string,
  pages: readonly number[],
  pageCount: number,
  fileName: (
    template: string,
    values: { title: string; page: number; pageCount: number },
    format: RasterFormat,
  ) => string,
): string {
  const [only] = pages;
  if (pages.length === 1 && only !== undefined) {
    return fileName(images.template, { title, page: only + 1, pageCount }, images.type);
  }
  return `${title.replace(/[\\/:*?"<>|]+/g, '_')}-images.zip`;
}

export function imagesDpi(images: Pick<ImagesChoice, 'resolution' | 'customDpi'>): number {
  return images.resolution === 'custom'
    ? clamp(images.customDpi, 18, 1200)
    : Number(images.resolution);
}

// ---------------------------------------------------------------------------
// The primary
// ---------------------------------------------------------------------------

export type PrimaryKind = 'save' | 'download' | 'share';

export interface PlatformCapabilities {
  /** `showSaveFilePicker` exists (Chromium). */
  readonly savePicker: boolean;
  /** The primary pointer is coarse. */
  readonly coarse: boolean;
  /** `navigator.canShare({ files })` accepts a file. */
  readonly shareFiles: boolean;
}

/** §4.6: share on a coarse pointer that can share files, else save, else download. */
export function primaryKind(platform: PlatformCapabilities): PrimaryKind {
  if (platform.coarse && platform.shareFiles) return 'share';
  return platform.savePicker ? 'save' : 'download';
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** The share of the ring (0–100) for an export phase: reading 0–10, assembling 10–85, … */
export function exportShare(progress: ExportProgress | null): number {
  if (progress === null) return 0;
  const part = progress.total > 0 ? Math.min(1, progress.done / progress.total) : 0;
  if (progress.phase === 'reading') return 10 * part;
  if (progress.phase === 'assembling') return 10 + 75 * part;
  if (progress.phase === 'verifying') return 85 + 10 * part;
  return 95 + 5 * part;
}

/** A job's whole percentage, for "Saving copy… 40 %". */
export function percentOf(share: number): number {
  return Math.max(0, Math.min(100, Math.round(share)));
}

/** The key of the settings a pre-assembled copy was built from (Share, §4.6). */
export function buildKey(documentId: DocumentId, draft: SaveCopyDraft, extra: unknown): string {
  const { open: _open, ...settings } = draft;
  return JSON.stringify([documentId, settings, extra]);
}
