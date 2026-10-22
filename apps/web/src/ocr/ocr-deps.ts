/**
 * What the OCR dialog and the language manager read from the engine: page facts from the
 * PDFium worker and the language pack loader (`OcrPackStore`, shared with the recognizer
 * host). Tests replace them (`setOcrDependencies`), so the dialog renders without the served
 * OCR files.
 */
import type { SourceId } from '@pdf-editor/document-model';
import type { OcrPackStore, OcrPageFacts } from '@pdf-editor/engine';

import { getEngineService, getOcrRecognizers } from '../engine/engine-service';

/** The parts of `OcrPackStore` the UI uses. */
export type OcrPacks = Pick<OcrPackStore, 'list' | 'keepOffline' | 'remove' | 'importFile'>;

export interface OcrDependencies {
  /** Facts of `range.count` pages from `range.from` (entry 0 is page `from`); all by default. */
  readonly facts: (
    source: SourceId,
    range?: { readonly from: number; readonly count: number },
  ) => Promise<readonly OcrPageFacts[]>;
  readonly packs: () => Promise<OcrPacks>;
  /** Worker and core files "Keep available offline" caches with a pack (ADR-0012 §4). */
  readonly engineFiles: () => Promise<readonly string[]>;
}

const defaults = (): OcrDependencies => ({
  facts: async (source, range) => (await getEngineService().ocrLayer()).ocrPageFacts(source, range),
  packs: () => getOcrRecognizers().packs(),
  engineFiles: async () => (await import('@pdf-editor/engine/client')).ocrEngineFiles(),
});

let current: OcrDependencies | undefined;

export function ocrDependencies(): OcrDependencies {
  current ??= defaults();
  return current;
}

/** Tests: replace the dependencies (undefined restores the defaults). */
export function setOcrDependencies(next: OcrDependencies | undefined): void {
  current = next;
}
