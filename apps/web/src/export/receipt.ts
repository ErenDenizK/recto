/**
 * The save receipt (docs/plan/v1/PLAN.md E13-c): what a finished Save or Save a copy can
 * prove about the file it wrote, for the receipt UI (E13-u: "3 areas removed · searched the
 * saved file: 0 matches remain"; every save: "Saved on this device").
 *
 * `computeSaveReceipt` searches the exact bytes saved (`PreparedExport.bytes`, a copy is sent)
 * in the PDFium worker for every string each applied redaction took out
 * (`PreparedExport.receiptActs`) and counts what is left, per act and in total. A save without
 * redactions gets its receipt at once, without the engine. The receipt holds counts and page
 * numbers only, never the redacted text.
 *
 * Call it after the export resolved `ok` and before the bytes are handed elsewhere; it never
 * rejects (failures resolve to `{ ok: false }`).
 */
import type { PdfRedactor, SaveReceipt } from '@pdf-editor/engine';

import { type EngineResult, getEngineService, toFailure } from '../engine/engine-service';
import type { PreparedExport } from './export-service';

export type { SaveReceipt, SaveReceiptActResult } from '@pdf-editor/engine';

export interface SaveReceiptDependencies {
  readonly redactor: () => Promise<Pick<PdfRedactor, 'computeSaveReceipt'>>;
}

const defaultDependencies = (): SaveReceiptDependencies => ({
  redactor: () => getEngineService().redactor(),
});

/** The receipt of `prepared`, the export that was saved. */
export async function computeSaveReceipt(
  prepared: Pick<PreparedExport, 'bytes' | 'receiptActs' | 'outcome'>,
  options: { readonly signal?: AbortSignal } = {},
  deps: SaveReceiptDependencies = defaultDependencies(),
): Promise<EngineResult<SaveReceipt>> {
  const { bytes, receiptActs } = prepared;
  if (receiptActs.length === 0) {
    return {
      ok: true,
      value: {
        acts: [],
        areasRemoved: 0,
        termsSearched: 0,
        matchesRemain: 0,
        pagesSearched: 0,
        bytes: bytes.byteLength,
      },
    };
  }
  try {
    const redactor = await deps.redactor();
    const password = prepared.outcome?.security?.userPassword;
    const receipt = await redactor.computeSaveReceipt(bytes.slice(0), receiptActs, {
      ...(password ? { password } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return { ok: true, value: receipt };
  } catch (error) {
    return { ok: false, error: toFailure(error) };
  }
}
