/**
 * The save receipt's flag (DSN-67): the changed-pages panel with its size bars in Save a copy,
 * and the page's flight to the tab with the "never left this device" toast on saving, shown
 * only with **`?receipt=1`** (`?receipt=0` turns it off again). The choice is kept for the
 * tab's session (`sessionStorage`), so a reload without the parameter keeps it, as `?top`
 * does (`shell/compact/top-variant.ts`). Storage that throws only drops the keeping.
 *
 * The size estimate's speed-up is not behind it: it is a fix.
 */

export const RECEIPT_QUERY_PARAM = 'receipt';
/** Session storage key of a `?receipt` choice (this tab only). */
export const RECEIPT_SESSION_KEY = 'pdf-editor:receipt:v1';

const asked = (value: string | null | undefined): boolean | undefined =>
  value === '1' ? true : value === '0' ? false : undefined;

/** Whether the receipt is on, for a query string and what the session kept: the query wins. */
export function decideReceipt(search: string, stored: string | null): boolean {
  return asked(new URLSearchParams(search).get(RECEIPT_QUERY_PARAM)) ?? asked(stored) ?? false;
}

let chosen: boolean | undefined;

/** Whether this tab shows the receipt, read once from the location and the session. */
export function receiptOn(): boolean {
  if (chosen !== undefined) return chosen;
  let storage: Storage | undefined;
  let stored: string | null;
  try {
    storage = window.sessionStorage;
    stored = storage.getItem(RECEIPT_SESSION_KEY);
  } catch {
    stored = null;
  }
  const search = window.location.search;
  chosen = decideReceipt(search, stored);
  if (asked(new URLSearchParams(search).get(RECEIPT_QUERY_PARAM)) !== undefined) {
    try {
      storage?.setItem(RECEIPT_SESSION_KEY, chosen ? '1' : '0');
    } catch {
      // Not kept: this load still shows what was asked.
    }
  }
  return chosen;
}

/** Tests: forget the choice read. */
export function resetReceiptFlag(): void {
  chosen = undefined;
}
