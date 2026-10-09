/**
 * The save receipt (docs/plan/v1/PLAN.md E13-c; redaction/receipt.ts): per act and in total,
 * the areas removed and the matches of the redacted strings left in the saved bytes, counted
 * by PDFium's search and the normalised page text. Through the PDFium worker: the original
 * fixture still shows its token, the redacted bytes show none.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import textRunsUrl from '../../../test/fixtures/redact-text-runs.pdf?url';
import { PdfLibAssembler } from '../src/pdflib/pdflib-assembler';
import {
  computeSaveReceipt,
  type SaveReceiptDeps,
  saveReceiptActsOf,
} from '../src/redaction/receipt';
import type { RedactionPlan, SaveReceiptAct, SearchHit, TextRun } from '../src/types';
import { createPdfiumProxy, type PdfiumProxy } from '../src/worker/pdfium-proxy';
import { sid, wasmUrl } from './helpers';

const TOKEN = 'SECRET-7731';

/** A file of `pages`, searched as PDFium would: one hit per occurrence, case-insensitive. */
function fakeFile(pages: readonly string[]): SaveReceiptDeps {
  return {
    pageCount: pages.length,
    search: (query) => {
      const hits: SearchHit[] = [];
      pages.forEach((text, pageIndex) => {
        const haystack = text.toLowerCase();
        const needle = query.toLowerCase();
        for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + 1)) {
          hits.push({ pageIndex, rects: [], context: text });
        }
      });
      return Promise.resolve(hits);
    },
    getPageText: (pageIndex) =>
      Promise.resolve([{ text: pages[pageIndex] ?? '' } as unknown as TextRun]),
  };
}

const act = (areas: number, terms: readonly string[]): SaveReceiptAct => ({
  kind: 'redaction',
  areas,
  terms,
});

describe('computeSaveReceipt', () => {
  test('counts the areas, and the matches left per act and in total', async () => {
    const file = fakeFile(['alpha beta alpha', 'gamma', 'Alpha and delta']);
    const receipt = await computeSaveReceipt(
      [act(2, ['alpha', 'gamma']), act(1, ['alpha']), act(3, ['omega'])],
      file,
      1234,
    );
    expect(receipt.acts).toEqual([
      { kind: 'redaction', areas: 2, termsSearched: 2, matches: 4, matchPages: [0, 1, 2] },
      { kind: 'redaction', areas: 1, termsSearched: 1, matches: 3, matchPages: [0, 2] },
      { kind: 'redaction', areas: 3, termsSearched: 1, matches: 0, matchPages: [] },
    ]);
    expect(receipt.areasRemoved).toBe(6);
    // "alpha" is shared by two acts: searched and counted once.
    expect(receipt.termsSearched).toBe(3);
    expect(receipt.matchesRemain).toBe(4);
    expect(receipt.pagesSearched).toBe(3);
    expect(receipt.bytes).toBe(1234);
    // Counts only: the redacted text is not in the receipt.
    expect(JSON.stringify(receipt)).not.toMatch(/alpha|gamma|omega/i);
  });

  test('a copy the search misses (a zero-width character inside) is found in the page text', async () => {
    const receipt = await computeSaveReceipt(
      [act(1, ['secret'])],
      fakeFile(['nothing here', 'sec​ret']),
      10,
    );
    expect(receipt.matchesRemain).toBe(1);
    expect(receipt.acts[0]?.matchPages).toEqual([1]);
  });

  test('without strings to search for, the file is not read', async () => {
    const receipt = await computeSaveReceipt([act(4, []), act(1, ['  '])], undefined, 99);
    expect(receipt).toEqual({
      acts: [
        { kind: 'redaction', areas: 4, termsSearched: 0, matches: 0, matchPages: [] },
        { kind: 'redaction', areas: 1, termsSearched: 0, matches: 0, matchPages: [] },
      ],
      areasRemoved: 5,
      termsSearched: 0,
      matchesRemain: 0,
      pagesSearched: 0,
      bytes: 99,
    });
  });

  test('one act per applied redaction plan', () => {
    const plan: RedactionPlan = {
      areas: [
        { pageIndex: 0, rect: { x: 0, y: 0, width: 1, height: 1 } },
        { pageIndex: 2, rect: { x: 0, y: 0, width: 1, height: 1 } },
      ],
      strings: ['a b'],
    };
    expect(saveReceiptActsOf([plan, { areas: [], strings: [] }])).toEqual([
      { kind: 'redaction', areas: 2, terms: ['a b'] },
      { kind: 'redaction', areas: 0, terms: [] },
    ]);
  });
});

describe('the receipt through the PDFium worker', () => {
  let engine: PdfiumProxy;

  beforeAll(() => {
    const worker = new Worker(new URL('../src/worker/pdfium.worker.ts', import.meta.url), {
      type: 'module',
      name: 'pdfium receipt test',
    });
    engine = createPdfiumProxy(worker, { wasmUrl, inspector: new PdfLibAssembler() });
  });

  afterAll(async () => {
    await engine.destroy();
  });

  test('the original shows every copy of the token; the redacted bytes show none', async () => {
    const original = await (await fetch(textRunsUrl)).arrayBuffer();
    await engine.open(sid('receipt'), original.slice(0));
    const hits = await engine.search(sid('receipt'), TOKEN);
    expect(hits.length).toBe(3);

    // Before: the same act over the original bytes finds all three.
    const copy = original.slice(0);
    const before = await engine.computeSaveReceipt(copy, [act(hits.length, [TOKEN])]);
    expect(copy.byteLength).toBe(original.byteLength); // the caller keeps its bytes
    expect(before.matchesRemain).toBe(3);
    expect(before.acts[0]).toMatchObject({ matches: 3, matchPages: [0] });

    // Redact every copy (an area on each hit), then take the receipt of the bytes.
    const plan: RedactionPlan = {
      areas: hits.flatMap((hit) =>
        hit.rects.map((rect) => ({
          pageIndex: hit.pageIndex,
          rect: { x: rect.x - 1, y: rect.y - 1, width: rect.width + 2, height: rect.height + 2 },
        })),
      ),
      strings: [TOKEN],
    };
    const result = await engine.applyRedactionPlan(sid('receipt'), plan, { captureStrings: false });
    await engine.close(sid('receipt'));
    const acts = saveReceiptActsOf([result.plan]);
    const receipt = await engine.computeSaveReceipt(result.bytes.slice(0), acts);
    expect(receipt.areasRemoved).toBe(plan.areas.length);
    expect(receipt.termsSearched).toBe(1);
    expect(receipt.matchesRemain).toBe(0);
    expect(receipt.pagesSearched).toBe(1);
    expect(receipt.bytes).toBe(result.bytes.byteLength);
  });

  test('a save without redactions does not open the file', async () => {
    const receipt = await engine.computeSaveReceipt(new ArrayBuffer(8), [act(2, [])]);
    expect(receipt).toMatchObject({ areasRemoved: 2, matchesRemain: 0, pagesSearched: 0 });
  });
});
