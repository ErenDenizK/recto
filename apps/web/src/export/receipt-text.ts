/**
 * The save receipt's words (docs/plan/v1/PLAN.md E13-u; research ROADMAP E13): the line a
 * finished Save or Save a copy shows under its toast, from what `computeSaveReceipt` (E13-c,
 * ./receipt) proved about the exact bytes written.
 *
 * - After redactions: "3 areas removed · 0 matches remain", the search run over the saved
 *   file for every string the redactions took out.
 * - Otherwise, when the file stayed on this device (written in place, saved through the
 *   picker or downloaded): "Saved on this device". A shared copy left through the share
 *   sheet, so it says nothing of the kind.
 *
 * It holds counts only, never the redacted text.
 */
import { m } from '../i18n';
import { computeSaveReceipt, type SaveReceipt } from './receipt';

export type ReceiptPlace = 'device' | 'shared';

/** The receipt line of `receipt` for a file that went to `place`; undefined when it has none. */
export function receiptLine(receipt: SaveReceipt, place: ReceiptPlace): string | undefined {
  if (receipt.acts.length > 0) {
    return [
      m.receipt_areas({ count: receipt.areasRemoved }),
      m.receipt_matches({ count: receipt.matchesRemain }),
    ].join(' · ');
  }
  return place === 'device' ? m.receipt_device() : undefined;
}

/**
 * The receipt line of the export `prepared` that was saved to `place`. A receipt that cannot
 * be computed shows no line rather than a claim it cannot prove.
 */
export async function receiptLineOf(
  prepared: Parameters<typeof computeSaveReceipt>[0],
  place: ReceiptPlace,
  options: { readonly signal?: AbortSignal } = {},
): Promise<string | undefined> {
  const result = await computeSaveReceipt(prepared, options);
  return result.ok ? receiptLine(result.value, place) : undefined;
}
