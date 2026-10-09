/**
 * PF-3 (docs/plan/v1/PLAN.md §3.2; perf-audit.md item 3): pdf-lib yields every
 * `PDFLIB_OBJECTS_PER_TICK` objects instead of every 50 to 100. Two promises are checked here:
 *
 * - **No output changes.** Over the fixture corpus, a load and save with the new tick options
 *   writes the same bytes as pdf-lib's defaults, with and without object streams. The real
 *   passes on a 100-page document (assemble, redaction scrub, annotation finalise) hash to the
 *   values the passes wrote before PF-3 (`GOLDEN`, recorded on the tree before the change).
 * - **Cancel still arrives.** While a pass runs over a large document, a message posted to the
 *   thread (the way an abort reaches a worker, pdfium-proxy.ts `invoke`) is handled within
 *   100 ms, so the `throwIfAborted` between passes sees it promptly.
 *
 * Timings print as `[timing]` lines (perf-results.md records them).
 */
import { PDFDocument } from '@cantoo/pdf-lib';
import manifest from '../../../test/fixtures/manifest.json';
import manyPagesUrl from '../../../test/fixtures/many-pages.pdf?url';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { finalizeAnnotations } from '../src/annotations/finalize';
import { PdfLibAssembler } from '../src/pdflib/pdflib-assembler';
import { PDFLIB_LOAD_TICKS, PDFLIB_SAVE_TICKS } from '../src/pdflib/ticks';
import { scrubRedactedDocument } from '../src/redaction/scrub';
import { logTiming, sid, toBuffer, vdoc, vpage } from './helpers';

/** Every fixture sits beside many-pages.pdf, so its URL resolves against that one. */
const fetchBytes = async (name: string): Promise<Uint8Array> => {
  const url = new URL(name, new URL(manyPagesUrl, location.href));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No fixture ${name}`);
  return new Uint8Array(await response.arrayBuffer());
};

interface ManifestFixture {
  readonly file: string;
  readonly tags?: readonly string[];
}
const corpus = (manifest as { fixtures: readonly ManifestFixture[] }).fixtures
  .map((fixture) => fixture.file)
  .filter((file) => file.endsWith('.pdf') && !file.includes('/'));

async function sha256(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Bytes are equal (a hash comparison keeps a failure message short). */
async function expectSameBytes(actual: Uint8Array, expected: Uint8Array): Promise<void> {
  expect(actual.byteLength).toBe(expected.byteLength);
  expect(await sha256(actual)).toBe(await sha256(expected));
}

/**
 * SHA-256 of what each pass writes for the 100-page document below, recorded with pdf-lib's
 * default ticks (the tree before PF-3). A change here is an output change: PF-3 must not make
 * one.
 */
const GOLDEN = {
  source: '823713bd97d199a697e4a06bdf2fb3be4088600b580c32d326b5387bc7be87cc',
  assemble: '636e2079de7963e4377bc27179ac6c7ccf2d9c4b73e9dca6377ecfa10dfe404d',
  scrub: 'a7415688d0450db1cf1517a4cab2ea58c8373d739cfa83912387556e47c167c2',
  finalize: '2b9ff0c4647cad2c9e3cc4e90c55d9d6e78ef4391989753e27efd538dca99760',
} as const;

/** Corpus files whose pages carry fonts, images, annotations and fields. */
const RICH = [
  'annotations.pdf',
  'forms-a.pdf',
  'images.pdf',
  'text-edit-fonts.pdf',
  'redact-images.pdf',
  'outline-named-dests.pdf',
];

/**
 * A 100-page source (the plan's V1-P10 size): the pages of the RICH files, copied in turn
 * until there are 100, each copy with its own fonts, images and annotations. Written with
 * pdf-lib's defaults, so it is the same on either side of PF-3.
 */
async function hundredPageSource(): Promise<ArrayBuffer> {
  const out = await PDFDocument.create({ updateMetadata: false });
  const docs: PDFDocument[] = [];
  for (const file of RICH) {
    docs.push(
      await PDFDocument.load(await fetchBytes(file), {
        updateMetadata: false,
        ignoreEncryption: true,
      }),
    );
  }
  for (let round = 0; out.getPageCount() < 100; round++) {
    const doc = docs[round % docs.length] as PDFDocument;
    for (const page of await out.copyPages(doc, doc.getPageIndices())) {
      if (out.getPageCount() < 100) out.addPage(page);
    }
  }
  return toBuffer(await out.save({ useObjectStreams: false }));
}

describe('pdf-lib ticks (PF-3)', () => {
  test('a load and save with the new ticks writes the same bytes over the corpus', async () => {
    let compared = 0;
    for (const file of corpus) {
      const bytes = await fetchBytes(file);
      const base = { updateMetadata: false, ignoreEncryption: true, throwOnInvalidObject: false };
      let before: PDFDocument;
      try {
        before = await PDFDocument.load(bytes, base);
      } catch {
        continue; // pdf-lib cannot read this one either way (truncated, broken on purpose).
      }
      const after = await PDFDocument.load(bytes, { ...base, ...PDFLIB_LOAD_TICKS });
      for (const useObjectStreams of [false, true]) {
        const a = await before.save({ useObjectStreams, updateFieldAppearances: false });
        const b = await after.save({
          ...PDFLIB_SAVE_TICKS,
          useObjectStreams,
          updateFieldAppearances: false,
        });
        await expectSameBytes(b, a);
      }
      compared++;
    }
    expect(compared).toBeGreaterThan(30);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('the passes write the recorded bytes on a 100-page document', async () => {
    // The assembler stamps the save time and random file and XMP ids; pin them so the bytes
    // depend on the input alone.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-09T00:00:00.000Z') });
    let seed = 0;
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(
      <T extends ArrayBufferView | null>(array: T): T => {
        if (array) {
          const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          for (let i = 0; i < view.length; i++) view[i] = (seed++ * 31) & 0xff;
        }
        return array;
      },
    );
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => `00000000-0000-4000-8000-${String(seed++).padStart(12, '0')}` as const,
    );
    const source = sid('hundred');
    const sourceBytes = await hundredPageSource();
    const pages = Array.from({ length: 100 }, (_, index) =>
      vpage({ kind: 'source', source, index }),
    );
    const assembler = new PdfLibAssembler();
    let started = performance.now();
    const assembled = await assembler.assemble({
      document: vdoc(pages),
      sources: new Map([[source, sourceBytes]]),
      blobs: new Map(),
    });
    logTiming('assemble 100 pages', started);

    started = performance.now();
    const scrubbed = await scrubRedactedDocument(assembled.bytes, {
      areas: [{ pageIndex: 0, rect: { x: 10, y: 10, width: 80, height: 30 } }],
      strings: ['Widget'],
    });
    logTiming('redaction scrub 100 pages', started);

    started = performance.now();
    const finalized = await finalizeAnnotations(assembled.bytes, {
      touched: [],
      noteOpen: {},
      opacity: {},
      includeComments: true,
      now: '2026-10-09T00:00:00.000Z',
    });
    logTiming('annotation finalise 100 pages', started);

    const hashes = {
      source: await sha256(sourceBytes),
      assemble: await sha256(assembled.bytes),
      scrub: await sha256(scrubbed.bytes),
      finalize: await sha256(finalized),
    };
    // eslint-disable-next-line no-console -- the recorded hashes, for GOLDEN
    console.info(`[golden] ${JSON.stringify(hashes)}`);
    expect(hashes).toEqual(GOLDEN);
  });

  test('a message posted during a pass over 8,000 pages is handled within 100 ms', async () => {
    const many = await PDFDocument.load(await fetchBytes('many-pages.pdf'), {
      updateMetadata: false,
    });
    const big = await PDFDocument.create({ updateMetadata: false });
    const indices = many.getPageIndices();
    for (let i = 0; i < 20; i++) {
      for (const page of await big.copyPages(many, indices)) big.addPage(page);
    }
    const bytes = await big.save({ ...PDFLIB_SAVE_TICKS, useObjectStreams: true });
    expect(big.getPageCount()).toBe(8000);

    // A ping every 10 ms over a MessageChannel, as the abort port of a worker call is.
    const channel = new MessageChannel();
    let sentAt = 0;
    let worst = 0;
    let running = true;
    channel.port2.onmessage = () => {
      worst = Math.max(worst, performance.now() - sentAt);
      if (running) setTimeout(ping, 10);
    };
    const ping = () => {
      sentAt = performance.now();
      channel.port1.postMessage(0);
    };
    ping();

    const started = performance.now();
    const loaded = await PDFDocument.load(bytes, { ...PDFLIB_LOAD_TICKS, updateMetadata: false });
    await loaded.save({ ...PDFLIB_SAVE_TICKS, useObjectStreams: true });
    logTiming('load + save 8,000 pages, PF-3 ticks', started);
    running = false;
    channel.port1.close();
    // eslint-disable-next-line no-console -- benchmark output
    console.info(`[timing] worst message delay during the pass: ${worst.toFixed(1)} ms`);
    expect(worst).toBeLessThan(100);

    const before = performance.now();
    const defaults = await PDFDocument.load(bytes, { updateMetadata: false });
    await defaults.save({ useObjectStreams: true });
    logTiming('load + save 8,000 pages, pdf-lib default ticks', before);
  }, 120_000);
});
