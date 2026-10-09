/**
 * The app's entry for the save receipt (E13-c, export/receipt.ts): a save without redactions
 * gets its receipt without the engine; otherwise the redactor searches a copy of the saved
 * bytes, with the output's user password; failures resolve as values.
 */
import type { SaveReceipt, SaveReceiptAct } from '@pdf-editor/engine';
import { describe, expect, it, vi } from 'vitest';

import { computeSaveReceipt, type SaveReceiptDependencies } from './receipt';

const ACT: SaveReceiptAct = { kind: 'redaction', areas: 3, terms: ['Jane Doe'] };
const RECEIPT: SaveReceipt = {
  acts: [{ kind: 'redaction', areas: 3, termsSearched: 1, matches: 0, matchPages: [] }],
  areasRemoved: 3,
  termsSearched: 1,
  matchesRemain: 0,
  pagesSearched: 4,
  bytes: 16,
};

function fakeRedactor(result: () => Promise<SaveReceipt>) {
  const search = vi.fn(
    (_bytes: ArrayBuffer, _acts: readonly SaveReceiptAct[], _options?: unknown) => result(),
  );
  const deps: SaveReceiptDependencies = {
    redactor: () => Promise.resolve({ computeSaveReceipt: search }),
  };
  return { search, deps };
}

describe('computeSaveReceipt', () => {
  it('answers a save without redactions at once, without the engine', async () => {
    const redactor = vi.fn();
    const result = await computeSaveReceipt(
      { bytes: new ArrayBuffer(42), receiptActs: [] },
      {},
      { redactor },
    );
    expect(redactor).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      value: {
        acts: [],
        areasRemoved: 0,
        termsSearched: 0,
        matchesRemain: 0,
        pagesSearched: 0,
        bytes: 42,
      },
    });
  });

  it('searches a copy of the saved bytes with the output password', async () => {
    const { search, deps } = fakeRedactor(() => Promise.resolve(RECEIPT));
    const bytes = new ArrayBuffer(16);
    const result = await computeSaveReceipt(
      {
        bytes,
        receiptActs: [ACT],
        outcome: {
          security: { userPassword: 'open' } as never,
          passwordRemoved: false,
          metadata: {} as never,
        },
      },
      {},
      deps,
    );
    expect(result).toEqual({ ok: true, value: RECEIPT });
    const [sent, acts, options] = search.mock.calls[0]!;
    expect(sent).not.toBe(bytes);
    expect(sent.byteLength).toBe(16);
    expect(acts).toEqual([ACT]);
    expect(options).toEqual({ password: 'open' });
  });

  it('resolves a failure as a value', async () => {
    const { deps } = fakeRedactor(() => Promise.reject(new Error('worker gone')));
    const result = await computeSaveReceipt(
      { bytes: new ArrayBuffer(4), receiptActs: [ACT] },
      {},
      deps,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toBe('worker gone');
  });
});
