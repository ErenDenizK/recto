/**
 * Export hygiene for sources with image edits (ADR-0011 §5): every `GenerateContent`
 * leaves the page's previous content stream in the file, unreachable, and a removed or
 * replaced image keeps its XObject stream there too. `finalizeContentEdits` drops every
 * unreachable object (pdf-lib), so a removed image is really gone from the exported bytes.
 * Sources with text edits get the same through `finalizeTextEdits`.
 */
import { PDFDocument } from '@cantoo/pdf-lib';

import { dropUnreachable } from '../pdflib/metadata';
import { PDFLIB_LOAD_TICKS, PDFLIB_SAVE_TICKS } from '../pdflib/ticks';

export interface FinalizeContentEditsResult {
  readonly bytes: ArrayBuffer;
  /** Indirect objects removed as unreachable. */
  readonly unreachableRemoved: number;
}

export async function finalizeContentEdits(
  bytes: ArrayBuffer,
): Promise<FinalizeContentEditsResult> {
  const doc = await PDFDocument.load(bytes, {
    ...PDFLIB_LOAD_TICKS,
    updateMetadata: false,
  });
  const before = doc.context.enumerateIndirectObjects().length;
  dropUnreachable(doc);
  const unreachableRemoved = before - doc.context.enumerateIndirectObjects().length;
  const out = await doc.save({ ...PDFLIB_SAVE_TICKS, useObjectStreams: false });
  return { bytes: out.slice().buffer, unreachableRemoved };
}
