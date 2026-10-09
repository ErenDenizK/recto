/**
 * M2-a (docs/plan/v1/PLAN.md §3.2, W1-g: "Turkish free text round-trips in Acrobat, pdf.js,
 * PDFium"): a text box with ğ ü ş ı ö ç İ Ğ Ş is written with an embedded Unicode font, and the
 * saved file reads back the same text everywhere:
 *
 * - **PDFium**: the reopened file lists the same text, and the appearance draws it;
 * - **pdf.js** (Firefox's reader): the annotation's contents are the same text, and the
 *   appearance's own glyphs extract to that text (ToUnicode), as a copy from it would;
 * - **Acrobat** cannot run here, so the file is checked for what Acrobat relies on: an
 *   embedded TrueType subset with a ToUnicode map in the appearance, under the /DA font name;
 *   /Contents as a UTF-16 text string; the conformance check passes.
 *
 * WinAnsi text keeps PDFium's own appearance, as before.
 */
import type { PDFDict } from '@cantoo/pdf-lib';
import {
  decodePDFRawStream,
  drawObject,
  type PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFString,
  popGraphicsState,
  pushGraphicsState,
} from '@cantoo/pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { checkAnnotationConformance } from '../src/annotations/conformance';
import { wrapFreeText } from '../src/annotations/free-text-appearance';
import { createHostedEngine, type HostedEngine } from '../src/pdfium/host';
import { PdfiumAdapter } from '../src/pdfium/pdfium-adapter';
import type { FreeTextAnnotation, NewAnnotation } from '../src/types';
import { makePdf, sid, wasmUrl } from './helpers';

const TURKISH = 'Ağır şişe, İstanbul ve Iğdır: ĞÜŞİÖÇ ğüşıöç';
const RECT = { x: 60, y: 520, width: 300, height: 90 };

let host: HostedEngine;
let adapter: PdfiumAdapter;

beforeAll(async () => {
  host = await createHostedEngine({ wasm: wasmUrl });
  adapter = new PdfiumAdapter({
    wasmUrl,
    engineFactory: () => host.engine,
    rawTask: (sourceId, fn, options) => host.withRawTask(sourceId, fn, options),
  });
});
afterAll(async () => {
  await adapter.destroy();
});

function textBox(text: string, extra: Partial<FreeTextAnnotation> = {}): NewAnnotation {
  return {
    kind: 'free-text',
    pageIndex: 0,
    rect: RECT,
    text,
    fontSize: 14,
    fontFamily: 'Helvetica',
    textColor: '#1F3A93',
    ...extra,
  };
}

/** A blank Letter page with one text box, saved. */
async function savedWith(text: string, id: string): Promise<Uint8Array> {
  const source = sid(id);
  await adapter.open(source, await makePdf([{ size: [612, 792] }]));
  await adapter.createAnnotation(source, textBox(text));
  const bytes = new Uint8Array(await adapter.save(source));
  await adapter.close(source);
  return bytes;
}

interface Appearance {
  readonly annot: PDFDict;
  readonly form: PDFRawStream;
  readonly doc: PDFDocument;
}

async function appearanceOf(bytes: Uint8Array): Promise<Appearance> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const annots = doc.getPage(0).node.Annots() as PDFArray;
  const annot = doc.context.lookup(annots.get(0)) as PDFDict;
  const ap = doc.context.lookup(annot.get(PDFName.of('AP'))) as PDFDict;
  const form = doc.context.lookup(ap.get(PDFName.of('N'))) as PDFRawStream;
  return { annot, form, doc };
}

/**
 * The saved appearance drawn as the content of a page of its own: the text the appearance's
 * glyphs carry is then what a reader extracts from that page (copy, search).
 */
async function appearanceAsPage(bytes: Uint8Array): Promise<Uint8Array> {
  const { doc, annot } = await appearanceOf(bytes);
  const ap = doc.context.lookup(annot.get(PDFName.of('AP'))) as PDFDict;
  const ref = ap.get(PDFName.of('N')) as PDFRef;
  const page = doc.addPage([612, 792]);
  const name = page.node.newXObject('Ap', ref);
  page.pushOperators(pushGraphicsState(), drawObject(name), popGraphicsState());
  return new Uint8Array(await doc.save());
}

async function pdfjsRead(bytes: Uint8Array, pageNumber: number) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  const task = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(pageNumber);
    const annotations = (await page.getAnnotations()) as {
      subtype: string;
      contentsObj?: { str: string };
    }[];
    const content = await page.getTextContent();
    const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    return { annotations, text };
  } finally {
    await task.destroy();
  }
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('Turkish free text (M2-a)', () => {
  test('PDFium: the saved file lists the same text, and its appearance draws every line', async () => {
    const saved = await savedWith(TURKISH, 'ft-pdfium');
    const reopened = sid('ft-pdfium-reopen');
    await adapter.open(reopened, saved.slice().buffer);
    const [box] = (await adapter.listAnnotations(reopened, 0)).filter(
      (a) => a.kind === 'free-text',
    );
    expect((box as FreeTextAnnotation).text).toBe(TURKISH);
    await adapter.close(reopened);

    // The appearance's glyphs, extracted by PDFium from a page that draws it.
    const page = sid('ft-pdfium-ap');
    await adapter.open(page, (await appearanceAsPage(saved)).slice().buffer);
    const runs = await adapter.getPageText(page, 1);
    expect(squash(runs.map((r) => r.text).join(' '))).toBe(squash(TURKISH));
    await adapter.close(page);
  });

  test('pdf.js: the annotation carries the text, and its appearance extracts to it', async () => {
    const saved = await savedWith(TURKISH, 'ft-pdfjs');
    const { annotations } = await pdfjsRead(saved, 1);
    const freeText = annotations.find((a) => a.subtype === 'FreeText');
    expect(freeText?.contentsObj?.str).toBe(TURKISH);
    const { text } = await pdfjsRead(await appearanceAsPage(saved), 2);
    expect(squash(text)).toBe(squash(TURKISH));
  });

  test('Acrobat: an embedded subset with ToUnicode under the /DA font, UTF-16 /Contents', async () => {
    const saved = await savedWith(TURKISH, 'ft-acrobat');
    const { annot, form, doc } = await appearanceOf(saved);
    const contents = annot.get(PDFName.of('Contents'));
    expect(contents instanceof PDFHexString || contents instanceof PDFString).toBe(true);
    expect((contents as PDFHexString | PDFString).decodeText()).toBe(TURKISH);
    const da = (annot.get(PDFName.of('DA')) as PDFString).decodeText();
    const daFont = /\/([^\s/]+)\s+[\d.]+\s+Tf/.exec(da)?.[1] as string;
    // The font under the /DA name, in the appearance or the forms it draws.
    const findFont = (stream: PDFRawStream, depth: number): PDFDict | undefined => {
      const resources = doc.context.lookup(stream.dict.get(PDFName.of('Resources'))) as
        | PDFDict
        | undefined;
      const fonts = doc.context.lookup(resources?.get(PDFName.of('Font'))) as PDFDict | undefined;
      const own = doc.context.lookup(fonts?.get(PDFName.of(daFont))) as PDFDict | undefined;
      if (own || depth > 3) return own;
      const xobjects = doc.context.lookup(resources?.get(PDFName.of('XObject'))) as
        | PDFDict
        | undefined;
      for (const [, value] of xobjects?.entries() ?? []) {
        const nested = doc.context.lookup(value);
        const found = nested instanceof PDFRawStream ? findFont(nested, depth + 1) : undefined;
        if (found) return found;
      }
      return undefined;
    };
    const font = findFont(form, 0) as PDFDict;
    expect(font.get(PDFName.of('Subtype'))).toBe(PDFName.of('Type0'));
    expect(font.get(PDFName.of('ToUnicode'))).toBeInstanceOf(PDFRef);
    const descendant = doc.context.lookup(
      (doc.context.lookup(font.get(PDFName.of('DescendantFonts'))) as PDFArray).get(0),
    ) as PDFDict;
    const descriptor = doc.context.lookup(descendant.get(PDFName.of('FontDescriptor'))) as PDFDict;
    expect(descriptor.get(PDFName.of('FontFile2'))).toBeInstanceOf(PDFRef);
    expect((descriptor.get(PDFName.of('FontName')) as PDFName).asString()).toMatch(/^\/Inter/);
    const report = await checkAnnotationConformance(saved.slice().buffer);
    expect(report.problems).toEqual([]);
  });

  test('moving the box keeps the embedded appearance (EmbedPDF regenerates, ours replaces it)', async () => {
    const source = sid('ft-move');
    await adapter.open(source, await makePdf([{ size: [612, 792] }]));
    const created = await adapter.createAnnotation(source, textBox(TURKISH));
    await adapter.updateAnnotation(source, {
      ...(created as FreeTextAnnotation),
      rect: { ...RECT, x: 100, y: 300 },
    });
    const saved = new Uint8Array(await adapter.save(source));
    await adapter.close(source);
    const { text } = await pdfjsRead(await appearanceAsPage(saved), 2);
    expect(squash(text)).toBe(squash(TURKISH));
  });

  test('WinAnsi text keeps PDFium’s own appearance (standard Helvetica, not embedded)', async () => {
    const saved = await savedWith('Plain Latin text, çöü', 'ft-latin');
    const { form, doc } = await appearanceOf(saved);
    const resources = doc.context.lookup(form.dict.get(PDFName.of('Resources'))) as PDFDict;
    const fonts = doc.context.lookup(resources.get(PDFName.of('Font'))) as PDFDict;
    const helv = doc.context.lookup(fonts.get(PDFName.of('Helv'))) as PDFDict;
    expect(helv.get(PDFName.of('Subtype'))).toBe(PDFName.of('Type1'));
    const content = new TextDecoder().decode(decodePDFRawStream(form).decode());
    expect(content).toContain('/Helv 14 Tf');
  });

  test('text the bundled font cannot show is refused, and nothing is written', async () => {
    const source = sid('ft-cjk');
    await adapter.open(source, await makePdf([{ size: [612, 792] }]));
    await expect(adapter.createAnnotation(source, textBox('Merhaba 世界'))).rejects.toMatchObject({
      code: 'unsupported',
    });
    expect(await adapter.listAnnotations(source, 0)).toEqual([]);
    await adapter.close(source);
  });

  test('lines wrap at the box width, words first, then characters', () => {
    const measure = (s: string) => s.length * 10;
    expect(wrapFreeText('ab cd efgh', 50, measure)).toEqual(['ab cd', 'efgh']);
    expect(wrapFreeText('abcdefgh ij', 30, measure)).toEqual(['abc', 'def', 'gh', 'ij']);
    expect(wrapFreeText('one\ntwo', 100, measure)).toEqual(['one', 'two']);
  });
});
